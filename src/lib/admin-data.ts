import { supabase } from "@/integrations/supabase/client";

export type AdminAppt = {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  is_free: boolean;
  client_id: string;
  created_at: string;
  profiles: { name: string; nickname: string | null; phone: string; preferences: string | null } | null;
};

export async function fetchAppointments(fromIso: string, toIso: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id,service_name,starts_at,ends_at,status,price,is_free,client_id,created_at,profiles(name,nickname,phone,preferences)")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((a) => ({ ...a, price: Number(a.price) })) as AdminAppt[];
}

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não veio",
};
