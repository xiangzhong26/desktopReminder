export type Task = {
  id: string;
  name: string;
  intervalMinutes: number;
  color: string;
  enabled: boolean;
  createdAt: number;
};

export type WorkSession = { id: string; start: number; end: number | null };
export type Completion = { id: string; taskId: string; at: number };

export type AppState = {
  tasks: Task[];
  sessions: WorkSession[];
  completions: Completion[];
  pending: Record<string, number>;
  activeSessionId: string | null;
  launchAtLogin: boolean;
};

export type DesktopAPI = {
  getState: () => Promise<AppState>;
  saveTask: (task: Partial<Task> & Pick<Task, 'name' | 'intervalMinutes' | 'color'>) => Promise<AppState>;
  deleteTask: (id: string) => Promise<AppState>;
  startWork: () => Promise<AppState>;
  stopWork: () => Promise<AppState>;
  completeReminder: (taskId: string) => Promise<AppState>;
  setLaunchAtLogin: (enabled: boolean) => Promise<AppState>;
  showMain: () => void;
  closePet: (taskId: string) => void;
  dragPet: (data: { taskId: string; phase: 'start' | 'move' | 'end'; dx?: number; dy?: number }) => void;
  onState: (callback: (state: AppState) => void) => () => void;
  onPetAlert: (callback: (data: { pending: number }) => void) => () => void;
  onPetBond: (callback: (data: { phase: 'stretch' | 'snap' | 'break'; strength?: number }) => void) => () => void;
};

declare global { interface Window { desktopAPI: DesktopAPI } }
