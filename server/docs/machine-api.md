# CloudGallery Machine API Documentation

This document describes the REST API endpoints for CloudGallery.
All API responses follow a standard format: `{ "success": boolean, "msg": string, "data": any }`.
Authentication is via Bearer Token in `Authorization` header, unless specified otherwise.

## Base URL
`/api` (except public routes)

## Authentication (`/auth`)
- **POST /auth/login**: Login user. Body: `{ "username": "...", "password": "..." }`. Returns `{ token, user }`.
- **POST /auth/register**: Register user. Body: `{ "username": "...", "password": "..." }`. Returns `{ id }`.
- **GET /auth/me**: Get current user info. Auth: User. Returns `{ id, username, role, ... }`.
- **PUT /auth/me**: Update user info. Auth: User. Body: `{ username?, password?, wallpaper?, ... }`.
- **POST /auth/logout**: Logout user. Auth: User.

## Users (`/users`)
- **GET /users**: List all users. Auth: Admin.
- **POST /users**: Create user. Auth: Admin. Body: `{ "username": "...", "password": "...", "role": "..." }`.
- **PUT /users/:id**: Update user (password/role). Auth: Admin.
- **DELETE /users/:id**: Delete user. Auth: Admin.

## Site Info (`/site`)
- **GET /site/siteinfo**: Get site title and user preferences. Auth: Guest (Optional). Returns `{ title, wallpaper, ... }`.

## Settings (`/settings`)
- **GET /settings**: Get all settings. Auth: Admin.
- **POST /settings**: Update setting. Auth: Admin. Body: `{ "key": "...", "value": "..." }`.
- **POST /settings/clear-cache**: Clear server cache. Auth: Admin.

## App Data (`/app-data`)
- **GET /app-data/:appId**: Get all data for an app. Auth: User.
- **GET /app-data/:appId/:key**: Get specific key data. Auth: User.
- **POST /app-data/:appId/:key**: Set/Update data. Auth: User. Body: `{ "value": ... }`.
- **DELETE /app-data/:appId/:key**: Delete data. Auth: User.

## Files (`/files`) - Mounted at `/api`
- **GET /list**: List directory contents. Auth: User. Query: `path`.
- **GET /file**: Download/View file. Auth: User. Query: `path`.
- **GET /stat**: Get file details. Auth: User. Query: `path`.
- **POST /upload**: Upload file. Auth: User. Multipart `file`, Body `path`.
- **POST /mkdir**: Create directory. Auth: User. Body: `{ "path": "parent", "name": "newDir" }`.
- **POST /save**: Save text content. Auth: User. Body: `{ "path": "...", "content": "..." }`.
- **POST /rename**: Rename file/dir. Auth: User. Body: `{ "oldPath": "...", "newName": "..." }`.
- **POST /move**: Move file/dir. Auth: User. Body: `{ "oldPath": "...", "newPath": "..." }`.
- **POST /copy**: Copy file/dir. Auth: User. Body: `{ "oldPath": "...", "newPath": "..." }`.
- **POST /delete**: Delete file/dir (to trash). Auth: User. Body: `{ "path": "..." }`.
- **POST /restore**: Restore from trash. Auth: User. Body: `{ "path": "..." }`.

## Archive (`/archive`)
- **POST /archive/compress**: Compress files. Auth: User. Body: `{ "files": [], "archiveName": "...", "parentPath": "..." }`.
- **POST /archive/extract**: Extract archive. Auth: User. Body: `{ "path": "...", "destination": "..." }`.

## Thumbnails (`/thumbnail`)
- **GET /thumbnail**: Get image thumbnail. Auth: User. Query: `path`. Returns Image Buffer.

## Search (`/search`)
- **GET /search**: Search files. Auth: User. Query: `q` (query), `path` (scope).

## Mounts (`/mounts`)
- **GET /mounts/mine**: List user mounts. Auth: User.
- **POST /mounts/mine**: Add mount. Auth: User. Body: `{ "mountPoint": "...", "type": "local", "localPath": "..." }`.
- **PUT /mounts/mine/:id**: Update mount. Auth: User.
- **DELETE /mounts/mine/:id**: Delete mount. Auth: User.

## Favorites (`/favorites`)
- **GET /favorites**: List favorites. Auth: User.
- **POST /favorites**: Add favorite. Auth: User. Body: `{ "path": "..." }`.
- **DELETE /favorites**: Remove favorite. Auth: User. Query: `path`.

## Shares (`/shares`)
- **GET /shares**: List active shares. Auth: User.
- **POST /shares**: Create share link. Auth: User. Body: `{ "path": "..." }`. Returns `{ linkId, url }`.
- **DELETE /shares/:id**: Delete share link. Auth: User.

## Public (`/s`)
- **GET /s/:id**: Access shared file. Auth: Public. Returns File Buffer.

## Logs (`/logs`)
- **GET /logs**: Get system logs. Auth: Admin. Query: filters.

## Dashboard (`/dashboard`)
- **GET /dashboard/stats**: Get system stats (cpu, memory, disk). Auth: Admin.

## Terminal (`/terminal`)
- **POST /terminal/exec**: Execute command. Auth: Admin. Body: `{ "cwd": "...", "command": "..." }`.
