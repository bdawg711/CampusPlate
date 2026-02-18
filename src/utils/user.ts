import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = 'campusplate_user_id';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cachedUserId: string | null = null;

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  let userId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUUID();
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }
  cachedUserId = userId;
  return userId;
}
