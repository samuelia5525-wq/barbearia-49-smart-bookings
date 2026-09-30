import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAppointments, STATUS_LABEL, type AdminAppt } from "@/lib/admin-data";
import { addDays, formatBRL, formatDateLong, formatPhone, formatTime, isoAt, spParts, todaySP, waLink, weekdayOf } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  return s === "completed" ? "border-success/70 bg-success/15" : s === "cancelled" ? "border-border bg-muted/40 line-through opacity-50" : s === "no_show" ? "border-destructive/60 bg-destructive/15" : "border-primary/70 bg-primary/15";
}

export function reminderText(a: AdminAppt) {
  const n = a.profiles?.nickname || a.profiles?.name.split(" ")[0] || "";
  return `Fala ${n}! Aqui é o Isac da Barbearia 49 ✂️\nPassando pra lembrar do seu horário: ${a.service_name}, ${formatDateLong(spParts(a.starts_at).date)} às ${formatTime(a.starts_at)}.\nTe espero! Se precisar remarcar, é só avisar.`;
}

function AgendaPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(todaySP());
  const [sel, setSel] = useState<AdminAppt | null>(null);
  const qc = useQueryClient();
  const { from, days } = rangeFor(view, anchor);
  const q = useQuery({
    queryKey: ["admin-appts", from, days],
    queryFn: () => fetchAppointments(isoAt(from, 0), isoAt(addDays(from, days), 0)),
    refetchInterval: 30_000,
  });
  const blocks = useQuery({
    queryKey: ["admin-blocks", from, days],
    queryFn: async () => (await supabase.from("blocks").select("*").gte("date", from).lt("date", addDays(from, days))).data ?? [],
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
      ? new Date(anchor + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "day"
        ? formatDateLong(anchor)
        : `${from.slice(8)}/${from.slice(5, 7)} – ${addDays(from, 6).slice(8)}/${addDays(from, 6).slice(5, 7)}`;

  const today = todaySP();
  const todayList = (byDate[today] ?? []).filter((a) => a.status === "confirmed");

  const update = async (a: AdminAppt, status: string) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) return toast.error("Não foi possível atualizar.");
    if (status === "cancelled") {
      await supabase.from("waitlist").update({ status: "notified" }).eq("date", spParts(a.starts_at).date).eq("status", "waiting");
    }
    toast.success(STATUS_LABEL[status]);
    setSel(null);
    qc.invalidateQueries({ queryKey: ["admin-appts"] });
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(todaySP())}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <h1 className="ml-2 text-xl font-bold capitalize md:text-2xl">{title}</h1>
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1.5 text-sm", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-border text-xs">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="border-b border-border bg-card p-2 text-center font-semibold text-muted-foreground">{d}</div>)}
          {Array.from({ length: 42 }, (_, i) => {
            const d = addDays(from, i);
            const list = (byDate[d] ?? []).filter((a) => a.status !== "cancelled");
            const inMonth = d.slice(0, 7) === anchor.slice(0, 7);
            return (
              <button key={d} onClick={() => { setAnchor(d); setView("day"); }} className={cn("min-h-24 border-b border-r border-border p-1.5 text-left hover:bg-accent/40", !inMonth && "opacity-40")}>
                <span className={cn("inline-grid h-6 w-6 place-items-center rounded-full", d === today && "bg-primary text-primary-foreground")}>{Number(d.slice(8))}</span>
                {blocks.data?.some((b) => b.date === d) && <div className="mt-0.5 truncate rounded bg-muted px-1 text-[10px]">Bloqueio</div>}
                {list.slice(0, 3).map((a) => (
                  <div key={a.id} className="mt-0.5 truncate rounded bg-primary/20 px-1 text-[10px]">{formatTime(a.starts_at)} {a.profiles?.nickname || a.profiles?.name}</div>
                ))}
                {list.length > 3 && <div className="mt-0.5 text-[10px] text-muted-foreground">+{list.length - 3}</div>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div className={cn("grid", view === "week" ? "min-w-[760px] grid-cols-[52px_repeat(7,1fr)]" : "grid-cols-[52px_1fr]")}>
            <div className="border-b border-border" />
            {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => (
              <div key={d} className="border-b border-l border-border p-2 text-center">
                <div className="text-[11px] uppercase text-muted-foreground">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][weekdayOf(d)]}</div>
                <div className={cn("mx-auto grid h-8 w-8 place-items-center rounded-full font-display text-lg font-bold", d === today && "bg-primary text-primary-foreground")}>{Number(d.slice(8))}</div>
              </div>
            ))}
            <div className="relative" style={{ height: (END_H - START_H) * 60 * PX }}>
              {Array.from({ length: END_H - START_H }, (_, h) => (
                <div key={h} className="absolute right-1 -translate-y-2 text-[10px] text-muted-foreground" style={{ top: h * 60 * PX }}>{String(START_H + h).padStart(2, "0")}:00</div>
              ))}
            </div>
            {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => (
              <div key={d} className="relative border-l border-border" style={{ height: (END_H - START_H) * 60 * PX }}>
                {Array.from({ length: END_H - START_H }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: h * 60 * PX }} />)}
                {blocks.data?.filter((b) => b.date === d).map((b) => {
                  const s = b.start_time ? Number(b.start_time.slice(0, 2)) * 60 + Number(b.start_time.slice(3, 5)) : START_H * 60;
                  const e = b.end_time ? Number(b.end_time.slice(0, 2)) * 60 + Number(b.end_time.slice(3, 5)) : END_H * 60;
                  return <div key={b.id} className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_12px)] p-1 text-[10px] text-muted-foreground" style={{ top: (s - START_H * 60) * PX, height: (e - s) * PX }}>{b.reason}</div>;
                })}
                {d === today && (() => { const m = spParts(Date.now()).min; return m > START_H * 60 && m < END_H * 60 ? <div className="absolute inset-x-0 z-10 h-0.5 bg-destructive" style={{ top: (m - START_H * 60) * PX }} /> : null; })()}
                {(byDate[d] ?? []).map((a) => {
                  const s = spParts(a.starts_at).min;
                  const dur = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
                  return (
                    <button key={a.id} onClick={() => setSel(a)} className={cn("absolute inset-x-1 z-[5] overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight", statusColor(a.status))} style={{ top: (s - START_H * 60) * PX, height: Math.max(dur * PX - 2, 18) }}>
                      <div className="font-semibold">{formatTime(a.starts_at)} · {a.profiles?.nickname || a.profiles?.name}</div>
                      <div className="truncate text-muted-foreground">{a.service_name}</div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Hoje · {todayList.length} confirmados</h2>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {todayList.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum horário confirmado para hoje.</p>}
          {todayList.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-4">
                <span className="font-display text-2xl font-bold text-primary">{formatTime(a.starts_at)}</span>
                <div>
                  <p className="font-semibold">{a.profiles?.name}{a.profiles?.nickname ? ` (${a.profiles.nickname})` : ""}</p>
                  <p className="text-xs text-muted-foreground">{a.service_name} · {formatPhone(a.profiles?.phone ?? "")}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={waLink(a.profiles?.phone ?? "", reminderText(a))} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> Lembrete</a>
                </Button>
                <Button size="sm" onClick={() => update(a, "completed")}>Concluir</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {sel && (
        <Dialog open onOpenChange={(o) => !o && setSel(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{sel.profiles?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-1 text-sm">
              <p><span className="text-muted-foreground">Serviço:</span> {sel.service_name} · {sel.is_free ? "Grátis (fidelidade)" : formatBRL(sel.price)}</p>
              <p className="capitalize"><span className="text-muted-foreground normal-case">Quando:</span> {formatDateLong(spParts(sel.starts_at).date)} às {formatTime(sel.starts_at)}</p>
              <p><span className="text-muted-foreground">Celular:</span> {formatPhone(sel.profiles?.phone ?? "")}</p>
              <p><span className="text-muted-foreground">Status:</span> {STATUS_LABEL[sel.status]}</p>
              {sel.profiles?.preferences && <p><span className="text-muted-foreground">Preferências:</span> {sel.profiles.preferences}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" asChild className="col-span-2">
                <a href={waLink(sel.profiles?.phone ?? "", reminderText(sel))} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" /> Enviar lembrete no WhatsApp</a>
              </Button>
              {sel.status !== "completed" && <Button onClick={() => update(sel, "completed")}>Concluído</Button>}
              {sel.status !== "no_show" && <Button variant="outline" onClick={() => update(sel, "no_show")}>Não compareceu</Button>}
              {sel.status !== "cancelled" && <Button variant="destructive" onClick={() => update(sel, "cancelled")}>Cancelar</Button>}
              {sel.status !== "confirmed" && <Button variant="ghost" onClick={() => update(sel, "confirmed")}>Voltar p/ confirmado</Button>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
