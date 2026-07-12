import { useEffect, useState, type ReactNode } from "react";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDotIcon,
  ClipboardListIcon,
  GitBranchIcon,
  Link2Icon,
  LoaderCircleIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  ServerIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  XIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RemoteMessage, RemoteProfile, RemoteProjectSnapshot, RemoteTask } from "../../shared/remoteTypes.js";
import { MergeStatusDisplay } from "../components/MergeStatusDisplay.js";
import { MemberPresence } from "../components/MemberPresence.js";
import { remoteBridge } from "../bridge.js";

type TeamRole = "host" | "member";
type TeamView = "planning" | "graph" | "tasks" | "proposals" | "members";

function RoleChoiceCard({ role, onSelect }: { role: TeamRole; onSelect: (role: TeamRole) => void }) {
  const host = role === "host";
  return (
    <button
      className="group relative animate-in fade-in slide-in-from-bottom-2 overflow-hidden rounded-2xl border border-border/80 bg-surface-raised p-5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-panel)] ease-[var(--motion-ease-emphasized)] hover:-translate-y-1 hover:border-violet-400/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ animationDelay: host ? "0ms" : "80ms" }}
      type="button"
      onClick={() => onSelect(role)}
    >
      <div className={`absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r ${host ? "from-violet-500 to-indigo-400" : "from-sky-500 to-cyan-400"} transition-transform duration-[var(--motion-duration-panel)] group-hover:scale-x-100`} />
      <div className={`flex size-11 items-center justify-center rounded-xl ${host ? "bg-violet-500/12 text-violet-600 dark:text-violet-300" : "bg-sky-500/12 text-sky-600 dark:text-sky-300"}`}>
        {host ? <ServerIcon className="size-5" /> : <UserRoundIcon className="size-5" />}
      </div>
      <div className="mt-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{host ? "创建共享空间" : "加入已有空间"}</div>
          <h2 className="mt-1 text-lg font-semibold text-text-strong">{host ? "作为主机启动" : "作为成员加入"}</h2>
        </div>
        <ArrowRightIcon className="mt-1 size-4 text-text-faint" />
      </div>
      <p className="mt-3 min-h-12 text-sm leading-6 text-text-muted">{host ? "在本机创建团队服务，集中管理项目并生成可分享的连接地址。" : "使用主机提供的服务地址和加入令牌，连接到现有团队项目。"}</p>
      <div className="mt-4 space-y-2 text-xs text-text-muted">
        <div className="flex items-center gap-2"><CheckCircle2Icon className="size-3.5 text-state-success" />{host ? "启动后即可邀请成员" : "不会在本机创建团队服务"}</div>
        <div className="flex items-center gap-2"><ShieldCheckIcon className="size-3.5 text-state-success" />使用加入令牌保护连接</div>
      </div>
    </button>
  );
}

const disconnectedTeamPages: Record<Exclude<TeamView, "planning">, { title: string; description: string; detail: string; icon: typeof GitBranchIcon }> = {
  graph: { title: "团队流程图", description: "连接团队后，在这里查看协作链路和同步状态。", detail: "流程图会汇总规划、提案、任务执行和合并状态。", icon: GitBranchIcon },
  tasks: { title: "团队任务", description: "连接团队后，在这里领取和跟踪共享任务。", detail: "任务会从团队项目同步，并保留成员的执行归属。", icon: ClipboardListIcon },
  proposals: { title: "提案决策", description: "连接团队后，在这里审阅和处理团队提案。", detail: "架构变更与执行决策会集中展示，避免重要决定被聊天记录淹没。", icon: CircleDotIcon },
  members: { title: "团队成员", description: "连接团队后，在这里查看成员和在线状态。", detail: "成员权限和在线状态会随团队服务同步。", icon: UsersRoundIcon }
};

function DisconnectedTeamPage({ view, onStartConnection }: { view: Exclude<TeamView, "planning">; onStartConnection: () => void }) {
  const page = disconnectedTeamPages[view];
  const Icon = page.icon;
  return (
    <div className="mx-auto mt-16 w-full max-w-3xl rounded-2xl border border-border/80 bg-surface-raised p-8 shadow-sm">
      <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><Icon className="size-6" /></div>
      <div className="mt-6 text-xs font-medium uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">团队页面</div>
      <h1 className="mt-2 text-2xl font-semibold text-text-strong">{page.title}</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">{page.description}</p>
      <div className="mt-6 rounded-xl border border-border/70 bg-surface-muted/60 p-4 text-sm leading-6 text-text-muted">{page.detail}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-text-muted">当前还没有连接到团队工作区。</span><Button onClick={onStartConnection}>开始连接团队</Button></div>
    </div>
  );
}

type TeamWorkspaceProps = {
  view: TeamView;
  snapshot: RemoteProjectSnapshot;
  tasks: RemoteTask[];
  messages: RemoteMessage[];
  rooms: RemoteProjectSnapshot["planningRooms"];
  currentRoom: RemoteProjectSnapshot["planningRooms"][number] | undefined;
  draft: string;
  inviteUrl: string | null;
  approvingProposalId: string | null;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onSelectRoom: (roomId: string) => void;
  onClaim: (task: RemoteTask) => void;
  onDecideProposal: (proposalId: string, decision: "approve" | "reject") => void;
  onRefresh: () => void;
};

function EmptyPanel({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="p-10 text-center"><div className="flex justify-center text-text-faint">{icon}</div><p className="mt-3 text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

type TeamTaskNode = Node<{ task: RemoteTask }, "teamTask">;

function TeamTaskCanvasNode({ data }: NodeProps<TeamTaskNode>) {
  const statusTone = data.task.status === "ready" ? "border-sky-400/70" : data.task.status === "leased" ? "border-amber-400/70" : data.task.status === "done" ? "border-state-success/70" : "border-violet-400/70";
  return <div className={`w-[230px] rounded-xl border-2 bg-surface-raised p-3 text-text shadow-lg ${statusTone}`}>
    <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-violet-500" />
    <div className="flex items-start gap-2"><ClipboardListIcon className="mt-0.5 size-4 shrink-0 text-violet-500" /><div className="min-w-0"><div className="truncate text-sm font-semibold" title={data.task.title}>{data.task.title}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-text-muted">{data.task.status}</div></div></div>
    <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-text-muted"><span className="rounded bg-surface-muted px-1.5 py-0.5">v{data.task.version}</span>{data.task.policy.parallel ? <span className="rounded bg-surface-muted px-1.5 py-0.5">可并行</span> : <span className="rounded bg-surface-muted px-1.5 py-0.5">串行</span>}</div>
    <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-violet-500" />
  </div>;
}

const teamTaskNodeTypes = { teamTask: TeamTaskCanvasNode };

function teamTaskCanvas(tasks: RemoteTask[]): { nodes: TeamTaskNode[]; edges: Edge[] } {
  const nodes = tasks.map((task, index) => ({
    id: task.taskId,
    type: "teamTask" as const,
    position: { x: (index % 3) * 300 + 80, y: Math.floor(index / 3) * 190 + 70 },
    data: { task },
    draggable: false
  }));
  const edges = tasks.flatMap((task) => (task.dependsOnTaskIds ?? []).flatMap((dependencyId) => {
    const dependency = tasks.find((candidate) => candidate.taskId === dependencyId || candidate.id === dependencyId || `task_${candidate.taskId}` === dependencyId || `task_${candidate.id}` === dependencyId);
    const source = dependency?.taskId ?? null;
    if (!source || source === task.taskId) return [];
    return [{ id: `${source}->${task.taskId}`, source, target: task.taskId, type: "smoothstep", animated: task.status === "in_progress" } satisfies Edge];
  }));
  return { nodes, edges };
}

function TeamWorkspace({ view, snapshot, tasks, messages, rooms, currentRoom, draft, inviteUrl, approvingProposalId, onDraftChange, onSend, onSelectRoom, onClaim, onDecideProposal, onRefresh }: TeamWorkspaceProps) {
  const openProposals = snapshot.proposals.filter((proposal) => proposal.status === "open").length;

  let page: ReactNode;
  if (view === "planning") {
    page = (
      <section className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] gap-4">
        <aside className="rounded-xl border border-border/80 bg-surface-raised p-3">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">规划室</h2><Badge variant="secondary">{rooms.length}</Badge></div>
          {rooms.length === 0 ? <p className="px-2 py-4 text-xs text-muted-foreground">还没有规划室。</p> : rooms.map((room) => <Button key={room.id} className="mb-1 w-full justify-start" size="sm" variant={currentRoom?.id === room.id ? "secondary" : "ghost"} onClick={() => onSelectRoom(room.id)}># {room.name}</Button>)}
        </aside>
        <div className="flex min-h-0 flex-col rounded-xl border border-border/80 bg-surface-raised">
          <div className="border-b border-border/80 px-5 py-4 font-medium"># {currentRoom?.name ?? "general"}</div>
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
            {messages.length === 0 ? <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><MessageSquareIcon className="size-8 text-text-faint" /><p className="mt-3 text-sm font-medium">从一条更新开始</p><p className="mt-1 text-xs text-muted-foreground">分享进展、风险或需要团队讨论的决定。</p></div> : messages.map((message) => <div key={message.id}><div className="text-xs text-muted-foreground">{message.authorUserId} · {new Date(message.createdAt).toLocaleString()}</div><div className="mt-1 text-sm">{message.body}</div></div>)}
          </div>
          <div className="flex gap-2 border-t border-border/80 p-4"><input aria-label="消息内容" className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm" value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="分享一个想法或更新" onKeyDown={(event) => { if (event.key === "Enter") onSend(); }} /><Button disabled={!draft.trim() || !currentRoom} onClick={onSend}>发送</Button></div>
        </div>
      </section>
    );
  } else if (view === "graph") {
    const canvas = teamTaskCanvas(tasks);
    page = (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-raised px-5 py-4"><div><div className="flex items-center gap-2"><GitBranchIcon className="size-4 text-violet-500" /><h2 className="font-semibold">多人流程画布</h2><Badge variant="secondary">{canvas.nodes.length} 个节点</Badge></div><p className="mt-1 text-xs text-muted-foreground">团队成员共享查看同一张任务依赖地图；节点状态和在线成员来自团队服务。</p></div><div className="flex items-center gap-3"><MemberPresence members={snapshot.members} /><span className="text-xs text-muted-foreground">事件 #{snapshot.lastEventId}</span></div></div>
        <div className="relative h-[560px] overflow-hidden rounded-xl border border-border/80 bg-surface-muted/35"><ReactFlow nodes={canvas.nodes} edges={canvas.edges} nodeTypes={teamTaskNodeTypes} fitView fitViewOptions={{ padding: 0.25 }} nodesConnectable={false} nodesDraggable={false} proOptions={{ hideAttribution: true }}><Background gap={24} size={1} color="var(--border)" /><Controls /><MiniMap pannable zoomable nodeColor="#8b5cf6" /></ReactFlow>{canvas.nodes.length === 0 ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><EmptyPanel icon={<ClipboardListIcon className="size-8" />} title="画布还没有任务节点" description="团队任务同步后会显示在多人流程画布上。" /></div> : null}</div>
      </section>
    );
  } else if (view === "tasks") {
    page = <section className="rounded-xl border border-border/80 bg-surface-raised"><div className="flex items-center justify-between border-b border-border/80 px-5 py-4"><div><h2 className="font-semibold">团队任务</h2><p className="mt-1 text-xs text-muted-foreground">领取任务后会创建带有成员标识的工作分支。</p></div><Badge variant="secondary">{tasks.length} 项</Badge></div><div className="divide-y divide-border/70">{tasks.length === 0 ? <EmptyPanel icon={<ClipboardListIcon className="size-8" />} title="暂时没有团队任务" description="任务会从共享项目的流程图同步到这里。" /> : tasks.map((task) => <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={task.id}><div className="min-w-0"><div className="font-medium">{task.title}</div><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{task.status}</Badge><span>{task.policy.ownershipScopes.join(", ") || "无范围限制"}</span></div></div>{task.status === "ready" ? <Button size="sm" variant="outline" onClick={() => onClaim(task)}>领取任务</Button> : <span className="text-xs text-muted-foreground">{task.policy.parallel ? "可并行执行" : "需串行执行"}</span>}</div>)}</div></section>;
  } else if (view === "proposals") {
    page = <section className="rounded-xl border border-border/80 bg-surface-raised"><div className="flex items-center justify-between border-b border-border/80 px-5 py-4"><div><h2 className="font-semibold">提案决策</h2><p className="mt-1 text-xs text-muted-foreground">集中查看需要团队确认的变更。</p></div><Badge variant="secondary">{openProposals} 待处理</Badge></div><div className="divide-y divide-border/70">{snapshot.proposals.length === 0 ? <EmptyPanel icon={<CircleDotIcon className="size-8" />} title="暂无提案" description="新的架构或执行决策会出现在这里。" /> : snapshot.proposals.map((proposal) => <article className="px-5 py-4" key={proposal.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-medium">{proposal.title}</h3><p className="mt-1 text-sm text-muted-foreground">{proposal.body}</p></div><Badge variant={proposal.status === "approved" ? "default" : proposal.status === "open" ? "secondary" : "outline"}>{proposal.status}</Badge></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>由 {proposal.createdByUserId} 提交 · v{proposal.version}</span>{proposal.status === "open" ? <div className="flex gap-2"><Button size="sm" variant="outline" disabled={approvingProposalId === proposal.id} onClick={() => onDecideProposal(proposal.id, "reject")}><XIcon className="size-3.5" />拒绝</Button><Button size="sm" disabled={approvingProposalId === proposal.id} onClick={() => onDecideProposal(proposal.id, "approve")}><CheckIcon className="size-3.5" />批准</Button></div> : null}</div></article>)}</div></section>;
  } else {
    page = <section className="rounded-xl border border-border/80 bg-surface-raised"><div className="flex items-center justify-between border-b border-border/80 px-5 py-4"><div><h2 className="font-semibold">团队成员</h2><p className="mt-1 text-xs text-muted-foreground">查看在线状态与当前权限。</p></div><Badge variant="secondary">{snapshot.members.length} 人</Badge></div><div className="grid gap-3 p-5 sm:grid-cols-2">{snapshot.members.length === 0 ? <div className="p-8 text-center sm:col-span-2"><UsersRoundIcon className="mx-auto size-8 text-text-faint" /><p className="mt-3 text-sm font-medium">还没有成员信息</p><p className="mt-1 text-xs text-muted-foreground">连接成功后，团队成员会显示在这里。</p></div> : snapshot.members.map((member) => <div className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-muted/40 p-4" key={member.userId}><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-violet-500/12 text-sm font-semibold text-violet-600 dark:text-violet-300">{member.displayName.slice(0, 1).toUpperCase()}</div><div><div className="font-medium">{member.displayName}</div><div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${member.online ? "bg-state-success" : "bg-text-faint"}`} />{member.online ? "在线" : "离线"}</div></div></div><div className="flex items-center gap-1 text-xs text-muted-foreground"><UserCheckIcon className="size-3.5" />{member.role}</div></div>)}</div></section>;
  }

  return <div className="mx-auto flex h-full max-w-5xl flex-col gap-6"><header className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs uppercase tracking-widest text-violet-600 dark:text-violet-300">Team workspace · Connected</div><h1 className="mt-1 text-3xl font-semibold">{snapshot.project.name}</h1><p className="mt-2 text-sm text-muted-foreground">{snapshot.members.length} 位成员 · {tasks.length} 个任务 · {snapshot.proposals.length} 个提案</p></div><div className="flex items-center gap-2"><MergeStatusDisplay mergeStatus={snapshot.mergeStatus} /><Button size="icon-sm" variant="outline" aria-label="刷新团队数据" onClick={onRefresh}><RefreshCwIcon className="size-4" /></Button></div></header>{inviteUrl ? <div className="rounded-lg border border-state-success/30 bg-state-success-surface px-4 py-3 text-sm"><span className="font-medium">主机邀请地址</span><code className="ml-2 break-all text-xs">{inviteUrl}</code></div> : null}{page}</div>;
}

export function TeamModeShell({ embedded = false, teamView = "planning", onConnectionRoleChange, onExit }: { embedded?: boolean; teamView?: string; onConnectionRoleChange?: (role: "server" | "member") => void; onExit: () => void }) {
  const [profiles, setProfiles] = useState<RemoteProfile[]>([]);
  const [active, setActive] = useState<RemoteProfile | null>(null);
  const [snapshot, setSnapshot] = useState<RemoteProjectSnapshot | null>(null);
  const [messages, setMessages] = useState<RemoteMessage[]>([]);
  const [tasks, setTasks] = useState<RemoteTask[]>([]);
  const [rooms, setRooms] = useState<RemoteProjectSnapshot["planningRooms"]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roleChoice, setRoleChoice] = useState<"choose" | "host" | "member">("choose");
  const [projectId, setProjectId] = useState("team-project");
  const [projectName, setProjectName] = useState("My Team Project");
  const [userId, setUserId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [joinToken, setJoinToken] = useState("planweave-local-team");
  const [serverUrl, setServerUrl] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [connectingRole, setConnectingRole] = useState<TeamRole | null>(null);
  const [approvingProposalId, setApprovingProposalId] = useState<string | null>(null);

  useEffect(() => { void remoteBridge?.listRemoteProfiles().then(setProfiles); }, []);

  useEffect(() => {
    const api = remoteBridge;
    if (!api || !active?.projectId) return;
    return api.onRemoteEvent((event) => {
      if (event.profileId !== active.id || event.projectId !== active.projectId) return;
      void Promise.all([
        api.getRemoteProjectSnapshot(active.id, active.projectId),
        api.getRemoteTasks(active.id, active.projectId)
      ]).then(([nextSnapshot, nextTasks]) => {
        setSnapshot(nextSnapshot);
        setTasks(nextTasks);
      }).catch(() => undefined);
    });
  }, [active]);

  async function open(profile: RemoteProfile) {
    if (!remoteBridge || !profile.projectId) return;
    setError(null);
    try {
      await remoteBridge.connectProfile(profile.id, profile.projectId);
      const next = await remoteBridge.getRemoteProjectSnapshot(profile.id, profile.projectId);
      const nextRooms = await remoteBridge.getRemotePlanningRooms(profile.id, profile.projectId);
      const availableRooms = nextRooms.length > 0 ? nextRooms : next.planningRooms;
      setActive(profile); setSnapshot(next); setTasks(await remoteBridge.getRemoteTasks(profile.id, profile.projectId)); setRooms(availableRooms);
      const room = availableRooms[0]; setSelectedRoomId(room?.id ?? null); setMessages(room ? await remoteBridge.getRemoteMessages(profile.id, profile.projectId, room.id) : []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }

  async function hostTeam() {
    if (!remoteBridge) return;
    setError(null); setConnectingRole("host");
    try { const host = await remoteBridge.startLocalTeamHost({ projectId, projectName, userId, deviceId, joinToken }); setProfiles((current) => [...current.filter((profile) => profile.id !== host.profile.id), host.profile]); setInviteUrl(host.inviteUrl); onConnectionRoleChange?.("server"); await open(host.profile); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setConnectingRole(null); }
  }

  async function joinTeam() {
    if (!remoteBridge) return;
    setError(null); setConnectingRole("member");
    try { const profile = await remoteBridge.createRemoteProfile({ name: `${projectName} (member)`, serverUrl, deviceId, apiKey: joinToken, projectId, userId }); setProfiles((current) => [...current, profile]); onConnectionRoleChange?.("member"); await open(profile); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setConnectingRole(null); }
  }

  async function claim(task: RemoteTask) {
    if (!remoteBridge || !active?.projectId) return;
    setError(null);
    try { await remoteBridge.claimRemoteTask(active.id, active.projectId, task.taskId, `team/${active.userId ?? "contributor"}/${task.taskId}`, "HEAD"); setTasks(await remoteBridge.getRemoteTasks(active.id, active.projectId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }

  async function send() {
    const room = rooms.find((item) => item.id === selectedRoomId) ?? rooms[0];
    if (!remoteBridge || !active?.projectId || !room || !draft.trim()) return;
    try { const message = await remoteBridge.sendRemoteMessage(active.id, active.projectId, room.id, draft.trim()); setMessages((current) => [...current, message]); setDraft(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }

  async function selectRoom(roomId: string) {
    if (!remoteBridge || !active?.projectId) return;
    const room = rooms.find((item) => item.id === roomId); if (!room) return;
    setSelectedRoomId(roomId); setError(null);
    try { setMessages(await remoteBridge.getRemoteMessages(active.id, active.projectId, room.id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  }

  async function decideProposal(proposalId: string, decision: "approve" | "reject") {
    if (!remoteBridge || !active?.projectId) return;
    setApprovingProposalId(proposalId); setError(null);
    try { await remoteBridge.approveRemoteProposal(active.id, active.projectId, proposalId, decision); setSnapshot(await remoteBridge.getRemoteProjectSnapshot(active.id, active.projectId)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setApprovingProposalId(null); }
  }

  const view = ["planning", "graph", "tasks", "proposals", "members"].includes(teamView) ? teamView as TeamView : "planning";
  const currentRoom = rooms.find((room) => room.id === selectedRoomId) ?? rooms[0];

  return <div className={`flex min-h-0 min-w-0 flex-1 bg-app-canvas text-text ${embedded ? "h-full" : "h-screen"}`}>
    {!embedded ? <aside className="w-64 border-r border-border/80 bg-app-panel p-4"><div className="mb-6 flex items-center justify-between"><strong>Team Mode</strong><Button size="sm" variant="ghost" onClick={onExit}>Local</Button></div><Button className="mb-3 w-full" onClick={() => setRoleChoice("choose")}>New team connection</Button><div className="space-y-2">{profiles.map((profile) => <Button className="w-full justify-start" key={profile.id} variant={active?.id === profile.id ? "secondary" : "ghost"} onClick={() => void open(profile)}>{profile.name}</Button>)}</div></aside> : null}
    <main className="min-w-0 flex-1 overflow-auto p-8">
      {embedded ? <header className="view-enter mb-8 border-b border-border/80 pb-4"><div className="text-xs font-medium uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">团队模式</div><h1 className="mt-1 text-xl font-semibold">团队配置</h1></header> : null}
      {embedded && profiles.length > 0 ? <div className="mb-6 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setRoleChoice("choose")}>新建团队连接</Button>{profiles.map((profile) => <Button size="sm" key={profile.id} variant={active?.id === profile.id ? "secondary" : "ghost"} onClick={() => void open(profile)}>{profile.name}</Button>)}</div> : null}
      {error ? <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {!snapshot ? <div className="view-enter mx-auto mt-16 w-full max-w-3xl">{roleChoice === "choose" && view !== "planning" ? <DisconnectedTeamPage view={view} onStartConnection={() => setRoleChoice("host")} /> : roleChoice === "choose" ? <div className="animate-in fade-in slide-in-from-bottom-3"><div className="max-w-2xl"><div className="text-xs font-medium uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">连接团队工作区</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-strong">选择这台设备的团队角色</h1><p className="mt-3 text-sm leading-6 text-text-muted">主机负责创建共享服务并邀请成员；成员连接到已有服务共同协作。两种方式都可以随时返回重新选择。</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2"><RoleChoiceCard role="host" onSelect={setRoleChoice} /><RoleChoiceCard role="member" onSelect={setRoleChoice} /></div><div className="mt-5 flex items-center gap-2 text-xs text-text-muted"><ShieldCheckIcon className="size-4 text-state-success" />连接信息仅用于当前团队服务的身份验证。</div></div> : <div className="rounded-2xl border border-border/80 bg-surface-raised p-6 shadow-sm sm:p-8"><button className="text-sm text-text-muted hover:text-text-strong" type="button" onClick={() => setRoleChoice("choose")}>← 返回角色选择</button><div className="mt-6 flex items-start gap-4"><div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${roleChoice === "host" ? "bg-violet-500/12 text-violet-600" : "bg-sky-500/12 text-sky-600"}`}>{roleChoice === "host" ? <ServerIcon className="size-6" /> : <UserRoundIcon className="size-6" />}</div><div><div className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{roleChoice === "host" ? "创建共享空间" : "加入已有空间"}</div><h1 className="mt-1 text-2xl font-semibold text-text-strong">{roleChoice === "host" ? "作为主机启动" : "作为成员加入"}</h1></div></div><div className="mt-6 rounded-xl border border-border/70 bg-surface-muted/60 p-4 text-sm leading-6 text-text-muted">{roleChoice === "host" ? <><p>主机服务会在这台设备上启动，负责保存团队连接并同步项目状态。</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><span>1. 填写项目资料</span><span>2. 启动本地服务</span><span>3. 分享地址和令牌</span></div></> : <><p>请先向团队主机获取服务地址和加入令牌，再填写下方信息完成连接。</p><div className="mt-3 flex items-center gap-2"><Link2Icon className="size-4 text-sky-500" />连接成功后即可查看任务、成员和讨论。</div></>}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium text-text"><span>项目 ID</span><input className="h-10 rounded-lg border border-input bg-transparent px-3 font-normal" value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="例如 team-project" /></label><label className="grid gap-1.5 text-sm font-medium text-text"><span>项目名称</span><input className="h-10 rounded-lg border border-input bg-transparent px-3 font-normal" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="例如 产品协作空间" /></label><label className="grid gap-1.5 text-sm font-medium text-text"><span>你的名称</span><input className="h-10 rounded-lg border border-input bg-transparent px-3 font-normal" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="团队中显示的名称" /></label><label className="grid gap-1.5 text-sm font-medium text-text"><span>设备 ID</span><input className="h-10 rounded-lg border border-input bg-transparent px-3 font-normal" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="当前设备标识" /></label>{roleChoice === "member" ? <label className="grid gap-1.5 text-sm font-medium text-text sm:col-span-2"><span>主机服务地址</span><input className="h-10 rounded-lg border border-input bg-transparent px-3 font-normal" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="例如 http://192.168.1.10:8788" /></label> : null}<label className="grid gap-1.5 text-sm font-medium text-text sm:col-span-2"><span>团队加入令牌</span><input className="h-10 rounded-lg border border-input bg-transparent px-3 font-normal" type="text" value={joinToken} onChange={(event) => setJoinToken(event.target.value)} placeholder="由主机生成并分享给成员" /></label></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-muted">{roleChoice === "host" ? "启动后会自动生成可分享的服务地址。" : "服务地址和令牌只会用于连接此团队。"}</p><Button disabled={connectingRole !== null || !projectId || !userId || !deviceId || (roleChoice === "host" && !joinToken) || (roleChoice === "member" && !serverUrl)} onClick={() => void (roleChoice === "host" ? hostTeam() : joinTeam())}>{connectingRole === roleChoice ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}{connectingRole === roleChoice ? (roleChoice === "host" ? "正在启动…" : "正在连接…") : roleChoice === "host" ? "启动团队服务" : "加入团队"}</Button></div>{inviteUrl ? <div className="mt-5 rounded-xl border border-state-success/30 bg-state-success-surface p-4 text-sm"><div className="font-medium">团队服务已启动</div><div className="mt-1 text-text-muted">将此地址分享给成员：</div><code className="mt-2 block break-all text-xs">{inviteUrl}</code></div> : null}</div>}</div> : <TeamWorkspace view={view} snapshot={snapshot} tasks={tasks} messages={messages} rooms={rooms} currentRoom={currentRoom} draft={draft} inviteUrl={inviteUrl} approvingProposalId={approvingProposalId} onDraftChange={setDraft} onSend={() => void send()} onSelectRoom={(roomId) => void selectRoom(roomId)} onClaim={(task) => void claim(task)} onDecideProposal={(proposalId, decision) => void decideProposal(proposalId, decision)} onRefresh={() => active && void open(active)} />}
    </main>
  </div>;
}
