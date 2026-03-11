# Downloader API（前端对接说明）

Base URL：`/api/downloader`

鉴权：`Authorization: Bearer <token>`（前端统一由 axios 拦截器注入）

## Task（任务对象）

后端接口返回的 `data` 为 Task 或 Task 数组，常用字段：

- `id`：任务 ID（UUID）
- `url`：下载地址（http/https）
- `dirPath` / `filename`：创建任务时的目标目录与期望文件名
- `targetPath`：实际保存路径（可能自动避重名）
- `status`：`queued | running | paused | completed | failed | canceled`
- `totalBytes` / `downloadedBytes`：总大小与已下载
- `speedBytesPerSec`：展示用的速度
- `etaSeconds`：预计剩余秒数（可能为 null）
- `retryCount`：累计重试次数
- `createdAt/startedAt/finishedAt/updatedAt`：时间戳（ms）
- `error`：失败原因（失败/重试中的最近一次错误信息）

## 接口

### 创建任务

`POST /tasks`

Body：

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

### 获取任务列表

`GET /tasks`

### 获取单个任务

`GET /tasks/:id`

### 暂停任务

`POST /tasks/:id/pause`

### 继续任务

`POST /tasks/:id/resume`

### 取消任务

`POST /tasks/:id/cancel`

### 删除任务记录

`DELETE /tasks/:id`

### 一键暂停全部任务

`POST /tasks/pause-all`

### 一键继续全部任务

`POST /tasks/resume-all`

### 批量清理任务记录

`POST /tasks/clear`

Body：

```json
{
  "statuses": ["completed", "failed", "canceled"]
}
```

## 前端封装位置

前端 API 封装在：

- `src/os/api/api.js`
  - `downloaderCreateTask`
  - `downloaderListTasks`
  - `downloaderGetTask`
  - `downloaderPauseTask`
  - `downloaderResumeTask`
  - `downloaderCancelTask`
  - `downloaderDeleteTask`
  - `downloaderPauseAllTasks`
  - `downloaderResumeAllTasks`
  - `downloaderClearTasks`

