import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Check, X, Clock, Scissors, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/time";
import { serviceImage } from "@/components/site/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/servicos")({
  head: () => ({ meta: [{ title: "Gerenciar Serviços — Barbearia 49" }] }),
  component: ServicosPage,
});

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_min: number;
  image_url: string | null;
  active: boolean;
  sort: number;
};

function ServicosPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("45");
  const [duration, setDuration] = useState("30");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("sort", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, price: Number(s.price) })) as Service[];
    },
  });

  const openNew = () => {
    setEditingService(null);
    setName("");
    setDescription("");
    setPrice("50");
    setDuration("30");
    setImageUrl("");
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setName(s.name);
    setDescription(s.description ?? "");
    setPrice(String(s.price));
    setDuration(String(s.duration_min));
    setImageUrl(s.image_url ?? "");
    setActive(s.active);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome do serviço.");
    const p = parseFloat(price.replace(",", "."));
    const d = parseInt(duration, 10);
    if (isNaN(p) || p < 0) return toast.error("Preço inválido.");
    if (isNaN(d) || d <= 0) return toast.error("Duração inválida.");

    setBusy(true);
    try {
      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            price: p,
            duration_min: d,
            image_url: imageUrl.trim() || null,
            active,
          })
          .eq("id", editingService.id);
        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        const sortOrder = services.length + 1;
        const { error } = await supabase.from("services").insert({
          name: name.trim(),
          description: description.trim() || null,
          price: p,
          duration_min: d,
          image_url: imageUrl.trim() || null,
          active,
          sort: sortOrder,
        });
        if (error) throw error;
        toast.success("Serviço cadastrado com sucesso!");
      }
      setModalOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["public-services"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar serviço.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (s: Service) => {
    const nextStatus = !s.active;
    const { error } = await supabase
      .from("services")
      .update({ active: nextStatus })
      .eq("id", s.id);
    if (error) return toast.error("Erro ao alterar status.");
    toast.success(nextStatus ? "Serviço ativado na agenda." : "Serviço pausado.");
    qc.invalidateQueries({ queryKey: ["admin-services"] });
    qc.invalidateQueries({ queryKey: ["public-services"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("services").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Serviço removido.");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["admin-services"] });
      qc.invalidateQueries({ queryKey: ["public-services"] });
    } catch (err: any) {
      toast.error("Não foi possível excluir (pode haver agendamentos vinculados). Em vez disso, desative o serviço.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Gerenciar Serviços</h1>
          <p className="text-sm text-muted-foreground">
            Configure o catálogo de serviços, preços, duração estimada e fotos exibidas para os clientes.
          </p>
        </div>

        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Serviço
        </Button>
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Carregando catálogo de serviços…</div>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Scissors className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum serviço cadastrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o primeiro serviço para que seus clientes possam agendar online.
            </p>
            <Button onClick={openNew} className="mt-4">
              Cadastrar Serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.id}
              className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/60"
            >
              <div>
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                  <img
                    src={serviceImage(s.name, s.image_url)}
                    alt={s.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute right-2 top-2">
                    <Badge variant={s.active ? "default" : "secondary"}>
                      {s.active ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg text-foreground">{s.name}</h3>
                    <span className="font-display text-lg font-bold text-primary">
                      {formatBRL(s.price)}
                    </span>
                  </div>

                  {s.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {s.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{s.duration_min} minutos</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-border bg-card/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.active}
                    onCheckedChange={() => toggleStatus(s)}
                    aria-label="Ativar/Desativar serviço"
                  />
                  <span className="text-xs text-muted-foreground">
                    {s.active ? "Visível" : "Oculto"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(s)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create/Edit Service */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="s-name">Nome do Serviço *</Label>
              <Input
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Corte Degradê, Barboterapia"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="s-desc">Descrição (opcional)</Label>
              <Textarea
                id="s-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre o corte, toalha quente, navalha..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s-price">Preço (R$) *</Label>
                <Input
                  id="s-price"
                  type="number"
                  step="0.50"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="50.00"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="s-dur">Duração (min) *</Label>
                <Input
                  id="s-dur"
                  type="number"
                  step="5"
                  min="5"
                  max="240"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="30"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="s-img">URL da Foto (opcional)</Label>
              <Input
                id="s-img"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... (se vazio, usa foto padrão temática)"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="s-act">Disponível para agendamento online</Label>
                <p className="text-xs text-muted-foreground">
                  Se desativado, não aparecerá para os clientes.
                </p>
              </div>
              <Switch id="s-act" checked={active} onCheckedChange={setActive} />
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando…" : editingService ? "Salvar Alterações" : "Criar Serviço"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Serviço?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este serviço? Se preferir apenas ocultá-lo da agenda pública, você pode desativá-lo.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? "Excluindo…" : "Sim, Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
