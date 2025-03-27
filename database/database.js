import * as SQLite from 'expo-sqlite';

// Singleton instance
let db = null;

// Initialize the database tables
export const initDatabase = async () => {
  try {
    console.log('Initializing database...');
    const database = await SQLite.openDatabaseAsync('remindly.db');
    
    // Try a simple query to test if the database is working
    try {
      await database.execAsync('SELECT 1');
      console.log('Database connection test successful');
    } catch (testError) {
      console.error('Database connection test failed:', testError);
      throw new Error('Database connection failed: ' + testError.message);
    }
    
    try {
      // Create users table
      await database.execAsync(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0
      );`);
      
      // Create task_lists table
      await database.execAsync(`CREATE TABLE IF NOT EXISTS task_lists (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        server_id TEXT UNIQUE,
        needs_sync INTEGER DEFAULT 1,
        FOREIGN KEY (email) REFERENCES users (email)
      );`);
      
      // Create tasks table
      await database.execAsync(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        list_id TEXT NOT NULL,
        name TEXT NOT NULL,
        date INTEGER NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        is_expanded INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        server_id TEXT UNIQUE,
        needs_sync INTEGER DEFAULT 1,
        FOREIGN KEY (list_id) REFERENCES task_lists (id)
      );`);
      
      // Create subtasks table
      await database.execAsync(`CREATE TABLE IF NOT EXISTS subtasks (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        name TEXT NOT NULL,
        date INTEGER,
        is_completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        server_id TEXT UNIQUE,
        needs_sync INTEGER DEFAULT 1,
        FOREIGN KEY (task_id) REFERENCES tasks (id)
      );`);
      
      console.log('All tables created successfully');
    } catch (tableError) {
      console.error('Error creating tables:', tableError);
      throw new Error('Failed to create database tables: ' + tableError.message);
    }
    
    // Store the database instance
    db = database;
    console.log('Database initialized successfully');
    return database;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

// Get the database instance (initialize if needed)
export const getDatabase = async () => {
  if (!db) {
    try {
      db = await initDatabase();
    } catch (error) {
      console.error('Error getting database:', error);
      throw new Error('Failed to get database: ' + error.message);
    }
  }
  return db;
};

// Generate a UUID for new records
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Export a database object for compatibility with code expecting this
export const database = {
  initialize: initDatabase,
  getConnection: getDatabase
};
