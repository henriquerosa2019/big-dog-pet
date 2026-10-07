import React, { useState } from "react";
import {
  PawPrint,
  ShoppingCart,
  Package,
  Users,
  Stethoscope,
  DollarSign,
  BarChart3,
  Calendar,
  Truck,
  Timer,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  Edit,
  Trash2,
  Syringe,
  Activity,
  UserCheck,
  FileText,
  Clock,
  MapPin,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import vettyPawSymbol from "@/assets/vetty-paw-symbol.png";

export type AdminActiveSection =
  | "visao-geral"
  | "pedidos-loja"
  | "estoque-produtos"
  | "servicos"
  | "clientes-todos"
  | "clientes-novo"
  | "clientes-alterar"
  | "clientes-excluir"
  | "vet-prontuario"
  | "vet-saude"
  | "agenda-visual"
  | "agenda-detalhada"
  | "taxi-pet"
  | "cronoanalise"
  | "financeiro-geral"
  | "relatorios-curva-abc"
  | "relatorios-entregas"
  | "relatorios-atendimentos";

export interface AdminSidebarProps {
  activeSection: AdminActiveSection;
  onSelectSection: (section: AdminActiveSection) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  counts?: {
    todayServices?: number;
    unreadChat?: number;
    urgentHealth?: number;
    pendingAppts?: number;
    criticalStock?: number;
  };
}

export function AdminSidebar({
  activeSection,
  onSelectSection,
  isOpenMobile = false,
  onCloseMobile,
  counts = {},
}: AdminSidebarProps) {
  // Controle de submenus abertos
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    vendas: activeSection.startsWith("pedidos"),
    clientes: activeSection.startsWith("clientes"),
    veterinaria: activeSection.startsWith("vet"),
    agenda: activeSection.startsWith("agenda"),
    relatorios: activeSection.startsWith("relatorios"),
  });

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelect = (sec: AdminActiveSection) => {
    onSelectSection(sec);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Overlay Mobile */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0a1411] text-slate-200 border-r border-emerald-950/60 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shadow-2xl",
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header do Menu com Logo Vetty e Ano */}
        <div className="p-4 border-b border-emerald-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#102a24] to-[#0a1815] border border-emerald-500/40 text-emerald-400 shadow-md">
              <img
                src={vettyPawSymbol}
                alt="Vetty"
                className="h-6 w-6 object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-white tracking-tight">VETTY</span>
                <span className="text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                  GESTÃO
                </span>
              </div>
              <span className="text-[11px] text-emerald-500/80 font-bold block">
                Janeiro 2024
              </span>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-950/40"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Lista de Navegação Principal com Submenus */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-emerald-950">
          {/* 1. VISÃO GERAL */}
          <button
            type="button"
            onClick={() => handleSelect("visao-geral")}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              activeSection === "visao-geral"
                ? "bg-[#142922] text-white font-extrabold shadow-sm border border-emerald-500/30"
                : "text-slate-300 hover:bg-[#10221c] hover:text-white"
            )}
          >
            {activeSection === "visao-geral" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
            )}
            <PawPrint className={cn("h-4 w-4", activeSection === "visao-geral" ? "text-emerald-400" : "text-emerald-500/80")} />
            <span className="flex-1 text-left">Visão Geral</span>
            {counts.todayServices ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-300 font-bold">
                {counts.todayServices}
              </span>
            ) : null}
          </button>

          {/* 2. VENDAS (Dropdown) */}
          <div>
            <button
              type="button"
              onClick={() => toggleMenu("vendas")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeSection.startsWith("pedidos")
                  ? "bg-[#142922] text-white"
                  : "text-slate-300 hover:bg-[#10221c] hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-4 w-4 text-emerald-500/80" />
                <span>Vendas</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                  openMenus.vendas && "rotate-180"
                )}
              />
            </button>
            {openMenus.vendas && (
              <div className="pl-9 pr-1 pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleSelect("pedidos-loja")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between",
                    activeSection === "pedidos-loja"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <span>Pedidos Loja</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. ESTOQUE & PRODUTOS */}
          <button
            type="button"
            onClick={() => handleSelect("estoque-produtos")}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              activeSection === "estoque-produtos"
                ? "bg-[#142922] text-white font-extrabold shadow-sm border border-emerald-500/30"
                : "text-slate-300 hover:bg-[#10221c] hover:text-white"
            )}
          >
            {activeSection === "estoque-produtos" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
            )}
            <Package className="h-4 w-4 text-emerald-500/80" />
            <span className="flex-1 text-left">Estoque (Produtos)</span>
            {counts.criticalStock ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500 text-slate-950 font-black">
                ⚠️ {counts.criticalStock}
              </span>
            ) : null}
          </button>

          {/* SERVIÇOS (CATÁLOGO) */}
          <button
            type="button"
            onClick={() => handleSelect("servicos")}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              activeSection === "servicos"
                ? "bg-[#142922] text-white font-extrabold shadow-sm border border-emerald-500/30"
                : "text-slate-300 hover:bg-[#10221c] hover:text-white"
            )}
          >
            {activeSection === "servicos" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
            )}
            <FileText className="h-4 w-4 text-emerald-500/80" />
            <span className="flex-1 text-left">Serviços da Loja</span>
          </button>

          {/* 4. CLIENTES (Dropdown com Novo, Alterar, Excluir) */}
          <div>
            <button
              type="button"
              onClick={() => toggleMenu("clientes")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeSection.startsWith("clientes")
                  ? "bg-[#142922] text-white"
                  : "text-slate-300 hover:bg-[#10221c] hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-emerald-500/80" />
                <span>Clientes</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                  openMenus.clientes && "rotate-180"
                )}
              />
            </button>
            {openMenus.clientes && (
              <div className="pl-9 pr-1 pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleSelect("clientes-todos")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "clientes-todos"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Todos os Clientes</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("clientes-novo")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "clientes-novo"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Novo Cliente</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("clientes-alterar")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "clientes-alterar"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <Edit className="h-3.5 w-3.5" />
                  <span>Alterar Cliente</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("clientes-excluir")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "clientes-excluir"
                      ? "text-rose-400 bg-rose-950/40 font-bold"
                      : "text-slate-400 hover:text-rose-300 hover:bg-rose-950/20"
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>Excluir Cliente</span>
                </button>
              </div>
            )}
          </div>

          {/* 5. VETERINÁRIA (Prontuário Digital & Saúde) */}
          <div>
            <button
              type="button"
              onClick={() => toggleMenu("veterinaria")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeSection.startsWith("vet")
                  ? "bg-[#142922] text-white"
                  : "text-slate-300 hover:bg-[#10221c] hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-emerald-500/80" />
                <span>Veterinária</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                  openMenus.veterinaria && "rotate-180"
                )}
              />
            </button>
            {openMenus.veterinaria && (
              <div className="pl-9 pr-1 pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleSelect("vet-prontuario")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "vet-prontuario"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <Syringe className="h-3.5 w-3.5" />
                  <span>Prontuário Digital & Vacinas</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("vet-saude")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "vet-saude"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Saúde & Retornos</span>
                  {counts.urgentHealth ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-bold ml-auto">
                      {counts.urgentHealth}
                    </span>
                  ) : null}
                </button>
              </div>
            )}
          </div>

          {/* 6. AGENDA (Visual por Profissional & Detalhada) */}
          <div>
            <button
              type="button"
              onClick={() => toggleMenu("agenda")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeSection.startsWith("agenda")
                  ? "bg-[#142922] text-white"
                  : "text-slate-300 hover:bg-[#10221c] hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-emerald-500/80" />
                <span>Agenda</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                  openMenus.agenda && "rotate-180"
                )}
              />
            </button>
            {openMenus.agenda && (
              <div className="pl-9 pr-1 pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleSelect("agenda-visual")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "agenda-visual"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Agenda por Profissional</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("agenda-detalhada")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "agenda-detalhada"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Agendamentos Detalhados</span>
                  {counts.pendingAppts ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold ml-auto">
                      {counts.pendingAppts}
                    </span>
                  ) : null}
                </button>
              </div>
            )}
          </div>

          {/* 7. TÁXI PET (LOGÍSTICA & ROTA NO MAPA) */}
          <button
            type="button"
            onClick={() => handleSelect("taxi-pet")}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              activeSection === "taxi-pet"
                ? "bg-[#142922] text-white font-extrabold shadow-sm border border-emerald-500/30"
                : "text-slate-300 hover:bg-[#10221c] hover:text-white"
            )}
          >
            {activeSection === "taxi-pet" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
            )}
            <Truck className="h-4 w-4 text-emerald-500/80" />
            <span className="flex-1 text-left">Táxi Pet (Mapa & GPS)</span>
          </button>

          {/* 8. CRONOANÁLISE & EFICIÊNCIA */}
          <button
            type="button"
            onClick={() => handleSelect("cronoanalise")}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              activeSection === "cronoanalise"
                ? "bg-[#142922] text-white font-extrabold shadow-sm border border-emerald-500/30"
                : "text-slate-300 hover:bg-[#10221c] hover:text-white"
            )}
          >
            {activeSection === "cronoanalise" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
            )}
            <Timer className="h-4 w-4 text-emerald-500/80" />
            <span className="flex-1 text-left">Cronoanálise & Eficiência</span>
          </button>

          {/* 9. FINANCEIRO */}
          <button
            type="button"
            onClick={() => handleSelect("financeiro-geral")}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all relative",
              activeSection === "financeiro-geral"
                ? "bg-[#142922] text-white font-extrabold shadow-sm border border-emerald-500/30"
                : "text-slate-300 hover:bg-[#10221c] hover:text-white"
            )}
          >
            {activeSection === "financeiro-geral" && (
              <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-400 rounded-r-full" />
            )}
            <DollarSign className="h-4 w-4 text-emerald-500/80" />
            <span className="flex-1 text-left">Financeiro Geral</span>
          </button>

          {/* 10. RELATÓRIOS (Curva ABC, Entregas, Atendimentos) */}
          <div>
            <button
              type="button"
              onClick={() => toggleMenu("relatorios")}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all",
                activeSection.startsWith("relatorios")
                  ? "bg-[#142922] text-white"
                  : "text-slate-300 hover:bg-[#10221c] hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-emerald-500/80" />
                <span>Relatórios</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
                  openMenus.relatorios && "rotate-180"
                )}
              />
            </button>
            {openMenus.relatorios && (
              <div className="pl-9 pr-1 pt-1 space-y-1">
                <button
                  type="button"
                  onClick={() => handleSelect("relatorios-curva-abc")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "relatorios-curva-abc"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Visão Executiva & Curva ABC</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("relatorios-entregas")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "relatorios-entregas"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Entregas & Motoristas</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect("relatorios-atendimentos")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2",
                    activeSection === "relatorios-atendimentos"
                      ? "text-emerald-400 bg-emerald-950/60 font-bold"
                      : "text-slate-400 hover:text-white hover:bg-emerald-950/30"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Atendimento por Período</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Rodapé da Sidebar */}
        <div className="p-3 border-t border-emerald-950/60 text-center">
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-900/40 p-2.5 text-[11px] text-emerald-400 flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold">Vetty Core Ativo</span>
          </div>
        </div>
      </aside>
    </>
  );
}
