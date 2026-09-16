# 本地视频抽帧实现设计

## 目标

将现有“视频抽帧”页面从演示状态改为真实本地处理：用户选择 MP4、设定目标 FPS 后，应用生成一个保持原时长和声音的新 MP4，并在右侧预览和下载。最终 Windows 安装包内置 FFmpeg，使用者无需另行安装。

## 方案选择

采用应用内 Express 服务执行转码。前端已经通过该本地服务运行，直接上传文件、轮询任务和下载产物即可；不增加 Electron preload、IPC 或前端依赖。

FFmpeg 可执行文件由安装前准备脚本下载到本地 `vendor` 目录，打包时通过 electron-builder 的 `extraResources` 复制到安装包的 `resources/ffmpeg`。仓库忽略二进制文件，同时保留下载来源和 LGPL 许可证说明。

## 处理流程

1. 前端仅接受 MP4，目标 FPS 限制为 1–60，默认 15。
2. 点击“开始处理”后，前端将视频和 FPS 上传至 `POST /api/video-frame-extraction`。
3. 服务端在系统临时目录建立一个随机任务目录，保存上传文件，并以无 shell 的 `spawn` 调用内置 FFmpeg。
4. FFmpeg 使用视频滤镜降低帧率，映射第一个视频流和可选音频流；视频编码为 H.264，音频优先直接复制，输出为 MP4。
5. 服务端解析 FFmpeg 的 `-progress pipe:1` 输出，保存 `queued`、`processing`、`complete`、`failed` 四种任务状态及百分比。
6. 前端轮询 `GET /api/video-frame-extraction/:id`。完成后，右侧的视频预览和下载按钮均指向 `GET /api/video-frame-extraction/:id/download`，不再使用原始上传文件。

## API 契约

### 创建任务

`POST /api/video-frame-extraction` 使用 multipart 表单字段 `video` 与 `targetFps`。服务端校验 MP4、文件大小不超过 2 GB、FPS 为 1–60；成功返回任务 ID、输出文件名和初始状态。

### 查询任务

`GET /api/video-frame-extraction/:id` 返回状态、进度、可读错误信息，以及仅在完成时返回下载地址。未知任务返回 404。

### 下载结果

`GET /api/video-frame-extraction/:id/download` 仅在任务完成时以附件形式返回生成的 MP4；未完成或未知任务不暴露任何本地路径。

## 文件、错误与安全

- 文件名不参与路径拼接；任务 ID 用系统随机 UUID 生成。
- 临时目录位于系统 temp 下的应用专属目录。应用启动时清理超过 24 小时的旧任务目录；完成后的文件会保留到清理时，避免下载中途被删除。
- FFmpeg 使用参数数组启动，绝不通过 shell 执行。
- 找不到随包的 FFmpeg、上传失败、转码失败或下载前任务失败时，页面显示明确错误并允许用户重新选择视频再试。
- 转码过程中前端禁止重复启动；更换视频时清空旧任务与旧结果。

## 输出约束

输出始终为 MP4、H.264 视频、原时长和目标 FPS。音频流存在时保留；若源音频不能直接封装进 MP4，服务端重试为 AAC，仍无法生成时返回失败。页面继续显示实际产物的文件大小、时长和目标 FPS。

## 测试与验收

- 服务端路由测试覆盖输入校验、状态查询和未完成下载拒绝。
- 前端测试覆盖请求开始、轮询完成后使用结果下载地址、以及错误显示。
- 构建验证包含 typecheck、Vite、服务端构建和现有测试。
- 实机验收：选择本地 MP4，将 FPS 从默认 15 改为另一值，处理完成后右侧预览新文件并下载；下载视频仍有声音、时长不变且帧率降低。
