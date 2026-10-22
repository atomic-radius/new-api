# 前后端联调

## 1. 本地启动

后端：准备 Go、数据库和 Redis，复制 `.env.example` 中需要的配置，运行 `go run .` 或使用 Docker。前端：在 `web/` 执行 `bun install`、`bun run dev`。以浏览器 Network 面板确认 API base URL、Cookie、状态码和响应体。

## 2. 调试一个管理接口

从页面按钮反查组件 → `useQuery/useMutation` → `api` 调用 → `router/api-router.go` → controller → service → model。先用浏览器复制请求，再用 PowerShell `Invoke-RestMethod` 或 curl 重放，区分前端渲染问题、认证问题、业务校验问题和数据库问题。

## 3. 调试流式 Relay

使用支持 SSE 的客户端，检查 `Content-Type`、分块是否持续到达、是否有代理缓冲、是否在末尾发送 usage。对上游失败分别记录 HTTP 状态、渠道 ID、重试次数和最终客户端错误，但隐藏 key 和 Authorization。

## 4. 联调验收

- 管理员登录、普通用户权限和 API Token 均验证。
- 新旧数据、缺失字段、显式 0/false 均验证。
- 非流、流式、超时、上游 4xx/5xx、重试和退款路径验证。
- 浏览器七种语言至少抽查新增 key；前端 typecheck/lint/build 通过。

