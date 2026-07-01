import { deleteSecureItem, getSecureItem, setSecureItem } from './appStorage';

const USER_KEY = 'user';
const OFFLINE_CREDS_KEY = 'offline_credentials';

export type OfflineCredentials = {
  username: string;
  password: string;
  firstname?: string;
  lastname?: string;
};

export async function saveUser(user: unknown): Promise<void> {
  await setSecureItem(USER_KEY, JSON.stringify(user));
}

export async function getUser<T = Record<string, unknown>>(): Promise<T | null> {
  const raw = await getSecureItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function deleteUser(): Promise<void> {
  await deleteSecureItem(USER_KEY);
}

export async function saveOfflineCredentials(username: string, password: string, firstname?: string, lastname?: string): Promise<void> {
  const creds = { username: username.trim(), password, firstname, lastname };
  await setSecureItem(OFFLINE_CREDS_KEY, JSON.stringify(creds));
  console.log('[OFFLINE CREDS] Saved credentials for username:', username);
}

export async function getOfflineCredentials(): Promise<OfflineCredentials | null> {
  const raw = await getSecureItem(OFFLINE_CREDS_KEY);
  if (!raw) {
    console.log('[OFFLINE CREDS] No stored credentials found');
    return null;
  }
  try {
    const creds = JSON.parse(raw) as OfflineCredentials;
    console.log('[OFFLINE CREDS] Retrieved credentials for username:', creds.username);
    return creds;
  } catch (error) {
    console.error('[OFFLINE CREDS] Error parsing credentials:', error);
    return null;
  }
}

export async function deleteOfflineCredentials(): Promise<void> {
  await deleteSecureItem(OFFLINE_CREDS_KEY);
  console.log('[OFFLINE CREDS] Credentials deleted');
}

export async function validateOfflineLogin(
  username: string,
  password: string
): Promise<boolean> {
  const creds = await getOfflineCredentials();
  if (!creds) {
    return false;
  }
  const trimmedUsername = username.trim();
  return creds.username === trimmedUsername && creds.password === password;
}
