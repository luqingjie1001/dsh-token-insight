/**
 * dsh-token-meter — Client half (web bundle).
 *
 * 注册三块 UI：
 *   1. 侧栏「Token 用量」页面（sidebar.panellist + main）：
 *      本月每日用量（按模型堆叠）、近一年每日热力图（按模型着色）、工作区/会话用量。
 *   2. 会话输入框工具行（conversation.input.right）：
 *      当前会话累计用量；点击打开「本会话每轮用量与产物」面板。
 *   3. shell.overlay：上述面板（会话级轮次明细）。
 *
 * 数据来自 Host 的 `tokenUsage` Remote 服务。
 */
window.__ModuleLoader__.load({
  id: "dsh-token-insight",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const { useState, useEffect, useMemo } = React;

    const CLIENT_BUNDLE_ID = "dsh-token-insight";
    const PALETTE = [
      "#4d6bfe", "#12b76a", "#f79009", "#7a5af8", "#ee46bc", "#06aed4",
      "#fb7185", "#14b8a6", "#eab308", "#8b5cf6", "#f97316", "#22c55e",
    ];
    const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    /** 热力图单色：天蓝（sky-500）。仅用于数据着色。 */
    const HEAT_BLUE = "#0ea5e9";
    const pad2 = (n) => String(n).padStart(2, "0");

    function fmt(n) {
      return Number(n || 0).toLocaleString("en-US");
    }
    function compact(n) {
      n = Number(n || 0);
      if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, "") + "亿";
      if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e6 ? 1 : 2).replace(/\.?0+$/, "") + "万";
      return String(n);
    }
    function pct(v, t) {
      return t ? ((v / t) * 100).toFixed(1) + "%" : "0%";
    }
    function dk(d) {
      return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
    }
    function timeStr(ms) {
      if (!ms) return "—";
      const d = new Date(ms);
      return pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    }

    function colorMapOf(models) {
      const map = new Map();
      (models || []).forEach((m, i) => map.set(m.key, PALETTE[i % PALETTE.length]));
      return map;
    }
    function modelName(models, key) {
      const m = (models || []).find((x) => x.key === key);
      return m ? m.name : key;
    }

    const passthrough = () => ({ parse: (v) => v });
    const createPassthrough = () => passthrough();

    const CLIENT_REMOTE = {
      package: "dsh-token-insight",
      descriptors: [
        {
          id: "dsh-token-insight#tokenUsage/getOverview",
          service: "tokenUsage",
          namespace: "tokenUsage",
          method: "getOverview",
          invocation: { kind: "direct" },
          parameters: [],
          result: {
            mode: "strict",
            typeSymbol: "dsh-token-insight#TokenUsageOverviewResult",
            schema: passthrough(),
            create: createPassthrough,
          },
        },
        {
          id: "dsh-token-insight#tokenUsage/getSessionTurns",
          service: "tokenUsage",
          namespace: "tokenUsage",
          method: "getSessionTurns",
          invocation: { kind: "direct" },
          parameters: [
            {
              name: "sessionId",
              wire: "sessionId",
              source: "json",
              codec: {
                mode: "strict",
                typeSymbol: "dsh-token-insight#tokenUsage/getSessionTurns:sessionId",
                schema: passthrough(),
                create: createPassthrough,
              },
            },
          ],
          result: {
            mode: "strict",
            typeSymbol: "dsh-token-insight#TokenUsageSessionResult",
            schema: passthrough(),
            create: createPassthrough,
          },
        },
      ],
    };

    const CSS = `
.tm-page-scroll{height:100%;max-height:100vh;min-height:0;width:100%;flex:1 1 auto;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
.tm-page{max-width:1040px;margin:0 auto;padding:26px 26px 64px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.tm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
.tm-title{font-size:20px;font-weight:600;margin:0;letter-spacing:-.01em}
.tm-sub{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px}
.tm-head-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.tm-btn{box-sizing:border-box;height:28px;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-secondary);padding:0 12px;font-size:12px;line-height:26px}
.tm-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.tm-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.tm-kpi{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:14px 16px;min-width:0}
.tm-kpi-label{font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-kpi-value{font-size:24px;font-weight:600;margin-top:4px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-kpi-value small{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);margin-left:3px}
.tm-kpi-foot{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:16px 18px 18px;margin-bottom:16px;min-width:0}
.tm-card-head{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.tm-card-title{font-size:14px;font-weight:600;margin:0}
.tm-card-note{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.tm-legend{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}
.tm-legend-item{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.tm-legend-item b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}
.tm-dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
.tm-month{display:flex;flex-direction:column;gap:8px}
.tm-month-scale{display:flex;justify-content:space-between;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.tm-month-bars{display:flex;align-items:flex-end;gap:2px}
.tm-month-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px}
.tm-month-plot{height:150px;width:100%;display:flex;align-items:flex-end;justify-content:center}
.tm-month-bar{width:min(18px,72%);border-radius:3px 3px 0 0;overflow:hidden;display:flex;flex-direction:column-reverse;background:var(--dsw-alias-bg-layer-2)}
.tm-month-bar i{display:block;width:100%;min-height:1px}
.tm-month-x{font-size:10px;color:var(--dsw-alias-label-secondary);line-height:1}
.tm-heat-wrap{display:flex;gap:6px;align-items:flex-start;overflow-x:auto;padding-bottom:2px}
.tm-heat-weekdays{display:flex;flex-direction:column;gap:2px;padding-top:16px;flex:none}
.tm-heat-weekday{height:11px;font-size:9.5px;line-height:11px;color:var(--dsw-alias-label-secondary);width:12px;text-align:left}
.tm-heat-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.tm-heat-months{display:flex;gap:2px;height:13px;font-size:10px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.tm-heat-month{width:11px;flex:none;overflow:visible}
.tm-heat-grid{display:flex;gap:2px}
.tm-heat-col{display:flex;flex-direction:column;gap:2px}
.tm-heat-cell{width:11px;height:11px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column-reverse;overflow:hidden;box-sizing:border-box}
.tm-heat-cell i{display:block;width:100%;min-height:1px}

.tm-ws{border-top:1px solid var(--dsw-alias-border-l1);padding:14px 0 4px}
.tm-ws:first-of-type{border-top:none;padding-top:2px}
.tm-ws-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tm-ws-name{font-weight:600;font-size:13.5px}
.tm-ws-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.tm-ws-path{font-size:10.5px;color:var(--dsw-alias-label-secondary);margin-top:1px;word-break:break-all}
.tm-table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
.tm-table th{color:var(--dsw-alias-label-secondary);font-weight:500;font-size:10.5px;text-align:right;padding:5px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap}
.tm-table th:first-child{text-align:left}
.tm-table td{padding:7px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;vertical-align:middle}
.tm-table td:first-child{text-align:left;white-space:normal;max-width:420px}
.tm-table tr:last-child td{border-bottom:none}
.tm-session-link{background:none;border:none;padding:0;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;line-height:1.35}
.tm-session-link:hover{color:var(--dsw-alias-brand-primary);text-decoration:underline}
.tm-session-time{font-size:10.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap;margin-left:2px}
.tm-session-meta{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:3px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.tm-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;line-height:1.5;padding:0 5px;border-radius:4px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}
.tm-tag-live{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.tm-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:18px 0;text-align:center}
.tm-note{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.7;margin-top:4px}
.tm-chip{box-sizing:border-box;height:24px;display:inline-flex;align-items:center;gap:5px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;line-height:22px;cursor:pointer;max-width:190px;white-space:nowrap}
.tm-chip:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.tm-chip b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}
.tm-chip svg{flex:none;opacity:.75}
.tm-chip-extra{color:var(--dsw-alias-label-secondary);font-size:10.5px}
.tm-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(8,12,24,.42);display:flex;align-items:center;justify-content:center;padding:28px;box-sizing:border-box}
.tm-modal{width:min(840px,100%);max-height:min(82vh,820px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.32);overflow:hidden;color:var(--dsw-alias-label-primary)}
.tm-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px 12px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.tm-modal-title{font-size:15px;font-weight:600;margin:0}
.tm-modal-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:3px;word-break:break-all}
.tm-modal-close{box-sizing:border-box;width:28px;height:28px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:16px;line-height:1;flex:none}
.tm-modal-close:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tm-modal-body{padding:16px 20px 20px;overflow:auto;display:flex;flex-direction:column;gap:14px}
.tm-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.tm-sum-item{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;min-width:0}
.tm-sum-label{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.tm-sum-value{font-size:17px;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-turn{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.tm-turn-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tm-turn-no{font-weight:600;font-size:12.5px}
.tm-turn-time{font-size:10.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.tm-turn-total{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums;font-size:12.5px}
.tm-turn-prompt{font-size:11.5px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:6px 8px;word-break:break-word}
.tm-turn-reply{font-size:11px;color:var(--dsw-alias-label-secondary);padding:0 2px;word-break:break-word}
.tm-turn-meta{display:flex;flex-wrap:wrap;gap:5px 10px;align-items:center;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.tm-artifacts{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.tm-artifact{display:inline-flex;align-items:center;gap:5px;max-width:100%;font-size:10.5px;padding:3px 7px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.tm-artifact b{color:var(--dsw-alias-label-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.tm-artifact-title{font-size:10px;color:var(--dsw-alias-label-secondary)}
.tm-loading{padding:60px 0;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12.5px}
.tm-progress{width:260px;height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);margin:12px auto 0;overflow:hidden}
.tm-progress i{display:block;height:100%;background:var(--dsw-alias-brand-primary);transition:width .3s}
.tm-error{padding:16px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;color:var(--dsw-alias-state-error-primary);font-size:12px;margin-bottom:14px}
.tm-view{max-width:920px;width:100%;margin:0 auto;padding:22px 22px 56px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.tm-view-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
.tm-view-title{font-size:18px;font-weight:600;margin:0;letter-spacing:-.01em}
.tm-view .tm-card{margin-bottom:14px}
.tm-kpi{position:relative}
.tm-kpi-icon{position:absolute;right:12px;top:12px;color:var(--dsw-alias-label-secondary);opacity:.45;pointer-events:none;display:flex}
.tm-card-title{display:flex;align-items:center;gap:7px}
.tm-card-title svg{opacity:.55;flex:none}
.tm-tip{position:fixed;z-index:1400;pointer-events:none;min-width:200px;max-width:330px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;box-shadow:0 14px 36px rgba(0,0,0,.24);font-size:11.5px;color:var(--dsw-alias-label-primary);line-height:1.55}
.tm-tip-title{font-weight:600;font-size:12px;margin-bottom:2px;word-break:break-word}
.tm-tip-sub{color:var(--dsw-alias-label-secondary);font-size:10.5px;margin-bottom:6px;word-break:break-word}
.tm-tip-row{display:flex;align-items:center;gap:6px;line-height:1.7;min-width:0}
.tm-tip-row span{color:var(--dsw-alias-label-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tm-tip-row b{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.tm-tip-empty{color:var(--dsw-alias-label-secondary);font-size:10.5px;padding:2px 0}
.tm-tip-foot{margin-top:6px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:10.5px}
.tm-ws-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 4px;flex-wrap:wrap}
.tm-btn-sm{height:24px;line-height:22px;padding:0 9px;font-size:11px;border-radius:12px}
.tm-ws-toggle{width:100%;display:flex;align-items:center;gap:8px;background:none;border:none;padding:0 0 2px;font:inherit;color:inherit;text-align:left;cursor:pointer}
.tm-ws-toggle:hover .tm-ws-name{color:var(--dsw-alias-brand-primary)}
.tm-chev{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);transition:transform .15s;flex:none}
.tm-chev.open{transform:rotate(90deg)}
.tm-ws-title{display:flex;flex-direction:column;min-width:0;flex:1}
.tm-ws-title .tm-ws-path{display:block}
.tm-ws-toggle .tm-ws-meta{margin-left:auto;flex:none}
.tm-ws-models{display:flex;flex-wrap:wrap;gap:6px;padding:2px 0 6px 20px}
.tm-ws-toolbar + .tm-ws{border-top:none;padding-top:2px}
.tm-session-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.tm-expand{width:18px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:4px}
.tm-expand:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.tm-expand svg{transition:transform .15s;opacity:.75}
.tm-expand.open svg{transform:rotate(90deg)}
.tm-subrow td{background:var(--dsw-alias-bg-layer-2);padding:10px 12px 12px}
.tm-subtable{width:100%;border-collapse:collapse;font-size:11px}
.tm-subtable th{text-align:right;font-weight:500;color:var(--dsw-alias-label-secondary);padding:3px 6px;font-size:10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.tm-subtable th:first-child,.tm-subtable td:first-child{text-align:left}
.tm-subtable td{text-align:right;padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums}
.tm-subtable tr:last-child td{border-bottom:none}
.tm-subtable td .tm-dot{margin-right:6px}
.tm-subrow-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;font-size:10.5px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}
.tm-month-body{display:flex;gap:8px;align-items:flex-start}
.tm-month-y{width:42px;height:150px;flex:none;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;font-size:9.5px;line-height:1;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.tm-month-area{flex:1;min-width:0;position:relative}
.tm-month-grid{position:absolute;left:0;right:0;top:0;height:150px;pointer-events:none}
.tm-month-grid i{position:absolute;left:0;right:0;border-top:1px dashed var(--dsw-alias-border-l1);opacity:.7}
.tm-month-grid i:last-child{border-top-style:solid}
.tm-month-bars{position:relative;z-index:1}
.tm-heat-cell{width:12px;height:12px;border-radius:3px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);padding:1px;position:relative;transition:box-shadow .12s,transform .12s}
.tm-heat-cell:hover{box-shadow:0 0 0 1.5px #0ea5e9;z-index:3}
.tm-heat-cell i{display:block;width:100%;min-height:1px}
.tm-heat-future{background:var(--dsw-alias-bg-layer-1);opacity:1}
.tm-heat-out{opacity:.45}
.tm-heat-weekday{height:12px;line-height:12px;width:12px}
.tm-heat-month{width:12px}
.tm-heat-fill{display:block;width:100%;height:100%;border-radius:2px}
.tm-heat-legend{display:flex;align-items:center;gap:4px;font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.tm-heat-legend i{width:10px;height:10px;border-radius:2px;border:1px solid var(--dsw-alias-border-l1);display:block}
@media (max-width:760px){.tm-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.tm-sum{grid-template-columns:repeat(2,minmax(0,1fr))}.tm-page{padding:18px 14px 48px}}
`;

    // ------------------------------------------------------------ shared store
    const modalStore = {
      value: null,
      subs: new Set(),
      get() {
        return this.value;
      },
      open(sessionId, title) {
        this.value = { sessionId, title: title || "" };
        this.emit();
      },
      close() {
        this.value = null;
        this.emit();
      },
      emit() {
        for (const fn of [...this.subs]) {
          try {
            fn(this.value);
          } catch (e) {
            /* ignore */
          }
        }
      },
      subscribe(fn) {
        this.subs.add(fn);
        return () => this.subs.delete(fn);
      },
    };

    // ------------------------------------------------------------ hover tip store
    const tipStore = {
      value: null,
      subs: new Set(),
      get() {
        return this.value;
      },
      show(payload, x, y) {
        this.value = { ...payload, x, y };
        this.emit();
      },
      hide() {
        if (!this.value) return;
        this.value = null;
        this.emit();
      },
      emit() {
        for (const fn of [...this.subs]) {
          try {
            fn(this.value);
          } catch (e) {
            /* ignore */
          }
        }
      },
      subscribe(fn) {
        this.subs.add(fn);
        return () => this.subs.delete(fn);
      },
    };

    // ------------------------------------------------------------ components
    const ICON_PATHS = {
      chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
      calendar: ["M4 6h16v14H4z", "M8 3v4", "M16 3v4", "M4 10h16"],
      clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
      year: ["M4 6h16v14H4z", "M8 3v4", "M16 3v4", "M4 10h16", "M8 14h8"],
      sessions: ["M21 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-9.5A7.5 7.5 0 0 1 10.5 4h3A7.5 7.5 0 0 1 21 11.5z"],
      workspace: ["M3 7h6l2 2h10v10H3z"],
      chevron: ["M9 6l6 6-6 6"],
      info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v6", "M12 8h.01"],
    };

    function Icon(props) {
      const name = (props && props.name) || "info";
      const size = (props && props.size) || 16;
      const paths = ICON_PATHS[name] || ICON_PATHS.info;
      return h(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.7,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
        },
        paths.map((d, i) => h("path", { d, key: i })),
      );
    }

    function weekdayName(dateStr) {
      const names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      const d = new Date(String(dateStr) + "T00:00:00");
      return names[d.getDay()] || "";
    }

    function sessionTimeRange(session) {
      if (!session || !session.firstAt) return "";
      const a = new Date(session.firstAt);
      const b = new Date(session.lastAt || session.firstAt);
      const left = timeStr(session.firstAt);
      if (!session.lastAt || session.lastAt === session.firstAt) return left;
      if (dk(a) === dk(b)) return left + " ~ " + pad2(b.getHours()) + ":" + pad2(b.getMinutes());
      return left + " ~ " + timeStr(session.lastAt);
    }

    function niceAxisMax(value) {
      if (!(value > 0)) return 1;
      const exp = Math.pow(10, Math.floor(Math.log10(value)));
      const n = value / exp;
      const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
      return step * exp;
    }

    function PanelIcon(props) {
      const size = (props && props.size) || 18;
      const active = !!(props && props.active);
      return h(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.8,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
          style: { opacity: active ? 1 : 0.82, display: "block" },
        },
        h("path", { d: "M4 20V11", key: "a" }),
        h("path", { d: "M10 20V5", key: "b" }),
        h("path", { d: "M16 20v-6", key: "c" }),
        h("path", { d: "M22 20H2", key: "d" }),
      );
    }

    function Legend(props) {
      const { models, colors, totals } = props;
      return h(
        "div",
        { className: "tm-legend" },
        models.map((m) =>
          h(
            "span",
            { className: "tm-legend-item", key: m.key },
            h("i", { className: "tm-dot", style: { background: colors.get(m.key) } }),
            m.name,
            h("b", null, compact(totals ? totals[m.key] || 0 : m.total)),
          ),
        ),
      );
    }

    function HeatLegend() {
      return h(
        "div",
        { className: "tm-heat-legend" },
        h("span", null, "少"),
        [1, 2, 3, 4].map((level) =>
          h("i", {
            key: level,
            style: {
              background:
                "color-mix(in srgb, " + HEAT_BLUE + " " + level * 25 + "%, var(--dsw-alias-bg-layer-2))",
            },
          }),
        ),
        h("span", null, "多"),
      );
    }

    function MonthChart(props) {
      const { dayMap, colors, models } = props;
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const items = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const key = year + "-" + pad2(month + 1) + "-" + pad2(d);
        items.push({ key, day: dayMap.get(key) || null, dayNo: d });
      }
      const rawMax = Math.max(1, ...items.map((x) => (x.day ? x.day.total : 0)));
      const max = niceAxisMax(rawMax);
      const ticks = [1, 0.75, 0.5, 0.25, 0];
      return h(
        "div",
        { className: "tm-month" },
        h("div", { className: "tm-month-scale" }, h("span", null, "峰值 " + compact(rawMax)), h("span", null, "单位：tokens")),
        h(
          "div",
          { className: "tm-month-body" },
          h(
            "div",
            { className: "tm-month-y", "aria-hidden": true },
            ticks.map((f) => h("span", { key: f }, compact(max * f))),
          ),
          h(
            "div",
            { className: "tm-month-area" },
            h(
              "div",
              { className: "tm-month-grid", "aria-hidden": true },
              [0, 25, 50, 75, 100].map((percent) => h("i", { key: percent, style: { top: percent + "%" } })),
            ),
            h(
              "div",
              { className: "tm-month-bars" },
          items.map((item) => {
            const total = item.day ? item.day.total : 0;
            const height = total ? Math.max(2, Math.round((total / max) * 150)) : 0;
            const segs = item.day ? item.day.models : [];
            const tip = {
              title: item.key + " " + weekdayName(item.key),
              rows: segs.map((s) => ({ color: colors.get(s.key), label: modelName(models, s.key), value: fmt(s.total) })),
              footer: total ? "合计 " + fmt(total) + " tokens · " + fmt(item.day.calls) + " 次调用" : "无用量",
            };
            return h(
              "div",
              {
                className: "tm-month-col",
                key: item.key,
                "aria-label": tip.title,
                onMouseEnter: (e) => tipStore.show(tip, e.clientX, e.clientY),
                onMouseLeave: () => tipStore.hide(),
              },
              h(
                "div",
                { className: "tm-month-plot" },
                h(
                  "div",
                  { className: "tm-month-bar", style: { height: height + "px" } },
                  segs.map((s) =>
                    h("i", {
                      key: s.key,
                      style: { height: total ? (s.total / total) * 100 + "%" : "0%", background: colors.get(s.key) },
                    }),
                  ),
                ),
              ),
              h("div", { className: "tm-month-x" }, item.dayNo),
            );
          }),
            ),
          ),
        ),
      );
    }

    function buildHeatmap(dayMap) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const year = now.getFullYear();
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      const gridStart = new Date(start);
      gridStart.setDate(gridStart.getDate() - gridStart.getDay());
      const weeks = [];
      const monthLabels = [];
      let lastMonth = "";
      const cursor = new Date(gridStart);
      while (cursor <= end) {
        const column = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(cursor);
          const key = dk(date);
          column.push({ key, inRange: date >= start && date <= end, future: date > now, day: dayMap.get(key) || null });
          cursor.setDate(cursor.getDate() + 1);
        }
        let label = "";
        for (const cell of column) {
          if (!cell.inRange) continue;
          const m = cell.key.slice(0, 7);
          if (m !== lastMonth) {
            label = MONTHS[Number(cell.key.slice(5, 7)) - 1];
            lastMonth = m;
            break;
          }
        }
        monthLabels.push(label);
        weeks.push(column);
      }
      let max = 1;
      for (const week of weeks) {
        for (const cell of week) {
          if (cell.day && cell.day.total > max) max = cell.day.total;
        }
      }
      return { weeks, monthLabels, max, year };
    }

    function Heatmap(props) {
      const { dayMap, colors, models } = props;
      const built = useMemo(() => buildHeatmap(dayMap), [dayMap]);
      const weekdays = ["", "一", "", "三", "", "五", ""];
      return h(
        "div",
        { className: "tm-heat-wrap" },
        h(
          "div",
          { className: "tm-heat-weekdays" },
          weekdays.map((w, i) => h("span", { className: "tm-heat-weekday", key: i }, w)),
        ),
        h(
          "div",
          { className: "tm-heat-main" },
          h(
            "div",
            { className: "tm-heat-months", style: { gap: "2px" } },
            built.monthLabels.map((label, i) =>
              h("span", { className: "tm-heat-month", key: i }, label),
            ),
          ),
          h(
            "div",
            { className: "tm-heat-grid" },
            built.weeks.map((week, wi) =>
              h(
                "div",
                { className: "tm-heat-col", key: wi },
                week.map((cell) => {
                  const total = cell.day ? cell.day.total : 0;
                  const segs = cell.day ? cell.day.models : [];
                  const tip = {
                    title: cell.key + " " + weekdayName(cell.key),
                    rows: cell.future
                      ? []
                      : segs.map((s) => ({ color: colors.get(s.key), label: modelName(models, s.key), value: fmt(s.total) })),
                    empty: cell.future ? "未来日期，暂无用量" : "无用量",
                    footer: cell.future
                      ? "尚未到来"
                      : cell.day
                        ? "合计 " + fmt(total) + " tokens · " + fmt(cell.day.calls) + " 次调用"
                        : "无用量",
                  };
                  return h(
                    "div",
                    {
                      className: "tm-heat-cell" + (cell.inRange ? "" : " tm-heat-out") + (cell.future ? " tm-heat-future" : ""),
                      key: cell.key,
                      "aria-label": tip.title,
                      onMouseEnter: cell.inRange ? (e) => tipStore.show(tip, e.clientX, e.clientY) : undefined,
                      onMouseLeave: cell.inRange ? () => tipStore.hide() : undefined,
                    },
                    cell.inRange && !cell.future && total
                      ? h("i", {
                          className: "tm-heat-fill",
                          style: {
                            background:
                              "color-mix(in srgb, " + HEAT_BLUE + " " +
                              Math.max(1, Math.ceil(Math.sqrt(total / built.max) * 4)) * 25 +
                              "%, var(--dsw-alias-bg-layer-2))",
                          },
                        })
                      : null,
                  );
                }),
              ),
            ),
          ),
        ),
      );
    }

    function WorkspaceSection(props) {
      const { data, colors } = props;
      const [closed, setClosed] = useState(() => new Set());
      const [openSessions, setOpenSessions] = useState(() => new Set());
      const byId = new Map(data.sessions.map((s) => [s.id, s]));
      if (!data.workspaces.length) return h("div", { className: "tm-empty" }, "暂无工作区数据");

      const toggleWs = (id) => {
        const next = new Set(closed);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setClosed(next);
      };
      const toggleSession = (id) => {
        const next = new Set(openSessions);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setOpenSessions(next);
      };
      const allClosed = data.workspaces.every((w) => closed.has(w.id));
      const toggleAll = () => setClosed(allClosed ? new Set() : new Set(data.workspaces.map((w) => w.id)));

      return h(
        "div",
        null,
        h(
          "div",
          { className: "tm-ws-toolbar" },
          h("span", { className: "tm-card-note" }, "按工作区收起；展开会话查看模型明细"),
          h("button", { className: "tm-btn tm-btn-sm", onClick: toggleAll }, allClosed ? "展开全部" : "收起全部"),
        ),
        data.workspaces.map((ws) => {
          const sessions = ws.sessionIds.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => b.total - a.total);
          const isClosed = closed.has(ws.id);
          const modelTotals = {};
          for (const s of sessions) for (const m of s.models) modelTotals[m.key] = (modelTotals[m.key] || 0) + m.total;
          return h(
            "div",
            { className: "tm-ws", key: ws.id },
            h(
              "button",
              {
                className: "tm-ws-toggle",
                onClick: () => toggleWs(ws.id),
                "aria-expanded": !isClosed,
                title: isClosed ? "展开该工作区" : "收起该工作区",
              },
              h("span", { className: "tm-chev" + (isClosed ? "" : " open") }, h(Icon, { name: "chevron", size: 12 })),
              h(
                "span",
                { className: "tm-ws-title" },
                h("span", { className: "tm-ws-name" }, ws.name),
                ws.path ? h("span", { className: "tm-ws-path" }, ws.path) : null,
              ),
              h("span", { className: "tm-ws-meta" }, sessions.length + " 会话 · " + fmt(ws.calls) + " 次调用 · " + fmt(ws.total) + " tokens"),
            ),
            h(
              "div",
              { className: "tm-ws-models" },
              Object.entries(modelTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([key, total]) =>
                  h(
                    "span",
                    { className: "tm-tag", key: key },
                    h("i", { className: "tm-dot", style: { background: colors.get(key) } }),
                    modelName(data.models, key) + " " + pct(total, ws.total),
                  ),
                ),
            ),
            isClosed
              ? null
              : h(
                  "table",
                  { className: "tm-table" },
                  h("thead", null, h("tr", null, h("th", null, "会话"), h("th", null, "调用"), h("th", null, "Tokens"), h("th", null, "占比"))),
                  h(
                    "tbody",
                    null,
                    sessions.map((s) => {
                      const expanded = openSessions.has(s.id);
                      const row = h(
                        "tr",
                        { key: s.id },
                        h(
                          "td",
                          null,
                          h(
                            "div",
                            { className: "tm-session-line" },
                            h(
                              "button",
                              {
                                className: "tm-expand" + (expanded ? " open" : ""),
                                onClick: () => toggleSession(s.id),
                                "aria-expanded": expanded,
                                "aria-label": expanded ? "收起模型明细" : "展开模型明细",
                                title: expanded ? "收起模型明细" : "展开模型明细",
                              },
                              h(Icon, { name: "chevron", size: 11 }),
                            ),
                            h(
                              "button",
                              {
                                className: "tm-session-link",
                                onClick: () => modalStore.open(s.id, s.title),
                              },
                              s.title,
                            ),
                            h("span", { className: "tm-session-time" }, sessionTimeRange(s)),
                          ),
                          h(
                            "div",
                            { className: "tm-session-meta" },
                            s.models.map((m) =>
                              h(
                                "span",
                                { className: "tm-tag", key: m.key },
                                h("i", { className: "tm-dot", style: { background: colors.get(m.key) } }),
                                modelName(data.models, m.key) + " " + pct(m.total, s.total),
                              ),
                            ),
                            s.live ? h("span", { className: "tm-tag tm-tag-live" }, "进行中") : null,
                          ),
                        ),
                        h("td", null, fmt(s.calls)),
                        h("td", null, fmt(s.total)),
                        h("td", null, pct(s.total, data.totals.total)),
                      );
                      const detail = expanded
                        ? h(
                            "tr",
                            { className: "tm-subrow", key: s.id + "-detail" },
                            h(
                              "td",
                              { colSpan: 4 },
                              h(
                                "table",
                                { className: "tm-subtable" },
                                h(
                                  "thead",
                                  null,
                                  h("tr", null, h("th", null, "模型"), h("th", null, "调用"), h("th", null, "Tokens"), h("th", null, "会话内占比")),
                                ),
                                h(
                                  "tbody",
                                  null,
                                  s.models.map((m) =>
                                    h(
                                      "tr",
                                      { key: m.key },
                                      h(
                                        "td",
                                        null,
                                        h("i", { className: "tm-dot", style: { background: colors.get(m.key) } }),
                                        modelName(data.models, m.key),
                                      ),
                                      h("td", null, fmt(m.calls)),
                                      h("td", null, fmt(m.total)),
                                      h("td", null, pct(m.total, s.total)),
                                    ),
                                  ),
                                ),
                              ),
                              h(
                                "div",
                                { className: "tm-subrow-foot" },
                                h("span", null, "输入 " + fmt(s.input) + " · 缓存 " + fmt(s.cacheRead) + " · 输出 " + fmt(s.output)),
                                h("button", { className: "tm-btn tm-btn-sm", onClick: () => modalStore.open(s.id, s.title) }, "查看每轮"),
                              ),
                            ),
                          )
                        : null;
                      return [row, detail];
                    }),
                  ),
                ),
          );
        }),
      );
    }

    function Page() {
      const [data, setData] = useState(null);
      const [error, setError] = useState("");
      const [reload, setReload] = useState(0);

      useEffect(() => {
        let alive = true;
        let timer = null;
        async function load() {
          try {
            const value = await callRemote("getOverview");
            if (alive) {
              setData(value);
              setError("");
            }
          } catch (e) {
            if (alive) setError(String((e && e.message) || e));
          }
          if (alive) timer = setTimeout(load, 30000);
        }
        load();
        return () => {
          alive = false;
          if (timer) clearTimeout(timer);
        };
      }, [reload]);

      if (!data) {
        return h("div", { className: "tm-page" }, error ? h("div", { className: "tm-error" }, error) : h("div", { className: "tm-loading" }, "正在读取会话日志…"));
      }

      const colors = colorMapOf(data.models);
      const dayMap = new Map(data.days.map((d) => [d.date, d]));
      const today = new Date();
      const todayKey = dk(today);
      const monthPrefix = todayKey.slice(0, 7);
      const yearPrefix = todayKey.slice(0, 4);
      let monthTotal = 0;
      let yearTotal = 0;
      for (const d of data.days) {
        if (d.date.slice(0, 7) === monthPrefix) monthTotal += d.total;
        if (d.date.slice(0, 4) === yearPrefix) yearTotal += d.total;
      }
      const todayTotal = dayMap.get(todayKey) ? dayMap.get(todayKey).total : 0;
      const todayCalls = dayMap.get(todayKey) ? dayMap.get(todayKey).calls : 0;
      const modelTotals = {};
      for (const m of data.models) modelTotals[m.key] = m.total;

      const monthDays = data.days.filter((d) => d.date.slice(0, 7) === monthPrefix);
      const yearDays = data.days.filter((d) => d.date.slice(0, 4) === yearPrefix);
      const todayDay = dayMap.get(todayKey) || null;
      const monthLast = pad2(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate());
      const aggRows = (days) => {
        const map = new Map();
        for (const d of days) for (const m of d.models) map.set(m.key, (map.get(m.key) || 0) + m.total);
        return [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([key, value]) => ({ color: colors.get(key), label: modelName(data.models, key), value: fmt(value) }));
      };
      const dayRows = (day) =>
        day ? day.models.map((m) => ({ color: colors.get(m.key), label: modelName(data.models, m.key), value: fmt(m.total) })) : [];

      const kpis = [
        {
          label: "本月用量",
          value: compact(monthTotal),
          foot: fmt(monthTotal) + " tokens",
          icon: "calendar",
          tip: {
            title: "本月 · " + monthPrefix + "-01 ~ " + monthPrefix + "-" + monthLast,
            rows: aggRows(monthDays),
            footer: "合计 " + fmt(monthTotal) + " tokens",
          },
        },
        {
          label: "今日用量",
          value: compact(todayTotal),
          foot: fmt(todayCalls) + " 次调用",
          icon: "clock",
          tip: {
            title: todayKey + " " + weekdayName(todayKey),
            rows: dayRows(todayDay),
            footer: fmt(todayCalls) + " 次调用 · 合计 " + fmt(todayTotal) + " tokens",
          },
        },
        {
          label: "本年",
          value: compact(yearTotal),
          foot: fmt(yearTotal) + " tokens",
          icon: "year",
          tip: {
            title: yearPrefix + " 年 · " + yearPrefix + "-01-01 ~ " + yearPrefix + "-12-31",
            rows: aggRows(yearDays),
            footer: "合计 " + fmt(yearTotal) + " tokens",
          },
        },
        {
          label: "累计会话",
          value: String(data.totals.sessions),
          foot: data.models.length + " 个模型 · " + fmt(data.totals.calls) + " 次调用",
          icon: "sessions",
          tip: {
            title: "全部会话 · 按模型",
            rows: data.models.map((m) => ({ color: colors.get(m.key), label: m.model, value: fmt(m.total) })),
            footer: data.totals.sessions + " 个会话 · " + fmt(data.totals.calls) + " 次调用",
          },
        },
      ];

      return h(
        "div",
        { className: "tm-page-scroll" },
        h(
          "div",
          { className: "tm-page" },
          h(
            "div",
            { className: "tm-head" },
          h(
            "div",
            null,
            h("h1", { className: "tm-title" }, "Token 用量"),
            h(
              "div",
              { className: "tm-sub" },
              data.ready ? "数据截至 " + timeStr(data.generatedAt) + " · 按 provider::model 统计" : "正在扫描会话日志 " + data.progress.done + "/" + data.progress.total,
            ),
          ),
          h(
            "div",
            { className: "tm-head-right" },
            data.ready ? null : h("div", { className: "tm-card-note" }, data.progress.done + "/" + data.progress.total),
            h("button", { className: "tm-btn", onClick: () => setReload((x) => x + 1) }, "刷新"),
          ),
        ),
        error ? h("div", { className: "tm-error" }, error) : null,
        !data.ready
          ? h(
              "div",
              { className: "tm-card" },
              h("div", { className: "tm-loading" }, "正在汇总历史会话…"),
              h("div", { className: "tm-progress" }, h("i", { style: { width: Math.max(4, (data.progress.done / Math.max(1, data.progress.total)) * 100) + "%" } })),
            )
          : null,
        h(
          "div",
          { className: "tm-kpis" },
          kpis.map((k) =>
            h(
              "div",
              {
                className: "tm-kpi",
                key: k.label,
                onMouseEnter: (e) => tipStore.show(k.tip, e.clientX, e.clientY),
                onMouseLeave: () => tipStore.hide(),
              },
              h("span", { className: "tm-kpi-icon" }, h(Icon, { name: k.icon })),
              h("div", { className: "tm-kpi-label" }, k.label),
              h("div", { className: "tm-kpi-value" }, k.value),
              h("div", { className: "tm-kpi-foot" }, k.foot),
            ),
          ),
        ),
        h(
          "div",
          { className: "tm-card" },
          h(
            "div",
            { className: "tm-card-head" },
            h("h2", { className: "tm-card-title" }, h(Icon, { name: "chart" }), "本月每日用量"),
            h("div", { className: "tm-legend" }, h(Legend, { models: data.models, colors, totals: modelTotals })),
          ),
          h(MonthChart, { dayMap, colors, models: data.models }),
          h("div", { className: "tm-note" }, "按本地日历日汇总；柱内按模型堆叠，悬停可查看当日各模型用量。"),
        ),
        h(
          "div",
          { className: "tm-card" },
          h(
            "div",
            { className: "tm-card-head" },
            h("h2", { className: "tm-card-title" }, h(Icon, { name: "calendar" }), "本年度每日活跃"),
            h(HeatLegend),
          ),
          h(Heatmap, { dayMap, colors, models: data.models }),
          h("div", { className: "tm-note" }, "颜色深浅表示当日 Token 总量；悬停查看该日各模型细分用量。"),
        ),
        h(
          "div",
          { className: "tm-card" },
          h(
            "div",
            { className: "tm-card-head" },
            h("h2", { className: "tm-card-title" }, h(Icon, { name: "workspace" }), "工作区用量"),
            h("div", { className: "tm-card-note" }, "点击会话标题查看每轮用量与产物"),
          ),
          h(WorkspaceSection, { data, colors }),
        ),
        h(
          "div",
          { className: "tm-note" },
          "口径：total = 未缓存输入 + 输出 + 缓存读取 + 缓存写入；数据直接来自 DSH 会话日志的 assistant/message.usage，不包含标题生成等内部辅助调用。",
        ),
          ),
        );
    }

    function SessionChip(props) {
      const sessionId = props && props.sessionId;
      const [summary, setSummary] = useState(null);
      useEffect(() => {
        if (!sessionId) return;
        let alive = true;
        let timer = null;
        async function load() {
          try {
            const value = await callRemote("getSessionTurns", sessionId);
            if (alive && value && value.session) setSummary(value.session);
          } catch (e) {
            /* 采集未完成时保持占位 */
          }
          if (alive) timer = setTimeout(load, 5000);
        }
        load();
        return () => {
          alive = false;
          if (timer) clearTimeout(timer);
        };
      }, [sessionId]);

      if (!sessionId) return null;
      const total = summary ? summary.total : 0;
      const title = summary
        ? "本会话 " + fmt(total) + " tokens · " + fmt(summary.calls) + " 次调用 · " + (summary.turnCount || 0) + " 轮"
        : "正在采集本会话用量";
      return h(
        "button",
        {
          className: "tm-chip",
          onClick: () => modalStore.open(sessionId, summary ? summary.title : ""),
          title,
          "aria-label": "查看本会话 Token 用量",
        },
        h(
          "svg",
          { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", "aria-hidden": true },
          h("path", { d: "M4 20V11", key: "a" }),
          h("path", { d: "M10 20V5", key: "b" }),
          h("path", { d: "M16 20v-6", key: "c" }),
        ),
        h("b", null, total ? compact(total) : "—"),
        summary && summary.turnCount ? h("span", { className: "tm-chip-extra" }, summary.turnCount + " 轮") : null,
      );
    }

    function TurnList(props) {
      const { detail, colors } = props;
      if (!detail.turns.length) return h("div", { className: "tm-empty" }, "本会话还没有已完成的模型调用");
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "10px" } },
        detail.turns.map((t) =>
          h(
            "div",
            { className: "tm-turn", key: t.turn },
            h(
              "div",
              { className: "tm-turn-head" },
              h("span", { className: "tm-turn-no" }, "第 " + t.turn + " 轮"),
              h("span", { className: "tm-turn-time" }, timeStr(t.startTime || t.endTime) + (t.endTime ? " → " + timeStr(t.endTime) : " · 进行中")),
              t.reason && t.reason !== "completed" ? h("span", { className: "tm-tag" }, t.reason) : null,
              h("span", { className: "tm-turn-total" }, fmt(t.total) + " tokens"),
            ),
            t.prompt ? h("div", { className: "tm-turn-prompt" }, t.prompt) : null,
            t.reply ? h("div", { className: "tm-turn-reply" }, "输出：" + t.reply) : null,
            h(
              "div",
              { className: "tm-turn-meta" },
              h("span", null, fmt(t.calls) + " 次调用"),
              h("span", null, "输入 " + fmt(t.input) + " · 缓存 " + fmt(t.cacheRead) + " · 输出 " + fmt(t.output)),
              t.models.map((m) =>
                h(
                  "span",
                  { className: "tm-tag", key: m.key },
                  h("i", { className: "tm-dot", style: { background: colors.get(m.key) } }),
                  modelName(detail.models, m.key) + " " + fmt(m.total),
                ),
              ),
            ),
            t.artifacts && t.artifacts.length
              ? h(
                  "div",
                  { className: "tm-artifacts" },
                  t.artifacts.map((a) =>
                    h(
                      "span",
                      { className: "tm-artifact", key: a.path, title: a.description ? a.description + "\n" + a.path : a.path },
                      h("b", null, a.name),
                      a.description ? h("span", { className: "tm-artifact-title" }, a.description) : null,
                    ),
                  ),
                )
              : null,
          ),
        ),
      );
    }

    function SessionModal() {
      const [open, setOpen] = useState(modalStore.get());
      const [detail, setDetail] = useState(null);
      const [error, setError] = useState("");

      useEffect(() => modalStore.subscribe(setOpen), []);
      useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
          if (e.key === "Escape") modalStore.close();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
      }, [open]);

      useEffect(() => {
        if (!open) {
          setDetail(null);
          setError("");
          return;
        }
        let alive = true;
        let timer = null;
        async function load() {
          try {
            const value = await callRemote("getSessionTurns", open.sessionId);
            if (alive) {
              setDetail({ ...value, models: (value.session && value.session.models) || [], turns: value.turns || [], session: value.session });
              setError("");
            }
          } catch (e) {
            if (alive) setError(String((e && e.message) || e));
          }
          if (alive) timer = setTimeout(load, 4000);
        }
        load();
        return () => {
          alive = false;
          if (timer) clearTimeout(timer);
        };
      }, [open]);

      if (!open) return null;
      const colors = detail ? colorMapOf(detail.models) : new Map();
      const session = detail ? detail.session : null;
      const totals = session || { total: 0, calls: 0, turnCount: 0 };
      return h(
        "div",
        {
          className: "tm-backdrop",
          onMouseDown: (e) => {
            if (e.target === e.currentTarget) modalStore.close();
          },
        },
        h(
          "div",
          { className: "tm-modal", role: "dialog", "aria-modal": "true", "aria-label": "本会话 Token 用量" },
          h(
            "div",
            { className: "tm-modal-head" },
            h(
              "div",
              null,
              h("h2", { className: "tm-modal-title" }, open.title || (session && session.title) || "本会话用量"),
              h("div", { className: "tm-modal-sub" }, (session && session.workspace ? session.workspace + " · " : "") + (session && session.id ? session.id : open.sessionId)),
            ),
            h(
              "button",
              { className: "tm-modal-close", onClick: () => modalStore.close(), "aria-label": "关闭" },
              "✕",
            ),
          ),
          h(
            "div",
            { className: "tm-modal-body" },
            error ? h("div", { className: "tm-error" }, error) : null,
            h(
              "div",
              { className: "tm-sum" },
              h("div", { className: "tm-sum-item", key: "t" }, h("div", { className: "tm-sum-label" }, "会话合计"), h("div", { className: "tm-sum-value" }, fmt(totals.total))),
              h("div", { className: "tm-sum-item", key: "c" }, h("div", { className: "tm-sum-label" }, "模型调用"), h("div", { className: "tm-sum-value" }, fmt(totals.calls))),
              h("div", { className: "tm-sum-item", key: "r" }, h("div", { className: "tm-sum-label" }, "轮次"), h("div", { className: "tm-sum-value" }, fmt(totals.turnCount || 0))),
              h(
                "div",
                { className: "tm-sum-item", key: "m" },
                h("div", { className: "tm-sum-label" }, "模型构成"),
                h(
                  "div",
                  { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" } },
                  (session && session.models ? session.models : []).map((m) =>
                    h(
                      "span",
                      { className: "tm-tag", key: m.key },
                      h("i", { className: "tm-dot", style: { background: colors.get(m.key) } }),
                      modelName(detail.models, m.key) + " " + pct(m.total, totals.total),
                    ),
                  ),
                ),
              ),
            ),
            detail ? h(TurnList, { detail: { ...detail, models: (session && session.models) || detail.models }, colors }) : h("div", { className: "tm-loading" }, "正在读取本会话轮次…"),
            h(
              "div",
              { className: "tm-note" },
              "每轮统计从用户输入（turn/start）到最后一次模型输出（turn/end）的全部调用；「产物」来自 present 工具提交的交付文件。",
            ),
          ),
        ),
      );
    }

    function SessionUsageView(props) {
      const sessionId = props && props.sessionId;
      const [detail, setDetail] = useState(null);
      const [error, setError] = useState("");
      const [nonce, setNonce] = useState(0);

      useEffect(() => {
        if (!sessionId) return;
        let alive = true;
        let timer = null;
        async function load() {
          try {
            const value = await callRemote("getSessionTurns", sessionId);
            if (!alive) return;
            setDetail({
              ...value,
              models: (value.session && value.session.models) || [],
              turns: value.turns || [],
            });
            setError("");
          } catch (e) {
            if (alive) setError(String((e && e.message) || e));
          }
          if (alive) timer = setTimeout(load, 5000);
        }
        load();
        return () => {
          alive = false;
          if (timer) clearTimeout(timer);
        };
      }, [sessionId, nonce]);

      if (!sessionId) {
        return h("div", { className: "tm-view" }, h("div", { className: "tm-empty" }, "打开一个会话后查看 Token 用量"));
      }

      const session = detail ? detail.session : null;
      const totals = session || { total: 0, calls: 0, turnCount: 0, models: [] };
      const colors = detail ? colorMapOf(detail.models) : new Map();
      const summaryTip = session
        ? {
            title: session.title || "本会话",
            subtitle: (session.firstAt ? timeStr(session.firstAt) + " ~ " + timeStr(session.lastAt) : "") + (session.workspace ? " · " + session.workspace : ""),
            rows: (session.models || []).map((m) => ({
              color: colors.get(m.key),
              label: modelName(detail.models, m.key),
              value: fmt(m.total),
            })),
            footer: fmt(session.calls) + " 次调用 · " + (session.turnCount || 0) + " 轮 · 合计 " + fmt(session.total) + " tokens",
          }
        : null;

      return h(
        "div",
        { className: "tm-view" },
        h(
          "div",
          { className: "tm-view-head" },
          h(
            "div",
            null,
            h("h2", { className: "tm-view-title" }, "Token 用量"),
            h("div", { className: "tm-sub" }, "本会话每轮用量与产物 · 每 5 秒自动刷新"),
          ),
          h("button", { className: "tm-btn", onClick: () => setNonce((x) => x + 1) }, "刷新"),
        ),
        error ? h("div", { className: "tm-error" }, error) : null,
        h(
          "div",
          {
            className: "tm-sum",
            onMouseEnter: summaryTip ? (e) => tipStore.show(summaryTip, e.clientX, e.clientY) : undefined,
            onMouseLeave: () => tipStore.hide(),
          },
          h("div", { className: "tm-sum-item", key: "t" }, h("div", { className: "tm-sum-label" }, "本会话合计"), h("div", { className: "tm-sum-value" }, fmt(totals.total))),
          h("div", { className: "tm-sum-item", key: "c" }, h("div", { className: "tm-sum-label" }, "模型调用"), h("div", { className: "tm-sum-value" }, fmt(totals.calls))),
          h("div", { className: "tm-sum-item", key: "r" }, h("div", { className: "tm-sum-label" }, "轮次"), h("div", { className: "tm-sum-value" }, fmt(totals.turnCount || 0))),
          h(
            "div",
            { className: "tm-sum-item", key: "m" },
            h("div", { className: "tm-sum-label" }, "模型构成"),
            h(
              "div",
              { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" } },
              (session && session.models ? session.models : []).map((m) =>
                h(
                  "span",
                  { className: "tm-tag", key: m.key },
                  h("i", { className: "tm-dot", style: { background: colors.get(m.key) } }),
                  modelName(detail.models, m.key) + " " + pct(m.total, totals.total),
                ),
              ),
            ),
          ),
        ),
        h(
          "div",
          { className: "tm-card" },
          h(
            "div",
            { className: "tm-card-head" },
            h("h3", { className: "tm-card-title" }, "每轮用量与产物"),
            h("div", { className: "tm-card-note" }, "从用户输入到最后一次模型输出为一轮；产物来自 present 交付文件"),
          ),
          detail ? h(TurnList, { detail, colors }) : h("div", { className: "tm-loading" }, "正在读取本会话轮次…"),
        ),
        h(
          "div",
          { className: "tm-note" },
          "口径：total = 未缓存输入 + 输出 + 缓存读取 + 缓存写入；数据直接来自会话日志的 assistant/message.usage。",
        ),
      );
    }

    function TipLayer() {
      const [tip, setTip] = useState(tipStore.get());
      useEffect(() => tipStore.subscribe(setTip), []);
      if (!tip) return null;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const left = Math.max(8, Math.min(tip.x + 14, vw - 320));
      const top = Math.max(8, Math.min(tip.y + 16, vh - 240));
      const rows = tip.rows || [];
      return h(
        "div",
        { className: "tm-tip", style: { left: left + "px", top: top + "px" } },
        h("div", { className: "tm-tip-title" }, tip.title),
        tip.subtitle ? h("div", { className: "tm-tip-sub" }, tip.subtitle) : null,
        rows.length
          ? rows.map((r, i) =>
              h(
                "div",
                { className: "tm-tip-row", key: i },
                h("i", { className: "tm-dot", style: { background: r.color || "#8b93a7" } }),
                h("span", null, r.label),
                h("b", null, r.value),
              ),
            )
          : h("div", { className: "tm-tip-empty" }, tip.empty || "暂无用量"),
        tip.footer ? h("div", { className: "tm-tip-foot" }, tip.footer) : null,
      );
    }

    // ------------------------------------------------------------ remote
    let remote = null;

    function unwrapRemote(res) {
      const value = res && typeof res === "object" && "value" in res ? res.value : res;
      if (value && typeof value === "object" && value.ok === false) {
        throw new Error((value.error && (value.error.message || value.error.code)) || "统计服务返回失败");
      }
      if (value && typeof value === "object" && value.ok === true && "value" in value) return value.value;
      return value;
    }

    async function callRemote(method, ...args) {
      if (!remote) throw new Error("统计服务尚未连接");
      const fn = remote[method];
      if (typeof fn !== "function") throw new Error("统计服务缺少方法 " + method);
      return unwrapRemote(await fn(...args));
    }

    async function apply(ctx) {
      try {
        await applyInner(ctx);
      } catch (e) {
        // eslint-disable-next-line no-console
        if (typeof console !== "undefined" && console.error) console.error("[dsh-token-meter] client apply failed:", e);
      }
    }

    async function applyInner(ctx) {
      try {
        // 不阻塞 UI 注册：Remote 命名空间挂载完成后再让组件开始取数。
        Promise.resolve(ctx.remote.$mount(CLIENT_REMOTE))
          .then(() => {
            remote = ctx.get("remote.tokenUsage") || null;
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            if (typeof console !== "undefined" && console.warn) console.warn("[dsh-token-insight] remote.$mount failed:", e);
          });
      } catch (e) {
        // eslint-disable-next-line no-console
        if (typeof console !== "undefined" && console.warn) console.warn("[dsh-token-insight] remote.$mount threw:", e);
      }

      try {
        const style = document.createElement("style");
        style.textContent = CSS;
        style.setAttribute("data-plugin", CLIENT_BUNDLE_ID);
        document.head.appendChild(style);
        ctx.effect(() => () => style.remove());
      } catch (e) {
        /* cosmetic */
      }

      try {
        ctx.slots.inject("sidebar.panellist", () =>
          ctx.slots.register({ name: "sidebar.panellist", id: "token-meter", order: 5, label: () => "Token 用量" }, PanelIcon),
        );
      } catch (e) {
        /* keep other entries */
      }

      try {
        ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: "token-meter" }, Page));
      } catch (e) {
        /* keep other entries */
      }

      try {
        ctx.slots.inject("shell.overlay", () =>
          ctx.slots.register({ name: "shell.overlay", id: "token-meter-modal", order: 100 }, SessionModal),
        );
      } catch (e) {
        /* keep other entries */
      }

      try {
        ctx.slots.inject("shell.overlay", () =>
          ctx.slots.register({ name: "shell.overlay", id: "token-meter-tip", order: 90 }, TipLayer),
        );
      } catch (e) {
        /* keep other entries */
      }

      try {
        ctx.slots.inject("conversation.input.right", () =>
          ctx.slots.register(
            { name: "conversation.input.right", id: "token-meter-session", order: 5, label: "当前会话用量" },
            (props) => h(SessionChip, { sessionId: props && props.sessionId }),
          ),
        );
      } catch (e) {
        /* keep other entries */
      }

      try {
        ctx.slots.inject("conversation.view", () =>
          ctx.slots.register(
            { name: "conversation.view", id: "token-usage", order: 20, label: () => "Token 用量" },
            (props) => h(SessionUsageView, { sessionId: props && props.sessionId }),
          ),
        );
      } catch (e) {
        /* keep other entries */
      }
    }

    return { inject: ["slots", "remote"], apply };
  },
});
