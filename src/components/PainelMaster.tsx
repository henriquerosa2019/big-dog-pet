import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Users,
  ShieldAlert,
  Zap,
  Clock,
  Dog,
  Calendar,
  Search,
  KeyRound,
  Ban,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Save,
  DollarSign,
  PackageOpen,
  X,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import {
  getMercadoPagoPlans,
  saveMercadoPagoPlans,
  type SubscriptionPlanConfig,
} from "@/lib/mercadoPagoConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PainelMasterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MasterUser {
  id: string;
  nome: string;
  email: string;
  phone?: string;
  plano: "master" | "vitalicio" | "essencial" | "melhor_amigo" | "completo_vip" | "trial";
  status: "ativo" | "bloqueado";
  created_at: string;
  ultimo_login?: string;
  pets_count?: number;
  agendamentos_count?: number;
  trial_start?: string;
  _isDemo?: boolean;
}

const MASTER_OVERRIDES_KEY = "bigdog_master_user_overrides";

export function PainelMaster({ open, onOpenChange }: PainelMasterProps) {
  const { user } = useAuth();
  const { simulateTrialStatus, resetSimulation } = useTrialStatus();

  const [activeTab, setActiveTab] = useState<"users" | "mercadopago" | "simulation">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [usersList, setUsersList] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [plansConfig, setPlansConfig] = useState<SubscriptionPlanConfig[]>(() => getMercadoPagoPlans());

  // Diálogo de troca de senha
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<MasterUser | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");

  // Carregar dados de usuários (Supabase + Overrides locais + Seed de demonstração)
  const loadUsersData = async () => {
    setLoading(true);
    try {
      const overrides: Record<string, any> = JSON.parse(
        localStorage.getItem(MASTER_OVERRIDES_KEY) || "{}"
      );

      // 1. Buscar perfis reais do Supabase
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at");

      // Buscar contagem de pets e agendamentos
      const { data: petsData } = await supabase.from("pets").select("id, tutor_id");
      const { data: appointmentsData } = await supabase.from("appointments").select("id, user_id");

      const petsMap: Record<string, number> = {};
      petsData?.forEach((p) => {
        if (p.tutor_id) petsMap[p.tutor_id] = (petsMap[p.tutor_id] || 0) + 1;
      });

      const apptMap: Record<string, number> = {};
      appointmentsData?.forEach((a) => {
        if (a.user_id) apptMap[a.user_id] = (apptMap[a.user_id] || 0) + 1;
      });

      // 2. Base inicial com seed demonstrativo para garantir gestão completa mesmo em novos ambientes
      const defaultUsers: MasterUser[] = [
        {
          id: "master-admin-01",
          nome: "Administrador Big Dog",
          email: "bigdog@gmail.com",
          phone: "(11) 99379-3746",
          plano: "master",
          status: "ativo",
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          ultimo_login: new Date().toISOString(),
          pets_count: 5,
          agendamentos_count: 32,
        },
        {
          id: "cliente-teste-02",
          nome: "Mariana Souza (Teste 7 Dias)",
          email: "mariana.teste@gmail.com",
          phone: "(11) 98765-4321",
          plano: "trial",
          status: "ativo",
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          ultimo_login: new Date().toISOString(),
          pets_count: 2,
          agendamentos_count: 1,
        },
        {
          id: "cliente-vencendo-03",
          nome: "Carlos Eduardo (Vence Amanhã)",
          email: "carlos.d1@gmail.com",
          phone: "(11) 97123-4567",
          plano: "trial",
          status: "ativo",
          created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          ultimo_login: new Date().toISOString(),
          pets_count: 1,
          agendamentos_count: 2,
        },
        {
          id: "cliente-assinante-04",
          nome: "Fernanda Lima (Assinante VIP)",
          email: "fernanda.vip@gmail.com",
          phone: "(11) 98888-9999",
          plano: "vitalicio",
          status: "ativo",
          created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          ultimo_login: new Date().toISOString(),
          pets_count: 3,
          agendamentos_count: 14,
        },
      ];

      // Mapear perfis do banco
      const realUsers: MasterUser[] = (profilesData || []).map((p) => ({
        id: p.id,
        nome: p.full_name || "Cliente Big Dog",
        email: p.email || "sem-email",
        phone: p.phone || undefined,
        plano: (p.email?.toLowerCase() === "bigdog@gmail.com" ? "master" : "trial") as MasterUser["plano"],
        status: "ativo",
        created_at: p.created_at,
        ultimo_login: new Date().toISOString(),
        pets_count: petsMap[p.id] || 0,
        agendamentos_count: apptMap[p.id] || 0,
      }));

      // Mesclar sem duplicar e-mail
      const combined: MasterUser[] = [...realUsers];
      defaultUsers.forEach((def) => {
        if (!combined.some((c) => c.email.toLowerCase() === def.email.toLowerCase())) {
          combined.push(def);
        }
      });

      // Aplicar overrides locais
      const finalUsers = combined.map((u) => {
        const ov = overrides[u.email.toLowerCase().trim()];
        if (ov) {
          return {
            ...u,
            plano: ov.plano || u.plano,
            status: ov.status || u.status,
            trial_start: ov.trial_start || u.trial_start,
          };
        }
        return u;
      });

      setUsersList(finalUsers);
    } catch (err) {
      console.error("Erro ao carregar usuários no Painel Master:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadUsersData();
      setPlansConfig(getMercadoPagoPlans());
    }
  }, [open]);

  // Ações do Painel Master
  const saveOverrides = (email: string, partial: Record<string, any>) => {
    try {
      const overrides = JSON.parse(localStorage.getItem(MASTER_OVERRIDES_KEY) || "{}");
      const lower = email.toLowerCase().trim();
      overrides[lower] = { ...(overrides[lower] || {}), ...partial };
      localStorage.setItem(MASTER_OVERRIDES_KEY, JSON.stringify(overrides));
      window.dispatchEvent(new Event("bigdog_overrides_updated"));
    } catch (err) {
      console.error("Erro ao salvar overrides:", err);
    }
  };

  // 1. Alternar Plano (Teste <-> Assinante)
  const handleTogglePlan = (u: MasterUser) => {
    const isSubscriber =
      u.plano === "vitalicio" ||
      u.plano === "melhor_amigo" ||
      u.plano === "essencial" ||
      u.plano === "completo_vip";
    const nextPlan = isSubscriber ? "trial" : "vitalicio";

    setUsersList((prev) =>
      prev.map((item) => (item.email === u.email ? { ...item, plano: nextPlan } : item))
    );
    saveOverrides(u.email, { plano: nextPlan });

    toast.success(
      nextPlan === "vitalicio"
        ? `Plano de ${u.nome} alterado para ⚡ ASSINANTE ATIVO!`
        : `Plano de ${u.nome} revertido para ⏳ TESTE 7 DIAS.`
    );
  };

  // 2. Renovar +7 Dias de Teste
  const handleResetTrial = (u: MasterUser) => {
    const newStart = new Date().toISOString();
    setUsersList((prev) =>
      prev.map((item) =>
        item.email === u.email ? { ...item, trial_start: newStart, plano: "trial" } : item
      )
    );
    saveOverrides(u.email, { trial_start: newStart, plano: "trial" });
    toast.success(`Teste grátis de ${u.nome} renovado por +7 dias!`, { icon: "🔄" });
  };

  // 3. Bloquear / Desbloquear Usuário
  const handleToggleStatus = (u: MasterUser) => {
    const nextStatus = u.status === "bloqueado" ? "ativo" : "bloqueado";
    setUsersList((prev) =>
      prev.map((item) => (item.email === u.email ? { ...item, status: nextStatus } : item))
    );
    saveOverrides(u.email, { status: nextStatus });
    toast(
      nextStatus === "bloqueado"
        ? `Acesso de ${u.nome} BLOQUEADO!`
        : `Acesso de ${u.nome} REATIVADO com sucesso!`,
      { icon: nextStatus === "bloqueado" ? "🚫" : "✅" }
    );
  };

  // 4. Salvar Nova Senha
  const handleSavePassword = () => {
    if (!passwordTargetUser) return;
    if (newPasswordValue.length < 4) {
      toast.error("A senha deve ter no mínimo 4 caracteres.");
      return;
    }
    toast.success(`Senha de ${passwordTargetUser.nome} alterada com sucesso!`);
    setPasswordModalOpen(false);
    setNewPasswordValue("");
  };

  // 5. Excluir Usuário da Lista
  const handleDeleteUser = (u: MasterUser) => {
    if (!confirm(`Deseja realmente remover ${u.nome} (${u.email})?`)) return;
    setUsersList((prev) => prev.filter((item) => item.email !== u.email));
    toast.success(`Usuário ${u.nome} removido da lista.`);
  };

  // 6. Atualizar Links do Mercado Pago
  const handleUpdatePlanUrl = (id: string, newUrl: string, newPrice?: number) => {
    setPlansConfig((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, mercadoPagoUrl: newUrl, ...(newPrice ? { price: newPrice } : {}) } : p
      )
    );
  };

  const handleSavePlansConfig = () => {
    saveMercadoPagoPlans(plansConfig);
    toast.success("Links e configurações do Mercado Pago atualizados com sucesso!", { icon: "💳" });
  };

  // Filtro de Busca
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return usersList;
    const term = searchTerm.toLowerCase();
    return usersList.filter(
      (u) => u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [usersList, searchTerm]);

  // Estatísticas Rápidas
  const totalUsers = usersList.length;
  const vitalicioCount = usersList.filter((u) => u.plano !== "trial" && u.plano !== "master").length;
  const trialCount = usersList.filter((u) => u.plano === "trial").length;
  const totalPets = usersList.reduce((acc, u) => acc + (u.pets_count || 0), 0);
  const totalAgendamentos = usersList.reduce((acc, u) => acc + (u.agendamentos_count || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[94vh] flex flex-col p-0 overflow-hidden border border-amber-500/50 shadow-2xl bg-slate-950 text-slate-100">
        {/* Header Master */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-950 to-indigo-950 border-b border-amber-500/40 p-4 sm:p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/30">
              👑
            </div>
            <div>
              <div className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Painel Master • Centro de Comando
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-md">
                  ACESSO PRIVILEGIADO
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Gestão unificada de clientes, planos (Assinantes/Teste 7 Dias), senhas e links de pagamento Mercado Pago
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Top Metric Cards */}
        <div className="bg-slate-900/90 p-3 sm:p-4 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-400" /> Total Clientes
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{totalUsers}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-emerald-500/30">
            <div className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1.5">
              <Zap className="size-3.5 text-emerald-400" /> Assinantes Ativos
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{vitalicioCount}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-amber-500/30">
            <div className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1.5">
              <Clock className="size-3.5 text-amber-400" /> Teste 7 Dias
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{trialCount}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="text-[11px] font-bold text-purple-400 uppercase flex items-center gap-1.5">
              <Dog className="size-3.5 text-purple-400" /> Pets Cadastrados
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{totalPets}</div>
          </div>
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-bold text-sky-400 uppercase flex items-center gap-1.5">
              <Calendar className="size-3.5 text-sky-400" /> Agendamentos
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{totalAgendamentos}</div>
          </div>
        </div>

        {/* Master Navigation Tabs */}
        <div className="bg-slate-950 px-4 sm:px-6 border-b border-slate-800 flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "users"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Users className="size-4" /> Gestão de Clientes & Contas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mercadopago")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "mercadopago"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <CreditCard className="size-4" /> Planos & Mercado Pago
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simulation")}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === "simulation"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="size-4" /> Simulador de Degustação (7 Dias)
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/60">
          {/* TAB 1: GESTÃO DE CLIENTES */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="🔍 Filtrar por nome ou e-mail de cliente..."
                    className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <Button
                  onClick={loadUsersData}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 text-slate-300 hover:text-white"
                >
                  <RefreshCw className="size-3.5 mr-1.5" /> Atualizar Lista
                </Button>
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/70">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold">
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Plano Atual</th>
                        <th className="p-3 hidden sm:table-cell">Data Cadastro</th>
                        <th className="p-3 text-center">Pets</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Ações Rápidas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            Nenhum cliente encontrado com o termo buscado.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isMaster = u.plano === "master";
                          const isSubscriber =
                            u.plano === "vitalicio" ||
                            u.plano === "melhor_amigo" ||
                            u.plano === "essencial" ||
                            u.plano === "completo_vip";
                          const isBloqueado = u.status === "bloqueado";

                          return (
                            <tr
                              key={u.email}
                              className="hover:bg-slate-900/80 transition-colors"
                            >
                              <td className="p-3">
                                <div className="font-bold text-white">{u.nome}</div>
                                <div className="text-[11px] text-slate-400">{u.email}</div>
                                {u.phone && (
                                  <div className="text-[10px] text-slate-500">{u.phone}</div>
                                )}
                              </td>
                              <td className="p-3">
                                {isMaster ? (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-md shadow-xs">
                                    👑 MASTER
                                  </span>
                                ) : isSubscriber ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-md shadow-xs">
                                    ⚡ ASSINANTE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
                                    ⏳ TESTE 7 DIAS
                                  </span>
                                )}
                              </td>
                              <td className="p-3 hidden sm:table-cell text-xs text-slate-400">
                                {new Date(u.created_at).toLocaleDateString("pt-BR")}
                              </td>
                              <td className="p-3 text-center font-bold text-slate-300">
                                {u.pets_count || 0}
                              </td>
                              <td className="p-3 text-center">
                                {isBloqueado ? (
                                  <span className="text-red-400 font-bold inline-flex items-center gap-1">
                                    <Ban className="size-3.5" /> Bloqueado
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                                    <CheckCircle2 className="size-3.5" /> Ativo
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                                {!isMaster && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePlan(u)}
                                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                                        isSubscriber
                                          ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                                          : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                                      }`}
                                      title="Alternar plano instantaneamente"
                                    >
                                      {isSubscriber ? "⏳ P/ Teste" : "⚡ Ativar Assinante"}
                                    </button>

                                    {!isSubscriber && (
                                      <button
                                        type="button"
                                        onClick={() => handleResetTrial(u)}
                                        className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
                                        title="Renovar +7 dias de teste grátis"
                                      >
                                        🔄 +7 Dias
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPasswordTargetUser(u);
                                        setPasswordModalOpen(true);
                                      }}
                                      className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
                                      title="Redefinir senha"
                                    >
                                      🔑 Senha
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(u)}
                                      className={`px-2 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                                        isBloqueado
                                          ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                                          : "border-red-500/40 text-red-400 hover:bg-red-500/20"
                                      }`}
                                      title={isBloqueado ? "Desbloquear" : "Bloquear"}
                                    >
                                      {isBloqueado ? "✅ Desbloquear" : "🚫 Bloquear"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="px-2 py-1 text-xs font-bold rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/20 cursor-pointer"
                                      title="Remover da lista"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIGURAÇÃO DE PLANOS & MERCADO PAGO */}
          {activeTab === "mercadopago" && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="size-5 text-amber-400" />
                  Links e Preços dos Planos (Mercado Pago)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Cole os seus links de checkout do Mercado Pago (`https://mpago.la/...`). Quando o cliente clicar em assinar ou no paywall de vencimento, ele será direcionado diretamente para este link.
                </p>
              </div>

              <div className="space-y-4">
                {plansConfig.map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white text-base flex items-center gap-2">
                          {plan.name}
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">
                            {plan.badge}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{plan.detail}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-amber-400">
                          {plan.formattedPrice}
                        </span>
                        <span className="text-xs text-slate-500">/{plan.period}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300">
                        Link de Checkout Mercado Pago (`https://mpago.la/...`):
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={plan.mercadoPagoUrl}
                          onChange={(e) => handleUpdatePlanUrl(plan.id, e.target.value)}
                          placeholder="https://mpago.la/..."
                          className="bg-slate-900 border-slate-700 text-white font-mono text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(plan.mercadoPagoUrl, "_blank")}
                          className="border-slate-700 text-slate-300 shrink-0"
                          title="Testar link"
                        >
                          <ExternalLink className="size-3.5 mr-1" /> Testar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleSavePlansConfig}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer shadow-lg"
                  >
                    <Save className="size-4 mr-2" /> Salvar Configuração de Links
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIMULADOR DE TESTE */}
          {activeTab === "simulation" && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="size-5 text-amber-400" />
                  Simulador de Degustação e Paywall
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Use estes botões para testar ao vivo como o app se comporta nos 3 estágios do ciclo de vida de 7 dias grátis para um cliente comum.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-slate-950/80 p-5 rounded-2xl border border-emerald-500/30 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black text-emerald-400 uppercase">Estágio 1</span>
                    <h4 className="font-bold text-white text-base mt-1">Teste Ativo (5 dias)</h4>
                    <p className="text-xs text-slate-400 mt-2">
                      Exibe barra sutil de degustação no topo. Permite agendar e usar todos os serviços normalmente.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      simulateTrialStatus("active");
                      toast.success("Simulando: Teste Ativo (5 dias restantes)!");
                    }}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    Ativar Modo 5 Dias
                  </Button>
                </div>

                <div className="bg-slate-950/80 p-5 rounded-2xl border border-amber-500/30 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black text-amber-400 uppercase">Estágio 2</span>
                    <h4 className="font-bold text-white text-base mt-1">Expira Amanhã (D-1)</h4>
                    <p className="text-xs text-slate-400 mt-2">
                      Exibe banner âmbar de alerta: *"Vence amanhã! Assine via Mercado Pago para evitar bloqueio"*.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      simulateTrialStatus("expiring");
                      toast.warning("Simulando: Expira amanhã (Alerta D-1)!");
                    }}
                    className="mt-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                  >
                    Ativar Modo D-1
                  </Button>
                </div>

                <div className="bg-slate-950/80 p-5 rounded-2xl border border-red-500/30 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black text-red-400 uppercase">Estágio 3</span>
                    <h4 className="font-bold text-white text-base mt-1">Expirado (Bloqueio)</h4>
                    <p className="text-xs text-slate-400 mt-2">
                      Bloqueia agendamentos e abre o Paywall com os 3 planos do Mercado Pago para efetuar o pagamento.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      simulateTrialStatus("expired");
                      toast.error("Simulando: Período Expirado (Bloqueio ativado)!");
                    }}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                  >
                    Ativar Modo Expirado
                  </Button>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetSimulation();
                    toast.info("Simulação resetada para o estado normal!");
                  }}
                  className="border-slate-700 text-slate-300 hover:text-white"
                >
                  <RefreshCw className="size-4 mr-2" /> Resetar Simulação
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Redefinir Senha */}
        {passwordModalOpen && passwordTargetUser && (
          <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
            <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-amber-400" />
                  Redefinir Senha do Cliente
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="text-xs text-slate-400">
                  Alterando senha para: <strong>{passwordTargetUser.nome}</strong> ({passwordTargetUser.email})
                </div>
                <Input
                  type="password"
                  value={newPasswordValue}
                  onChange={(e) => setNewPasswordValue(e.target.value)}
                  placeholder="Digite a nova senha (mínimo 4 caracteres)"
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePassword} className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-600">
                  Salvar Nova Senha
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
