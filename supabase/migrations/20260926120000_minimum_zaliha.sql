-- Minimum zaliha: koliko artikla mora biti u magacinu. Kad zaliha padne ispod minimuma, artikal se
-- označava u stanju magacina i ulazi u popis za naručivanje. Upozorenja vide samo magacioner i menadžer.

-- Magacioner (i menadžer) zadaje ili mijenja minimum po artiklu, u osnovnoj mjeri.
create function magacin.postavi_minimum(p_artikal uuid, p_minimum numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  if p_minimum is null or p_minimum < 0 then
    raise exception 'Minimum ne može biti negativan' using errcode = '22023';
  end if;
  update magacin.artikal set minimum = p_minimum where id = p_artikal;
  if not found then
    raise exception 'Artikal ne postoji' using errcode = 'P0002';
  end if;
end
$$;

-- Stanje magacina uz minimum i oznaku da je artikal ispod minimuma (minimum nula znači da nije zadan).
drop function magacin.stanje_magacina(magacin.vrsta_magacina);
create function magacin.stanje_magacina(p_vrsta magacin.vrsta_magacina)
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  bar_kod text,
  kolicina numeric,
  prosjecna_cijena numeric,
  vrijednost numeric,
  minimum numeric,
  ispod_minimuma boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  return query
  select a.id, a.naziv, a.mjera, a.bar_kod,
         coalesce(z.kolicina, 0),
         coalesce(z.prosjecna_cijena, 0),
         coalesce(z.kolicina * z.prosjecna_cijena, 0),
         a.minimum,
         a.minimum > 0 and coalesce(z.kolicina, 0) < a.minimum
  from magacin.artikal a
  left join magacin.zaliha_magacina z on z.artikal_id = a.id
  where a.vrsta = p_vrsta and a.aktivan
  order by a.naziv;
end
$$;

-- Artikli ispod minimuma (za naručivanje), najprazniji prvi. p_vrsta nije obavezno.
create function magacin.artikli_ispod_minimuma(p_vrsta magacin.vrsta_magacina default null)
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  vrsta magacin.vrsta_magacina,
  kolicina numeric,
  minimum numeric,
  nedostaje numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  return query
  select a.id, a.naziv, a.mjera, a.vrsta,
         coalesce(z.kolicina, 0),
         a.minimum,
         a.minimum - coalesce(z.kolicina, 0)
  from magacin.artikal a
  left join magacin.zaliha_magacina z on z.artikal_id = a.id
  where a.aktivan
    and a.minimum > 0
    and coalesce(z.kolicina, 0) < a.minimum
    and (p_vrsta is null or a.vrsta = p_vrsta)
  order by coalesce(z.kolicina, 0) / a.minimum, a.naziv;
end
$$;
