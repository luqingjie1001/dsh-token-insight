/**
 * dsh-token-meter — Host half.
 *
 * 从会话日志（唯一权威数据源）还原 token 用量，按「会话 / 轮次 / 工作区 / 每日 × 模型」聚合，
 * 通过 Typert Remote 暴露给浏览器端：
 *   - getOverview()            总览：每日×模型、模型合计、会话、工作区
 *   - getSessionTurns(id)      单个会话：每轮（用户输入 → 模型输出完成）用量、预览与产物
 *
 * 采集：
 *   - LIVE   : `session/event` 追加流，逐条累加
 *   - HISTORY: `sessionQuery.listSessions()` + `readSession()` 回填
 *   - DEDUP  : 以会话事件 seq 为水位线，实时与回填互不重复
 *   - SOURCE : assistant/message.usage + message.source（kind === 'model'）
 *
 * 所有步骤 best-effort：任何采集失败只影响数据完整性，不影响插件注册与页面渲染。
 */

import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Service } from "@deepseek-ai/cordis";

const DAY_MS = 86400000;
const WINDOW_DAYS = 400;
const MAX_PROMPT = 160;
const MAX_REPLY = 160;

/** 手动套用 Remote 装饰器（Node ESM 不支持装饰器语法）。 */
function markRemoteMethod(instance, method, exportName) {
  const decorator = Remote(method, undefined);
  const initializers = [];
  decorator(undefined, {
    kind: "method",
    name: method,
    static: false,
    private: false,
    addInitializer: (fn) => initializers.push(fn),
  });
  for (const fn of initializers) fn.call(instance);
}

function buckets() {
  return { calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, total: 0 };
}

function addUsage(target, usage) {
  const input = Number(usage.inputTokens) || 0;
  const output = Number(usage.outputTokens) || 0;
  const cacheRead = Number(usage.cacheReadTokens) || 0;
  const cacheWrite = Number(usage.cacheWriteTokens) || 0;
  const total = input + output + cacheRead + cacheWrite;
  target.calls += 1;
  target.input += input;
  target.output += output;
  target.cacheRead += cacheRead;
  target.cacheWrite += cacheWrite;
  target.total += total;
  return total;
}

function mergeBuckets(target, b) {
  target.calls += b.calls;
  target.input += b.input;
  target.output += b.output;
  target.cacheRead += b.cacheRead;
  target.cacheWrite += b.cacheWrite;
  target.total += b.total;
}

function dayKeyOf(time) {
  const d = new Date(time);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

function textOfMessage(message) {
  if (!message || !Array.isArray(message.content)) return "";
  const parts = [];
  for (const block of message.content) {
    if (block && block.type === "text" && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("\n").trim();
}

function clip(text, max) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** 会话启动时注入的运行时上下文，不算「用户输入」。 */
function isInjectedPrompt(text) {
  const s = String(text || "").trimStart();
  return (
    s.startsWith("Current runtime context") ||
    s.startsWith("<system-reminder") ||
    s.startsWith("Time sampled") ||
    s.startsWith("A skill is a reusable")
  );
}

function baseName(p) {
  if (!p) return "";
  const parts = String(p).split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : String(p);
}

export class TokenUsageService extends TypertRemoteService {
  static inject = [];

  constructor(ctx, config) {
    super(ctx, "tokenUsage");
  }

  [Service.init]() {
    /** sessionId -> session aggregate */
    this._sessions = new Map();
    /** dayKey -> Map<modelKey, buckets> */
    this._byDay = new Map();
    /** modelKey -> { key, name, provider } */
    this._modelMeta = new Map();
    /** sessionId -> highest folded event seq */
    this._watermark = new Map();
    this._backfill = { started: false, done: false, total: 0, doneCount: 0, error: null };
    this._ready = false;

    try {
      markRemoteMethod(this, "getOverview", "getOverview");
    } catch (e) {
      /* keep service alive */
    }
    try {
      markRemoteMethod(this, "getSessionTurns", "getSessionTurns");
    } catch (e) {
      /* keep service alive */
    }

    // 实时：会话每次提交追加
    try {
      this.ctx.on("session/event", (session, event) => {
        try {
          this._onSessionEvent(session, event);
        } catch (e) {
          /* keep collector robust */
        }
      });
    } catch (e) {
      /* keep service alive */
    }

    try {
      this.ctx.effect(() => () => {
        if (this._retryTimer) clearTimeout(this._retryTimer);
        this._retryTimer = null;
      });
    } catch (e) {
      /* ignore */
    }

    this._kickBackfill();
  }

  // ---------------------------------------------------------------- 采集

  _kickBackfill() {
    const started = this._startBackfill();
    if (started && typeof started.catch === "function") {
      started.catch(() => {
        this._backfill.error = this._backfill.error || "history backfill failed";
        this._backfill.done = true;
        this._ready = true;
      });
    }
  }

  async _startBackfill() {
    if (this._backfill.started) return;
    const sessionQuery = this.ctx.get("sessionQuery");
    if (!sessionQuery || typeof sessionQuery.listSessions !== "function") {
      // 服务可能稍后挂载：最多重试 20 次（约 20 秒）
      this._retryCount = (this._retryCount || 0) + 1;
      if (this._retryCount <= 20 && !this._retryTimer) {
        this._retryTimer = setTimeout(() => {
          this._retryTimer = null;
          const p = this._startBackfill();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }, 1000);
        if (this._retryTimer && typeof this._retryTimer.unref === "function") this._retryTimer.unref();
      } else if (this._retryCount > 20) {
        this._backfill.error = "sessionQuery 服务不可用";
        this._backfill.done = true;
        this._ready = true;
      }
      return;
    }

    this._backfill.started = true;
    try {
      let records = [];
      try {
        records = (await sessionQuery.listSessions()) || [];
      } catch (e) {
        records = [];
      }
      this._backfill.total = records.length;

      let next = 0;
      const worker = async () => {
        for (;;) {
          const idx = next++;
          if (idx >= records.length) return;
          const rec = records[idx];
          const header = rec && rec.header;
          if (!header || !header.id) {
            this._backfill.doneCount += 1;
            continue;
          }
          const agg = this._ensureSession(header.id);
          agg.live = !!rec.live;
          agg.cwd = header.cwd || agg.cwd;
          agg.createdAt = header.createdAt || agg.createdAt;
          if (header.origin === "subagent" || (header.delegationDepth || 0) > 0) agg.subagent = true;
          try {
            const snap = await sessionQuery.readSession(header.id);
            if (snap && Array.isArray(snap.events)) {
              for (const ev of snap.events) this._fold(header.id, ev);
            }
          } catch (e) {
            /* 单个会话不可读：跳过 */
          }
          this._backfill.doneCount += 1;
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      this._backfill.done = true;
      this._ready = true;
    } catch (e) {
      this._backfill.error = String((e && e.message) || e);
      this._backfill.done = true;
      this._ready = true;
    }
  }

  _ensureSession(sessionId) {
    let s = this._sessions.get(sessionId);
    if (!s) {
      s = {
        id: sessionId,
        title: null,
        cwd: null,
        createdAt: null,
        firstAt: Infinity,
        lastAt: 0,
        live: false,
        subagent: false,
        calls: 0,
        totals: buckets(),
        byModel: new Map(),
        turns: new Map(),
        turnOrder: [],
        lastTurn: 0,
      };
      this._sessions.set(sessionId, s);
    }
    return s;
  }

  _ensureTurn(session, turnNo) {
    const n = Number.isFinite(turnNo) && turnNo > 0 ? turnNo : session.lastTurn || 1;
    let t = session.turns.get(n);
    if (!t) {
      t = {
        turn: n,
        startTime: null,
        endTime: null,
        calls: 0,
        totals: buckets(),
        byModel: new Map(),
        prompt: "",
        reply: "",
        reason: "",
        artifacts: [],
      };
      session.turns.set(n, t);
      session.turnOrder.push(n);
      session.turnOrder.sort((a, b) => a - b);
      session.lastTurn = Math.max(session.lastTurn, n);
    }
    return t;
  }

  _addToMap(map, key, usage) {
    let b = map.get(key);
    if (!b) {
      b = buckets();
      map.set(key, b);
    }
    addUsage(b, usage);
    return b;
  }

  _fold(sessionId, event) {
    if (!event || typeof event !== "object") return;
    const seq = Number(event.seq);
    const wm = this._watermark.get(sessionId) ?? -1;
    if (Number.isFinite(seq) && seq <= wm) return;
    if (Number.isFinite(seq)) this._watermark.set(sessionId, seq);

    const session = this._ensureSession(sessionId);
    const time = Number(event.time) || Date.now();
    if (time < session.firstAt) session.firstAt = time;
    if (time > session.lastAt) session.lastAt = time;

    const type = event.type;
    const data = event.data || {};

    if (type === "assistant/message") {
      const usage = data.usage;
      const src = data.message && data.message.source;
      if (!usage || !src || src.kind !== "model") return;
      const key = this._modelKey(src.provider, src.model);
      const turn = this._ensureTurn(session, data.turn);
      this._addToMap(session.byModel, key, usage);
      this._addToMap(turn.byModel, key, usage);
      const total = addUsage(session.totals, usage);
      addUsage(turn.totals, usage);
      session.calls += 1;
      turn.calls += 1;
      if (total > 0) {
        const day = dayKeyOf(time);
        let map = this._byDay.get(day);
        if (!map) {
          map = new Map();
          this._byDay.set(day, map);
        }
        this._addToMap(map, key, usage);
      }
      const reply = textOfMessage(data.message);
      if (reply) turn.reply = clip(reply, MAX_REPLY);
      return;
    }

    if (type === "turn/start") {
      const turn = this._ensureTurn(session, data.turn);
      if (!turn.startTime) turn.startTime = time;
      return;
    }

    if (type === "turn/end") {
      const turn = this._ensureTurn(session, data.turn);
      turn.endTime = time;
      const reason = data.reason;
      turn.reason = reason && reason.kind ? reason.kind : "";
      return;
    }

    if (type === "user/message") {
      const turn = this._ensureTurn(session, data.turn || session.lastTurn);
      if (!turn.prompt) {
        const text = textOfMessage(data);
        if (text && !isInjectedPrompt(text)) turn.prompt = clip(text, MAX_PROMPT);
      }
      return;
    }

    if (type === "deliverables/presented") {
      const turn = this._ensureTurn(session, data.turn || session.lastTurn);
      const files = Array.isArray(data.files) ? data.files : [];
      for (const f of files) {
        if (!f || typeof f.path !== "string") continue;
        if (turn.artifacts.some((a) => a.path === f.path)) continue;
        turn.artifacts.push({
          path: f.path,
          name: baseName(f.path),
          description: typeof f.description === "string" ? f.description : "",
        });
      }
      return;
    }

    if (type === "session/title") {
      if (typeof data.title === "string" && data.title.trim()) session.title = data.title.trim();
    }
  }

  _onSessionEvent(session, event) {
    if (!session || !session.id) return;
    const agg = this._ensureSession(session.id);
    agg.live = true;
    const header = session.header || {};
    if (header.cwd && !agg.cwd) agg.cwd = header.cwd;
    if (header.createdAt && !agg.createdAt) agg.createdAt = header.createdAt;
    this._fold(session.id, event);
  }

  _modelKey(provider, model) {
    const p = provider || "unknown";
    const m = model || "unknown";
    const key = `${p}::${m}`;
    if (!this._modelMeta.has(key)) this._modelMeta.set(key, { key, name: m, provider: p });
    return key;
  }

  // ---------------------------------------------------------------- 聚合视图

  _sessionView(s, workspace) {
    const models = [...s.byModel.entries()]
      .map(([key, b]) => ({ key, calls: b.calls, total: b.total }))
      .sort((a, b) => b.total - a.total);
    return {
      id: s.id,
      title: s.title || "未命名会话",
      workspaceId: workspace ? workspace.id : null,
      workspace: workspace ? workspace.name : null,
      cwd: s.cwd || null,
      live: !!s.live,
      subagent: !!s.subagent,
      createdAt: s.createdAt || (Number.isFinite(s.firstAt) ? s.firstAt : null),
      firstAt: Number.isFinite(s.firstAt) ? s.firstAt : null,
      lastAt: s.lastAt || null,
      calls: s.calls,
      total: s.totals.total,
      input: s.totals.input,
      cacheRead: s.totals.cacheRead,
      output: s.totals.output,
      models,
    };
  }

  _workspaceMap() {
    const map = new Map();
    let list = [];
    try {
      const registry = this.ctx.get("workspaceRegistry");
      if (registry && typeof registry.list === "function") list = registry.list() || [];
    } catch (e) {
      list = [];
    }
    for (const ws of list) {
      const ids = Array.isArray(ws.sessionIds) ? ws.sessionIds : [];
      for (const sid of ids) map.set(sid, { id: ws.id, name: ws.title || baseName(ws.path), path: ws.path || null });
    }
    return { map, list };
  }

  _buildOverview() {
    const { map: assigned, list: registryList } = this._workspaceMap();

    const models = [...this._modelMeta.values()].map((meta) => {
      let total = 0;
      let calls = 0;
      let sessions = 0;
      for (const s of this._sessions.values()) {
        const b = s.byModel.get(meta.key);
        if (b && b.total > 0) {
          total += b.total;
          calls += b.calls;
          sessions += 1;
        }
      }
      return { ...meta, total, calls, sessions };
    }).filter((m) => m.total > 0).sort((a, b) => b.total - a.total);

    const totals = { sessions: 0, calls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, total: 0 };
    const sessions = [];
    for (const s of this._sessions.values()) {
      if (s.calls === 0) continue;
      const ws = assigned.get(s.id);
      const view = this._sessionView(s, ws);
      if (!ws && s.cwd) {
        view.workspace = baseName(s.cwd);
        view.workspaceId = "cwd:" + s.cwd;
      }
      totals.sessions += 1;
      totals.calls += view.calls;
      totals.input += view.input;
      totals.cacheRead += view.cacheRead;
      totals.output += view.output;
      totals.total += view.total;
      sessions.push(view);
    }
    sessions.sort((a, b) => b.total - a.total);

    // 每日（限制在最近 WINDOW_DAYS 天，控制载荷）
    const cutoff = dayKeyOf(Date.now() - WINDOW_DAYS * DAY_MS);
    const days = [...this._byDay.entries()]
      .filter(([date]) => date >= cutoff)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, map]) => {
        const list = [...map.entries()]
          .map(([key, b]) => ({
            key,
            calls: b.calls,
            input: b.input,
            cacheRead: b.cacheRead,
            output: b.output,
            total: b.total,
          }))
          .sort((a, b) => b.total - a.total);
        const day = { date, calls: 0, total: 0, models: list };
        for (const m of list) {
          day.calls += m.calls;
          day.total += m.total;
        }
        return day;
      })
      .filter((d) => d.total > 0);

    // 工作区（注册表里的全部 + 未归档会话按 cwd 兜底）
    const workspaces = [];
    const byId = new Map();
    for (const ws of registryList) {
      const entry = {
        id: ws.id,
        name: ws.title || baseName(ws.path),
        path: ws.path || null,
        calls: 0,
        total: 0,
        sessionIds: [],
      };
      byId.set(entry.id, entry);
      workspaces.push(entry);
    }
    const cwdGroups = new Map();
    for (const view of sessions) {
      let entry = view.workspaceId ? byId.get(view.workspaceId) : null;
      if (!entry && view.cwd) {
        entry = cwdGroups.get(view.cwd);
        if (!entry) {
          entry = { id: "cwd:" + view.cwd, name: baseName(view.cwd) || "未归档", path: view.cwd, calls: 0, total: 0, sessionIds: [] };
          cwdGroups.set(view.cwd, entry);
          workspaces.push(entry);
        }
      }
      if (entry) {
        entry.calls += view.calls;
        entry.total += view.total;
        entry.sessionIds.push(view.id);
      }
    }
    const shown = workspaces.filter((w) => w.total > 0).sort((a, b) => b.total - a.total);

    return {
      ready: this._ready,
      progress: {
        done: this._backfill.doneCount,
        total: this._backfill.total,
        error: this._backfill.error,
      },
      generatedAt: Date.now(),
      timeZone: "local",
      totals,
      models,
      days,
      sessions,
      workspaces: shown,
    };
  }

  // ---------------------------------------------------------------- Remote API

  async getOverview() {
    try {
      return { ok: true, value: this._buildOverview() };
    } catch (e) {
      return { ok: false, error: { code: "overview_failed", message: String((e && e.message) || e) } };
    }
  }

  async getSessionTurns(sessionId) {
    try {
      if (!sessionId || typeof sessionId !== "string") {
        return { ok: false, error: { code: "bad_request", message: "sessionId is required" } };
      }
      const s = this._sessions.get(sessionId);
      if (!s) {
        return { ok: false, error: { code: "not_found", message: "会话尚未采集完成" } };
      }
      const { map: assigned } = this._workspaceMap();
      const view = this._sessionView(s, assigned.get(sessionId));
      const turns = s.turnOrder
        .map((n) => s.turns.get(n))
        .filter(Boolean)
        .filter((t) => t.calls > 0 || t.artifacts.length > 0)
        .map((t) => ({
          turn: t.turn,
          startTime: t.startTime,
          endTime: t.endTime,
          calls: t.calls,
          total: t.totals.total,
          input: t.totals.input,
          cacheRead: t.totals.cacheRead,
          output: t.totals.output,
          prompt: t.prompt || "",
          reply: t.reply || "",
          reason: t.reason || "",
          models: [...t.byModel.entries()]
            .map(([key, b]) => ({ key, calls: b.calls, total: b.total }))
            .sort((a, b) => b.total - a.total),
          artifacts: t.artifacts,
        }));
      return {
        ok: true,
        value: {
          session: { ...view, turnCount: turns.length },
          turns,
        },
      };
    } catch (e) {
      return { ok: false, error: { code: "session_failed", message: String((e && e.message) || e) } };
    }
  }
}

export default TokenUsageService;
