<p align="center"><img src="icon.svg" width="72" height="72" alt="dsh-token-insight"></p>

<h1 align="center">dsh-token-insight</h1>

<p align="center">DeepSeek Harness 的 Token 用量洞察插件：总览、会话视图、逐轮产物、工作区明细。</p>

> 社区插件，非 DeepSeek 官方产品。

## 功能

- **总览页**（左侧栏柱状图图标「Token 用量」）
  - 本月每日用量：按模型堆叠的柱状图，左侧 Y 轴 5 档刻度 + 网格线
  - 本年度每日活跃：天蓝色系日历热力图，颜色深浅只表示当日 Token 总量
  - KPI：本月 / 今日 / 本年 / 累计会话
  - 悬浮查看：日期、各模型用量、合计与调用次数
- **会话顶部 tab**（「对话 / 轨迹」之后）
  - 「Token 用量」会话视图：本会话合计、模型调用、轮次、模型构成
  - 每轮明细：起止时间、输入/缓存/输出、用户输入与回复摘要、`present` 交付产物
- **输入框工具行**
  - 本会话用量 chip，点击打开同一套逐轮面板
- **工作区用量**
  - 按工作区收起/展开（支持「收起全部 / 展开全部」）
  - 会话行可直接展开，查看模型调用、tokens、会话内占比与输入/缓存/输出拆分
  - 起止时间直接显示在会话标题后，无需悬浮

## 安装

### 从 GitHub Release（推荐）

```bash
dsh plugin --profile desktop add \
  https://github.com/luqingjie/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz
```

`dsh web` 用户把 `--profile desktop` 换成 `--profile web`。

### 从 npm

```bash
dsh plugin --profile desktop add dsh-token-insight
```

### 通过插件市场

在 DSH 的 **插件 → Discover** 里搜索 `dsh-token-insight`（收录后可见），或 **设置 → 插件 → 添加插件** 填上面的 URL / 包名。

## 使用

1. 左侧栏出现柱状图图标 **Token 用量**，打开是全局总览。
2. 会话窗口顶部出现 **Token 用量** tab，切过去看当前会话的逐轮用量。
3. 输入框右侧的 chip 显示本会话累计 tokens，点击打开明细。
4. 总览页的「工作区用量」可以按工作区折叠；会话标题后直接显示起止时间。

数据口径：`total = 未缓存输入 + 输出 + 缓存读取 + 缓存写入`，直接来自会话日志的 `assistant/message.usage`，按 `provider::model` 归属；空会话不计，进行中的会话是实时快照。缓存读取计入总量，成本需按模型缓存折扣另行换算。

## 数据与隐私

- 只读取本机 DSH 会话日志（`<DSH_HOME>/sessions`，通过 DSH 的 `sessionQuery` 服务）。
- **不发送任何网络请求，不收集遥测，不上传会话内容。**
- 统计数据只存在内存中，不额外落盘。
- 产物列表来自会话里的 `deliverables/presented` 事件，仅展示路径和描述。

## 兼容性

- DSH `>= 0.2.1-rc.3 < 0.3.0`。
- 升级 Host 代码后需要重启 DSH；只改 Client 时刷新页面通常即可。
- 当前版本为 Host `tokenUsage` Remote + Client 四个槽位：侧栏面板、会话视图、输入框 chip、悬浮层。

## 开发

```bash
npm run check                        # 语法检查
npm pack --pack-destination dist     # 产出 tgz
dsh plugin --profile desktop add ./dist/dsh-token-insight-1.0.0.tgz
```

> 本地目录 `link:` 安装会因包在 profile 之外而解析不到 DSH 内置包，测试请用 tgz。

项目结构：

```text
index.js          Host 采集服务（tokenUsage Remote）
typert.host.js    Typert Remote 清单
client.js         Web UI（总览页 / 会话视图 / chip / 悬浮层）
cordis.patch.yml  bundle 行
locale/           插件市场展示元数据
icon.svg
```

## License

[MIT](LICENSE) © 2026 陆庆杰

---

## English

`dsh-token-insight` is a community plugin for DeepSeek Harness that visualizes token usage:

- **Overview page** (sidebar bar-chart icon): a monthly per-model stacked chart with a Y axis, a yearly sky-blue calendar heatmap driven by total tokens, KPI cards, and per-model hover details.
- **Conversation tab**: a per-session usage view with per-turn tokens, input/cache/output split, prompt/reply previews, and delivered artifacts.
- **Composer chip**: current session usage; click for the per-turn panel.
- **Workspace breakdown**: collapsible workspaces and expandable sessions with model-level details.

Install:

```bash
dsh plugin --profile desktop add dsh-token-insight
# or the GitHub Release tarball
```

It reads local DSH session logs only; no network requests, no telemetry. MIT licensed. Not an official DeepSeek product.
