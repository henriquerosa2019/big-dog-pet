import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, LogIn, Mail, PawPrint, Phone, Sparkles, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceTitle?: string;
  onSuccess?: () => void;
  defaultMode?: "signup" | "login";
}

export function AuthModal({
  open,
  onOpenChange,
  serviceTitle,
  onSuccess,
  defaultMode = "signup",
}: AuthModalProps) {
  const [tab, setTab] = useState<"signup" | "login">(defaultMode);

  useEffect(() => {
    if (defaultMode) {
      setTab(defaultMode);
    }
  }, [defaultMode, open]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            trial_started_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        toast.success("Conta criada com sucesso! Aproveite seus 7 dias grátis.");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.success("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao realizar cadastro.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      // Suporte direto para as credenciais master solicitadas pelo gestor
      const cleanEmail = email.trim().toLowerCase();
      const cleanPass = password.trim();
      if (
        (cleanEmail === "vetty@vetty.com.br" || cleanEmail === "bigdog@gmail.com") &&
        (cleanPass === "vetty26" || cleanPass === "Ad16eoh28@" || cleanPass === "bigdog")
      ) {
        sessionStorage.setItem("vetty_master_authenticated", "true");
        localStorage.setItem("vetty_homologacao_admin", "true");
        toast.success("Login Master realizado com sucesso!");
        onOpenChange(false);
        onSuccess?.();
        window.location.href = "/admin";
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      toast.success("Bem-vindo de volta à Big Dog Pet!");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    try {
      // Libera acesso de homologação imediato com as credenciais master (vetty@vetty.com.br / vetty26)
      sessionStorage.setItem("vetty_master_authenticated", "true");
      localStorage.setItem("vetty_homologacao_admin", "true");
      toast.success("Login de demonstração Master liberado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
      window.location.href = "/admin";
    } catch (err: any) {
      toast.error(err?.message || "Erro ao entrar com conta demo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PawPrint className="size-6" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold">
            {serviceTitle ? `Acessar ${serviceTitle}` : "Acesso à Big Dog Pet"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Entre na sua conta ou inicie agora seu teste de 7 dias grátis.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(val) => setTab(val as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signup" className="text-xs font-bold gap-1.5 cursor-pointer">
              <Sparkles className="size-3.5 text-amber-500" /> Teste 7 Dias Grátis
            </TabsTrigger>
            <TabsTrigger value="login" className="text-xs font-bold gap-1.5 cursor-pointer">
              <LogIn className="size-3.5 text-primary" /> Já sou Cliente
            </TabsTrigger>
          </TabsList>

          {/* ABA CADASTRO: TESTE 7 DIAS GRÁTIS */}
          <TabsContent value="signup" className="mt-4">
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <strong className="block font-bold">🎉 Degustação Especial:</strong>
              Crie sua conta agora e ganhe <strong>7 dias grátis</strong> para agendar e experimentar toda a comodidade da Big Dog Pet!
            </div>

            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <Label htmlFor="reg-name" className="text-xs font-semibold">Nome Completo</Label>
                <div className="relative mt-1">
                  <UserIcon className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reg-phone" className="text-xs font-semibold">WhatsApp / Telefone</Label>
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="reg-phone"
                    type="tel"
                    required
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reg-email" className="text-xs font-semibold">E-mail</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="reg-pass" className="text-xs font-semibold">Criar Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="reg-pass"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90 cursor-pointer"
              >
                {loading ? "Cadastrando..." : "Cadastrar e Iniciar 7 Dias Grátis"}
              </Button>
            </form>
          </TabsContent>

          {/* ABA LOGIN: JÁ SOU CLIENTE */}
          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <Label htmlFor="log-email" className="text-xs font-semibold">E-mail</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="log-email"
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="log-pass" className="text-xs font-semibold">Senha</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="log-pass"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Sua senha cadastrada"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90 cursor-pointer"
              >
                {loading ? "Entrando..." : "Entrar na Minha Conta"}
              </Button>
            </form>

            <div className="mt-4 border-t border-border/60 pt-3 text-center">
              <span className="text-xs text-muted-foreground">Quer apenas testar rapidamente?</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full mt-1.5 text-xs font-semibold cursor-pointer"
              >
                Login Rápido de Demonstração (Admin / Loja)
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
