import { izvjestajUListove } from "@/lib/izvoz";
import { xlsxOdgovor } from "@/lib/izvoz-odgovor";
import { ucitajIzvjestaj, ucitajObjekte } from "@/lib/izvjestaji";
import { trenutniKorisnik } from "@/lib/korisnik";
import { danasSarajevo, periodIzParametara } from "@/lib/period";
import { napraviXlsx } from "@/lib/xlsx-pisanje";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Izvještaji za izabrani period i objekat (isti parametri kao na ekranu); samo menadžer. */
export async function GET(zahtjev: Request) {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return new Response("Niste prijavljeni.", { status: 401 });
  if (korisnik.uloga !== "menadzer") return new Response("Nemate pravo na ovu radnju.", { status: 403 });

  const q = new URL(zahtjev.url).searchParams;
  const danas = danasSarajevo();
  const { od, do: kraj } = periodIzParametara(q.get("od") ?? undefined, q.get("do") ?? undefined, danas);
  const objekatId = q.get("objekat") && UUID.test(q.get("objekat")!) ? q.get("objekat")! : undefined;

  const [redovi, objekti] = await Promise.all([ucitajIzvjestaj(od, kraj, objekatId), ucitajObjekte()]);
  const nazivObjekta = objekti.find((o) => o.id === objekatId)?.naziv ?? "Svi objekti";
  const fajl = napraviXlsx(
    izvjestajUListove(redovi, { od, do: kraj, objekat: nazivObjekta, izvezao: korisnik.ime, izvezeno: danas }),
  );
  return xlsxOdgovor(fajl, `izvjestaj-${od}_${kraj}.xlsx`);
}
