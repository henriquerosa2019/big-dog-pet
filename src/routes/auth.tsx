import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | PetCura" },
      {
        name: "description",
        content:
          "Acesse sua conta PetCura para agendar banho, tosa e consultas veterinárias e acompanhar seus pedidos.",
      },
      { property: "og:title", content: "Entrar | PetCura" },
      { property: "og:description", content: "Acesse sua conta PetCura." },
    ],
  }),
  component: Auth,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(72),
  fullName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  birthDate: z.string().trim().max(10).optional(),
});

function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    birthDate: "",
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate({ to: "/conta", replace: true });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: parsed.data.fullName,
              phone: parsed.data.phone,
              birth_date: parsed.data.birthDate || undefined,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Cadastro criado! Confirme o e-mail para entrar.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      navigate({ to: "/conta" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível continuar";
      toast.error(
        message.includes("Invalid login credentials") ? "E-mail ou senha incorretos" : message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/conta" });
  }

  return (
    <div className="p-5">
      <h1 className="font-display text-2xl">
        {mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Para agendar serviços e acompanhar pedidos do seu pet.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <>
            <div>
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                value={form.fullName}
                maxLength={100}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="mt-1 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                inputMode="tel"
                value={form.phone}
                maxLength={20}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 h-11 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="birthDate">Data de nascimento (opcional)</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className="mt-1 h-11 rounded-xl"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Usamos para te avisar de ofertas especiais no seu aniversário.
              </p>
            </div>
          </>
        )}
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            maxLength={255}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 h-11 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            maxLength={72}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="mt-1 h-11 rounded-xl"
          />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl">
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={handleGoogle}
        className="h-12 w-full rounded-2xl"
      >
        Continuar com Google
      </Button>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-6 w-full text-center text-sm text-muted-foreground underline"
      >
        {mode === "login" ? "Não tenho conta. Quero me cadastrar" : "Já tenho conta. Entrar"}
      </button>
    </div>
  );
}
