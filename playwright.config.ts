import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para testes funcionais E2E.
 * Veja https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  /* Timeout para asserções (15s para dar margem à compilação sob demanda do Vite) */
  expect: {
    timeout: 15000,
  },
  timeout: 45000,

  use: {
    /* URL base do app local (Vite Lovable roda na porta 8080) */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8080',

    /* Coleta trace em caso de falha para facilitar depuração */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  /* Configuração dos navegadores testados */
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Inicia o servidor local automaticamente caso ele não esteja ativo */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
