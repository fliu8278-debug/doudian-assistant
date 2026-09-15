# 抖店助手

本地桌面工具，用于管理抖店店铺，并批量建立优惠券和新人礼金任务。

## 当前功能

- 店铺列表与本地浏览器配置
- 通过表格导入并批量建立优惠券
- 通过表格导入并批量建立新人礼金
- 任务进度和执行记录

## 技术栈

React、TypeScript、Vite、Express、Electron、SQLite 和 Playwright。

## 本地运行

需要 Node.js 24 或更高版本。

```bash
npm install
npm run dev
```

开发模式下，前端运行在 `http://127.0.0.1:5173`，本地服务会同时启动。

```bash
npm run app
```

构建并启动桌面应用。

## 常用命令

```bash
npm test
npm run typecheck
npm run build
npm run dist:win
```

## 本地数据

运行数据保存在 `data/`，包括数据库、浏览器配置和任务截图。该目录已在 `.gitignore` 中排除，不能提交到仓库；请勿提交 Cookie、账号信息或其他店铺敏感数据。
