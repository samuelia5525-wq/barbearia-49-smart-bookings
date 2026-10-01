import corte from "@/assets/corte.jpg";
import barba from "@/assets/barba.jpg";
import combo from "@/assets/combo.jpg";

export function serviceImage(name: string, url?: string | null) {
  if (url) return url;
  const n = name.toLowerCase();
  if (n.includes("combo") || n.includes("pacote")) return combo;
  if (
    n.includes("barba") ||
    n.includes("sobrancelha") ||
    n.includes("cavanhaque") ||
    n.includes("barboterapia") ||
    n.includes("pezinho")
  ) return barba;
  return corte;
}
