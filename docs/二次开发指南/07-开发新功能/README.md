# 开发新的业务功能

## 1. 需求拆分模板

先写开发清单：数据模型/迁移、后端 service、controller/route、权限、审计、前端 API、页面、i18n、测试、部署配置、回滚方式。标注哪些是新写入、兼容读取、兼容筛选和已验证项。

## 2. 推荐调用链

`route → middleware → controller → service → model`。Controller 只做参数解析和响应；Service 负责事务和业务不变量；Model 封装查询和数据库兼容。前端按 `feature` 组织，通过统一 API 实例调用，不跨层访问数据库或拼接 SQL。

## 3. 数据库变更

优先 GORM；避免数据库专属语法；SQLite 新列使用 `ADD COLUMN`；默认值不要依赖跨库不一致的布尔 default tag。新鲜数据库和最新版本升级数据库都要跑两次迁移，确认索引、约束、旧数据和幂等性。

## 4. 完成定义

至少包含成功、权限拒绝、无数据、重复请求、并发/事务失败和旧数据兼容测试；运行 `gofmt`、相关 Go 测试、前端 typecheck/lint/test/build；记录不能执行的真实环境验证，不把静态检查写成运行时证明。

