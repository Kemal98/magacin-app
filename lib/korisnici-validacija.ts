/** Pravila za PIN i lozinku pri pravljenju i promjeni računa. Vraćaju poruku greške ili null. */

const SESTOCIFRENI = /^\d{6}$/;

/** PIN mora imati tačno šest cifara i ne smije biti lako pogodiv (isti brojevi ili niz). */
export function provjeriPin(pin: string): string | null {
  if (!SESTOCIFRENI.test(pin)) return "PIN mora imati tačno šest cifara.";
  if (/^(\d)\1{5}$/.test(pin)) return "PIN je previše jednostavan (isti brojevi). Izaberite drugi.";
  const cifre = [...pin].map(Number);
  const uzlazno = cifre.every((c, i) => i === 0 || c === (cifre[i - 1] + 1) % 10);
  const silazno = cifre.every((c, i) => i === 0 || c === (cifre[i - 1] + 9) % 10);
  if (uzlazno || silazno) return "PIN je previše jednostavan (niz brojeva). Izaberite drugi.";
  return null;
}

export function provjeriLozinku(lozinka: string): string | null {
  if (lozinka.length < 8) return "Lozinka mora imati bar 8 znakova.";
  return null;
}

export function provjeriEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : "Upišite ispravnu e-adresu.";
}

/** Tehnička adresa za prijavu PIN-om (osoba je ne vidi; bira se ime). */
export const adresaZaPin = (id: string) => `${id}@korisnik.magacin.local`;
