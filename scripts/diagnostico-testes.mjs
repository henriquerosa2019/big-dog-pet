import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const resultsDir = path.join(rootDir, 'test-results');
const reportJsonPath = path.join(resultsDir, 'resultado-playwright.json');
const diagnosticoPath = path.join(resultsDir, 'diagnostico-ia.json');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

console.log('🚀 [Auto-Test] Iniciando suíte de testes do Playwright...');

// Executa o Playwright gerando saída estruturada em JSON
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const args = ['playwright', 'test', `--reporter=json,list`];
if (process.argv.length > 2) {
  args.push(...process.argv.slice(2));
}

const env = {
  ...process.env,
  PLAYWRIGHT_JSON_OUTPUT_NAME: reportJsonPath,
};

const proc = spawn(npxCmd, args, {
  cwd: rootDir,
  env,
  stdio: 'inherit',
  shell: true,
});

proc.on('close', (code) => {
  console.log('\n📊 [Auto-Test] Processamento concluído com código:', code);

  if (code === 0) {
    console.log('🎉 [Auto-Test] Todos os testes passaram! Zero erros encontrados.');
    const sucesso = {
      status: 'sucesso',
      totalFalhas: 0,
      timestamp: new Date().toISOString(),
      mensagem: 'Todos os testes foram executados e aprovados com sucesso.',
    };
    fs.writeFileSync(diagnosticoPath, JSON.stringify(sucesso, null, 2), 'utf-8');
    process.exit(0);
  }

  // Se houve falhas, sintetiza o diagnóstico para a IA analisar
  let rawReport = null;
  if (fs.existsSync(reportJsonPath)) {
    try {
      rawReport = JSON.parse(fs.readFileSync(reportJsonPath, 'utf-8'));
    } catch {
      rawReport = null;
    }
  }

  const falhas = [];

  if (rawReport?.suites) {
    function extrairFalhas(suite, caminho = '') {
      const nomeSuite = caminho ? `${caminho} > ${suite.title}` : suite.title;
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            if (result.status === 'failed' || result.status === 'timedOut') {
              falhas.push({
                arquivo: spec.file,
                linha: spec.line,
                coluna: spec.column,
                teste: `${nomeSuite} > ${spec.title}`,
                status: result.status,
                duracaoMs: result.duration,
                erro: result.error?.message?.slice(0, 500),
                pilha: result.error?.stack?.slice(0, 1000),
              });
            }
          }
        }
      }
      for (const sub of suite.suites || []) {
        extrairFalhas(sub, nomeSuite);
      }
    }

    for (const s of rawReport.suites) {
      extrairFalhas(s);
    }
  }

  const relatorioIA = {
    status: 'falhas_encontradas',
    totalFalhas: falhas.length,
    timestamp: new Date().toISOString(),
    falhas,
  };

  fs.writeFileSync(diagnosticoPath, JSON.stringify(relatorioIA, null, 2), 'utf-8');
  console.log(`\n⚠️  [Auto-Test] ${falhas.length} falha(s) registrada(s) em: test-results/diagnostico-ia.json`);
  process.exit(code || 1);
});
