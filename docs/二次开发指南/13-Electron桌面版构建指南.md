# Electron 桌面版构建指南

本文档根据 `electron/README.md`、`electron/build.sh`、`electron/package.json` 和 `electron/main.js` 整理。

## 1. 桌面版架构

Electron 是桌面外壳，业务仍由 Go 后端和 React 前端完成。生产安装包包含 Electron 主进程、Go 二进制、图标、托盘资源和许可证文件。

```text
Electron 主进程
  ├─ 启动 Go 后端
  ├─ 创建窗口和系统托盘
  ├─ 处理退出、重启和错误日志
  └─ 加载本机 3000 端口

Go 后端
  ├─ /api/* 管理接口
  ├─ /v1/* 模型接口
  ├─ /pg/* Playground 接口
  └─ 数据库、认证、计费和渠道转发
```

## 2. 构建前提

需要安装 Go、Bun、Node.js、npm、Git 和 C 编译器。macOS 需要 Xcode Command Line Tools；Windows 需要 MinGW/clang；Linux 需要 Electron Builder 所需系统库。

```powershell
go version
bun --version
node --version
npm --version
git --version
```

打包前必须在仓库根目录生成同平台后端：

```text
Windows: new-api.exe
macOS/Linux: new-api
```

## 3. Windows 构建

### 3.1 构建前端

```powershell
cd Y:\project\new-api\new-api\web
bun install --frozen-lockfile
$env:VITE_REACT_APP_VERSION = (git describe --tags --always)
bun run build
```

生成 `web/dist/`。

### 3.2 编译 Go 后端

```powershell
cd Y:\project\new-api\new-api
$env:CGO_ENABLED = '1'
go build -ldflags='-s -w' -o new-api.exe .
```

`-s -w` 用于减小二进制。若没有 moejs 的 `default.pgo`，不要传入错误的 `-pgo` 路径，直接省略即可。

### 3.3 打包 Electron

```powershell
cd Y:\project\new-api\new-api\electron
npm ci
npm run build:win
```

该命令等价于 `npx electron-builder --win`。输出在 `electron/dist/`，默认包含 NSIS 安装程序和 Portable 便携版。

## 4. macOS/Linux 构建

macOS：

```bash
cd /path/to/new-api/web
bun install --frozen-lockfile
VITE_REACT_APP_VERSION="$(git describe --tags --always)" bun run build
cd ..
CGO_ENABLED=1 go build -ldflags="-s -w" -o new-api .
cd electron
npm ci
npm run build:mac
```

生成 `.dmg` 和 `.zip`。当前配置没有自动签名身份，正式发布还需要 Apple Developer 签名和公证。

Linux 使用同样的前端和 Go 步骤，最后执行：

```bash
npm run build:linux
```

生成 `.AppImage` 和 `.deb`。

## 5. 自动脚本

`electron/build.sh` 会自动完成前端构建、Go 编译、npm 依赖安装和 Electron 打包。

```bash
cd /path/to/new-api/electron
chmod +x build.sh
./build.sh
```

Windows 原生 PowerShell 不直接执行 Bash 脚本，可使用 Git Bash、MSYS2 或 WSL；Windows 原生环境更推荐按第三节逐步执行。

## 6. 开发模式

Electron 开发模式不会自动启动 Go 和前端服务，需要分别启动：

终端一：

```powershell
cd Y:\project\new-api\new-api
go run main.go
```

终端二：

```powershell
cd Y:\project\new-api\new-api\web
bun run dev
```

终端三：

```powershell
cd Y:\project\new-api\new-api\electron
npm run dev-app
```

Go 使用 `3000`，Rsbuild 使用 `5173`。开发模式下 `main.js` 只检查 `5173`，不会替开发者启动 Go。

## 7. 生产启动链路

```text
启动桌面程序
  ↓ 查找 resources/bin/new-api(.exe)
  ↓ 创建用户数据目录并设置 SQLITE_PATH
  ↓ 启动 Go 子进程
  ↓ 轮询 127.0.0.1:3000
  ↓ 创建 BrowserWindow 加载本地服务
```

`package.json` 的 `extraResources` 会把根目录的后端复制到安装包 `resources/bin/`，所以必须使用正确平台和 CPU 架构的二进制。

## 8. 数据目录

生产模式默认数据库位置：

```text
Windows: %APPDATA%/New API/data/new-api.db
macOS:   ~/Library/Application Support/New API/data/new-api.db
Linux:   ~/.config/New API/data/new-api.db
```

备份前先退出应用，再备份 `new-api.db`，并处理可能存在的 `-wal`、`-shm` 文件。不要只备份 `electron/dist`。

## 9. 构建验证

```powershell
cd web
bun run typecheck
bun run build
cd ..
go test ./...
go build -o new-api.exe .
cd electron
npm ci
npm run build:win
```

安装包至少验证：能安装和卸载、能显示登录页、Go 能监听 3000、数据库能写入、渠道和聊天功能正常、托盘和退出行为正常、重启后数据仍存在。

## 10. 常见问题

### 找不到 `new-api.exe`

先在根目录执行：

```powershell
go build -o new-api.exe .
```

再进入 `electron` 执行 `npm run build:win`。

### 3000 端口被占用

```powershell
netstat -ano | findstr :3000
```

关闭占用程序，或同时修改 `electron/main.js` 和 Go 服务端口。

### 开发模式白屏

```powershell
Invoke-WebRequest http://127.0.0.1:3000
Invoke-WebRequest http://127.0.0.1:5173
```

两个地址都必须可访问。

### CGO 编译失败

```powershell
go env CGO_ENABLED GOOS GOARCH
where.exe gcc
```

应安装与 Go 和目标架构匹配的 C 编译器，不建议把 `CGO_ENABLED=0` 当最终方案。

### 修改前端后桌面版仍是旧页面

桌面版使用 Go 中嵌入的 `web/dist`，必须重新执行：

```text
前端 bun run build
→ Go go build
→ Electron npm run build:win
```

只重新打包 Electron 而不重新构建前端和 Go，可能继续使用旧资源。

## 11. 最简 Windows 发布命令

```powershell
cd Y:\project\new-api\new-api\web
bun install --frozen-lockfile
$env:VITE_REACT_APP_VERSION = (git describe --tags --always)
bun run build
cd ..
$env:CGO_ENABLED = '1'
go build -ldflags='-s -w' -o new-api.exe .
cd electron
npm ci
npm run build:win
```

最终安装包位于 `Y:\project\new-api\new-api\electron\dist\`。

## 12. 结论

桌面版是 `React web/dist + Go new-api(.exe) + Electron 窗口/托盘/安装配置` 的组合。任何前端或后端改动，都应重新构建前端、重新编译 Go，再重新执行 Electron Builder。
