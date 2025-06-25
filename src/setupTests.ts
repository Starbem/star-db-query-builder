// Jest setup file for star-db-query-builder tests

// Mock console methods to reduce noise in tests
const originalConsole = { ...console }

beforeAll(() => {
  // Suppress console.log, console.warn, and console.error during tests
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => {
  // Restore original console methods
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
})

// Export test utilities for use in test files
export const testUtils = {
  // Helper to create mock database client
  createMockDbClient: (clientType: 'pg' | 'mysql' = 'pg') => ({
    clientType,
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  }),

  // Helper to create sample data
  createSampleUser: () => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'john.doe@example.com',
    status: 'active',
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-01-01'),
  }),

  // Helper to create sample conditions
  createSampleConditions: () => ({
    status: { operator: '=', value: 'active' },
    email: { operator: 'ILIKE', value: '%example.com' },
  }),
}
