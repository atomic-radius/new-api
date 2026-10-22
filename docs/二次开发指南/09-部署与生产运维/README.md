# 部署与生产运维

## 1. Docker Compose

仓库 `docker-compose.yml` 默认编排 New API、PostgreSQL 和 Redis，并提供 MySQL、ClickHouse 日志库示例。生产环境必须替换示例密码，设置持久化 `SESSION_SECRET`，挂载 `/data` 和日志目录，限制暴露端口，并配置健康检查。

## 2. 数据库选择

SQLite 适合单实例和开发；PostgreSQL/MySQL 适合生产和多实例。日志可使用独立数据库或 ClickHouse。连接池、时区、备份、迁移和恢复演练必须纳入运维方案。

## 3. 反向代理

Nginx/Caddy/负载均衡器负责 TLS、真实 IP、SSE 禁止缓冲和 WebSocket upgrade。同步设置 `TRUSTED_PROXIES`，不要为了“修复 IP”信任所有代理。HTTPS 场景设置 `SESSION_COOKIE_SECURE=true` 和精确的 `SESSION_COOKIE_TRUSTED_URL`。

## 4. 监控与故障处理

监控 `/api/status`、进程、数据库连接、Redis、请求延迟、上游错误率、队列积压和余额异常。故障排查顺序：入口代理 → 应用日志 → 数据库/Redis → 渠道健康 → 上游响应。敏感日志必须脱敏。

