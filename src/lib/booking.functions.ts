import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addDays, computeSlots, isoAt, normalizePhone, toMin, weekdayOf, type Block, type Hours } from "./time";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((p) => p.length === 10 || p.length === 11, "Celular inválido — use DDD + número");

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Admin = Awaited<ReturnType<typeof admin>>;

async function availability(db: Admin, date: string, duration: number, excludeId?: string) {
  const wd = weekdayOf(date);
  const [{ data: hours }, { data: blocks }, { data: appts }] = await Promise.all([
    db.from("business_hours").select("*").eq("weekday", wd).maybeSingle(),
    db.from("blocks").select("date,start_time,end_time,reason").eq("date", date),
    db
      .from("appointments")
      .select("id,starts_at,ends_at")
      .in("status", ["confirmed", "completed"])
      .gte("starts_at", isoAt(addDays(date, -1), 0))
      .lt("starts_at", isoAt(addDays(date, 1), 0)),
  ]);
  const busy = (appts ?? []).filter((a) => a.id !== excludeId);
  const fullBlock = (blocks ?? []).find((b) => !b.start_time);
  const slots = computeSlots({ date, duration, hours: hours as Hours | null, blocks: (blocks ?? []) as Block[], busy });
  let reason: string | null = null;
  if (!hours?.is_open) reason = "Fechado neste dia";
  else if (fullBlock) reason = `Fechado: ${fullBlock.reason}`;
  else if (!slots.length) reason = "Dia lotado";
  return { slots, reason, full: !!hours?.is_open && !fullBlock && !slots.length };
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ date: dateSchema, serviceId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: svc } = await db.from("services").select("duration_min").eq("id", data.serviceId).maybeSingle();
    if (!svc) return { slots: [], reason: "Serviço não encontrado", full: false };
    return availability(db, data.date, svc.duration_min);
  });

async function upsertClient(db: Admin, phone: string, name: string, nickname?: string | null) {
  const { data: existing } = await db.from("profiles").select("*").eq("phone", phone).maybeSingle();
  if (existing) {
    if (nickname && nickname !== existing.nickname) {
      await db.from("profiles").update({ nickname }).eq("id", existing.id);
    }
    return { profile: existing, isNew: false };
  }
  const { data: created, error } = await db
    .from("profiles")
    .insert({ phone, name: name.trim(), nickname: nickname || null, role: "client" })
    .select("*")
    .single();
  if (error) throw new Error("Não foi possível criar seu cadastro.");
  await db.from("loyalty").insert({ client_id: created.id });
  return { profile: created, isNew: true };
}

export const bookAppointment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        serviceId: z.string().uuid(),
        date: dateSchema,
        time: z.string().regex(/^\d{2}:\d{2}$/),
        name: z.string().trim().min(2, "Informe seu nome").max(80),
        nickname: z.string().trim().max(40).optional().nullable(),
        phone: phoneSchema,
        useFree: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: svc } = await db.from("services").select("*").eq("id", data.serviceId).eq("active", true).maybeSingle();
    if (!svc) return { ok: false as const, error: "Serviço indisponível." };
    const av = await availability(db, data.date, svc.duration_min);
    if (!av.slots.includes(data.time)) return { ok: false as const, error: "Esse horário acabou de ser ocupado. Escolha outro." };

    const { profile, isNew } = await upsertClient(db, data.phone, data.name, data.nickname);
    const { data: loy } = await db.from("loyalty").select("points").eq("client_id", profile.id).maybeSingle();
    const isFree = !!data.useFree && (loy?.points ?? 0) >= 10;
    const startMin = toMin(data.time);
    const { data: appt, error } = await db
      .from("appointments")
      .insert({
        client_id: profile.id,
        service_id: svc.id,
        service_name: svc.name,
        starts_at: isoAt(data.date, startMin),
        ends_at: isoAt(data.date, startMin + svc.duration_min),
        price: isFree ? 0 : svc.price,
        is_free: isFree,
        status: "confirmed",
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23P01") return { ok: false as const, error: "Esse horário acabou de ser ocupado. Escolha outro." };
      return { ok: false as const, error: "Não foi possível agendar. Tente novamente." };
    }
    await db.from("waitlist").update({ status: "booked" }).eq("client_id", profile.id).eq("date", data.date).in("status", ["waiting", "notified"]);
    return {
      ok: true as const,
      isNew,
      client: { name: profile.name, nickname: profile.nickname, phone: profile.phone },
      appointment: { id: appt.id, service: svc.name, starts_at: appt.starts_at, price: Number(appt.price), duration: svc.duration_min, is_free: isFree },
    };
  });

export const getClientArea = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: profile } = await db.from("profiles").select("id,name,nickname,phone,preferences,created_at").eq("phone", data.phone).maybeSingle();
    if (!profile) return { found: false as const };
    const [{ data: appts }, { data: loyalty }, { data: waitlist }, { data: ratings }] = await Promise.all([
      db.from("appointments").select("id,service_id,service_name,starts_at,ends_at,status,price,is_free").eq("client_id", profile.id).order("starts_at", { ascending: false }).limit(100),
      db.from("loyalty").select("points,total_cuts,free_used").eq("client_id", profile.id).maybeSingle(),
      db.from("waitlist").select("id,date,status,service_id").eq("client_id", profile.id).in("status", ["waiting", "notified"]).order("date"),
      db.from("ratings").select("appointment_id,stars").eq("client_id", profile.id),
    ]);
    return {
      found: true as const,
      profile,
      appointments: (appts ?? []).map((a) => ({ ...a, price: Number(a.price), rating: ratings?.find((r) => r.appointment_id === a.id)?.stars ?? null })),
      loyalty: loyalty ?? { points: 0, total_cuts: 0, free_used: 0 },
      waitlist: waitlist ?? [],
    };
  });

async function ownAppointment(db: Admin, id: string, phone: string) {
  const { data: profile } = await db.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (!profile) return null;
  const { data: appt } = await db.from("appointments").select("*").eq("id", id).eq("client_id", profile.id).maybeSingle();
  return appt;
}

async function notifyWaitlist(db: Admin, startsAt: string) {
  const date = new Date(new Date(startsAt).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
  await db.from("waitlist").update({ status: "notified" }).eq("date", date).eq("status", "waiting");
}

export const cancelAppointment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const appt = await ownAppointment(db, data.id, data.phone);
    if (!appt || appt.status !== "confirmed") return { ok: false, error: "Agendamento não encontrado." };
    await db.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);
    await notifyWaitlist(db, appt.starts_at);
    return { ok: true };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), phone: phoneSchema, date: dateSchema, time: z.string().regex(/^\d{2}:\d{2}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const appt = await ownAppointment(db, data.id, data.phone);
    if (!appt || appt.status !== "confirmed") return { ok: false, error: "Agendamento não encontrado." };
    const duration = Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000);
    const av = await availability(db, data.date, duration, appt.id);
    if (!av.slots.includes(data.time)) return { ok: false, error: "Horário indisponível." };
    const m = toMin(data.time);
    const { error } = await db.from("appointments").update({ starts_at: isoAt(data.date, m), ends_at: isoAt(data.date, m + duration) }).eq("id", appt.id);
    if (error) return { ok: false, error: "Horário indisponível." };
    await notifyWaitlist(db, appt.starts_at);
    return { ok: true };
  });

export const getRescheduleSlots = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), phone: phoneSchema, date: dateSchema }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const appt = await ownAppointment(db, data.id, data.phone);
    if (!appt) return { slots: [], reason: "Agendamento não encontrado", full: false };
    const duration = Math.round((new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000);
    return availability(db, data.date, duration, appt.id);
  });

export const rateAppointment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), phone: phoneSchema, stars: z.number().int().min(1).max(5), comment: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const appt = await ownAppointment(db, data.id, data.phone);
    if (!appt || appt.status !== "completed") return { ok: false, error: "Só é possível avaliar atendimentos concluídos." };
    const { error } = await db.from("ratings").insert({ appointment_id: appt.id, client_id: appt.client_id, stars: data.stars, comment: data.comment || null });
    if (error) return { ok: false, error: "Você já avaliou este atendimento." };
    return { ok: true };
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ phone: phoneSchema, name: z.string().trim().min(2).max(80), nickname: z.string().trim().max(40).optional().nullable(), date: dateSchema, serviceId: z.string().uuid() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { profile } = await upsertClient(db, data.phone, data.name, data.nickname);
    const { data: existing } = await db.from("waitlist").select("id").eq("client_id", profile.id).eq("date", data.date).in("status", ["waiting", "notified"]).maybeSingle();
    if (!existing) await db.from("waitlist").insert({ client_id: profile.id, date: data.date, service_id: data.serviceId });
    return { ok: true };
  });

export const updatePreferences = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: phoneSchema, preferences: z.string().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("profiles").update({ preferences: data.preferences }).eq("phone", data.phone);
    return { ok: true };
  });
