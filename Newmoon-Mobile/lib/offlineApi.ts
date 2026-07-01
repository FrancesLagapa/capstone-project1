import api from './api';
import { hasNetworkConnection, isNetworkError } from './network';
import {
  addToQueue,
  clearPendingAttendance,
  getPendingAttendance,
  getQueue,
  QueuedRequest,
  removeFromQueue,
  savePendingAttendance,
  updateQueueItem,
} from './offlineQueue';

export type OfflineRequestOptions = {
  method: 'POST' | 'PUT' | 'PATCH';
  url: string;
  data?: Record<string, unknown>;
  type: import('./offlineQueue').QueueItemType;
  label: string;
  localAttendanceId?: string;
};

export type OfflineRequestResult = {
  queued: boolean;
  response?: unknown;
  queueId?: string;
};

export async function submitOrQueue(
  options: OfflineRequestOptions
): Promise<OfflineRequestResult> {
  const connected = await hasNetworkConnection();

  if (connected) {
    try {
      const response = await sendRequest(options.method, options.url, options.data);
      return { queued: false, response: response.data };
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }

  // Check for duplicate requests in queue to prevent multiple submissions
  const queue = await getQueue();
  const isDuplicate = queue.some(item => 
    item.type === options.type && 
    item.url === options.url && 
    JSON.stringify(item.data) === JSON.stringify(options.data) &&
    // Only consider it a duplicate if it was created within the last 5 seconds
    new Date(item.createdAt).getTime() > Date.now() - 5000
  );

  if (isDuplicate) {
    console.log('[submitOrQueue] Duplicate request detected, skipping queue');
    const existingEntry = queue.find(item => 
      item.type === options.type && 
      item.url === options.url && 
      JSON.stringify(item.data) === JSON.stringify(options.data)
    );
    return { queued: true, queueId: existingEntry?.id };
  }

  const entry = await addToQueue(options);
  return { queued: true, queueId: entry.id };
}

async function sendRequest(
  method: 'POST' | 'PUT' | 'PATCH',
  url: string,
  data?: Record<string, unknown>
) {
  if (method === 'POST') return api.post(url, data);
  if (method === 'PUT') return api.put(url, data);
  return api.patch(url, data);
}

export async function submitAttendanceTimeIn(
  body: Record<string, unknown>,
  label = 'Time In'
): Promise<OfflineRequestResult & { localAttendanceId?: string }> {
  const connected = await hasNetworkConnection();

  if (connected) {
    try {
      const response = await api.post('/attendance/time-in', body);
      await clearPendingAttendance();
      return { queued: false, response: response.data };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const localId = `local-${Date.now()}`;
  await savePendingAttendance({
    localId,
    user_id: Number(body.user_id),
    branch_id: Number(body.branch_id),
    date: String(body.date),
    time_in: String(body.time_in),
    synced: false,
  });

  const entry = await addToQueue({
    method: 'POST',
    url: '/attendance/time-in',
    data: body,
    type: 'attendance-time-in',
    label,
    localAttendanceId: localId,
  });

  return { queued: true, queueId: entry.id, localAttendanceId: localId };
}

export async function submitAttendanceTimeOut(
  attendanceId: number | string,
  body: Record<string, unknown>,
  label = 'Time Out'
): Promise<OfflineRequestResult> {
  const url = `/attendance/${attendanceId}/time-out`;
  const connected = await hasNetworkConnection();

  if (connected) {
    try {
      const response = await api.put(url, body);
      await clearPendingAttendance();
      return { queued: false, response: response.data };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
    }
  }

  const pending = await getPendingAttendance();
  if (pending) {
    await savePendingAttendance({
      ...pending,
      time_out: String(body.time_out),
    });
  }

  const entry = await addToQueue({
    method: 'PUT',
    url,
    data: body,
    type: 'attendance-time-out',
    label,
    localAttendanceId: pending?.localId,
    attendanceServerId: typeof attendanceId === 'number' ? attendanceId : undefined,
  });

  return { queued: true, queueId: entry.id };
}

export type SyncResult = {
  synced: number;
  failed: number;
  remaining: number;
};

export async function syncOfflineQueue(): Promise<SyncResult> {
  const connected = await hasNetworkConnection();
  if (!connected) {
    const queue = await getQueue();
    return { synced: 0, failed: 0, remaining: queue.length };
  }

  let synced = 0;
  let failed = 0;
  const queue = await getQueue();
  let pendingAttendance = await getPendingAttendance();

  for (const item of queue) {
    try {
      const resolvedUrl = resolveQueueUrl(item, pendingAttendance);
      const response = await sendRequest(item.method, resolvedUrl, item.data);

      if (item.type === 'attendance-time-in') {
        const record = extractAttendanceId(response.data);
        if (record?.id) {
          pendingAttendance = pendingAttendance
            ? { ...pendingAttendance, synced: true, serverId: record.id }
            : null;
          if (pendingAttendance) {
            await savePendingAttendance(pendingAttendance);
          }
          const queueAfterTimeIn = await getQueue();
          for (const queued of queueAfterTimeIn) {
            if (
              queued.type === 'attendance-time-out' &&
              queued.localAttendanceId === item.localAttendanceId
            ) {
              await updateQueueItem(queued.id, {
                url: `/attendance/${record.id}/time-out`,
                attendanceServerId: record.id,
              });
            }
          }
        }
      }

      if (item.type === 'attendance-time-out') {
        await clearPendingAttendance();
        pendingAttendance = null;
      }

      await removeFromQueue(item.id);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) {
        break;
      }
      failed += 1;
      await removeFromQueue(item.id);
    }
  }

  const remaining = (await getQueue()).length;
  return { synced, failed, remaining };
}

function resolveQueueUrl(
  item: QueuedRequest,
  pending: Awaited<ReturnType<typeof getPendingAttendance>>
): string {
  if (item.type === 'attendance-time-out' && pending?.serverId) {
    return `/attendance/${pending.serverId}/time-out`;
  }
  if (
    item.type === 'attendance-time-out' &&
    item.attendanceServerId &&
    String(item.url).includes('local-')
  ) {
    return `/attendance/${item.attendanceServerId}/time-out`;
  }
  return item.url;
}

function extractAttendanceId(data: unknown): { id?: number } | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.attendance && typeof obj.attendance === 'object') {
    const att = obj.attendance as { id?: number };
    return att.id ? { id: att.id } : null;
  }
  if (typeof obj.id === 'number') return { id: obj.id };
  return null;
}

export async function getOfflineQueueSnapshot(): Promise<QueuedRequest[]> {
  return getQueue();
}

export { updateQueueItem };
