import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  DollarSign,
  Users,
  CalendarCheck,
  AlertTriangle,
  UserX,
  Star,
  MessageCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Scissors,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateShort, formatPhone, spParts, todaySP, waLink } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/metricas")({
  head: () => ({ meta: [{ title: "Métricas e Faturamento — Barbearia 49" }] }),
  component: MetricasPage,
});

type Period = "7d" | "30d" | "month" | "all";

const COLORS = ["#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#78716c", "#a8a29e"];

function MetricasPage() {
  const [period, setPeriod] = useState<Period>("30d");

  // Fetch all appointments
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["admin-metrics-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,service_name,starts_at,ends_at,status,price,is_free,client_id,created_at,profiles(name,nickname,phone)")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  // Fetch all clients
  const { data: clients = [] } = useQuery({
    queryKey: ["admin-metrics-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,nickname,phone,created_at")
        .eq("role", "client");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch ratings
  const { data: ratings = [] } = useQuery({
    queryKey: ["admin-metrics-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ratings")
        .select("id,stars,comment,created_at,profiles(name,nickname)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch business hours for occupancy rate calculation
  const { data: businessHours = [] } = useQuery({
    queryKey: ["admin-metrics-hours"],
    queryFn: async () => {
      const { data } = await supabase.from("business_hours").select("*");
      return data ?? [];
    },
  });

  // Process data based on period
  const stats = useMemo(() => {
    const now = new Date();
    const today = todaySP();

    let daysBack = 30;
    if (period === "7d") daysBack = 7;
    if (period === "30d") daysBack = 30;
    if (period === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      daysBack = Math.max(1, Math.floor((now.getTime() - firstDay.getTime()) / (24 * 3600_000)));
    }
    if (period === "all") daysBack = 365;

    const filterDate = new Date(now.getTime() - daysBack * 24 * 3600_000).toISOString();
    const prevFilterDate = new Date(now.getTime() - daysBack * 2 * 24 * 3600_000).toISOString();

    // Current period appointments
    const currentPeriodAppts = appointments.filter((a) => a.starts_at >= filterDate);
    // Previous period for comparison
    const prevPeriodAppts = appointments.filter(
      (a) => a.starts_at >= prevFilterDate && a.starts_at < filterDate
    );

    // Revenue calculations
    const completedCurrent = currentPeriodAppts.filter((a) => a.status === "completed");
    const completedPrev = prevPeriodAppts.filter((a) => a.status === "completed");

    const currentRevenue = completedCurrent.reduce((acc, a) => acc + Number(a.price || 0), 0);
    const prevRevenue = completedPrev.reduce((acc, a) => acc + Number(a.price || 0), 0);

    const revenueGrowth =
      prevRevenue > 0 ? Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100) : null;

    // Today revenue
    const todayCompleted = appointments.filter(
      (a) => a.status === "completed" && spParts(a.starts_at).date === today
    );
    const todayRevenue = todayCompleted.reduce((acc, a) => acc + Number(a.price || 0), 0);

    // Ticket médio
    const ticketMedio = completedCurrent.length > 0 ? currentRevenue / completedCurrent.length : 0;
    const prevTicketMedio = completedPrev.length > 0 ? prevRevenue / completedPrev.length : 0;
    const ticketGrowth =
      prevTicketMedio > 0
        ? Math.round(((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100)
        : null;

    // Total appointments count in period (excluding cancelled before)
    const totalValidCurrent = currentPeriodAppts.filter((a) => a.status !== "cancelled");
    const noShowCount = currentPeriodAppts.filter((a) => a.status === "no_show").length;
    const cancelledCount = currentPeriodAppts.filter((a) => a.status === "cancelled").length;

    const noShowRate =
      currentPeriodAppts.length > 0
        ? Math.round((noShowCount / currentPeriodAppts.length) * 100)
        : 0;
    const cancelRate =
      currentPeriodAppts.length > 0
        ? Math.round((cancelledCount / currentPeriodAppts.length) * 100)
        : 0;

    // Occupancy rate (% time working vs open hours)
    let totalOpenMinutes = 0;
    businessHours.forEach((h) => {
      if (h.is_open) {
        const [oh, om] = h.open_time.split(":").map(Number);
        const [ch, cm] = h.close_time.split(":").map(Number);
        let openMins = (ch * 60 + cm) - (oh * 60 + om);
        if (h.lunch_start && h.lunch_end) {
          const [lsh, lsm] = h.lunch_start.split(":").map(Number);
          const [leh, lem] = h.lunch_end.split(":").map(Number);
          openMins -= (leh * 60 + lem) - (lsh * 60 + lsm);
        }
        totalOpenMinutes += Math.max(0, openMins) * (daysBack / 7);
      }
    });

    const totalServiceMinutes = completedCurrent.reduce((acc, a) => {
      const dur = (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000;
      return acc + (dur > 0 ? dur : 30);
    }, 0);

    const occupancyRate =
      totalOpenMinutes > 0
        ? Math.min(100, Math.round((totalServiceMinutes / totalOpenMinutes) * 100))
        : 0;

    // Most popular services
    const serviceMap: Record<string, { count: number; revenue: number }> = {};
    completedCurrent.forEach((a) => {
      const name = a.service_name || "Outros";
      if (!serviceMap[name]) serviceMap[name] = { count: 0, revenue: 0 };
      serviceMap[name].count += 1;
      serviceMap[name].revenue += Number(a.price || 0);
    });

    const topServices = Object.entries(serviceMap)
      .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
      .sort((a, b) => b.count - a.count);

    // Peak hours (08:00 - 20:00)
    const hoursMap: Record<number, number> = {};
    for (let h = 8; h <= 20; h++) hoursMap[h] = 0;

    currentPeriodAppts
      .filter((a) => a.status === "completed" || a.status === "confirmed")
      .forEach((a) => {
        const hour = Math.floor(spParts(a.starts_at).min / 60);
        if (hoursMap[hour] !== undefined) {
          hoursMap[hour] += 1;
        }
      });

    const peakHoursData = Object.entries(hoursMap).map(([hour, count]) => ({
      hour: `${hour}h`,
      cortes: count,
    }));

    // New vs Returning clients in period
    const clientApptCounts: Record<string, number> = {};
    appointments.forEach((a) => {
      if (a.status === "completed") {
        clientApptCounts[a.client_id] = (clientApptCounts[a.client_id] || 0) + 1;
      }
    });

    let newClients = 0;
    let returningClients = 0;
    const clientsInPeriod = new Set(currentPeriodAppts.map((a) => a.client_id));

    clientsInPeriod.forEach((clientId) => {
      if ((clientApptCounts[clientId] || 0) <= 1) {
        newClients += 1;
      } else {
        returningClients += 1;
      }
    });

    const clientTypeData = [
      { name: "Novos", value: newClients || 1 },
      { name: "Recorrentes", value: returningClients || 0 },
    ];

    // Inactive clients (last haircut was > 30 days ago)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString();
    const lastCutByClient: Record<string, { date: string; service: string }> = {};

    appointments.forEach((a) => {
      if (a.status === "completed") {
        if (!lastCutByClient[a.client_id] || a.starts_at > lastCutByClient[a.client_id].date) {
          lastCutByClient[a.client_id] = { date: a.starts_at, service: a.service_name };
        }
      }
    });

    const inactiveClients = clients
      .filter((c) => {
        const last = lastCutByClient[c.id];
        return last && last.date < thirtyDaysAgo;
      })
      .map((c) => {
        const last = lastCutByClient[c.id];
        const daysSince = Math.floor(
          (now.getTime() - new Date(last.date).getTime()) / (24 * 3600_000)
        );
        return {
          id: c.id,
          name: c.name,
          nickname: c.nickname,
          phone: c.phone,
          lastCutDate: last.date,
          lastService: last.service,
          daysSince,
        };
      })
      .sort((a, b) => b.daysSince - a.daysSince);

    // Ratings average
    const totalStars = ratings.reduce((acc, r) => acc + Number(r.stars), 0);
    const avgRating = ratings.length > 0 ? (totalStars / ratings.length).toFixed(1) : "5.0";

    return {
      todayRevenue,
      currentRevenue,
      prevRevenue,
      revenueGrowth,
      ticketMedio,
      ticketGrowth,
      completedCount: completedCurrent.length,
      occupancyRate,
      noShowRate,
      cancelRate,
      noShowCount,
      cancelledCount,
      topServices,
      peakHoursData,
      clientTypeData,
      newClients,
      returningClients,
      inactiveClients,
      avgRating,
      totalRatings: ratings.length,
    };
  }, [appointments, clients, ratings, businessHours, period]);

  if (loadingAppts) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Carregando métricas e relatórios…
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Header & Period Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Métricas e Desempenho</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o faturamento, taxa de ocupação, horários de pico e fidelização da Barbearia 49.
          </p>
        </div>

        <div className="flex rounded-lg border border-border bg-card p-1">
          {[
            { key: "7d", label: "7 Dias" },
            { key: "30d", label: "30 Dias" },
            { key: "month", label: "Este Mês" },
            { key: "all", label: "Geral" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key as Period)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                period === tab.key
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Faturamento do Período */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento ({period === "7d" ? "7d" : period === "30d" ? "30d" : "Mês"})
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatBRL(stats.currentRevenue)}
            </div>
            <div className="mt-1 flex items-center text-xs text-muted-foreground">
              {stats.revenueGrowth !== null ? (
                <span
                  className={cn(
                    "flex items-center font-medium mr-1.5",
                    stats.revenueGrowth >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {stats.revenueGrowth >= 0 ? (
                    <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 mr-0.5" />
                  )}
                  {Math.abs(stats.revenueGrowth)}%
                </span>
              ) : null}
              <span>vs. período anterior</span>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket Médio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatBRL(stats.ticketMedio)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Por atendimento concluído ({stats.completedCount} cortes)
            </p>
          </CardContent>
        </Card>

        {/* Taxa de Ocupação */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Ocupação
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.occupancyRate}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${stats.occupancyRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* No-Show & Cancelamentos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faltas & No-Show
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.noShowRate}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.noShowCount} faltas · {stats.cancelledCount} cancelados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Horários de Pico */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Horários de Maior Movimento</CardTitle>
            <CardDescription>Distribuição de atendimentos ao longo das horas do dia</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.peakHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hour" stroke="#888888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                    formatter={(value: any) => [`${value} agendamentos`, "Cortes"]}
                  />
                  <Bar dataKey="cortes" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Clientes Novos vs Recorrentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Perfil de Clientes</CardTitle>
            <CardDescription>Novos clientes vs. fidelizados</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.clientTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#d97706" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex w-full justify-around text-center text-xs">
              <div>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#d97706] mr-1.5" />
                <span className="text-muted-foreground">Novos: </span>
                <strong className="text-foreground">{stats.newClients}</strong>
              </div>
              <div>
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b] mr-1.5" />
                <span className="text-muted-foreground">Recorrentes: </span>
                <strong className="text-foreground">{stats.returningClients}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de Serviços e Clientes Inativos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Serviços Mais Vendidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Serviços Mais Vendidos</CardTitle>
              <CardDescription>Ranking de serviços por quantidade e faturamento</CardDescription>
            </div>
            <Scissors className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {stats.topServices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum serviço concluído neste período.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {stats.topServices.map((svc, idx) => (
                  <div key={svc.name} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-sm">{svc.name}</p>
                        <p className="text-xs text-muted-foreground">{svc.count} cortes realizados</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-sm text-primary">
                        {formatBRL(svc.revenue)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {stats.currentRevenue > 0
                          ? `${Math.round((svc.revenue / stats.currentRevenue) * 100)}% da receita`
                          : "0%"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clientes Inativos (+30 dias sem retorno) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Clientes Inativos (+30 dias)</CardTitle>
              <CardDescription>Reengaje clientes que não cortam há mais de 1 mês</CardDescription>
            </div>
            <UserX className="h-5 w-5 text-rose-500" />
          </CardHeader>
          <CardContent>
            {stats.inactiveClients.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                🎉 Nenhum cliente inativo! Todos estão retornando com frequência.
              </p>
            ) : (
              <div className="max-h-80 divide-y divide-border overflow-y-auto">
                {stats.inactiveClients.slice(0, 10).map((client) => {
                  const msg = `Fala ${
                    client.nickname || client.name.split(" ")[0]
                  }! Tudo bem? Aqui é o Isac da Barbearia 49 ✂️\nFaz um tempinho desde seu último corte (${
                    client.daysSince
                  } dias atrás). Bora dar aquele talento no visual essa semana?`;

                  return (
                    <div
                      key={client.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3"
                    >
                      <div>
                        <p className="font-semibold text-sm">
                          {client.name}
                          {client.nickname ? ` (${client.nickname})` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Último corte: {formatDateShort(spParts(client.lastCutDate).date)} (
                          <span className="text-amber-500 font-medium">{client.daysSince} dias</span>)
                        </p>
                      </div>

                      <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 text-xs">
                        <a href={waLink(client.phone, msg)} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                          Lembrar no WhatsApp
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Avaliações Recentes dos Clientes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Avaliações dos Clientes</CardTitle>
            <CardDescription>
              Nota média: <strong className="text-foreground">{stats.avgRating} / 5.0</strong> ({stats.totalRatings} avaliações)
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 text-primary">
            <Star className="h-5 w-5 fill-current" />
            <span className="font-display text-lg font-bold">{stats.avgRating}</span>
          </div>
        </CardHeader>
        <CardContent>
          {ratings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhuma avaliação recebida ainda.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ratings.slice(0, 6).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card/60 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      {r.profiles?.nickname || r.profiles?.name || "Cliente"}
                    </span>
                    <div className="flex gap-0.5 text-primary">
                      {Array.from({ length: r.stars }, (_, i) => (
                        <Star key={i} className="h-3 w-3 fill-current" />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      "{r.comment}"
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {formatDateShort(spParts(r.created_at).date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
