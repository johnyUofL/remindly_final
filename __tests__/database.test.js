import { getDatabase, initDatabase, generateUUID } from '../database/database';

// Mock expo-sqlite
jest.mock('expo-sqlite');

describe('Database Module', () => {
  // Access the mock
  const sqliteMock = require('expo-sqlite');
  const mockDb = sqliteMock.mockDb;
  const mockOpenDb = sqliteMock.openDatabaseAsync;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset the state in the database module
    jest.isolateModules(() => {
      require('../database/database');
    });
  });

  test('generateUUID should return a valid UUID string', () => {
    const uuid = generateUUID();
    expect(typeof uuid).toBe('string');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('getDatabase should initialize database if not already initialized', async () => {
    const db = await getDatabase();
    
    // Verify database was opened
    expect(mockOpenDb).toHaveBeenCalledWith('remindly.db');
    expect(db).toBe(mockDb);
    
    // Reset the mock to verify it's not called again
    mockOpenDb.mockClear();
    const db2 = await getDatabase();

    expect(db2).toBe(db);
    expect(mockOpenDb).not.toHaveBeenCalled();
  });

  test('initDatabase should create the required tables', async () => {
    // Mock the database
    const mockDb = {
      execAsync: jest.fn().mockResolvedValue({ rowsAffected: 1 }),
    };
    
    // console.log to verify execution flow
    const originalConsoleLog = console.log;
    console.log = jest.fn();
    
    try {
      // Call the function
      await initDatabase(mockDb);
    
      expect(console.log).toHaveBeenCalledWith('All tables created successfully');
      expect(console.log).toHaveBeenCalledWith('Database initialized successfully');
      

    } finally {
      console.log = originalConsoleLog;
    }
  });
});