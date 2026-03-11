# 工程架构与依赖隔离规范

本规范用于保证 `src/apps` 下各应用（App）之间完全隔离，避免隐式耦合与依赖扩散；同时明确 App 与 OS 层（`src/os`）的边界，要求 App 只能通过 OS 对外 API 获取能力。

## 术语

- App：`src/apps/<app-id>/` 目录下的一个应用单元（包含 UI、业务逻辑、资源与自身私有工具）。
- OS 层：`src/os/` 目录，提供窗口系统、鉴权、文件系统能力、UI 能力、以及对后端的 API 封装等。
- OS 对外 API：OS 层稳定暴露给 App 的能力入口，App 通过该入口调用能力而非直接 import OS 内部模块。

## 目录分层（约定）

- `src/apps/`：应用层。每个子目录就是一个隔离单元。
- `src/os/`：系统层。仅 OS 内部可以自由引用其子模块。
- `src/components/`：跨 App 的通用 UI 组件（允许 App 引用）。
- 其它跨 App 共享逻辑：必须沉淀到 `src/components/`（UI 类）或新增的通用层目录（如未来的 `src/shared/`），禁止通过“引用其它 App”来复用。

## 强制规则

### 1) App 之间完全隔离（严禁互相导入）

在 `src/apps/<app-id>/` 内：

- 严禁 import `src/apps/<other-app-id>/...` 的任何代码、组件、资源与工具函数。
- 严禁通过相对路径绕过边界，例如 `../../other-app/...`、`../..//apps/...` 等。
- 严禁在一个 App 内直接引用另一个 App 的运行时实现（包括组件、store、service、常量等）。

允许的复用方式：

- 抽到 `src/components/`（或通用层目录）后再被多个 App 引用。
- 通过 OS 对外 API 间接交互（例如由 OS 负责打开窗口/启动应用/文件打开等能力编排）。

### 2) App 禁止直接导入 OS 内部模块（只能通过 API）

在 `src/apps/<app-id>/` 内：

- 严禁直接 import `src/os/**` 的内部实现模块，包括但不限于：
  - `src/os/store/**`
  - `src/os/ui/**`
  - `src/os/utils/**`
  - `src/os/actions/**`
  - `src/os/impl/**`
  - `src/os/api/api.js`（实现文件）
- App 只能通过 OS 对外 API 获取能力，并通过能力对象调用。

OS 对外 API 入口约定：

- 允许 import：`@/os`（仅用于获取 OS 注入入口，如 `useOs()`）
- 允许使用：`const os = useOs()` 后的 `os.api`（能力调用入口）
- 其它来自 `@/os/**` 的深层 import 均视为越界

### 3) 依赖方向必须单向

- OS 层可以引用 App 清单/注册信息（例如通过 registry 收集入口），但 OS 不应依赖任何 App 的业务实现细节。
- App 只能依赖通用层（`src/components` 等）与 OS 对外 API；不得反向影响 OS 内部结构。

## import 示例

### App 间隔离

禁止：

```js
import Something from '@/apps/file-browser/components/AppFileBrowserTopBar.vue'
```

允许（提炼到通用层）：

```js
import Something from '@/components/xxx/Something.vue'
```

### OS 边界

禁止（直接引用 OS 内部实现）：

```js
import { useFileStore } from '@/os/store/files'
import { joinPath } from '@/os/utils'
import { createApi } from '@/os/api'
```

允许（通过 OS 对外 API 调用能力）：

```js
import { useOs } from '@/os'

const os = useOs()
await os.api.listFiles('/Downloads')
```

## 评审检查清单（PR 必过）

- App 内无 `@/apps/<other-app>` 或跨 App 相对路径 import
- App 内无 `@/os/**` 深层 import（仅允许 `@/os` 入口）
- 需要复用的逻辑已抽到通用层（`src/components/` 或通用目录），而不是“引用其它 App”
- 所有 OS 能力调用均通过 `os.api`（而非 store/ui/utils 的直接 import）
