import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SERVICES, DEFAULT_BUSINESS_HOURS } from "./barber-store";
import { addDays, computeSlots, isoAt, normalizePhone, toMin, weekdayOf, type Block, type Hours } from "./time";

export type DbProfile = {
  id: string;
  role: "client" | "admin";
  name: string;
  nickname: string | null;
  phone: string;
  preferences: string | null;
  created_at: string;
};

export type DbLoyalty = {
  client_id: string;
  points: number;
  total_cuts: number;
  free_used: number;
  updated_at: string;
};

export type DbAppointment = {
  id: string;
  client_id: string;
  service_id: string | null;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  price: number;
  is_free: boolean;
  notes: string | null;
  created_at: string;
};

export type DbBlock = {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
};

export type DbWaitlist = {
  id: string;
  client_id: string;
  service_id: string | null;
  date: string;
  status: "waiting" | "notified" | "booked" | "removed";
  created_at: string;
};

export type DbRating = {
  id: string;
  appointment_id: string;
  client_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

export type DbData = {
  services: typeof DEFAULT_SERVICES;
  business_hours: typeof DEFAULT_BUSINESS_HOURS;
  profiles: DbProfile[];
  loyalty: DbLoyalty[];
  appointments: DbAppointment[];
  blocks: DbBlock[];
  waitlist: DbWaitlist[];
  ratings: DbRating[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "barbearia49-db.json");

let cachedData: DbData | null = null;

function getDefaultData(): DbData {
  return {
    services: DEFAULT_SERVICES,
    business_hours: DEFAULT_BUSINESS_HOURS,
    profiles: [],
    loyalty: [],
    appointments: [],
    blocks: [],
    waitlist: [],
    ratings: [],
  };
}

function loadData(): DbData {
  if (cachedData) return cachedData;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(content);
      cachedData = {
        ...getDefaultData(),
        ...parsed,
        services: parsed.services?.length ? parsed.services : DEFAULT_SERVICES,
        business_hours: parsed.business_hours?.length ? parsed.business_hours : DEFAULT_BUSINESS_HOURS,
      };
      return cachedData!;
    }
  } catch (err) {
    console.error("[server-db] Erro ao carregar arquivo de banco local:", err);
  }

  cachedData = getDefaultData();
  saveData(cachedData);
  return cachedData;
}

function saveData(data: DbData) {
  cachedData = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error("[server-db] Erro ao salvar dados no disco:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client & Profiles
// ─────────────────────────────────────────────────────────────────────────────
export function serverUpsertClient(phone: string, name: string, nickname?: string | null) {
  const normPhone = normalizePhone(phone);
  const data = loadData();

  let profile = data.profiles.find((p) => p.phone === normPhone);
  let isNew = false;

  if (profile) {
    let updated = false;
    if (name.trim() && profile.name !== name.trim()) {
      profile.name = name.trim();
      updated = true;
    }
    if (nickname !== undefined && profile.nickname !== (nickname || null)) {
      profile.nickname = nickname || null;
      updated = true;
    }
    if (updated) {
      saveData(data);
    }
  } else {
    isNew = true;
    profile = {
      id: "cli-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      role: "client",
      name: name.trim(),
      nickname: nickname?.trim() || null,
      phone: normPhone,
      preferences: null,
      created_at: new Date().toISOString(),
    };
    data.profiles.push(profile);

    data.loyalty.push({
      client_id: profile.id,
      points: 0,
      total_cuts: 0,
      free_used: 0,
      updated_at: new Date().toISOString(),
    });

    saveData(data);
  }

  return { profile, isNew };
}

export function serverGetProfileByPhone(phone: string) {
  const norm = normalizePhone(phone);
  const data = loadData();
  return data.profiles.find((p) => p.phone === norm) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Availability & Slots
// ─────────────────────────────────────────────────────────────────────────────
export function serverGetAvailability(date: string, duration: number, excludeId?: string) {
  const data = loadData();
  const wd = weekdayOf(date);

  const hours = data.business_hours.find((h) => h.weekday === wd) ?? null;
  const blocks = data.blocks.filter((b) => b.date === date);

  const busy = data.appointments
    .filter(
      (a) =>
        a.id !== excludeId &&
        ["confirmed", "completed"].includes(a.status) &&
        a.starts_at >= isoAt(addDays(date, -1), 0) &&
        a.starts_at < isoAt(addDays(date, 1), 0)
    )
    .map((a) => ({ starts_at: a.starts_at, ends_at: a.ends_at }));

  const fullBlock = blocks.find((b) => !b.start_time);
  const slots = computeSlots({ date, duration, hours, blocks, busy });

  let reason: string | null = null;
  if (!hours?.is_open) reason = "Fechado neste dia (folga)";
  else if (fullBlock) reason = `Fechado: ${fullBlock.reason}`;
  else if (!slots.length) reason = "Todos os horários estão ocupados";

  return { slots, reason, full: !!hours?.is_open && !fullBlock && !slots.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointments
// ─────────────────────────────────────────────────────────────────────────────
export function serverBookAppointment(params: {
  serviceId: string;
  date: string;
  time: string;
  name: string;
  nickname?: string | null;
  phone: string;
  useFree?: boolean;
}) {
  const data = loadData();
  const svc =
    data.services.find((s) => s.id === params.serviceId) ||
    DEFAULT_SERVICES.find((s) => s.id === params.serviceId) ||
    DEFAULT_SERVICES[0];

  const { profile, isNew } = serverUpsertClient(params.phone, params.name, params.nickname);

  // Check loyalty
  const loy = data.loyalty.find((l) => l.client_id === profile.id);
  const isFree = !!params.useFree && (loy?.points ?? 0) >= 10;

  const startMin = toMin(params.time);
  const startsAt = isoAt(params.date, startMin);
  const endsAt = isoAt(params.date, startMin + svc.duration_min);

  // Validate conflict
  const hasConflict = data.appointments.some((a) => {
    if (a.status !== "confirmed" && a.status !== "completed") return false;
    const aStart = new Date(a.starts_at).getTime();
    const aEnd = new Date(a.ends_at).getTime();
    const myStart = new Date(startsAt).getTime();
    const myEnd = new Date(endsAt).getTime();
    return myStart < aEnd && myEnd > aStart;
  });

  if (hasConflict) {
    return { ok: false as const, error: "Este horário acabou de ser reservado. Escolha outro horário." };
  }

  const apptId = "appt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);

  const newAppt: DbAppointment = {
    id: apptId,
    client_id: profile.id,
    service_id: svc.id,
    service_name: svc.name,
    starts_at: startsAt,
    ends_at: endsAt,
    price: isFree ? 0 : Number(svc.price),
    is_free: isFree,
    status: "confirmed",
    notes: null,
    created_at: new Date().toISOString(),
  };

  data.appointments.push(newAppt);

  // Update waitlist
  for (const w of data.waitlist) {
    if (w.client_id === profile.id && w.date === params.date && (w.status === "waiting" || w.status === "notified")) {
      w.status = "booked";
    }
  }

  saveData(data);

  return {
    ok: true as const,
    isNew,
    client: { name: profile.name, nickname: profile.nickname, phone: profile.phone },
    appointment: {
      id: newAppt.id,
      service: svc.name,
      starts_at: startsAt,
      price: newAppt.price,
      duration: svc.duration_min,
      is_free: isFree,
    },
  };
}

export function serverGetAppointments(fromIso?: string, toIso?: string) {
  const data = loadData();
  let list = data.appointments;

  if (fromIso) {
    list = list.filter((a) => a.starts_at >= fromIso);
  }
  if (toIso) {
    list = list.filter((a) => a.starts_at < toIso);
  }

  const profileMap = new Map(data.profiles.map((p) => [p.id, p]));

  return list
    .map((a) => {
      const prof = profileMap.get(a.client_id) || null;
      return {
        id: a.id,
        service_name: a.service_name,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        status: a.status,
        price: Number(a.price),
        is_free: a.is_free,
        client_id: a.client_id,
        created_at: a.created_at,
        profiles: prof
          ? {
              name: prof.name,
              nickname: prof.nickname,
              phone: prof.phone,
              preferences: prof.preferences,
            }
          : null,
      };
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export function serverUpdateAppointmentStatus(id: string, status: "confirmed" | "completed" | "cancelled" | "no_show") {
  const data = loadData();
  const appt = data.appointments.find((a) => a.id === id);
  if (!appt) return { ok: false, error: "Agendamento não encontrado." };

  const oldStatus = appt.status;
  appt.status = status;

  // Handle loyalty trigger
  if (status === "completed" && oldStatus !== "completed") {
    let loy = data.loyalty.find((l) => l.client_id === appt.client_id);
    if (!loy) {
      loy = { client_id: appt.client_id, points: 0, total_cuts: 0, free_used: 0, updated_at: new Date().toISOString() };
      data.loyalty.push(loy);
    }
    if (appt.is_free) {
      loy.points = Math.max(loy.points - 10, 0);
      loy.free_used += 1;
      loy.total_cuts += 1;
    } else {
      loy.points += 1;
      loy.total_cuts += 1;
    }
    loy.updated_at = new Date().toISOString();
  } else if (oldStatus === "completed" && status !== "completed") {
    const loy = data.loyalty.find((l) => l.client_id === appt.client_id);
    if (loy) {
      if (appt.is_free) {
        loy.points += 10;
        loy.free_used = Math.max(loy.free_used - 1, 0);
        loy.total_cuts = Math.max(loy.total_cuts - 1, 0);
      } else {
        loy.points = Math.max(loy.points - 1, 0);
        loy.total_cuts = Math.max(loy.total_cuts - 1, 0);
      }
      loy.updated_at = new Date().toISOString();
    }
  }

  // If cancelled, notify waitlist for that date
  if (status === "cancelled") {
    const d = appt.starts_at.slice(0, 10);
    for (const w of data.waitlist) {
      if (w.date === d && w.status === "waiting") {
        w.status = "notified";
      }
    }
  }

  saveData(data);
  return { ok: true, appointment: appt };
}

export function serverCreateAdminAppointment(params: {
  name: string;
  phone: string;
  serviceId: string;
  date: string;
  time: string;
}) {
  const data = loadData();
  const svc =
    data.services.find((s) => s.id === params.serviceId) ||
    DEFAULT_SERVICES.find((s) => s.id === params.serviceId) ||
    DEFAULT_SERVICES[0];

  const { profile } = serverUpsertClient(params.phone, params.name);

  const startMin = toMin(params.time);
  const startsAt = isoAt(params.date, startMin);
  const endsAt = isoAt(params.date, startMin + svc.duration_min);

  const apptId = "appt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);

  const newAppt: DbAppointment = {
    id: apptId,
    client_id: profile.id,
    service_id: svc.id,
    service_name: svc.name,
    starts_at: startsAt,
    ends_at: endsAt,
    price: Number(svc.price),
    is_free: false,
    status: "confirmed",
    notes: "Agendamento manual pelo painel",
    created_at: new Date().toISOString(),
  };

  data.appointments.push(newAppt);
  saveData(data);

  return { ok: true, appointment: newAppt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Area & Self Service
// ─────────────────────────────────────────────────────────────────────────────
export function serverGetClientArea(phone: string) {
  const norm = normalizePhone(phone);
  const data = loadData();
  const profile = data.profiles.find((p) => p.phone === norm);
  if (!profile) return { found: false as const };

  const appts = data.appointments
    .filter((a) => a.client_id === profile.id)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const loyalty = data.loyalty.find((l) => l.client_id === profile.id) || {
    points: 0,
    total_cuts: 0,
    free_used: 0,
  };

  const waitlist = data.waitlist.filter(
    (w) => w.client_id === profile.id && (w.status === "waiting" || w.status === "notified")
  );

  const ratingsMap = new Map(data.ratings.filter((r) => r.client_id === profile.id).map((r) => [r.appointment_id, r.stars]));

  return {
    found: true as const,
    profile,
    appointments: appts.map((a) => ({
      id: a.id,
      service_id: a.service_id,
      service_name: a.service_name,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      status: a.status,
      price: Number(a.price),
      is_free: a.is_free,
      rating: ratingsMap.get(a.id) ?? null,
    })),
    loyalty,
    waitlist,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Clients, Metrics, Hours, Blocks, Waitlist
// ─────────────────────────────────────────────────────────────────────────────
export function serverGetAdminClients() {
  const data = loadData();
  const loyaltyMap = new Map(data.loyalty.map((l) => [l.client_id, l]));

  return data.profiles
    .filter((p) => p.role === "client")
    .map((p) => ({
      ...p,
      loyalty: loyaltyMap.get(p.id) ?? { points: 0, total_cuts: 0, free_used: 0 },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function serverGetClientHistory(clientId: string) {
  const data = loadData();
  return data.appointments
    .filter((a) => a.client_id === clientId)
    .map((a) => ({
      id: a.id,
      service_name: a.service_name,
      starts_at: a.starts_at,
      status: a.status,
      price: Number(a.price),
      is_free: a.is_free,
    }))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}

export function serverGetBusinessHours() {
  const data = loadData();
  return data.business_hours;
}

export function serverUpdateBusinessHour(weekday: number, updates: Partial<Hours>) {
  const data = loadData();
  const item = data.business_hours.find((h) => h.weekday === weekday);
  if (item) {
    Object.assign(item, updates);
    saveData(data);
    return { ok: true, hour: item };
  }
  return { ok: false, error: "Dia não encontrado." };
}

export function serverGetBlocks(from?: string, to?: string) {
  const data = loadData();
  let list = data.blocks;
  if (from) list = list.filter((b) => b.date >= from);
  if (to) list = list.filter((b) => b.date < to);
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function serverAddBlock(block: {
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
}) {
  const data = loadData();
  const newBlock: DbBlock = {
    id: "block-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    date: block.date,
    start_time: block.start_time || null,
    end_time: block.end_time || null,
    reason: block.reason || "Folga",
    created_at: new Date().toISOString(),
  };
  data.blocks.push(newBlock);
  saveData(data);
  return { ok: true, block: newBlock };
}

export function serverDeleteBlock(id: string) {
  const data = loadData();
  const idx = data.blocks.findIndex((b) => b.id === id);
  if (idx >= 0) {
    data.blocks.splice(idx, 1);
    saveData(data);
    return { ok: true };
  }
  return { ok: false, error: "Bloqueio não encontrado." };
}

export function serverGetWaitlist() {
  const data = loadData();
  const profMap = new Map(data.profiles.map((p) => [p.id, p]));
  const svcMap = new Map(data.services.map((s) => [s.id, s]));

  return data.waitlist.map((w) => {
    const prof = profMap.get(w.client_id);
    const svc = w.service_id ? svcMap.get(w.service_id) : null;
    return {
      id: w.id,
      client_id: w.client_id,
      service_id: w.service_id,
      date: w.date,
      status: w.status,
      created_at: w.created_at,
      profiles: prof ? { name: prof.name, nickname: prof.nickname, phone: prof.phone } : null,
      services: svc ? { name: svc.name, duration_min: svc.duration_min, price: Number(svc.price) } : null,
    };
  });
}

export function serverUpdateWaitlistStatus(id: string, status: "waiting" | "notified" | "booked" | "removed") {
  const data = loadData();
  const item = data.waitlist.find((w) => w.id === id);
  if (item) {
    item.status = status;
    saveData(data);
    return { ok: true, item };
  }
  return { ok: false, error: "Item da fila não encontrado." };
}

export function serverDeleteWaitlist(id: string) {
  const data = loadData();
  const idx = data.waitlist.findIndex((w) => w.id === id);
  if (idx >= 0) {
    data.waitlist.splice(idx, 1);
    saveData(data);
    return { ok: true };
  }
  return { ok: false, error: "Item não encontrado." };
}

export function serverGetAdminMetrics() {
  const data = loadData();
  return {
    appointments: serverGetAppointments(),
    clients: data.profiles.filter((p) => p.role === "client"),
    ratings: data.ratings,
    businessHours: data.business_hours,
  };
}

export function serverAdjustLoyalty(clientId: string, points: number, freeUsed?: number) {
  const data = loadData();
  let loy = data.loyalty.find((l) => l.client_id === clientId);
  if (!loy) {
    loy = { client_id: clientId, points: 0, total_cuts: 0, free_used: 0, updated_at: new Date().toISOString() };
    data.loyalty.push(loy);
  }
  loy.points = points;
  if (freeUsed !== undefined) {
    loy.free_used = freeUsed;
  }
  loy.updated_at = new Date().toISOString();
  saveData(data);
  return { ok: true, loyalty: loy };
}

export function serverUpdateClientPreferences(clientId: string, preferences: string | null) {
  const data = loadData();
  const profile = data.profiles.find((p) => p.id === clientId);
  if (profile) {
    profile.preferences = preferences;
    saveData(data);
    return { ok: true, profile };
  }
  return { ok: false, error: "Cliente não encontrado." };
}

export function serverGetServices(activeOnly = false) {
  const data = loadData();
  let list = data.services;
  if (activeOnly) list = list.filter((s) => s.active);
  return list.sort((a, b) => a.sort - b.sort);
}

export function serverSaveService(svc: {
  id?: string;
  name: string;
  description?: string | null;
  price: number;
  duration_min: number;
  image_url?: string | null;
  active: boolean;
  sort?: number;
}) {
  const data = loadData();
  if (svc.id) {
    const existing = data.services.find((s) => s.id === svc.id);
    if (existing) {
      Object.assign(existing, {
        name: svc.name,
        description: svc.description ?? "",
        price: svc.price,
        duration_min: svc.duration_min,
        image_url: svc.image_url ?? null,
        active: svc.active,
        sort: svc.sort ?? existing.sort,
      });
      saveData(data);
      return { ok: true, service: existing };
    }
  }

  const newId = "svc-" + Date.now();
  const newService = {
    id: newId,
    name: svc.name,
    description: svc.description ?? "",
    price: svc.price,
    duration_min: svc.duration_min,
    image_url: svc.image_url ?? null,
    active: svc.active,
    sort: svc.sort ?? data.services.length + 1,
  };
  data.services.push(newService);
  saveData(data);
  return { ok: true, service: newService };
}

export function serverDeleteService(id: string) {
  const data = loadData();
  const idx = data.services.findIndex((s) => s.id === id);
  if (idx >= 0) {
    data.services.splice(idx, 1);
    saveData(data);
    return { ok: true };
  }
  return { ok: false, error: "Serviço não encontrado." };
}


