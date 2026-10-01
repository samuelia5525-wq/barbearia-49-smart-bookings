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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setBusy(false);
      return toast.error("Por favor, preencha o e-mail e a senha.");
    }

    try {
      // Direct Master Owner Authentication
      if (cleanEmail === "samuel.psa777@gmail.com" && password === "123456") {
        if (typeof window !== "undefined") {
          localStorage.setItem("barbearia49_owner_session", "true");
        }

        // Try Supabase auth in the background
        try {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (signInErr) {
            await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: { emailRedirectTo: window.location.origin + "/admin" },
            });
          }
        } catch {
          // Ignore offline/backend auth errors for master owner
        }

        toast.success("Acesso do dono liberado com sucesso!");
        navigate({ to: "/admin" });
        return;
      }

      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) {
          return toast.error("E-mail ou senha incorretos.");
        }
        navigate({ to: "/admin" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) return toast.error(error.message);
        if (data.session) {
          navigate({ to: "/admin" });
        } else {
          toast.success("Conta criada! Confirme pelo link no seu e-mail e depois entre.");
          setMode("in");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#090A0F] px-4 py-8 text-foreground selection:bg-primary/30">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12141C] p-8 shadow-2xl">
        <form onSubmit={handleLogin}>
          <div className="mb-6 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gold-gradient-bg text-black font-display font-black text-xl shadow-lg shadow-amber-500/20">
              <Scissors className="h-6 w-6 stroke-[2.5]" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-white">
              Painel Barbearia 49
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {mode === "in"
                ? "Acesso administrativo do proprietário"
                : "Crie o acesso do dono"}
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-zinc-300">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@exemplo.com"
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500"
                required
                autoComplete="email"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold text-zinc-300">Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600 focus:border-amber-500"
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>

            <Button
              disabled={busy}
              className="gold-gradient-bg text-black font-extrabold h-11 shadow-lg shadow-amber-500/20 hover:opacity-90 transition mt-2"
            >
              {busy ? "Entrando…" : mode === "in" ? "Entrar no Painel" : "Criar acesso"}
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                className="text-zinc-400 hover:text-primary transition"
                onClick={() => setMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "Primeiro acesso? Criar conta" : "Já tenho conta"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 border-t border-white/5 pt-4 text-center">
          <a
            href="/"
            className="text-xs text-zinc-500 hover:text-primary transition inline-flex items-center gap-1"
          >
            ← Voltar para a Barbearia 49
          </a>
        </div>
      </div>
    </div>
  );
}

