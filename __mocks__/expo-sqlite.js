// Mock database object with all required methods
const mockDb = {
  execAsync: jest.fn().mockResolvedValue([]),
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn().mockResolvedValue({})
};

// Export the mock functions
const openDatabaseAsync = jest.fn().mockResolvedValue(mockDb);

module.exports = {
  openDatabaseAsync,
  mockDb 
};