# 构建、测试与发布

## 1. 后端

根模块执行 `go test ./...`、`go build ./...`；修改 `relaykit` 或 `tokenkit` 时分别进入目录执行 `GOWORK=off go build ./...`。生产构建应固定 Go 版本、记录 commit、注入版本信息并审计依赖。

## 2. 前端

在 `web/` 执行 `bun install`、`bun run typecheck`、`bun run lint`、`bun run test`、`bun run build`。构建产物是 `web/dist`，根 Go 程序通过 embed 将其提供给 Web 路由；也可以由独立静态站点托管，但必须正确设置 API 地址和 Cookie Origin。

## 3. 镜像与发布

检查 `Dockerfile` 的构建上下文和 `web/dist` 是否存在，构建后启动容器执行 `/api/status`、登录、模型请求和健康检查。发布前备份数据库、准备回滚镜像和迁移回滚策略，不能把未验证的 schema 变更直接推到多实例集群。

## 4. 证据记录

发布记录应包含 commit、Go/Bun/数据库版本、实际执行命令、结果、未覆盖项和风险。单次 `go build` 不能替代三数据库验证、浏览器验证或上游真实联调。

