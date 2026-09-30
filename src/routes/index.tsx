import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, Gift, MessageCircle, Scissors, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bookAppointment, getAvailability, joinWaitlist } from "@/lib/booking.functions";
import { BARBER_WHATSAPP, formatBRL, formatDateLong, formatTime, normalizePhone, waLink } from "@/lib/time";
import { loadClient, saveClient } from "@/lib/client-session";
import { SiteHeader } from "@/components/site/SiteHeader";
import { DateStrip } from "@/components/site/DateStrip";
import { serviceImage } from "@/components/site/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barbearia 49 — Agende seu corte com o Isac" },
      { name: "description", content: "Escolha o serviço, o dia e o horário livre. Confirmação na hora, sem cadastro complicado." },
      { property: "og:title", content: "Barbearia 49 — Agende seu corte com o Isac" },
      { property: "og:description", content: "Agendamento online em 3 passos, confirmação imediata e programa de fidelidade." },
    ],
  }),
  component: BookingPage,
});

type Service = { id: string; name: string; description: string | null; price: number; duration_min: number; image_url: string | null };

function useServices() {
  return useQuery({
    queryKey: ["public-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("id,name,description,price,duration_min,image_url").eq("active", true).order("sort");
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, price: Number(s.price) })) as Service[];
    },
  });
}
function useClosedWeekdays() {
  return useQuery({
    queryKey: ["public-hours"],
    queryFn: async () => {
      const { data } = await supabase.from("business_hours").select("weekday,is_open");
      return (data ?? []).filter((h) => !h.is_open).map((h) => h.weekday);
    },
  });
}

type Booked = Extract<Awaited<ReturnType<typeof bookAppointment>>, { ok: true }>;

function BookingPage() {
  const services = useServices();
  const closed = useClosedWeekdays();
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);

  const fetchAvail = useServerFn(getAvailability);
  const avail = useQuery({
    queryKey: ["availability", service?.id, date],
    enabled: !!service && !!date,
    queryFn: () => fetchAvail({ data: { date: date!, serviceId: service!.id } }),
    refetchInterval: 20_000,
  });

  const go = (s: number) => {
    setStep(s);
    document.getElementById("agendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {step === 1 && !booked && (
        <section className="relative overflow-hidden">
          <img src={hero} alt="Interior da Barbearia 49" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
          <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-16 md:pt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Desde a navalha até o acabamento</p>
            <h1 className="mt-3 max-w-xl text-4xl font-bold leading-tight md:text-6xl">
              Seu corte com o <span className="text-primary">Isac</span>, no horário que você quer.
            </h1>
            <p className="mt-4 max-w-md text-muted-foreground">
              Escolha o serviço, o dia e um horário livre. Confirmação na hora — sem senha, sem espera.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Confirmação imediata</span>
              <span className="flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> 10 cortes = 1 grátis</span>
              <span className="flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Especialista em cortes</span>
            </div>
          </div>
        </section>
      )}

      <main id="agendar" className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 pt-8">
        {booked ? (
          <Success booked={booked} onNew={() => { setBooked(null); setService(null); setDate(null); setTime(null); setStep(1); }} />
        ) : (
          <>
            <Stepper step={step} />
            {step > 1 && (
              <button onClick={() => go(step - 1)} className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}
            {step >= 2 && service && <Summary service={service} date={date} time={step >= 4 ? time : null} />}

            {step === 1 && (
              <div>
                <h2 className="mb-4 text-2xl font-bold">Escolha o serviço</h2>
                {services.isLoading && <p className="text-muted-foreground">Carregando serviços…</p>}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {services.data?.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setService(s); setTime(null); go(2); }}
                      className="group overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary"
                    >
                      <div className="aspect-[16/10] overflow-hidden">
                        <img src={serviceImage(s.name, s.image_url)} alt={s.name} loading="lazy" width={944} height={704} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-lg font-bold">{s.name}</h3>
                          <span className="font-display text-lg font-bold text-primary">{formatBRL(s.price)}</span>
                        </div>
                        {s.description && <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>}
                        <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {s.duration_min} min</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="mb-4 text-2xl font-bold">Escolha o dia</h2>
                <DateStrip value={date} closedWeekdays={closed.data ?? []} onChange={(d) => { setDate(d); setTime(null); go(3); }} />
              </div>
            )}

            {step === 3 && date && service && (
              <div>
                <h2 className="mb-1 text-2xl font-bold">Escolha o horário</h2>
                <p className="mb-4 text-sm capitalize text-muted-foreground">{formatDateLong(date)}</p>
                <DateStrip value={date} closedWeekdays={closed.data ?? []} onChange={(d) => { setDate(d); setTime(null); }} />
                <div className="mt-4">
                  {avail.isLoading ? (
                    <p className="text-muted-foreground">Verificando horários livres…</p>
                  ) : avail.data && avail.data.slots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {avail.data.slots.map((t) => (
                        <button key={t} onClick={() => { setTime(t); go(4); }} className="rounded-lg border border-border bg-card py-3 font-semibold hover:border-primary hover:text-primary">
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <NoSlots reason={avail.data?.reason ?? "Sem horários"} full={!!avail.data?.full} date={date} serviceId={service.id} />
                  )}
                </div>
              </div>
            )}

            {step === 4 && service && date && time && (
              <DetailsForm service={service} date={date} time={time} onBooked={setBooked} onTaken={() => { setTime(null); avail.refetch(); go(3); }} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Serviço", "Data", "Horário", "Seus dados"];
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 items-center gap-2">
          <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold", step > i + 1 ? "border-primary bg-primary text-primary-foreground" : step === i + 1 ? "border-primary text-primary" : "border-border text-muted-foreground")}>
            {step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span className={cn("hidden sm:inline", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>{l}</span>
          {i < labels.length - 1 && <span className="h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function Summary({ service, date, time }: { service: Service; date: string | null; time: string | null }) {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <img src={serviceImage(service.name, service.image_url)} alt="" className="h-12 w-12 rounded-lg object-cover" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{service.name} · <span className="text-primary">{formatBRL(service.price)}</span></p>
        <p className="capitalize text-muted-foreground">
          {service.duration_min} min{date ? ` · ${formatDateLong(date)}` : ""}{time ? ` às ${time}` : ""}
        </p>
      </div>
    </div>
  );
}

function NoSlots({ reason, full, date, serviceId }: { reason: string; full: boolean; date: string; serviceId: string }) {
  const join = useServerFn(joinWaitlist);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = loadClient();
    if (c) { setName(c.name); setPhone(c.phone); }
  }, []);
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="font-semibold">{reason}</p>
      {full && !done && (
        <form
          className="mx-auto mt-4 grid max-w-sm gap-3 text-left"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await join({ data: { name, phone, date, serviceId } });
              saveClient({ name, phone: normalizePhone(phone) });
              setDone(true);
            } catch {
              toast.error("Confira seu nome e celular.");
            } finally { setBusy(false); }
          }}
        >
          <p className="text-center text-sm text-muted-foreground">Entre na lista de espera — avisamos se um horário liberar.</p>
          <Input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="Celular com DDD" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Button disabled={busy}>Entrar na lista de espera</Button>
        </form>
      )}
      {done && <p className="mt-3 text-sm text-primary">Pronto! Você está na lista. Acompanhe em “Meus cortes”.</p>}
      {!full && <p className="mt-1 text-sm text-muted-foreground">Escolha outro dia acima.</p>}
    </div>
  );
}

function DetailsForm({ service, date, time, onBooked, onTaken }: { service: Service; date: string; time: string; onBooked: (b: Booked) => void; onTaken: () => void }) {
  const book = useServerFn(bookAppointment);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = loadClient();
    if (c) { setName(c.name); setPhone(c.phone); setNickname(c.nickname ?? ""); }
  }, []);

  return (
    <form
      className="mx-auto max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await book({ data: { serviceId: service.id, date, time, name, nickname: nickname || null, phone } });
          if (!r.ok) {
            toast.error(r.error);
            if (r.error.includes("ocupado")) onTaken();
            return;
          }
          saveClient({ name: r.client.name, phone: r.client.phone, nickname: r.client.nickname });
          onBooked(r);
        } catch {
          toast.error("Confira seu nome e celular com DDD.");
        } finally { setBusy(false); }
      }}
    >
      <h2 className="mb-1 text-2xl font-bold">Quase lá</h2>
      <p className="mb-6 text-sm text-muted-foreground">Só precisamos disso para confirmar. Sem senha.</p>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required minLength={2} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Celular com DDD</Label>
          <Input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 91234-5678" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nick">Apelido <span className="text-muted-foreground">(opcional)</span></Label>
          <Input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Como o Isac te chama" />
        </div>
        <Button size="lg" disabled={busy} className="mt-2">
          {busy ? "Confirmando…" : `Confirmar ${time}`}
        </Button>
      </div>
    </form>
  );
}

function Success({ booked, onNew }: { booked: Booked; onNew: () => void }) {
  const a = booked.appointment;
  const dateStr = formatDateLong(new Date(new Date(a.starts_at).getTime() - 3 * 3600_000).toISOString().slice(0, 10));
  const msg = `Olá Isac! Agendei na Barbearia 49:\n✂️ ${a.service}\n📅 ${dateStr} às ${formatTime(a.starts_at)}\n👤 ${booked.client.nickname || booked.client.name}`;
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-3xl font-bold">Horário confirmado!</h2>
      <p className="mt-1 text-muted-foreground">
        {booked.isNew ? "Seu cadastro foi criado. " : "Bem-vindo de volta, "}
        {booked.client.nickname || booked.client.name.split(" ")[0]}.
      </p>
      <div className="mt-6 rounded-xl border border-border bg-card p-5 text-left">
        <div className="flex items-center gap-2 text-primary"><Scissors className="h-4 w-4" /><span className="font-semibold">{a.service}</span></div>
        <p className="mt-2 capitalize">{dateStr}</p>
        <p className="font-display text-3xl font-bold">{formatTime(a.starts_at)}</p>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm text-muted-foreground">
          <span>{a.duration} min com o Isac</span>
          <span className="font-semibold text-foreground">{a.is_free ? "Grátis 🎁" : formatBRL(a.price)}</span>
        </div>
      </div>
      <a href={waLink(BARBER_WHATSAPP, msg)} target="_blank" rel="noreferrer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-success px-4 py-3 font-semibold text-primary-foreground">
        <MessageCircle className="h-5 w-5" /> Enviar confirmação no WhatsApp
      </a>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="outline" asChild><Link to="/minha-conta">Meus cortes</Link></Button>
        <Button variant="outline" onClick={onNew}>Novo agendamento</Button>
      </div>
    </div>
  );
}
