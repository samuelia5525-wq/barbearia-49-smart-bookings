import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, CalendarClock, Gift, LogOut, Star, X } from "lucide-react";
import { cancelAppointment, getClientArea, getRescheduleSlots, rateAppointment, rescheduleAppointment, updatePreferences } from "@/lib/booking.functions";
import { clearClient, loadClient, saveClient } from "@/lib/client-session";
import { formatBRL, formatDateLong, formatDateShort, formatTime, normalizePhone, spParts } from "@/lib/time";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DateStrip } from "@/components/site/DateStrip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Meus cortes — Barbearia 49" },
      { name: "description", content: "Veja seus agendamentos, histórico de cortes, fidelidade e avalie seu atendimento." },
      { property: "og:title", content: "Meus cortes — Barbearia 49" },
      { property: "og:description", content: "Área do cliente da Barbearia 49: histórico, fidelidade e remarcação." },
    ],
  }),
  component: ClientArea,
});

const STATUS: Record<string, string> = { confirmed: "Confirmado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };

function ClientArea() {
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setPhone(loadClient()?.phone ?? null);
    setReady(true);
  }, []);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {!ready ? null : phone ? <Dashboard phone={phone} onExit={() => { clearClient(); setPhone(null); }} /> : <Enter onEnter={setPhone} />}
      </main>
    </div>
  );
}

function Enter({ onEnter }: { onEnter: (p: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <form
      className="mx-auto max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const p = normalizePhone(phone);
        if (p.length < 10) return toast.error("Informe o celular com DDD.");
        saveClient({ name, phone: p });
        onEnter(p);
      }}
    >
      <h1 className="text-3xl font-bold">Meus cortes</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Entre com seu nome e celular. Sem senha.</p>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>Nome ou apelido</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="grid gap-2"><Label>Celular com DDD</Label><Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        <Button size="lg">Entrar</Button>
      </div>
    </form>
  );
}

function Dashboard({ phone, onExit }: { phone: string; onExit: () => void }) {
  const fetchArea = useServerFn(getClientArea);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["client-area", phone], queryFn: () => fetchArea({ data: { phone } }) });
  const cancel = useServerFn(cancelAppointment);
  const savePrefs = useServerFn(updatePreferences);
  const [prefs, setPrefs] = useState("");
  const [resched, setResched] = useState<string | null>(null);
  const [rating, setRating] = useState<string | null>(null);
  useEffect(() => {
    if (q.data?.found) setPrefs(q.data.profile.preferences ?? "");
  }, [q.data]);

  if (q.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (!q.data?.found)
    return (
      <div className="text-center">
        <p>Ainda não encontramos agendamentos para este celular.</p>
        <Button variant="link" onClick={onExit}>Usar outro número</Button>
      </div>
    );
  const { profile, appointments, loyalty, waitlist } = q.data;
  const now = Date.now();
  const upcoming = appointments.filter((a) => a.status === "confirmed" && new Date(a.starts_at).getTime() > now).reverse();
  const history = appointments.filter((a) => !upcoming.includes(a));
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-area", phone] });

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá,</p>
          <h1 className="text-3xl font-bold">{profile.nickname || profile.name}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onExit}><LogOut className="mr-1 h-4 w-4" /> Sair</Button>
      </div>

      {waitlist.some((w) => w.status === "notified") && (
        <div className="flex items-start gap-3 rounded-xl border border-primary bg-primary/10 p-4">
          <Bell className="mt-0.5 h-5 w-5 text-primary" />
          <div className="text-sm">
            <p className="font-semibold">Liberou horário!</p>
            <p className="text-muted-foreground">Um horário abriu em {waitlist.filter((w) => w.status === "notified").map((w) => formatDateShort(w.date)).join(", ")}. Corra para agendar.</p>
            <Button size="sm" className="mt-2" asChild><a href="/">Agendar agora</a></Button>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Gift className="h-5 w-5 text-primary" /> Fidelidade</h2>
          <span className="text-sm text-muted-foreground">{loyalty.total_cuts} cortes no total</span>
        </div>
        <div className="mt-4 grid grid-cols-10 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={cn("aspect-square rounded-full border", i < Math.min(loyalty.points, 10) ? "border-primary bg-primary" : "border-border")} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {loyalty.points >= 10 ? "🎁 Você ganhou um corte grátis! Avise o Isac no próximo atendimento." : `Faltam ${10 - loyalty.points} cortes para o próximo grátis.`}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Próximos</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento. <a href="/" className="text-primary underline">Agendar agora</a></p>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((a) => (
              <div key={a.id} className="rounded-xl border border-primary/50 bg-card p-4">
                <p className="font-semibold">{a.service_name}</p>
                <p className="text-sm capitalize text-muted-foreground">{formatDateLong(spParts(a.starts_at).date)} às {formatTime(a.starts_at)}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setResched(a.id)}><CalendarClock className="mr-1 h-4 w-4" /> Remarcar</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!confirm("Cancelar este agendamento?")) return;
                      const r = await cancel({ data: { id: a.id, phone } });
                      r.ok ? toast.success("Agendamento cancelado.") : toast.error(r.error);
                      refresh();
                    }}
                  >
                    <X className="mr-1 h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Histórico</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {history.length === 0 && <p className="p-4 text-sm text-muted-foreground">Sem histórico ainda.</p>}
          {history.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{a.service_name}</p>
                <p className="text-xs text-muted-foreground">{formatDateShort(spParts(a.starts_at).date)} · {STATUS[a.status]} · {a.is_free ? "Grátis" : formatBRL(a.price)}</p>
              </div>
              {a.status === "completed" && (a.rating ? (
                <span className="flex items-center gap-0.5 text-primary">{Array.from({ length: a.rating }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setRating(a.id)}>Avaliar</Button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-lg font-bold">Minhas preferências</h2>
        <Textarea value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder="Ex.: máquina 2 nas laterais, risco do lado esquerdo, sem gel" />
        <Button size="sm" className="mt-3" onClick={async () => { await savePrefs({ data: { phone, preferences: prefs } }); toast.success("Preferências salvas."); }}>Salvar</Button>
      </section>

      {resched && <RescheduleDialog id={resched} phone={phone} onClose={() => { setResched(null); refresh(); }} />}
      {rating && <RateDialog id={rating} phone={phone} onClose={() => { setRating(null); refresh(); }} />}
    </div>
  );
}

function RescheduleDialog({ id, phone, onClose }: { id: string; phone: string; onClose: () => void }) {
  const [date, setDate] = useState<string | null>(null);
  const fetchSlots = useServerFn(getRescheduleSlots);
  const doIt = useServerFn(rescheduleAppointment);
  const slots = useQuery({ queryKey: ["resched", id, date], enabled: !!date, queryFn: () => fetchSlots({ data: { id, phone, date: date! } }) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Remarcar</DialogTitle></DialogHeader>
        <DateStrip value={date} onChange={setDate} days={21} />
        {date && (slots.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : slots.data?.slots.length ? (
          <div className="grid grid-cols-4 gap-2">
            {slots.data.slots.map((t) => (
              <button key={t} className="rounded-lg border border-border py-2 text-sm font-semibold hover:border-primary" onClick={async () => {
                const r = await doIt({ data: { id, phone, date, time: t } });
                if (r.ok) { toast.success("Remarcado!"); onClose(); } else toast.error(r.error);
              }}>{t}</button>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">{slots.data?.reason}</p>)}
      </DialogContent>
    </Dialog>
  );
}

function RateDialog({ id, phone, onClose }: { id: string; phone: string; onClose: () => void }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const rate = useServerFn(rateAppointment);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Como foi seu atendimento?</DialogTitle></DialogHeader>
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setStars(s)}><Star className={cn("h-9 w-9", s <= stars ? "fill-primary text-primary" : "text-muted-foreground")} /></button>
          ))}
        </div>
        <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (opcional)" />
        <Button onClick={async () => {
          const r = await rate({ data: { id, phone, stars, comment } });
          r.ok ? toast.success("Obrigado pela avaliação!") : toast.error(r.error);
          onClose();
        }}>Enviar avaliação</Button>
      </DialogContent>
    </Dialog>
  );
}
