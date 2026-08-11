import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarPlus, Home, ShoppingBag, ShoppingCart, User } from "lucide-react";
import logo from "@/assets/petcura-logo.png";
import { useCart } from "@/lib/cart";
import { CLINIC } from "@/lib/format";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Início", icon: Home },
  { to: "/loja", label: "Loja", icon: ShoppingBag },
  { to: "/agendar", label: "Agendar", icon: CalendarPlus },
  { to: "/carrinho", label: "Carrinho", icon: ShoppingCart },
  { to: "/conta", label: "Conta", icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { count } = useCart();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-soft">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img
              src={logo}
              alt="Logo PetCura: cão e gato em azul com moldura dourada"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0"
            />
            <span className="min-w-0">
              <span className="block truncate font-display text-lg leading-tight text-primary">
                {CLINIC.name}
              </span>
              <span className="block truncate text-[11px] uppercase tracking-widest text-muted-foreground">
                Consultório Veterinário
              </span>
            </span>
          </Link>
          <a
            href={`https://instagram.com/${CLINIC.instagram.replace("@", "")}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
          >
            {CLINIC.instagram}
          </a>
        </div>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav className="fixed bottom-0 z-30 w-full max-w-md border-t border-border/60 bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-5">
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
