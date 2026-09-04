import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Truck,
  MapPin,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Gauge,
  Navigation,
  HeartHandshake,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DriverLiveMap } from "@/components/DriverLiveMap";
import {
  SIMULATION_STEPS,
  OUTBOUND_ROUTE,
  INBOUND_ROUTE,
  broadcastSimulatedPosition,
  updateSimulatedStatus,
  createDemoTransportAppointment,
  SHOP_LOCATION,
  TUTOR_HOME_LOCATION,
} from "@/lib/deliverySimulator";
import type { OpsStatus } from "@/lib/transport";
import { opsStatusLabels, opsStatusTone, opsStatusTutorMessage } from "@/lib/transport";
import { statusToneClass } from "@/lib/format";

export function DeliverySimulator({
  currentUserId,
  onClose,
}: {
  currentUserId: string;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();

  // 1. Busca agendamentos com transporte disponíveis para simular
  const { data: transportAppointments, refetch: refetchAppointments } = useQuery({
    queryKey: ["simulator-transport-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(
          "id, code, appointment_id, driver_id, appointments(id, user_id, ops_status, scheduled_at, pets(name), services(name), addresses(street, number, district))",
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const selectedOrder = transportAppointments?.find((t) => t.id === selectedOrderId);
  const appointment = selectedOrder?.appointments;

  // Seleciona o 1º agendamento automaticamente caso nenhum esteja selecionado
  useEffect(() => {
    if (!selectedOrderId && transportAppointments && transportAppointments.length > 0 && transportAppointments[0]) {
      setSelectedOrderId(transportAppointments[0].id);
    }
  }, [transportAppointments, selectedOrderId]);

  // Estado da simulação
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(3); // 1x, 3x, 10x
  const [routePointIdx, setRoutePointIdx] = useState<number>(0);
  const [telemetry, setTelemetry] = useState<{
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
  }>({
    lat: SHOP_LOCATION.lat,
    lng: SHOP_LOCATION.lng,
    speed: 0,
    heading: 0,
  });

  // Alinha o índice da etapa com o ops_status real do agendamento selecionado
  useEffect(() => {
    if (!appointment?.ops_status) return;
    const idx = SIMULATION_STEPS.findIndex((s) => s.status === appointment.ops_status);
    if (idx !== -1) {
      setCurrentStepIdx(idx);
    }
  }, [appointment?.ops_status]);

  const currentStep = SIMULATION_STEPS[currentStepIdx] ?? SIMULATION_STEPS[0]!;

  // Transição de etapa
  const goToStep = useCallback(
    async (targetIdx: number) => {
      if (!selectedOrder || !appointment) return;
      const step = SIMULATION_STEPS[targetIdx];
      if (!step) return;

      try {
        await updateSimulatedStatus({
          appointmentId: selectedOrder.appointment_id,
          transportOrderId: selectedOrder.id,
          status: step.status,
          userId: currentUserId,
        });

        setCurrentStepIdx(targetIdx);
        setRoutePointIdx(0);

        // Se for etapa parada, posiciona o marcador no local correto
        if (step.status === "motorista_designado" || step.status === "pet_chegou_petshop" || step.status === "em_atendimento" || step.status === "servico_concluido") {
          const payload = {
            lat: SHOP_LOCATION.lat,
            lng: SHOP_LOCATION.lng,
            heading: 0,
            speed: 0,
            updatedAt: new Date().toISOString(),
          };
          setTelemetry(payload);
          broadcastSimulatedPosition(selectedOrder.appointment_id, payload);
        } else if (step.status === "pet_retirado" || step.status === "pet_entregue" || step.status === "finalizado") {
          const payload = {
            lat: TUTOR_HOME_LOCATION.lat,
            lng: TUTOR_HOME_LOCATION.lng,
            heading: 0,
            speed: 0,
            updatedAt: new Date().toISOString(),
          };
          setTelemetry(payload);
          broadcastSimulatedPosition(selectedOrder.appointment_id, payload);
        }

        queryClient.invalidateQueries({ queryKey: ["admin-transport-orders"] });
        queryClient.invalidateQueries({ queryKey: ["simulator-transport-appointments"] });
        toast.success(`Etapa: ${step.label}`);
      } catch (err) {
        console.error("Erro ao avançar etapa da simulação:", err);
        toast.error("Não foi possível atualizar o status");
      }
    },
    [selectedOrder, appointment, currentUserId, queryClient],
  );

  // Timer de animação de rota em tempo real
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isPlaying || !selectedOrder) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const step = SIMULATION_STEPS[currentStepIdx];
    if (!step) return;

    // Se estiver em uma etapa móvel, viaja ponto a ponto pela rota
    if (step.isMoving) {
      const activeRoute = step.routeType === "inbound" ? INBOUND_ROUTE : OUTBOUND_ROUTE;
      const intervalMs = Math.max(120, Math.round(900 / speedMultiplier));

      timerRef.current = setInterval(() => {
        setRoutePointIdx((prevIdx) => {
          const nextIdx = prevIdx + 1;
          if (nextIdx < activeRoute.length) {
            const point = activeRoute[nextIdx]!;
            setTelemetry(point);
            broadcastSimulatedPosition(selectedOrder.appointment_id, point);
            return nextIdx;
          } else {
            // Fim da rota -> Avança automaticamente para a próxima etapa
            const nextStepIdx = currentStepIdx + 1;
            if (nextStepIdx < SIMULATION_STEPS.length) {
              void goToStep(nextStepIdx);
            } else {
              setIsPlaying(false);
              toast.success("Simulação finalizada com sucesso!");
            }
            return 0;
          }
        });
      }, intervalMs);
    } else {
      // Se for etapa estática (ex.: banho/tosa, retirada na porta), aguarda um tempo e avança
      const waitMs = Math.max(1500, Math.round(4500 / speedMultiplier));
      timerRef.current = setTimeout(() => {
        const nextStepIdx = currentStepIdx + 1;
        if (nextStepIdx < SIMULATION_STEPS.length) {
          void goToStep(nextStepIdx);
        } else {
          setIsPlaying(false);
          toast.success("Simulação de atendimento concluída!");
        }
      }, waitMs) as unknown as ReturnType<typeof setInterval>;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentStepIdx, speedMultiplier, selectedOrder, goToStep]);

  // Criação de atendimento de demonstração em 1 clique
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const handleCreateDemo = async () => {
    setIsCreatingDemo(true);
    try {
      const newOrder = await createDemoTransportAppointment(currentUserId);
      await refetchAppointments();
      setSelectedOrderId(newOrder.transportOrderId);
      setCurrentStepIdx(0);
      setIsPlaying(false);
      toast.success("Atendimento de teste com Táxi Pet criado e selecionado!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível criar agendamento de teste");
    } finally {
      setIsCreatingDemo(false);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-xl md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Truck className="h-5 w-5" />
            </span>
            <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
              Simulador de Delivery / Táxi Pet (Ao Vivo)
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Simule o deslocamento do motorista pelas ruas de Franco da Rocha, acompanhe a telemetria GPS e a visão simultânea do tutor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateDemo}
            disabled={isCreatingDemo}
            className="gap-1.5 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-4 w-4" />
            {isCreatingDemo ? "Criando..." : "Criar Agendamento de Teste (1 clique)"}
          </Button>

          {onClose && (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
          )}
        </div>
      </div>

      {/* Seletor de Atendimento */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/30 p-3 text-xs">
        <label htmlFor="sim-order" className="font-semibold text-muted-foreground">
          Atendimento ativo:
        </label>
        <select
          id="sim-order"
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className="h-8 max-w-md rounded-lg border border-border bg-card px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {(transportAppointments ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              #{t.code} · {t.appointments?.pets?.name ?? "Pet"} ({t.appointments?.services?.name ?? "Serviço"}) — {opsStatusLabels[(t.appointments?.ops_status ?? "agendado") as OpsStatus]}
            </option>
          ))}
          {(transportAppointments ?? []).length === 0 && (
            <option value="">Nenhum pedido cadastrado — clique em Criar Agendamento de Teste</option>
          )}
        </select>

        {selectedOrder && (
          <span className="text-[11px] text-muted-foreground">
            Pet: <strong className="text-foreground">{appointment?.pets?.name}</strong> | Endereço: {appointment?.addresses?.street}, {appointment?.addresses?.number}
          </span>
        )}
      </div>

      {/* Régua de Progresso do Ciclo de Atendimento (9 Etapas) */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">Etapa do Atendimento:</span>
          <span className="font-bold text-primary">
            Etapa {currentStepIdx + 1} de {SIMULATION_STEPS.length}
          </span>
        </div>

        {/* Linha de bolinhas/etapas */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
          {SIMULATION_STEPS.map((step, idx) => {
            const isCurrent = idx === currentStepIdx;
            const isPassed = idx < currentStepIdx;
            return (
              <button
                key={step.status}
                type="button"
                onClick={() => goToStep(idx)}
                className={`flex flex-col items-center justify-between rounded-xl border p-2 text-center transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : isPassed
                      ? "border-emerald-500/40 bg-emerald-500/5 text-muted-foreground"
                      : "border-border/60 bg-card text-muted-foreground opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold">
                  {isPassed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <span className={isCurrent ? "text-primary font-black" : ""}>{idx + 1}</span>
                  )}
                </div>
                <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight">
                  {step.label}
                </span>
                {step.isMoving && (
                  <span className="mt-1 flex items-center gap-0.5 text-[9px] text-blue-600 font-medium">
                    <Navigation className="h-2.5 w-2.5 animate-pulse" />
                    GPS
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cartão de Status Atual e Mensagem ao Tutor */}
      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={statusToneClass(opsStatusTone(currentStep.status))}
            >
              {currentStep.label}
            </Badge>
            <span className="text-xs font-semibold text-foreground">{currentStep.description}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            <span>Velocidade simulada:</span>
            <strong className="text-foreground font-semibold">
              {currentStep.isMoving ? `${Math.round(((telemetry.speed ?? 0) * 3600) / 1000)} km/h` : "0 km/h (Parado)"}
            </strong>
          </div>
        </div>

        {/* Mensagem em 1ª pessoa que o tutor recebe */}
        <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-background/80 p-2.5 text-xs">
          <HeartHandshake className="h-4 w-4 shrink-0 text-gold mt-0.5" />
          <div>
            <span className="font-semibold text-muted-foreground">Mensagem exibida ao Tutor em tempo real:</span>
            <p className="mt-0.5 font-medium text-foreground italic">
              "{opsStatusTutorMessage[currentStep.status]}"
            </p>
          </div>
        </div>
      </div>

      {/* Controles de Reprodução e Velocidade */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
        {/* Play/Pause e Avanço */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`gap-1.5 font-bold ${
              isPlaying
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" /> Pausar Simulação
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Iniciar Simulação Automática
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={currentStepIdx >= SIMULATION_STEPS.length - 1}
            onClick={() => goToStep(currentStepIdx + 1)}
            className="gap-1 text-xs"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Avançar Etapa
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsPlaying(false);
              void goToStep(0);
            }}
            className="gap-1 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar
          </Button>
        </div>

        {/* Multiplicador de Velocidade */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted-foreground">Velocidade:</span>
          {[1, 3, 10].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSpeedMultiplier(v)}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition-all ${
                speedMultiplier === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {v}x {v === 10 ? "Turbo" : v === 3 ? "Rápido" : "Real"}
            </button>
          ))}
        </div>
      </div>

      {/* Mapa ao Vivo Integrado */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="font-semibold text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Visualizador do Trajeto ao Vivo (Franco da Rocha):
          </span>
          <span className="text-[11px] text-muted-foreground">
            GPS Atual: {telemetry.lat.toFixed(5)}, {telemetry.lng.toFixed(5)}
          </span>
        </div>

        {selectedOrder ? (
          <div className="overflow-hidden rounded-xl border border-border shadow-sm">
            <DriverLiveMap
              appointmentId={selectedOrder.appointment_id}
              active={true}
            />
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-xs text-muted-foreground">
            Selecione ou crie um agendamento acima para carregar o mapa
          </div>
        )}
      </div>

      {/* Dica de Teste Multi-Telas */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/40 p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-base">💡</span>
          <span className="text-muted-foreground">
            <strong>Dica para testar no seu PC:</strong> Abra uma nova janela em{" "}
            <a
              href="/conta"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary underline inline-flex items-center gap-0.5"
            >
              /conta (Visão do Tutor) <ExternalLink className="h-3 w-3" />
            </a>{" "}
            e veja o carrinho se movendo e o status mudando em tempo real!
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/conta"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Abrir Visão do Tutor
          </a>
          <a
            href="/motorista"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Abrir Painel do Motorista
          </a>
        </div>
      </div>
    </div>
  );
}
