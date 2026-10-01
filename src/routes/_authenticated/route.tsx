import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Check local storage session (client-side)
    let isLocalOwner = false;
    if (typeof window !== "undefined") {
      isLocalOwner = localStorage.getItem("barbearia49_owner_session") === "true";
    }

    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        return { user: data.user };
      }
    } catch {
      // ignore
    }

    if (isLocalOwner) {
      return {
        user: {
          id: "master-owner",
          email: "samuel.psa777@gmail.com",
        },
      };
    }

    // If not authenticated, redirect to /acesso
    throw redirect({
      to: "/acesso",
    });
  },
  component: () => <Outlet />,
});

