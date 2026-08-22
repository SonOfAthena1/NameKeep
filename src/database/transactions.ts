import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

/** 
 * Runs a database write as one all-or-nothing operation on every platform. 
 */
export async function withWriteTransaction(
  db: SQLiteDatabase,
  task: (transaction: SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      await task(db);
    });
    return;
  }

  await db.withExclusiveTransactionAsync(task);
}
