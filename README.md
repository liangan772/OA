# CROA · 协同办公系统

以**统一编制**为底座、以**通用节点**驱动流程的 OA 系统。流程系统与业务系统共用同一套组织人员数据，四类流程由同一套节点编排而成。

---

## 核心设计

### 一套编制，四处复用

`单位 → 部门 → 编制位 → 任职人员` 是全系统唯一的事实来源，同时决定：组织归属、表态人员生成、一票否决资格、数据可见范围。

- 单位与部门同在一棵组织树，用 `type` 区分，`path` 物化路径支持前缀查询整棵子树
- `rootUnitId` 标记归属单位，跨单位流转以它为边界
- 正职负责人编制位（`isLeader`）唯一，享一票否决

### 一套节点，四种流程

节点是能力组件，流程模板负责编排。新增节点类型只需实现一个 `NodeHandler` 并注册，引擎与前端配置面板自动适配。

| 节点 | 语义 | 关键行为 |
|---|---|---|
| `VOTE` 表态 | 群体决策 | 按编制规则生成表态人；负责人投否决则节点立即收敛，其余待办作废留痕 |
| `SUMMARIZE` 总结 | 收敛结论 | 读上游表决统计，按全票/多数/裁定出结论，可按结论分流 |
| `REPORT` 上报 | 跨级上行 | 在上级自动创建审批实例，本节点挂起等待回传 |
| `RETURN` 返回 | 跨级下行 | 退回下级的上报节点，下级补正后重新上报（轮次 +1） |
| `ASSIGN` 分配 | 任务派发 | 派给部门（负责人接单可转派）或个人 |
| `EXECUTE` 执行 | 落地确认 | 必须确认并填写执行说明，可带附件 |

四类流程：审议（自由发起）、审批（由上报自动发起）、执行、公示。

### 上报 / 返回构成实例树

审议与审批不是两条孤立流程，而是一棵树：

```
下级审议实例 A ──[上报节点]──▶ 上级审批实例 B（parentInstanceId = A）
        ▲                              │
        └──────[返回节点 / 否决]───────┘   退回 → A 的 round+1，生成补正待办
```

上级通过时，A 的上报节点完成并继续向后流转；上级否决或退回时，A 回到上报节点等待补正。整条链路由引擎收尾时回调父实例完成闭环。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Node 22 · NestJS 10 · Prisma 5 |
| 数据库 | PostgreSQL 16（JSONB 存表单与节点配置快照） |
| 缓存 / 锁 | Redis 7（流程推进互斥锁、登录限流、待办计数；不可用时自动降级直通） |
| 前端 | React 18 · Vite 6 · Ant Design 5 · TypeScript |
| 部署 | Docker Compose（postgres · redis · server · web） |

---

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/liangan772/OA.git
cd OA

# 可选：修改默认密码
export POSTGRES_PASSWORD=your-strong-password
export JWT_SECRET=your-jwt-secret

docker compose up -d --build

# 首次需要灌入演示数据
docker compose exec server npx ts-node prisma/seed.ts
```

访问 `http://localhost:8080`。

| 服务 | 端口 |
|---|---|
| Web（Nginx） | 8080 |
| API | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

### 方式二：本地开发

```bash
npm run install:all          # 安装前后端依赖

# 准备环境变量（仓库不提交 .env）
cp packages/server/.env.example packages/server/.env

# 启动内嵌 PostgreSQL（无需 Docker，端口 55432），保持窗口不关
npm --prefix packages/server run db:dev

# 另开终端：建表 + 灌种子数据
npm run db:reset

# 启动前后端
npm run dev                  # 后端 3001 + 前端 5173
```

访问 `http://localhost:5173`。

> 若已有 PostgreSQL，把 `packages/server/.env` 中的 `DATABASE_URL` 指过去即可，无需内嵌库。
> 未启动 Redis 时系统会自动降级（仅失去并发锁与缓存，功能不受影响）。

---

## 演示账号

密码统一 `123456`。

| 账号 | 姓名 | 编制 | 说明 |
|---|---|---|---|
| `admin` | 系统管理员 | 市局办公室主任 | 一票否决权 |
| `zhang` | 张明 | 市局监督处处长 | 一票否决权 |
| `li` | 李强 | 市局监督处科员 | |
| `chen` | 陈静 | 市局办公室副主任 | 副职，无否决权 |
| `sun` | 孙伟 | 市局综合处处长 | |
| `qian` | 钱芳 | 区局办公室主任 | |
| `wang` | 王涛 | 区局业务科科长 | 一票否决权 |
| `zhao` | 赵磊 | 区局业务科科员 | |

推荐体验路径：用 `wang` 发起「事项审议」→ `zhao`/`wang` 表态 → `wang` 总结 → 自动上报市局办公室 → 用 `admin` 审批（试试投「不同意」触发一票否决）。

---

## 项目结构

```
OA/
├─ packages/
│  ├─ server/                    NestJS 后端
│  │  ├─ prisma/schema.prisma    全部数据模型
│  │  ├─ prisma/seed.ts          演示数据（组织/编制/人员/四类流程模板）
│  │  ├─ scripts/dev-db.mjs      本地内嵌 PostgreSQL
│  │  ├─ scripts/e2e-test.mjs    端到端链路自测
│  │  └─ src/
│  │     ├─ modules/auth         登录、JWT、档案
│  │     ├─ modules/org          编制域：组织树、编制位、任职、台账
│  │     ├─ modules/flow
│  │     │  ├─ engine/           引擎主循环、编制规则解析器
│  │     │  └─ engine/nodes/     六类节点处理器
│  │     ├─ modules/biz          文档、邮件、收集表
│  │     ├─ modules/redis        缓存与分布式锁
│  │     └─ modules/health       健康检查
│  └─ web/                       React 前端
│     └─ src/pages/              工作台、发起、详情、设计器、编制、业务页
├─ docker/                       Dockerfile 与 Nginx 配置
├─ docker-compose.yml
└─ docs/方案设计.md
```

---

## 引擎要点

- **节点契约**：`enter()` 进入节点（生成待办 / 创建子实例 / 直接完成），`onTask()` 处理待办返回节点状态。引擎只认接口，不认类型。
- **配置快照**：节点实例保存发起时的配置，模板改版不影响在途流程。
- **结论分流**：总结节点通过 `config.branches` 按结论码跳转，`null` 表示流程结束。
- **并发安全**：同一实例的推进由 Redis 锁串行化；Redis 不可用时降级直通。
- **编制规则**：`DEPT_ALL / DEPT_LEADER / DEPT_MEMBERS / POSITION / USER / SUPERIOR_LEADER / CROSS_UNIT`，全部由 `AssigneeResolver` 统一解析。

---

## 端到端自测

后端启动后执行：

```bash
node packages/server/scripts/e2e-test.mjs
```

覆盖 36 项断言：发起 → 表态（含部分表态）→ 总结 → 上报 → 跨单位寻址 → 上级一票否决 → 退回补正 → 重新上报 → 上级通过 → 父流程联动结束 → 业务系统 → 权限边界。

另有一组针对「自由编排」的验证：

```bash
node packages/server/scripts/freedom-test.mjs
```

覆盖 11 项：图完整性校验（非法后继 / 自环）、非标准顺序编排保存、控制台直接发起审批流程、独立发起时返回节点作为流程终点。

---

## 健康检查

```bash
curl http://localhost:3001/api/health
# {"status":"ok","db":true,"redis":true,"redisLatencyMs":1,...}
```

`status` 为 `degraded` 表示数据库不可用。

---

## 后续可扩展

- 统一身份对接（LDAP / CAS / 企业微信）
- 表单设计器可视化拖拽（当前内容模板已由 JSON Schema 驱动，编辑器可替换）
- 附件存储切 S3 / MinIO
- 超时自动催办与自动表态定时任务
- 移动端适配
