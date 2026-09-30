// Barbearia 49 opera no fuso de São Paulo (UTC-03:00, sem horário de verão).
export const TZ = "America/Sao_Paulo";
export const TZ_OFFSET = "-03:00";
export const SLOT_STEP = 15;

export const BARBER_WHATSAPP = ""; // ex.: "5511999999999" — número do Isac

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
export function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
export function isoAt(date: string, min: number) {
  return `${date}T${hhmm(min)}:00${TZ_OFFSET}`;
}
/** Date string (YYYY-MM-DD) and minutes of day in São Paulo for a given instant. */
export function spParts(d: Date | string | number) {
  const t = new Date(d).getTime() - 3 * 3600_000;
  const x = new Date(t);
  const date = x.toISOString().slice(0, 10);
  return { date, min: x.getUTCHours() * 60 + x.getUTCMinutes() };
}
export function todaySP() {
  return spParts(Date.now()).date;
}
export function weekdayOf(date: string) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}
export function addDays(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function formatDateLong(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
}
export function formatDateShort(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}
export function formatTime(iso: string) {
  return hhmm(spParts(iso).min);
}
export function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}
export function normalizePhone(p: string) {
  let d = p.replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d;
}
export function waLink(phone: string, text: string) {
  const n = phone ? (phone.length <= 11 ? "55" + phone : phone) : "";
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export type Hours = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
};
export type Block = { date: string; start_time: string | null; end_time: string | null; reason: string };

/** Minutes-of-day intervals that are unavailable on a date (lunch + blocks). */
export function closedIntervals(hours: Hours, blocks: Block[]) {
  const out: [number, number][] = [];
  if (hours.lunch_start && hours.lunch_end) out.push([toMin(hours.lunch_start), toMin(hours.lunch_end)]);
  for (const b of blocks) {
    if (!b.start_time || !b.end_time) out.push([0, 24 * 60]);
    else out.push([toMin(b.start_time), toMin(b.end_time)]);
  }
  return out;
}

export function computeSlots(opts: {
  date: string;
  duration: number;
  hours: Hours | null;
  blocks: Block[];
  busy: { starts_at: string; ends_at: string }[];
  nowMs?: number;
}) {
  const { date, duration, hours, blocks, busy } = opts;
  if (!hours || !hours.is_open) return [] as string[];
  const open = toMin(hours.open_time);
  const close = toMin(hours.close_time);
  const closed = closedIntervals(hours, blocks);
  const busyMs = busy.map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()]);
  const now = (opts.nowMs ?? Date.now()) + 30 * 60_000; // antecedência mínima 30min
  const slots: string[] = [];
  for (let m = open; m + duration <= close; m += SLOT_STEP) {
    const e = m + duration;
    if (closed.some(([a, b]) => m < b && e > a)) continue;
    const s = new Date(isoAt(date, m)).getTime();
    const en = s + duration * 60_000;
    if (s < now) continue;
    if (busyMs.some(([a, b]) => s < b && en > a)) continue;
    slots.push(hhmm(m));
  }
  return slots;
}
