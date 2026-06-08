// Mock group before any imports that use it
jest.mock("../src/pente", () => ({
  getGroup: jest.fn(),
  tx: jest.fn(),
  call: jest.fn(),
  txWithLogs: jest.fn(),
}));
