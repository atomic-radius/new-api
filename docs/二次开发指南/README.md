# New API 二次开发指南

本目录是一套面向开发、测试、运维和产品人员的源码导向课程，目标是让读者能够从“看懂项目”走到“安全地改代码、接入模型和支付、构建并部署自己的发行版”。文档以当前仓库源码为准；版本升级后请重新核对路由、配置项和依赖版本。

## 学习路线

1. [项目总览与技术栈](01-项目总览与技术栈/README.md)：目录、进程、模块边界和关键依赖。
2. [后端架构与请求链路](02-后端架构与请求链路/README.md)：Gin 路由、认证、Relay、计费、日志和后台任务；附后端模块地图、模型调用逐行链路和后台功能模块详解。
3. [前端架构与页面逻辑](03-前端架构与页面逻辑/README.md)：React、TanStack Router/Query、Zustand、表单和 i18n；附应用启动状态层、前端页面全表和模型调用前端链路。
4. [前后端联调](04-前后端联调/README.md)：本地启动、接口定位、认证、流式响应和问题排查。
5. [接入新的模型或上游](05-接入新模型或上游/README.md)：优先配置渠道，何时需要新增适配器，以及测试清单。
6. [接入支付方式](06-接入支付方式/README.md)：订单、支付回调、幂等、额度结算和安全边界。
7. [开发新的业务功能](07-开发新功能/README.md)：从需求拆分到模型、服务、控制器、路由和前端。
8. [构建、测试与发布](08-构建测试与发布/README.md)：Go、relaykit、tokenkit、Web 的验证和镜像构建。
9. [部署与生产运维](09-部署与生产运维/README.md)：Docker、Compose、数据库、Redis、反向代理和备份。
10. [Cloudflare Tunnel 与 Workers](10-Cloudflare-Tunnel与Workers/README.md)：可行的 Tunnel 架构、Worker 反向代理方案和限制。
11. [二次开发实战清单](11-二次开发实战清单/README.md)：按变更类型执行的检查表、回滚和验收标准。

## 文档中的证据边界

“源码事实”来自当前文件和配置；“验证结果”只在实际执行命令后填写。架构说明不等同于生产可用性证明，数据库改动必须按项目要求分别验证 SQLite、MySQL 和 PostgreSQL。

## 关键入口速查

| 目标 | 入口 |
| --- | --- |
| 进程启动 | `main.go`、`InitResources` |
| API 路由 | `router/api-router.go`、`router/relay-router.go`、`router/web-router.go` |
| 请求转发 | `controller/relay.go`、`relay/`、`relaykit/` |
| 数据模型 | `model/` |
| 业务服务 | `service/` |
| 管理后台 | `web/src/routes/`、`web/src/features/` |
| 配置 | `setting/`、`.env.example`、`model/option.go` |
| 异步插件 | `plugins/tasks/`、`pkg/jsplugin/` |
| 容器部署 | `Dockerfile`、`docker-compose.yml` |

