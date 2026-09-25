/** Poruka za zaključan račun; ne govori ništa o tome koliko je PIN blizu tačnog. */
export function porukaZakljucano(do_: string | Date, sada: Date = new Date()): string {
  const minuta = Math.max(1, Math.ceil((new Date(do_).getTime() - sada.getTime()) / 60_000));
  return `Račun je privremeno zaključan zbog previše pogrešnih pokušaja. Pokušajte ponovo za ${minuta} min ili se obratite menadžeru.`;
}
