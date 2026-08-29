#!/usr/bin/env node
/**
 * Simulador de GPS do motorista — Big Dog Pet
 * -------------------------------------------
 * Abre um Chromium controlado, sobrescreve a localização do navegador e percorre
 * a rota Tijuca -> Vila Isabel automaticamente, para testar o mapa ao vivo do
 * tutor (/conta) e da loja (/admin) sem sair de casa.
 *
 * Por que assim: a API de geolocalização do navegador NÃO pode ser sobrescrita
 * por JavaScript colado no console (o navegador bloqueia por segurança). A troca
 * de posição precisa vir da camada do navegador — é o que o DevTools > Sensors
 * faz manualmente e o que este script faz automaticamente.
 *
 * COMO USAR
 *   1) Na pasta do projeto:  npx playwright install chromium   (só na 1ª vez)
 *   2) node scripts/simular-gps.mjs
 *   3) Na janela que abrir, faça login como MOTORISTA e toque em
 *      "Avançar: A caminho da retirada" (aceite a permissão de localização).
 *   4) Volte ao terminal e aperte ENTER — o trajeto começa a rodar sozinho.
 *
 * O perfil do navegador fica salvo em .gps-sim-profile/, então nas próximas
 * execuções o login já vem pronto.
 *
 * OPÇÕES (variáveis de ambiente)
 *   URL=http://localhost:5173/motorista   → testar no ambiente local
 *   INTERVALO=8000                        → milissegundos entre cada ponto
 *   AUTO=1                                → não espera o ENTER, começa direto
 */

import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const URL_APP = process.env.URL ?? "https://big-dog-pet-mu.vercel.app/motorista";
const INTERVALO = Number(process.env.INTERVALO ?? 8000);
const AUTO = process.env.AUTO === "1";
const PROFILE_DIR = path.join(__dirname, ".gps-sim-profile");

/** Trajeto real de carro: Rua Maria Amália 628 (Tijuca) -> Rua Teodoro da Silva 774 (Vila Isabel). */
const ROTA = [
  { lat: -22.929462, lng: -43.245723, onde: "Saída — Rua Maria Amália, 628 (Tijuca)" },
  { lat: -22.92911, lng: -43.24641, onde: "Rua Maria Amália, sentido Conde de Bonfim" },
  { lat: -22.92481, lng: -43.24352, onde: "Rua Conde de Bonfim" },
  { lat: -22.92345, lng: -43.24634, onde: "Praça Saens Peña" },
  { lat: -22.92212, lng: -43.24921, onde: "Rua Barão de Mesquita" },
  { lat: -22.9211, lng: -43.25042, onde: "Rua Barão de Mesquita, altura do Grajaú" },
  { lat: -22.91985, lng: -43.25191, onde: "Entrando em Vila Isabel" },
  { lat: -22.91812, lng: -43.25334, onde: "Rua Teodoro da Silva" },
  { lat: -22.918994, lng: -43.25421, onde: "Chegada — Rua Teodoro da Silva, 774" },
];

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function perguntarEnter(mensagem) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(mensagem, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const origem = new URL(URL_APP).origin;

  console.log("Abrindo o navegador de teste...");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
    permissions: ["geolocation"],
    geolocation: { latitude: ROTA[0].lat, longitude: ROTA[0].lng, accuracy: 10 },
    locale: "pt-BR",
  });
  await ctx.grantPermissions(["geolocation"], { origin: origem });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(URL_APP, { waitUntil: "domcontentloaded" });

  if (!AUTO) {
    console.log("");
    console.log("  1. Faça login como MOTORISTA na janela que abriu.");
    console.log('  2. Toque em "Avançar: A caminho da retirada".');
    console.log('  3. Confirme que aparece "Compartilhando localização ao vivo".');
    console.log("  4. Deixe /conta (tutor) e /admin (loja) abertos em outra janela.");
    console.log("");
    await perguntarEnter("Quando estiver tudo pronto, aperte ENTER para começar o trajeto... ");
  }

  console.log("");
  console.log(`Percorrendo ${ROTA.length} pontos, um a cada ${INTERVALO / 1000}s.`);
  console.log("");

  for (const [i, ponto] of ROTA.entries()) {
    await ctx.setGeolocation({ latitude: ponto.lat, longitude: ponto.lng, accuracy: 10 });
    const n = String(i + 1).padStart(2, "0");
    console.log(`  [${n}/${ROTA.length}]  ${ponto.lat}, ${ponto.lng}   ${ponto.onde}`);
    if (i < ROTA.length - 1) await esperar(INTERVALO);
  }

  console.log("");
  console.log("Trajeto concluído. O pino deve ter percorrido o caminho no mapa do tutor e do admin.");
  console.log("A janela fica aberta pra você seguir o teste (Pet entregue, Finalizado etc.).");
  console.log("Feche a janela ou aperte Ctrl+C aqui para encerrar.");

  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
