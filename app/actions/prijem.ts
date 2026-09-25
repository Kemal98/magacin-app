"use server";

import { redirect } from "next/navigation";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { jeDatum } from "@/lib/period";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjePrijema = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Broj iz forme; dozvoljava i zarez kao decimalni znak. */
function broj(tekst: string): number {
  const t = tekst.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
}

export async function unesiPrijem(_stanje: StanjePrijema, forma: FormData): Promise<StanjePrijema> {
  await zahtijevajUlogu("magacioner");
  const dobavljac = String(forma.get("dobavljac") ?? "");
  if (!UUID.test(dobavljac)) return { greska: "Izaberite dobavljača." };

  const artikli = forma.getAll("artikal").map(String);
  const pakovanja = forma.getAll("pakovanje").map(String);
  const kolicine = forma.getAll("kolicina").map(String);
  const cijene = forma.getAll("cijena").map(String);
  const stavke = [];
  for (let i = 0; i < artikli.length; i++) {
    // Red bez ičega je prazan i preskače se.
    if (!artikli[i] && !kolicine[i].trim() && !cijene[i].trim()) continue;
    if (!UUID.test(artikli[i])) return { greska: `Red ${i + 1}: izaberite artikal s liste.` };
    const kol = broj(kolicine[i]);
    const cij = broj(cijene[i]);
    if (!Number.isFinite(kol) || kol <= 0) return { greska: `Red ${i + 1}: količina mora biti veća od nule.` };
    if (!Number.isFinite(cij) || cij < 0) return { greska: `Red ${i + 1}: upišite nabavnu cijenu.` };
    stavke.push({
      artikal_id: artikli[i],
      pakovanje_id: UUID.test(pakovanja[i]) ? pakovanja[i] : null,
      kolicina: kol,
      cijena: cij,
    });
  }
  if (stavke.length === 0) return { greska: "Dodajte bar jedan artikal." };

  // Podaci o isporuci (nije obavezno): kad je roba stigla, broj otpremnice ili računa i napomena.
  const datum = String(forma.get("datum") ?? "").trim();
  if (datum && !jeDatum(datum)) return { greska: "Datum isporuke nije ispravan." };

  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("unesi_prijem", {
    p_dobavljac: dobavljac,
    p_stavke: stavke,
    p_dokument: String(forma.get("dokument") ?? ""),
    p_napomena: String(forma.get("napomena") ?? ""),
    p_datum: datum || null,
  });
  if (error) {
    return {
      greska: error.code && PORUKE_ZA_KORISNIKA.has(error.code) ? error.message : "Prijem nije snimljen. Pokušajte ponovo.",
    };
  }
  redirect("/magacin/prijem?uneseno=1");
}
