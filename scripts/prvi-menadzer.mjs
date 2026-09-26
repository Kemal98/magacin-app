// Pravi prvog menadžera u Supabase projektu u oblaku (jednokratno).
//
// Pokretanje:
//   SUPABASE_ACCESS_TOKEN=sbp_... PROJECT_REF=<ref> MENADZER_EMAIL=ime@firma.ba \
//   MENADZER_LOZINKA='...' node scripts/prvi-menadzer.mjs [Ime Prezime]
//
// Tajni ključ se čita iz Supabasea unutar skripte i nikad se ne ispisuje.
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_ACCESS_TOKEN, PROJECT_REF, MENADZER_EMAIL, MENADZER_LOZINKA } = process.env;
const ime = process.argv.slice(2).join(" ").trim() || "Menadžer";

if (!SUPABASE_ACCESS_TOKEN || !PROJECT_REF || !MENADZER_EMAIL || !MENADZER_LOZINKA) {
  console.error("Nedostaje: SUPABASE_ACCESS_TOKEN, PROJECT_REF, MENADZER_EMAIL ili MENADZER_LOZINKA.");
  process.exit(1);
}
if (MENADZER_LOZINKA.length < 8) {
  console.error("Lozinka mora imati najmanje 8 znakova.");
  process.exit(1);
}

const odgovor = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys?reveal=true`,
  { headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` } },
);
if (!odgovor.ok) {
  console.error(`Ne mogu pročitati ključeve projekta (HTTP ${odgovor.status}).`);
  process.exit(1);
}
const kljucevi = await odgovor.json();
const tajni = kljucevi.find((k) => k.name === "service_role")?.api_key;
if (!tajni) {
  console.error("Projekat nema service_role ključ.");
  process.exit(1);
}

const sql = async (upit, parametri = []) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: upit, parameters: parametri }),
  });
  if (!r.ok) throw new Error(`SQL greška (HTTP ${r.status}): ${await r.text()}`);
  return r.json();
};

const [{ n }] = await sql("select count(*)::int as n from magacin.korisnik where uloga = 'menadzer'");
if (n > 0) {
  console.error("Menadžer već postoji. Nove osobe pravi menadžer iz aplikacije.");
  process.exit(1);
}

const admin = createClient(`https://${PROJECT_REF}.supabase.co`, tajni, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await admin.auth.admin.createUser({
  email: MENADZER_EMAIL,
  password: MENADZER_LOZINKA,
  email_confirm: true,
});
if (error || !data.user) {
  console.error(`Ne mogu napraviti račun: ${error?.message}`);
  process.exit(1);
}

try {
  await sql("insert into magacin.korisnik (id, ime, uloga) values ($1, $2, 'menadzer')", [
    data.user.id,
    ime,
  ]);
} catch (e) {
  await admin.auth.admin.deleteUser(data.user.id);
  console.error(`Ne mogu upisati menadžera: ${e.message}`);
  process.exit(1);
}

console.log(`Menadžer napravljen: ${MENADZER_EMAIL}`);
