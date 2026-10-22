# Playground 历史会话改造说明

## 1. 改造目标

Playground 原先将消息和参数主要保存在浏览器 `localStorage`，后端 `/pg/chat/completions` 只负责一次模型调用，不存在服务端会话。此次改造将 Playground 变为服务端会话功能，支持：

- 自动创建首个会话；
- 新建会话；
- 会话列表；
- 切换会话并加载历史消息；
- 删除会话；
- 当前会话消息持久化；
- 继续复用原有流式/非流式模型调用、计费和权限链路；
- 首次迁移时读取旧浏览器中的 Playground 消息，导入为首个服务端会话。

## 2. 后端修改

### 2.1 数据模型

新增文件：`model/playground_conversation.go`。

新增 `PlaygroundConversation`：

| 字段 | 作用 |
| --- | --- |
| `ID` | 会话主键 |
| `UserID` | 所属用户，所有查询均带用户条件 |
| `Title` | 会话标题，默认 `New conversation`，首次用户消息会更新为标题 |
| `Model` | 最近使用的模型 |
| `Group` | 最近使用的分组 |
| `Messages` | JSON 字符串，保存 Playground 消息数组 |
| `CreatedAt` | 创建时间 |
| `UpdatedAt` | 最近更新时间 |

消息使用 `TEXT` 而不是数据库原生 JSON 类型，以保持 SQLite、MySQL 和 PostgreSQL 的兼容性。服务端限制单个会话消息 JSON 不超过 2 MiB，并验证内容必须是 JSON 数组。

### 2.2 自动迁移

在 `model/main.go` 的主库 `AutoMigrate` 列表中加入 `&PlaygroundConversation{}`。启动时会创建/升级 `playground_conversations` 表。

### 2.3 会话模型方法

`model/playground_conversation.go` 提供：

- `CreatePlaygroundConversation`
- `ListPlaygroundConversations`
- `GetPlaygroundConversation`
- `UpdatePlaygroundConversation`
- `DeletePlaygroundConversation`

所有读取、更新和删除均使用 `user_id = ? AND id = ?`，避免用户通过修改 ID 读取或删除其他用户的会话。

### 2.4 API 路由

在 `router/api-router.go` 新增用户认证路由：

```text
GET    /api/playground/conversations
POST   /api/playground/conversations
GET    /api/playground/conversations/:id
PUT    /api/playground/conversations/:id
DELETE /api/playground/conversations/:id
```

路由统一使用 `middleware.UserAuth()` 和 `middleware.DisableCache()`。

### 2.5 Controller

新增文件：`controller/playground_conversation.go`。

Controller 负责：

- 解析会话 ID；
- 解析 JSON body；
- 从 Gin context 获取当前用户 ID；
- 把 GORM not found 转成 404；
- 把非法参数转成 400；
- 使用项目统一的 `common.ApiSuccess` / `common.ApiError` 响应结构。

API 响应格式示例：

```json
{
  "success": true,
  "message": "",
  "data": {
    "id": 1,
    "user_id": 10,
    "title": "介绍一下项目",
    "model": "gpt-4o",
    "group": "default",
    "messages": "[...]",
    "created_at": 1770000000,
    "updated_at": 1770000010
  }
}
```

## 3. 前端修改

### 3.1 类型

在 `web/src/features/playground/types.ts` 新增 `PlaygroundConversation`，对应后端会话字段。

### 3.2 API 封装

在 `web/src/features/playground/api.ts` 新增：

- `listPlaygroundConversations`
- `createPlaygroundConversation`
- `getPlaygroundConversation`
- `updatePlaygroundConversation`
- `deletePlaygroundConversation`

消息数组在前端序列化为 JSON 字符串传给后端，保持现有 `Message[]` 结构和流式消息处理逻辑不变。

### 3.3 状态管理

`use-playground-state.ts` 现在管理：

```text
conversations             会话列表
activeConversationId      当前会话 ID
messages                  当前会话消息
isLoadingConversations    会话列表/首个会话加载状态
isLoadingMessages         当前消息加载状态
```

初始化流程：

```text
GET 会话列表
    ↓
没有会话？创建一个新会话
    ↓
读取旧 localStorage 消息（仅首次迁移）
    ↓
GET 首个会话详情
    ↓
解析 messages JSON
    ↓
渲染当前会话
```

消息变化后使用 500 ms debounce 调用 `PUT /api/playground/conversations/:id`，避免流式响应每个 chunk 都写数据库。前端会先更新列表中的标题、模型、分组和更新时间，使列表立即反映当前状态。

### 3.4 会话列表 UI

新增：`web/src/features/playground/components/conversation-list.tsx`。

该组件提供：

- 会话列表；
- 当前会话高亮；
- 新建按钮；
- 切换会话；
- 删除按钮；
- 使用项目现有 `ConfirmDialog` 做删除确认；
- 使用项目现有 `Button`、`ScrollArea` 和 i18n。

### 3.5 Playground 布局

`web/src/features/playground/index.tsx` 改为：

```text
ConversationList  |  PlaygroundChat
                  |  PlaygroundInput
```

新建会话后清空当前消息并切换到新会话；删除当前会话后自动切换到剩余会话；删除最后一个会话时自动创建替代会话，保证 Playground 始终有可用工作区。

## 4. 模型调用链的变化

模型调用主链路没有被绕开：

```text
前端当前会话 messages
    ↓
POST /pg/chat/completions
    ↓
controller.Playground
    ↓
controller.Relay
    ↓
RelayInfo / 预扣费 / Channel 选择
    ↓
上游模型
    ↓
SSE 或非流式响应
    ↓
前端更新当前会话 messages
    ↓
PUT /api/playground/conversations/:id
```

会话 API 只负责保存和管理历史，模型调用仍走原有计费、权限、渠道选择、重试、退款和日志机制。

## 5. 兼容和安全边界

- 旧版 Playground 的 `localStorage` 配置继续保存模型参数和参数开关。
- 旧版本地消息只在服务端会话列表为空时导入一次，不会覆盖已有服务端历史。
- 会话消息按用户隔离；不能通过 URL 中的 ID访问其他用户数据。
- 消息内容限制为 2 MiB，避免无界写入数据库。
- 会话删除使用服务端删除，不依赖前端隐藏。
- 前端不把 API Key 写入会话消息；模型请求仍使用原有认证机制。
- 清空消息只清空当前会话内容；删除会话才删除会话记录。

## 6. 验证结果

已完成：

- `gofmt` 格式化后端修改文件；
- `bun run typecheck`：通过；
- `git diff --check`：无空白错误；
- Go 包测试已启动，`model` 包已通过。

当前环境中 Go 测试使用默认缓存目录时出现 `Access is denied`，改用仓库内临时 `GOCACHE` 后继续执行；controller/router 测试耗时较长，最终结果需在完整命令结束后补录。

## 7. 后续建议

## 8. 超级管理员会话管理

为满足运营和审计需求，新增管理员专用的“会话”侧边菜单与管理页面。该菜单使用 `/admin-conversations` 路由，管理员（`ROLE.ADMIN`）和超级管理员均可显示和访问。

后端新增管理接口：

```text
GET    /api/admin/playground/conversations
GET    /api/admin/playground/conversations/:id
PUT    /api/admin/playground/conversations/:id
DELETE /api/admin/playground/conversations/:id
```

这些接口统一挂载 `AdminAuth()`，服务端按会话 ID 查询，不依赖前端权限判断。列表支持 `p`、`page_size`、`user_id` 和 `keyword` 参数，可按用户 ID 筛选，也可搜索标题、模型和分组。管理员可以查看完整消息 JSON、修改会话标题和消息内容、删除会话；所有修改仍经过消息数组格式校验和 2 MiB 限制。

前端页面位于 `web/src/features/admin-conversations/`，左侧展示所有用户会话，右侧展示选中会话的消息 JSON，并提供保存、删除操作。侧边栏配置增加 `admin.conversations` 模块，系统设置中的侧边栏管理也可以单独启用或关闭该菜单。

安全边界：浏览器中隐藏菜单不构成安全控制，真正的权限边界由 `AdminAuth()` 和后端路由实现。管理员页面只展示会话所属用户 ID，后续如需展示用户名，建议增加只读用户摘要 DTO，避免把用户密码、令牌等敏感字段带入响应。

当前实现把完整消息数组作为一个 JSON 文本保存，适合中小规模 Playground。若后续需要大量会话、消息分页、全文搜索、单条消息删除、消息版本和附件管理，应进一步拆分为：

```text
playground_conversations
playground_messages
```

并在流式完成后保存 assistant 消息，而不是更新整段消息 JSON。

