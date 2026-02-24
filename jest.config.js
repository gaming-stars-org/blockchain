const config = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.cargo/"],
  maxWorkers: 1,
};

module.exports = config;
