# 前端架构与页面逻辑

页面逐一索引见同目录的 `01-应用启动与状态层.md`、`02-前端页面全表.md` 和 `03-模型调用前端链路.md`。页面路由文件通常是薄壳，真正的表格、请求、表单和交互位于对应 `web/src/features/`；因此文档同时列出 route 文件和 feature 入口。

阅读顺序建议：先看 `01` 理解 React 挂载、认证、Axios 和 Query，再看 `02` 按路由定位每个页面，最后看 `03` 将 Playground 的发送按钮与后端模型链路对齐。

## 1. 启动与路由

`web/package.json` 使用 Bun 和 Rsbuild；开发命令是 `bun run dev`，生产构建是 `bun run build`。TanStack Router 的文件路由位于 `web/src/routes/`，认证布局通过 `beforeLoad` 和布局路由保护，页面业务通常位于 `web/src/features/`。

## 2. 数据流

```text
Route loader/component
        ↓
React Query useQuery/useMutation
        ↓
统一 Axios api 实例（withCredentials）
        ↓
Gin API → JSON 响应
        ↓
缓存失效、表格/表单状态更新、toast
```

全局客户端状态使用 Zustand；服务端数据使用 TanStack Query，不要把远程列表长期复制到 Zustand。表单使用 React Hook Form + Zod，服务端错误映射到字段或统一错误处理器。

## 3. 新页面步骤

1. 先搜索 `web/src/components/` 和相邻 feature，复用 `Dialog`、`ConfirmDialog`、`DataTable`、`CopyButton` 等现有业务组件。
2. 在 feature 内定义 `types.ts`、`api.ts`、`lib/schema.ts` 和组件。
3. 为用户可见文本调用 `t('English source key')`，并同步七种 locale。
4. 使用 React Query 的唯一 `queryKey`，Mutation 成功后精确失效相关查询。
5. 添加用户行为测试、无数据/加载/错误/禁用状态测试，再执行 typecheck、lint 和构建。

## 4. 前端安全

不要在 localStorage 保存敏感 token；不要把 Axios 完整错误对象输出到控制台；危险操作使用共享确认组件；前端权限只改善体验，最终校验必须在后端。

