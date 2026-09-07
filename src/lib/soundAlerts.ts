/**
 * Módulo de Alertas Sonoros em Tempo Real (Web Audio API)
 * Big Dog Pet - Franco da Rocha
 * 
 * Sintetiza harmônicos limpos de sino/chime em tempo real sem arquivos externos,
 * garantindo zero latência, zero risco de 404/CORS e suporte universal em browsers.
 */

export type SoundAlertTone =
  | "confirmado"     // Agendamento aprovado pela loja
  | "transporte"     // Motorista iniciou viagem (ida para buscar ou volta para devolver)
  | "atendimento"    // Pet entrou em atendimento / banho / tosa / consulta agora
  | "portao"         // Van chegou no portão / endereço
  | "concluido"      // Atendimento finalizado e pet entregue com sucesso
  | "cancelado"      // Agendamento cancelado pela loja
  | "alerta";        // Notificação geral de aviso

let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      // Browser autoplay policy blocked; will unlock on first user gesture
    });
  }
  return audioCtx;
}

/**
 * Desbloqueia o AudioContext no primeiro toque/clique do usuário
 * em conformidade com as diretrizes de autoplay dos navegadores.
 */
export function unlockAudioOnFirstGesture(): void {
  if (typeof window === "undefined" || audioUnlocked) return;

  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().then(() => {
        audioUnlocked = true;
      }).catch(() => {});
    } else if (ctx) {
      audioUnlocked = true;
    }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true, passive: true });
}

// Inicializa o listener de gesto
if (typeof window !== "undefined") {
  unlockAudioOnFirstGesture();
}

/**
 * Toca uma nota com decaimento harmônico suave (sino/chime).
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  gainLevel = 0.25,
  waveType: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = waveType;
  osc.frequency.setValueAtTime(freq, startTime);

  // Envelope ADSR suave para evitar estalos (clicks)
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(gainLevel, startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Toca o alerta sonoro correspondente à transição de status do atendimento.
 * Por padrão soa 3 vezes consecutivas (repeats = 3) para alertar com clareza tutor e equipe.
 */
export function playStatusSound(tone: SoundAlertTone, repeats = 3): void {
  try {
    const isMuted = typeof window !== "undefined" && localStorage.getItem("bigdog_sound_muted") === "true";
    if (isMuted) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const baseNow = ctx.currentTime + 0.05;
    const repeatInterval = tone === "concluido" ? 0.75 : tone === "transporte" ? 0.6 : 0.55;

    for (let r = 0; r < repeats; r++) {
      const now = baseNow + r * repeatInterval;

      switch (tone) {
        case "confirmado": {
          // 2 tons ascendentes cristalinos (D5 -> A5)
          playTone(ctx, 587.33, now, 0.35, 0.28, "sine");
          playTone(ctx, 880.00, now + 0.12, 0.55, 0.32, "sine");
          playTone(ctx, 1760.00, now + 0.12, 0.35, 0.08, "sine");
          break;
        }

        case "transporte": {
          // Sequência dinâmica de viagem (A4 -> E5 -> A5)
          playTone(ctx, 440.00, now, 0.22, 0.22, "triangle");
          playTone(ctx, 659.25, now + 0.10, 0.28, 0.25, "sine");
          playTone(ctx, 880.00, now + 0.20, 0.45, 0.3, "sine");
          break;
        }

        case "atendimento": {
          // Acorde envolvente (C5 -> E5 -> G5)
          playTone(ctx, 523.25, now, 0.30, 0.22, "sine");
          playTone(ctx, 659.25, now + 0.09, 0.35, 0.25, "sine");
          playTone(ctx, 783.99, now + 0.18, 0.50, 0.3, "sine");
          break;
        }

        case "portao": {
          // Aviso duplo no portão
          playTone(ctx, 783.99, now, 0.18, 0.25, "sine");
          playTone(ctx, 783.99, now + 0.15, 0.30, 0.25, "sine");
          break;
        }

        case "concluido": {
          // Acorde triunfal comemorativo (C5 -> E5 -> G5 -> C6)
          playTone(ctx, 523.25, now, 0.25, 0.2, "sine");
          playTone(ctx, 659.25, now + 0.09, 0.25, 0.22, "sine");
          playTone(ctx, 783.99, now + 0.18, 0.35, 0.25, "sine");
          playTone(ctx, 1046.50, now + 0.28, 0.65, 0.35, "sine");
          playTone(ctx, 2093.00, now + 0.28, 0.45, 0.08, "sine");
          break;
        }

        case "cancelado": {
          // 2 notas descendentes para alerta de cancelamento (E5 -> A4)
          playTone(ctx, 659.25, now, 0.22, 0.28, "triangle");
          playTone(ctx, 440.00, now + 0.12, 0.40, 0.32, "sine");
          break;
        }

        case "alerta":
        default: {
          // Tom suave de notificação geral
          playTone(ctx, 659.25, now, 0.22, 0.2, "sine");
          playTone(ctx, 880.00, now + 0.11, 0.38, 0.25, "sine");
          break;
        }
      }
    }
  } catch (err) {
    console.warn("Não foi possível reproduzir o som de alerta:", err);
  }
}

/**
 * Toca alerta sonoro de 2 toques nítidos para mensagem nova recebida no bate-papo.
 * Dispara 2 beeps harmônicos cristalinos (880Hz e 1174Hz) com intervalo rítmico.
 */
export function playChatNotificationSound(): void {
  try {
    const isMuted = typeof window !== "undefined" && localStorage.getItem("bigdog_sound_muted") === "true";
    if (isMuted) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime + 0.03;
    // Toque 1: Lá 5 (880 Hz)
    playTone(ctx, 880.0, now, 0.16, 0.28, "sine");
    // Toque 2: Ré 6 (1174.66 Hz)
    playTone(ctx, 1174.66, now + 0.18, 0.28, 0.32, "sine");
  } catch (err) {
    console.warn("Não foi possível reproduzir som de nova mensagem:", err);
  }
}

/**
 * Função utilitária para testar qualquer som (chamada pela interface).
 */
export function testSoundAlert(tone: SoundAlertTone = "confirmado", repeats = 3): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().then(() => playStatusSound(tone, repeats));
  } else {
    playStatusSound(tone, repeats);
  }
}
