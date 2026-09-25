import { nabavkaUListove } from "@/lib/izvoz";
import { xlsxOdgovor } from "@/lib/izvoz-odgovor";
import { trenutniKorisnik } from "@/lib/korisnik";
import { ucitajArtikleDobavljaca, ucitajIsporuke, ucitajNabavku } from "@/lib/nabavka";
import { danasSarajevo, periodIzParametara, zadnjihDana } from "@/lib/period";
import { napraviXlsx } from "@/lib/xlsx-pisanje";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nabavka po dobavljačima za period (svi ili jedan dobavljač); magacioner i menadžer. */
export async function GET(zahtjev: Request) {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return new Response("Niste prijavljeni.", { status: 401 });
  if (korisnik.uloga !== "magacioner" && korisnik.uloga !== "menadzer") {
    return new Response("Nemate pravo na ovu radnju.", { status: 403 });
  }

  const q = new URL(zahtjev.url).searchParams;
  const danas = danasSarajevo();
  const { od, do: kraj } = periodIzParametara(q.get("od") ?? undefined, q.get("do") ?? undefined, danas, zadnjihDana(90, danas));
  const izabrani = q.get("dobavljac") && UUID.test(q.get("dobavljac")!) ? q.get("dobavljac")! : undefined;

  const pregled = await ucitajNabavku(od, kraj);
  // Dobavljači koji nisu ništa isporučili (ni poništili) u periodu ostaju samo u pregledu, bez praznih detalja.
  const zaDetalje = pregled.filter((d) => (izabrani ? d.dobavljac_id === izabrani : d.broj_isporuka > 0 || d.stornirano > 0));
  const dobavljaci = await Promise.all(
    zaDetalje.map(async (dobavljac) => ({
      dobavljac,
      isporuke: await ucitajIsporuke(dobavljac.dobavljac_id, od, kraj),
      artikli: await ucitajArtikleDobavljaca(dobavljac.dobavljac_id, od, kraj),
    })),
  );
  const zaPregled = izabrani
    ? dobavljaci
    : pregled.map((dobavljac) => dobavljaci.find((d) => d.dobavljac.dobavljac_id === dobavljac.dobavljac_id) ?? { dobavljac, isporuke: [], artikli: [] });

  const naziv = izabrani ? (pregled.find((d) => d.dobavljac_id === izabrani)?.naziv ?? "Dobavljač") : "Svi dobavljači";
  const fajl = napraviXlsx(nabavkaUListove(zaPregled, { od, do: kraj, objekat: naziv, izvezao: korisnik.ime, izvezeno: danas }));
  return xlsxOdgovor(fajl, `nabavka-${od}_${kraj}.xlsx`);
}
