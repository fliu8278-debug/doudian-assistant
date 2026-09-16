# Windows 发布说明

## 一次性配置

1. 在 GitHub 创建公开空仓库 `fliu8278-debug/doudian-assistant-releases`。它只用于 GitHub Releases，不能上传源码或本地数据。
2. 创建 Fine-grained personal access token：仅选择该发布仓库，授予 **Contents: Read and write**，并把它保存为私有源码仓库 `doudian-assistant` 的 Actions Secret `GH_RELEASE_TOKEN`。
3. 准备 Windows 代码签名证书。将证书安全引用或 Base64 内容保存为 `WIN_CSC_LINK`，将证书密码保存为 `WIN_CSC_KEY_PASSWORD`。两项均添加到私有源码仓库的 Actions Secrets。

没有这三个 Secrets，发布工作流会失败，不会产生未签名的对外版本。

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

5. 在私有源码仓库的 Actions 页面确认 **Release Windows** 成功。
6. 在公开发布仓库的 Releases 页面确认存在安装包和 `latest.yml`。已安装的抖店助手会在下次启动时提示更新。

## 安全边界

- 不要把 `GH_RELEASE_TOKEN`、签名证书或证书密码提交到 Git。
- 不要将 `data/`、浏览器 Profile、Cookie 或 SQLite 数据库上传到公开发布仓库。
- 证书更新时，先在测试机验证旧版本可以更新到新版本，再向用户发布。
