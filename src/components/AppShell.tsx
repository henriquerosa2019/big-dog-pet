import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarPlus,
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
import { testSoundAlert } from "@/lib/soundAlerts";
import { InAppChatDrawer, openInAppChat } from "@/components/InAppChatDrawer";
import { useInAppChat } from "@/lib/inAppChat";

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
  const isDriver = useIsDriver(user?.id);
  const tabs = isAdmin
    ? [
        { to: "/", label: "Início", icon: Home },
        { to: "/loja", label: "Loja", icon: ShoppingBag },
        { to: "/admin", label: "Painel Loja", icon: ShieldCheck },
        ...(isDriver ? [driverTab] : []),
      ]
    : [...baseTabs, ...(isDriver ? [driverTab] : [])];
  const { hasNewMessage } = useInAppChat({ role: isAdmin ? "loja" : "tutor" });

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
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                hasNewMessage
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Chat</span>
              {hasNewMessage && (
                <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white animate-pulse">
                  (Msg Nova)
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <InAppChatDrawer />

      <main className={cn("flex-1", (pathname === "/admin" || pathname.startsWith("/admin")) ? "pb-6" : "pb-24")}>{children}</main>

      {/* Barra de navegação inferior exclusiva do fluxo do cliente/tutor - oculta no painel admin para ganho de área útil */}
      {!(pathname === "/admin" || pathname.startsWith("/admin")) && (
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
