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
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Corte Clássico",
    description: "Tesoura e máquina, acabamento impecável na navalha com toalha refrescante.",
    price: 45,
    duration_min: 40,
    image_url: null,
    active: true,
    sort: 1,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Degradê Navalhado (Fade)",
    description: "Degradê do zero ao topo com navalhete, alinhamento de pezinho e finalização.",
    price: 50,
    duration_min: 45,
    image_url: null,
    active: true,
    sort: 2,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Barba Terapia & Alinhamento",
    description: "Toalha quente, massagem facial, esfoliação, alinhamento navalhado e óleo hidratante.",
    price: 35,
    duration_min: 30,
    image_url: null,
    active: true,
    sort: 3,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Combo Completo: Cabelo + Barba",
    description: "O combo mais pedido da Barbearia 49. Corte completo + Barba com toalha quente.",
    price: 75,
    duration_min: 70,
    image_url: null,
    active: true,
    sort: 4,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Pezinho & Acabamento",
    description: "Contorno das laterais e nuca na navalha para manter o corte alinhado.",
    price: 20,
    duration_min: 15,
    image_url: null,
    active: true,
    sort: 5,
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    name: "Sobrancelha na Navalha",
    description: "Limpeza, alinhamento e desenho simétrico na navalha.",
    price: 15,
    duration_min: 15,
    image_url: null,
    active: true,
    sort: 6,
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
