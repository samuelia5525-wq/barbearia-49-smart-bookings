import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CalendarClock,
  Gift,
  LogOut,
  Scissors,
  Star,
  X,
  Clock,
  Sparkles,
  CheckCircle,
  MessageCircle,
} from "lucide-react";
import {
  cancelAppointment,
  getClientArea,
  getRescheduleSlots,
  rateAppointment,
  rescheduleAppointment,
  updatePreferences,
} from "@/lib/booking.functions";
import { clearClient, loadClient, saveClient } from "@/lib/client-session";
import {
  formatBRL,
  formatDateLong,
  formatDateShort,
  formatPhone,
  formatTime,
  normalizePhone,
  spParts,
  waLink,
  BARBER_WHATSAPP,
} from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Meus Cortes & Fidelidade — Barbearia 49" },
      {
        name: "description",
        content: "Acompanhe seus agendamentos, cartão fidelidade e avalie seus cortes.",
      },
    ],
  }),
  component: ClientArea,
});

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmado", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  completed: { label: "Concluído", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  cancelled: { label: "Cancelado", color: "text-zinc-500 border-white/10 bg-white/5 line-through" },
  no_show: { label: "Não Compareceu", color: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
};

function ClientArea() {
  const [phone, setPhone] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPhone(loadClient()?.phone ?? null);
    setReady(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#090A0F] text-foreground pb-20 selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090A0F]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl gold-gradient-bg text-black font-display font-black text-lg shadow-lg shadow-amber-500/20">
              49
            </span>
            <span className="font-display font-bold text-base tracking-tight text-white">
              Barbearia <span className="text-primary">49</span>
            </span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 rounded-full border-white/10 bg-white/[0.04] text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          >
            <Link to="/">
              <Scissors className="h-3.5 w-3.5 mr-1 text-primary" /> Agendar Novo
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {!ready ? null : phone ? (
          <Dashboard phone={phone} onExit={() => { clearClient(); setPhone(null); }} />
        ) : (
          <EnterPhone onEnter={setPhone} />
        )}
      </main>
    </div>
  );
}

function EnterPhone({ onEnter }: { onEnter: (p: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <form
      className="mx-auto max-w-sm rounded-3xl border border-white/[0.08] bg-[#12141C] p-6 sm:p-8 space-y-5 shadow-2xl mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        const p = normalizePhone(phone);
        if (p.length < 10) return toast.error("Informe o celular com DDD.");
        saveClient({ name, phone: p });
        onEnter(p);
      }}
    >
      <div className="text-center space-y-1">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
          <Scissors className="h-6 w-6" />
        </span>
        <h1 className="font-display text-2xl font-extrabold text-white">Meus Cortes</h1>
        <p className="text-xs text-zinc-400">
          Consulte seu histórico, fidelidade e agendamentos. Sem senha.
        </p>
      </div>

      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-zinc-300">Seu Nome ou Apelido</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Rafael"
            required
            className="h-12 bg-black/40 border-white/10 text-sm rounded-xl focus:border-amber-500"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-zinc-300">Celular com DDD</Label>
          <Input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 98765-4321"
            required
            className="h-12 bg-black/40 border-white/10 text-sm font-mono rounded-xl focus:border-amber-500"
          />
        </div>

        <Button className="w-full h-12 text-sm font-extrabold gold-gradient-bg text-black shadow-xl shadow-amber-500/20 rounded-xl mt-2">
          Acessar Meus Cortes
        </Button>
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

  if (q.isLoading) {
    return (
      <div className="py-20 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-3">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Carregando seus agendamentos…</span>
      </div>
    );
  }

  if (!q.data?.found) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm text-zinc-400">Ainda não encontramos agendamentos para este celular.</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={onExit}>Usar outro número</Button>
          <Button size="sm" asChild className="gold-gradient-bg text-black font-bold">
            <Link to="/">Agendar Primeiro Corte</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { profile, appointments, loyalty, waitlist } = q.data;
  const now = Date.now();
  const upcoming = appointments.filter((a: any) => a.status === "confirmed" && new Date(a.starts_at).getTime() > now).reverse();
  const history = appointments.filter((a: any) => !upcoming.includes(a));
  const refresh = () => qc.invalidateQueries({ queryKey: ["client-area", phone] });

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#12141C] p-5 shadow-lg">
        <div>
          <p className="text-xs text-zinc-400">Área do Cliente</p>
          <h1 className="font-display text-2xl font-black text-white">
            {profile.nickname || profile.name}
          </h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">{formatPhone(profile.phone)}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="text-xs text-zinc-400 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5 mr-1" /> Sair
        </Button>
      </div>

      {/* Waitlist Alert */}
      {waitlist.some((w: any) => w.status === "notified") && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-lg shadow-amber-500/5">
          <Bell className="mt-0.5 h-5 w-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-amber-400 text-sm">Vaga Liberada na Barbearia!</p>
            <p className="text-zinc-300 mt-1">
              Um horário abriu na sua data de interesse. Aproveite antes que preencham!
            </p>
            <Button size="sm" className="mt-3 gold-gradient-bg text-black font-extrabold h-8 rounded-lg" asChild>
              <Link to="/">Agendar Agora</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Cartão Fidelidade VIP */}
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-br from-[#1A1813] via-[#12141C] to-[#0D0F14] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-amber-400" />
            <h2 className="font-display font-extrabold text-lg text-white">Cartão Fidelidade VIP</h2>
          </div>
          <Badge className="gold-gradient-bg text-black font-extrabold text-[10px]">
            {loyalty.total_cuts} CORTES TOTAIS
          </Badge>
        </div>

        {/* 10 Stamps Grid */}
        <div className="mt-5 grid grid-cols-5 sm:grid-cols-10 gap-2">
          {Array.from({ length: 10 }, (_, i) => {
            const isFilled = i < Math.min(loyalty.points, 10);
            return (
              <div
                key={i}
                className={cn(
                  "aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all",
                  isFilled
                    ? "border-amber-500/60 gold-gradient-bg text-black shadow-lg shadow-amber-500/25 ring-1 ring-amber-400 font-extrabold"
                    : "border-white/10 bg-black/40 text-zinc-600"
                )}
              >
                {isFilled ? (
                  <Scissors className="h-4 w-4" />
                ) : (
                  <span className="text-[11px] font-bold">{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-zinc-300 font-medium">
          {loyalty.points >= 10 ? (
            <span className="text-amber-400 font-bold">
              🎉 Parabéns! Você ganhou 1 corte grátis. Você pode resgatá-lo no seu próximo agendamento.
            </span>
          ) : (
            `Faltam apenas ${10 - loyalty.points} cortes para o seu próximo corte grátis!`
          )}
        </p>
      </section>

      {/* Próximos Agendamentos */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Próximos Horários
        </h2>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#12141C]/60 p-6 text-center text-xs text-zinc-400">
            Nenhum agendamento futuro no momento.{" "}
            <Link to="/" className="text-primary font-bold underline ml-1">
              Agendar agora
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((a: any) => (
              <div
                key={a.id}
                className="rounded-2xl border border-amber-500/40 bg-[#12141C] p-4 sm:p-5 shadow-lg flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-extrabold text-base text-white">
                      {a.service_name}
                    </span>
                    <Badge variant="outline" className="text-amber-400 border-amber-500/40 text-[10px]">
                      Confirmado
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-400 capitalize mt-1">
                    {formatDateLong(spParts(a.starts_at).date)} às{" "}
                    <strong className="text-white font-mono">{formatTime(a.starts_at)}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs border-white/10 hover:border-amber-500/50"
                    onClick={() => setResched(a.id)}
                  >
                    <CalendarClock className="h-3.5 w-3.5 mr-1 text-primary" /> Remarcar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 text-xs text-rose-400 hover:bg-rose-500/10"
                    onClick={async () => {
                      if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
                      const r = await cancel({ data: { id: a.id, phone } });
                      r.ok ? toast.success("Agendamento cancelado com sucesso.") : toast.error(r.error);
                      refresh();
                    }}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Histórico & Avaliações */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg text-white">Histórico de Cortes</h2>

        <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#12141C] overflow-hidden">
          {history.length === 0 ? (
            <p className="p-6 text-center text-xs text-zinc-500">Sem histórico de cortes anteriores.</p>
          ) : (
            history.map((a: any) => {
              const st = STATUS_MAP[a.status] || STATUS_MAP.completed;
              return (
                <div key={a.id} className="flex items-center justify-between p-4 text-xs">
                  <div>
                    <p className="font-bold text-white text-sm">{a.service_name}</p>
                    <p className="text-zinc-400 mt-0.5">
                      {formatDateShort(spParts(a.starts_at).date)} ·{" "}
                      <span className={st.color.split(" ")[0]}>{st.label}</span> ·{" "}
                      <span className="text-primary font-semibold">
                        {a.is_free ? "Grátis 🎁" : formatBRL(a.price)}
                      </span>
                    </p>
                  </div>

                  {a.status === "completed" && (
                    a.rating ? (
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: a.rating }, (_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-white/10 hover:border-amber-500/40"
                        onClick={() => setRating(a.id)}
                      >
                        Avaliar Corte
                      </Button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Minhas Preferências de Corte */}
      <section className="rounded-3xl border border-white/[0.08] bg-[#12141C] p-5 sm:p-6 space-y-3">
        <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Minhas Preferências de Estilo
        </h2>
        <p className="text-xs text-zinc-400">
          Deixe anotado como você gosta do seu corte para o Isac já saber antes de você sentar na cadeira.
        </p>
        <Textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          placeholder="Ex: Degradê navalhado 1.5 nas laterais, tesoura no topo sem diminuir muito o comprimento, barba alinhada quadrada..."
          rows={3}
          className="bg-black/40 border-white/10 text-xs rounded-xl focus:border-amber-500"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gold-gradient-bg text-black font-extrabold text-xs h-9 px-4 rounded-xl"
            onClick={async () => {
              await savePrefs({ data: { phone, preferences: prefs } });
              toast.success("Preferências salvas com sucesso!");
            }}
          >
            Salvar Preferências
          </Button>
        </div>
      </section>

      {/* Dialogs */}
      {resched && (
        <RescheduleDialog
          id={resched}
          phone={phone}
          onClose={() => {
            setResched(null);
            refresh();
          }}
        />
      )}

      {rating && (
        <RateDialog
          id={rating}
          phone={phone}
          onClose={() => {
            setRating(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function RescheduleDialog({ id, phone, onClose }: { id: string; phone: string; onClose: () => void }) {
  const [date, setDate] = useState<string | null>(null);
  const fetchSlots = useServerFn(getRescheduleSlots);
  const doIt = useServerFn(rescheduleAppointment);
  const slots = useQuery({
    queryKey: ["resched-slots", id, date],
    enabled: !!date,
    queryFn: () => fetchSlots({ data: { id, phone, date: date! } }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-[#12141C] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">Remarcar Horário</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-zinc-400">Selecione uma nova data e horário:</p>
          <Input
            type="date"
            min={todaySP()}
            value={date || ""}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 bg-black/40 border-white/10 text-sm rounded-xl"
          />

          {date && (
            <div>
              {slots.isLoading ? (
                <p className="text-xs text-zinc-400 text-center py-4">Verificando horários…</p>
              ) : slots.data?.slots.length ? (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pt-2">
                  {slots.data.slots.map((t) => (
                    <button
                      key={t}
                      className="rounded-xl border border-white/10 bg-black/40 py-2.5 text-xs font-bold hover:border-primary hover:text-primary transition"
                      onClick={async () => {
                        const r = await doIt({ data: { id, phone, date: date!, time: t } });
                        if (r.ok) {
                          toast.success("Horário remarcado!");
                          onClose();
                        } else {
                          toast.error(r.error);
                        }
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 text-center py-4">{slots.data?.reason}</p>
              )}
            </div>
          )}
        </div>
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
      <DialogContent className="max-w-md bg-[#12141C] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-center">
            Como foi seu atendimento com o Isac?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setStars(s)} className="p-1 transition transform active:scale-125">
                <Star
                  className={cn(
                    "h-8 w-8",
                    s <= stars ? "fill-amber-400 text-amber-400" : "text-zinc-600"
                  )}
                />
              </button>
            ))}
          </div>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deixe um comentário sobre o corte ou acabamento (opcional)..."
            rows={3}
            className="bg-black/40 border-white/10 text-xs rounded-xl focus:border-amber-500"
          />

          <Button
            className="w-full h-11 gold-gradient-bg text-black font-extrabold text-sm rounded-xl shadow-lg shadow-amber-500/20"
            onClick={async () => {
              const r = await rate({ data: { id, phone, stars, comment } });
              if (r.ok) {
                toast.success("Obrigado pela sua avaliação!");
              } else {
                toast.error(r.error);
              }
              onClose();
            }}
          >
            Enviar Avaliação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
