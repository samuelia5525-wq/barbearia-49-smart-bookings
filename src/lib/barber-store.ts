import { supabase } from "@/integrations/supabase/client";
import { addDays, hhmm, isoAt, spParts, todaySP, toMin, weekdayOf, closedIntervals, type Block, type Hours } from "./time";

export type ServiceItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_min: number;
  image_url: string | null;
  active: boolean;
  sort: number;
};

export const DEFAULT_SERVICES: ServiceItem[] = [
  // ── Cortes e Combos ──────────────────────────────────────────────────────
  {
    id: "c1000000-0000-4000-8000-000000000001",
    name: "Corte seg. a qua.",
    description: "Corte clássico com tesoura e máquina, disponível de segunda a quarta.",
    price: 35,
    duration_min: 30,
    image_url: null,
    active: true,
    sort: 1,
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    name: "Corte qui. a sáb.",
    description: "Corte clássico com tesoura e máquina, disponível de quinta a sábado.",
    price: 40,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 2,
  },
  {
    id: "c1000000-0000-4000-8000-000000000003",
    name: "Corte + sobrancelha",
    description: "Corte completo com alinhamento e design de sobrancelha na navalha.",
    price: 55,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 3,
  },
  {
    id: "c1000000-0000-4000-8000-000000000004",
    name: "Corte + cavanhaque",
    description: "Corte completo com alinhamento e aparação do cavanhaque.",
    price: 55,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 4,
  },
  {
    id: "c1000000-0000-4000-8000-000000000005",
    name: "Corte + barba",
    description: "Corte completo + barba feita com toalha quente e acabamento navalhado.",
    price: 70,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 5,
  },
  {
    id: "c1000000-0000-4000-8000-000000000006",
    name: "Combo corte + barboterapia",
    description: "Corte + barboterapia com toalha quente, massagem facial e hidratação profissional.",
    price: 85,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 6,
  },
  {
    id: "c1000000-0000-4000-8000-000000000007",
    name: "Corte + alisante",
    description: "Corte completo com aplicação de alisante para um visual liso e sofisticado.",
    price: 60,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 7,
  },
  {
    id: "c1000000-0000-4000-8000-000000000008",
    name: "Corte + pigmentação",
    description: "Corte completo com pigmentação para cobrir falhas e uniformizar o visual.",
    price: 60,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 8,
  },
  {
    id: "c1000000-0000-4000-8000-000000000009",
    name: "Corte + penteado",
    description: "Corte completo com finalização e penteado personalizado.",
    price: 60,
    duration_min: 50,
    image_url: null,
    active: true,
    sort: 9,
  },
  {
    id: "c1000000-0000-4000-8000-000000000010",
    name: "Corte + luzes",
    description: "Corte completo com aplicação de luzes para realçar o visual.",
    price: 100,
    duration_min: 180,
    image_url: null,
    active: true,
    sort: 10,
  },
  {
    id: "c1000000-0000-4000-8000-000000000011",
    name: "Corte 1 máquina",
    description: "Corte rápido na máquina, ideal para quem curte o visual mais curto e prático.",
    price: 30,
    duration_min: 30,
    image_url: null,
    active: true,
    sort: 11,
  },
  // ── Serviços Individuais ─────────────────────────────────────────────────
  {
    id: "s2000000-0000-4000-8000-000000000001",
    name: "Sobrancelha",
    description: "Alinhamento e design de sobrancelha na navalha.",
    price: 15,
    duration_min: 5,
    image_url: null,
    active: true,
    sort: 12,
  },
  {
    id: "s2000000-0000-4000-8000-000000000002",
    name: "Cavanhaque",
    description: "Aparação e alinhamento do cavanhaque com acabamento navalhado.",
    price: 15,
    duration_min: 10,
    image_url: null,
    active: true,
    sort: 13,
  },
  {
    id: "s2000000-0000-4000-8000-000000000003",
    name: "Barba",
    description: "Barba completa com toalha quente e acabamento navalhado.",
    price: 30,
    duration_min: 20,
    image_url: null,
    active: true,
    sort: 14,
  },
  {
    id: "s2000000-0000-4000-8000-000000000004",
    name: "Barboterapia",
    description: "Tratamento completo de barba: toalha quente, massagem facial, esfoliação e óleo hidratante.",
    price: 40,
    duration_min: 30,
    image_url: null,
    active: true,
    sort: 15,
  },
  {
    id: "s2000000-0000-4000-8000-000000000005",
    name: "Pigmentação",
    description: "Aplicação de pigmentação para cobrir falhas e uniformizar a barba ou cabelo.",
    price: 30,
    duration_min: 30,
    image_url: null,
    active: true,
    sort: 16,
  },
  {
    id: "s2000000-0000-4000-8000-000000000006",
    name: "Penteado",
    description: "Finalização e penteado personalizado com produtos premium.",
    price: 20,
    duration_min: 20,
    image_url: null,
    active: true,
    sort: 17,
  },
  {
    id: "s2000000-0000-4000-8000-000000000007",
    name: "Alisante",
    description: "Aplicação de alisante para um visual liso e controlado.",
    price: 30,
    duration_min: 20,
    image_url: null,
    active: true,
    sort: 18,
  },
  {
    id: "s2000000-0000-4000-8000-000000000008",
    name: "Luzes",
    description: "Aplicação de luzes para realçar e iluminar o visual.",
    price: 60,
    duration_min: 180,
    image_url: null,
    active: true,
    sort: 19,
  },
  {
    id: "s2000000-0000-4000-8000-000000000009",
    name: "Progressiva",
    description: "Progressiva capilar para alisar e reduzir o volume dos fios.",
    price: 0,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 20,
  },
  {
    id: "s2000000-0000-4000-8000-000000000010",
    name: "Botox capilar",
    description: "Tratamento de botox capilar para hidratar, brilhar e reduzir o frizz.",
    price: 50,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 21,
  },
  {
    id: "s2000000-0000-4000-8000-000000000011",
    name: "Pezinho",
    description: "Contorno das laterais e nuca na navalha.",
    price: 15,
    duration_min: 10,
    image_url: null,
    active: true,
    sort: 22,
  },
  // ── Pacotes Mensais ──────────────────────────────────────────────────────
  {
    id: "p3000000-0000-4000-8000-000000000001",
    name: "Pacote mensal 1",
    description: "Pacote mensal com corte semanal — ideal para quem corta toda semana.",
    price: 120,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 23,
  },
  {
    id: "p3000000-0000-4000-8000-000000000002",
    name: "Pacote mensal 2",
    description: "Pacote mensal com corte + sobrancelha semanais.",
    price: 140,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 24,
  },
  {
    id: "p3000000-0000-4000-8000-000000000003",
    name: "Pacote mensal 3",
    description: "Pacote mensal com corte + cavanhaque semanais.",
    price: 160,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 25,
  },
  {
    id: "p3000000-0000-4000-8000-000000000004",
    name: "Pacote mensal 4",
    description: "Pacote mensal completo com corte + barba semanais.",
    price: 200,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 26,
  },
  {
    id: "p3000000-0000-4000-8000-000000000005",
    name: "Pacote mensal 5",
    description: "Pacote mensal premium com corte + barboterapia semanais.",
    price: 240,
    duration_min: 60,
    image_url: null,
    active: true,
    sort: 27,
  },
];

export const DEFAULT_BUSINESS_HOURS: Hours[] = [
  { weekday: 0, is_open: false, open_time: "09:00", close_time: "13:00", lunch_start: null, lunch_end: null }, // Domingo fechado
  { weekday: 1, is_open: false, open_time: "09:00", close_time: "19:00", lunch_start: "12:00", lunch_end: "13:00" }, // Segunda fechado
  { weekday: 2, is_open: true, open_time: "09:00", close_time: "19:00", lunch_start: "12:00", lunch_end: "13:00" }, // Terça
  { weekday: 3, is_open: true, open_time: "09:00", close_time: "19:00", lunch_start: "12:00", lunch_end: "13:00" }, // Quarta
  { weekday: 4, is_open: true, open_time: "09:00", close_time: "19:00", lunch_start: "12:00", lunch_end: "13:00" }, // Quinta
  { weekday: 5, is_open: true, open_time: "09:00", close_time: "20:00", lunch_start: "12:00", lunch_end: "13:00" }, // Sexta
  { weekday: 6, is_open: true, open_time: "08:00", close_time: "18:00", lunch_start: "12:00", lunch_end: "13:00" }, // Sábado
];

/** Fetch services with bulletproof fallback */
export async function getServicesList(): Promise<ServiceItem[]> {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("id,name,description,price,duration_min,image_url,active,sort")
      .eq("active", true)
      .order("sort");

    if (!error && data && data.length > 0) {
      return data.map((s) => ({
        ...s,
        description: s.description ?? "",
        price: Number(s.price),
      })) as ServiceItem[];
    }
  } catch (err) {
    console.warn("Using default services fallback:", err);
  }

  return DEFAULT_SERVICES;
}

/** Fetch business hours with fallback */
export async function getBusinessHoursList(): Promise<Hours[]> {
  try {
    const { data, error } = await supabase.from("business_hours").select("*").order("weekday");
    if (!error && data && data.length > 0) {
      return data as Hours[];
    }
  } catch {
    // fallback
  }
  return DEFAULT_BUSINESS_HOURS;
}
