# 发布操作手册

本仓库的代码与包结构已经满足 DSH 插件发布条件（`dsh.bundle` manifest、可安装代码、peer 依赖、`npm pack` 产物、本地安装验证）。本文只记录**还没完成**的发布动作，以及以后升级时怎么做。

## 已确定的信息

| 项 | 值 |
|---|---|
| npm 包名 | `dsh-token-insight` |
| 版本 | `1.0.0` |
| GitHub | <https://github.com/luqingjie1001/dsh-token-insight> |
| 作者 | 陆庆杰 `<992768355@qq.com>` |
| License | MIT |
| 渠道 | GitHub Release + npm + 插件市场 |
| 市场分类 | `usage` |
| 市场索引源 | `https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json` |
| DSH 兼容 | `>= 0.2.1-rc.3 < 0.3.0` |

## 当前状态（2026-10-31 22:20）

| 项目 | 状态 | 说明 |
|---|---|---|
| `npm run check` | ✅ | `index.js` / `client.js` / `typert.host.js` 语法通过 |
| `npm pack` | ✅ | 11 个文件、101.7 kB，含 `cordis.patch.yml`、client、locale |
| 本地 profile 安装 | ✅ | 已装进 `~/.dsh/profiles/desktop` 并可加载 |
| GitHub 仓库公开 | ✅ | public、MIT、Issues 开启 |
| `main` 已推送 | ✅ | 本地与 `origin/main` 都是 `ec71263` |
| `v1.0.0` tag 已推送 | ✅ | 远端 `refs/tags/v1.0.0` |
| GitHub Release | ❌ | Releases 0 个；Actions 运行记录 0 次；README 的 Release 链接 404 |
| npm 发布 | ❌ | `registry.npmjs.org/dsh-token-insight` 返回 404 |
| 市场收录 | ❌ | 未提 PR；市场索引中无此插件 |
| `dsh-plugin` topic | ❌ | 仓库 topics 为空 |
| 仓库满 1 天 | ❌ | 2026-10-31 17:51 创建，`2026-11-01 17:51` 后才满足市场 CI |

## 为什么 tag 推了却没有 Release

`.github/workflows/release.yml` 只监听 `push tags: v*`，没有 `workflow_dispatch`；GitHub 也不会为「工作流文件还不存在时推送的 tag」补跑。

远端 `v1.0.0` tag 的时间是 17:55，`main` 首次推送是 18:13，Actions 运行记录为 0 —— 基本可以确定 tag 先于工作流到达 GitHub。所以现在没有 Release，README 里的 Release 安装链接是 404。

补 Release 二选一：

- **方式 A（推荐）**：直接给已存在的 `v1.0.0` 补一个 Release（版本已定稿，不用改代码）。
- **方式 B**：升版本到 `1.0.1` 再推新 tag，让 workflow 自动跑。

⚠️ 不要为了触发 workflow 删除并重推 `v1.0.0` tag。重写已推送的 tag 会破坏别人的引用；版本内容没变就用方式 A。

## 发布步骤

### 0. 补仓库元信息

- GitHub 仓库 → **Settings → Topics**，添加 `dsh-plugin`（市场硬性要求）。
- 仓库 **Description** 填一句，例如：`Token usage insights for DeepSeek Harness`。
- 确认 **Issues** 开启。

### 1. 创建 GitHub Release `v1.0.0`

`dist/` 与 `*.tgz` 都在 `.gitignore` 里，所以 tarball 只在本机有；换机器要先 `npm pack` 重新生成。

**方式 A：手动补 Release（推荐）**

网页：仓库 → **Releases → Draft a new release** → 选择 tag `v1.0.0` → 标题 `v1.0.0` → 上传 `dist/dsh-token-insight-1.0.0.tgz` → **Publish release**。

已安装 `gh` 的话：

```bash
gh release create v1.0.0 dist/dsh-token-insight-1.0.0.tgz \
  --title "v1.0.0" \
  --notes-file CHANGELOG.md
```

**方式 B：推新 tag 让 workflow 自动发布**

```bash
# 1) 把 package.json 升到 1.0.1，更新 CHANGELOG.md
# 2) 提交后推 tag
git tag v1.0.1
git push origin main --tags
```

workflow 会依次执行 `npm run check` → `npm pack` → 创建 Release 并附 `dsh-token-insight-1.0.1.tgz`；如果仓库 Secrets 配了 `NPM_TOKEN`，还会顺带 `npm publish`。

**验证 Release 链接可用**（必须返回 200）：

```bash
curl -sIL -o /dev/null -w "%{http_code}\n" \
  https://github.com/luqingjie1001/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz
```

> 资产文件名必须保持 `dsh-token-insight-1.0.0.tgz`，否则 README 和市场 YAML 里的 `tarball` 链接对不上。

### 2. 发布 npm

```bash
npm login
npm publish --access public
```

验证：

```bash
npm view dsh-token-insight version    # 1.0.0
```

补充：

- 如果 npm 账号开了 2FA，`publish` 时按提示加 `--otp=<code>`。
- 想让 workflow 自动发布，在仓库 **Settings → Secrets and variables → Actions** 新建 `NPM_TOKEN`（npm Automation token），之后推新 tag 时 `npm publish` 步骤才会执行。
- 本机 `~/.npm` 里有 root 所有的缓存文件，`npm pack` 会报 `EPERM`。先修：

  ```bash
  sudo chown -R 501:20 ~/.npm
  ```

  或临时换缓存目录：`npm --cache /tmp/npm-cache publish --access public`（登录态在 `~/.npmrc`，不受影响）。

### 3. 提交市场 PR

**仓库必须创建满 1 天**（市场 CI 自动检查），即 **2026-11-01 17:51 +08 之后**再提，否则会被直接拒。

1. Fork <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>。
2. 把 [market/luqingjie1001__dsh-token-insight.yml](market/luqingjie1001__dsh-token-insight.yml) 复制为 `data/plugins/luqingjie1001__dsh-token-insight.yml`。
3. 开 PR，标题建议 `Add luqingjie1001/dsh-token-insight (usage)`。
4. 等 CI 绿 + 维护者按源码核对描述。

字段说明、提交前检查清单和注意事项见 [MARKET.md](MARKET.md)。

### 4. 发布后验证

```bash
# Release 链接
curl -sIL -o /dev/null -w "%{http_code}\n" \
  https://github.com/luqingjie1001/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz

# npm
npm view dsh-token-insight version

# 干净安装
dsh plugin --profile web add dsh-token-insight
```

最后在 **插件 → Discover** 搜索 `dsh-token-insight`；索引同步通常一天内完成。

## 以后升级

1. 只改 UI：改 `client.js` → `npm pack` → 重装 → 刷新页面。
2. 改 Host：改 `index.js` / `typert.host.js` → 重装后**重启 DSH**。
3. 版本号遵循 semver，同步更新 `CHANGELOG.md`。
4. `git tag v1.0.1 && git push origin v1.0.1`（workflow 会建 Release）。
5. 若 workflow 没配 `NPM_TOKEN`，手动 `npm publish --access public`。
6. 市场条目一般不用改（`url` / `name` 不变）；**只有描述或功能变化才改 YAML**。
7. 升级后记得把市场 YAML 里的 `tarball` 从 `v1.0.0` 改成新版本，或干脆去掉 `tarball` 让市场走 npm。

## 常见坑

| 现象 | 原因 / 处理 |
|---|---|
| 推了 tag 但 Actions 没跑 | workflow 只监听 `v*` tag，且 tag 早于工作流推送时不会补跑；手动建 Release，或推新 tag |
| Release 链接 404 | Release 还没创建；先做第 1 步 |
| npm 404 | 还没 `npm publish`，或没登录 / 没带 OTP |
| `npm` 报 `EPERM ~/.npm/_cacache` | 缓存被 root 占用，`sudo chown -R 501:20 ~/.npm` |
| 市场 PR 被 CI 拒：仓库太新 | 仓库创建不满 1 天，等 `2026-11-01 17:51` 后重提 |
| 市场里搜不到 | npm 未发布（索引只收 npm 有版本的包）、PR 未合并，或索引同步延迟 |
| 市场卡片没图标 | `icon` 必须是 GitHub 托管的 PNG/JPEG，`icon.svg` 不符合 |
| 发版后 tarball 404 | `latest/download/` 配了带版本号的文件名；本项目钉死 tag，不受影响，但升级时要改 |
| 升级后 UI 还是旧版 | Host 代码需要重启 DSH；Client 刷新页面 |
| `failed to import: Cannot find package '@deepseek-ai/...'` | 用目录 `link:` 安装；请用 tgz 或 npm |
| `invalid plugin, expect function or object with an "apply" method` | `index.js` 缺 `export default` |
| 插件 entry `fiberPhase: null` | 包名与 `TYPERT.package` 不一致，或 Host 导入失败 |
