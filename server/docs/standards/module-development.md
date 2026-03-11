# 模块开发规范 (Module Development Standards)

## 1. 模块结构
每个业务模块应包含以下核心文件：

```text
src/routes/<module-name>/
├── index.js      # 路由定义 (Router Definition)
└── service.js    # 业务逻辑 (Service Logic)
```

- **index.js**: 负责定义 API 路径、挂载中间件、调用 Service 层方法并处理响应。
- **service.js**: 纯业务逻辑，不包含 req/res 对象，接受普通参数，返回数据或抛出异常。

## 2. 路由层规范 (index.js)
- 使用 `express.Router()`。
- 使用 `asyncHandler` 包装异步路由处理函数。
- 参数校验应在调用 Service 之前完成 (或使用中间件)。
- **禁止**在路由层编写复杂的业务逻辑。

```javascript
const express = require('express');
const { asyncHandler } = require('../../utils/response');
const service = require('./service');

const router = express.Router();

// GET /api/example
router.get('/', asyncHandler(async (req, res) => {
  const { query } = req.query;
  const data = await service.getData(req.user.id, query);
  return data; // asyncHandler 会自动封装为 { success: true, data: ... }
}));

module.exports = router;
```

## 3. 服务层规范 (service.js)
- 函数应为 `async`。
- **参数验证**: 使用 `ensure` 或 `Joi` 进行参数完整性检查。
- **错误处理**: 遇到业务错误直接 `throw createError(status, message)`。
- **返回值**: 仅返回业务数据，不返回 `{ success: true }` 包装对象。

```javascript
const { createError, ensure } = require('../../utils/tooljs');

async function getData(userId, query) {
  ensure({ userId }); // 必填校验

  if (!query) {
    throw createError('Query parameter is missing', 400);
  }

  // ... 业务逻辑 ...
  return { id: 1, name: 'Example' };
}

module.exports = { getData };
```

## 4. 依赖注入与工具引用
- 尽量避免模块间的循环依赖。
- 通用工具函数应从 `src/utils` 导入。
- 数据库操作应通过 `src/utils/db-utils` 或 Model 层进行。

## 5. 安全性规范
- **路径安全**: 凡是涉及文件路径的操作，必须使用 `isWithinPath` 等工具校验，防止路径遍历攻击。
- **输入过滤**: 不信任任何前端输入，必须进行类型转换和清洗。
- **权限控制**: 敏感接口必须添加 `auth` 和 `admin` (如需要) 中间件。
