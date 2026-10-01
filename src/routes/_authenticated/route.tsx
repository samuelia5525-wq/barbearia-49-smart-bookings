import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const isLocalOwner =
      typeof window !== "undefined" &&
      localStorage.getItem("barbearia49_owner_session") === "true";

    const { data } = await supabase.auth.getUser();
    if (!data?.user && !isLocalOwner) {
      throw redirect({ to: "/acesso" });
    }
    return {
      user: data?.user ?? {
        id: "master-owner",
        email: "samuel.psa777@gmail.com",
      },
    };
  },
  component: () => <Outlet />,
});
