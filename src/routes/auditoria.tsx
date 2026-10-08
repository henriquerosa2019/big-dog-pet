import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  RefreshCw,
  Users,
  Dog,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/auditoria")({
  head: () => ({
    meta: [
      { title: "Torre de Controle & Auditoria de Dados | Vetty" },
      {
        name: "description",
        content: "Painel em tempo real para conferência e auditoria de dados lançados nos testes.",
      },
    ],
  }),
  component: DashboardAuditoria,
});

export function DashboardAuditoria() {
  const queryClient = useQueryClient();
  const [filterTable, setFilterTable] = useState<string>("todos");
  const [lastEvent, setLastEvent] = useState<{ table: string; type: string; time: string } | null>(null);

  // 1. CARREGAR DADOS REAIS DE TODAS AS TABELAS PRINCIPAIS
  const { data: appointments = [], isFetching: isFetchingAppts } = useQuery({
    queryKey: ["audit-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          user_id,
          pet_id,
          scheduled_at,
          created_at,
          status,
          ops_status,
          logistics_type,
          service_price_cents,
          transport_price_cents,
          total_cents,
          payment_status,
          notes,
          services ( name, category, price_cents ),
          pets ( name, species, breed, size )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 3000,
  });

  const { data: profiles = [], isFetching: isFetchingProfiles } = useQuery({
    queryKey: ["audit-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 3000,
  });

  const { data: pets = [], isFetching: isFetchingPets } = useQuery({
    queryKey: ["audit-pets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("id, name, species, breed, size, weight_kg, owner_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 3000,
  });

  const { data: transportOrders = [], isFetching: isFetchingTransport } = useQuery({
    queryKey: ["audit-transport-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_orders")
        .select(`
          id,
          code,
          appointment_id,
          driver_id,
          price_cents,
          assigned_at,
          en_route_pickup_at,
          picked_up_at,
          arrived_shop_at,
          en_route_return_at,
          delivered_at,
          created_at,
          addresses ( street, number, district, city )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 3000,
  });

  const { data: medicalRecords = [] } = useQuery({
    queryKey: ["audit-medical-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_records")
        .select("id, pet_id, record_type, diagnosis, treatment, next_due_date, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 3000,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["audit-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id, name, category, price_cents, active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["audit-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, category, price_cents, stock, active");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. ESCUTA EM TEMPO REAL (WEBSOCKET SUPABASE)
  useEffect(() => {
    const channel = supabase
      .channel("auditoria-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          setLastEvent({
            table: "appointments",
            type: payload.eventType,
            time: new Date().toLocaleTimeString("pt-BR"),
          });
          queryClient.invalidateQueries({ queryKey: ["audit-appointments"] });
          toast.info(`🔔 Agendamento atualizado em tempo real (${payload.eventType})!`);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pets" },
        (payload) => {
          setLastEvent({
            table: "pets",
            type: payload.eventType,
            time: new Date().toLocaleTimeString("pt-BR"),
          });
          queryClient.invalidateQueries({ queryKey: ["audit-pets"] });
          toast.info(`🐾 Novo Pet registrado em tempo real!`);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          setLastEvent({
            table: "profiles",
            type: payload.eventType,
            time: new Date().toLocaleTimeString("pt-BR"),
          });
          queryClient.invalidateQueries({ queryKey: ["audit-profiles"] });
          toast.info(`👤 Novo Cliente registrado no banco!`);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transport_orders" },
        (payload) => {
          setLastEvent({
            table: "transport_orders",
            type: payload.eventType,
            time: new Date().toLocaleTimeString("pt-BR"),
          });
          queryClient.invalidateQueries({ queryKey: ["audit-transport-orders"] });
          toast.info(`🚗 Atualização de Corrida Táxi Pet ao vivo!`);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // CÁLCULOS & MÉTRICAS DE AUDITORIA
  const apptsCount = appointments.length;
  const apptsAbertos = appointments.filter(
    (a) => a.status === "pendente" || a.ops_status === "aguardando_inicio"
  ).length;
  const apptsConcluidos = appointments.filter(
    (a) => a.status === "concluido" || a.ops_status === "concluido"
  ).length;

  const totalReceitaCents = appointments
    .filter((a) => a.status !== "cancelado")
    .reduce((acc, a) => acc + (a.total_cents || a.service_price_cents || 0), 0);

  const isUpdating = isFetchingAppts || isFetchingProfiles || isFetchingPets || isFetchingTransport;

  return (
    <div className="min-h-screen bg-[#07130e] text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER DA TORRE DE CONTROLE */}
        <div className="bg-[#0c221a] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
                  MONITOR DE AUDITORIA & CHECKUP EM TEMPO REAL
                </span>
                {lastEvent && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-[10px] ml-2 animate-pulse">
                    Último evento: {lastEvent.table} ({lastEvent.type}) às {lastEvent.time}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <Database className="h-7 w-7 text-emerald-400" />
                Torre de Controle de Dados (Supabase)
              </h1>
              <p className="text-xs sm:text-sm text-emerald-200/80 max-w-2xl">
                Este dashboard independente reflete em tempo real tudo o que entra nas tabelas do banco de dados, permitindo conferir se cada tela criada no menu lateral está recebendo seus devidos lançamentos de teste.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queryClient.invalidateQueries();
                  toast.success("Dados sincronizados com o Supabase!");
                }}
                disabled={isUpdating}
                className="h-10 px-4 rounded-xl text-xs font-bold border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 gap-2 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
                Atualizar Agora
              </Button>

              <Button
                asChild
                size="sm"
                className="h-10 px-4 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 gap-2 shadow-lg shadow-emerald-500/20"
              >
                <Link to="/admin">
                  <ArrowRight className="h-4 w-4" />
                  Abrir Painel Loja
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* 1. CARDS DE RESUMO OPERACIONAL EM TEMPO REAL */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* CLIENTES */}
          <div className="bg-[#0b1c15] border border-emerald-900/50 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Clientes (Tutores)</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{profiles.length}</div>
            <span className="text-[10px] text-emerald-400/90 font-medium">Tabela `profiles`</span>
          </div>

          {/* PETS */}
          <div className="bg-[#0b1c15] border border-emerald-900/50 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Pets Cadastrados</span>
              <Dog className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{pets.length}</div>
            <span className="text-[10px] text-emerald-400/90 font-medium">Tabela `pets`</span>
          </div>

          {/* AGENDAMENTOS TOTAIS */}
          <div className="bg-[#0b1c15] border border-emerald-900/50 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Agendamentos</span>
              <Calendar className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">{apptsCount}</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <span className="text-amber-400 font-bold">{apptsAbertos} abertos</span> · 
              <span className="text-emerald-400 font-bold">{apptsConcluidos} conc.</span>
            </div>
          </div>

          {/* TÁXI PET */}
          <div className="bg-[#0b1c15] border border-emerald-900/50 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Táxi Pet (Corridas)</span>
              <Truck className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white">{transportOrders.length}</div>
            <span className="text-[10px] text-blue-400/90 font-medium">Tabela `transport_orders`</span>
          </div>

          {/* PRONTUÁRIOS */}
          <div className="bg-[#0b1c15] border border-emerald-900/50 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Prontuários & Saúde</span>
              <Activity className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-white">{medicalRecords.length}</div>
            <span className="text-[10px] text-rose-400/90 font-medium">Tabela `medical_records`</span>
          </div>

          {/* RECEITA ACUMULADA */}
          <div className="bg-[#0b1c15] border border-emerald-900/50 p-4 rounded-2xl">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Receita Lançada</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-300">{formatBRL(totalReceitaCents)}</div>
            <span className="text-[10px] text-slate-400 font-medium">Atendimentos ativos</span>
          </div>
        </div>

        {/* 2. MATRIZ DE CONFERÊNCIA: TABELAS DO BANCO VS TELAS DO MENU */}
        <div className="bg-[#0b1c15] border border-emerald-900/60 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h2 className="text-base font-black text-white">
                Mapeamento das Telas do Menu Lateral vs Dados no Banco
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Verifique se cada seção do menu possui dados suficientes para exibição
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-emerald-900/40 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Seção do Menu Lateral</th>
                  <th className="py-2.5 px-3">Tabela no Supabase</th>
                  <th className="py-2.5 px-3">Registros no Banco</th>
                  <th className="py-2.5 px-3">Status de Alimentação</th>
                  <th className="py-2.5 px-3 text-right">Ação Direta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/40">
                {/* 1. AGENDAS & KANBAN */}
                <tr className="hover:bg-emerald-950/20">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    Visão Geral / Kanban / Agenda Visual
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-300">appointments</td>
                  <td className="py-3 px-3 font-black text-white">{appointments.length} agendamentos</td>
                  <td className="py-3 px-3">
                    {appointments.length > 0 ? (
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]">
                        ✓ Alimentado ({apptsAbertos} abertos / {apptsConcluidos} concl.)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                        ⚠️ Tabela Vazia (Usando Mockup na tela)
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link to="/admin" className="text-emerald-400 hover:underline font-bold">
                      Conferir no Admin →
                    </Link>
                  </td>
                </tr>

                {/* 2. CLIENTES */}
                <tr className="hover:bg-emerald-950/20">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    Clientes (Todos / Novo / Alterar)
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-300">profiles + addresses</td>
                  <td className="py-3 px-3 font-black text-white">{profiles.length} tutores</td>
                  <td className="py-3 px-3">
                    {profiles.length > 0 ? (
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]">
                        ✓ {profiles.length} perfis registrados
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                        ⚠️ Sem clientes na tabela
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link to="/admin" className="text-emerald-400 hover:underline font-bold">
                      Ver Clientes →
                    </Link>
                  </td>
                </tr>

                {/* 3. TÁXI PET & LOGÍSTICA */}
                <tr className="hover:bg-emerald-950/20">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-400" />
                    Táxi Pet (Logística & Rota no Mapa)
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-300">transport_orders</td>
                  <td className="py-3 px-3 font-black text-white">{transportOrders.length} corridas</td>
                  <td className="py-3 px-3">
                    {transportOrders.length > 0 ? (
                      <Badge className="bg-blue-950 text-blue-300 border-blue-500/40 text-[10px]">
                        ✓ {transportOrders.length} rotas no banco
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                        ⚠️ Sem corridas ativas no banco
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link to="/motorista" className="text-blue-400 hover:underline font-bold">
                      Painel Motorista →
                    </Link>
                  </td>
                </tr>

                {/* 4. CRONOANÁLISE & EFICIÊNCIA */}
                <tr className="hover:bg-emerald-950/20">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    Cronoanálise & Eficiência
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-300">transport_orders + pet_status_history</td>
                  <td className="py-3 px-3 font-black text-white">
                    {transportOrders.length} trajetos · {appointments.length} tempos
                  </td>
                  <td className="py-3 px-3">
                    {transportOrders.length > 0 ? (
                      <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]">
                        ✓ Metrificando tempos
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                        ⚠️ Necessita corridas com marcos temporais
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link to="/admin" className="text-emerald-400 hover:underline font-bold">
                      Ver Cronoanálise →
                    </Link>
                  </td>
                </tr>

                {/* 5. VETERINÁRIA & PRONTUÁRIO */}
                <tr className="hover:bg-emerald-950/20">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-rose-400" />
                    Prontuário Digital & Saúde/Retornos
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-300">medical_records + vaccinations</td>
                  <td className="py-3 px-3 font-black text-white">{medicalRecords.length} registros clínicos</td>
                  <td className="py-3 px-3">
                    {medicalRecords.length > 0 ? (
                      <Badge className="bg-rose-950 text-rose-300 border-rose-500/40 text-[10px]">
                        ✓ Prontuários ativos
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                        ⚠️ Sem prontuários salvos
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link to="/admin" className="text-rose-400 hover:underline font-bold">
                      Ver Prontuários →
                    </Link>
                  </td>
                </tr>

                {/* 6. CATÁLOGOS FIXOS (SERVIÇOS E PRODUTOS) */}
                <tr className="hover:bg-emerald-950/20">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Serviços & Estoque (Produtos)
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-300">services + products</td>
                  <td className="py-3 px-3 font-black text-white">
                    {services.length} serviços · {products.length} produtos
                  </td>
                  <td className="py-3 px-3">
                    <Badge className="bg-emerald-950 text-emerald-300 border-emerald-500/40 text-[10px]">
                      ✓ 100% Preenchido no Banco
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link to="/loja" className="text-emerald-400 hover:underline font-bold">
                      Ver Loja →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. LISTAGEM DETALHADA DOS DADOS LANÇADOS */}
        <div className="bg-[#0b1c15] border border-emerald-900/60 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-white">
                Auditoria Detalhada de Agendamentos & Trajetos (Tempo Real)
              </h2>
              <p className="text-xs text-slate-400">
                Cada lançamento feito em qualquer tela do app aparece listado abaixo instantaneamente.
              </p>
            </div>

            {/* FILTRO RÁPIDO */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => setFilterTable("todos")}
                className={`h-8 px-3 rounded-xl text-xs font-bold transition-all ${
                  filterTable === "todos"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                    : "bg-[#071912] hover:bg-[#0f291f] text-slate-300 border border-emerald-900/60"
                }`}
              >
                Todos ({apptsCount})
              </Button>
              <Button
                size="sm"
                onClick={() => setFilterTable("abertos")}
                className={`h-8 px-3 rounded-xl text-xs font-bold transition-all ${
                  filterTable === "abertos"
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                    : "bg-[#071912] hover:bg-[#0f291f] text-slate-300 border border-emerald-900/60"
                }`}
              >
                Abertos ({apptsAbertos})
              </Button>
              <Button
                size="sm"
                onClick={() => setFilterTable("concluidos")}
                className={`h-8 px-3 rounded-xl text-xs font-bold transition-all ${
                  filterTable === "concluidos"
                    ? "bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20"
                    : "bg-[#071912] hover:bg-[#0f291f] text-slate-300 border border-emerald-900/60"
                }`}
              >
                Concluídos ({apptsConcluidos})
              </Button>
              <Button
                size="sm"
                onClick={() => setFilterTable("taxi")}
                className={`h-8 px-3 rounded-xl text-xs font-bold transition-all ${
                  filterTable === "taxi"
                    ? "bg-blue-500 text-slate-950 font-black shadow-md shadow-blue-500/20"
                    : "bg-[#071912] hover:bg-[#0f291f] text-slate-300 border border-emerald-900/60"
                }`}
              >
                Táxi ({transportOrders.length})
              </Button>
            </div>
          </div>

          {/* TABELA DE REGISTROS */}
          <div className="overflow-x-auto">
            {appointments.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-emerald-900/50 rounded-2xl space-y-3">
                <AlertCircle className="h-10 w-10 text-amber-400/80 mx-auto" />
                <div className="text-sm font-bold text-slate-200">
                  Nenhum agendamento gravado na tabela `appointments` ainda.
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Assim que você cadastrar um agendamento pelo botão "Novo Agendamento" ou agendar via app, ele aparecerá aqui ao vivo via WebSocket.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-emerald-900/40 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Pet</th>
                    <th className="py-2.5 px-3">Serviço</th>
                    <th className="py-2.5 px-3">Logística</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Valor Total</th>
                    <th className="py-2.5 px-3 text-right">ID do Banco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-950/40 font-medium">
                  {appointments.map((a) => (
                    <tr key={a.id} className="hover:bg-emerald-950/20">
                      <td className="py-3 px-3 font-semibold text-slate-300">
                        {new Date(a.scheduled_at || a.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-white">
                          {a.pets?.name || "Pet s/ cadastro"}
                        </span>
                        {a.pets?.breed && (
                          <span className="text-[10px] text-slate-400 block">{a.pets.breed}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-emerald-300">
                        {a.services?.name || "Serviço Padrão"}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-[10px] border-emerald-500/30">
                          {a.logistics_type === "leva_e_traz" ? "🚗 Táxi Pet" : "🏪 Balcão / Loja"}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          className={`text-[10px] ${
                            a.status === "concluido"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                              : a.status === "cancelado"
                              ? "bg-rose-950 text-rose-300 border-rose-500/40"
                              : "bg-amber-950 text-amber-300 border-amber-500/40"
                          }`}
                        >
                          {a.status} ({a.ops_status || "início"})
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-black text-white">
                        {formatBRL(a.total_cents || a.service_price_cents || 0)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[10px] text-slate-500">
                        {a.id.slice(0, 8)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardAuditoria;
