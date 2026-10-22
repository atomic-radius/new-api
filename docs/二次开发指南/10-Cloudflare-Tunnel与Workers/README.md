# Cloudflare Tunnel 与 Workers

## 1. 先澄清部署边界

New API 是有状态的 Go/Gin 服务，需要数据库、Redis、长连接和后台任务；Cloudflare Workers 是边缘 JavaScript/Wasm 运行时，不能直接运行本仓库的 Go 二进制、GORM、Redis 连接或后台 goroutine。因此“部署在 Workers”不能理解为把整个 New API 编译成 Worker。

## 2. 推荐方案：Tunnel 暴露自建源站

```text
用户 → Cloudflare DNS/Access/WAF → cloudflared tunnel
     → Docker Compose（New API + DB + Redis）
```

在服务器运行 `cloudflared tunnel create new-api`，创建 DNS route，将 tunnel ingress 指向 `http://new-api:3000`（同 Docker 网络时）或内网地址。源站不开放公网 3000，只允许 cloudflared 出站连接；为 SSE/WebSocket 配置代理不缓冲和升级支持。支付 webhook 使用固定 HTTPS 域名并加入可信回调域名配置。

## 3. 可选方案：Worker 作为反向代理

Worker 可以根据 `fetch` 将请求转发到已经公开或通过 Access 保护的 New API 源站，适合统一域名、边缘鉴权和简单路由。必须正确转发 Authorization、Cookie、Content-Type、SSE 和 WebSocket；不要在 Worker 中缓存带用户数据的 API 响应，也不要把上游密钥放在客户端。Worker 仍不替代 Go 源站、数据库、Redis 和任务执行器。

## 4. 不适合的方案

不要把 SQLite 放在 Worker 临时文件系统；不要把支付回调、长流式响应或后台轮询误认为可由无状态 Worker 独立承载；不要通过 Worker 绕过项目的认证、额度和审计。

## 5. 发布检查

先在源站完成 Docker 健康检查，再创建 tunnel；使用浏览器和 curl 验证 `/api/status`、登录、`/v1/models`、非流/流式请求、WebSocket、支付回调和超时。记录 DNS、Tunnel、Access、WAF、源站和回滚配置。Cloudflare 规则或套餐限制导致的 413、超时、SSE 中断必须与应用错误分开定位。

