import { useEffect, useState, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarPlus,
  CheckCircle2,
  Home,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import logo from "@/assets/bigdog-logo.png";
import { useCart } from "@/lib/cart";
import { useAuth, useIsAdmin, useIsDriver } from "@/hooks/useAuth";
import { CLINIC, whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusAlertNotifier } from "@/components/StatusAlertNotifier";
import { testSoundAlert, playChatNotificationSound } from "@/lib/soundAlerts";
import { InAppChatDrawer, openInAppChat } from "@/components/InAppChatDrawer";
import { useInAppChat, getAppRole, setAppRole, type SimulationRole } from "@/lib/inAppChat";
import { Button } from "@/components/ui/button";
import { MiroModal, openMiroModal } from "@/components/MiroModal";

const baseTabs = [
  { to: "/", label: "Início", icon: Home },
  { to: "/loja", label: "Loja", icon: ShoppingBag },
  { to: "/agendar", label: "Agendar", icon: CalendarPlus },
  { to: "/carrinho", label: "Carrinho", icon: ShoppingCart },
  { to: "/conta", label: "Conta", icon: User },
];

const adminTab = { to: "/admin", label: "Admin", icon: ShieldCheck };
const driverTab = { to: "/motorista", label: "Motorista", icon: Truck };

// Tailwind's JIT purges unused classes, so the grid-cols class must be one of
// these literal strings — never an interpolated `grid-cols-${n}` template.
function gridColsClass(count: number): string {
  if (count >= 7) return "grid-cols-7";
  if (count === 6) return "grid-cols-6";
  if (count === 4) return "grid-cols-4";
  if (count === 3) return "grid-cols-3";
  return "grid-cols-5";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id, user?.email);
  const isDriver = useIsDriver(user?.id, user?.email);

  const [isPreviewClient, setIsPreviewClient] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("bigdog_preview_mode") === "cliente";
  });
  const [activeRole, setActiveRole] = useState<SimulationRole>(() => getAppRole(pathname));

  useEffect(() => {
    const handleRoleUpdate = () => {
      setIsPreviewClient(sessionStorage.getItem("bigdog_preview_mode") === "cliente");
      setActiveRole(getAppRole(pathname));
    };
    window.addEventListener("storage", handleRoleUpdate);
    window.addEventListener("bigdog_preview_change", handleRoleUpdate);
    window.addEventListener("bigdog_role_change", handleRoleUpdate);
    return () => {
      window.removeEventListener("storage", handleRoleUpdate);
      window.removeEventListener("bigdog_preview_change", handleRoleUpdate);
      window.removeEventListener("bigdog_role_change", handleRoleUpdate);
    };
  }, [pathname]);

  useEffect(() => {
    setActiveRole(getAppRole(pathname));
  }, [pathname]);

  const tabs = (isAdmin && !isPreviewClient)
    ? [
        { to: "/admin", label: "Admin", icon: ShieldCheck },
        { to: "/conta", label: "Conta", icon: User },
        { to: "/agendar", label: "Agendar", icon: CalendarPlus },
        { to: "/motorista", label: "Motorista", icon: Truck },
        { to: "/loja", label: "Loja", icon: ShoppingBag },
      ]
    : [...baseTabs, ...(isDriver ? [driverTab] : [])];

  const currentChatRole: "loja" | "tutor" = (activeRole === "loja" || activeRole === "motorista") ? "loja" : "tutor";
  const { hasNewMessage, unreadCount, isChatRed } = useInAppChat({ role: currentChatRole });

  const prevUnreadRef = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      playChatNotificationSound();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("bigdog_sound_muted") === "true";
  });

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem("bigdog_sound_muted", String(next));
    if (!next) {
      testSoundAlert("confirmado");
    }
  };

  return (
    // O app nasceu como PWA de celular (coluna de 448px). Em tablet e desktop a
    // coluna passa a acompanhar a tela, senao telas densas como Relatorios e
    // Dashboard ficam espremidas num quarto do monitor.
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-soft md:max-w-3xl lg:max-w-5xl">
      <StatusAlertNotifier />
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        {/* Barra Superior de Homologação Ágil - Alternância Rápida de Atores */}
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-500/30">
                🧪 Homologação
              </span>
              <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold">
                Alternar Papel:
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              {/* Tutor */}
              <Button
                asChild
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAppRole("tutor");
                }}
                className={cn(
                  "h-6 px-2 text-[11px] font-bold rounded-lg transition-all",
                  activeRole === "tutor"
                    ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Link to="/" search={{ preview: "cliente" }}>
                  🐾 Tutor
                </Link>
              </Button>

              {/* Loja / Admin */}
              <Button
                asChild
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAppRole("loja");
                }}
                className={cn(
                  "h-6 px-2 text-[11px] font-bold rounded-lg transition-all",
                  activeRole === "loja"
                    ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Link to="/admin">
                  🏬 Loja
                </Link>
              </Button>

              {/* Motorista */}
              <Button
                asChild
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAppRole("motorista");
                }}
                className={cn(
                  "h-6 px-2 text-[11px] font-bold rounded-lg transition-all",
                  activeRole === "motorista"
                    ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Link to="/motorista">
                  🚚 Motorista
                </Link>
              </Button>

              {/* Quadro Miro (QA) */}
              <button
                type="button"
                onClick={() => openMiroModal()}
                className="flex items-center gap-1 h-6 px-2 text-[11px] font-bold rounded-lg border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all cursor-pointer"
                title="Abrir Quadro Miro de Testes (TC-01 a TC-18)"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>🎯 Miro (QA)</span>
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img
              src={logo}
              alt="Logo Big Dog Pet: pata de cachorro em círculo azul"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0"
            />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg leading-tight text-primary">
                {CLINIC.name}
              </span>
              <span className="block truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                Banho e Tosa
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              title={
                isMuted
                  ? "Alertas sonoros desativados (clique para ativar)"
                  : "Alertas sonoros ativos (clique para silenciar)"
              }
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                isMuted
                  ? "bg-muted text-muted-foreground/60 hover:bg-muted/80"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300",
              )}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            {/* Bate-papo Interno Offline do App (Substituição do WhatsApp) */}
            <button
              type="button"
              onClick={() => openInAppChat()}
              title={
                unreadCount > 0
                  ? `Chat: ${unreadCount} nova(s) mensagem(ns)`
                  : isChatRed
                  ? "Chat: Atendimento em andamento"
                  : "Abrir Bate-papo Big Dog"
              }
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
                isChatRed
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/50 animate-pulse hover:bg-rose-700"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5 fill-current" />
              <span>Chat</span>
              {unreadCount > 0 ? (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-black text-rose-700 shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              ) : isChatRed ? (
                <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <InAppChatDrawer />
      <MiroModal />

      <main className={cn("flex-1", (!isPreviewClient && (pathname === "/admin" || pathname.startsWith("/admin") || pathname === "/motorista")) ? "pb-6" : "pb-24")}>{children}</main>

      {/* Barra de navegação inferior exclusiva do fluxo do cliente/tutor - oculta no painel admin para ganho de área útil */}
      {(isPreviewClient || !(pathname === "/admin" || pathname.startsWith("/admin") || pathname === "/motorista")) && (
        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border/60 bg-card/95 backdrop-blur md:max-w-3xl lg:max-w-5xl">
          <ul className={cn("grid", gridColsClass(tabs.length))}>
            {tabs.map((tab) => {
              const active = pathname === tab.to;
              return (
                <li key={tab.to}>
                  <Link
                    to={tab.to}
                    className={cn(
                      "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <tab.icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                    {tab.label}
                    {tab.to === "/carrinho" && count > 0 && (
                      <span className="absolute right-3 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                        {count}
                      </span>
                    )}
                    {active && (
                      <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gold" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
