import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bird,
  Building2,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  ExternalLink,
  FileText,
  Heart,
  Instagram,
  Laptop,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  PackageOpen,
  PawPrint,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Stethoscope,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import heroBird from "@/assets/hero-bird.jpg";
import heroCat from "@/assets/hero-cat.jpg";
import heroDog from "@/assets/hero-dog.jpg";
import logoImg from "@/assets/bigdog-logo.png";
import logoWhiteImg from "@/assets/vetty-logo-white.png";
import vettyPawSymbol from "@/assets/vetty-paw-symbol.png";
import serviceBanhoTosa from "@/assets/service-banho-tosa.jpg";
import serviceVeterinaria from "@/assets/service-veterinaria.jpg";
import serviceTaxiPet from "@/assets/service-taxi-pet.jpg";
import serviceLojaPet from "@/assets/service-loja-pet.jpg";
import bannerTeste7Dias from "@/assets/banner-teste-7dias.png";
import petDogManagement from "@/assets/pet-dog-management.jpg";
import petCatManagement from "@/assets/pet-cat-management.jpg";
import petBunnyManagement from "@/assets/pet-bunny-management.jpg";
import petGuineaManagement from "@/assets/pet-guinea-management.jpg";
import animalIconsStrip from "@/assets/animal-icons-strip.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { AuthModal } from "@/components/AuthModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { TrialBanner } from "@/components/TrialBanner";
import { PainelMaster } from "@/components/PainelMaster";
import { getMercadoPagoPlans, type SubscriptionPlanConfig } from "@/lib/mercadoPagoConfig";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { preview?: string } => ({
    ...(typeof search["preview"] === "string" ? { preview: search["preview"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Vetty - Sistema Inteligente Pet | Banho, tosa e gestão de serviços" },
      {
        name: "description",
        content:
          "Vetty - Sistema Inteligente Pet: banho e tosa, Táxi Pet, produtos e planos de cuidado para cães, gatos e aves.",
      },
      { property: "og:title", content: "Vetty - Sistema Inteligente Pet" },
      {
        property: "og:description",
        content: "Cuidado completo, do banho aos mimos, com atendimento de excelência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const heroSlides = [
  { image: heroDog, label: "Cuidado para cães", alt: "Cão após banho e cuidados no pet shop" },
  { image: heroCat, label: "Carinho para gatos", alt: "Gato recebendo cuidados com delicadeza" },
  { image: heroBird, label: "Atenção para aves", alt: "Calopsita saudável em ambiente de pet shop" },
];

const services = [
  {
    icon: Scissors,
    title: "Banho & Tosa",
    tag: "Agenda & Estética",
    description:
      "Gestão de agenda visual com encaixes inteligentes, controle por tosador, tempos de atendimento e confirmação automática no WhatsApp.",
    action: "Ver Módulo de Banho",
    subtext: "Banho e tosa",
    to: "/agendar",
    image: serviceBanhoTosa,
    iconStyle: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/25",
  },
  {
    icon: Stethoscope,
    title: "Veterinária",
    tag: "Clínica & Prontuário",
    description:
      "Prontuário eletrônico completo, receituário digital timbrado, histórico vacinal integrado e alertas automáticos de retorno para tutores.",
    action: "Ver Módulo Clínico",
    subtext: "Consultas, vacinas, prontuários",
    to: "/agendar",
    image: serviceVeterinaria,
    iconStyle: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/25",
  },
  {
    icon: CarFront,
    title: "Táxi Pet",
    tag: "Logística & GPS",
    description:
      "Painel exclusivo para motoristas com roteirização inteligente, cálculo automático por km/bairro e link de rastreamento do pet em tempo real.",
    action: "Ver Módulo Táxi Pet",
    subtext: (
      <>
        Acompanhe o trajeto <br /> do pet em tempo real
      </>
    ),
    to: "/agendar",
    search: { tipo: "buscar_e_devolver" },
    image: serviceTaxiPet,
    iconStyle: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/25",
  },
  {
    icon: ShoppingBag,
    title: "Loja Pet & PDV",
    tag: "Estoque & Curva ABC",
    description:
      "Frente de caixa ágil, controle de estoque com alerta de reposição, relatório de Curva ABC e vendas integradas aos serviços e banhos.",
    action: "Ver Módulo de Gestão",
    subtext: "Rações e mimos",
    to: "/admin",
    image: serviceLojaPet,
    iconStyle: "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border-indigo-500/25",
  },
];

function Index() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const isAdmin = useIsAdmin(user?.id, user?.email);
  const trialStatus = useTrialStatus();
  const navigate = useNavigate();

  // Modais
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signup" | "login">("signup");
  const [authModalService, setAuthModalService] = useState<string | undefined>(undefined);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [painelMasterOpen, setPainelMasterOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<{ to: string; search?: any } | null>(null);

  // Planos dinâmicos do Mercado Pago e seleção ativa
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(() => getMercadoPagoPlans());
  const [selectedPlanId, setSelectedPlanId] = useState<string>("pro");

  useEffect(() => {
    const handlePlansUpdate = () => {
      setPlans(getMercadoPagoPlans());
    };
    window.addEventListener("bigdog_plans_updated", handlePlansUpdate);
    return () => window.removeEventListener("bigdog_plans_updated", handlePlansUpdate);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 7500);
    return () => window.clearInterval(timer);
  }, []);

  // Interceptor de cliques em serviços
  const handleServiceNavigation = (to: string, search?: any, serviceName?: string) => {
    if (!user) {
      setAuthModalTab("signup");
      setAuthModalService(serviceName || "Agendamento de Serviços");
      setPendingPath({ to, search });
      setAuthModalOpen(true);
      return;
    }

    if (trialStatus.isBlocked) {
      toast.error("O acesso da sua loja está suspenso. Regularize seu plano via Mercado Pago.");
      setSubscriptionModalOpen(true);
      return;
    }

    // Apenas o Administrador/Dono do Petshop em teste expirado recebe o paywall
    if (isAdmin && trialStatus.isExpired && !trialStatus.isSubscriber && user?.email?.toLowerCase() !== "bigdog@gmail.com") {
      setSubscriptionModalOpen(true);
      return;
    }

    navigate({ to, search });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 md:pb-0">
      {/* Régua de Degustação / Alerta de Vencimento / Bloqueio no Topo */}
      <TrialBanner onOpenPlans={() => setSubscriptionModalOpen(true)} />

      {/* Cabeçalho Oficial do Novo Design */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="site-container flex h-24 items-center justify-between">
          <a href="#inicio" className="flex items-center" aria-label="Vetty - Sistema Inteligente Pet - início">
            <img src={logoImg} alt="Vetty - Sistema Inteligente Pet" className="h-16 sm:h-20 w-auto object-contain transition-transform duration-200 hover:scale-105 drop-shadow-xs" />
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
            <a className="nav-link" href="#inicio">Início</a>
            <a className="nav-link" href="#recursos">Recursos</a>
            <a className="nav-link" href="#portal-do-tutor">Portal do Tutor</a>
            <a className="nav-link" href="#planos">Planos</a>
            <a className="nav-link" href="#contato">Contato</a>
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            {/* Botão WhatsApp em Verde Oficial */}
            <Button
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold border-0 shadow-sm transition-all"
              asChild
            >
              <a href="https://wa.me/5511993793746" target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>

            {/* Botão Entrar (Login) */}
            {!user ? (
              <Button
                variant="outline"
                onClick={() => {
                  setAuthModalTab("login");
                  setAuthModalService("Acesso ao Sistema");
                  setAuthModalOpen(true);
                }}
                className="font-bold cursor-pointer border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <LogIn className="size-4" /> Entrar
              </Button>
            ) : null}

            {/* Botão Testar Grátis / Demonstração */}
            <Button
              onClick={() => {
                if (!user) {
                  setAuthModalTab("signup");
                  setAuthModalService("Teste 7 Dias Grátis");
                  setAuthModalOpen(true);
                } else {
                  navigate({ to: "/painel" });
                }
              }}
              className="font-bold cursor-pointer bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md"
            >
              <Zap className="size-4" /> {user ? "Meu Painel" : "Testar Grátis"}
            </Button>

            {/* Acesso Rápido ao Painel Master (Exclusivo Administrador) */}
            {(isAdmin || user?.email?.toLowerCase() === "bigdog@gmail.com") && (
              <Button
                size="sm"
                onClick={() => setPainelMasterOpen(true)}
                className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/40 text-xs font-black cursor-pointer shadow-xs gap-1.5"
                title="Abrir Centro de Comando Master"
              >
                👑 Painel Master
              </Button>
            )}

            {/* Ícone Minha Conta com Dropdown de Login / Teste Grátis / Gestão */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Minha Conta"
                  className="relative cursor-pointer hover:bg-muted"
                >
                  <User className="size-5" />
                  {user && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-1.5 shadow-xl bg-card border-border">
                {user ? (
                  <>
                    <DropdownMenuLabel className="font-normal pb-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold leading-none text-foreground">
                          {user.user_metadata?.full_name || "Cliente Big Dog"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                        <div className="pt-1.5">
                          <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {trialStatus.planName}
                          </span>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/conta" className="flex items-center gap-2">
                        <User className="size-4 text-primary" />
                        <span>Meu Perfil & Pets</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/painel" className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-primary" />
                        <span>Meus Agendamentos</span>
                      </Link>
                    </DropdownMenuItem>
                    {(isAdmin || user.email?.toLowerCase() === "bigdog@gmail.com") && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setPainelMasterOpen(true)}
                          className="cursor-pointer font-bold text-amber-500 focus:text-amber-500"
                        >
                          <span className="mr-2">👑</span> Painel Master
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link to="/admin" className="flex items-center gap-2">
                            <ShieldCheck className="size-4 text-amber-500" />
                            <span>Admin Operacional</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        signOut();
                        toast.info("Você saiu da sua conta.");
                      }}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4 mr-2" />
                      <span>Sair da Conta</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuLabel className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      Acesso Big Dog Pet
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        setAuthModalTab("login");
                        setAuthModalService(undefined);
                        setAuthModalOpen(true);
                      }}
                      className="cursor-pointer font-bold py-2"
                    >
                      <LogIn className="size-4 mr-2 text-primary" />
                      <span>Já sou Cliente (Entrar)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAuthModalTab("signup");
                        setAuthModalService("Teste 7 Dias Grátis");
                        setAuthModalOpen(true);
                      }}
                      className="cursor-pointer font-extrabold py-2 text-primary focus:text-primary bg-primary/5 rounded-md"
                    >
                      <Sparkles className="size-4 mr-2 text-primary" />
                      <span>Cadastre-se (7 Dias Grátis)</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu className="size-6" />
          </Button>
        </div>

        {menuOpen && (
          <nav className="border-t border-border bg-background px-5 py-4 md:hidden" aria-label="Menu celular">
            <div className="mx-auto grid max-w-md gap-1">
              {[
                ["Início", "#inicio"],
                ["Recursos", "#recursos"],
                ["Portal do Tutor", "#portal-do-tutor"],
                ["Planos", "#planos"],
                ["Contato", "#contato"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  className="rounded-md px-4 py-3 font-semibold hover:bg-muted"
                  href={href}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                className="text-left rounded-md px-4 py-3 font-semibold text-emerald-600 hover:bg-muted cursor-pointer flex items-center gap-2"
                onClick={() => {
                  setMenuOpen(false);
                  handleServiceNavigation("/agendar", undefined, "Demonstração do Portal");
                }}
              >
                <span>📱 Ver Portal do Tutor (Demo)</span>
              </button>
              {user ? (
                <Link
                  to="/conta"
                  className="rounded-md px-4 py-3 font-semibold hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  👤 Minha Conta ({user.email})
                </Link>
              ) : (
                <button
                  type="button"
                  className="text-left rounded-md px-4 py-3 font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl hover:opacity-90 cursor-pointer shadow-md my-1"
                  onClick={() => {
                    setMenuOpen(false);
                    setAuthModalTab("signup");
                    setAuthModalService("Teste 7 Dias Grátis");
                    setAuthModalOpen(true);
                  }}
                >
                  ✨ Testar 7 Dias Grátis
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* Banner Hero com Carrossel de Cão, Gato e Calopsita */}
        <section id="inicio" className="relative min-h-[580px] overflow-hidden md:min-h-[640px]">
          {heroSlides.map((slide, index) => (
            <img
              key={slide.label}
              src={slide.image}
              alt={slide.alt}
              width={1920}
              height={1080}
              className={`absolute inset-0 size-full object-cover object-[62%_center] transition-all duration-[2500ms] ease-in-out md:object-center ${
                index === activeSlide
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-105 pointer-events-none"
              }`}
              aria-hidden={index !== activeSlide}
            />
          ))}
          <div className="absolute inset-0 bg-hero-overlay" />
          <div className="site-container relative flex min-h-[580px] items-end pb-28 pt-20 md:min-h-[640px] md:items-center md:pb-24 md:pt-16">
            <div className="max-w-[760px] text-hero-foreground">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold tracking-wide mb-4 backdrop-blur-sm">
                <Sparkles className="size-3.5 text-emerald-300" /> Sistema SaaS nº 1 para Petshops e Clínicas
              </div>

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight">
                O sistema de gestão definitivo para o seu Petshop e Clínica Veterinária
              </h1>

              <div className="mt-6 flex flex-wrap items-center gap-3.5">
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => {
                    setAuthModalTab("signup");
                    setAuthModalService("Teste 7 Dias Grátis");
                    setAuthModalOpen(true);
                  }}
                  className="cursor-pointer bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-black shadow-xl ring-2 ring-emerald-400/30"
                >
                  <Zap className="size-5" /> Testar 7 Dias Grátis
                </Button>
              </div>
            </div>
            {/* Indicadores do carrossel */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 z-10" role="tablist">
              {heroSlides.map((slide, index) => (
                <button
                  key={slide.label}
                  className={`h-2 rounded-full transition-all ${
                    index === activeSlide ? "w-9 bg-highlight" : "w-2 bg-hero-foreground/50"
                  }`}
                  aria-label={`Mostrar ${slide.label.toLowerCase()}`}
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Árvore de Processos / Ações Rápidas: Gestão Inteligente ligando aos 4 Serviços */}
        <section id="gestao-inteligente" className="quick-actions relative" aria-label="Gestão Inteligente de Serviços">
          <div className="site-container relative">
            {/* Diagrama de Fluxograma / Caixa de Processos conectando Gestão Inteligente aos 4 serviços */}
            <div className="flex flex-col items-center mb-2">
              {/* Caixa Central de Processos "Gestão Inteligente" com fundo verde */}
              <div className="relative z-30 inline-flex items-center gap-2.5 rounded-2xl border-2 border-white/90 bg-emerald-600 px-6 py-2.5 text-white shadow-2xl backdrop-blur-xl ring-4 ring-emerald-500/20 hover:bg-emerald-500 transition-all">
                <span className="grid size-7 place-items-center rounded-xl bg-white/20 text-white shadow-xs">
                  <Sparkles className="size-4 text-white" />
                </span>
                <span className="font-display text-sm sm:text-base font-extrabold uppercase tracking-wider text-white">
                  Gestão Inteligente
                </span>
              </div>

              {/* Linhas brancas de conexão do fluxograma (visíveis no desktop lg com 4 colunas) */}
              <div className="hidden lg:block w-full relative h-12" aria-hidden="true">
                {/* Linha vertical central descendo da caixa Gestão Inteligente */}
                <div className="absolute left-1/2 top-0 h-6 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
                
                {/* Barra horizontal distribuidora conectando do centro do primeiro card ao quarto card */}
                {/* Os cards estão em 12.5%, 37.5%, 62.5% e 87.5% da largura */}
                <div className="absolute top-6 left-[12.5%] right-[12.5%] h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />

                {/* 4 Linhas verticais descendo para cada uma das caixas com terminais elegantes */}
                <div className="absolute top-6 left-[12.5%] h-6 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]">
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 size-2 rounded-full bg-white ring-2 ring-primary" />
                </div>
                <div className="absolute top-6 left-[37.5%] h-6 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]">
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 size-2 rounded-full bg-white ring-2 ring-primary" />
                </div>
                <div className="absolute top-6 left-[62.5%] h-6 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]">
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 size-2 rounded-full bg-white ring-2 ring-primary" />
                </div>
                <div className="absolute top-6 left-[87.5%] h-6 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]">
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 size-2 rounded-full bg-white ring-2 ring-primary" />
                </div>
              </div>

              {/* Conector simplificado para mobile / tablet */}
              <div className="lg:hidden flex flex-col items-center h-6" aria-hidden="true">
                <div className="h-6 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              </div>
            </div>

            {/* As 4 Caixas de Processos dos Serviços */}
            <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(({ icon: Icon, title, subtext, to, search, iconStyle }) => (
              <button
                key={title}
                type="button"
                onClick={() => handleServiceNavigation(to, search, title)}
                className="quick-action group cursor-pointer text-left w-full"
              >
                <span
                  className={`quick-icon border ${iconStyle} shadow-xs group-hover:scale-110`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block font-sans font-extrabold text-[15px] sm:text-base bg-gradient-to-r from-emerald-800 via-emerald-600 to-green-500 dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-200 bg-clip-text text-transparent tracking-tight leading-snug group-hover:brightness-110 transition-all">
                    {title}
                  </strong>
                  <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                    {subtext}
                  </span>
                </span>
                <ChevronRight className="size-4 text-slate-400 dark:text-slate-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary" />
              </button>
            ))}
            </div>
          </div>
        </section>

        {/* Módulos do Sistema Vetty em Destaque */}
        <section id="recursos" className="section-space">
          <div className="site-container">
            {/* Texto informativo posicionado acima da Prova Social B2B */}
            <p className="mb-3 text-base sm:text-lg md:text-xl font-medium text-muted-foreground leading-relaxed">
              Simplifique agendamentos, automatize o Táxi Pet e controle seu financeiro em uma única plataforma intuitiva.
            </p>

            {/* Prova Social B2B posicionada 2 linhas acima de Recursos & Funcionalidades */}
            <div className="mb-6 flex items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm font-semibold text-muted-foreground">
              <span className="flex -space-x-2" aria-hidden="true">
                <span className="grid size-8 place-items-center rounded-full border-2 border-background bg-primary shadow-xs">
                  <Building2 className="size-3.5 text-white" />
                </span>
                <span className="grid size-8 place-items-center rounded-full border-2 border-background bg-emerald-600 shadow-xs">
                  <BarChart3 className="size-3.5 text-white" />
                </span>
                <span className="grid size-8 place-items-center rounded-full border-2 border-background bg-amber-500 shadow-xs">
                  <ShieldCheck className="size-3.5 text-slate-950" />
                </span>
              </span>
              <span className="font-bold text-foreground/90">
                Mais de 150 petshops e clínicas parceiras · R$ 500k+ movimentados
              </span>
            </div>

            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Sparkles className="size-4" /> Recursos & Funcionalidades
                </span>
                <h2 className="bg-gradient-to-r from-emerald-800 via-emerald-600 to-green-400 dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-200 bg-clip-text text-transparent inline-block">
                  Tudo o que seu negócio precisa em um só sistema.
                </h2>
              </div>
              <p>
                Elimine planilhas, reduza faltas com lembretes automáticos e ofereça uma experiência de alto nível para os tutores da sua região.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {services.map(({ icon: Icon, title, tag, description, action, to, search, image }, index) => (
                <article
                  key={title}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-primary/40"
                >
                  {/* Foto Ilustrativa de Alta Resolução do Serviço */}
                  <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-muted">
                    <img
                      src={image}
                      alt={title}
                      className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                    {/* Tag de Categoria com Glassmorphism */}
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold tracking-wide text-slate-900 shadow-sm backdrop-blur-md">
                      <Icon className="size-3.5 text-primary" /> {tag}
                    </span>

                    {/* Número Identificador */}
                    <span className="absolute bottom-3 right-3 font-display text-2xl font-black text-white/90 drop-shadow-md">
                      0{index + 1}
                    </span>
                  </div>

                  {/* Detalhes e Ação com Tipografia Elegante em Degradê de 3 Tons de Verde */}
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <h3 className="font-display text-xl font-extrabold bg-gradient-to-r from-emerald-800 via-emerald-600 to-green-400 dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-200 bg-clip-text text-transparent inline-block transition-all duration-300 group-hover:brightness-110">
                        {title}
                      </h3>
                      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleServiceNavigation(to, search, title)}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-xs sm:text-sm font-bold text-primary transition-all duration-200 hover:bg-primary hover:text-white active:scale-[0.98] cursor-pointer"
                    >
                      {action} <ArrowRight className="size-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {/* Destaque B2B: Portal do Tutor com White-Label & Autoatendimento 24h */}
            <div id="portal-do-tutor" className="mt-14 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/10 via-background to-teal-900/10 p-6 sm:p-8 md:p-10 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
              <div className="grid gap-8 lg:grid-cols-12 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    <Smartphone className="size-3.5" /> Funcionalidade White-Label Inclusa
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground leading-snug">
                    Ofereça um portal de agendamentos 24h com a <span className="bg-gradient-to-r from-emerald-600 to-green-500 bg-clip-text text-transparent">sua própria marca</span>
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Reduza drasticamente o tempo gasto no WhatsApp da recepção. Seus clientes agendam banho, tosa, consultas e táxi pet direto pelo celular, escolhem serviços adicionais e recebem lembretes sem intervenção manual.
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm">
                    <li className="flex items-center gap-2 text-foreground font-medium">
                      <Check className="size-4 text-emerald-600 shrink-0" />
                      <span>Agendamento autônomo 24/7 pelo tutor</span>
                    </li>
                    <li className="flex items-center gap-2 text-foreground font-medium">
                      <Check className="size-4 text-emerald-600 shrink-0" />
                      <span>Confirmação e lembretes automáticos</span>
                    </li>
                    <li className="flex items-center gap-2 text-foreground font-medium">
                      <Check className="size-4 text-emerald-600 shrink-0" />
                      <span>Histórico de vacinas e fotos do pet</span>
                    </li>
                    <li className="flex items-center gap-2 text-foreground font-medium">
                      <Check className="size-4 text-emerald-600 shrink-0" />
                      <span>Rastreamento do Táxi Pet em tempo real</span>
                    </li>
                  </ul>
                  <div className="pt-4 flex flex-wrap gap-3">
                    <Button
                      onClick={() => handleServiceNavigation("/agendar", undefined, "Demonstração Portal do Tutor")}
                      className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    >
                      <Smartphone className="size-4 mr-1.5" /> Ver Demonstração do Portal
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setAuthModalTab("signup");
                        setAuthModalService("Teste 7 Dias Grátis");
                        setAuthModalOpen(true);
                      }}
                      className="cursor-pointer font-bold border-emerald-500/40"
                    >
                      Testar na Minha Loja
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-card/80 border border-emerald-500/20 rounded-2xl p-5 shadow-lg backdrop-blur-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-emerald-600 grid place-items-center text-white font-black text-xs">
                        VP
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-none">Petshop Modelo</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">vetty.vercel.app/seu-petshop</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      Online 24h
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scissors className="size-4 text-emerald-600" />
                        <div>
                          <p className="font-bold">Banho & Tosa Completo</p>
                          <p className="text-[11px] text-muted-foreground">Thor (Golden Retriever) · 14:30</p>
                        </div>
                      </div>
                      <span className="font-black text-emerald-600 text-xs">Confirmado</span>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CarFront className="size-4 text-amber-600" />
                        <div>
                          <p className="font-bold">Táxi Pet · Leva e Traz</p>
                          <p className="text-[11px] text-muted-foreground">Em rota de busca · GPS Ativo</p>
                        </div>
                      </div>
                      <span className="font-black text-amber-600 text-xs">Em trânsito</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-600/10 border border-emerald-600/20 text-center">
                    <p className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                      ⚡ Redução média de 65% nas mensagens na recepção
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Faixa Institucional de Soluções Vetty com Logo Oficial e Cards de Pets */}
        <section className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 py-14 text-white border-y border-emerald-800/40 shadow-inner">
          <div className="site-container">
            <div className="flex flex-col items-center justify-center mb-12">
              <div className="transition-transform duration-300 hover:scale-105">
                <img
                  src={logoWhiteImg}
                  alt="Vetty - Sistema Inteligente Pet"
                  className="h-24 sm:h-32 md:h-36 w-auto object-contain drop-shadow-xl"
                />
              </div>
              <p className="mt-5 text-xs sm:text-base font-extrabold tracking-widest uppercase text-emerald-300 drop-shadow-sm text-center">
                Padrão de Excelência em Cuidados Pet & Gestão Veterinária
              </p>
              <p className="mt-2 text-sm sm:text-base text-emerald-100/80 max-w-2xl text-center font-medium">
                Tudo o que seu petshop, estética animal e clínica veterinária precisam para crescer com organização, agilidade e carinho em um só lugar.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Cães - Agendamentos & Estética */}
              <div className="group rounded-3xl bg-white/5 backdrop-blur-md border border-emerald-500/20 overflow-hidden transition-all duration-300 hover:border-emerald-400/50 hover:bg-white/10 hover:-translate-y-1.5 shadow-xl flex flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={petDogManagement}
                    alt="Gestão de Banho, Tosa e Agendamentos para Cães"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                  <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-sm text-[11px] font-extrabold text-white uppercase tracking-wider">
                    🐶 Estética & Banho
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Agendamentos 24h & Fila Zero
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">
                      Tutores agendam online a qualquer hora com confirmação automática, controle de profissionais e históricos completos de serviços.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/15 text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                    <span>Rotinas sem filas</span>
                    <span>✓ 100% Automático</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Gatos - Prontuário Clínico & Veterinária */}
              <div className="group rounded-3xl bg-white/5 backdrop-blur-md border border-emerald-500/20 overflow-hidden transition-all duration-300 hover:border-emerald-400/50 hover:bg-white/10 hover:-translate-y-1.5 shadow-xl flex flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={petCatManagement}
                    alt="Prontuário Veterinário e Vacinas para Gatos e Pets"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                  <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-600/90 backdrop-blur-sm text-[11px] font-extrabold text-white uppercase tracking-wider">
                    🐱 Clínica Veterinária
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
                      Prontuário Digital & Vacinas
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">
                      Histórico clínico completo, receitas digitais, controle de exames e lembretes automáticos de retornos e vacinação pelo sistema.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/15 text-[11px] font-bold text-teal-300 flex items-center justify-between">
                    <span>Fichas protegidas</span>
                    <span>✓ Segurança Total</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Coelhos - Logística de Táxi Pet & Rotas */}
              <div className="group rounded-3xl bg-white/5 backdrop-blur-md border border-emerald-500/20 overflow-hidden transition-all duration-300 hover:border-emerald-400/50 hover:bg-white/10 hover:-translate-y-1.5 shadow-xl flex flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={petBunnyManagement}
                    alt="Logística de Táxi Pet e Transporte Seguro"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                  <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-sm text-[11px] font-extrabold text-white uppercase tracking-wider">
                    🐰 Táxi Pet & Logística
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Transporte Pet Inteligente
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">
                      Roteirização de buscas e entregas, painel dedicado para motoristas e monitoramento para comodidade do tutor e da sua equipe.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/15 text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                    <span>Rotas otimizadas</span>
                    <span>✓ Leva e Traz</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Pequenos Pets - Vendas, Estoque & Canal Próprio */}
              <div className="group rounded-3xl bg-white/5 backdrop-blur-md border border-emerald-500/20 overflow-hidden transition-all duration-300 hover:border-emerald-400/50 hover:bg-white/10 hover:-translate-y-1.5 shadow-xl flex flex-col">
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={petGuineaManagement}
                    alt="Controle de Estoque, Loja e Relatórios Financeiros"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                  <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-600/90 backdrop-blur-sm text-[11px] font-extrabold text-white uppercase tracking-wider">
                    🐹 Loja & Financeiro
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-teal-300 transition-colors">
                      Estoque & Canal Próprio
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-100/75">
                      Controle de produtos, relatórios Curva ABC de rentabilidade e Canal Próprio de atendimento exclusivo no app sem depender de terceiros.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/15 text-[11px] font-bold text-teal-300 flex items-center justify-between">
                    <span>Curva ABC</span>
                    <span>✓ Lucro Real</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Planos Oficiais de Aluguel de Software PetShop & Clínica com Paleta de Verde */}
        <section id="planos" className="section-space bg-gradient-to-b from-emerald-50/40 via-background to-emerald-50/20 dark:from-emerald-950/20 dark:via-background dark:to-transparent">
          <div className="site-container">
            <div className="section-heading items-center">
              <div>
                <span className="eyebrow text-emerald-700 dark:text-emerald-400 font-bold">
                  <PackageOpen className="size-4" /> Aluguel de Sistema PetShop & Clínica
                </span>
                <h2 className="bg-gradient-to-r from-emerald-900 via-emerald-700 to-green-600 dark:from-emerald-200 dark:via-emerald-400 dark:to-teal-200 bg-clip-text text-transparent font-bold">
                  O software mais completo para o seu Petshop.
                </h2>
              </div>
              <div className="flex justify-start md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalTab("signup");
                    setAuthModalService("Teste 7 Dias Grátis");
                    setAuthModalOpen(true);
                  }}
                  className="group cursor-pointer transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] drop-shadow-md text-left"
                  title="Clique para iniciar seu teste grátis de 7 dias"
                >
                  <img
                    src={bannerTeste7Dias}
                    alt="Teste o Plano Master Vip com todas as funcionalidades e veja porque a Vetty é referência em Gestão de Pets no Brasil."
                    className="h-24 sm:h-28 md:h-32 w-auto object-contain rounded-2xl"
                  />
                </button>
              </div>
            </div>

            {/* Navegador Interativo dos 3 Planos */}
            <div className="mt-8 flex flex-wrap justify-center gap-2 p-1.5 bg-card/90 backdrop-blur border border-emerald-200/80 dark:border-emerald-800/80 rounded-2xl max-w-2xl mx-auto shadow-md">
              {plans.map((p) => {
                const isSelected = selectedPlanId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`flex-1 min-w-[145px] py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                      isSelected
                        ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg ring-2 ring-emerald-500/30 scale-[1.02]"
                        : "text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-black ${isSelected ? "bg-white/20 text-white" : "bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300"}`}>
                      {p.formattedPrice}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-3">
              {plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <article
                    className={`plan-card flex flex-col justify-between cursor-pointer transition-all duration-300 relative rounded-3xl ${
                      isSelected
                        ? "plan-card-featured border-2 border-emerald-600 ring-4 ring-emerald-500/20 shadow-2xl scale-[1.02] bg-gradient-to-b from-white via-white to-emerald-50/30 dark:from-card dark:via-card dark:to-emerald-950/20"
                        : "border-emerald-200/70 dark:border-emerald-900/60 hover:border-emerald-500/50 hover:shadow-xl opacity-90 hover:opacity-100 bg-card"
                    }`}
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div>
                      {plan.popular ? (
                        <span className="popular-badge bg-emerald-600 text-white shadow-sm opacity-95 flex items-center gap-1 font-bold">
                          <Star className="size-3 fill-current" /> Mais escolhido
                        </span>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <h3 className="mt-2 font-display text-2xl font-bold bg-gradient-to-r from-emerald-900 via-emerald-800 to-green-700 dark:from-emerald-200 dark:via-emerald-300 dark:to-teal-200 bg-clip-text text-transparent">
                          {plan.name}
                        </h3>
                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-md ${isSelected ? "bg-emerald-600 text-white shadow-xs" : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"}`}>
                          {plan.badge}
                        </span>
                      </div>
                      <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{plan.detail}</p>
                      <div className="my-7 border-y border-emerald-100 dark:border-emerald-900/40 py-4 flex items-baseline justify-between">
                        <div>
                          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800/70 dark:text-emerald-400/80">
                            Mensalidade do Software
                          </span>
                          <strong className="mt-1 block font-display text-3xl font-black bg-gradient-to-r from-emerald-700 via-emerald-600 to-green-600 dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                            {plan.formattedPrice}
                          </strong>
                        </div>
                        <span className="text-xs font-semibold text-emerald-800/80 dark:text-emerald-400">/{plan.period}</span>
                      </div>
                      <ul className="space-y-3.5 flex-1">
                        {plan.features.map((feature, idx) => (
                          <li className="flex gap-3 text-xs sm:text-sm" key={idx}>
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold">
                              <Check className="size-3" />
                            </span>
                            <span className={feature.includes("Curva ABC") || feature.includes("Canal Próprio") ? "font-bold text-emerald-950 dark:text-emerald-200" : "text-slate-700 dark:text-slate-300"}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-8 space-y-2">
                      <Button
                        asChild
                        className={`w-full font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 py-6 text-sm sm:text-base transition-all ${
                          isSelected
                            ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white ring-2 ring-emerald-500/30"
                            : "bg-emerald-900 hover:bg-emerald-950 text-white dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        }`}
                      >
                        <a
                          href={plan.mercadoPagoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Contratar no Mercado Pago</span>
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                      <div className="w-full text-center text-xs font-semibold text-emerald-700/80 dark:text-emerald-400/80 py-1">
                        Suporte via Canal Próprio no App
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Garantias de Onboarding B2B & Suporte Humanizado */}
            <div className="mt-12 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 text-center shadow-sm">
                <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto mb-2 font-bold">
                  ⚡
                </div>
                <h4 className="font-bold text-sm text-foreground">Configuração em 15 minutos</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Importação de cadastros e configuração guiada passo a passo sem complicações.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 text-center shadow-sm">
                <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto mb-2 font-bold">
                  🎓
                </div>
                <h4 className="font-bold text-sm text-foreground">Treinamento para sua Equipe</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Vídeos práticos e suporte dedicado para recepcionistas, tosadores e veterinários.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 text-center shadow-sm">
                <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto mb-2 font-bold">
                  🛡️
                </div>
                <h4 className="font-bold text-sm text-foreground">Sem Fidelidade ou Multas</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Teste por 7 dias sem cartão de crédito. Cancele ou altere seu plano quando quiser.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => {
                  setAuthModalTab("signup");
                  setAuthModalService("Teste 7 Dias Grátis");
                  setAuthModalOpen(true);
                }}
                className="cursor-pointer bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-extrabold shadow-lg"
              >
                <Zap className="size-4 mr-2" /> Começar Teste de 7 Dias Grátis
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold"
              >
                <a href="https://wa.me/5511993793746?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20do%20Vetty" target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4 mr-2 text-emerald-600" /> Falar com um Consultor no WhatsApp
                </a>
              </Button>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              * Pagamento 100% seguro via Mercado Pago. Aceita Pix com ativação imediata, Boleto e Cartão em até 12x.
            </p>
          </div>
        </section>

        {/* Seção Contato / Demonstração & Gestão na Ponta dos Dedos */}
        <section id="contato" className="section-space">
          <div className="site-container">
            <div className="contact-band !bg-gradient-to-r !from-emerald-950 !via-slate-900 !to-emerald-950 border border-emerald-800/40 shadow-2xl relative overflow-hidden pb-24 sm:pb-28">
              <div className="max-w-2xl relative z-10 pt-2 mb-4 sm:mb-6">
                <span className="eyebrow eyebrow-light text-emerald-300">
                  <PawPrint className="size-4" /> Estamos por perto
                </span>
                <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl uppercase tracking-tight text-white drop-shadow-sm">
                  Seu Petshop com a Gestão na ponta dos dedos
                </h2>
                <p className="mt-5 max-w-xl text-lg text-emerald-100/85 font-medium leading-relaxed">
                  Agende uma Demonstração e veja na prática como fazer a diferença com o Vetty Sistema Inteligente Pet.
                </p>
                <div className="mt-8 mb-4 sm:mb-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 w-full">
                  <a
                    href="https://wa.me/5511993793746"
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-center gap-3.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-teal-500 via-emerald-600 to-teal-700 hover:from-teal-400 hover:via-emerald-500 hover:to-teal-600 text-white font-extrabold text-base tracking-wide shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105 active:scale-95 border border-white/25"
                  >
                    <img
                      src={vettyPawSymbol}
                      alt="Patinha Vetty"
                      className="size-7 object-contain drop-shadow-sm transition-transform duration-300 group-hover:rotate-12"
                    />
                    <span>Chamar no WhatsApp</span>
                  </a>
                  <div className="flex justify-end pr-2 md:pr-6">
                    <img
                      src={logoWhiteImg}
                      alt="Vetty - Sistema Inteligente Pet"
                      className="h-18 sm:h-22 md:h-26 w-auto object-contain drop-shadow-lg opacity-95 transition-all hover:opacity-100 hover:scale-105"
                    />
                  </div>
                </div>
              </div>
              <div className="contact-details mb-4 sm:mb-6">
                <div>
                  <MapPin className="size-5 text-highlight" />
                  <span>
                    <strong>Atendimento Inteligente</strong>
                    <br />
                    Agendamentos & Delivery Integrados
                    <br />
                    Atendimento em Toda a Região
                  </span>
                </div>
                <div>
                  <Clock3 className="size-5 text-highlight" />
                  <span>
                    <strong>Atendimento</strong>
                    <br />
                    Segunda a Sábado · Consulte horários no WhatsApp
                  </span>
                </div>
                <div>
                  <Instagram className="size-5 text-highlight" />
                  <span>
                    <strong>Acompanhe o Vetty</strong>
                    <br />
                    Sistema Inteligente Pet · Novidades e gestão
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalTab("signup");
                      setAuthModalService("Teste 7 Dias Grátis");
                      setAuthModalOpen(true);
                    }}
                    className="group cursor-pointer transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] drop-shadow-md text-left inline-block"
                    title="Clique para iniciar seu teste grátis de 7 dias"
                  >
                    <img
                      src={bannerTeste7Dias}
                      alt="Teste o Plano Master Vip com todas as funcionalidades e veja porque a Vetty é referência em Gestão de Pets no Brasil."
                      className="h-24 sm:h-28 md:h-32 w-auto object-contain rounded-2xl"
                    />
                  </button>
                </div>
              </div>

              {/* Faixa decorativa com ícones de pets na parte inferior do quadro com altura e opacidade ideais */}
              <div className="absolute bottom-1 left-0 right-0 h-12 sm:h-14 opacity-40 pointer-events-none overflow-hidden flex items-center justify-center">
                <img
                  src={animalIconsStrip}
                  alt="Ilustrações de animais Vetty"
                  className="w-full max-w-4xl h-auto object-contain brightness-125"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé Institucional */}
      <footer className="border-t border-border bg-card py-8 text-sm text-muted-foreground">
        <div className="site-container flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p>© 2026 Vetty - Sistema Inteligente Pet. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleServiceNavigation("/agendar", undefined, "Rodapé Agendamento")}
              className="hover:text-primary cursor-pointer"
            >
              Agendamento
            </button>
            <Link to="/loja" className="hover:text-primary">Loja</Link>
            <Link to="/conta" className="hover:text-primary">Minha Conta</Link>
            <Link to="/painel" className="hover:text-primary">Painel Operacional</Link>
            {(isAdmin || user?.email?.toLowerCase() === "bigdog@gmail.com") && (
              <button
                type="button"
                onClick={() => setPainelMasterOpen(true)}
                className="hover:text-amber-500 font-bold cursor-pointer text-amber-500"
              >
                👑 Painel Master
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Dock Inferior Mobile Integrado */}
      <nav className="mobile-dock md:hidden" aria-label="Atalhos para celular">
        <a href="#inicio">
          <PawPrint className="size-5" />
          <span>Início</span>
        </a>
        <a href="#servicos">
          <Scissors className="size-5" />
          <span>Serviços</span>
        </a>
        <button
          type="button"
          onClick={() => handleServiceNavigation("/agendar", undefined, "Dock Mobile Agendar")}
          className="mobile-dock-primary cursor-pointer"
        >
          <CalendarDays className="size-6" />
          <span>Agendar</span>
        </button>
        <Link to="/loja">
          <ShoppingBag className="size-5" />
          <span>Loja</span>
        </Link>
        <a href="https://wa.me/5511993793746" target="_blank" rel="noreferrer">
          <MessageCircle className="size-5 text-[#25D366]" />
          <span>Whats</span>
        </a>
      </nav>

      {/* Modal de Autenticação / Teste 7 Dias Grátis */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        serviceTitle={authModalService}
        defaultMode={authModalTab}
        onSuccess={() => {
          if (pendingPath) {
            navigate({ to: pendingPath.to, search: pendingPath.search });
            setPendingPath(null);
          }
        }}
      />

      {/* Paywall e Apresentação dos 3 Planos com Mercado Pago */}
      <SubscriptionModal
        open={subscriptionModalOpen}
        onOpenChange={setSubscriptionModalOpen}
        isExpired={trialStatus.isExpired}
        isExpiringSoon={trialStatus.isExpiringSoon}
      />

      {/* Painel Master • Centro de Comando (Privilegiado) */}
      <PainelMaster
        open={painelMasterOpen}
        onOpenChange={setPainelMasterOpen}
      />
    </div>
  );
}
