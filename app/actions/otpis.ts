"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { broj } from "@/lib/broj";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";

export type StanjeForme = { greska?: string } | undefined;

const PORUKE_ZA_KORISNIKA = new Set(["22023", "P0002", "42501"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Magacioner otpisuje robu iz magacina uz obavezan razlog. */
export async function otpisiRobu(_stanje: StanjeForme, forma: FormData): Promise<StanjeForme> {
  await zahtijevajUlogu("magacioner");
  const artikal = String(forma.get("artikal") ?? "");
  const pakovanje = String(forma.get("pakovanje") ?? "");
  const kolicina = broj(String(forma.get("kolicina") ?? ""));
  if (!UUID.test(artikal)) return { greska: "Izaberite artikal s liste." };
  if (!Number.isFinite(kolicina) || kolicina <= 0) return { greska: "Količina mora biti veća od nule." };

  const supabase = await napraviServerKlijent();
  const { error } = await supabase.rpc("otpisi_iz_magacina", {
    p_artikal: artikal,
    p_kolicina: kolicina,
    p_razlog: String(forma.get("razlog") ?? ""),
    p_pakovanje: UUID.test(pakovanje) ? pakovanje : null,
  });
  if (error) {
    return {
      greska: error.code && PORUKE_ZA_KORISNIKA.has(error.code) ? error.message : "Otpis nije snimljen. Pokušajte ponovo.",
    };
  }
  revalidatePath("/magacin", "layout");
  redirect("/magacin/otpis?otpisano=1");
}
