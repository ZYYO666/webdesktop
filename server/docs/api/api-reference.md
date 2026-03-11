# API 参考文档 (API Reference)

## 1. 基础说明
- **Base URL**: `/api`
- **认证方式**: Bearer Token (Authorization header: `Bearer <token>`)
- **数据格式**: JSON

## 2. 响应格式 (Response Format)

所有 API 响应遵循统一的 JSON 结构：

**成功响应 (Success):**
```json
{
  "success": true,
  "msg": "Operation successful",
  "data": {
    "key": "value"
  }
}
```

**失败响应 (Error):**
```json
{
  "success": false,
  "msg": "Error message description",
  "data": null // 可选，包含错误详情
}
```

## 3. 认证接口 (Auth)

### 3.1 登录 (Login)
- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "username": "admin",
    "password": "password"
  }
  ```
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR...",
      "user": { "id": 1, "username": "admin", "role": "admin" }
    }
  }
  ```

## 4. 文件操作接口 (Files)

### 4.1 获取文件列表 (List Files)
- **URL**: `/api/list`
- **Method**: `GET`
- **Query Params**:
  - `path`: 目录路径 (default: `/`)
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "path": "/",
      "files": [
        {
          "name": "example.txt",
          "type": "file",
          "size": 1024,
          "modified": "2023-01-01T12:00:00.000Z"
        }
      ]
    }
  }
  ```

*(更多接口请参考源码 `src/routes/` 目录)*

## 5. 下载器接口 (Downloader)

下载器模块详细说明见：
- `docs/api/downloader.md`
