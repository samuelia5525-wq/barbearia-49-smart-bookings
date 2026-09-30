import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Users,
  Search,
  Gift,
  Scissors,
  MessageCircle,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Minus,
  CheckCircle,
  FileText,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatBRL,
  formatDateLong,
  formatDateShort,
  formatPhone,
  formatTime,
  spParts,
  waLink,
} from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({ meta: [{ title: "Clientes e Fidelidade — Barbearia 49" }] }),
  component: ClientesPage,
});

type ClientProfile = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  preferences: string | null;
  created_at: string;
  loyalty: { points: number; total_cuts: number; free_used: number } | null;
};

type AppointmentItem = {
  id: string;
  service_name: string;
  starts_at: string;
  status: string;
  price: number;
  is_free: boolean;
};

function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [prefsText, setPrefsText] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Fetch all clients with their loyalty data
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-clients-full"],
    queryFn: async () => {
      const [{ data: profs, error: profsErr }, { data: loys }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,nickname,phone,preferences,created_at")
          .eq("role", "client")
          .order("name", { ascending: true }),
        supabase.from("loyalty").select("client_id,points,total_cuts,free_used"),
      ]);
      if (profsErr) throw profsErr;

      const loyaltyMap = new Map((loys ?? []).map((l) => [l.client_id, l]));

      return (profs ?? []).map((p) => ({
        ...p,
        loyalty: loyaltyMap.get(p.id) ?? { points: 0, total_cuts: 0, free_used: 0 },
      })) as ClientProfile[];
    },
    refetchInterval: 30_000,
  });

  // Client history when modal is open
  const { data: clientHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["admin-client-history", selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id,service_name,starts_at,status,price,is_free")
        .eq("client_id", selectedClient!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((a) => ({ ...a, price: Number(a.price) })) as AppointmentItem[];
    },
  });

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.nickname && c.nickname.toLowerCase().includes(s)) ||
        c.phone.includes(s)
    );
  }, [clients, search]);

  const openClientModal = (client: ClientProfile) => {
    setSelectedClient(client);
    setPrefsText(client.preferences ?? "");
  };

  // Adjust loyalty points
  const adjustPoints = async (clientId: string, delta: number) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const currentPoints = client.loyalty?.points ?? 0;
    const newPoints = Math.max(0, currentPoints + delta);

    try {
      const { error } = await supabase
        .from("loyalty")
        .upsert({ client_id: clientId, points: newPoints, updated_at: new Date().toISOString() });
      if (error) throw error;
      toast.success(`Fidelidade atualizada: ${newPoints} pontos.`);
      qc.invalidateQueries({ queryKey: ["admin-clients-full"] });
      if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient({
          ...selectedClient,
          loyalty: {
            ...selectedClient.loyalty!,
            points: newPoints,
          },
        });
      }
    } catch {
      toast.error("Erro ao atualizar pontos.");
    }
  };

  // Redeem free haircut (subtract 10 points)
  const redeemFreeCut = async (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client || (client.loyalty?.points ?? 0) < 10) return;
    const newPoints = (client.loyalty?.points ?? 0) - 10;
    const newFreeUsed = (client.loyalty?.free_used ?? 0) + 1;

    try {
      const { error } = await supabase.from("loyalty").upsert({
        client_id: clientId,
        points: newPoints,
        free_used: newFreeUsed,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Corte grátis resgatado!");
      qc.invalidateQueries({ queryKey: ["admin-clients-full"] });
      if (selectedClient && selectedClient.id === clientId) {
        setSelectedClient({
          ...selectedClient,
          loyalty: {
            ...selectedClient.loyalty!,
            points: newPoints,
            free_used: newFreeUsed,
          },
        });
      }
    } catch {
      toast.error("Erro ao resgatar corte.");
    }
  };

  // Save client preferences
  const handleSavePrefs = async () => {
    if (!selectedClient) return;
    setSavingPrefs(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ preferences: prefsText.trim() || null })
        .eq("id", selectedClient.id);
      if (error) throw error;
      toast.success("Preferências salvas com sucesso!");
      qc.invalidateQueries({ queryKey: ["admin-clients-full"] });
    } catch {
      toast.error("Erro ao salvar preferências.");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Clientes & Fidelidade</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o cadastro, histórico de cortes, preferências de cada cliente e o cartão fidelidade (10 cortes = 1 grátis).
          </p>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou celular…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Clients List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando base de clientes…</div>
      ) : filteredClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum cliente encontrado com a busca "{search}".
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const hasFreeCut = (client.loyalty?.points ?? 0) >= 10;
            const msg = `Fala ${
              client.nickname || client.name.split(" ")[0]
            }! Tudo bem? Aqui é o Isac da Barbearia 49 ✂️`;

            return (
              <div
                key={client.id}
                className="relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition hover:border-primary/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-foreground">
                        {client.name}
                        {client.nickname && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            ({client.nickname})
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatPhone(client.phone)}
                      </p>
                    </div>

                    <Button size="icon" variant="outline" asChild className="h-8 w-8 text-emerald-500">
                      <a href={waLink(client.phone, msg)} target="_blank" rel="noreferrer" title="Conversar no WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>

                  {/* Loyalty Progress */}
                  <div className="mt-4 rounded-lg border border-border/70 bg-card/60 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Gift className="h-3.5 w-3.5 text-primary" />
                        Fidelidade: {client.loyalty?.points ?? 0}/10
                      </span>
                      <span className="text-muted-foreground">
                        {client.loyalty?.total_cuts ?? 0} cortes
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className={`aspect-square rounded-full border ${
                            i < Math.min(client.loyalty?.points ?? 0, 10)
                              ? "border-primary bg-primary"
                              : "border-border/80 bg-muted/40"
                          }`}
                        />
                      ))}
                    </div>

                    {hasFreeCut && (
                      <Badge variant="default" className="mt-2.5 w-full justify-center bg-primary text-primary-foreground text-[11px] font-bold">
                        🎁 1 Corte Grátis Disponível!
                      </Badge>
                    )}
                  </div>

                  {/* Preferences snippet */}
                  {client.preferences && (
                    <p className="mt-3 text-xs italic text-muted-foreground line-clamp-2">
                      "{client.preferences}"
                    </p>
                  )}
                </div>

                {/* Footer action */}
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[11px] text-muted-foreground">
                    Cliente desde {formatDateShort(spParts(client.created_at).date)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => openClientModal(client)}
                  >
                    Ver detalhes
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Client Details & History */}
      {selectedClient && (
        <Dialog open onOpenChange={(o) => !o && setSelectedClient(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center justify-between">
                <span>{selectedClient.name}</span>
                {selectedClient.nickname && (
                  <span className="text-sm font-normal text-muted-foreground">
                    "{selectedClient.nickname}"
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-5 text-sm py-2">
              {/* Contact and WhatsApp */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="font-mono text-foreground">
                    {formatPhone(selectedClient.phone)}
                  </span>
                </div>
                <Button size="sm" variant="outline" asChild className="gap-1.5 h-8 text-xs">
                  <a
                    href={waLink(
                      selectedClient.phone,
                      `Fala ${
                        selectedClient.nickname || selectedClient.name.split(" ")[0]
                      }! Aqui é o Isac da Barbearia 49 ✂️`
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                    Abrir WhatsApp
                  </a>
                </Button>
              </div>

              {/* Loyalty Control */}
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    <div>
                      <h4 className="font-bold text-foreground">Programa de Fidelidade</h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedClient.loyalty?.points ?? 0} de 10 pontos acumulados
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => adjustPoints(selectedClient.id, -1)}
                      title="Diminuir 1 ponto"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => adjustPoints(selectedClient.id, 1)}
                      title="Adicionar 1 ponto"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-full border ${
                        i < Math.min(selectedClient.loyalty?.points ?? 0, 10)
                          ? "border-primary bg-primary"
                          : "border-border bg-card"
                      }`}
                    />
                  ))}
                </div>

                {(selectedClient.loyalty?.points ?? 0) >= 10 && (
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/20 p-2.5">
                    <span className="text-xs font-semibold text-primary">
                      🎉 Cliente apto para 1 corte grátis!
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => redeemFreeCut(selectedClient.id)}
                    >
                      Resgatar 10 pontos
                    </Button>
                  </div>
                )}
              </div>

              {/* Preferences */}
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Preferências de Corte & Estilo
                </label>
                <Textarea
                  value={prefsText}
                  onChange={(e) => setPrefsText(e.target.value)}
                  placeholder="Ex: Máquina 2 lateral, degradê navalhado, risco na sobrancelha direita..."
                  rows={2}
                  className="text-xs"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={handleSavePrefs}
                    disabled={savingPrefs}
                  >
                    {savingPrefs ? "Salvando…" : "Salvar Preferências"}
                  </Button>
                </div>
              </div>

              {/* History */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Histórico de Agendamentos ({clientHistory.length})
                </h4>

                {loadingHistory ? (
                  <p className="text-xs text-muted-foreground py-2">Carregando histórico…</p>
                ) : clientHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nenhum atendimento registrado.</p>
                ) : (
                  <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card/50">
                    {clientHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 text-xs">
                        <div>
                          <p className="font-semibold">{item.service_name}</p>
                          <p className="text-muted-foreground capitalize">
                            {formatDateShort(spParts(item.starts_at).date)} às {formatTime(item.starts_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-semibold ${
                              item.status === "completed"
                                ? "text-emerald-500"
                                : item.status === "no_show"
                                ? "text-rose-500"
                                : item.status === "cancelled"
                                ? "text-muted-foreground line-through"
                                : "text-primary"
                            }`}
                          >
                            {item.is_free ? "Grátis 🎁" : formatBRL(item.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
