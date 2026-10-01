import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User,
  Scissors,
  Check,
  X,
  AlertCircle,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAppointments, STATUS_LABEL, type AdminAppt } from "@/lib/admin-data";
import {
  addDays,
  formatBRL,
  formatDateLong,
  formatPhone,
  formatTime,
  isoAt,
  normalizePhone,
  spParts,
  todaySP,
  toMin,
  waLink,
  weekdayOf,
} from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AgendaPage,
});

type View = "day" | "week" | "month";
const START_H = 7;
const END_H = 22;
const PX = 1.1; // px per minute

function rangeFor(view: View, anchor: string) {
  if (view === "day") return { from: anchor, days: 1 };
  if (view === "week") return { from: addDays(anchor, -weekdayOf(anchor)), days: 7 };
  const first = anchor.slice(0, 8) + "01";
  const start = addDays(first, -weekdayOf(first));
  return { from: start, days: 42 };
}

function statusColor(s: string) {
  return s === "completed"
    ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-400"
    : s === "cancelled"
    ? "border-border bg-muted/40 line-through opacity-50 text-muted-foreground"
    : s === "no_show"
    ? "border-rose-500/70 bg-rose-500/15 text-rose-400"
    : "border-primary/70 bg-primary/15 text-primary";
}

export function reminderText(a: AdminAppt) {
  const n = a.profiles?.nickname || a.profiles?.name.split(" ")[0] || "";
  return `Fala ${n}! Aqui é o Isac da Barbearia 49 ✂️\nPassando pra lembrar do seu horário: ${a.service_name}, ${formatDateLong(spParts(a.starts_at).date)} às ${formatTime(a.starts_at)}.\nTe espero! Se precisar remarcar, é só avisar.`;
}

function AgendaPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(todaySP());
  const [sel, setSel] = useState<AdminAppt | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);

  // Manual booking state
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualServiceId, setManualServiceId] = useState("");
  const [manualDate, setManualDate] = useState(todaySP());
  const [manualTime, setManualTime] = useState("10:00");
  const [savingManual, setSavingManual] = useState(false);

  const qc = useQueryClient();
  const { from, days } = rangeFor(view, anchor);

  const q = useQuery({
    queryKey: ["admin-appts", from, days],
    queryFn: () => fetchAppointments(isoAt(from, 0), isoAt(addDays(from, days), 0)),
    refetchInterval: 10_000,
  });

  // Real-time synchronization with Supabase and active tabs
  useEffect(() => {
    // 1. Supabase Postgres Realtime Subscription
    const channel = supabase
      .channel("admin-realtime-appointments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin-appts"] });
          if (payload.eventType === "INSERT") {
            toast.success("Novo agendamento recebido em tempo real!");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocks" },
        () => {
          qc.invalidateQueries({ queryKey: ["admin-blocks"] });
        }
      )
      .subscribe();

    // 2. Broadcast Channel for instant cross-tab sync
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("barbearia49-sync");
      bc.onmessage = (ev) => {
        if (ev.data?.type === "NEW_APPOINTMENT") {
          qc.invalidateQueries({ queryKey: ["admin-appts"] });
          toast.success(
            `Novo agendamento: ${ev.data.client || "Cliente"} - ${ev.data.service || "Corte"}`
          );
        }
      };
    } catch {
      // ignore if BroadcastChannel is unsupported
    }

    return () => {
      supabase.removeChannel(channel);
      bc?.close();
    };
  }, [qc]);

  const blocks = useQuery({
    queryKey: ["admin-blocks", from, days],
    queryFn: async () =>
      (await supabase.from("blocks").select("*").gte("date", from).lt("date", addDays(from, days)))
        .data ?? [],
  });

  const servicesQuery = useQuery({
    queryKey: ["admin-active-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id,name,price,duration_min")
        .eq("active", true)
        .order("sort");
      return data ?? [];
    },
  });

  const byDate = useMemo(() => {
    const m: Record<string, AdminAppt[]> = {};
    for (const a of q.data ?? []) (m[spParts(a.starts_at).date] ??= []).push(a);
    return m;
  }, [q.data]);

  const shift = (dir: number) => {
    if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "week") setAnchor(addDays(anchor, 7 * dir));
    else {
      const d = new Date(anchor.slice(0, 8) + "15T12:00:00Z");
      d.setUTCMonth(d.getUTCMonth() + dir);
      setAnchor(d.toISOString().slice(0, 10));
    }
  };

  const title =
    view === "month"
      ? new Date(anchor + "T12:00:00Z").toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : view === "day"
      ? formatDateLong(anchor)
      : `${from.slice(8)}/${from.slice(5, 7)} – ${addDays(from, 6).slice(8)}/${addDays(from, 6).slice(5, 7)}`;

  const today = todaySP();
  const todayList = (byDate[today] ?? []).filter((a) => a.status === "confirmed");

  const update = async (a: AdminAppt, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) return toast.error("Não foi possível atualizar.");
    if (status === "cancelled") {
      await supabase
        .from("waitlist")
        .update({ status: "notified" })
        .eq("date", spParts(a.starts_at).date)
        .eq("status", "waiting");
    }
    toast.success(STATUS_LABEL[status] || "Atualizado!");
    setSel(null);
    qc.invalidateQueries({ queryKey: ["admin-appts"] });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = normalizePhone(manualPhone);
    if (p.length < 10) return toast.error("Informe o celular com DDD.");
    if (!manualServiceId) return toast.error("Selecione um serviço.");

    const selectedService = servicesQuery.data?.find((s) => s.id === manualServiceId);
    if (!selectedService) return toast.error("Serviço inválido.");

    setSavingManual(true);
    try {
      // Find or create profile
      let clientId: string;
      const { data: existingProf } = await supabase
        .from("profiles")
        .select("id")
        .eq("phone", p)
        .maybeSingle();

      if (existingProf) {
        clientId = existingProf.id;
      } else {
        const { data: newProf, error: profErr } = await supabase
          .from("profiles")
          .insert({
            name: manualName.trim(),
            phone: p,
            role: "client",
          })
          .select("id")
          .single();
        if (profErr) throw profErr;
        clientId = newProf.id;
        await supabase.from("loyalty").insert({ client_id: clientId });
      }

      const startMin = toMin(manualTime);
      const startsAt = isoAt(manualDate, startMin);
      const endsAt = isoAt(manualDate, startMin + selectedService.duration_min);

      const { error: apptErr } = await supabase.from("appointments").insert({
        client_id: clientId,
        service_id: selectedService.id,
        service_name: selectedService.name,
        starts_at: startsAt,
        ends_at: endsAt,
        price: selectedService.price,
        status: "confirmed",
      });

      if (apptErr) throw apptErr;

      toast.success("Agendamento criado com sucesso!");
      setNewModalOpen(false);
      setManualName("");
      setManualPhone("");
      qc.invalidateQueries({ queryKey: ["admin-appts"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao agendar horário.");
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(todaySP())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h1 className="ml-2 text-xl font-bold capitalize md:text-2xl">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setNewModalOpen(true)} className="gap-1.5 shadow">
            <Plus className="h-4 w-4" /> Novo Agendamento
          </Button>

          <div className="flex rounded-lg border border-border p-0.5">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  view === v ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {view === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div
              key={d}
              className="border-b border-border bg-card p-2 text-center font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const d = addDays(from, i);
            const list = (byDate[d] ?? []).filter((a) => a.status !== "cancelled");
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            return (
              <button
                key={d}
                onClick={() => {
                  setAnchor(d);
                  setView("day");
                }}
                className={cn(
                  "min-h-24 border-b border-r border-border p-1.5 text-left hover:bg-accent/40",
                  !inMonth && "opacity-40"
                )}
              >
                <span
                  className={cn(
                    "inline-grid h-6 w-6 place-items-center rounded-full",
                    d === today && "bg-primary text-primary-foreground font-bold"
                  )}
                >
                  {Number(d.slice(8))}
                </span>
                {blocks.data?.some((b) => b.date === d) && (
                  <div className="mt-0.5 truncate rounded bg-amber-500/20 px-1 text-[10px] text-amber-400">
                    Bloqueio
                  </div>
                )}
                {list.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    className="mt-0.5 truncate rounded bg-primary/20 px-1 text-[10px] text-foreground font-medium"
                  >
                    {formatTime(a.starts_at)} {a.profiles?.nickname || a.profiles?.name}
                  </div>
                ))}
                {list.length > 3 && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">+{list.length - 3} mais</div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div
            className={cn(
              "grid",
              view === "week"
                ? "min-w-[760px] grid-cols-[52px_repeat(7,1fr)]"
                : "grid-cols-[52px_1fr]"
            )}
          >
            <div className="border-b border-border" />
            {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => (
              <div key={d} className="border-b border-l border-border p-2 text-center">
                <div className="text-[11px] uppercase text-muted-foreground font-semibold">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][weekdayOf(d)]}
                </div>
                <div
                  className={cn(
                    "mx-auto grid h-8 w-8 place-items-center rounded-full font-display text-lg font-bold",
                    d === today && "bg-primary text-primary-foreground"
                  )}
                >
                  {Number(d.slice(8))}
                </div>
              </div>
            ))}
            <div className="relative" style={{ height: (END_H - START_H) * 60 * PX }}>
              {Array.from({ length: END_H - START_H }, (_, h) => (
                <div
                  key={h}
                  className="absolute right-1 -translate-y-2 text-[10px] font-mono text-muted-foreground"
                  style={{ top: h * 60 * PX }}
                >
                  {String(START_H + h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => (
              <div
                key={d}
                className="relative border-l border-border"
                style={{ height: (END_H - START_H) * 60 * PX }}
              >
                {Array.from({ length: END_H - START_H }, (_, h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: h * 60 * PX }}
                  />
                ))}
                {blocks.data
                  ?.filter((b) => b.date === d)
                  .map((b) => {
                    const s = b.start_time
                      ? Number(b.start_time.slice(0, 2)) * 60 + Number(b.start_time.slice(3, 5))
                      : START_H * 60;
                    const e = b.end_time
                      ? Number(b.end_time.slice(0, 2)) * 60 + Number(b.end_time.slice(3, 5))
                      : END_H * 60;
                    return (
                      <div
                        key={b.id}
                        className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(245,158,11,0.1)_6px,rgba(245,158,11,0.1)_12px)] p-1 text-[10px] font-semibold text-amber-500"
                        style={{ top: (s - START_H * 60) * PX, height: (e - s) * PX }}
                      >
                        {b.reason}
                      </div>
                    );
                  })}
                {d === today &&
                  (() => {
                    const m = spParts(Date.now()).min;
                    return m > START_H * 60 && m < END_H * 60 ? (
                      <div
                        className="absolute inset-x-0 z-10 h-0.5 bg-destructive shadow"
                        style={{ top: (m - START_H * 60) * PX }}
                      />
                    ) : null;
                  })()}
                {(byDate[d] ?? []).map((a) => {
                  const s = spParts(a.starts_at).min;
                  const dur = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSel(a)}
                      className={cn(
                        "absolute inset-x-1 z-[5] overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight transition hover:scale-[1.01]",
                        statusColor(a.status)
                      )}
                      style={{
                        top: (s - START_H * 60) * PX,
                        height: Math.max(dur * PX - 2, 20),
                      }}
                    >
                      <div className="font-semibold truncate">
                        {formatTime(a.starts_at)} · {a.profiles?.nickname || a.profiles?.name}
                      </div>
                      <div className="truncate text-[10px] opacity-80">{a.service_name}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hoje: Confirmados */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Hoje · {todayList.length} atendimentos confirmados</h2>
          <span className="text-xs text-muted-foreground capitalize">{formatDateLong(today)}</span>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {todayList.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum agendamento confirmado para hoje até o momento.
            </p>
          )}
          {todayList.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-4">
                <span className="font-display text-2xl font-bold text-primary">
                  {formatTime(a.starts_at)}
                </span>
                <div>
                  <p className="font-semibold text-base">
                    {a.profiles?.name}
                    {a.profiles?.nickname ? ` (${a.profiles.nickname})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.service_name} · {formatPhone(a.profiles?.phone ?? "")}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild className="text-xs">
                  <a href={waLink(a.profiles?.phone ?? "", reminderText(a))} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1 h-3.5 w-3.5 text-emerald-500" /> Lembrar
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="text-xs text-rose-500 hover:bg-rose-500/10" onClick={() => update(a, "no_show")}>
                  Não veio
                </Button>
                <Button size="sm" className="text-xs" onClick={() => update(a, "completed")}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Concluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modal: Appointment Detail & Actions */}
      {sel && (
        <Dialog open onOpenChange={(o) => !o && setSel(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{sel.profiles?.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">Serviço:</span>{" "}
                <strong className="text-foreground">{sel.service_name}</strong> ·{" "}
                {sel.is_free ? "Grátis (fidelidade 🎁)" : formatBRL(sel.price)}
              </p>
              <p className="capitalize">
                <span className="text-muted-foreground normal-case">Quando:</span>{" "}
                {formatDateLong(spParts(sel.starts_at).date)} às {formatTime(sel.starts_at)}
              </p>
              <p>
                <span className="text-muted-foreground">Celular:</span>{" "}
                {formatPhone(sel.profiles?.phone ?? "")}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span>{" "}
                <strong className="text-foreground">{STATUS_LABEL[sel.status]}</strong>
              </p>
              {sel.profiles?.preferences && (
                <div className="rounded-lg border border-border bg-card/60 p-3 mt-1 text-xs">
                  <span className="font-semibold text-muted-foreground block mb-0.5">
                    Preferências salvas:
                  </span>
                  {sel.profiles.preferences}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button variant="outline" asChild className="col-span-2">
                <a
                  href={waLink(sel.profiles?.phone ?? "", reminderText(sel))}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="mr-1.5 h-4 w-4 text-emerald-500" />
                  Enviar lembrete no WhatsApp
                </a>
              </Button>
              {sel.status !== "completed" && (
                <Button onClick={() => update(sel, "completed")}>Concluído</Button>
              )}
              {sel.status !== "no_show" && (
                <Button variant="outline" onClick={() => update(sel, "no_show")}>
                  Não compareceu
                </Button>
              )}
              {sel.status !== "cancelled" && (
                <Button variant="destructive" onClick={() => update(sel, "cancelled")}>
                  Cancelar
                </Button>
              )}
              {sel.status !== "confirmed" && (
                <Button variant="ghost" onClick={() => update(sel, "confirmed")}>
                  Voltar para Confirmado
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal: Novo Agendamento Manual */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Agendamento Manual</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleManualSubmit} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="m-name">Nome do Cliente *</Label>
              <Input
                id="m-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ex: Carlos Silva"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="m-phone">Celular com DDD *</Label>
              <Input
                id="m-phone"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="(11) 98765-4321"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Serviço *</Label>
              <Select value={manualServiceId} onValueChange={setManualServiceId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o serviço" />
                </SelectTrigger>
                <SelectContent>
                  {servicesQuery.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration_min} min) — {formatBRL(Number(s.price))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="m-date">Data *</Label>
                <Input
                  id="m-date"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="m-time">Horário *</Label>
                <Input
                  id="m-time"
                  type="time"
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewModalOpen(false)}
                disabled={savingManual}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingManual}>
                {savingManual ? "Salvando…" : "Agendar Horário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
