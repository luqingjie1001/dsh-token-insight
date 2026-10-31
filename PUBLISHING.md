# 发布操作手册

本仓库已经按公开发布准备好。本文只记录「还需要你本人执行的动作」和「以后升级时怎么做」。

## 已确定的信息

| 项 | 值 |
|---|---|
| npm 包名 | `dsh-token-insight` |
| 版本 | `1.0.0` |
| GitHub | <https://github.com/luqingjie/dsh-token-insight> |
| 作者 | 陆庆杰 `<992768355@qq.com>` |
| License | MIT |
| 渠道 | GitHub Release + npm + 插件市场 |
| DSH 兼容 | `>= 0.2.1-rc.3 < 0.3.0` |

## 已完成的准备

- 包名从 `@local/dsh-token-usage` 改为 `dsh-token-insight`，同步了 `typert.host.js` 的 `TYPERT.package`、`cordis.patch.yml`、Client bundle id 与 Remote 描述符
- `package.json`：去掉 `private`，补 `author` / `repository` / `homepage` / `bugs` / `engines` / `CHANGELOG`
- README 改写为面向用户的安装/使用/隐私说明（中英双语）
- MIT `LICENSE`、`CHANGELOG.md`、`.gitignore`、GitHub Actions Release workflow
- `npm run check`、`npm pack` 通过，并已在本机 profile 安装验证

## 你要执行的 3 步

### 1. 建仓库并 push

GitHub 上新建空仓库 `dsh-token-insight`（不要勾选初始化 README）。本目录**已经初始化、提交并打了 `v1.0.0` tag**，不要再 `git init`：

```bash
git remote add origin git@github.com:luqingjie/dsh-token-insight.git
git push -u origin main --tags
```

推送 tag 会触发 `.github/workflows/release.yml`，自动创建 GitHub Release 并附带 `dsh-token-insight-1.0.0.tgz`。

> `dist/`、`*.tgz`、`node_modules/` 已在 `.gitignore` 中排除；commit 为 `f665838`。

### 2. 发布 npm

```bash
npm login
npm publish --access public
```

包名 `dsh-token-insight` 已确认在 npm 可用（`npm view` 返回 404），`npm publish --dry-run` 也已通过。发布后用户可以直接：

```bash
dsh plugin --profile desktop add dsh-token-insight
```

### 3. 提市场 PR

在 <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin> 提交一个 PR，加入一条插件条目。参考文案见 [MARKET.md](MARKET.md)。

市场只允许从该目录收录的来源安装；合并后 DSH 的 **插件 → Discover** 通常一天内能搜到。

## 发布 GitHub Release

推 tag 后，`.github/workflows/release.yml` 会自动：

1. `npm run check`
2. `npm pack`
3. 创建 GitHub Release，附带 `dsh-token-insight-1.0.0.tgz`
4. 若仓库 Secrets 配了 `NPM_TOKEN`，同时 `npm publish`

Release URL 形如：

```text
https://github.com/luqingjie/dsh-token-insight/releases/download/v1.0.0/dsh-token-insight-1.0.0.tgz
```

## 以后升级

1. 改 `client.js`（只改 UI）：`npm pack` → 重装 → 刷新页面
2. 改 `index.js` / `typert.host.js`（Host）：重装后**重启 DSH**
3. 版本号遵循 semver；同步更新 `CHANGELOG.md`
4. 重新提 tag：`git tag v1.0.1 && git push origin v1.0.1`

## 常见坑

| 现象 | 原因 |
|---|---|
| `failed to import: Cannot find package '@deepseek-ai/...'` | 用目录 `link:` 安装；请用 tgz |
| `invalid plugin, expect function or object with an "apply" method` | `index.js` 缺 `export default` |
| 插件 entry `fiberPhase: null` | 包名与 `TYPERT.package` 不一致，或 Host 导入失败 |
| 市场里搜不到 | awesome-dsh-plugin PR 未合并，或来源不在白名单 |
| 升级后 UI 还是旧版 | Host 代码需要重启；Client 刷新页面 |
