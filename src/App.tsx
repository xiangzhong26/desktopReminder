import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ChevronRight, Clock3, Droplets, Edit3, Flame, LayoutDashboard, Leaf, Moon, Plus, Settings, Sparkles, Trash2, X } from 'lucide-react';
import type { AppState, Task, WorkSession } from './types';

const COLORS = ['#59CFA8', '#63A9F5', '#A78BFA', '#FF9A76', '#F2C94C', '#F47DA5'];

const empty: AppState = { tasks: [], sessions: [], completions: [], pending: {}, activeSessionId: null, launchAtLogin: false };

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h} 小时 ${m} 分` : `${m} 分钟`;
}

function localDayKey(date: Date) {
  const y = date.getFullYear(); const m = `${date.getMonth() + 1}`.padStart(2, '0'); const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function secondsForDay(sessions: WorkSession[], date: Date, now: number) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return Math.round(sessions.reduce((sum, session) => {
    const a = Math.max(session.start, start.getTime());
    const b = Math.min(session.end ?? now, end.getTime());
    return sum + Math.max(0, b - a);
  }, 0) / 1000);
}

function secondsForRange(sessions: WorkSession[], rangeStart: Date, rangeEnd: Date, now: number) {
  const a = rangeStart.getTime(); const b = rangeEnd.getTime();
  return Math.round(sessions.reduce((sum, session) => sum + Math.max(0, Math.min(session.end ?? now, b) - Math.max(session.start, a)), 0) / 1000);
}

function weekDays(now: Date) {
  const monday = new Date(now); const offset = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - offset); monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

type Page = 'home' | 'tasks' | 'stats' | 'settings';

export default function App() {
  const [state, setState] = useState<AppState>(empty);
  const [page, setPage] = useState<Page>('home');
  const [now, setNow] = useState(Date.now());
  const [editor, setEditor] = useState<Partial<Task> | null>(null);

  useEffect(() => {
    window.desktopAPI.getState().then(setState);
    const unsub = window.desktopAPI.onState(setState);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { unsub(); clearInterval(timer); };
  }, []);

  const today = useMemo(() => secondsForDay(state.sessions, new Date(now), now), [state.sessions, now]);
  const days = useMemo(() => weekDays(new Date(now)), [now]);
  const weekValues = days.map((d) => secondsForDay(state.sessions, d, now));
  const weekTotal = weekValues.reduce((a, b) => a + b, 0);
  const active = !!state.activeSessionId;
  const totalPending = Object.values(state.pending).reduce((a, b) => a + b, 0);

  const nav = [
    { id: 'home' as Page, label: '今天', icon: LayoutDashboard },
    { id: 'tasks' as Page, label: '提醒任务', icon: Sparkles },
    { id: 'stats' as Page, label: '专注数据', icon: BarChart3 },
    { id: 'settings' as Page, label: '设置', icon: Settings },
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img src="./assets/icon.png" /><div><strong>MochiMinder</strong><span>柔软地照顾自己</span></div></div>
      <nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-note"><Leaf size={18}/><p>小小休息，<br/>也算认真生活。</p></div>
    </aside>
    <main className="content">
      {page === 'home' && <Home state={state} active={active} today={today} now={now} totalPending={totalPending} onStart={() => window.desktopAPI.startWork()} onStop={() => window.desktopAPI.stopWork()} onTasks={() => setPage('tasks')} />}
      {page === 'tasks' && <Tasks state={state} onEdit={setEditor} />}
      {page === 'stats' && <Stats state={state} today={today} now={now} days={days} weekValues={weekValues} weekTotal={weekTotal} />}
      {page === 'settings' && <SettingsPage state={state} />}
    </main>
    {editor && <TaskEditor value={editor} onClose={() => setEditor(null)} onSave={async (task) => { await window.desktopAPI.saveTask(task); setEditor(null); }} />}
  </div>;
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><span>{eyebrow}</span><h1>{title}</h1></div>{action}</header>;
}

function Home({ state, active, today, now, totalPending, onStart, onStop, onTasks }: { state: AppState; active: boolean; today: number; now: number; totalPending: number; onStart: () => void; onStop: () => void; onTasks: () => void }) {
  const greeting = new Date(now).getHours() < 12 ? '早上好' : new Date(now).getHours() < 18 ? '下午好' : '晚上好';
  const activeSession = state.sessions.find((s) => s.id === state.activeSessionId);
  const current = activeSession ? Math.round((now - activeSession.start) / 1000) : 0;
  return <>
    <Header eyebrow={localDayKey(new Date(now))} title={`${greeting}，准备好了吗？`} />
    <section className={`focus-hero ${active ? 'working' : ''}`}>
      <div className="hero-copy"><span className="status-pill"><i />{active ? '正在工作' : '等待开始'}</span><h2>{active ? '史莱姆伙伴正在陪你专注' : '开启一段舒服的工作时间'}</h2><p>{active ? `本次已经专注 ${formatDuration(current)}，记得响应它们的小提醒。` : '开始后，每个启用的提醒任务都会化身成一只桌面史莱姆。'}</p>
        <button className={`start-button ${active ? 'stop' : ''}`} onClick={active ? onStop : onStart}>{active ? <><Moon size={20}/>结束工作</> : <><Sparkles size={20}/>开始工作</>}</button>
      </div>
      <div className="hero-slime"><div className="slime-display"><div className="slime-face"><i/><i/></div><div className="slime-mouth"/></div><div className="shadow"/></div>
    </section>
    <section className="metric-grid">
      <Metric icon={<Clock3/>} label="今日工作" value={formatDuration(today)} note={`${state.sessions.filter(s => new Date(s.start).toDateString() === new Date().toDateString()).length} 个专注时段`} color="mint" />
      <Metric icon={<Flame/>} label="今日完成" value={`${state.completions.filter(c => new Date(c.at).toDateString() === new Date().toDateString()).length} 次`} note="照顾自己的小行动" color="peach" />
      <Metric icon={<Droplets/>} label="待处理提醒" value={`${totalPending} 个`} note={totalPending ? '点击桌宠即可完成' : '现在很清爽'} color="blue" />
    </section>
    <section className="section-block"><div className="section-heading"><div><h3>今天的伙伴</h3><p>{state.tasks.filter(t => t.enabled).length} 只史莱姆已准备好</p></div><button className="text-button" onClick={onTasks}>管理任务 <ChevronRight size={16}/></button></div>
      <div className="companion-list">{state.tasks.filter(t => t.enabled).map((task) => <div className="companion" key={task.id}><MiniSlime color={task.color}/><div><strong>{task.name}</strong><span>每 {task.intervalMinutes} 分钟</span></div><b>{state.pending[task.id] || 0}</b></div>)}</div>
    </section>
  </>;
}

function Metric({ icon, label, value, note, color }: { icon: React.ReactNode; label: string; value: string; note: string; color: string }) { return <div className="metric"><div className={`metric-icon ${color}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>; }

function MiniSlime({ color }: { color: string }) { return <div className="mini-slime" style={{ '--slime': color } as React.CSSProperties}><i/><i/><span/></div>; }

function Tasks({ state, onEdit }: { state: AppState; onEdit: (t: Partial<Task>) => void }) {
  return <><Header eyebrow="MY COMPANIONS" title="提醒任务" action={<button className="primary-small" onClick={() => onEdit({ name: '', intervalMinutes: 20, color: COLORS[0], enabled: true })}><Plus size={18}/>新建任务</button>} />
    <div className="task-intro"><Sparkles/><div><strong>一个任务，一只史莱姆</strong><p>工作开始后，启用的任务会变成可拖拽的桌面伙伴。提醒到点时，它会在屏幕上活跃 5 秒。</p></div></div>
    <div className="task-grid">{state.tasks.map((task) => <article className={`task-card ${task.enabled ? '' : 'disabled'}`} key={task.id}><div className="task-card-top"><MiniSlime color={task.color}/><div className="task-actions"><button onClick={() => onEdit(task)} aria-label="编辑"><Edit3 size={17}/></button><button onClick={() => window.desktopAPI.deleteTask(task.id)} aria-label="删除"><Trash2 size={17}/></button></div></div><h3>{task.name}</h3><p><Clock3 size={15}/> 每 {task.intervalMinutes} 分钟提醒</p><div className="task-footer"><span>{state.pending[task.id] || 0} 个待完成</span><label className="switch"><input type="checkbox" checked={task.enabled} onChange={(e) => window.desktopAPI.saveTask({ ...task, enabled: e.target.checked })}/><i/></label></div></article>)}</div>
  </>;
}

function TaskEditor({ value, onClose, onSave }: { value: Partial<Task>; onClose: () => void; onSave: (t: Partial<Task> & Pick<Task, 'name'|'intervalMinutes'|'color'>) => void }) {
  const [name, setName] = useState(value.name || ''); const [minutes, setMinutes] = useState(value.intervalMinutes || 20); const [color, setColor] = useState(value.color || COLORS[0]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={onClose}><X/></button><MiniSlime color={color}/><h2>{value.id ? '编辑史莱姆任务' : '领养一只新史莱姆'}</h2><p>给它一个清晰、轻松的小任务。</p><label>提醒内容<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：起来伸展一下" /></label><label>提醒间隔<div className="number-field"><input type="number" min="1" max="1440" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}/><span>分钟</span></div></label><label>史莱姆颜色<div className="color-row">{COLORS.map((c) => <button key={c} className={color === c ? 'selected' : ''} style={{ background: c }} onClick={() => setColor(c)}>{color === c && <Check size={16}/>}</button>)}</div></label><button className="save-button" disabled={!name.trim() || minutes < 1} onClick={() => onSave({ ...value, name: name.trim(), intervalMinutes: minutes, color })}>保存任务</button></div></div>;
}

function Stats({ state, today, now, days, weekValues, weekTotal }: { state: AppState; today: number; now: number; days: Date[]; weekValues: number[]; weekTotal: number }) {
  const total = state.sessions.reduce((sum, s) => sum + Math.max(0, (s.end ?? now) - s.start), 0) / 1000;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);
  const month = secondsForRange(state.sessions, monthStart, monthEnd, now);
  const max = Math.max(...weekValues, 1);
  return <><Header eyebrow="YOUR RHYTHM" title="专注数据"/><section className="stat-cards"><div><span>今天</span><strong>{formatDuration(today)}</strong></div><div><span>本周</span><strong>{formatDuration(weekTotal)}</strong></div><div><span>本月</span><strong>{formatDuration(month)}</strong></div><div><span>累计</span><strong>{formatDuration(total)}</strong></div></section>
    <section className="chart-card"><div className="section-heading"><div><h3>本周节奏</h3><p>每天的有效工作时长</p></div><span className="chart-total">共 {formatDuration(weekTotal)}</span></div><div className="bar-chart">{weekValues.map((v, i) => <div className="bar-col" key={days[i].toISOString()}><span>{v ? formatDuration(v) : ''}</span><div className={localDayKey(days[i]) === localDayKey(new Date()) ? 'today' : ''} style={{ height: `${Math.max(v ? 12 : 3, v / max * 100)}%` }}/><b>{['一','二','三','四','五','六','日'][i]}</b></div>)}</div></section>
    <section className="chart-card completion-card"><div className="section-heading"><div><h3>习惯完成情况</h3><p>累计点击完成的提醒</p></div></div>{state.tasks.map(task => { const count = state.completions.filter(c => c.taskId === task.id).length; const all = Math.max(state.completions.length, 1); return <div className="habit-row" key={task.id}><MiniSlime color={task.color}/><div><strong>{task.name}</strong><div className="progress"><i style={{ width: `${Math.max(count ? 8 : 0, count / all * 100)}%`, background: task.color }}/></div></div><b>{count} 次</b></div>})}</section>
  </>;
}

function SettingsPage({ state }: { state: AppState }) {
  return <><Header eyebrow="PREFERENCES" title="设置"/><section className="settings-card"><div className="setting-row"><div><strong>开机自动启动</strong><p>登录电脑后自动运行 MochiMinder</p></div><label className="switch"><input type="checkbox" checked={state.launchAtLogin} onChange={(e) => window.desktopAPI.setLaunchAtLogin(e.target.checked)}/><i/></label></div><div className="setting-row"><div><strong>关闭窗口时留在托盘</strong><p>计时与桌宠不会因为主窗口关闭而中断</p></div><span className="always-on">始终开启</span></div></section><section className="about-card"><img src="./assets/icon.png"/><div><h3>MochiMinder</h3><p>Version 0.1.0 · Made for gentler workdays.</p><span>数据只保存在你的电脑上。</span></div></section></>;
}
