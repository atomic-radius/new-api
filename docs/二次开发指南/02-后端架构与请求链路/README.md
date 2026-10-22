# 后端架构与请求链路

本章说明“请求经过哪些文件、每个函数改变了什么状态”。逐行索引见同目录的 `01-后端模块地图.md`、`02-模型调用逐行链路.md` 和 `03-后台功能模块.md`。由于仓库超过数千个业务文件，本文按真实入口和调用链覆盖每一层关键代码；没有把未参与该链路的第三方适配器伪装成已逐行审计。

阅读顺序建议：先看 `01` 建立目录地图，再看 `02` 跟一条 `/v1/chat/completions`，最后用 `03` 按功能域扩展到用户、渠道、支付、任务和运维。

## 1. 启动链路

`main.go` 的 `main` 先处理插件 CLI 分支，再调用资源初始化，设置 Gin 模式、日志和信号处理，最后启动 HTTP 服务。`InitResources` 负责数据库、i18n、缓存、渠道缓存、任务和权限等基础设施。修改启动顺序时要考虑迁移必须先于请求接收。

## 2. 一次聊天请求

以 `POST /v1/chat/completions` 为例：

1. `router/relay-router.go` 匹配协议路径并选择 `RelayFormatOpenAI`。
2. 认证、限流、CORS、请求体限制等 middleware 先执行。
3. `controller.Relay` 解析请求，读取 API Token、用户和组权限。
4. Relay 根据模型映射、渠道状态、优先级/权重挑选上游 Channel。
5. 请求转换为目标协议，注入上游 key、URL 和必要 headers。
6. 非流式响应直接转换；流式响应逐 chunk 转换为客户端协议并刷新连接。
7. 根据上游 usage 或 token 估算完成扣费、日志和缓存更新；失败时执行重试、退款或错误映射。

## 3. 关键目录职责

| 目录 | 责任 | 修改时注意 |
| --- | --- | --- |
| `router/` | 路由和 middleware 组合 | 不在路由层写业务规则 |
| `controller/` | HTTP DTO、状态码和响应 | 统一使用 `common` JSON 包装函数 |
| `service/` | 业务编排、计费、任务 | 保证事务、幂等和错误语义 |
| `model/` | GORM 模型、查询、迁移 | 兼容三种数据库，行锁用 `lockForUpdate` |
| `relay/` | 上游请求、响应、流处理 | 不丢失显式 0/false 等可选值 |
| `relaykit/` | 独立协议 DTO/转换 | `GOWORK=off go build ./...` |
| `middleware/` | 鉴权、审计、限流、CORS | 不把 token/密码写入日志 |

## 4. 错误与日志

客户端错误通过统一响应结构和 `common.Message` 传递；服务端日志使用 `common.LogText`，日志中不得出现密码、验证码、私钥、可用 session/API token。新增错误时同时考虑英文源文案、后端 locale 和前端 locale。

## 5. 后台任务

渠道同步、缓存刷新、任务插件轮询、超时退款等由后台 goroutine/任务机制执行。新增任务必须定义停止策略、超时、重试上限、幂等键和部署多实例时的协调方式。

