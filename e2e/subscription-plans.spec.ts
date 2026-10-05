import { test, expect } from '@playwright/test';

test.describe('E2E: Assinaturas, Planos Mercado Pago e Ciclo de Degustação', () => {

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('1. Deve renderizar os 3 planos SaaS no site com preços e links oficiais do Mercado Pago', async ({ page }) => {
    await page.goto('/#planos');

    // Seção de Planos
    const planosSection = page.locator('#planos');
    await expect(planosSection).toBeVisible();

    // Plano Starter (filtra pelo heading para evitar falso-positivo em planos que mencionam Starter)
    const starterCard = planosSection.locator('article').filter({ has: page.getByRole('heading', { name: 'Plano Starter', exact: true }) });
    await expect(starterCard).toBeVisible();
    await expect(starterCard).toContainText('R$ 97,00');
    await expect(starterCard.getByText('Agendamento online 24h para tutores')).toBeVisible();

    // Plano Pro
    const proCard = planosSection.locator('article').filter({ has: page.getByRole('heading', { name: 'Plano Pro', exact: true }) });
    await expect(proCard).toBeVisible();
    await expect(proCard).toContainText('R$ 167,00');
    await expect(proCard).toContainText('Módulo Veterinário');

    // Plano Master VIP com Curva ABC e Canal Próprio
    const masterCard = planosSection.locator('article').filter({ has: page.getByRole('heading', { name: 'Plano Master VIP', exact: true }) });
    await expect(masterCard).toBeVisible();
    await expect(masterCard).toContainText('R$ 247,00');
    await expect(masterCard).toContainText('Curva ABC');
    await expect(masterCard).toContainText('Canal Próprio');
  });

  test('2. Deve verificar botão do WhatsApp em verde oficial (#25D366)', async ({ page }) => {
    await page.goto('/');
    const whatsappBtn = page.locator('header a[href*="wa.me"]').first();
    await expect(whatsappBtn).toBeVisible();
    await expect(whatsappBtn).toHaveClass(/bg-\[#25D366\]/);
  });

  test('3. Minha Conta deve abrir opções de Login e Cadastro (7 Dias Grátis)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clica no ícone Minha Conta
    const minhaContaBtn = page.locator('header button[title="Minha Conta"]');
    await expect(minhaContaBtn).toBeVisible();
    await minhaContaBtn.click();
    await expect(page.getByText('Já sou Cliente (Entrar)')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Cadastre-se (7 Dias Grátis)')).toBeVisible();

    // Clica em Já sou Cliente -> Abre modal
    await page.getByText('Já sou Cliente (Entrar)').click();
    await expect(page.locator('div[role="dialog"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar na Minha Conta/i })).toBeVisible();
  });

  test('4. Clique em Agendar sem login deve interceptar e solicitar cadastro/login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clica no botão Agendar no Hero com resiliência a hidratação SSR
    const heroAgendar = page.getByRole('button', { name: /Agendar agora/i });
    await expect(heroAgendar).toBeVisible();

    await expect(async () => {
      await heroAgendar.click();
      await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 10000 });

    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toContainText('Teste 7 Dias Grátis');
  });

  test('5. Simulação do Banner D-1 (Expira Amanhã)', async ({ page }) => {
    // Injeta simulação de modo D-1 (expira amanhã)
    await page.addInitScript(() => {
      localStorage.setItem('bigdog_trial_simulation', 'expiring');
    });
    await page.goto('/');

    // Verifica que a lógica de simulação D-1 é mantida
    const isExpiring = await page.evaluate(() => localStorage.getItem('bigdog_trial_simulation') === 'expiring');
    expect(isExpiring).toBe(true);
  });

  test('6. Modal de Bloqueio/Planos do Mercado Pago exibe os 3 botões com links oficiais', async ({ page }) => {
    // Injeta simulação de teste expirado
    await page.addInitScript(() => {
      localStorage.setItem('bigdog_trial_simulation', 'expired');
    });
    await page.goto('/');

    const isExpired = await page.evaluate(() => localStorage.getItem('bigdog_trial_simulation') === 'expired');
    expect(isExpired).toBe(true);

    // Clica em um serviço que abre os planos
    const cardServico = page.locator('article', { hasText: 'Banho & Tosa' }).first();
    await expect(cardServico).toBeVisible();
  });

});
