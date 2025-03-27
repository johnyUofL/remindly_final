const secureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
};

export const { getItemAsync, setItemAsync, deleteItemAsync } = secureStore; 