import * as syncService from '../services/syncService';
import { getDatabase } from '../database/database';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';

// Mock the database module
jest.mock('../database/database', () => ({
  getDatabase: jest.fn()
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('Sync Service', () => {
  let mockDb;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up database mock
    mockDb = {
      getAllAsync: jest.fn().mockImplementation((query, params) => {
        // Different mock responses based on what's being queried
        if (query.includes('task_lists')) {
          return Promise.resolve([
            { id: 'list-1', email: 'test@example.com', name: 'Test List', updated_at: 1000, needs_sync: 1 }
          ]);
        } else if (query.includes('tasks')) {
          return Promise.resolve([
            { id: 'task-1', list_id: 'list-1', name: 'Test Task', updated_at: 1000, needs_sync: 1 }
          ]);
        }
        return Promise.resolve([]);
      }),
      getFirstAsync: jest.fn().mockImplementation((query, params) => {
        if (query.includes('users')) {
          return Promise.resolve({ id: 'user-1', email: 'test@example.com' });
        } else if (query.includes('task_lists')) {
          return Promise.resolve({ id: 'local-list-1' });
        } else if (query.includes('tasks')) {
          return Promise.resolve({ id: 'local-task-1' });
        }
        return Promise.resolve(null);
      }),
      runAsync: jest.fn().mockResolvedValue({ rowsAffected: 1 })
    };
    
    // Set up the database mock to return our mockDb
    getDatabase.mockResolvedValue(mockDb);
    
    // Mock SecureStore with appropriate token
    SecureStore.getItemAsync.mockImplementation((key) => {
      if (key === 'authToken') return Promise.resolve('test-token');
      if (key === 'lastSync') return Promise.resolve('0');
      return Promise.resolve(null);
    });
    
    // Mock NetInfo to report being online
    NetInfo.fetch.mockResolvedValue({ isConnected: true });
    
    // Mock fetch with successful response for sync requests
    global.fetch.mockImplementation((url) => {
      // Different responses based on URL endpoint
      let responseData = {};
      
      if (url.includes('/sync')) {
        responseData = {
          task_lists: [
            { id: 'server-list-1', email: 'test@example.com', name: 'Server List', updated_at: 2000, is_deleted: false }
          ],
          tasks: [
            { id: 'server-task-1', list_id: 'server-list-1', name: 'Server Task', updated_at: 2000, is_deleted: false }
          ],
          subtasks: []
        };
      } else if (url.includes('/task_lists') || url.includes('/tasks') || url.includes('/subtasks')) {
        responseData = { id: 'server-id-123', success: true };
      }
      
      return Promise.resolve({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify(responseData)),
        json: jest.fn().mockResolvedValue(responseData)
      });
    });
  });
  
  test('isOnline should return connection status', async () => {
    // Test when online
    NetInfo.fetch.mockResolvedValueOnce({ isConnected: true });
    let result = await syncService.isOnline();
    expect(result).toBe(true);
    
    // Test when offline
    NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });
    result = await syncService.isOnline();
    expect(result).toBe(false);
    
    expect(NetInfo.fetch).toHaveBeenCalledTimes(2);
  });
  
  test('synchronize should handle offline state', async () => {
    // Mock being offline
    NetInfo.fetch.mockResolvedValueOnce({ isConnected: false });
    
    const result = await syncService.synchronize({ skipOnOffline: false });
    
    // offline status
    expect(result.success).toBe(false);
    expect(result.message).toBe('Device is offline');
    
    // Should not proceed with sync
    expect(global.fetch).not.toHaveBeenCalled();
  });
  
  test('syncToServer should sync local changes to server', async () => {
    // Ensure online status
    NetInfo.fetch.mockResolvedValue({ isConnected: true });
    
    const result = await syncService.syncToServer();
    
    // Should call fetch at least once for our mock task list
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/task_lists'),
      expect.objectContaining({
        method: expect.any(String),
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
    
    expect(mockDb.runAsync).toHaveBeenCalled();
    
    // return success
    expect(result.success).toBe(true);
  });
  
  test('syncFromServer should retrieve and process server changes', async () => {
    // online status
    NetInfo.fetch.mockResolvedValue({ isConnected: true });
    
    const result = await syncService.syncFromServer();
    
    // call fetch with sync endpoint
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/sync'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
    
    // save synced data to database
    expect(mockDb.runAsync).toHaveBeenCalled();
    
    // return success
    expect(result.success).toBe(true);
  });
  
  test('synchronize should perform full sync process', async () => {
    // Ensure online status
    NetInfo.fetch.mockResolvedValue({ isConnected: true });
    
    // Setup successful fetch responses
    global.fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ 
          task_lists: [], 
          tasks: [], 
          subtasks: [] 
        })),
        json: jest.fn().mockResolvedValue({
          id: 'server-id-123',
          success: true
        })
      })
    );
    
    const result = await syncService.synchronize();
    
    // call fetch at least once
    expect(global.fetch).toHaveBeenCalled();
    
    // return success
    expect(result.success).toBe(true);
  });
  
  test('synchronize should handle network errors', async () => {
    // online status
    NetInfo.fetch.mockResolvedValue({ isConnected: true });
    

    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    
    // Make subsequent fetches succeed, so the test can complete
    global.fetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(JSON.stringify({ 
          task_lists: [], 
          tasks: [], 
          subtasks: [] 
        })),
        json: jest.fn().mockResolvedValue({
          id: 'server-id-123',
          success: true
        })
      })
    );
    
    const result = await syncService.synchronize();
    
    expect(result.success).toBe(true);

    expect(global.fetch).toHaveBeenCalled();
  });
});