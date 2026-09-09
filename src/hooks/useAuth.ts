import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isRegisteredDriverUser } from "@/lib/driversManager";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: (session?.user ?? null) as User | null, loading };
}

export function useIsAdminStatus(userId?: string | null, userEmail?: string | null) {
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== "undefined") {
      const email = userEmail?.toLowerCase();
      if (email === "bigdog@gmail.com") return true;
    }
    return false;
  });
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    // 1. Verificação imediata por e-mail da conta oficial da loja
    if (userEmail?.toLowerCase() === "bigdog@gmail.com") {
      setIsAdmin(true);
      setLoading(false);
      return;
    }

    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    async function checkRole() {
      // 2. Checa se o usuário logado no Supabase Auth é bigdog@gmail.com
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user?.email?.toLowerCase() === "bigdog@gmail.com") {
          if (active) {
            setIsAdmin(true);
            setLoading(false);
          }
          return;
        }
      } catch {}

      // 3. Checa role na tabela user_roles
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId!)
          .eq("role", "admin")
          .maybeSingle();

        if (active) {
          setIsAdmin(Boolean(data));
        }
      } catch {
        if (active) {
          setIsAdmin(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkRole();

    return () => {
      active = false;
    };
  }, [userId]);

  return { isAdmin, loading };
}

export function useIsAdmin(userId?: string | null, userEmail?: string | null) {
  return useIsAdminStatus(userId, userEmail).isAdmin;
}

export function useIsDriver(userId?: string | null, userEmail?: string | null) {
  const [isDriver, setIsDriver] = useState(() => {
    if (isRegisteredDriverUser(userId, userEmail)) return true;
    return false;
  });

  useEffect(() => {
    if (isRegisteredDriverUser(userId, userEmail)) {
      setIsDriver(true);
      return;
    }
    if (!userId) {
      setIsDriver(false);
      return;
    }
    let active = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "motorista")
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setIsDriver(Boolean(data) || isRegisteredDriverUser(userId, userEmail));
        }
      });
    return () => {
      active = false;
    };
  }, [userId, userEmail]);

  return isDriver;
}
