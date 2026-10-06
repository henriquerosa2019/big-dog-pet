import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bird,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  ExternalLink,
  Heart,
  Instagram,
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
  Sparkles,
  Star,
  Stethoscope,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import heroBird from "@/assets/hero-bird.jpg";
import heroCat from "@/assets/hero-cat.jpg";
import heroDog from "@/assets/hero-dog.jpg";
import logoImg from "@/assets/bigdog-logo.png";
import serviceBanhoTosa from "@/assets/service-banho-tosa.jpg";
import serviceVeterinaria from "@/assets/service-veterinaria.jpg";
import serviceTaxiPet from "@/assets/service-taxi-pet.jpg";
import serviceLojaPet from "@/assets/service-loja-pet.jpg";
import bannerTeste7Dias from "@/assets/banner-teste-7dias.png";
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
    tag: "Higiene & Estética",
    description:
      "Higienização completa, tosa higiênica e da raça com produtos premium, água morna e secagem suave para cães e gatos saírem cheirosos e relaxados.",
    action: "Agendar Banho",
    subtext: "Banho, tosa e spa",
    to: "/agendar",
    image: serviceBanhoTosa,
    iconStyle: "bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300 border-sky-500/25",
  },
  {
    icon: Stethoscope,
    title: "Veterinária",
    tag: "Saúde & Prevenção",
    description:
      "Consultas clínicas, vacinação importada, prevenção e exames com médicos veterinários dedicados ao cuidado, saúde e longevidade do seu companheiro.",
    action: "Agendar Consulta",
    subtext: "Consultas e vacinas",
    to: "/agendar",
    image: serviceVeterinaria,
    iconStyle: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/25",
  },
  {
    icon: CarFront,
    title: "Táxi Pet",
    tag: "Comodidade & Segurança",
    description:
      "Buscamos e levamos seu pet na sua residência com transporte seguro, cinto adaptado, ar-condicionado e motorista atencioso.",
    action: "Pedir Táxi Pet",
    subtext: "Buscamos em sua casa",
    to: "/agendar",
    search: { tipo: "buscar_e_devolver" },
    image: serviceTaxiPet,
    iconStyle: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border-amber-500/25",
  },
  {
    icon: ShoppingBag,
    title: "Loja Pet",
    tag: "Rações & Mimos",
    description:
      "Rações super premium, petiscos saudáveis, farmácia veterinária, caminhas confortáveis e acessórios selecionados para todas as fases do pet.",
    action: "Comprar na Loja",
    subtext: "Rações e mimos",
    to: "/loja",
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
            <a className="nav-link" href="#servicos">Serviços</a>
            <a className="nav-link" href="#planos">Planos</a>
            <Link className="nav-link" to="/loja">Loja</Link>
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

            {/* Botão Agendar com Interceptação de Teste 7 Dias */}
            <Button
              onClick={() => handleServiceNavigation("/agendar", undefined, "Agendamento Online")}
              className="font-bold cursor-pointer"
            >
              <CalendarDays className="size-4" /> Agendar
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
                ["Serviços", "#servicos"],
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
              <Link
                to="/loja"
                className="rounded-md px-4 py-3 font-semibold text-primary hover:bg-muted"
                onClick={() => setMenuOpen(false)}
              >
                🛍️ Loja Online
              </Link>
              <button
                type="button"
                className="text-left rounded-md px-4 py-3 font-semibold text-primary hover:bg-muted cursor-pointer"
                onClick={() => {
                  setMenuOpen(false);
                  handleServiceNavigation("/agendar", undefined, "Agendamento Mobile");
                }}
              >
                📅 Agendar Banho / Táxi Pet
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
                  className="text-left rounded-md px-4 py-3 font-bold text-primary hover:bg-muted cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setAuthModalOpen(true);
                  }}
                >
                  ✨ Teste 7 Dias Grátis / Entrar
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
            <div className="max-w-[690px] text-hero-foreground">
              <h1 className="font-display text-5xl font-bold leading-[1.02] sm:text-6xl md:text-7xl">
                A vida do seu pet em boas mãos
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-hero-muted md:text-xl">
                Banho, tosa, acessórios e cuidado de verdade para cães, gatos e aves — tudo perto de você.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => handleServiceNavigation("/agendar", undefined, "Agendamento Hero")}
                  className="cursor-pointer"
                >
                  Agendar agora <ArrowRight className="size-5" />
                </Button>
                <Button
                  size="lg"
                  className="hero-outline text-base px-6 font-bold shadow-lg"
                  asChild
                >
                  <a href="#servicos">Ver serviços</a>
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-hero-muted">
                <span className="flex -space-x-2" aria-hidden="true">
                  <span className="grid size-9 place-items-center rounded-full border-2 border-hero-scrim bg-primary">
                    <PawPrint className="size-4 text-white" />
                  </span>
                  <span className="grid size-9 place-items-center rounded-full border-2 border-hero-scrim bg-success">
                    <Heart className="size-4 text-white" />
                  </span>
                  <span className="grid size-9 place-items-center rounded-full border-2 border-hero-scrim bg-highlight text-highlight-foreground">
                    <Bird className="size-4 text-slate-900" />
                  </span>
                </span>
                <span>Mais de 1.800 pets atendidos com carinho</span>
              </div>
            </div>
            {/* Indicadores do carrossel */}
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2" role="tablist">
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

        {/* Ações Rápidas integradas ao App com Fundo Translúcido e Tipografia Elegante */}
        <section className="quick-actions" aria-label="Ações rápidas">
          <div className="site-container grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </section>

        {/* Serviços em Destaque com Imagens Elegantes */}
        <section id="servicos" className="section-space">
          <div className="site-container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Sparkles className="size-4" /> Cuidado completo
                </span>
                <h2 className="bg-gradient-to-r from-emerald-800 via-emerald-600 to-green-400 dark:from-emerald-300 dark:via-emerald-400 dark:to-teal-200 bg-clip-text text-transparent inline-block">
                  Do banho aos mimos, a gente cuida.
                </h2>
              </div>
              <p>
                Serviços completos pensados para deixar a rotina prática para você e cheia de carinho para o seu melhor amigo.
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
          </div>
        </section>

        {/* Faixa Institucional de Confiança */}
        {/* Faixa Institucional de Confiança com Logo Vetty, Emojis Elegantes e Tipografia Refinada */}
        <section className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 py-12 text-white border-y border-emerald-800/40 shadow-inner">
          <div className="site-container">
            <div className="flex flex-col items-center justify-center mb-10">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white/95 px-6 py-3 shadow-xl backdrop-blur-md transition-transform duration-200 hover:scale-105">
                <img
                  src={logoImg}
                  alt="Vetty - Sistema Inteligente Pet"
                  className="h-12 sm:h-14 w-auto object-contain"
                />
              </div>
              <p className="mt-4 text-xs sm:text-sm font-bold tracking-widest uppercase text-emerald-300">
                Padrão de Excelência em Cuidados Pet
              </p>
            </div>

            <div className="grid gap-8 text-center sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-sm border border-emerald-500/20 transition-all hover:border-emerald-400/40 hover:bg-white/10">
                <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner">
                  ✨
                </div>
                <strong className="mt-4 block font-display text-xl font-bold bg-gradient-to-r from-emerald-200 via-teal-100 to-white bg-clip-text text-transparent">
                  Produtos Premium
                </strong>
                <span className="mt-1 block text-sm text-emerald-100/75">
                  Cosméticos hipoalergênicos e higiene suave com carinho
                </span>
              </div>

              <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-sm border border-emerald-500/20 transition-all hover:border-emerald-400/40 hover:bg-white/10">
                <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner">
                  🐾
                </div>
                <strong className="mt-4 block font-display text-xl font-bold bg-gradient-to-r from-emerald-200 via-teal-100 to-white bg-clip-text text-transparent">
                  Estrutura Completa
                </strong>
                <span className="mt-1 block text-sm text-emerald-100/75">
                  Ambiente climatizado, monitorado e profissionais dedicados
                </span>
              </div>

              <div className="rounded-2xl bg-white/5 p-6 backdrop-blur-sm border border-emerald-500/20 transition-all hover:border-emerald-400/40 hover:bg-white/10">
                <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shadow-inner">
                  💚
                </div>
                <strong className="mt-4 block font-display text-xl font-bold bg-gradient-to-r from-emerald-200 via-teal-100 to-white bg-clip-text text-transparent">
                  Carinho de Verdade
                </strong>
                <span className="mt-1 block text-sm text-emerald-100/75">
                  Manejo sem estresse para o seu pet se sentir em casa
                </span>
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
                    alt="Teste por 7 Dias Grátis! Tudo do Plano Pro incluído. Decida depois."
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
            <p className="mt-6 text-center text-xs text-muted-foreground">
              * Pagamento 100% seguro via Mercado Pago. Aceita Pix com ativação imediata, Boleto e Cartão em até 12x.
            </p>
          </div>
        </section>

        {/* Seção Contato / Loja Física */}
        <section id="contato" className="section-space">
          <div className="site-container">
            <div className="contact-band">
              <div className="max-w-2xl">
                <span className="eyebrow eyebrow-light">
                  <PawPrint className="size-4" /> Estamos por perto
                </span>
                <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">
                  Seu pet merece um dia de cuidado.
                </h2>
                <p className="mt-5 max-w-xl text-lg text-brand-band-muted">
                  Fale com a equipe, tire suas dúvidas e encontre o melhor horário para o seu companheiro.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button variant="hero" size="lg" asChild>
                    <a href="https://wa.me/5511993793746" target="_blank" rel="noreferrer">
                      <MessageCircle className="size-5" /> Chamar no WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
              <div className="contact-details">
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
                      alt="Teste por 7 Dias Grátis! Tudo do Plano Pro incluído. Decida depois."
                      className="h-20 sm:h-24 w-auto object-contain rounded-2xl"
                    />
                  </button>
                </div>
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
