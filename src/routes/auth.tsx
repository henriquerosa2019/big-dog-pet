import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LogOut, ShieldCheck, Sparkles, Store, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => authSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Entrar | Big Dog Pet" },
      {
        name: "description",
        content:
          "Acesse sua conta Big Dog Pet para agendar banho e tosa e acompanhar seus pedidos.",
      },
      { property: "og:title", content: "Entrar | Big Dog Pet" },
      { property: "og:description", content: "Acesse sua conta Big Dog Pet." },
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
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    birthDate: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && redirect) {
      navigate({ to: redirect as any, replace: true });
    }
  }, [user, redirect, navigate]);

  async function handleQuickLogin(targetRoute: "/admin" | "/conta" | "/motorista") {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "bigdog@gmail.com",
        password: "bigdog",
      });
      if (error) throw error;
      toast.success("Login de homologação realizado!");
      navigate({ to: targetRoute, replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao entrar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Desconectado com sucesso");
  }

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
      if (redirect) {
        navigate({ to: redirect as any, replace: true });
      } else if (parsed.data.email.toLowerCase() === "bigdog@gmail.com") {
        navigate({ to: "/admin", replace: true });
      } else {
        navigate({ to: "/conta" });
      }
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

  async function handleForgotPassword() {
    const parsed = credentialsSchema.shape.email.safeParse(form.email);
    if (!parsed.success) {
      toast.error("Informe seu e-mail no campo acima para receber o link");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      toast.success("Enviamos um link para você redefinir a senha nesse e-mail.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o link");
    } finally {
      setResetLoading(false);
    }
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md p-5 py-8">
        <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-sm text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold">Você já está conectado</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sessão ativa como <strong className="text-foreground">{user.email}</strong>
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              onClick={() => navigate({ to: "/admin" })}
              className="h-11 w-full rounded-xl font-semibold gap-2"
            >
              <Store className="h-4 w-4" />
              Painel Loja (Admin / Fila)
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/conta" })}
              className="h-11 w-full rounded-xl font-semibold gap-2 border-border/80"
            >
              <User className="h-4 w-4 text-primary" />
              Minha Conta (Tutor / Pets)
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/motorista" })}
              className="h-11 w-full rounded-xl font-semibold gap-2 border-border/80"
            >
              <Truck className="h-4 w-4 text-amber-500" />
              Painel Motorista (Táxi Pet)
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-border/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair desta conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Atalhos para Homologação e Matriz de Testes */}
      <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-primary mb-1.5">
          <Sparkles className="h-4 w-4" />
          Acesso Rápido para Homologação (Matriz de Testes)
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          Conta homologada (<strong className="text-foreground">bigdog@gmail.com</strong>) com acesso direto a todos os papéis:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => handleQuickLogin("/conta")}
            className="h-9 text-xs rounded-xl bg-primary/90 hover:bg-primary font-semibold gap-1.5"
          >
            <User className="h-3.5 w-3.5" />
            Tutor (Pets)
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => handleQuickLogin("/admin")}
            variant="outline"
            className="h-9 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-semibold gap-1.5"
          >
            <Store className="h-3.5 w-3.5" />
            Loja (Admin)
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={() => handleQuickLogin("/motorista")}
            variant="outline"
            className="h-9 text-xs rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold gap-1.5"
          >
            <Truck className="h-3.5 w-3.5" />
            Motorista
          </Button>
        </div>
      </div>

      <h1 className="font-display text-2xl">
        {mode === "login" ? "Entrar na sua conta" : "Criar sua conta"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Para agendar serviços e acompanhar pedidos do seu pet.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        data-hydrated={mounted ? "true" : "false"}
        className="mt-6 space-y-3"
      >
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
          <div className="relative mt-1">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              maxLength={72}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-11 rounded-xl pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === "login" && (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="mt-1.5 text-xs font-semibold text-primary underline"
            >
              {resetLoading ? "Enviando..." : "Esqueci minha senha"}
            </button>
          )}
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
