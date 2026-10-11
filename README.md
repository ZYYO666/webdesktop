# webdesktop

在浏览器中运行的云桌面：窗口系统、虚拟文件系统，以及一组内置应用。前后端分离的单仓库实现。

## 特性

- **窗口系统** — 拖拽、缩放、最小化、全屏、多窗口与 Dock
- **虚拟文件系统** — 统一挂载本地目录、SMB、WebDAV，支持上传、下载、归档、缩略图、全文搜索
- **内置应用** — 文件管理、文本编辑、终端、下载器、任务管理器、应用商店等 18 个应用
- **多用户** — JWT 鉴权、角色、公开分享链接（`/s/...`）
- **可扩展** — 应用之间完全隔离，通过 OS 对外 API 获取能力

## 快速开始

要求 Node.js 20+。

```bash
# 后端
cd server
npm install
npm start            # http://localhost:3001

# 前端（另开一个终端）
cd client
npm install
npm run dev          # http://localhost:5173，/api 自动代理到 3001
```

首次启动会创建默认账号 `admin` / `admin`，请及时修改。

### 构建

```bash
cd server
npm run build        # 构建前端 + esbuild 打包后端，输出到 server/dist
cd dist
npm install
node server.js       # 单进程同时提供 API 与静态资源
```

`server/dist` 内已附带 `Dockerfile` 与 `docker-compose.yml`，可直接部署。

### 代码检查

```bash
cd client && npm run lint
cd server && npm run lint
```

## 架构

```text
webdesktop/
├── client/                      # Vue 3 + Vite + Naive UI
│   ├── src/apps/                # 应用层，每个目录一个相互隔离的应用
│   ├── src/os/                  # 系统层：窗口、鉴权、状态、OS API
│   ├── src/components/          # 跨应用复用的通用 UI
│   └── src/views/               # 登录、桌面外壳
└── server/                      # Express + SQLite
    ├── src/routes/              # 路由：auth / files / mounts / terminal ...
    ├── src/services/            # VFS 与文件服务（local / smb / webdav 适配器）
    ├── src/middleware/          # 鉴权、请求日志
    └── docs/                    # API 文档、开发规范、变更日志
```

依赖方向是单向的：应用只依赖通用层与 `os.api`，不得互相导入，也不得触碰 OS 内部实现。完整规则见 [`client/ARCHITECTURE.md`](client/ARCHITECTURE.md)，应用 UI 规范见 [`base-app-design.md`](base-app-design.md)。

## 内置应用

| | | |
| --- | --- | --- |
| 文件管理 | 文本编辑 | 终端 |
| 下载器 | 上传 | 传输助手 |
| 压缩包管理 | 文档预览 | 视频播放 |
| 字体预览 | 应用商店 | 任务管理器 |
| 系统设置 | 壁纸 | 属性 |
| 打开方式 | 文件选择器 | 桌面 |

## 技术栈

- **前端**：Vue 3、Vite、Naive UI、Pinia、Tailwind CSS、CodeMirror、Vue Router
- **后端**：Express 5、SQLite、JWT、sharp（缩略图）、ffmpeg（下载任务的媒体处理）
- **存储**：本地文件系统、SMB、WebDAV

## 文档

- [API 参考](server/docs/api/api-reference.md)
- [项目开发规范](server/docs/standards/project-standards.md)
- [前端工程架构](client/ARCHITECTURE.md)
- [应用设计规范](base-app-design.md)
