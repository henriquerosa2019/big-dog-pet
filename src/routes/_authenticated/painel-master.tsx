import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { PainelMaster } from "@/components/PainelMaster";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel-master")({
  component: PainelMasterPageRoute,
});

function PainelMasterPageRoute() {
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id, user?.email);
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  const isMaster = isAdmin || user?.email?.toLowerCase() === "bigdog@gmail.com";

  if (!isMaster) {
    return (
      <div className="site-container min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <ShieldAlert className="size-16 text-amber-500 mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          Acesso Restrito ao Painel Master
        </h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Esta área é reservada exclusivamente para o Administrador da Big Dog Pet.
        </p>
        <Button onClick={() => navigate({ to: "/" })} className="mt-6">
          <ArrowLeft className="size-4 mr-2" /> Voltar ao Início
        </Button>
      </div>
    );
  }

  return (
    <div className="site-container py-8">
      <PainelMaster
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            navigate({ to: "/admin" });
          }
        }}
      />
    </div>
  );
}
