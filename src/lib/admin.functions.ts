import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  serverGetAppointments,
  serverUpdateAppointmentStatus,
  serverCreateAdminAppointment,
  serverGetAdminClients,
  serverGetClientHistory,
  serverGetBusinessHours,
  serverUpdateBusinessHour,
  serverGetBlocks,
  serverAddBlock,
  serverDeleteBlock,
  serverGetWaitlist,
  serverUpdateWaitlistStatus,
  serverDeleteWaitlist,
  serverGetAdminMetrics,
  serverAdjustLoyalty,
  serverUpdateClientPreferences,
  serverGetServices,
  serverSaveService,
  serverDeleteService,
} from "./server-db";

export const claimOwner = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true };
});

export const getAdminAppointmentsFn = createServerFn({ method: "POST" })
  .validator((d: { from?: string; to?: string }) =>
    z.object({ from: z.string().optional(), to: z.string().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    return serverGetAppointments(data.from, data.to);
  });

export const updateAdminAppointmentFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: "confirmed" | "completed" | "cancelled" | "no_show" }) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverUpdateAppointmentStatus(data.id, data.status);
  });

export const createAdminAppointmentFn = createServerFn({ method: "POST" })
  .validator((d: {
    name: string;
    phone: string;
    serviceId: string;
    date: string;
    time: string;
  }) =>
    z
      .object({
        name: z.string().min(2),
        phone: z.string().min(10),
        serviceId: z.string(),
        date: z.string(),
        time: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverCreateAdminAppointment(data);
  });

export const getAdminClientsFn = createServerFn({ method: "POST" }).handler(async () => {
  return serverGetAdminClients();
});

export const getAdminClientHistoryFn = createServerFn({ method: "POST" })
  .validator((d: { clientId: string }) => z.object({ clientId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return serverGetClientHistory(data.clientId);
  });

export const getAdminBusinessHoursFn = createServerFn({ method: "POST" }).handler(async () => {
  return serverGetBusinessHours();
});

export const updateAdminBusinessHourFn = createServerFn({ method: "POST" })
  .validator((d: {
    weekday: number;
    updates: {
      is_open?: boolean;
      open_time?: string;
      close_time?: string;
      lunch_start?: string | null;
      lunch_end?: string | null;
    };
  }) =>
    z
      .object({
        weekday: z.number().int().min(0).max(6),
        updates: z.object({
          is_open: z.boolean().optional(),
          open_time: z.string().optional(),
          close_time: z.string().optional(),
          lunch_start: z.string().nullable().optional(),
          lunch_end: z.string().nullable().optional(),
        }),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverUpdateBusinessHour(data.weekday, data.updates);
  });

export const getAdminBlocksFn = createServerFn({ method: "POST" })
  .validator((d: { from?: string; to?: string }) =>
    z.object({ from: z.string().optional(), to: z.string().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    return serverGetBlocks(data.from, data.to);
  });

export const addAdminBlockFn = createServerFn({ method: "POST" })
  .validator((d: {
    date: string;
    start_time: string | null;
    end_time: string | null;
    reason: string;
  }) =>
    z
      .object({
        date: z.string(),
        start_time: z.string().nullable(),
        end_time: z.string().nullable(),
        reason: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverAddBlock(data);
  });

export const deleteAdminBlockFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return serverDeleteBlock(data.id);
  });

export const getAdminWaitlistFn = createServerFn({ method: "POST" }).handler(async () => {
  return serverGetWaitlist();
});

export const updateAdminWaitlistStatusFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; status: "waiting" | "notified" | "booked" | "removed" }) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["waiting", "notified", "booked", "removed"]),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverUpdateWaitlistStatus(data.id, data.status);
  });

export const deleteAdminWaitlistFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return serverDeleteWaitlist(data.id);
  });

export const getAdminMetricsFn = createServerFn({ method: "POST" }).handler(async () => {
  return serverGetAdminMetrics();
});

export const adjustAdminLoyaltyFn = createServerFn({ method: "POST" })
  .validator((d: { clientId: string; points: number; freeUsed?: number }) =>
    z.object({ clientId: z.string(), points: z.number().int().min(0), freeUsed: z.number().int().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    return serverAdjustLoyalty(data.clientId, data.points, data.freeUsed);
  });

export const saveAdminClientPreferencesFn = createServerFn({ method: "POST" })
  .validator((d: { clientId: string; preferences: string | null }) =>
    z.object({ clientId: z.string(), preferences: z.string().nullable() }).parse(d)
  )
  .handler(async ({ data }) => {
    return serverUpdateClientPreferences(data.clientId, data.preferences);
  });

export const getAdminServicesFn = createServerFn({ method: "POST" })
  .validator((d: { activeOnly?: boolean } = {}) =>
    z.object({ activeOnly: z.boolean().optional() }).parse(d)
  )
  .handler(async ({ data }) => {
    return serverGetServices(data.activeOnly);
  });

export const saveAdminServiceFn = createServerFn({ method: "POST" })
  .validator((d: {
    id?: string;
    name: string;
    description?: string | null;
    price: number;
    duration_min: number;
    image_url?: string | null;
    active: boolean;
    sort?: number;
  }) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        price: z.number().min(0),
        duration_min: z.number().int().min(1),
        image_url: z.string().nullable().optional(),
        active: z.boolean(),
        sort: z.number().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    return serverSaveService(data);
  });

export const deleteAdminServiceFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    return serverDeleteService(data.id);
  });


