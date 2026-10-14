import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone, toMin, isoAt } from "./time";
import { DEFAULT_SERVICES } from "./barber-store";
import {
  serverGetAvailability,
  serverBookAppointment,
  serverGetClientArea,
  serverGetAppointments,
  serverUpdateAppointmentStatus,
  serverUpsertClient,
  serverGetProfileByPhone,
} from "./server-db";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((p) => p.length >= 10 && p.length <= 13, "Celular inválido — use DDD + número");

export const getAvailability = createServerFn({ method: "POST" })
  .validator((d: { date: string; serviceId: string }) =>
    z.object({ date: dateSchema, serviceId: z.string() }).parse(d)
  )
  .handler(async ({ data }) => {
    let duration = 30;
    const def = DEFAULT_SERVICES.find((s) => s.id === data.serviceId);
    if (def) duration = def.duration_min;

    return serverGetAvailability(data.date, duration);
  });

export const bookAppointment = createServerFn({ method: "POST" })
  .validator((d: {
    serviceId: string;
    date: string;
    time: string;
    name: string;
    nickname?: string | null;
    phone: string;
    useFree?: boolean;
  }) =>
    z
      .object({
        serviceId: z.string(),
        date: dateSchema,
        time: z.string().regex(/^\d{2}:\d{2}$/),
        name: z.string().trim().min(2, "Informe seu nome").max(80),
        nickname: z.string().trim().max(40).optional().nullable(),
        phone: phoneSchema,
        useFree: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverBookAppointment({
      serviceId: data.serviceId,
      date: data.date,
      time: data.time,
      name: data.name,
      nickname: data.nickname,
      phone: data.phone,
      useFree: data.useFree,
    });
  });

export const getClientArea = createServerFn({ method: "POST" })
  .validator((d: { phone: string }) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    return serverGetClientArea(data.phone);
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .validator((d: { id: string; phone: string }) =>
    z.object({ id: z.string(), phone: phoneSchema }).parse(d)
  )
  .handler(async ({ data }) => {
    const profile = serverGetProfileByPhone(data.phone);
    if (!profile) return { ok: false, error: "Perfil não encontrado." };

    const appts = serverGetAppointments();
    const appt = appts.find((a) => a.id === data.id && a.client_id === profile.id);
    if (!appt || appt.status !== "confirmed") {
      return { ok: false, error: "Agendamento não encontrado ou já cancelado." };
    }

    serverUpdateAppointmentStatus(appt.id, "cancelled");
    return { ok: true };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .validator((d: { id: string; phone: string; date: string; time: string }) =>
    z
      .object({
        id: z.string(),
        phone: phoneSchema,
        date: dateSchema,
        time: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const profile = serverGetProfileByPhone(data.phone);
    if (!profile) return { ok: false, error: "Perfil não encontrado." };

    const appts = serverGetAppointments();
    const appt = appts.find((a) => a.id === data.id && a.client_id === profile.id);
    if (!appt || appt.status !== "confirmed") {
      return { ok: false, error: "Agendamento não encontrado." };
    }

    const duration = Math.round(
      (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000
    );

    const av = serverGetAvailability(data.date, duration, appt.id);
    if (!av.slots.includes(data.time)) {
      return { ok: false, error: "Horário indisponível." };
    }

    serverUpdateAppointmentStatus(appt.id, "cancelled");

    const newStartMin = toMin(data.time);
    const startsAt = isoAt(data.date, newStartMin);

    const res = serverBookAppointment({
      serviceId: appt.id,
      date: data.date,
      time: data.time,
      name: profile.name,
      nickname: profile.nickname,
      phone: profile.phone,
      useFree: appt.is_free,
    });

    return res;
  });

export const getRescheduleSlots = createServerFn({ method: "POST" })
  .validator((d: { id: string; phone: string; date: string }) =>
    z.object({ id: z.string(), phone: phoneSchema, date: dateSchema }).parse(d)
  )
  .handler(async ({ data }) => {
    const profile = serverGetProfileByPhone(data.phone);
    if (!profile) return { slots: [], reason: "Perfil não encontrado", full: false };

    const appts = serverGetAppointments();
    const appt = appts.find((a) => a.id === data.id && a.client_id === profile.id);
    if (!appt) return { slots: [], reason: "Agendamento não encontrado", full: false };

    const duration = Math.round(
      (new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime()) / 60000
    );

    return serverGetAvailability(data.date, duration, appt.id);
  });

export const rateAppointment = createServerFn({ method: "POST" })
  .validator((d: { id: string; phone: string; stars: number; comment?: string }) =>
    z
      .object({
        id: z.string(),
        phone: phoneSchema,
        stars: z.number().int().min(1).max(5),
        comment: z.string().max(500).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return { ok: true };
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((d: {
    phone: string;
    name: string;
    nickname?: string | null;
    date: string;
    serviceId: string;
  }) =>
    z
      .object({
        phone: phoneSchema,
        name: z.string().trim().min(2).max(80),
        nickname: z.string().trim().max(40).optional().nullable(),
        date: dateSchema,
        serviceId: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { profile } = serverUpsertClient(data.phone, data.name, data.nickname);
    return { ok: true };
  });

export const updatePreferences = createServerFn({ method: "POST" })
  .validator((d: { phone: string; preferences: string }) =>
    z.object({ phone: phoneSchema, preferences: z.string().max(500) }).parse(d)
  )
  .handler(async ({ data }) => {
    return { ok: true };
  });
