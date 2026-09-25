import { Nazad } from "@/app/_components/nazad";
import { Okvir } from "@/app/_components/okvir";
import { km, kolicina as fmt } from "@/lib/format";
import { ucitajIzvjestaj, ucitajObjekte } from "@/lib/izvjestaji";
import { poArtiklu, poObjektu, ukupanTrosak, zbir } from "@/lib/izvjestaji-tipovi";
import { zahtijevajUlogu } from "@/lib/korisnik";
import { danasSarajevo, periodIzParametara } from "@/lib/period";
import { IzvjestajFilter, IzvjestajKartice } from "./filter";

export const metadata = { title: "Izvještaj: trošak i potrošnja" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TrosakStranica({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string; objekat?: string }>;
}) {
  const korisnik = await zahtijevajUlogu("menadzer");
  const q = await searchParams;
  const { od, do: kraj } = periodIzParametara(q.od, q.do, danasSarajevo());
  const objekat = q.objekat && UUID.test(q.objekat) ? q.objekat : undefined;
  const [redovi, objekti] = await Promise.all([ucitajIzvjestaj(od, kraj, objekat), ucitajObjekte()]);

  const ukupno = zbir(redovi);
  const objekti_ = poObjektu(redovi);
  const artikli = poArtiklu(redovi);

  return (
    <Okvir korisnik={korisnik} naslov="Izvještaji">
      <Nazad href="/menadzer" />
      <IzvjestajKartice aktivno="trosak" od={od} do={kraj} objekat={objekat} />
      <IzvjestajFilter putanja="/menadzer/izvjestaji" od={od} do={kraj} objekat={objekat} objekti={objekti} />

      <section className="rounded-2xl border-2 border-brand bg-brand-soft p-4">
        <p className="text-lg text-zinc-600">
          Trošak u periodu {od} – {kraj}
        </p>
        <p className="text-4xl font-bold">{km(ukupanTrosak(ukupno))}</p>
        <p className="text-xl text-zinc-700">
          potrošnja {km(ukupno.trosak_potrosnje)} + izuzeci {km(ukupno.trosak_izuzetaka)}
        </p>
      </section>

      {redovi.length === 0 ? (
        <p className="text-xl text-zinc-500">Nema podataka za izabrani period i objekat.</p>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Po objektu</h2>
            {objekti_.map((g) => (
              <div key={g.objekat_id} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-2xl font-bold">{g.objekat}</h3>
                  <p className="text-xl font-bold">{km(ukupanTrosak(g.zbir))}</p>
                </div>
                <table className="w-full text-left text-lg">
                  <thead>
                    <tr className="border-b-2 border-zinc-300">
                      <th className="py-1">Artikal</th>
                      <th className="py-1 text-right">Potrošeno</th>
                      <th className="py-1 text-right">Trošak</th>
                      <th className="py-1 text-right">Izuzeci</th>
                      <th className="py-1 text-right">Trošak izuzetaka</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.redovi
                      .filter((r) => r.potroseno > 0 || r.izuzeci > 0)
                      .map((r) => (
                        <tr key={r.artikal_id} className="border-b border-zinc-200">
                          <td className="py-1">{r.artikal}</td>
                          <td className="py-1 text-right">
                            {fmt(r.potroseno)} {r.mjera}
                          </td>
                          <td className="py-1 text-right font-semibold">{km(r.trosak_potrosnje)}</td>
                          <td className="py-1 text-right">{r.izuzeci > 0 ? `${fmt(r.izuzeci)} ${r.mjera}` : "—"}</td>
                          <td className="py-1 text-right">{r.izuzeci > 0 ? km(r.trosak_izuzetaka) : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-2xl font-semibold">Po artiklu (svi izabrani objekti)</h2>
            <table className="w-full text-left text-lg">
              <thead>
                <tr className="border-b-2 border-zinc-300">
                  <th className="py-1">Artikal</th>
                  <th className="py-1 text-right">Potrošeno</th>
                  <th className="py-1 text-right">Izuzeci</th>
                  <th className="py-1 text-right">Ukupan trošak</th>
                </tr>
              </thead>
              <tbody>
                {artikli
                  .filter((a) => a.potroseno > 0 || a.izuzeci > 0)
                  .map((a) => (
                    <tr key={a.artikal_id} className="border-b border-zinc-200">
                      <td className="py-1">{a.artikal}</td>
                      <td className="py-1 text-right">
                        {fmt(a.potroseno)} {a.mjera}
                      </td>
                      <td className="py-1 text-right">{a.izuzeci > 0 ? `${fmt(a.izuzeci)} ${a.mjera}` : "—"}</td>
                      <td className="py-1 text-right font-semibold">{km(ukupanTrosak(a))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </Okvir>
  );
}
