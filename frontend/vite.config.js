import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vitest: run component tests in a simulated browser (jsdom)
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Page tests type into whole forms and wait for redirect delays;
    // the 5s default made them flaky on slower machines
    testTimeout: 15000,
  },
})
