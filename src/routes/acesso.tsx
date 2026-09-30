import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/acesso")({
  head: () => ({
    meta: [
      { title: "Acesso do dono — Barbearia 49" },
      { name: "description", content: "Painel administrativo da Barbearia 49." },
      { property: "og:title", content: "Acesso do dono — Barbearia 49" },
      { property: "og:description", content: "Painel administrativo da Barbearia 49." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            if (mode === "in") {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) return toast.error("E-mail ou senha incorretos.");
              navigate({ to: "/admin" });
            } else {
              const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/admin" } });
              if (error) return toast.error(error.message);
              if (data.session) navigate({ to: "/admin" });
              else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.");
              setMode("in");
            }
          } finally { setBusy(false); }
        }}
      >
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-primary text-primary"><Scissors className="h-5 w-5" /></span>
          <h1 className="mt-3 text-2xl font-bold">Painel do Isac</h1>
          <p className="text-sm text-muted-foreground">{mode === "in" ? "Entre para gerenciar a barbearia" : "Crie o acesso do dono"}</p>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="grid gap-2"><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></div>
          <Button disabled={busy}>{mode === "in" ? "Entrar" : "Criar acesso"}</Button>
          <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
          </button>
        </div>
      </form>
    </div>
  );
}
