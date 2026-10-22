# 项目总览与技术栈

## 1. 产品定位

New API 是自托管 AI 网关：客户端使用统一的 OpenAI、Anthropic、Gemini 等协议访问，服务端负责鉴权、渠道选择、协议转换、重试、流式传输、额度预扣与结算、日志和管理后台。

## 2. 运行时分层

```text
浏览器/业务客户端
        │ HTTP、SSE、WebSocket
        ▼
Gin Router → Middleware → Controller
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
    Service           Relay/RelayKit     Model/GORM
       │                 │                 │
       └────────────── Redis/缓存 ──────── DB
                         │
                    上游 AI Provider
```

`main.go` 初始化环境、数据库、缓存、路由和后台任务；`router/` 只负责路径与中间件组合；`controller/` 负责 HTTP 输入输出；`service/` 承载业务规则；`model/` 负责持久化；`relay/` 负责向上游发送请求；`relaykit/` 是独立的协议转换模块；`tokenkit/` 是独立的 token 估算模块。

## 3. 技术栈

- 后端：Go 1.26、Gin、GORM v2、Redis、SQLite/MySQL/PostgreSQL，日志可使用 ClickHouse。
- 前端：React 19、TypeScript、Rsbuild、TanStack Router/Query/Table、Zustand、React Hook Form、Zod、Tailwind CSS 4、Bun。
- 协议：OpenAI Chat/Responses、Anthropic Messages、Gemini，以及图片、音频、Embedding、Rerank、Realtime 等扩展。
- 安全：会话、API Token、JWT、OAuth/OIDC、WebAuthn/Passkey、TOTP、Casbin。
- 扩展：`plugins/tasks` 中的 JavaScript 任务插件由 moejs 执行。

## 4. 模块边界

`relaykit` 和 `tokenkit` 是独立 Go module，必须能够在目录内执行 `GOWORK=off go build ./...`。不要让它们反向依赖根模块、数据库或宿主配置。新增功能时先判断属于协议转换、计费、业务服务还是 UI，避免把业务规则塞进 Relay 转换层。

## 5. 数据与缓存

主数据库保存用户、渠道、令牌、订单、订阅、日志索引等；Redis 用于缓存、限流和跨实例协调；内存缓存用于热点配置。日志数据库可以与主库分离。任何 schema、锁、索引或序列化变更都需要三数据库验证。

