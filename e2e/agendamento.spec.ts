import { test, expect } from '@playwright/test';

test.describe('Agendamento e Proteção de Rotas', () => {
  test('Deve redirecionar para login ao tentar agendar sem estar autenticado', async ({ page }) => {
    await page.goto('/agendar');
    await expect(page).toHaveURL(/.*auth/, { timeout: 15000 });
  });

  test('Deve proteger a rota ao tentar navegar para Agendar pelo menu inferior', async ({ page }) => {
    await page.goto('/');
    // Clica na aba Agendar no menu inferior
    await page.locator('nav a:has-text("Agendar")').first().click();
    // Como a rota é restrita, deve redirecionar para a tela de login
    await expect(page).toHaveURL(/.*auth/, { timeout: 15000 });
  });
});