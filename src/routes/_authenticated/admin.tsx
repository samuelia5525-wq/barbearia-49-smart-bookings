import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BarChart3, CalendarDays, Clock, LogOut, Scissors, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimOwner } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel — Barbearia 49" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Agenda", icon: CalendarDays, exact: true },
] as const;

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const claim = useServerFn(claimOwner);
  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/acesso", replace: true });
  };

  if (role.isLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>;
  if (!role.data)
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Ativar acesso do dono</h1>
          <p className="mt-2 text-sm text-muted-foreground">Se você é o Isac e este é o primeiro acesso, ative o painel. Só a primeira conta pode fazer isso.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={async () => {
              const r = await claim();
              if (r.ok) { toast.success("Acesso ativado!"); role.refetch(); } else toast.error(r.error);
            }}>Sou o dono</Button>
            <Button variant="outline" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-border bg-sidebar md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/" className="font-display text-lg font-bold">Barbearia <span className="text-primary">49</span></Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              activeProps={{ className: "bg-sidebar-accent text-primary" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 hidden px-4 md:block">
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
