import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bath,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Scissors,
  Stethoscope,
  Syringe,
} from "lucide-react";
import heroImage from "@/assets/hero-pets.jpg";
import { supabase } from "@/integrations/supabase/client";
import { CLINIC, formatBRL, whatsappLink } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PetCura Tijuca | Banho, Tosa e Veterinário com agendamento online" },
      {
        name: "description",
        content:
          "Consultório Veterinário PetCura na Tijuca: consultas, vacinas, exames, microchipagem, banho e tosa. Agende online e compre produtos para o seu pet.",
      },
      { property: "og:title", content: "PetCura Tijuca | Banho, Tosa e Veterinário" },
      {
        property: "og:description",
        content: "Agendamento online de serviços e loja virtual do seu pet na Tijuca.",
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

  return (
    <div>
      <section className="relative">
        <img
          src={heroImage}
          alt="Veterinária cuidando de um cão e um gato no consultório PetCura"
          width={1200}
          height={912}
          className="h-60 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Tijuca · Rio de Janeiro
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight text-primary-foreground">
            Cuidado completo para quem faz parte da família
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/85">
            Consultas, vacinas, exames, microchipagem, banho e tosa.
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

      <section className="px-4 pb-2">
        <h2 className="font-display text-xl">Nossos serviços</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Valores de referência. A confirmação é feita pela equipe.
        </p>
        <ul className="mt-4 space-y-3">
          {(services ?? []).map((service) => {
            const Icon = categoryIcons[service.category] ?? Syringe;
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
                    {categoryLabels[service.category] ?? service.category} ·{" "}
                    {service.duration_min} min
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
            {CLINIC.address}
          </li>
          <li className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
            <a href={whatsappLink("Olá! Vim pelo app do PetCura.")} className="underline">
              {CLINIC.phoneDisplay}
            </a>
          </li>
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <a href={`mailto:${CLINIC.email}`} className="break-all underline">
              {CLINIC.email}
            </a>
          </li>
          <li className="flex items-center gap-2">
            <Instagram className="h-4 w-4 shrink-0 text-primary" />
            {CLINIC.instagram}
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Responsável técnico: {CLINIC.responsible}
        </p>
      </section>
    </div>
  );
}
