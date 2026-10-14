module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  // Jest no procesa CSS (Vite sí): los imports de estilos (p. ej.
  // 'react-day-picker/style.css') se sustituyen por un módulo vacío.
  moduleNameMapper: {
    '\\.css$': '<rootDir>/tests/styleMock.cjs',
  },
};
