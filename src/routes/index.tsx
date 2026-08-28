import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bath, Check, Copy, Gift, MapPin, MessageCircle, Scissors, Sparkles, Stethoscope } from "lucide-react";
import { useState } from "react";
import heroImage from "@/assets/hero-pets.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BIRTHDAY_DISCOUNT_PERCENT,
  birthdayCouponCode,
  capitalizeWords,
  CLINIC,
  formatBRL,
  formatDate,
  isBirthdayToday,
  whatsappLink,
} from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Big Dog Pet | Banho, Tosa e Acessórios em Franco da Rocha" },
      {
        name: "description",
        content:
          "Big Dog Pet, em Franco da Rocha: banho, tosa, acessórios e produtos para o seu pet. Agende online.",
      },
      { property: "og:title", content: "Big Dog Pet | Banho e Tosa em Franco da Rocha" },
      {
        property: "og:description",
        content: "Agendamento online de banho e tosa + loja de acessórios pro seu pet.",
      },
    ],
  }),
  component: Home,
});

const categoryIcons: Record<string, typeof Bath> = {
  banho: Bath,
  tosa: Scissors,
  veterinario: Stethoscope,
};

const categoryLabels: Record<string, string> = {
  banho: "Banho",
  tosa: "Tosa",
  veterinario: "Veterinário",
};

function Home() {
  const { user } = useAuth();

  const { data: services } = useQuery({
    queryKey: ["services", "home"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description, category, price_cents, duration_min")
        .eq("active", true)
        .order("price_cents");
      if (error) throw error;
      return data;
    },
  });

  const { data: ownProfile } = useQuery({
    queryKey: ["profile-birthday", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, birth_date")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ownPets } = useQuery({
    queryKey: ["pets-birthday", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("pets").select("name, birth_date");
      if (error) throw error;
      return data;
    },
  });

  const birthdayPet = (ownPets ?? []).find((p) => isBirthdayToday(p.birth_date));
  const isOwnerBirthday = isBirthdayToday(ownProfile?.birth_date);
  const rawBirthdayName = birthdayPet
    ? birthdayPet.name
    : isOwnerBirthday
      ? ownProfile?.full_name?.split(" ")[0]
      : null;
  const birthdayName = rawBirthdayName ? capitalizeWords(rawBirthdayName) : null;
  const couponCode = birthdayCouponCode(rawBirthdayName);
  const [couponCopied, setCouponCopied] = useState(false);

  async function copyCoupon() {
    try {
      await navigator.clipboard.writeText(couponCode);
      setCouponCopied(true);
      setTimeout(() => setCouponCopied(false), 2000);
    } catch {
      /* clipboard indisponível — o código já fica visível no badge pra copiar manualmente */
    }
  }

  return (
    <div>
      <section className="relative">
        <img
          src={heroImage}
          alt="Profissional cuidando de um cão e um gato na Big Dog Pet"
          width={1200}
          height={912}
          className="h-60 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="font-display text-3xl leading-tight text-primary-foreground">
            A vida do seu pet em boas mãos
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/85">
            {CLINIC.tagline}.
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            {CLINIC.unit} · Vila Bazú, Franco da Rocha
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 p-4">
        <Button asChild size="lg" className="h-12 rounded-2xl">
          <Link to="/agendar">Agendar serviço</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-12 rounded-2xl">
          <Link to="/loja">Ir para a loja</Link>
        </Button>
      </section>

      {birthdayName && (
        <section className="px-4 pb-2">
          <div className="rounded-2xl border-2 border-gold/50 bg-secondary p-4">
            <p className="flex items-center gap-1.5 font-display text-lg">
              <Gift className="h-5 w-5 text-gold" />
              {birthdayPet
                ? `Parabéns pra ${birthdayName}! 🐾`
                : `Parabéns, ${birthdayName}! 🎂`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {birthdayPet
                ? `O dia do seu pet merece um mimo especial: ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho, tosa ou nas compras da loja, só hoje.`
                : `O ${CLINIC.name} preparou um presente pra você e seu pet: ${BIRTHDAY_DISCOUNT_PERCENT}% de desconto em banho, tosa ou nas compras da loja, só hoje.`}
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-xl border-2 border-dashed border-gold/60 bg-background px-3 py-2">
              <span className="flex-1 font-mono text-sm font-bold tracking-wide text-gold">
                {couponCode}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 rounded-lg text-xs"
                onClick={copyCoupon}
              >
                {couponCopied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {couponCopied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              Válido só hoje, {formatDate(new Date())}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button asChild size="sm" className="h-10 rounded-xl">
                <Link to="/agendar" search={{ campanha: "niver", cupom: couponCode }}>
                  Agendar banho/tosa
                </Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className="h-10 rounded-xl">
                <Link to="/loja" search={{ campanha: "niver", cupom: couponCode }}>
                  Ver produtos da loja
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <section className="px-4 pb-2">
        <h2 className="font-display text-xl">Nossos serviços</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Valores de referência. A confirmação é feita pela equipe.
        </p>
        <ul className="mt-4 space-y-3">
          {(services ?? []).map((service) => {
            const Icon = categoryIcons[service.category] ?? Sparkles;
            return (
              <li
                key={service.id}
                className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-card"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="truncate font-display text-base">{service.name}</h3>
                    <span className="shrink-0 text-sm font-bold text-primary">
                      {formatBRL(service.price_cents)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{service.description}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {categoryLabels[service.category] ?? service.category} · {service.duration_min}{" "}
                    min
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6 surface-paper px-4 py-6">
        <h2 className="font-display text-xl">Onde nos encontrar</h2>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {CLINIC.unit}: {CLINIC.address}
          </li>
          <li className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
            <a href={whatsappLink("Olá! Vim pelo app da Big Dog Pet.")} className="underline">
              {CLINIC.phoneDisplay}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
