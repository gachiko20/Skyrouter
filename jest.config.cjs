'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // El frontend tiene su propia config de Jest (jsdom + Babel/JSX) en
  // frontend/jest.config.cjs; esta config es solo para las pruebas de
  // integración del backend (Node + Supertest contra Postgres real).
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/frontend/'],
};
