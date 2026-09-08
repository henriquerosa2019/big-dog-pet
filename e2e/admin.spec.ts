import { test, expect, type Page } from '@playwright/test';

/**
 * Função utilitária para autenticar como administrador antes dos testes.
 */
async function loginAsAdmin(page: Page) {
  // Acessa /admin diretamente
  await page.goto('/admin');

  // Se já estiver logado como administrador, o painel carrega direto
  const adminHeader = page.locator('h1:has-text("Painel administrativo")');
  const isAlreadyAdmin = await adminHeader.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  if (isAlreadyAdmin) return;

  // Se não estiver no admin (redirecionou para /auth), realiza o login
  await page.goto('/auth');
  await page.locator('form[data-hydrated="true"]').waitFor({ state: 'visible', timeout: 15000 });

  await page.locator('#email').fill('bigdog@gmail.com');
  await page.locator('#password').fill('bigdog');
  await page.locator('button[type="submit"]').click();

  // Aguarda confirmação do login
  await page.waitForURL(/(.*conta|.*admin)/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Se não foi para /admin direto, navega para o admin
  if (!page.url().includes('/admin')) {
    await page.goto('/admin');
  }

  // Confirma que o painel administrativo está visível; se redirecionar por storage inicializando, faz uma retentativa
  const isLoaded = await page.locator('h1:has-text("Painel administrativo")').waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (!isLoaded) {
    await page.goto('/admin');
  }
  await expect(page.locator('h1:has-text("Painel administrativo")')).toBeVisible({ timeout: 15000 });
}

test.describe('Painel Administrativo', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Deve acessar o Painel Administrativo e exibir o Dashboard com KPIs e Kanban', async ({ page }) => {
    // Valida título do painel
    await expect(page.locator('h1:has-text("Painel Administrativo")')).toBeVisible();

    // Valida presença das pílulas de KPIs rápidos no topo
    await expect(page.locator('text=Chat Loja')).toBeVisible();
    await expect(page.locator('text=Delivery')).toBeVisible();
    await expect(page.locator('text=Atendimentos')).toBeVisible();
    await expect(page.locator('text=Alertas')).toBeVisible();

    // Valida colunas do Kanban Operacional de Hoje
    await expect(page.locator('text=Aguardando')).first().toBeVisible();
    await expect(page.locator('text=Em Andamento')).first().toBeVisible();
    await expect(page.locator('text=Pronto / Concluído')).first().toBeVisible();
  });

  test('Deve navegar para a aba Gestão & Cadastros e acessar "Novo Cliente"', async ({ page }) => {
    // Acessa Gestão & Cadastros
    await page.getByRole('tab', { name: /Gestão & Cadastros/i }).click();

    // Clica na sub-aba Novo Cliente
    const novoClienteTab = page.getByRole('tab', { name: 'Novo Cliente' });
    await novoClienteTab.scrollIntoViewIfNeeded();
    await novoClienteTab.click();

    // Valida presença dos campos principais do formulário
    await expect(page.locator('#nc-name')).toBeVisible();
    await expect(page.locator('#nc-phone')).toBeVisible();
  });

  test('Deve navegar para a aba "Clientes" e exibir o campo de busca', async ({ page }) => {
    // Acessa Gestão & Cadastros
    await page.getByRole('tab', { name: /Gestão & Cadastros/i }).click();

    // Clica na sub-aba Clientes
    await page.getByRole('tab', { name: 'Clientes' }).click();

    // Valida presença do campo de pesquisa de clientes
    const searchInput = page.getByPlaceholder(/Buscar por nome, telefone/i);
    await expect(searchInput).toBeVisible();
  });

  test('Deve navegar para a aba "Relatórios" e exibir opções financeiras e Curvas ABC', async ({ page }) => {
    // Acessa Gestão & Cadastros
    await page.getByRole('tab', { name: /Gestão & Cadastros/i }).click();

    // Clica na sub-aba Relatórios
    await page.getByRole('tab', { name: /Relatórios/i }).click();

    // Valida presença das sub-abas gerenciais
    await expect(page.getByRole('button', { name: /Financeiro Geral/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Curva ABC - Produtos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Curva ABC - Serviços/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Curva ABC - Clientes/i })).toBeVisible();

    // Valida botões do financeiro geral
    await expect(page.getByRole('button', { name: 'Hoje' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gerar relatório' })).toBeVisible();

    // Alterna para Curva ABC - Produtos
    await page.getByRole('button', { name: /Curva ABC - Produtos/i }).click();
    await expect(page.locator('text=Filtros da Curva ABC de Produtos')).toBeVisible();

    // Alterna para Curva ABC - Serviços
    await page.getByRole('button', { name: /Curva ABC - Serviços/i }).click();
    await expect(page.locator('text=Filtros da Curva ABC de Serviços')).toBeVisible();

    // Alterna para Curva ABC - Clientes
    await page.getByRole('button', { name: /Curva ABC - Clientes/i }).click();
    await expect(page.locator('text=Filtros da Curva ABC de Clientes')).toBeVisible();
  });

  test('Deve navegar para a aba "Saúde & Retornos" e exibir agrupamento de alertas', async ({ page }) => {
    // Clica na aba Saúde & Retornos
    await page.getByRole('tab', { name: /Saúde & Retornos/i }).click();

    // Valida presença da seção de alertas
    await expect(page.locator('text=Alertas de Saúde e Retornos')).toBeVisible();
  });

  test('Deve navegar para a aba "Atendimento & Chat" e exibir chamados e histórico', async ({ page }) => {
    // Clica na aba Atendimento & Chat
    await page.getByRole('tab', { name: /Atendimento & Chat/i }).click();

    // Valida presença dos componentes de chat
    await expect(page.locator('text=Fila de Chamados Recentes')).toBeVisible();
    await expect(page.locator('text=Log e Histórico de Atendimentos do Chat')).toBeVisible();
    await expect(page.locator('text=Total de Chamados')).toBeVisible();
    await expect(page.locator('text=Aguardando Loja')).toBeVisible();
    await expect(page.locator('text=Respondidos')).toBeVisible();
  });

  test('Deve navegar pelas abas de catálogo ("Serviços" e "Produtos") em Gestão', async ({ page }) => {
    // Acessa Gestão & Cadastros
    await page.getByRole('tab', { name: /Gestão & Cadastros/i }).click();

    // Clica na aba Serviços
    await page.getByRole('tab', { name: 'Serviços' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Serviços' })).toBeVisible();

    // Clica na aba Produtos
    await page.getByRole('tab', { name: /Produtos/i }).click();
    await expect(page.getByRole('tabpanel', { name: /Produtos/i })).toBeVisible();
  });
});
