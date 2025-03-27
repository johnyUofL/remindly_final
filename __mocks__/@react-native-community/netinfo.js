const netInfo = {
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn().mockReturnValue(() => {})
};

export default netInfo; 