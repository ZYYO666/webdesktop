# 项目级别开发规范 (Project Standards)

## 1. 目录结构规范
项目遵循标准的 Node.js 分层架构：

```text
server/
├── src/
│   ├── config/         # 配置文件 (常量, DB连接等)
│   ├── middleware/     # Express 中间件 (Auth, Logger等)
│   ├── routes/         # 路由层 (按业务模块划分)
│   ├── services/       # 业务逻辑层 (VFS, FileService等)
│   ├── utils/          # 通用工具函数
│   └── index.js        # 应用入口
├── docs/               # 项目文档
│   ├── standards/      # 开发规范
│   ├── api/            # API 文档
│   └── changelog/      # 变更日志
├── test/               # 测试文件
└── package.json
```

## 2. 命名规范
- **文件/目录名**: 使用 `kebab-case` (如 `file-service.js`, `user-controller.js`)。
- **变量/函数名**: 使用 `camelCase` (如 `getUserById`, `isValidPath`)。
- **类名**: 使用 `PascalCase` (如 `VfsManager`, `LocalAdapter`)。
- **常量**: 使用 `UPPER_SNAKE_CASE` (如 `MAX_UPLOAD_SIZE`)。
- **私有方法/变量**: 前缀下划线 `_` (如 `_internalMethod`)。

## 3. 错误处理规范
- **异常驱动**: 业务逻辑层不返回 `{ success: false }`，而是直接抛出异常。
- **统一错误类**: 使用 `http-errors` 库创建标准 HTTP 错误。
- **捕获机制**: 路由层使用 `asyncHandler` 或全局错误中间件统一捕获异常。

```javascript
const createHttpError = require('http-errors');

// 抛出错误
throw createHttpError(404, 'File not found');
```

## 4. Git 工作流
- **分支管理**:
  - `main`: 生产环境分支，随时可部署。
  - `develop`: 开发主分支。
  - `feature/*`: 功能分支 (如 `feature/add-webdav`).
  - `fix/*`: 修复分支 (如 `fix/login-bug`).
- **提交信息**:
  - `feat`: 新功能
  - `fix`: 修复 bug
  - `docs`: 文档变更
  - `refactor`: 代码重构
  - `chore`: 构建过程或辅助工具的变动

## 5. 代码风格
- 使用 ESLint 进行代码质量检查。
- 缩进使用 2 个空格。
- 语句末尾使用分号。
- 优先使用 `const`，其次 `let`，禁止 `var`。
- 异步操作优先使用 `async/await`。
