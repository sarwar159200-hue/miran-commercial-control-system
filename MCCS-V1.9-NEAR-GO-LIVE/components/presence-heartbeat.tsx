"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function PresenceHeartbeat() {
  useEffect(() => {
    const supabase = createClient();

    const touch = async () => {
      await supabase.rpc("touch_presence");
    };

    void touch();
    const timer = window.setInterval(() => void touch(), 45_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void touch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
