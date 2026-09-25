-- Izvještaj po objektima i artiklima za izabrani period (lokalni datumi, Europe/Sarajevo):
-- izdato iz magacina, potrošeno (iz zatvorenih smjena), izuzeci, manjak pri prijemu, višak pri zatvaranju,
-- razlika (izdato − potrošeno), trenutna zaliha objekta i vrijednosti.
--
-- Sve se računa iz nepromjenjive knjige objekta, po cijenama kakve su bile pri knjiženju, pa se brojke
-- slažu sa smjenama i ne mijenjaju kasnijim promjenama cijena. Poništena (stornirana) izdavanja se
-- izostavljaju u cijelosti, jer je njihov konačni učinak nula.

create function magacin.izvjestaj_objekata(p_od date, p_do date, p_objekat uuid default null)
returns table (
  objekat_id uuid,
  objekat text,
  artikal_id uuid,
  artikal text,
  mjera magacin.mjera,
  izdato numeric,
  manjak numeric,
  potroseno numeric,
  izuzeci numeric,
  visak numeric,
  -- Razlika u periodu: izdato − potrošeno.
  razlika numeric,
  -- Ukupna promjena zalihe objekta u periodu: izdato − manjak − potrošeno − izuzeci + višak.
  promjena_zalihe numeric,
  zaliha_sada numeric,
  vrijednost_izdatog numeric,
  trosak_potrosnje numeric,
  trosak_izuzetaka numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_od timestamptz;
  v_do timestamptz;
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  if p_od is null or p_do is null or p_od > p_do then
    raise exception 'Neispravan period: početak mora biti prije kraja' using errcode = '22023';
  end if;
  v_od := p_od::timestamp at time zone 'Europe/Sarajevo';
  v_do := (p_do + 1)::timestamp at time zone 'Europe/Sarajevo';

  return query
  with kretanja as (
    select ko.objekat_id, ko.artikal_id, ko.vrsta, ko.kolicina, ko.cijena
    from magacin.kretanje_objekta ko
    left join magacin.zahtjev z on z.id = ko.zahtjev_id
    where ko.vrijeme >= v_od and ko.vrijeme < v_do
      and (p_objekat is null or ko.objekat_id = p_objekat)
      and ko.vrsta <> 'storno_izdavanja'
      and (z.id is null or z.status <> 'stornirano')
  ),
  zbir as (
    select k.objekat_id, k.artikal_id,
           coalesce(sum(k.kolicina) filter (where k.vrsta = 'izdavanje'), 0) as izdato,
           coalesce(-sum(k.kolicina) filter (where k.vrsta = 'razlika_pri_prijemu'), 0) as manjak,
           coalesce(-sum(k.kolicina) filter (where k.vrsta = 'potrosnja'), 0) as potroseno,
           coalesce(-sum(k.kolicina) filter (where k.vrsta = 'izuzetak'), 0) as izuzeci,
           coalesce(sum(k.kolicina) filter (where k.vrsta = 'visak_pri_zatvaranju'), 0) as visak,
           coalesce(sum(k.kolicina * k.cijena) filter (where k.vrsta = 'izdavanje'), 0) as vrijednost_izdatog,
           coalesce(-sum(k.kolicina * k.cijena) filter (where k.vrsta = 'potrosnja'), 0) as trosak_potrosnje,
           coalesce(-sum(k.kolicina * k.cijena) filter (where k.vrsta = 'izuzetak'), 0) as trosak_izuzetaka
    from kretanja k
    group by k.objekat_id, k.artikal_id
  )
  select z.objekat_id, o.naziv, z.artikal_id, a.naziv, a.mjera,
         z.izdato, z.manjak, z.potroseno, z.izuzeci, z.visak,
         z.izdato - z.potroseno,
         z.izdato - z.manjak - z.potroseno - z.izuzeci + z.visak,
         coalesce(zo.kolicina, 0),
         z.vrijednost_izdatog, z.trosak_potrosnje, z.trosak_izuzetaka
  from zbir z
  join magacin.objekat o on o.id = z.objekat_id
  join magacin.artikal a on a.id = z.artikal_id
  left join magacin.zaliha_objekta zo on zo.objekat_id = z.objekat_id and zo.artikal_id = z.artikal_id
  where z.izdato <> 0 or z.manjak <> 0 or z.potroseno <> 0 or z.izuzeci <> 0 or z.visak <> 0
  order by o.naziv, a.naziv;
end
$$;
