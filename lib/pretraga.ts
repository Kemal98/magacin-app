/**
 * Pretraga u listama i tabelama. Ne razlikuje velika i mala slova ni slova s kvačicama (č/ć → c, š → s,
 * ž → z, đ → d), pa "secer" nalazi "Šećer". Više riječi znači da moraju biti prisutne sve (bilo kojim redom).
 */

export function normaliziraj(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Da li tekst sadrži svaku riječ iz upita. Prazan upit poklapa sve. */
export function poklapa(tekst: string, upit: string): boolean {
  const rijeci = normaliziraj(upit).split(" ").filter(Boolean);
  if (rijeci.length === 0) return true;
  const cist = normaliziraj(tekst);
  return rijeci.every((r) => cist.includes(r));
}
