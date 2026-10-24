# 生产 Kubernetes 流水线部署

生产采用不可变 Go 镜像、Kubernetes Deployment、Service、Ingress、外部 MySQL 或 PostgreSQL、外部 Redis、HPA、PDB 和滚动发布。

## 拓扑

```text
用户 → HTTPS → Cloudflare/Load Balancer/Ingress → new-api Service → new-api Pods
                                                    ├─ MySQL 或 PostgreSQL
                                                    └─ Redis
```

数据库和 Redis 优先使用云托管服务。Kubernetes 只运行无状态 Go 应用。自建数据库需要成熟 Operator、持久卷、备份和故障切换。

## 生产配置

所有 Pod 必须共享主数据库、Redis、SESSION_SECRET 和 CRYPTO_SECRET：

```text
SQL_DSN
REDIS_CONN_STRING
SESSION_SECRET
CRYPTO_SECRET
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_TRUSTED_URL=https://console.example.com
TRUSTED_PROXIES=<Ingress 网段>
TZ=Asia/Shanghai
NODE_NAME=<Pod 名称>
```

Secret 应由 External Secrets 或云密钥管理器注入，不能提交到 Git、镜像或 CI 日志。

## Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: new-api
  labels: { app: new-api }
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels: { app: new-api }
  template:
    metadata:
      labels: { app: new-api }
    spec:
      terminationGracePeriodSeconds: 150
      containers:
        - name: new-api
          image: registry.example.com/new-api@sha256:IMAGE_DIGEST
          ports:
            - name: http
              containerPort: 3000
          envFrom:
            - secretRef: { name: new-api-secrets }
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef: { fieldPath: metadata.name }
          readinessProbe:
            httpGet: { path: /api/status, port: http }
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /api/status, port: http }
            initialDelaySeconds: 30
            periodSeconds: 10
          resources:
            requests: { cpu: 500m, memory: 1Gi }
            limits: { cpu: '2', memory: 2Gi }
```

滚动发布使用 maxUnavailable=0，确保新 Pod Ready 后再移除旧 Pod。终止宽限期应覆盖流式请求关闭时间。

## Service、Ingress 和 PDB

```yaml
apiVersion: v1
kind: Service
metadata:
  name: new-api
spec:
  selector: { app: new-api }
  ports:
    - name: http
      port: 80
      targetPort: http
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: new-api
spec:
  minAvailable: 1
  selector:
    matchLabels: { app: new-api }
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: new-api
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: '3600'
    nginx.ingress.kubernetes.io/proxy-send-timeout: '3600'
spec:
  ingressClassName: nginx
  tls:
    - hosts: [console.example.com]
      secretName: console-tls
  rules:
    - host: console.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: new-api
                port: { number: 80 }
```

Ingress 必须支持 SSE、WebSocket 和长连接。SESSION_COOKIE_TRUSTED_URL 填真实 HTTPS Origin，不要填写路径或通配符。

## HPA 自动扩缩容

集群需要 Metrics Server：

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: new-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: new-api
  minReplicas: 2
  maxReplicas: 10
  behavior:
    scaleUp: { stabilizationWindowSeconds: 0 }
    scaleDown: { stabilizationWindowSeconds: 300 }
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 65 }
    - type: Resource
      resource:
        name: memory
        target: { type: Utilization, averageUtilization: 75 }
```

HPA 只扩展 Go Pod，不会扩展数据库。数据库连接池、Redis 容量、上游渠道限制和 SSE 长连接需要单独监控。

## 完整生产流水线

```text
Pull Request → CI 前端/Go/relaykit/tokenkit
  ↓ 合并主分支
构建不可变镜像 → 推送 Registry → 生成 digest 并签名
  ↓ 部署测试 Namespace
E2E、迁移、模型和计费验证
  ↓ 版本 Tag / 审批
备份数据库 → 生产更新镜像 digest
  ↓ rollout status
健康检查、业务冒烟、监控
  ↓ 完成或按 digest 回滚
```

仓库已有 .github/workflows/ci.yml 和 docker-build.yml，可以保留现有检查与镜像构建，再增加测试 Namespace、生产审批和 Kubernetes 发布步骤。生产禁止使用 latest。

## 发布命令

```bash
docker build --pull -t registry.example.com/new-api:${GIT_SHA} .
docker push registry.example.com/new-api:${GIT_SHA}

kubectl config use-context production
kubectl -n new-api-prod set image deployment/new-api new-api=registry.example.com/new-api@sha256:<digest>
kubectl -n new-api-prod rollout status deployment/new-api --timeout=10m
kubectl -n new-api-prod get pods,hpa,pdb,svc,ingress
curl --fail-with-body https://console.example.com/api/status
```

## 数据库迁移和回滚

应用启动会执行 GORM AutoMigrate。生产发布前必须在测试库验证新建和升级、备份生产数据库，并确认迁移兼容旧版本。

PostgreSQL 备份示例：

```bash
pg_dump --format=custom --file=new-api-backup.dump "$SQL_DSN"
```

MySQL 使用 mysqldump 或云快照。数据库改动必须同时验证 SQLite、MySQL 和 PostgreSQL。Kubernetes rollout 成功不代表数据库兼容性已经证明。

```bash
kubectl -n new-api-prod rollout undo deployment/new-api
kubectl -n new-api-prod rollout status deployment/new-api --timeout=10m
kubectl -n new-api-prod set image deployment/new-api new-api=registry.example.com/new-api@sha256:<known-good-digest>
```

数据库结构变更失败时，单纯回滚镜像可能不够，必须执行兼容修复或恢复备份。

## 生产监控

监控 Ingress 5xx、延迟、连接数；Pod Ready、重启和 HPA；Go 数据库连接和 Redis 错误；模型渠道失败率、超时和 SSE 中断；额度预扣、结算和退款；数据库锁等待、慢查询、磁盘；Redis 内存和故障切换；备份与恢复演练。

## 最简生产标准

CI 通过，固定 SHA 镜像已签名，测试环境通过，数据库已备份，迁移已评估，Secret 未进入 Git，Deployment 使用 digest，探针/HPA/PDB 生效，发布后健康检查和业务冒烟通过。

