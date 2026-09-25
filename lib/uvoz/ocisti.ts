/**
 * Čišćenje podataka iz starog Excela prije uvoza u šifrarnik.
 * Čiste funkcije bez ulaza/izlaza, da se mogu testirati same.
 */

export type Mjera = "kg" | "l" | "kom";
export type Vrsta = "prehrana" | "materijal";

const razmaci = (t: string) => t.replace(/\s+/g, " ").trim();

/** Ključ za poređenje naziva: bez razlike u velikim slovima i razmacima. */
export function kljuc(naziv: string): string {
  return razmaci(naziv).toLowerCase();
}

/**
 * Ujednačava jedinicu iz Excela. `jkg` je pogreška u kucanju za kg, a `pak`
 * (pakovanje) sistem nema kao osnovnu mjeru pa se vodi kao komad.
 */
export function ocistiMjeru(sirova: string): { mjera: Mjera; promijenjena: boolean } | null {
  const j = sirova.trim().toLowerCase();
  if (j === "kg" || j === "l" || j === "kom") {
    return { mjera: j, promijenjena: j !== sirova.trim() };
  }
  if (j === "jkg") return { mjera: "kg", promijenjena: true };
  if (j === "pak") return { mjera: "kom", promijenjena: true };
  return null;
}

/** Naziv objekta: velika slova, jedan razmak, ispravljen pravopis (PIZERIA → PIZZERIA). */
export function ocistiObjekat(naziv: string): string {
  return razmaci(naziv).toUpperCase().replace(/\bPIZERIA\b/g, "PIZZERIA");
}

/** Naziv dobavljača: bez navodnika i dvostrukih razmaka. */
export function ocistiDobavljaca(naziv: string): string {
  return razmaci(naziv.replace(/["„“”]/g, ""));
}

/** Uklanja duplikate (bez obzira na velika slova); prvi ostaje. */
export function bezDuplikata(nazivi: string[]): string[] {
  const vidjeni = new Set<string>();
  const izlaz: string[] = [];
  for (const n of nazivi) {
    if (!n || vidjeni.has(kljuc(n))) continue;
    vidjeni.add(kljuc(n));
    izlaz.push(n);
  }
  return izlaz;
}

function bezDijakritika(t: string): string {
  return t
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Po čemu se prepoznaje materijal (čišćenje, higijena, ambalaža, pribor).
// Riječi se traže kao početak riječi u nazivu (bez dijakritika), fraze kao dio naziva.
const MATERIJAL_RIJECI = [
  "deterd", "dez", "dezinf", "sred", "sredstvo", "sapun", "sampon", "omeksiv", "osvjezi",
  "cisc", "pranje", "papir", "ubrus", "salvet", "rukavic", "vrec", "folij", "case",
  "tanjir", "kasik", "vilju", "slamk", "cackalic", "spuzva", "krpa", "cetka", "mop", "pitroid",
  "ratimor", "florahum", "vata", "pamuk", "medicinske", "destilovana", "piceta", "faks", "tork",
  "suma", "trulex", "exo", "domestos", "ajax", "varikina", "glanz", "arf", "hypofoam", "unox",
  "sanea", "avaxon", "rese",
];
const MATERIJAL_FRAZE = [
  "gel za kosu", "sjaj za sud", "sol za masinu", "sol za stoku", "kapa kuhinjska", "ulje za masazu",
  "solna kiselina", "set lopatica", "inox zica", "kocka za potpalu", "kuglice za wc", "room care",
  "san forte", "san sanitar", "sani calc", "koncentrat za dubinsko",
];

/**
 * Prijedlog podjele na prehranu i materijal po nazivu. Samo prijedlog:
 * menadžer ga pregleda i ispravlja prije potvrde uvoza.
 */
export function predloziVrstu(naziv: string): Vrsta {
  const n = bezDijakritika(razmaci(naziv));
  const rijeci = n.split(/[^a-z0-9]+/).filter(Boolean);
  const materijal =
    MATERIJAL_FRAZE.some((f) => n.includes(f)) ||
    rijeci.some((r) => MATERIJAL_RIJECI.some((k) => r.startsWith(k)));
  return materijal ? "materijal" : "prehrana";
}
