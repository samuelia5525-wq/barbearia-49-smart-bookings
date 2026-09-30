import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle,
  Clock,
  MessageCircle,
  Scissors,
  Trash2,
  UserCheck,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateLong, formatDateShort, formatPhone, spParts, todaySP, waLink } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/espera")({
  head: () => ({ meta: [{ title: "Fila de Espera — Barbearia 49" }] }),
  component: EsperaPage,
});

type WaitlistEntry = {
  id: string;
  client_id: string;
  service_id: string | null;
  date: string;
  status: string;
  created_at: string;
  profiles: { name: string; nickname: string | null; phone: string } | null;
  services: { name: string; duration_min: number; price: number } | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  waiting: { label: "Aguardando Vaga", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  notified: { label: "Avisado no WhatsApp", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  booked: { label: "Agendou Horário", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  removed: { label: "Desistiu", color: "bg-muted text-muted-foreground border-border" },
};

function EsperaPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "waiting" | "notified">("waiting");

  const { data: waitlist = [], isLoading } = useQuery({
    queryKey: ["admin-waitlist-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist")
        .select("id,client_id,service_id,date,status,created_at,profiles(name,nickname,phone),services(name,duration_min,price)")
        .gte("date", todaySP())
        .order("date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WaitlistEntry[];
    },
    refetchInterval: 20_000,
  });

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from("waitlist").update({ status }).eq("id", id);
      if (error) throw error;
      toast.success("Status atualizado!");
      qc.invalidateQueries({ queryKey: ["admin-waitlist-full"] });
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  };

  const removeEntry = async (id: string) => {
    try {
      const { error } = await supabase.from("waitlist").delete().eq("id", id);
      if (error) throw error;
      toast.success("Removido da fila de espera.");
      qc.invalidateQueries({ queryKey: ["admin-waitlist-full"] });
    } catch {
      toast.error("Erro ao remover da fila.");
    }
  };

  const filtered = waitlist.filter((w) => {
    if (filter === "waiting") return w.status === "waiting";
    if (filter === "notified") return w.status === "notified";
    return true;
  });

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Fila de Espera</h1>
          <p className="text-sm text-muted-foreground">
            Clientes que aguardam por desistências ou abertura de novos horários em dias lotados.
          </p>
        </div>

        <div className="flex rounded-lg border border-border bg-card p-1">
          {[
            { key: "waiting", label: "Aguardando" },
            { key: "notified", label: "Notificados" },
            { key: "all", label: "Todos" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando lista de espera…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum cliente na fila de espera</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando todos os horários de um dia estiverem ocupados, os clientes poderão se inscrever na fila.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const clientName = item.profiles?.nickname || item.profiles?.name || "Cliente";
            const dateStr = formatDateLong(item.date);
            const msg = `Fala ${clientName}! Aqui é o Isac da Barbearia 49 ✂️\nLiberou um horário no dia ${dateStr} para ${
              item.services?.name || "seu corte"
            }!\nSe quiser aproveitar, me avise por aqui ou acesse a agenda para garantir sua vaga!`;

            const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.waiting;

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition hover:border-primary/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Inscrito em {formatDateShort(spParts(item.created_at).date)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-base text-foreground">
                      {item.profiles?.name}
                      {item.profiles?.nickname && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          ({item.profiles.nickname})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {formatPhone(item.profiles?.phone ?? "")}
                    </p>
                  </div>

                  <div className="mt-4 rounded-lg border border-border/80 bg-card/60 p-3 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold capitalize">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Scissors className="h-3.5 w-3.5 text-primary" />
                      <span>{item.services?.name || "Serviço padrão"}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                    asChild
                  >
                    <a
                      href={waLink(item.profiles?.phone ?? "", msg)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (item.status === "waiting") {
                          updateStatus(item.id, "notified");
                        }
                      }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      Avisar Vaga no WhatsApp
                    </a>
                  </Button>

                  <div className="flex items-center justify-between gap-2">
                    {item.status !== "booked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => updateStatus(item.id, "booked")}
                      >
                        <UserCheck className="mr-1 h-3.5 w-3.5 text-primary" /> Marcar agendado
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={() => removeEntry(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
