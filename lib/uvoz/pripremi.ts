import {
  bezDuplikata,
  kljuc,
  ocistiDobavljaca,
  ocistiMjeru,
  ocistiObjekat,
  predloziVrstu,
  type Mjera,
  type Vrsta,
} from "./ocisti";
import { procitajTabele } from "./xlsx";

export type UvozArtikal = { naziv: string; mjera: Mjera; vrsta: Vrsta };

export type PripremljenUvoz = {
  artikli: UvozArtikal[];
  objekti: string[];
  dobavljaci: string[];
  /** Šta je pri čišćenju promijenjeno ili preskočeno, za pregled menadžera. */
  napomene: string[];
};

const nazivZaSpajanje = (t: string) => t.replace(/\s+/g, " ").trim();

/** Čita Excel i vraća očišćene artikle, objekte i dobavljače. Historija ulaza i utrošaka se ne čita. */
export function pripremiUvoz(fajl: Uint8Array): PripremljenUvoz {
  const t = procitajTabele(fajl, ["ARTIKLI", "OBJEKTI", "DOBAVLJAČI"]);
  const napomene: string[] = [];

  const artikli: UvozArtikal[] = [];
  const vidjeni = new Set<string>();
  const promjeneMjere = new Map<string, number>();
  const nepoznateMjere: string[] = [];
  // Prvi red je zaglavlje (nazivi kolona).
  for (const red of t.ARTIKLI.slice(1)) {
    const naziv = nazivZaSpajanje(red.A ?? "");
    if (!naziv) continue;
    if (vidjeni.has(kljuc(naziv))) {
      napomene.push(`Artikal "${naziv}" se u Excelu ponavlja; uvezen je jednom.`);
      continue;
    }
    const mjera = ocistiMjeru(red.B ?? "");
    if (!mjera) {
      nepoznateMjere.push(`${naziv} (${(red.B ?? "").trim() || "bez jedinice"})`);
      continue;
    }
    if (mjera.promijenjena) {
      const sirova = (red.B ?? "").trim();
      const kljucPromjene = `${sirova} → ${mjera.mjera}`;
      promjeneMjere.set(kljucPromjene, (promjeneMjere.get(kljucPromjene) ?? 0) + 1);
    }
    vidjeni.add(kljuc(naziv));
    artikli.push({ naziv, mjera: mjera.mjera, vrsta: predloziVrstu(naziv) });
  }
  for (const [promjena, broj] of promjeneMjere) {
    napomene.push(`Jedinica ${promjena}: ${broj} artikala.`);
  }
  for (const n of nepoznateMjere) {
    napomene.push(`Preskočen artikal s nepoznatom jedinicom: ${n}.`);
  }

  const sviObjekti = t.OBJEKTI.slice(1).map((r) => ocistiObjekat(r.A ?? ""));
  const objekti = bezDuplikata(sviObjekti);
  const spojeno = sviObjekti.filter(Boolean).length - objekti.length;
  if (spojeno > 0) napomene.push(`Spojeno duplih objekata: ${spojeno}.`);

  const sviDobavljaci = t["DOBAVLJAČI"].map((r) => ocistiDobavljaca(r.A ?? ""));
  const dobavljaci = bezDuplikata(sviDobavljaci);
  const spojeniDobavljaci = sviDobavljaci.filter(Boolean).length - dobavljaci.length;
  if (spojeniDobavljaci > 0) napomene.push(`Spojeno duplih dobavljača: ${spojeniDobavljaci}.`);

  return { artikli, objekti, dobavljaci, napomene };
}
