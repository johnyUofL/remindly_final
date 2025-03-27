import TaskStorage from '../app/taskStorage';
import { getDatabase } from '../database/database';
import { synchronize } from '../services/syncService';

// Mock databases
jest.mock('../database/database', () => ({
  getDatabase: jest.fn(),
  generateUUID: jest.fn().mockReturnValue('mock-uuid-123')
}));

jest.mock('../services/syncService', () => ({
  synchronize: jest.fn().mockResolvedValue({ success: true })
}));

describe('TaskStorage', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock database responses
    mockDb = {
      getAllAsync: jest.fn().mockImplementation((query, params) => {
        if (query.includes('task_lists')) {
          return Promise.resolve([
            { id: 'list-1', name: 'Work Tasks', created_at: 1000, updated_at: 2000 }
          ]);
        } else if (query.includes('tasks')) {
          return Promise.resolve([
            { 
              id: 'task-1', 
              list_id: 'list-1', 
              name: 'Test Task', 
              date: 1670000000000,
              is_completed: 0,
              is_expanded: 0,
              created_at: 1000,
              updated_at: 2000
            }
          ]);
        } else if (query.includes('subtasks')) {
          return Promise.resolve([
            {
              id: 'subtask-1',
              task_id: 'task-1',
              name: 'Test Subtask',
              date: 1670000000000,
              is_completed: 0,
              created_at: 1000,
              updated_at: 2000
            }
          ]);
        }
        return Promise.resolve([]);
      }),
      runAsync: jest.fn().mockResolvedValue({}),
      getFirstAsync: jest.fn().mockImplementation((query) => {
        if (query.includes('users')) {
          return Promise.resolve({ id: 'user-1', email: 'test@example.com' });
        }
        return Promise.resolve(null);
      })
    };

    getDatabase.mockResolvedValue(mockDb);
  });

  test('loadLists should return lists with tasks and subtasks', async () => {
    const email = 'test@example.com';
    const lists = await TaskStorage.loadLists(email);
    
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM task_lists'),
      [email]
    );
    
    expect(lists).toHaveLength(1);
    expect(lists[0].id).toBe('list-1');
    expect(lists[0].name).toBe('Work Tasks');
    expect(lists[0].tasks).toHaveLength(1);
    expect(lists[0].tasks[0].subtasks).toHaveLength(1);
  });

  test('saveLists should store lists to database', async () => {
    const email = 'test@example.com';
    const lists = [
      {
        id: 'list-1',
        name: 'Test List',
        tasks: [
          {
            id: 'task-1',
            name: 'Test Task',
            date: new Date(1670000000000),
            isCompleted: false,
            isExpanded: false,
            subtasks: [
              {
                id: 'subtask-1',
                name: 'Test Subtask',
                date: new Date(1670000000000),
                isCompleted: false
              }
            ]
          }
        ]
      }
    ];
    
    await TaskStorage.saveLists(lists, email);
    
    // Check that transaction was started
    expect(mockDb.runAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    
    // Check that lists were saved
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO task_lists'),
      expect.arrayContaining(['list-1', email, 'Test List'])
    );
    
    // Check that tasks were saved
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO tasks'),
      expect.arrayContaining(['task-1', 'list-1', 'Test Task'])
    );
    
    // Check that subtasks were saved
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO subtasks'),
      expect.arrayContaining(['subtask-1', 'task-1', 'Test Subtask'])
    );
    
    // Check that transaction was committed
    expect(mockDb.runAsync).toHaveBeenCalledWith('COMMIT');
    
    // Check that sync was triggered
    expect(synchronize).toHaveBeenCalledWith(
      expect.objectContaining({
        skipOnOffline: true,
        silent: true,
        hasChanges: true
      })
    );
  });

  test('clearAll should mark all items as deleted', async () => {
    const email = 'test@example.com';
    
    await TaskStorage.clearAll(email);
    
    // Check that transaction was started
    expect(mockDb.runAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
    
    // Check that lists were marked as deleted
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE task_lists SET is_deleted = 1'),
      expect.arrayContaining([expect.any(Number), email])
    );
    
    // Check that tasks were marked as deleted
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET is_deleted = 1'),
      expect.arrayContaining([expect.any(Number), email])
    );
    
    // Check that subtasks were marked as deleted
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE subtasks SET is_deleted = 1'),
      expect.arrayContaining([expect.any(Number), email])
    );
    
    // Check that transaction was committed
    expect(mockDb.runAsync).toHaveBeenCalledWith('COMMIT');
    
    // Check that sync was triggered
    expect(synchronize).toHaveBeenCalled();
  });
});