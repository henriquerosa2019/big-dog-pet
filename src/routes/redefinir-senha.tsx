import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Big Dog Pet" },
      {
        name: "description",
        content: "Defina uma nova senha para sua conta Big Dog Pet.",
      },
    ],
  }),
  component: RedefinirSenha,
});

const passwordSchema = z
  .object({
    password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres").max(72),
    confirm: z.string().min(6).max(72),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

function RedefinirSenha() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifique os dados");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      toast.success("Senha redefinida! Você já pode usar a nova senha para entrar.");
      navigate({ to: "/conta" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="p-5">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-5">
        <h1 className="font-display text-2xl">Link inválido ou expirado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça um novo link de redefinição de senha na tela de entrar.
        </p>
        <Button asChild className="mt-6 h-11 rounded-2xl">
          <Link to="/auth">Voltar para entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="font-display text-2xl">Definir nova senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha uma nova senha para sua conta Big Dog Pet.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <div>
          <Label htmlFor="password">Nova senha</Label>
          <div className="relative mt-1">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
        </div>
        <div>
          <Label htmlFor="confirm">Confirmar nova senha</Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={form.confirm}
            maxLength={72}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="mt-1 h-11 rounded-xl"
          />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl">
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
