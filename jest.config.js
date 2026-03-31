module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^\\./_generated/server$': '<rootDir>/tests/__mocks__/convex-stub.ts',
    '^\\./_generated/api$': '<rootDir>/tests/__mocks__/convex-stub.ts',
    '^\\./_generated/dataModel$': '<rootDir>/tests/__mocks__/convex-stub.ts',
    '^convex/values$': '<rootDir>/tests/__mocks__/convex-stub.ts',
    '^apify-client$': '<rootDir>/tests/__mocks__/convex-stub.ts',
    '^@google/generative-ai$': '<rootDir>/tests/__mocks__/convex-stub.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**',
    '!src/components/**',
  ],
};
