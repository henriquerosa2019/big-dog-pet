import { test, expect } from '@playwright/test';

test.describe('Autenticação e Cadastro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.locator('form[data-hydrated="true"]').waitFor({ state: 'visible', timeout: 15000 });
  });

  test('Deve exibir a tela de login com campos de e-mail e senha', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Deve permitir alternar entre os modos "Entrar" e "Criar conta"', async ({ page }) => {
    // Botão para alternar para cadastro
    const toggleButton = page.getByRole('button', { name: /Não tenho conta/i });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // No modo cadastro, o botão de alternar muda de texto
    await expect(page.getByRole('button', { name: /Já tenho conta/i })).toBeVisible();

    // E os campos adicionais de cadastro (Nome completo) aparecem
    await expect(page.locator('#fullName')).toBeVisible();
  });

  test('Deve validar formato de e-mail inválido ao tentar logar', async ({ page }) => {
    await page.locator('#email').fill('email-invalido');
    await page.locator('#password').fill('123456');
    await page.locator('button[type="submit"]').click();

    // Deve exibir toast com aviso de e-mail inválido
    await expect(page.locator('text=E-mail inválido')).toBeVisible();
  });
});
