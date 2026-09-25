import { Okvir } from "@/app/_components/okvir";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { napraviServerKlijent } from "@/lib/supabase/server";

export const metadata = { title: "Objekat" };

type ArtikalObjekta = { id: string; naziv: string; mjera: string };

export default async function ObjekatPocetna() {
  const korisnik = await zahtijevajUlogu("objekat");
  const supabase = await napraviServerKlijent();
  const { data, error } = await supabase.rpc("artikli_objekta");
  const artikli = (data ?? []) as ArtikalObjekta[];

  return (
    <Okvir korisnik={korisnik} naslov="Objekat">
      <h2 className="text-2xl font-semibold">Vaši artikli</h2>
      {error ? (
        <p role="alert" className="text-xl font-semibold text-red-700">
          {error.message}
        </p>
      ) : artikli.length === 0 ? (
        <p className="text-xl text-zinc-500">Menadžer još nije zadao artikle za vaš objekat.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {artikli.map((a) => (
            <li key={a.id} className="rounded-xl border-2 border-zinc-200 p-3 text-xl">
              {a.naziv} <span className="text-zinc-500">({a.mjera})</span>
            </li>
          ))}
        </ul>
      )}
    </Okvir>
  );
}
