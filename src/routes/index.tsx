import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bird,
  CalendarDays,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Instagram,
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
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import heroBird from "@/assets/hero-bird.jpg";
import heroCat from "@/assets/hero-cat.jpg";
import heroDog from "@/assets/hero-dog.jpg";
import logoImg from "@/assets/bigdog-logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Big Dog Pet | Banho, tosa e cuidado em Franco da Rocha" },
      {
        name: "description",
        content:
          "Banho e tosa, Táxi Pet, produtos e planos de cuidado para cães, gatos e aves em Franco da Rocha.",
      },
      { property: "og:title", content: "Big Dog Pet | A vida do seu pet em boas mãos" },
      {
        property: "og:description",
        content: "Cuidado completo, do banho aos mimos, com atendimento perto de você.",
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
    description: "Cuidado, higiene e muito carinho para seu pet sair feliz e cheiroso.",
    action: "Agendar serviço",
    to: "/agendar",
  },
  {
    icon: CarFront,
    title: "Táxi Pet",
    description: "Buscamos e levamos seu pet de volta com conforto em Franco da Rocha.",
    action: "Solicitar transporte",
    to: "/agendar",
    search: { tipo: "buscar_e_devolver" },
  },
  {
    icon: ShoppingBag,
    title: "Loja Pet",
    description: "Rações, acessórios e mimos escolhidos para cada fase da vida.",
    action: "Conhecer a loja",
    to: "/loja",
  },
];

const plans = [
  {
    name: "Plano Essencial",
    detail: "Para manter a rotina de cuidados em dia.",
    features: ["Banhos programados", "Lembretes de cuidado", "Condições para serviços"],
    whatsappText: "Olá! Gostaria de saber mais informações sobre o Plano Essencial da Big Dog Pet.",
  },
  {
    name: "Plano Melhor Amigo",
    detail: "Mais praticidade para quem cuida todo mês.",
    features: ["Cuidados recorrentes", "Prioridade no agendamento", "Benefícios exclusivos"],
    popular: true,
    whatsappText: "Olá! Gostaria de saber mais informações sobre o Plano Melhor Amigo da Big Dog Pet.",
  },
  {
    name: "Plano Completo",
    detail: "Uma rotina completa de bem-estar e beleza.",
    features: ["Pacote de cuidados", "Táxi Pet facilitado", "Atendimento prioritário"],
    whatsappText: "Olá! Gostaria de saber mais informações sobre o Plano Completo da Big Dog Pet.",
  },
];

function Index() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 md:pb-0">
      {/* Faixa para usuários já conectados que queiram ir direto para o painel de pedidos */}
      {user && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 text-center text-xs text-primary font-semibold flex items-center justify-center gap-2">
          <span>Olá! Você já está conectado na Big Dog Pet.</span>
          <Link to="/conta" className="underline font-bold hover:text-primary/80">
            Acessar Meus Agendamentos e Pets →
          </Link>
        </div>
      )}

      {/* Cabeçalho Oficial do Novo Design */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="site-container flex h-18 items-center justify-between">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Big Dog Pet - início">
            <img src={logoImg} alt="Logo Big Dog Pet" className="size-11 object-contain rounded-full shadow-xs" />
            <span className="leading-none">
              <strong className="block font-display text-xl text-brand-strong">Big Dog Pet</strong>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Banho e tosa
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
            <a className="nav-link" href="#inicio">Início</a>
            <a className="nav-link" href="#servicos">Serviços</a>
            <a className="nav-link" href="#planos">Planos</a>
            <Link className="nav-link" to="/loja">Loja</Link>
            <a className="nav-link" href="#contato">Contato</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="outline" asChild>
              <a href="https://wa.me/5511993793746" target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
            <Button asChild>
              <Link to="/agendar">
                <CalendarDays className="size-4" /> Agendar
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild title="Minha Conta">
              <Link to="/conta">
                <User className="size-5" />
              </Link>
            </Button>
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
              <Link
                to="/agendar"
                className="rounded-md px-4 py-3 font-semibold text-primary hover:bg-muted"
                onClick={() => setMenuOpen(false)}
              >
                📅 Agendar Banho / Táxi Pet
              </Link>
              <Link
                to="/conta"
                className="rounded-md px-4 py-3 font-semibold hover:bg-muted"
                onClick={() => setMenuOpen(false)}
              >
                👤 Minha Conta / Meus Pets
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* Banner Hero com Carrossel de Cão, Gato e Calopsita */}
        <section id="inicio" className="relative min-h-[690px] overflow-hidden md:min-h-[760px]">
          {heroSlides.map((slide, index) => (
            <img
              key={slide.label}
              src={slide.image}
              alt={slide.alt}
              width={1920}
              height={1080}
              className={`absolute inset-0 size-full object-cover object-[62%_center] transition-opacity duration-1000 md:object-center ${
                index === activeSlide ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={index !== activeSlide}
            />
          ))}
          <div className="absolute inset-0 bg-hero-overlay" />
          <div className="site-container relative flex min-h-[690px] items-end pb-20 pt-24 md:min-h-[760px] md:items-center md:pb-14 md:pt-20">
            <div className="max-w-[690px] text-hero-foreground">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-hero-foreground/20 bg-hero-scrim/40 px-4 py-2 text-sm font-bold backdrop-blur-sm">
                <MapPin className="size-4 text-highlight" /> Loja 3 · Franco da Rocha
              </div>
              <h1 className="font-display text-5xl font-bold leading-[1.02] sm:text-6xl md:text-7xl">
                A vida do seu pet em boas mãos
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-hero-muted md:text-xl">
                Banho, tosa, acessórios e cuidado de verdade para cães, gatos e aves — tudo perto de você.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/agendar">
                    Agendar agora <ArrowRight className="size-5" />
                  </Link>
                </Button>
                <Button className="hero-outline" variant="outline" size="lg" asChild>
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
                    <Star className="size-4" />
                  </span>
                </span>
                Cuidado gentil para todos os tamanhos
              </div>
            </div>
            <div className="absolute bottom-6 right-5 flex gap-2 md:bottom-10 md:right-8">
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

        {/* Ações Rápidas integradas ao App */}
        <section className="quick-actions" aria-label="Ações rápidas">
          <div className="site-container grid gap-3 md:grid-cols-3">
            {services.map(({ icon: Icon, title, action, to, search }, index) => (
              <Link
                key={title}
                to={to}
                search={search}
                className="quick-action group cursor-pointer"
              >
                <span
                  className={`quick-icon ${
                    index === 1
                      ? "bg-success-soft text-success"
                      : index === 2
                      ? "bg-highlight-soft text-highlight-strong"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  <Icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block font-display text-lg">{title}</strong>
                  <span className="text-sm text-muted-foreground">{action}</span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </section>

        {/* Serviços em Destaque */}
        <section id="servicos" className="section-space">
          <div className="site-container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <Sparkles className="size-4" /> Cuidado completo
                </span>
                <h2>Do banho aos mimos, a gente cuida.</h2>
              </div>
              <p>Serviços pensados para deixar a rotina mais simples para você e mais gostosa para o seu melhor amigo.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {services.map(({ icon: Icon, title, description, action, to, search }, index) => (
                <article className="service-card flex flex-col justify-between" key={title}>
                  <div>
                    <div className="mb-8 flex items-start justify-between">
                      <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
                        <Icon className="size-7" />
                      </span>
                      <span className="font-display text-5xl text-border">0{index + 1}</span>
                    </div>
                    <h3 className="font-display text-2xl">{title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
                  </div>
                  <Link
                    to={to}
                    search={search}
                    className="mt-7 inline-flex items-center gap-2 font-bold text-primary hover:underline"
                  >
                    {action} <ArrowRight className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Faixa Institucional de Confiança */}
        <section className="bg-brand-band py-10 text-brand-band-foreground">
          <div className="site-container grid gap-8 text-center sm:grid-cols-3">
            <div>
              <ShieldCheck className="mx-auto size-7 text-highlight" />
              <strong className="mt-3 block font-display text-xl">Cuidado responsável</strong>
              <span className="text-sm text-brand-band-muted">Atenção em cada detalhe</span>
            </div>
            <div>
              <Clock3 className="mx-auto size-7 text-highlight" />
              <strong className="mt-3 block font-display text-xl">Rotina facilitada</strong>
              <span className="text-sm text-brand-band-muted">Agendamento rápido</span>
            </div>
            <div>
              <Heart className="mx-auto size-7 text-highlight" />
              <strong className="mt-3 block font-display text-xl">Carinho de verdade</strong>
              <span className="text-sm text-brand-band-muted">Seu pet se sente em casa</span>
            </div>
          </div>
        </section>

        {/* Planos de Recorrência Big Dog */}
        <section id="planos" className="section-space bg-section-alt">
          <div className="site-container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  <PackageOpen className="size-4" /> Planos Big Dog
                </span>
                <h2>Cuidado frequente, sem complicação.</h2>
              </div>
              <p>Escolha uma rotina para acompanhar seu pet. Valores e condições são confirmados no atendimento.</p>
            </div>
            <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <article className={`plan-card ${plan.popular ? "plan-card-featured" : ""}`} key={plan.name}>
                  {plan.popular && (
                    <span className="popular-badge">
                      <Star className="size-3 fill-current" /> Mais escolhido
                    </span>
                  )}
                  <h3 className="mt-2 font-display text-2xl">{plan.name}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted-foreground">{plan.detail}</p>
                  <div className="my-7 border-y border-border py-5">
                    <span className="block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Mensalidade
                    </span>
                    <strong className="mt-1 block font-display text-2xl text-primary">Consulte valores</strong>
                  </div>
                  <ul className="space-y-4 flex-1">
                    {plan.features.map((feature) => (
                      <li className="flex gap-3 text-sm" key={feature}>
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                          <Check className="size-3" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-8 w-full" variant={plan.popular ? "default" : "outline"} asChild>
                    <a
                      href={`https://wa.me/5511993793746?text=${encodeURIComponent(plan.whatsappText)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Quero saber mais
                    </a>
                  </Button>
                </article>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              * Nomes, benefícios, valores e disponibilidade dos planos devem ser confirmados com a loja.
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
                  <Button className="hero-outline" variant="outline" size="lg" asChild>
                    <Link to="/agendar">
                      <CalendarDays className="size-5" /> Agendar Online
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="contact-details">
                <div>
                  <MapPin className="size-5 text-highlight" />
                  <span>
                    <strong>Loja 3</strong>
                    <br />
                    Rua Rangel Pestana, 56 · Vila Bazú
                    <br />
                    Franco da Rocha · SP
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
                    <strong>Acompanhe a Big Dog Pet</strong>
                    <br />
                    Novidades, cuidados e mimos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé Comercial */}
      <footer className="border-t border-border py-8">
        <div className="site-container flex flex-col items-center justify-between gap-4 text-center text-sm text-muted-foreground sm:flex-row sm:text-left">
          <div className="flex items-center gap-2 font-display font-bold text-foreground">
            <PawPrint className="size-5 text-primary" /> Big Dog Pet
          </div>
          <p>© 2026 Big Dog Pet. A vida do seu pet em boas mãos.</p>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link to="/agendar" className="hover:text-primary">Agendamento</Link>
            <Link to="/loja" className="hover:text-primary">Loja</Link>
            <Link to="/conta" className="hover:text-primary">Minha Conta</Link>
            <Link to="/painel" className="hover:text-primary">Painel Operacional</Link>
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
        <Link className="mobile-dock-primary" to="/agendar">
          <CalendarDays className="size-6" />
          <span>Agendar</span>
        </Link>
        <Link to="/loja">
          <ShoppingBag className="size-5" />
          <span>Loja</span>
        </Link>
        <a href="https://wa.me/5511993793746" target="_blank" rel="noreferrer">
          <MessageCircle className="size-5" />
          <span>Whats</span>
        </a>
      </nav>
    </div>
  );
}
