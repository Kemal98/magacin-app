"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";
import { predloziPopis, procitajUtroske, type PrijedlogPopisa } from "@/lib/uvoz/predlozi";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAJVECI_FAJL = 5 * 1024 * 1024;

export type StanjeSnimanja = { greska?: string } | undefined;
export type StanjePrijedloga = { greska: string } | { prijedlog: PrijedlogPopisa } | undefined;

/** Snima popis artikala objekta (zamjenjuje raniji). */
export async function sacuvajPopis(
  objekatId: string,
  _stanje: StanjeSnimanja,
  forma: FormData,
): Promise<StanjeSnimanja> {
  await zahtijevajUlogu("menadzer");
  const artikli = forma.getAll("artikal").map(String);
  if (!UUID.test(objekatId) || !artikli.every((a) => UUID.test(a))) {
    return { greska: "Podaci nisu ispravni. Osvježite stranicu." };
  }
  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("postavi_artikle_objekta", {
    p_objekat: objekatId,
    p_artikli: artikli,
  });
  if (error) return { greska: "Popis nije snimljen. Pokušajte ponovo." };
  revalidatePath("/menadzer", "layout");
  redirect("/menadzer/objekti");
}

/** Prijedlog popisa iz utrošaka objekta u starom Excelu; ništa se ne snima. */
export async function predloziIzExcela(
  objekatId: string,
  _stanje: StanjePrijedloga,
  forma: FormData,
): Promise<StanjePrijedloga> {
  await zahtijevajUlogu("menadzer");
  if (!UUID.test(objekatId)) return { greska: "Nepoznat objekat." };
  const fajl = forma.get("fajl");
  if (typeof fajl === "string" || fajl === null || fajl.size === 0) {
    return { greska: "Izaberite Excel fajl (Utrošci - zalihe.xlsx)." };
  }
  if (fajl.size > NAJVECI_FAJL) return { greska: "Fajl je prevelik (najviše 5 MB)." };

  const supabase = await napraviServerKlijent();
  const [objekat, artikli] = await Promise.all([
    supabase.from("objekat").select("naziv").eq("id", objekatId).maybeSingle(),
    supabase.from("artikal").select("id, naziv").eq("aktivan", true),
  ]);
  if (objekat.error || artikli.error || !objekat.data) {
    return { greska: "Učitavanje šifrarnika nije uspjelo." };
  }
  try {
    const utrosci = procitajUtroske(new Uint8Array(await fajl.arrayBuffer()));
    return { prijedlog: predloziPopis(utrosci, objekat.data.naziv, artikli.data) };
  } catch (e) {
    return { greska: e instanceof Error ? e.message : "Fajl se ne može pročitati." };
  }
}
