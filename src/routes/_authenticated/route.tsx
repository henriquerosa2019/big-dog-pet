import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { TrialBanner } from "@/components/TrialBanner";
import { SubscriptionModal } from "@/components/SubscriptionModal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return { user: null };
    }
    const hasMasterSession =
      sessionStorage.getItem("vetty_master_authenticated") === "true" ||
      localStorage.getItem("vetty_homologacao_admin") === "true";

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user && !hasMasterSession) {
      throw redirect({ to: "/auth" });
    }
    return {
      user: sessionData.session?.user ?? (hasMasterSession ? ({ id: "master-vetty", email: "vetty@vetty.com.br" } as any) : null),
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user?.id, user?.email);
  const { isExpired, isExpiringSoon, isSubscriber } = useTrialStatus();
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [user, loading, navigate]);

  // Se for o Dono do Petshop/Admin e o período de teste de 7 dias do software expirou
  useEffect(() => {
    if (isAdmin && isExpired && !isSubscriber && user?.email?.toLowerCase() !== "bigdog@gmail.com") {
      setPlansModalOpen(true);
    }
  }, [isAdmin, isExpired, isSubscriber, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      {isAdmin && <TrialBanner onOpenPlans={() => setPlansModalOpen(true)} />}
      <Outlet />
      {isAdmin && (
        <SubscriptionModal
          open={plansModalOpen}
          onOpenChange={setPlansModalOpen}
          isExpired={isExpired}
          isExpiringSoon={isExpiringSoon}
        />
      )}
    </>
  );
}
