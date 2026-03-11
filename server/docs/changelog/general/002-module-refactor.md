# 002 - 模块分层重构

**日期**: 2024-01-01
**作者**: System

## 变更内容
1. **Public 模块重构**:
   - 创建 `src/routes/public/service.js`。
   - 将 `getSharedFile` 逻辑从全局 `file-service.js` 迁移至模块内部。
   - 规范化 `src/routes/public/index.js`，通过 `service` 对象调用业务逻辑。
   - 使用 `createError` 替换手写的 `new Error`。

2. **Thumbnail 模块重构**:
   - 规范化 `src/routes/thumbnail/index.js`，通过 `service` 对象调用业务逻辑。
   - 调整代码顺序，先执行业务逻辑，成功后再设置响应 Header。

3. **代码清理**:
   - 从 `src/services/file-service.js` 移除了不再被外部引用的 `getSharedFile`。
