import { deleteSecureItem, getSecureItem, setSecureItem } from './appStorage';

const USER_KEY = 'user';
const OFFLINE_CREDS_KEY = 'offline_credentials';

export type OfflineCredentials = {
  username: string;
  password: string;
  firstname?: string;
  lastname?: string;
  userType?: 'staff' | 'rider' | 'customer';
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

export async function saveOfflineCredentials(
  username: string, 
  password: string, 
  firstname?: string, 
  lastname?: string,
  userType?: 'staff' | 'rider' | 'customer'
): Promise<void> {
  const creds = { 
    username: username.trim(), 
    password, 
    firstname, 
    lastname,
    userType: userType || 'staff' // Default to 'staff' if not provided
  };
  await setSecureItem(OFFLINE_CREDS_KEY, JSON.stringify(creds));
  console.log('[OFFLINE CREDS] Saved credentials for username:', username, 'userType:', userType || 'staff');
}

export async function getOfflineCredentials(): Promise<OfflineCredentials | null> {
  const raw = await getSecureItem(OFFLINE_CREDS_KEY);
  if (!raw) {
    console.log('[OFFLINE CREDS] No stored credentials found');
    return null;
  }
  try {
    const creds = JSON.parse(raw) as OfflineCredentials;
    console.log('[OFFLINE CREDS] Retrieved credentials for username:', creds.username, 'userType:', creds.userType || 'staff');
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
  password: string,
  userType?: 'staff' | 'rider' | 'customer'
): Promise<boolean> {
  const creds = await getOfflineCredentials();
  if (!creds) {
    return false;
  }
  const trimmedUsername = username.trim();
  
  // Validate username and password
  const isValid = creds.username === trimmedUsername && creds.password === password;
  
  // If userType is provided, also validate that the stored userType matches
  if (isValid && userType) {
    const storedUserType = creds.userType || 'staff';
    if (storedUserType !== userType) {
      console.log('[OFFLINE CREDS] UserType mismatch. Expected:', userType, 'Found:', storedUserType);
      return false;
    }
  }
  
  return isValid;
}

// Optional: Add a function to get the stored user type
export async function getStoredUserType(): Promise<'staff' | 'rider' | 'customer' | null> {
  const creds = await getOfflineCredentials();
  if (!creds) return null;
  return creds.userType || 'staff';
}

// Optional: Add a function to update just the user type
export async function updateStoredUserType(userType: 'staff' | 'rider' | 'customer'): Promise<void> {
  const creds = await getOfflineCredentials();
  if (creds) {
    const updatedCreds = { ...creds, userType };
    await setSecureItem(OFFLINE_CREDS_KEY, JSON.stringify(updatedCreds));
    console.log('[OFFLINE CREDS] Updated userType to:', userType);
  }
}