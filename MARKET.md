# 插件市场提交文案

目标仓库：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>

市场目录（Discover 数据源）：<https://awesome-dsh-plugin.com/plugins.json>

## 建议条目

```markdown
- [dsh-token-insight](https://github.com/luqingjie/dsh-token-insight) — DeepSeek Harness 的 Token 用量洞察：本月每日按模型堆叠图、全年日历热力图、会话顶部用量 tab、每轮 token 与交付产物、工作区/会话明细。`npm i dsh-token-insight`
```

英文版：

```markdown
- [dsh-token-insight](https://github.com/luqingjie/dsh-token-insight) — Token usage insights for DeepSeek Harness: monthly per-model chart, yearly heatmap, per-session tab, per-turn usage with deliverables, and workspace breakdowns.
```

## 提交前确认

- [ ] GitHub Release `v1.0.0` 的 tgz 可以直接安装
- [ ] npm 包 `dsh-token-insight@1.0.0` 已发布（或明确只走 Release）
- [ ] README 有安装命令、截图、隐私说明
- [ ] `locale/zh.json` 与 `locale/en.json` 的 `meta.title` / `meta.description` 已就绪
- [ ] 仓库公开、Issue 开启

## 安装来源

市场收录后，用户可：

```bash
dsh plugin --profile desktop add dsh-token-insight
```

或在 **插件 → Discover** 搜索 `dsh-token-insight`。

未收录前，用 Release URL 安装：

```bash
dsh plugin --profile desktop add \
  https://github.com/luqingjie/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz
```
