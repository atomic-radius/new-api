# 二次开发实战清单

## 设计阶段

- [ ] 写清用户场景、权限边界、数据不变量和回滚方式。
- [ ] 定位真实调用链和复用组件，避免重复实现。
- [ ] 判断是否触及计费、认证、数据库、插件或协议转换规则。

## 实现阶段

- [ ] 后端按 route/controller/service/model 分层。
- [ ] JSON 使用根模块 `common.*` 包装函数；relaykit 使用 `kitutil.*`。
- [ ] 新字段考虑旧数据、空值、显式零值和三数据库。
- [ ] 前端使用现有业务组件、React Query、Zod 和 i18n。
- [ ] 密钥、密码、验证码、session/token 不进入日志。

## 验证阶段

- [ ] 运行受影响的 Go 测试和 `go build ./...`。
- [ ] relaykit/tokenkit 分别 `GOWORK=off go build ./...`。
- [ ] 前端运行 typecheck、lint、相关测试和 production build。
- [ ] 数据库改动覆盖 SQLite、MySQL、PostgreSQL；迁移执行两次并验证升级数据。
- [ ] 测试成功、权限、边界、失败、超时、重试、幂等和回滚。

## 发布阶段

- [ ] 备份数据库和配置，固定镜像/commit，准备回滚。
- [ ] 验证 `/api/status`、登录、模型、流式、后台任务和支付回调。
- [ ] 若使用 Cloudflare，分别验证 Tunnel、Worker、Access、WAF、SSE/WebSocket 和真实客户端。
- [ ] 在发布记录中区分源码静态结论、编译结果、测试结果和未验证的外部依赖。
