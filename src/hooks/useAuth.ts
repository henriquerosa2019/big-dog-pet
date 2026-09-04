import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

export function useIsAdminStatus(userId?: string | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    async function checkRole() {
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

export function useIsAdmin(userId?: string | null) {
  return useIsAdminStatus(userId).isAdmin;
}

export function useIsDriver(userId?: string | null) {
  const [isDriver, setIsDriver] = useState(false);

  useEffect(() => {
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
        if (active) setIsDriver(Boolean(data));
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return isDriver;
}
