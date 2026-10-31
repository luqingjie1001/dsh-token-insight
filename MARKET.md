# 插件市场提交资料

目标仓库：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>

官方投稿规范：<https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md>

Discover 索引源：`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`

## 投稿方式：一个 YAML 文件

市场已改为「一个插件一个文件」：README 由 `data/plugins/*.yml` 自动生成，**不要再手工编辑 README**，也不要复制成一段 markdown 列表。

PR 只新增一个文件：

```text
data/plugins/luqingjie1001__dsh-token-insight.yml
```

本仓库已备好同内容的文件：[market/luqingjie1001__dsh-token-insight.yml](market/luqingjie1001__dsh-token-insight.yml)，提交时复制到上面这个路径即可。

```yaml
url: https://github.com/luqingjie1001/dsh-token-insight
name: luqingjie1001/dsh-token-insight
category: usage
description:
  en: 'Token usage insights for DeepSeek Harness: per-model monthly stacked chart, yearly calendar heatmap, per-session tab, per-turn usage with deliverables, and workspace/session breakdowns.'
  zh: 'DeepSeek Harness 的 Token 用量洞察：按模型的月度堆叠图、全年日历热力图、会话顶部用量标签页、逐轮用量与交付产物、工作区和会话明细。'
tarball: https://github.com/luqingjie1001/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz
```

### 字段说明

| 字段 | 取值 | 说明 |
|---|---|---|
| `url` | `https://github.com/luqingjie1001/dsh-token-insight` | 必须与仓库地址完全一致 |
| `name` | `luqingjie1001/dsh-token-insight` | 列表里显示的链接文字 |
| `category` | `usage` | 插件做的是用量统计，属于 Usage & Billing |
| `description.en` | 见上 | 必填，一句话、以句号结尾；含 `: ` 必须加引号 |
| `description.zh` | 见上 | 可选，维护者也会补 |
| `tarball` | Release 里的 tgz | 可选；仓库能直接源码安装时可不填，但填了市场会优先给预构建包 |

注意事项：

- **图标**：`icon` 必须是 GitHub 托管的**位图**（PNG/JPEG）。本项目的 `icon.svg` 不符合，因此文件中不写 `icon`，市场会回退到作者头像。
- **tarball 不要用 `latest/download/` 配带版本号的文件名**：那会在下一次发版后 404。这里钉死 `v1.0.0`，文件名可以带版本。
- **一个 PR 最多 3 条**，且只动自己的条目。
- `tarball` 链接要等 GitHub Release `v1.0.0` 建好后才会返回 200，先完成 [PUBLISHING.md](PUBLISHING.md) 的第 1 步再提 PR。

## 提交前检查

| 条件 | 现状 |
|---|---|
| `package.json` 声明 `dsh.bundle`（可被 `dsh plugin add` 安装） | ✅ [package.json](package.json#L23-L31) |
| 真实可用的代码，非占位仓库 | ✅ `index.js` / `client.js` / `typert.host.js` |
| 仓库公开、Issues 开启 | ✅ public，Issues 开启 |
| 仓库创建满 1 天（CI 自动检查） | ❌ 2026-10-31 17:51 创建，**2026-11-01 17:51 后**才能提 |
| 仓库添加 `dsh-plugin` topic | ❌ 当前 topics 为空 |
| 描述与代码一致（无夸大） | ✅ 功能与 README 一致 |
| GitHub Release `v1.0.0` 的 tgz 可下载 | ❌ 0 个 Release，链接 404 |
| npm 包已发布（Discover 索引需要） | ❌ registry 404 |
| README 有安装命令、隐私说明 | ✅ |

> 只满足「能安装」还不够：Discover 用的索引只覆盖 **npm 已发布且有版本号** 的插件。不发 npm，即使 PR 合并，Discover 里也搜不到，只能按 README 里的命令安装。

## 提 PR 步骤

1. Fork <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>。
2. 把 [market/luqingjie1001__dsh-token-insight.yml](market/luqingjie1001__dsh-token-insight.yml) 复制为 `data/plugins/luqingjie1001__dsh-token-insight.yml`。
3. 提交并开 PR，标题建议：`Add luqingjie1001/dsh-token-insight (usage)`。
4. 等 CI 绿 + 维护者按源码核对描述；反馈通常以 PR 评论指出要改哪一行。
5. 合并后网站自动重建，Discover 同步通常一天内完成。

## 收录后的安装来源

```bash
# npm（发布后）
dsh plugin --profile desktop add dsh-token-insight

# GitHub Release
dsh plugin --profile desktop add \
  https://github.com/luqingjie1001/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz
```

或在 **插件 → Discover** 搜索 `dsh-token-insight`。

> `dsh web` 用户把 `--profile desktop` 换成 `--profile web`。
