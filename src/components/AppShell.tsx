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
} from "lucide-react";
import logo from "@/assets/bigdog-logo.png";
import { useCart } from "@/lib/cart";
import { useAuth, useIsAdmin, useIsDriver } from "@/hooks/useAuth";
import { CLINIC, whatsappLink } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  return "grid-cols-5";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const isDriver = useIsDriver(user?.id);
  const tabs = [...baseTabs, ...(isAdmin ? [adminTab] : []), ...(isDriver ? [driverTab] : [])];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-soft">
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
          <a
            href={whatsappLink("Olá! Vim pelo app da Big Dog Pet.")}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed bottom-0 z-30 w-full max-w-md border-t border-border/60 bg-card/95 backdrop-blur">
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
    </div>
  );
}
