import { getDatabase, generateUUID } from '../database/database';
import { synchronize } from '../services/syncService';

const TaskStorage = {
  loadLists: async (userEmail) => {
    try {
      const db = await getDatabase();
      
      // Get all task lists for this user
      const lists = await db.getAllAsync(
        'SELECT * FROM task_lists WHERE email = ? AND is_deleted = 0 ORDER BY created_at',
        [userEmail]
      );

      // For each list, get its tasks and subtasks
      const result = await Promise.all(lists.map(async (list) => {
        const tasks = await db.getAllAsync(
          'SELECT * FROM tasks WHERE list_id = ? AND is_deleted = 0 ORDER BY created_at',
          [list.id]
        );
        
        const tasksWithSubtasks = await Promise.all(tasks.map(async (task) => {
          const subtasks = await db.getAllAsync(
            'SELECT * FROM subtasks WHERE task_id = ? AND is_deleted = 0 ORDER BY created_at',
            [task.id]
          );
          
          return {
            id: task.id,
            name: task.name,
            date: new Date(task.date),
            isCompleted: task.is_completed === 1,
            isExpanded: task.is_expanded === 1,
            created_at: task.created_at,
            updated_at: task.updated_at,
            server_id: task.server_id,
            subtasks: subtasks.map(subtask => ({
              id: subtask.id,
              name: subtask.name,
              date: new Date(subtask.date),
              isCompleted: subtask.is_completed === 1,
              created_at: subtask.created_at,
              updated_at: subtask.updated_at,
              server_id: subtask.server_id
            }))
          };
        }));
        
        return {
          id: list.id,
          name: list.name,
          created_at: list.created_at,
          updated_at: list.updated_at,
          server_id: list.server_id,
          tasks: tasksWithSubtasks
        };
      }));

      return result;
    } catch (error) {
      console.error('Error loading lists:', error);
      throw error;
    }
  },

  saveLists: async (lists, userEmail) => {
    try {
      if (!userEmail) {
        throw new Error("User email is required to save lists");
      }

      const db = await getDatabase();
      const timestamp = Date.now();

      // Check if there's already a transaction in progress
      let inTransaction = false;
      try {
        // Try to begin a transaction - if one is already in progress, this will fail
        await db.runAsync('BEGIN TRANSACTION');
        inTransaction = true;
      } catch (error) {
        // If there's already a transaction, just continue without starting a new one
        if (!error.message.includes('within a transaction')) {
          throw error; 
        }
        console.log('Transaction already in progress, continuing...');
      }

      try {

        // Get current lists from database
        const currentLists = await db.getAllAsync(
          'SELECT id FROM task_lists WHERE email = ? AND is_deleted = 0', 
          [userEmail]
        );
        
        // Create map of lists being saved
        const newListIds = new Set(lists.map(list => list.id));
        
        // Mark lists as deleted if they exist in DB but not in current state
        for (const dbList of currentLists) {
          if (!newListIds.has(dbList.id)) {
            console.log(`Marking list ${dbList.id} as deleted`);
            await db.runAsync(
              'UPDATE task_lists SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE id = ?', 
              [timestamp, dbList.id]
            );
          }
        }
        
        // For each list in the current state
        for (const list of lists) {
          const listId = list.id || generateUUID();
          
          // Get current tasks from this list in database
          const currentTasks = await db.getAllAsync(
            'SELECT id FROM tasks WHERE list_id = ? AND is_deleted = 0',
            [listId]
          );
          
          // Create map of tasks being saved for this list
          const newTaskIds = new Set(list.tasks.map(task => task.id));
          
          // Mark tasks as deleted if they exist in DB but not in current list
          for (const dbTask of currentTasks) {
            if (!newTaskIds.has(dbTask.id)) {
              console.log(`Marking task ${dbTask.id} as deleted`);
              await db.runAsync(
                'UPDATE tasks SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE id = ?',
                [timestamp, dbTask.id]
              );
            }
          }

          await db.runAsync(
            `INSERT OR REPLACE INTO task_lists 
            (id, email, name, created_at, updated_at, is_deleted, server_id, needs_sync) 
            VALUES (?, ?, ?, ?, ?, 0, ?, 1)`,
            [
              listId, 
              userEmail, 
              list.name, 
              list.created_at || timestamp, 
              timestamp,
              list.server_id || null
            ]
          );
          
          // For each task in this list
          for (const task of list.tasks) {
            const taskId = task.id || generateUUID();
            
            // Get current subtasks for this task in database
            const currentSubtasks = await db.getAllAsync(
              'SELECT id FROM subtasks WHERE task_id = ? AND is_deleted = 0',
              [taskId]
            );
            
            // Create map of subtasks being saved for this task
            const newSubtaskIds = new Set(task.subtasks.map(subtask => subtask.id));
            
            // Mark subtasks as deleted if they exist in DB but not in current task
            for (const dbSubtask of currentSubtasks) {
              if (!newSubtaskIds.has(dbSubtask.id)) {
                console.log(`Marking subtask ${dbSubtask.id} as deleted`);
                await db.runAsync(
                  'UPDATE subtasks SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE id = ?',
                  [timestamp, dbSubtask.id]
                );
              }
            }
            
            // Insert or update task
            await db.runAsync(
              `INSERT OR REPLACE INTO tasks 
              (id, list_id, name, date, is_completed, is_expanded, created_at, updated_at, is_deleted, server_id, needs_sync) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
              [
                taskId, 
                listId, 
                task.name, 
                task.date.getTime(), 
                task.isCompleted ? 1 : 0, 
                task.isExpanded ? 1 : 0, 
                task.created_at || timestamp, 
                timestamp,
                task.server_id || null
              ]
            );
            
            // For each subtask
            for (const subtask of task.subtasks) {
              const subtaskId = subtask.id || generateUUID();
              
              // Insert or update subtask
              await db.runAsync(
                `INSERT OR REPLACE INTO subtasks 
                (id, task_id, name, date, is_completed, created_at, updated_at, is_deleted, server_id, needs_sync) 
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1)`,
                [
                  subtaskId, 
                  taskId, 
                  subtask.name, 
                  subtask.date.getTime(), 
                  subtask.isCompleted ? 1 : 0, 
                  subtask.created_at || timestamp, 
                  timestamp,
                  subtask.server_id || null
                ]
              );
            }
          }
        }
        
        // Only commit if we started the transaction
        if (inTransaction) {
          await db.runAsync('COMMIT');
        }
        
        // Trigger sync after saving - correctly with await and hasChanges flag
        try {
          console.log("Triggering sync after database update");
          await synchronize({ 
            skipOnOffline: true, 
            silent: true, 
            hasChanges: true 
          });
        } catch (syncError) {
          console.error("Error syncing after save:", syncError);
          // Continue even if sync fails - data is saved locally with needs_sync=1
        }
      } catch (error) {
        // Only rollback if we started the transaction
        if (inTransaction) {
          try {
            await db.runAsync('ROLLBACK');
          } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error saving lists:', error);
      throw error;
    }
  },

  clearAll: async (userEmail) => {
    try {
      const db = await getDatabase();
      const timestamp = Date.now();
      
      // Check if there's already a transaction in progress
      let inTransaction = false;
      try {
        await db.runAsync('BEGIN TRANSACTION');
        inTransaction = true;
      } catch (error) {
        if (!error.message.includes('within a transaction')) {
          throw error;
        }
        console.log('Transaction already in progress, continuing...');
      }
      
      try {
        await db.runAsync(
          'UPDATE task_lists SET is_deleted = 1, updated_at = ?, needs_sync = 1 WHERE email = ?', 
          [timestamp, userEmail]
        );
        
        await db.runAsync(
          `UPDATE tasks SET is_deleted = 1, updated_at = ?, needs_sync = 1 
           WHERE list_id IN (SELECT id FROM task_lists WHERE email = ?)`, 
          [timestamp, userEmail]
        );
        
        await db.runAsync(
          `UPDATE subtasks SET is_deleted = 1, updated_at = ?, needs_sync = 1 
           WHERE task_id IN (
             SELECT id FROM tasks 
             WHERE list_id IN (SELECT id FROM task_lists WHERE email = ?)
           )`, 
          [timestamp, userEmail]
        );
        
        if (inTransaction) {
          await db.runAsync('COMMIT');
        }
        
        // Trigger sync after clearing
        synchronize();
      } catch (error) {
        if (inTransaction) {
          try {
            await db.runAsync('ROLLBACK');
          } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
};

export default TaskStorage;