<h1 align="center">PlanWeave — LAN 团队协作 Fork</h1>

<p align="center">
  为 PlanWeave 增加的、服务器协调的多人协作层，配 Codex 风格的桌面端外壳。
  本 fork 在 upstream 单机文件驱动的循环之上，新增了权威状态、身份、提案、Work lease、事件流与 Git merge queue。
</p>

<!-- planweave-badges:start -->
<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.2.1-orange?style=for-the-badge" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-yellow.svg?style=for-the-badge" />
  <img alt="language" src="https://img.shields.io/badge/language-TypeScript-3178c6?style=for-the-badge" />
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Node.js-43853d?style=for-the-badge" />
  <img alt="desktop" src="https://img.shields.io/badge/desktop-Electron-47848f?style=for-the-badge" />
  <img alt="agents" src="https://img.shields.io/badge/agents-Codex%20%7C%20Claude%20Code%20%7C%20OpenCode%20%7C%20Pi-6f42c1?style=for-the-badge" />
</p>
<!-- planweave-badges:end -->

---

## 0. 相对 upstream 做了哪些改动

> 上游基线：`GaosCode/PlanWeave` @ `6a5dbb1 docs(readme): mention skills in quick start`。
> 本 fork：领先 20 个 commit，**+15,553 / −155 行，142 个文件**。

| 范围 | 改动 | 代码位置 |
|---|---|---|
| **新增 `packages/server`** | axum + `node:sqlite` (WAL) 权威协调器。八个内部模块：`identity` / `planning` / `proposals` / `work` / `events` / `agents` / `git` / `audit`。独立的 HTTP `/api/collaboration` 监听 + WebSocket 同步。 | `packages/server/src/**` |
| **事务性 work 协调** | 任务、assignments、leases、heartbeat、submissions、reviews。通过 partial unique index 强制"每个任务同一时刻只有一个 active assignment"不变量。Lease 过期回收。Idempotency key + `expectedVersion` 乐观并发。 | `packages/server/src/work/` |
| **身份与会话** | 用户、设备、邀请码、可吊销的 session、项目成员。Token 化加入。 | `packages/server/src/identity/` |
| **规划室与提案** | 规划室、消息、附件元数据、不可变的提案修订、审批策略、投票、生命周期跃迁。 | `packages/server/src/{planning,proposals,attachments}/` |
| **持久事件 + WebSocket** | 仅追加的 `domain_events`，通过 `ws 8.x` 暴露 `EventEnvelopeV1` 投影。支持断线重连的 resync cursor。 | `packages/server/src/events/` |
| **Git merge queue** | 裸集成仓库 + 隔离 worktree。所有权路径校验（拒绝 `events-rogue/**` 这类前缀歧义）。串行合并，依次走身份 / 祖先 / 路径 / 检查 / Agent / 人工 评审。 | `packages/server/src/git/` |
| **Runtime parity** | `packages/runtime` 在写入边界拆出 `FileRuntimeRepository` ↔ `SqliteRuntimeRepository`，让服务端模式是 source of truth，文件模式照常工作。 | A5 commit |
| **Coordinator Agent** | artifact / checkpoint 持久化、取消、重试。可插拔 provider 接口；首个真实 provider 需等待持久化工作就绪。 | `packages/server/src/agents/` |
| **CLI 远程模式** | `planweave server start\|join\|list\|forget\|project`、`planweave remote task\|merge-queue` 等。 | `packages/cli/src/commands/remote*.ts` |
| **桌面端 Team Mode** | 内嵌 Mode 切换（Personal / Team）。Host / Member 角色选择；本机 `localTeamHost` 一键启服务；连接 profile；规划室、提案、事件同步；角色徽章。 | `packages/desktop/src/renderer/team/`、`packages/desktop/src/main/localTeamHost.ts` |
| **Codex 风格 UI 整改** | 紧凑常驻侧栏 + brand header；Personal/Team 模式切换 + 角色徽章；向上弹出 Settings 下拉（5 个分区）；可拖拽的浮动组件面板 + 悬停展开；`view-enter` 路由过渡；语义化色彩 token（亮 / 暗 / 跟随系统）。 | `packages/desktop/src/renderer/{sidebar,AppSidebars,AppSettingsRoute,views,index.css}` |
| **i18n zh-CN** | 覆盖率达到 **98.8%**，附 Codex 风格动画。 | `packages/desktop/src/renderer/i18nZhCn.ts` |
| **worktree 残留清理延后** | `.worktrees/` 下的 A1–A9 worktree 仍在（已合入 main）。 | follow-up |

upstream 原始的 README 不再是本 fork 的真相来源。旧的 zh-CN 译文见 `readme/README.zh-CN.md`。

---

## 1. 架构

```mermaid
flowchart LR
  subgraph Local["成员本机"]
    D[桌面应用<br/>Electron + React]
    C[CLI<br/>planweave]
    R[Runtime<br/>文件驱动]
    G[本地 Git worktree]
  end

  subgraph Server["LAN 协作服务器（本 fork 新增）"]
    H[Collaboration HTTP<br/>/api/collaboration]
    W[WebSocket<br/>/ws/collaboration]
    S[(SQLite WAL<br/>权威存储)]
    CO[Coordinator Agent]
    MQ[Git merge queue<br/>+ 裸仓库]
  end

  D -->|HTTPS + WSS| H
  C -->|HTTPS + WSS| H
  H --> S
  W --> S
  CO --> S
  MQ --> G
  G -->|push commit| MQ
  R -. projection .-> S
```

### 权威模型

- **服务器是协作状态的唯一写入者**。所有写操作都在显式 `BEGIN IMMEDIATE` 事务里跑。
- 每个聚合都带单调递增的 `version`。过期命令会以 `version_conflict` 失败。
- 每个客户端命令都带 `idempotencyKey`（16–128 个 ASCII 字符）。重放会返回缓存结果。
- 领域行写入 + idempotency 行 + `domain_events` 追加 + `audit_log` 追加共用一个事务（见 `packages/server/src/store.ts:executeIdempotent`）。
- Runtime 领域逻辑**不允许 import 服务端**。`packages/runtime` 写入边界拆为 `FileRuntimeRepository`（默认）与 `SqliteRuntimeRepository`（server 模式）。A1–A5 在每次 merge 后保持单机模式仍可跑。

### 服务端模块（`packages/server/src/`）

| 模块 | 职责 |
|---|---|
| `identity/` | 用户、设备、邀请码、session、成员、权限 |
| `planning/` | 规划室、消息、附件元数据、artifact 引用 |
| `proposals/` | 不可变修订、审批策略、投票、生命周期 |
| `work/` | 任务、assignment、lease、heartbeat、submission、review、reclaim |
| `events/` | 持久事件流、WebSocket publisher、resync cursor、HTTP 可用性 |
| `agents/` | coordinator run、输入输出、预算、取消、重试 |
| `git/` | 裸仓库、worktree 生命周期、ownership 校验、merge queue、check |
| `audit/` | 仅追加的动作历史 |
| `attachments/` | 上传元数据、digest、size 检查、BOLA 防护 |
| `collaborationApi.ts` | 八个模块的 HTTP 路由 |
| `lifecycle.ts` | `startPlanweaveServer`、启动 reconciliation、优雅关停 |
| `store.ts` | SQLite handle、migrations runner、`executeIdempotent` |
| `config.ts` | 环境变量驱动的配置、端口 / 数据目录 / join token / busy timeout |

### 桌面端分层

```
┌─────────────────────────────────────────────────────────────────┐
│  侧栏（Codex 风格）                                              │
│  ├─ PlanWeave brand 头 + 折叠 / 后退 / 前进                     │
│  ├─ Mode: Personal / Team（带角色徽章）                         │
│  ├─ Team 子导航（Team 模式时）：规划室 / 流程图 / 团队任务 /    │
│  │     提案 / 成员                                               │
│  ├─ 本地导航：新建任务 / 流程图 / 画布地图 / 待办 / 搜索 /      │
│  │     通知                                                       │
│  └─ 底部：设置（向上弹出下拉）/ 重置布局                        │
├─────────────────────────────────────────────────────────────────┤
│  主显示区                                                        │
│  ├─ Personal 模式 → WorkspaceTabs（graph / canvas / todo / …） │
│  ├─ 设置视图  → AppSettingsRoute（5 个分区）                     │
│  └─ Team 模式  → TeamModeShell（内嵌，占满主区）                │
│                  ├─ 选择 host / member 角色                      │
│                  ├─ 本机 team host 启动                          │
│                  └─ 当前项目 shell                                │
├─────────────────────────────────────────────────────────────────┤
│  浮动组件面板（可拖拽、悬停展开）                                │
└─────────────────────────────────────────────────────────────────┘
```

### 支持的部署形态

- **单机文件驱动** —— 原版 PlanWeave，照常工作。Runtime 走 `FileRuntimeRepository`，不需要 server。
- **LAN 多人协作** —— 一个项目对应一个 `packages/server` 实例。桌面 / CLI 通过 LAN 连接。SQLite WAL 提供权威存储；Git merge queue 串行化提交。

---

## 2. 快速上手（本 fork）

### 2.1 安装

```bash
pnpm install --frozen-lockfile
pnpm -r build
```

构建顺序：`runtime → server / mcp → cli / desktop`。

### 2.2 启动 server（主机端）

```bash
# 在仓库根
pnpm --filter @planweave-ai/cli planweave server start \
  --port 8788 --data-directory ./data
```

或者直接：

```bash
node packages/cli/dist/index.js server start --port 8788 --data-directory ./data
```

启动后会打印一个 join URL。默认 join token 是 `planweave-local-team`（可用 `--join-token` 或环境变量覆盖）。

### 2.3 成员加入（CLI）

```bash
planweave server join --server-url http://192.168.1.10:8788 --token planweave-local-team
planweave server list
planweave server project --profile <profile-id> --project <project-id>
```

### 2.4 桌面端加入

1. `pnpm --dir packages/desktop build && pnpm --dir packages/desktop start`
2. 侧栏 → **Mode: Team**（或点 Team 条目上的角色徽章）。
3. 选 **作为主机启动**（在本机起一个 team host）或 **作为成员加入**（粘贴 server URL + token）。
4. Team 标签旁的徽章会切换为 `<ServerIcon />`（主机）或 `<UserRoundIcon />`（成员）并保持同步。

### 2.5 跑一个 work package

- 在 Team 模式下打开侧栏的 **团队任务** 子导航。
- 认领一个 task —— server 会创建一条带可续约 lease 的 assignment。
- 在本地 Git worktree 里写代码。准备好后 push 分支。
- 提交 head commit；merge queue 会校验路径、祖先、身份，再跑检查脚本后合并。

### 2.6 Personal / 本地模式（未变化）

- 侧栏 → **Mode: Personal**（或点任何本地导航）。
- 照常使用 `planweave status`、`planweave run --once`、桌面端流程图、 MCP tunnel 等 —— 与 upstream 一致。

---

## 3. CLI 速查（本 fork 新增）

| 命令 | 作用 |
|---|---|
| `planweave server start` | 用本地数据目录启动 LAN server |
| `planweave server join` | 注册一个连接 profile + 凭证 |
| `planweave server list` | 列出已知 profile |
| `planweave server forget` | 删除 profile 并清除凭证 |
| `planweave server project` | 在某 profile 上绑定当前项目 |
| `planweave remote task` | 查看 / 认领 / 提交团队任务 |
| `planweave remote merge-queue` | 查看 / 重试 queue 条目 |

原有 upstream CLI 命令（`planweave init`、`run`、`status`、`mcp tunnel …`、`package-draft …`）照常使用。

---

## 4. 验证

- `pnpm lint` —— `check:versions` + `check:dom-boundaries` + `typecheck`
- `pnpm test` —— 全 monorepo vitest
- `pnpm --filter @planweave-ai/desktop typecheck` —— renderer + 主进程
- `pnpm --filter @planweave-ai/server test` —— server 单元 + 集成（11 个文件，84+ 用例）

A10 验收记录：`.octocode/rfc/lan-multi-user-collaboration/A10_ACCEPTANCE.md`。

---

## 5. 设计文档（本 fork 配套）

- `RFC.md` —— LAN 多人协作与服务器协调交付（讲"为什么"）
- `IMPLEMENTATION.md` —— A0–A10 工作包图与归属边界
- `CONTRACTS-v1.md` —— 冻结的错误信封 / cursor / 幂等 / 版本 / 事件信封
- `A10_ACCEPTANCE.md` —— 集成、故障注入与安全验收
- `TEAM_MODE_FRONTEND.md` —— Team Mode 产品 / 信息架构
- `ADR-001-authoritative-sqlite.md` —— `node:sqlite` 选型
- `ADR-002-http-websocket-transport.md` —— 独立协作监听器
- `KPI.md` —— 守护指标与何时重新评估扩缩
- `PREREQUISITES.md` / `RESOURCES.md`

这些文档都放在 `.octocode/rfc/lan-multi-user-collaboration/`（本 fork `.gitignore` 排除了，工作包进行期间随代码一起维护）。

---

## 6. 已知后续工作

- A2 work schema 正在扩展，目标是持久化 `ownershipScopes`、受保护 scope、reviewer、acceptance check，让 merge queue 能从权威任务数据上强制 RFC 的路径边界策略（A10 阻塞项）。
- `.worktrees/a2-a4-*, server-integration/` 是 A1–A9 并行工作的残留；以 main 为准后可直接 `git worktree remove`。
- Coordinator Agent 的首个真实 provider 仍待取消 / 预算 / artifact 持久化工作完成；目前集成测试用的是手动 / fake provider。
- A10 期间没有跑 Ghost Security 自动化扫描（用了针对性人工 / 静态评审兜底）；把协作 server 暴露到 loopback 之外前需要补上。

---

## 许可

MIT。详见 [LICENSE](LICENSE)。
