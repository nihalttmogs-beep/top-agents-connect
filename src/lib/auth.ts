import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;
    const client = getSupabaseClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setSession(data.session);
        setLoading(false);
      })
      .catch((sessionError: unknown) => {
        if (!active) return;
        setError(
          sessionError instanceof Error ? sessionError.message : "Unable to restore session.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    configured: isSupabaseConfigured,
    error,
    loading,
    session,
    user: session?.user ?? null,
  };
}
