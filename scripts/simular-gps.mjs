#!/usr/bin/env node
/**
 * Simulador de GPS do motorista — Big Dog Pet
 * -------------------------------------------
 * Abre um Chromium controlado, sobrescreve a localização do navegador e percorre
 * o trajeto entre a casa do tutor e o petshop, para testar o mapa ao vivo do
 * tutor (/conta) e da loja (/admin) sem sair de casa.
 *
 * Simula as DUAS pernas do transporte:
 *   IDA   — casa do tutor (R. Maria Amália, 628, Tijuca) -> petshop (R. Teodoro da Silva, 774)
 *           corresponde ao status "A caminho da retirada"
 *   VOLTA — o mesmo caminho ao contrário, petshop -> casa do tutor
 *           corresponde ao status "A caminho para devolver"
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
 *   4) Volte ao terminal e aperte ENTER — a IDA começa a rodar sozinha.
 *   5) Ao terminar a ida, avance as etapas (Pet retirado, Chegou ao petshop,
 *      Em atendimento, Serviço concluído, A caminho para devolver) e aperte
 *      ENTER de novo — o script faz a VOLTA.
 *
 * O perfil do navegador fica salvo em .gps-sim-profile/, então nas próximas
 * execuções o login já vem pronto.
 *
 * OPÇÕES (variáveis de ambiente)
 *   URL=http://localhost:5173/motorista   → testar no ambiente local
 *   INTERVALO=8000                        → milissegundos entre cada ponto
 *   SENTIDO=volta                         → começa direto pela volta
 *   SENTIDO=ida                           → faz só a ida e encerra
 *   AUTO=1                                → não espera ENTER nenhum
 */

import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const URL_APP = process.env.URL ?? "https://big-dog-pet-mu.vercel.app/motorista";
const INTERVALO = Number(process.env.INTERVALO ?? 8000);
const AUTO = process.env.AUTO === "1";
const SENTIDO = (process.env.SENTIDO ?? "ambos").toLowerCase();
const PROFILE_DIR = path.join(__dirname, ".gps-sim-profile");

/** Trajeto real de carro: casa do tutor (Tijuca) -> petshop (Vila Isabel). */
const IDA = [
  { lat: -22.929462, lng: -43.245723, onde: "Casa do tutor — Rua Maria Amália, 628 (Tijuca)" },
  { lat: -22.92911, lng: -43.24641, onde: "Rua Maria Amália, sentido Conde de Bonfim" },
  { lat: -22.92481, lng: -43.24352, onde: "Rua Conde de Bonfim" },
  { lat: -22.92345, lng: -43.24634, onde: "Praça Saens Peña" },
  { lat: -22.92212, lng: -43.24921, onde: "Rua Barão de Mesquita" },
  { lat: -22.9211, lng: -43.25042, onde: "Rua Barão de Mesquita, altura do Grajaú" },
  { lat: -22.91985, lng: -43.25191, onde: "Entrando em Vila Isabel" },
  { lat: -22.91812, lng: -43.25334, onde: "Rua Teodoro da Silva" },
  { lat: -22.918994, lng: -43.25421, onde: "Petshop — Rua Teodoro da Silva, 774" },
];

/** A devolução é o mesmo caminho ao contrário: petshop -> casa do tutor. */
const VOLTA = [...IDA].reverse();

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function perguntar(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(texto, () => {
      rl.close();
      resolve();
    });
  });
}

async function percorrer(ctx, pontos, nome) {
  console.log("");
  console.log(`${nome} — ${pontos.length} pontos, um a cada ${INTERVALO / 1000}s.`);
  console.log("");
  for (const [i, ponto] of pontos.entries()) {
    await ctx.setGeolocation({ latitude: ponto.lat, longitude: ponto.lng, accuracy: 10 });
    const n = String(i + 1).padStart(2, "0");
    console.log(`  [${n}/${pontos.length}]  ${ponto.lat}, ${ponto.lng}   ${ponto.onde}`);
    if (i < pontos.length - 1) await esperar(INTERVALO);
  }
  console.log("");
  console.log(`${nome} concluída.`);
}

async function main() {
  const origem = new URL(URL_APP).origin;

  console.log("Abrindo o navegador de teste...");
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
    permissions: ["geolocation"],
    geolocation: { latitude: IDA[0].lat, longitude: IDA[0].lng, accuracy: 10 },
    locale: "pt-BR",
  });
  await ctx.grantPermissions(["geolocation"], { origin: origem });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(URL_APP, { waitUntil: "domcontentloaded" });

  const fazerIda = SENTIDO === "ambos" || SENTIDO === "ida";
  const fazerVolta = SENTIDO === "ambos" || SENTIDO === "volta";

  if (fazerIda) {
    if (!AUTO) {
      // O texto vai todo dentro do prompt pra não embaralhar no terminal do Windows.
      await perguntar(
        [
          "",
          "IDA — casa do tutor -> petshop",
          "  1. Faça login como MOTORISTA na janela que abriu.",
          '  2. Toque em "Avançar: A caminho da retirada".',
          '  3. Confirme que aparece "Compartilhando localização ao vivo".',
          "  4. Deixe /conta (tutor) e /admin (loja) abertos em outra janela.",
          "",
          "Pronto? Aperte ENTER para começar a ida... ",
        ].join("\n"),
      );
    }
    await percorrer(ctx, IDA, "IDA");
  }

  if (fazerVolta) {
    if (!AUTO) {
      await perguntar(
        [
          "",
          "VOLTA — petshop -> casa do tutor",
          "  1. Na janela do motorista, avance as etapas até chegar em",
          '     "Avançar: A caminho para devolver" e toque nele.',
          '  2. Confirme que voltou a aparecer "Compartilhando localização ao vivo".',
          "",
          "Pronto? Aperte ENTER para começar a volta... ",
        ].join("\n"),
      );
    }
    await percorrer(ctx, VOLTA, "VOLTA");
  }

  console.log("");
  console.log("Trajeto simulado terminado. O pino deve ter percorrido o caminho");
  console.log("no mapa do tutor e do admin nas duas pernas.");
  console.log("A janela fica aberta pra você finalizar o teste (Pet entregue, Finalizado).");
  console.log("Feche a janela ou aperte Ctrl+C aqui para encerrar.");

  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
