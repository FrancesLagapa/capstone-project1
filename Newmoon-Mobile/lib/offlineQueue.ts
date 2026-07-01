import { getJsonItem, setJsonItem, deleteJsonItem } from './appStorage';

export type QueueItemType =
  | 'sale'
  | 'pull-out'
  | 'supply-request'
  | 'cash-advance'
  | 'attendance-time-in'
  | 'attendance-time-out'
  | 'toggle-received'
  | 'profile-update'
  | 'face-reset';

export type QueuedRequest = {
  id: string;
  type: QueueItemType;
  method: 'POST' | 'PUT' | 'PATCH';
  url: string;
  data?: Record<string, unknown>;
  label: string;
  createdAt: string;
  localAttendanceId?: string;
  attendanceServerId?: number;
};

const QUEUE_KEY = 'offline_request_queue';
const PENDING_ATTENDANCE_KEY = 'offline_pending_attendance';

export type PendingAttendance = {
  localId: string;
  user_id: number;
  branch_id: number;
  date: string;
  time_in: string;
  time_out?: string;
  synced: boolean;
  serverId?: number;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getQueue(): Promise<QueuedRequest[]> {
  return (await getJsonItem<QueuedRequest[]>(QUEUE_KEY)) ?? [];
}

export async function addToQueue(
  item: Omit<QueuedRequest, 'id' | 'createdAt'>
): Promise<QueuedRequest> {
  const queue = await getQueue();
  const entry: QueuedRequest = {
    ...item,
    id: makeId(),
    createdAt: new Date().toISOString(),
  };
  queue.push(entry);
  await setJsonItem(QUEUE_KEY, queue);
  return entry;
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await setJsonItem(
    QUEUE_KEY,
    queue.filter((item) => item.id !== id)
  );
}

export async function updateQueueItem(
  id: string,
  patch: Partial<QueuedRequest>
): Promise<void> {
  const queue = await getQueue();
  const next = queue.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await setJsonItem(QUEUE_KEY, next);
}

export async function getPendingAttendance(): Promise<PendingAttendance | null> {
  return getJsonItem<PendingAttendance>(PENDING_ATTENDANCE_KEY);
}

export async function savePendingAttendance(record: PendingAttendance): Promise<void> {
  await setJsonItem(PENDING_ATTENDANCE_KEY, record);
}

export async function clearPendingAttendance(): Promise<void> {
  await deleteJsonItem(PENDING_ATTENDANCE_KEY);
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
