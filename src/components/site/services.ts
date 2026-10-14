import corteReal from "@/assets/corte-real.jpg";
import penteadoClassico from "@/assets/penteado-classico.jpg";
import penteadoModerno from "@/assets/penteado-moderno.jpg";
import barbeiroAcao from "@/assets/barbeiro-acao.jpg";
import promoPenteado from "@/assets/promo-penteado.jpg";
import promoPaiEFilho from "@/assets/promo-paiefilho.jpg";
import logoBarbearia49 from "@/assets/logo-barbearia49.png";
import logoEmblema from "@/assets/logo-emblema.png";
import barba from "@/assets/barba.jpg";
import combo from "@/assets/combo.jpg";
import corte from "@/assets/corte.jpg";

export {
  corteReal,
  penteadoClassico,
  penteadoModerno,
  barbeiroAcao,
  promoPenteado,
  promoPaiEFilho,
  logoBarbearia49,
  logoEmblema,
};

export function serviceImage(name: string, url?: string | null) {
  if (url) return url;
  const n = name.toLowerCase();

  // Pacote promocional Pai e Filho ou flyer específico
  if (n.includes("pai e filho")) return promoPaiEFilho;

  // Penteados específicos (da foto real do flyer)
  if (n.includes("penteado")) return penteadoClassico;

  // Procedimentos químicos e styling moderno
  if (
    n.includes("alisante") ||
    n.includes("pigmentação") ||
    n.includes("luzes") ||
    n.includes("botox") ||
    n.includes("progressiva")
  ) {
    return penteadoModerno;
  }

  // Pacotes e Combos com atendimento na cadeira
  if (n.includes("combo") || n.includes("pacote")) {
    return barbeiroAcao;
  }

  // Barba e faciais
  if (
    n.includes("barba") ||
    n.includes("barboterapia") ||
    n.includes("cavanhaque") ||
    n.includes("sobrancelha") ||
    n.includes("pezinho")
  ) {
    // Se for combo de corte + barba/sobrancelha/cavanhaque, a foto real do corte com a mão do barbeiro fica incrível
    if (n.includes("corte")) return corteReal;
    return barba;
  }

  // Cortes reais em geral
  if (n.includes("corte")) return corteReal;

  return corteReal;
}

