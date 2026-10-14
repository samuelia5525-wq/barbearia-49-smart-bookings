import { getAdminAppointmentsFn } from "./admin.functions";

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
  try {
    const list = await getAdminAppointmentsFn({ data: { from: fromIso, to: toIso } });
    return (list ?? []).map((a) => ({ ...a, price: Number(a.price) })) as AdminAppt[];
  } catch (err) {
    console.error("Erro ao carregar agendamentos do servidor:", err);
    return [] as AdminAppt[];
  }
}

export const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não veio",
};
