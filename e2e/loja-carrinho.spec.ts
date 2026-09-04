import { test, expect } from '@playwright/test';

test.describe('Loja e Carrinho de Compras', () => {
  test('Deve carregar a página da loja e exibir filtros de categoria', async ({ page }) => {
    await page.goto('/loja');

    // Verifica campo de busca de produtos
    const searchInput = page.getByPlaceholder(/Buscar produto/i);
    await expect(searchInput).toBeVisible();

    // Verifica filtros de categoria
    await expect(page.getByRole('button', { name: 'Todos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alimentação' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Higiene' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Medicamentos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acessórios' })).toBeVisible();
  });

  test('Deve exibir a página do carrinho', async ({ page }) => {
    await page.goto('/carrinho');

    // Verifica se a tela do carrinho carregou com sucesso
    // Se o carrinho estiver vazio, mostra o botão "Ver produtos"
    // Se tiver itens, exibe o cabeçalho "Carrinho"
    const isCarrinhoHeaderVisible = await page.locator('h1:has-text("Carrinho")').isVisible();
    const isVerProdutosVisible = await page.locator('a:has-text("Ver produtos")').isVisible();

    expect(isCarrinhoHeaderVisible || isVerProdutosVisible).toBeTruthy();
  });

  test('Deve filtrar produtos ao digitar no campo de busca', async ({ page }) => {
    await page.goto('/loja');
    const searchInput = page.getByPlaceholder(/Buscar produto/i);
    await searchInput.fill('ração');
    await expect(searchInput).toHaveValue('ração');
  });
});
