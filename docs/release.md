# Windows 发布说明

## 一次性配置

1. 在 GitHub 创建公开空仓库 `fliu8278-debug/doudian-assistant-releases`。它只用于 GitHub Releases，不能上传源码或本地数据。
2. 创建可写入该公开发布仓库的 GitHub personal access token，并把它保存为私有源码仓库 `doudian-assistant` 的 Actions Secret `GH_RELEASE_TOKEN`。

没有 `GH_RELEASE_TOKEN`，发布工作流会失败。

此版本用于分享给受信任的朋友：安装包未使用 Windows Authenticode 证书签名，Windows 首次安装时可能显示“未知发布者”。应用内更新仍会从公开发布仓库下载，但不会执行证书签名校验。

## 发布新版本

1. 修改 `package.json` 中的版本号，例如从 `0.1.0` 改为 `0.2.0`。
2. 运行：

   ```powershell
   npm test
   npm run typecheck
   npm run dist:win
   ```

3. 打开生成的安装包并检查功能。确认后再提交、推送 `main`。
4. 创建与 `package.json` 版本完全一致的标签并推送：

   ```powershell
   git tag v0.2.0
   git push origin v0.2.0
   ```

5. 在私有源码仓库的 Actions 页面确认 **Release Windows** 成功。工作流会先创建草稿 Release，只有安装包、`.blockmap` 和 `latest.yml` 均上传成功后才标记为最新版本。
6. 在公开发布仓库的 Releases 页面确认最新 Release 存在安装包和 `latest.yml`。已安装的抖店助手会在下次启动时提示更新。

## 安全边界

- 不要把 `GH_RELEASE_TOKEN` 提交到 Git。
- 不要将 `data/`、浏览器 Profile、Cookie 或 SQLite 数据库上传到公开发布仓库。
- 每次发布前，先在测试机验证旧版本可以更新到新版本，再向朋友发布。
