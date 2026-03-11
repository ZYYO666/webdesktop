# Downloader API（下载器）

下载器模块用于从外部 HTTP/HTTPS 地址拉取文件，并保存到当前用户的虚拟文件系统（VFS）路径中。模块以“任务”形式执行，支持队列并发、失败重试、本地挂载断点续传，以及暂停/继续/取消/清理等控制能力。

## Base URL

`/api/downloader`

## Authentication

所有接口需要 `user` 及以上权限。

- Header: `Authorization: Bearer <token>`
- 兼容：`?token=...` 或 body 里的 `token`（不建议新代码使用）

## 任务模型（Task Object）

接口返回中的 `data` 为 Task 或 Task 数组。

```json
{
  "id": "6b3b3d52-4b2c-4e54-a8dc-1d9d1cdb4b62",
  "url": "https://example.com/file.zip",
  "dirPath": "/Downloads",
  "targetPath": "/Downloads/file.zip",
  "filename": "file.zip",
  "status": "running",
  "totalBytes": 123456789,
  "downloadedBytes": 1048576,
  "speedBytesPerSec": 102400,
  "etaSeconds": 1199,
  "retryCount": 1,
  "createdAt": 1704355200000,
  "startedAt": 1704355201000,
  "finishedAt": null,
  "updatedAt": 1704355202000,
  "error": null
}
```

### 字段说明

- `id`: 任务 ID（UUID）
- `url`: 源下载地址（仅允许 http/https）
- `dirPath`: 用户传入的目标目录（VFS 路径）
- `filename`: 期望保存的文件名
- `targetPath`: 实际落盘的目标文件（VFS 路径）。当 `overwrite=false` 且重名时会自动生成不冲突名称
- `status`: 任务状态（见下）
- `totalBytes`: 任务总大小（无法获取时为 0）
- `downloadedBytes`: 已下载字节数
- `speedBytesPerSec`: 平滑后的瞬时速度（仅用于展示）
- `etaSeconds`: 预计剩余秒数（无法估算时为 null）
- `retryCount`: 重试次数累计
- `createdAt/startedAt/finishedAt/updatedAt`: 时间戳（毫秒）
- `error`: 失败原因（失败/重试中的最近一次错误信息）

### status 取值

- `queued`: 已创建，等待开始（在队列中）
- `running`: 下载中
- `paused`: 已暂停（可继续）
- `completed`: 已完成
- `failed`: 失败（可继续会重新入队）
- `canceled`: 已取消（不可继续）

## 行为与限制（很重要）

### 并发与队列

- 全局并发上限：2
- 单用户并发上限：1

### 失败重试

- 默认最多重试 5 次（对常见网络错误/部分 HTTP 状态码）
- 指数退避（上限 30s）

### 断点续传（仅本地挂载）

当目标落在本地挂载时：

- 下载写入本地磁盘 `.part` 临时文件
- 暂停后保留 `.part`
- 继续时会用 `Range` 头从 `.part` 末尾续传，并使用 `If-Range`（ETag 或 Last-Modified）避免资源变化导致的错误续传

非本地挂载（如 WebDAV/SMB）当前不支持断点续传。

### 非本地挂载写入限制

当目标挂载不是本地挂载时，由于写入接口是整块写入：

- 采用“下载到内存 Buffer → 一次性写入”的方式
- 单文件大小限制：100MB（超过会返回错误）
- 暂停后继续会重新从头下载（进度会从 0 重新计算）

### SSRF 与安全跳转

- 仅允许 `http:` / `https:` 协议
- 禁止 `localhost` 与内网/私网 IP（DNS 解析后校验）
- 对重定向（301/302/303/307/308）逐跳校验目标 URL 的安全性，并限制最大跳转次数

---

## 1. 创建下载任务

### Create Task

- **Endpoint**: `POST /tasks`
- **Content-Type**: `application/json`

#### Body

```json
{
  "url": "https://example.com/file.zip",
  "dirPath": "/Downloads",
  "filename": "file.zip",
  "overwrite": false,
  "headers": {
    "Authorization": "Bearer xxxx",
    "Cookie": "a=b"
  }
}
```

#### Body 字段说明

- `url` (required): 下载地址
- `dirPath` (optional): 保存目录（VFS 路径），默认 `/`
- `filename` (optional): 期望保存的文件名
  - 若不传：优先从 URL path 猜测文件名，否则使用 `download.bin`
- `overwrite` (optional): 是否覆盖同名文件，默认 `false`
  - `false` 时会自动生成不冲突的文件名（如 `file (1).zip`）
- `headers` (optional): 透传到下载请求的自定义请求头（会过滤 `Host/Content-Length/Connection` 等危险或无意义头）

#### Success Response

```json
{
  "success": true,
  "msg": "Task created",
  "data": {
    "id": "6b3b3d52-4b2c-4e54-a8dc-1d9d1cdb4b62",
    "kind": "http",
    "status": "queued",
    "url": "https://example.com/file.zip",
    "dirPath": "/Downloads",
    "filename": "file.zip",
    "targetPath": "",
    "totalBytes": 0,
    "downloadedBytes": 0,
    "speedBytesPerSec": 0,
    "etaSeconds": null,
    "retryCount": 0,
    "createdAt": 1704355200000,
    "startedAt": null,
    "finishedAt": null,
    "updatedAt": 1704355200000,
    "error": null,
    "meta": null
  }
}
```

#### 常见 Error Response

```json
{
  "success": false,
  "msg": "Blocked private address",
  "data": null
}
```

---

## 1.1 创建 m3u8 转 mp4 任务

### Create m3u8-to-mp4 Task

- **Endpoint**: `POST /tasks/m3u8-to-mp4`
- **Content-Type**: `application/json`

说明：

- 该任务会调用 `ffmpeg` 将网络 m3u8（HLS）复用为 mp4 文件
- 目前仅支持输出到“本地挂载”（需要可解析为本地磁盘路径）
- 暂停/继续会“停止并重新开始”，不支持从中间继续
- 为了降低 SSRF 风险，后端会在开始前拉取并校验 m3u8 引用的 URI（包含 key/variant/segment），超大 playlist 会拒绝

#### Body

```json
{
  "url": "https://example.com/playlist.m3u8",
  "dirPath": "/Videos",
  "filename": "movie.mp4",
  "overwrite": false,
  "headers": {
    "Authorization": "Bearer xxxx",
    "Cookie": "a=b"
  }
}
```

#### Success Response（示例）

```json
{
  "success": true,
  "msg": "Task created",
  "data": {
    "id": "6b3b3d52-4b2c-4e54-a8dc-1d9d1cdb4b62",
    "kind": "m3u8-to-mp4",
    "status": "queued",
    "url": "https://example.com/playlist.m3u8",
    "dirPath": "/Videos",
    "filename": "movie.mp4",
    "targetPath": "",
    "totalBytes": 0,
    "downloadedBytes": 0,
    "speedBytesPerSec": 0,
    "etaSeconds": null,
    "retryCount": 0,
    "createdAt": 1704355200000,
    "startedAt": null,
    "finishedAt": null,
    "updatedAt": 1704355200000,
    "error": null,
    "meta": { "output": "mp4", "input": "m3u8" }
  }
}
```

---

## 2. 获取任务列表

### List Tasks

- **Endpoint**: `GET /tasks`

#### Success Response

```json
{
  "success": true,
  "msg": "Tasks",
  "data": [
    {
      "id": "6b3b3d52-4b2c-4e54-a8dc-1d9d1cdb4b62",
      "status": "running",
      "url": "https://example.com/file.zip",
      "dirPath": "/Downloads",
      "filename": "file.zip",
      "targetPath": "/Downloads/file.zip",
      "totalBytes": 123456789,
      "downloadedBytes": 1048576,
      "speedBytesPerSec": 102400,
      "etaSeconds": 1199,
      "retryCount": 0,
      "createdAt": 1704355200000,
      "startedAt": 1704355201000,
      "finishedAt": null,
      "updatedAt": 1704355202000,
      "error": null
    }
  ]
}
```

---

## 3. 获取单个任务

### Get Task

- **Endpoint**: `GET /tasks/:id`

#### Path Params

- `id`: Task ID

#### Error Response

```json
{
  "success": false,
  "msg": "Task not found",
  "data": null
}
```

---

## 4. 暂停任务

### Pause Task

- **Endpoint**: `POST /tasks/:id/pause`

说明：

- 若任务在 `running`，会中止当前下载请求
- 本地挂载会保留 `.part` 文件，继续时可断点续传

---

## 5. 继续任务

### Resume Task

- **Endpoint**: `POST /tasks/:id/resume`

说明：

- 会把任务置回 `queued` 并重新入队
- `failed` 任务也可继续（会从头开始或本地续传，取决于挂载类型）

---

## 6. 取消任务

### Cancel Task

- **Endpoint**: `POST /tasks/:id/cancel`

说明：

- 会把任务置为 `canceled` 并中止下载
- `canceled` 任务不可继续

---

## 7. 删除任务记录

### Delete Task

- **Endpoint**: `DELETE /tasks/:id`

说明：

- 只删除任务记录，不会删除已下载的目标文件
- 不会主动清理本地的 `.part` 文件

---

## 8. 一键暂停全部任务

### Pause All Tasks

- **Endpoint**: `POST /tasks/pause-all`

说明：

- 对当前用户，将 `queued/running` 全部置为 `paused`

---

## 9. 一键继续全部任务

### Resume All Tasks

- **Endpoint**: `POST /tasks/resume-all`

说明：

- 对当前用户，将 `paused/failed` 全部置为 `queued` 并重新入队

---

## 10. 批量清理任务记录

### Clear Tasks

- **Endpoint**: `POST /tasks/clear`
- **Content-Type**: `application/json`

#### Body

```json
{
  "statuses": ["completed", "failed", "canceled"]
}
```

说明：

- `statuses` 不传时默认清理：`completed/failed/canceled`
- 只会删除当前用户的任务记录

#### Success Response

```json
{
  "success": true,
  "msg": "Cleared",
  "data": {
    "deleted": 3,
    "statuses": ["completed", "failed", "canceled"]
  }
}
```
