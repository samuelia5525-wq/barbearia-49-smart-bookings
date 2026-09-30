import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Clock, Calendar, Plus, Trash2, ShieldAlert, Check, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateLong, formatDateShort, todaySP, WEEKDAYS } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/horarios")({
  head: () => ({ meta: [{ title: "Horários e Bloqueios — Barbearia 49" }] }),
  component: HorariosPage,
});

type BusinessHour = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
};

type Block = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
};

function HorariosPage() {
  const qc = useQueryClient();
  const [blockModalOpen, setBlockModalOpen] = useState(false);

  // New Block State
  const [blockDate, setBlockDate] = useState(todaySP());
  const [isFullDay, setIsFullDay] = useState(true);
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("14:00");
  const [blockReason, setBlockReason] = useState("Folga");
  const [busy, setBusy] = useState(false);

  // Fetch Business Hours
  const { data: hours = [], isLoading: loadingHours } = useQuery({
    queryKey: ["admin-business-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .order("weekday", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BusinessHour[];
    },
  });

  // Fetch Blocks
  const { data: blocks = [], isLoading: loadingBlocks } = useQuery({
    queryKey: ["admin-blocks-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("*")
        .gte("date", todaySP())
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Block[];
    },
  });

  // Update a single weekday's hours
  const updateWeekday = async (weekday: number, updates: Partial<BusinessHour>) => {
    try {
      const { error } = await supabase
        .from("business_hours")
        .update(updates)
        .eq("weekday", weekday);
      if (error) throw error;
      toast.success("Horário atualizado.");
      qc.invalidateQueries({ queryKey: ["admin-business-hours"] });
      qc.invalidateQueries({ queryKey: ["public-hours"] });
    } catch {
      toast.error("Não foi possível salvar a alteração.");
    }
  };

  // Add a new block
  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDate) return toast.error("Selecione a data do bloqueio.");
    if (!blockReason.trim()) return toast.error("Informe o motivo.");

    setBusy(true);
    try {
      const { error } = await supabase.from("blocks").insert({
        date: blockDate,
        start_time: isFullDay ? null : blockStart,
        end_time: isFullDay ? null : blockEnd,
        reason: blockReason.trim(),
      });
      if (error) throw error;
      toast.success("Bloqueio adicionado à agenda.");
      setBlockModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-blocks-list"] });
      qc.invalidateQueries({ queryKey: ["admin-blocks"] });
    } catch {
      toast.error("Erro ao adicionar bloqueio.");
    } finally {
      setBusy(false);
    }
  };

  // Delete a block
  const handleDeleteBlock = async (id: string) => {
    try {
      const { error } = await supabase.from("blocks").delete().eq("id", id);
      if (error) throw error;
      toast.success("Bloqueio removido.");
      qc.invalidateQueries({ queryKey: ["admin-blocks-list"] });
      qc.invalidateQueries({ queryKey: ["admin-blocks"] });
    } catch {
      toast.error("Erro ao remover bloqueio.");
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Horários & Bloqueios</h1>
        <p className="text-sm text-muted-foreground">
          Defina sua jornada de trabalho semanal, horários de almoço e bloqueie datas específicas para folgas ou feriados.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Business Hours */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              Horário Semanal de Funcionamento
            </CardTitle>
            <CardDescription>
              Os horários abaixo determinam os slots disponíveis para agendamento dos clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHours ? (
              <div className="py-8 text-center text-muted-foreground">Carregando horários…</div>
            ) : (
              <div className="divide-y divide-border">
                {hours.map((h) => {
                  const dayName = WEEKDAYS[h.weekday];
                  return (
                    <div
                      key={h.weekday}
                      className="flex flex-wrap items-center justify-between gap-4 py-4"
                    >
                      <div className="flex items-center gap-3 min-w-[130px]">
                        <Switch
                          checked={h.is_open}
                          onCheckedChange={(checked) =>
                            updateWeekday(h.weekday, { is_open: checked })
                          }
                          aria-label={`Abrir em ${dayName}`}
                        />
                        <span
                          className={`font-semibold text-sm ${
                            h.is_open ? "text-foreground" : "text-muted-foreground line-through"
                          }`}
                        >
                          {dayName}
                        </span>
                      </div>

                      {h.is_open ? (
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          {/* Opening / Closing times */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Expediente:</span>
                            <Input
                              type="time"
                              value={h.open_time?.slice(0, 5) || "09:00"}
                              onChange={(e) =>
                                updateWeekday(h.weekday, { open_time: e.target.value })
                              }
                              className="h-8 w-24 text-xs font-mono"
                            />
                            <span className="text-muted-foreground">às</span>
                            <Input
                              type="time"
                              value={h.close_time?.slice(0, 5) || "19:00"}
                              onChange={(e) =>
                                updateWeekday(h.weekday, { close_time: e.target.value })
                              }
                              className="h-8 w-24 text-xs font-mono"
                            />
                          </div>

                          {/* Lunch interval */}
                          <div className="flex items-center gap-1.5 border-l border-border pl-3">
                            <span className="text-muted-foreground">Almoço:</span>
                            <Input
                              type="time"
                              value={h.lunch_start?.slice(0, 5) || ""}
                              onChange={(e) =>
                                updateWeekday(h.weekday, {
                                  lunch_start: e.target.value || null,
                                })
                              }
                              placeholder="--:--"
                              className="h-8 w-24 text-xs font-mono"
                            />
                            <span className="text-muted-foreground">às</span>
                            <Input
                              type="time"
                              value={h.lunch_end?.slice(0, 5) || ""}
                              onChange={(e) =>
                                updateWeekday(h.weekday, {
                                  lunch_end: e.target.value || null,
                                })
                              }
                              placeholder="--:--"
                              className="h-8 w-24 text-xs font-mono"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-rose-500/80">
                          Fechado o dia todo
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Special Blocks & Time Off */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CalendarX className="h-5 w-5 text-amber-500" />
                Bloqueios Pontuais
              </CardTitle>
              <CardDescription>Folgas, feriados e saídas</CardDescription>
            </div>
            <Button size="sm" onClick={() => setBlockModalOpen(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Bloquear
            </Button>
          </CardHeader>
          <CardContent>
            {loadingBlocks ? (
              <div className="py-6 text-center text-muted-foreground">Carregando bloqueios…</div>
            ) : blocks.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum bloqueio programado para os próximos dias.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3"
                  >
                    <div>
                      <p className="font-semibold text-xs text-foreground capitalize">
                        {formatDateLong(b.date)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {b.start_time
                          ? `${b.start_time.slice(0, 5)} até ${b.end_time?.slice(0, 5)}`
                          : "Dia inteiro"}{" "}
                        · <span className="text-amber-500 font-medium">{b.reason}</span>
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteBlock(b.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal: Add Block */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Bloqueio na Agenda</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddBlock} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="b-date">Data do Bloqueio *</Label>
              <Input
                id="b-date"
                type="date"
                value={blockDate}
                min={todaySP()}
                onChange={(e) => setBlockDate(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="b-full">Bloquear o dia inteiro?</Label>
                <p className="text-xs text-muted-foreground">
                  Nenhum horário será disponibilizado para clientes nesta data.
                </p>
              </div>
              <Switch id="b-full" checked={isFullDay} onCheckedChange={setIsFullDay} />
            </div>

            {!isFullDay && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="b-start">Início do Bloqueio</Label>
                  <Input
                    id="b-start"
                    type="time"
                    value={blockStart}
                    onChange={(e) => setBlockStart(e.target.value)}
                    required={!isFullDay}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="b-end">Fim do Bloqueio</Label>
                  <Input
                    id="b-end"
                    type="time"
                    value={blockEnd}
                    onChange={(e) => setBlockEnd(e.target.value)}
                    required={!isFullDay}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="b-reason">Motivo *</Label>
              <Input
                id="b-reason"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Folga semanal, Feriado de Páscoa, Consulta médica"
                required
              />
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBlockModalOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Confirmar Bloqueio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
