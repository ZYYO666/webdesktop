# 004 - VFS Stat 逻辑重构

**日期**: 2024-01-01
**作者**: System

## 变更内容
1. **VFS Core 增强**:
   - 在 `VfsManager` 中新增 `_statType(ctx, vfsPath, type)` 方法。
   - 该方法封装了 `_statPath` 调用以及类型检查（是否为目录/文件）的逻辑。
   - `VfsProxy` 暴露了便捷方法 `statFile(path)` 和 `statDir(path)`。

2. **Service 层重构**:
   - `file-service.js`: 替换了 `getFileContent` 中的 `statFile` 逻辑（之前是直接调用的，现在逻辑内聚在 VFS）。
   - `thumbnail/service.js`: 使用 `ctx.statFile(path)` 替代了手动的 `statPath` + `isDirectory` 检查。
   - 消除了业务层中大量重复的 `if (stat.isDirectory) throw ...` 样板代码。

3. **代码健壮性**:
   - 所有的 Stat 类型检查现在统一由 VFS Core 处理，确保了行为一致性。
