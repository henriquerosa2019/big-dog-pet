import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { TrialBanner } from "@/components/TrialBanner";
import { SubscriptionModal } from "@/components/SubscriptionModal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return { user: null };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: sessionData.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { isExpired, isExpiringSoon } = useTrialStatus();
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [user, loading, navigate]);

  // Se o período de teste expirou, abre automaticamente o modal de planos
  useEffect(() => {
    if (isExpired) {
      setPlansModalOpen(true);
    }
  }, [isExpired]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <TrialBanner onOpenPlans={() => setPlansModalOpen(true)} />
      <Outlet />
      <SubscriptionModal
        open={plansModalOpen}
        onOpenChange={setPlansModalOpen}
        isExpired={isExpired}
        isExpiringSoon={isExpiringSoon}
      />
    </>
  );
}
