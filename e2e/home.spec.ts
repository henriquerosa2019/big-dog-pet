import { test, expect } from '@playwright/test';

test.describe('Página Inicial (Home)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Deve carregar a página inicial e exibir os elementos principais', async ({ page }) => {
    // Verifica o título principal da seção hero
    await expect(page.locator('h1')).toBeVisible();

    // Verifica os botões de ação rápida
    const agendarBtn = page.locator('a:has-text("Agendar serviço")');
    const lojaBtn = page.locator('a:has-text("Ir para a loja")');

    await expect(agendarBtn).toBeVisible();
    await expect(lojaBtn).toBeVisible();
  });

  test('Deve exibir a barra de navegação inferior com os links principais', async ({ page }) => {
    // Verifica links de navegação no rodapé / AppShell
    await expect(page.locator('nav a:has-text("Início")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("Loja")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("Agendar")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("Carrinho")').first()).toBeVisible();
    await expect(page.locator('nav a:has-text("Conta")').first()).toBeVisible();
  });

  test('Deve navegar para a loja ao clicar no botão "Ir para a loja"', async ({ page }) => {
    await page.click('a:has-text("Ir para a loja")');
    await expect(page).toHaveURL(/.*loja/);
  });
});
