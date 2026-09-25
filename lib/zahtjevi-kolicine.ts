import type { StavkaZahtjeva } from "@/lib/zahtjevi-tipovi";

/**
 * Koliko od tražene količine (u jedinici u kojoj je traženo, npr. kutija) stvarno ima u magacinu.
 * Ako se stanje ne zna (null), vrijedi tražena količina.
 */
export function kolikoIma(s: StavkaZahtjeva, trazeno: number): number {
  if (s.na_stanju === null) return trazeno;
  const faktor = s.trazena_kolicina > 0 ? s.trazena_osnovna / s.trazena_kolicina : 1;
  const uJedinici = Math.floor((s.na_stanju / faktor) * 1000 + 1e-9) / 1000;
  return Math.max(0, Math.min(trazeno, uJedinici));
}
