# Electron GitHub 自动更新设计

## 目标

让已安装的 Windows 版抖店助手在启动时检查更新；有新版本时，由用户选择下载并在重启后安装。源码保持私有，安装包和更新描述文件通过公开的 GitHub Releases 分发。

## 范围

- 保留现有 Electron、Express、React 和 Playwright 架构。
- 使用 `electron-updater` 与现有 NSIS 安装包。
- 只支持 Windows x64；不迁移 Tauri、不增加 macOS 或 Linux 发布。
- 用户可手动选择下载和安装；不在任务执行中自动重启。

## 仓库职责

```text
fliu8278-debug/doudian-assistant           私有：源码、测试、发布工作流
fliu8278-debug/doudian-assistant-releases  公开：GitHub Releases 的安装包与 latest.yml
```

公开仓库不得包含源码、SQLite 数据库、浏览器配置、Cookie 或测试数据。

## 客户端更新流程

1. 仅打包后的桌面应用启动时检查更新；开发模式不联网检查。
2. 发现版本后显示原生对话框，提供“立即更新”和“稍后”。
3. 用户选择立即更新后才下载；下载成功后显示“重启安装”和“稍后”。
4. 只有用户选择重启安装时才调用安装流程。
5. 检查或下载失败仅写入控制台日志，不阻止应用启动，也不弹出干扰性错误。

## 发布流程

1. 本地功能完成后启动网页预览，用户确认后才提交并推送源码。
2. 发布者递增 `package.json` 的语义化版本号，创建 `v<version>` 标签并推送该标签。
3. 私有源码仓库中的 GitHub Actions 在 Windows runner 上执行 `npm ci`、测试、构建和 NSIS 打包。
4. 工作流仅在三个密钥都存在时发布：
   - `GH_RELEASE_TOKEN`：只授予公开发布仓库的 Contents 读写权限。
   - `WIN_CSC_LINK`：Windows 代码签名证书的安全引用或 Base64 内容。
   - `WIN_CSC_KEY_PASSWORD`：代码签名证书密码。
5. 构建产物、`latest.yml` 和 Release 由 `electron-builder --publish always` 上传至公开发布仓库。

## 签名与安全

- Windows 更新继续使用 NSIS，保持 `verifyUpdateCodeSignature` 默认开启。
- 安装程序和应用可执行文件必须使用同一发布者证书签名。
- 代码签名凭据仅存放在 GitHub Actions Secrets，绝不写入仓库、配置文件或应用。
- 没有签名凭据时，发布工作流失败，避免误发未签名的对外版本。

## 验证

- 组件测试覆盖更新检查只在打包环境初始化，以及新版本对话框的用户选择。
- 现有 `npm test`、`npm run typecheck` 和 `npm run build` 必须通过。
- 发布前通过 GitHub Actions 构建一个预发布版本，确认公开发布仓库包含 `.exe` 与 `latest.yml`；在测试机执行一次“检查 → 下载 → 重启安装”。

## 外部前置条件

- 用户创建公开的 `fliu8278-debug/doudian-assistant-releases` 仓库。
- 用户取得 Windows 代码签名证书或 Azure Trusted Signing 账户。
- 用户在 GitHub 中创建并保存发布 Token 与签名 Secrets。创建 Token、授予仓库权限、设置 Secrets 都由用户在 GitHub 页面操作。
