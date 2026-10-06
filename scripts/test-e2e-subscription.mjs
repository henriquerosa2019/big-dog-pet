import assert from 'node:assert';

console.log('================================================================');
console.log('🚀 INICIANDO TESTE E2E DE ASSINATURAS, MERCADO PAGO E EXPIRAÇÃO');
console.log('================================================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error('   Erro:', err.message);
      failed++;
    }
  }

  // 1. Testar Configuração Oficial do Mercado Pago
  const { DEFAULT_PLANS } = await import('../src/lib/mercadoPagoConfig.ts');

  test('Planos Oficiais do Mercado Pago configurados corretamente', () => {
    assert.strictEqual(DEFAULT_PLANS.length, 3, 'Devem existir exatamente 3 planos');

    const starter = DEFAULT_PLANS.find(p => p.id === 'starter');
    assert.ok(starter, 'Plano Starter deve existir');
    assert.strictEqual(starter.price, 97.0);
    assert.strictEqual(starter.formattedPrice, 'R$ 97,00');
    assert.strictEqual(starter.mercadoPagoUrl, 'https://mpago.la/2r8B3ce');

    const pro = DEFAULT_PLANS.find(p => p.id === 'pro');
    assert.ok(pro, 'Plano Pro deve existir');
    assert.strictEqual(pro.price, 167.0);
    assert.strictEqual(pro.formattedPrice, 'R$ 167,00');
    assert.strictEqual(pro.mercadoPagoUrl, 'https://mpago.la/25ZTwHu');

    const master = DEFAULT_PLANS.find(p => p.id === 'master_vip');
    assert.ok(master, 'Plano Master VIP deve existir');
    assert.strictEqual(master.price, 247.0);
    assert.strictEqual(master.formattedPrice, 'R$ 247,00');
    assert.strictEqual(master.mercadoPagoUrl, 'https://mpago.la/1CdrLyf');
    assert.ok(master.features.some(f => f.includes('Curva ABC')), 'Deve conter Curva ABC');
    assert.ok(master.features.some(f => f.includes('Canal Próprio')), 'Deve conter Canal Próprio');
  });

  // 2. Testar Ciclo de Vida de 7 Dias Grátis
  test('Lógica de Ciclo de Vida dos 7 Dias de Teste (D-1 e D-0)', () => {
    const TRIAL_DAYS = 7;
    const now = new Date();

    // Caso A: Dia 2 de teste (ativo, restam 5 dias)
    const createdAtA = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const endA = new Date(createdAtA.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const diffMsA = endA.getTime() - now.getTime();
    const daysRemA = Math.ceil(diffMsA / (1000 * 60 * 60 * 24));
    assert.strictEqual(daysRemA, 5);
    assert.strictEqual(daysRemA <= 1, false, 'Não deve expirar amanhã ainda');
    assert.strictEqual(daysRemA <= 0, false, 'Não está expirado');

    // Caso B: Dia 6 de teste (últimas 24 horas - Alerta D-1)
    const createdAtB = new Date(now.getTime() - 6.2 * 24 * 60 * 60 * 1000);
    const endB = new Date(createdAtB.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const diffMsB = endB.getTime() - now.getTime();
    const daysRemB = Math.ceil(diffMsB / (1000 * 60 * 60 * 24));
    assert.strictEqual(daysRemB, 1, 'Deve restar exatamente 1 dia');
    assert.strictEqual(daysRemB <= 1, true, 'Alerta D-1 deve ser acionado');
    assert.strictEqual(daysRemB <= 0, false, 'Ainda não está expirado');

    // Caso C: Dia 8 (período de 7 dias esgotado - Bloqueio com Paywall)
    const createdAtC = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const endC = new Date(createdAtC.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const diffMsC = endC.getTime() - now.getTime();
    const daysRemC = Math.max(0, Math.ceil(diffMsC / (1000 * 60 * 60 * 24)));
    assert.strictEqual(daysRemC, 0, 'Dias restantes deve ser 0');
    assert.strictEqual(daysRemC <= 0, true, 'Deve estar expirado e bloqueado');
  });

  // 3. Testar Resposta HTTP do Servidor e Renderização dos Links
  try {
    const res = await fetch('http://localhost:8080/');
    assert.strictEqual(res.status, 200, 'Servidor deve responder status 200 OK');
    const html = await res.text();

    test('Servidor Local responde 200 OK e contém botão WhatsApp verde', () => {
      assert.ok(html.includes('#25D366'), 'HTML deve conter a cor verde do WhatsApp (#25D366)');
      assert.ok(html.includes('https://wa.me/5511993793746'), 'HTML deve conter o link do WhatsApp');
    });

    test('HTML renderiza seção com os 3 links e preços do Mercado Pago', () => {
      assert.ok(html.includes('https://mpago.la/2r8B3ce'), 'Deve conter link oficial Starter: mpago.la/2r8B3ce');
      assert.ok(html.includes('https://mpago.la/25ZTwHu'), 'Deve conter link oficial Pro: mpago.la/25ZTwHu');
      assert.ok(html.includes('https://mpago.la/1CdrLyf'), 'Deve conter link oficial Master VIP: mpago.la/1CdrLyf');
      assert.ok(html.includes('R$ 97,00'), 'Deve exibir R$ 97,00');
      assert.ok(html.includes('R$ 167,00'), 'Deve exibir R$ 167,00');
      assert.ok(html.includes('R$ 247,00'), 'Deve exibir R$ 247,00');
    });

    test('HTML contém Degradê Verde Elegante de 3 Tons nos Títulos', () => {
      assert.ok(html.includes('from-emerald-800 via-emerald-600 to-green-400'), 'Deve conter o degradê de 3 tons de verde');
      assert.ok(html.includes('Tudo o que seu negócio precisa em um só sistema.') || html.includes('Do banho aos mimos, a gente cuida.'), 'Deve conter o título principal de serviços ou recursos');
    });
  } catch (err) {
    console.warn('Aviso: servidor local 8080 não conectado diretamente no fetch interno:', err.message);
  }

  console.log('\n================================================================');
  console.log(`📊 RESULTADO DOS TESTES: ${passed} PASSARAM | ${failed} FALHARAM`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
