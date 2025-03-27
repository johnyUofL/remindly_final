import * as SecureStore from "expo-secure-store";
import { getDatabase } from "../database/database";
import NetInfo from "@react-native-community/netinfo";

const BASE_URL = "https://taskmanageruofl-af62f00a6541.herokuapp.com";
const TOKEN_EXPIRATION_DAYS = 7;

let pendingChanges = false;

// Store token with timestamp
export const storeAuthToken = async (token) => {
  try {
    if (!token) return false;
    
    // Store the token
    await SecureStore.setItemAsync("authToken", token);
    
    // Store the timestamp for expiration checking
    const now = Date.now().toString();
    await SecureStore.setItemAsync("tokenTimestamp", now);
    
    return true;
  } catch (error) {
    console.error("Error storing auth token:", error);
    return false;
  }
};

// Simplified token getter without expiration checks for sign-in
export const getAuthToken = async () => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    return token;
  } catch (error) {
    console.error("Error retrieving auth token:", error);
    return null;
  }
};

// Check if token is valid (for sync operations)
export const isTokenValid = async () => {
  try {
    const token = await getAuthToken();
    
    // Check if token exists
    if (!token) {
      console.log("No token found");
      return false;
    }
    
    // Check token expiration if we have a timestamp
    const tokenTimestamp = await SecureStore.getItemAsync("tokenTimestamp");
    if (tokenTimestamp) {
      const tokenDate = new Date(parseInt(tokenTimestamp));
      const now = new Date();
      const diffDays = Math.floor((now - tokenDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays >= TOKEN_EXPIRATION_DAYS) {
        console.log(`Token expired: ${diffDays} days old (max: ${TOKEN_EXPIRATION_DAYS})`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error checking token validity:", error);
    return false;
  }
};

// Export for testing
export const isOnline = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected;
  } catch (error) {
    console.error("Error checking online status:", error);
    return false;
  }
};

// Export for testing
export const syncToServer = async (forceOfflineMode = false) => {
  try {
    // Skip sync if offline and don't report failure
    if (forceOfflineMode || !(await isOnline())) {
      console.log("Device is offline, skipping syncToServer");
      return { success: true, offline: true };
    }

    // Check token validity
    const tokenValid = await isTokenValid();
    if (!tokenValid) {
      return { success: false, message: 'Authentication token invalid or expired' };
    }
    
    const token = await getAuthToken();
    const db = await getDatabase();

    console.log("Syncing deleted items to server...");
    
    // Get deleted items for each table separately with proper type information
    const deletedLists = await db.getAllAsync(
      'SELECT id, server_id, "task_list" AS type FROM task_lists WHERE is_deleted = 1 AND server_id IS NOT NULL'
    );
    console.log(`Found ${deletedLists.length} deleted lists to sync`);

    const deletedTasks = await db.getAllAsync(
      'SELECT id, server_id, "task" AS type FROM tasks WHERE is_deleted = 1 AND server_id IS NOT NULL'
    );
    console.log(`Found ${deletedTasks.length} deleted tasks to sync`);

    const deletedSubtasks = await db.getAllAsync(
      'SELECT id, server_id, "subtask" AS type FROM subtasks WHERE is_deleted = 1 AND server_id IS NOT NULL'
    );
    console.log(`Found ${deletedSubtasks.length} deleted subtasks to sync`);

    // Combine all deleted items
    const deletedItems = [...deletedLists, ...deletedTasks, ...deletedSubtasks];
    console.log(`Total deleted items to sync: ${deletedItems.length}`);

    // Process each deleted item
    for (const item of deletedItems) {
      try {
        console.log(`Sending delete request for ${item.type} with server_id ${item.server_id}`);
        
        const response = await fetch(`${BASE_URL}/delete/${item.server_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          console.log(`Successfully deleted item ${item.server_id} from server`);
          
          // Now completely remove the item from local database
          if (item.type === 'task_list') {
            await db.runAsync('DELETE FROM task_lists WHERE id = ?', [item.id]);
          } else if (item.type === 'task') {
            await db.runAsync('DELETE FROM tasks WHERE id = ?', [item.id]);
          } else if (item.type === 'subtask') {
            await db.runAsync('DELETE FROM subtasks WHERE id = ?', [item.id]);
          }
        } else {
          const responseText = await response.text();
          console.error(`Failed to delete item ${item.server_id} (${item.type}): ${response.status} - ${responseText}`);
          
          // If the item doesn't exist on server (404) or other success-like error, 
          // we can still delete it locally
          if (response.status === 404 || response.status === 410) {
            console.log(`Item ${item.server_id} not found on server, deleting locally anyway`);
            if (item.type === 'task_list') {
              await db.runAsync('DELETE FROM task_lists WHERE id = ?', [item.id]);
            } else if (item.type === 'task') {
              await db.runAsync('DELETE FROM tasks WHERE id = ?', [item.id]);
            } else if (item.type === 'subtask') {
              await db.runAsync('DELETE FROM subtasks WHERE id = ?', [item.id]);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing delete for ${item.type} ${item.server_id}:`, error);
        // Continue with other items
      }
    }

    // Now continue with the rest of the sync process for non-deleted items
    const unsyncedLists = await db.getAllAsync(
      'SELECT * FROM task_lists WHERE needs_sync = 1 AND is_deleted = 0'
    );
    for (const list of unsyncedLists) {
      try {
        const response = await fetch(`${BASE_URL}/task_lists`, {
          method: list.server_id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: list.server_id || list.id,
            name: list.name,
            email: list.email,
            created_at: list.created_at,
            updated_at: list.updated_at,
          }),
        });
        if (response.ok) {
          const serverData = await response.json();
          await db.runAsync(
            'UPDATE task_lists SET server_id = ?, needs_sync = 0 WHERE id = ?',
            [serverData.id, list.id]
          );
        } else {
          console.error(`Failed to sync list ${list.id}: ${response.status} - ${await response.text()}`);
        }
      } catch (error) {
        console.error(`Error syncing list ${list.id}:`, error);
        // Continue with other items
      }
    }

    const unsyncedTasks = await db.getAllAsync(
      'SELECT t.*, tl.server_id AS list_server_id FROM tasks t JOIN task_lists tl ON t.list_id = tl.id WHERE t.needs_sync = 1 AND t.is_deleted = 0'
    );
    for (const task of unsyncedTasks) {
      const response = await fetch(`${BASE_URL}/tasks`, {
        method: task.server_id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: task.server_id || task.id,
          list_id: task.list_server_id,
          name: task.name,
          date: task.date,
          is_completed: task.is_completed,
          created_at: task.created_at,
          updated_at: task.updated_at,
        }),
      });
      if (response.ok) {
        const serverData = await response.json();
        await db.runAsync(
          'UPDATE tasks SET server_id = ?, needs_sync = 0 WHERE id = ?',
          [serverData.id, task.id]
        );
      } else {
        console.error(`Failed to sync task ${task.id}: ${response.status} - ${await response.text()}`);
      }
    }

    const unsyncedSubtasks = await db.getAllAsync(
      'SELECT s.*, t.server_id AS task_server_id FROM subtasks s JOIN tasks t ON s.task_id = t.id WHERE s.needs_sync = 1 AND s.is_deleted = 0'
    );
    for (const subtask of unsyncedSubtasks) {
      const response = await fetch(`${BASE_URL}/subtasks`, {
        method: subtask.server_id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: subtask.server_id || subtask.id,
          task_id: subtask.task_server_id,
          name: subtask.name,
          date: subtask.date,
          is_completed: subtask.is_completed,
          created_at: subtask.created_at,
          updated_at: subtask.updated_at,
        }),
      });
      if (response.ok) {
        const serverData = await response.json();
        await db.runAsync(
          'UPDATE subtasks SET server_id = ?, needs_sync = 0 WHERE id = ?',
          [serverData.id, subtask.id]
        );
      } else {
        console.error(`Failed to sync subtask ${subtask.id}: ${response.status} - ${await response.text()}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error syncing to server:", error);
    return { success: false, message: error.message, offline: !(await isOnline()) };
  }
};

// Export for testing
export const syncFromServer = async (forceOfflineMode = false) => {
  try {
    // Skip sync if offline and don't report failure
    if (forceOfflineMode || !(await isOnline())) {
      console.log("Device is offline, skipping syncFromServer");
      return { success: true, offline: true };
    }

    // Check token validity
    const tokenValid = await isTokenValid();
    if (!tokenValid) {
      return { success: false, message: 'Authentication token invalid or expired' };
    }
    
    const token = await getAuthToken();
    const db = await getDatabase();

    const lastSync = await SecureStore.getItemAsync("lastSync") || "0";
    const url = `${BASE_URL}/sync?since=${lastSync}`;
    console.log(`Sync: Fetching data from: ${url}`);
    console.log(`Sync: Using token: ${token}`);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`Sync: Response status: ${response.status}`);
    const responseText = await response.text();
    console.log(`Sync: Response body: ${responseText}`);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${responseText}`);
    }

    const serverData = JSON.parse(responseText);
    console.log("Sync: Parsed data:", serverData);

    for (const list of serverData.task_lists) {
      await db.runAsync(
        `INSERT OR REPLACE INTO task_lists (id, email, name, created_at, updated_at, is_deleted, server_id, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [list.local_id || list.id, list.email, list.name, list.created_at, list.updated_at, list.is_deleted ? 1 : 0, list.id]
      );
    }

    for (const task of serverData.tasks) {
      const list = await db.getFirstAsync('SELECT id FROM task_lists WHERE server_id = ?', [task.list_id]);
      await db.runAsync(
        `INSERT OR REPLACE INTO tasks (id, list_id, name, date, is_completed, is_expanded, created_at, updated_at, is_deleted, server_id, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [task.local_id || task.id, list.id, task.name, task.date, task.is_completed, task.is_expanded || 0, task.created_at, task.updated_at, task.is_deleted ? 1 : 0, task.id]
      );
    }

    for (const subtask of serverData.subtasks) {
      const task = await db.getFirstAsync('SELECT id FROM tasks WHERE server_id = ?', [subtask.task_id]);
      await db.runAsync(
        `INSERT OR REPLACE INTO subtasks (id, task_id, name, date, is_completed, created_at, updated_at, is_deleted, server_id, needs_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [subtask.local_id || subtask.id, task.id, subtask.name, subtask.date, subtask.is_completed, subtask.created_at, subtask.updated_at, subtask.is_deleted ? 1 : 0, subtask.id]
      );
    }

    await SecureStore.setItemAsync("lastSync", Date.now().toString());
    console.log("Sync from server completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Error syncing from server:", error);
    return { success: false, message: error.message, offline: !(await isOnline()) };
  }
};

// The main synchronize function that the app uses
export const synchronize = async (options = {}) => {
  const { skipOnOffline = true, silent = false, hasChanges = false } = options;
  
  try {
    // Check connection
    const isConnected = await isOnline();
    const forceOfflineMode = !isConnected;
    
    // Log sync attempt with more details
    console.log(`Starting sync ${hasChanges ? "(with changes)" : ""} - online: ${isConnected}`);
    
    // If we're offline and configured to skip, return success silently
    if (!isConnected && skipOnOffline) {
      console.log("Device is offline, will sync later");
      return { success: true, offline: true, message: 'Device is offline, using local data' };
    }
    
    // If we're offline and not configured to skip, only return error if not silent
    if (!isConnected && !skipOnOffline && !silent) {
      return { success: false, offline: true, message: 'Device is offline' };
    }
    
    // Check token before attempting sync
    const tokenValid = await isTokenValid();
    if (isConnected && !tokenValid) {
      console.log("Sync cancelled: Authentication token invalid or expired");
      return { success: false, message: 'Authentication token invalid or expired' };
    }
    
    // Always attempt to sync in both directions, even if offline
    console.log("Starting sync to server...");
    const toServerResult = await syncToServer(forceOfflineMode);
    
    // Check if the token was rejected during sync to server
    if (!toServerResult.success && toServerResult.message?.includes('token')) {
      console.log("Sync aborted: Token error during sync to server");
      return { success: false, message: toServerResult.message, tokenError: true };
    }
    
    console.log("Starting sync from server...");
    const fromServerResult = await syncFromServer(forceOfflineMode);
    
    // Only consider it a failure if online sync actually fails (not just because we're offline)
    if (isConnected && (!toServerResult.success || !fromServerResult.success)) {
      const errorMessage = toServerResult.message || fromServerResult.message || 'Sync failed';
      console.log(`Sync failed: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }
    
    if (isConnected) {
      await SecureStore.setItemAsync("lastSync", Date.now().toString());
    }
    
    console.log("Synchronization completed successfully (offline mode: " + forceOfflineMode + ")");
    return { success: true, offline: forceOfflineMode };
  } catch (error) {
    console.error("Synchronization failed:", error);
    return { 
      success: false, 
      message: error.message || "Unknown error during synchronization",
      isServerError: error.message?.includes("503") || false,
      offline: !(await isOnline())
    };
  }
};

export const startBackgroundSync = () => {
  let syncInProgress = false;
  
  try {
    setInterval(async () => {
      try {
        // Don't sync if another sync is already in progress
        if (syncInProgress) {
          console.log("Background sync skipped: another sync already in progress");
          return;
        }
        
        // Check if we should sync (we're online and have valid token)
        if (await isOnline() && await isTokenValid()) {
          // Force sync if there are pending changes
          syncInProgress = true;
          console.log("Starting background sync" + (pendingChanges ? " (pending changes)" : ""));
          
          try {
            await synchronize({ 
              silent: true, 
              skipOnOffline: true,
              // Force sync if there are pending changes
              force: pendingChanges
            });
          } finally {
            syncInProgress = false;
          }
        }
      } catch (error) {
        syncInProgress = false;
        console.error("Background sync error:", error);
      }
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error("Failed to start background sync:", error);
  }
};

// Helper functions for handling sign-out

// Sign-out function that works offline or online
export const handleSignOut = async () => {
  try {
    // Check if we're online and token is valid
    const isConnected = await isOnline();
    const isValid = await isTokenValid();
    
    // Try to sync one last time if we're online and token is valid
    if (isConnected && isValid) {
      try {
        await synchronize({ skipOnOffline: true, silent: true });
      } catch (error) {
        console.error("Final sync before sign-out failed:", error);
        // Continue with sign-out even if sync fails
      }
    }
    
    // Always clear auth data
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("tokenTimestamp");
    await SecureStore.deleteItemAsync("lastSync");
    
    return { success: true };
  } catch (error) {
    console.error("Error during sign-out:", error);
    // Still return success even if there's an error
    // This ensures the user can sign out no matter what
    return { success: true };
  }
};

// Add this new function to handle token refreshing
export const refreshTokenIfNeeded = async () => {
  try {
    const isValid = await isTokenValid();
    if (!isValid) {
      // Token is not valid - need to clear it so the user can log in again
      console.log("Token is invalid or expired, clearing for fresh login");
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("tokenTimestamp");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return false;
  }
};