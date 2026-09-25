-- Evidencija nabavke: uz svaki prijem se bilježi datum isporuke (kad je roba stvarno stigla; može se
-- unijeti i kasnije), broj otpremnice ili računa i napomena. Iz toga se vidi koliko često i koliko
-- svaki dobavljač dolazi, šta donosi i po kojim cijenama.

alter table magacin.prijem
  add column datum_isporuke date,
  add column dokument text,
  add column napomena text;

-- Ranije unesene prijeme vodimo kao isporučene na dan unosa. Zapisi su inače nepromjenjivi, pa se okidač
-- privremeno isključuje samo za ovo jednokratno popunjavanje.
alter table magacin.prijem disable trigger prijem_nepromjenjiv;
update magacin.prijem set datum_isporuke = (vrijeme at time zone 'Europe/Sarajevo')::date;
alter table magacin.prijem enable trigger prijem_nepromjenjiv;

alter table magacin.prijem
  alter column datum_isporuke set not null,
  alter column datum_isporuke set default ((now() at time zone 'Europe/Sarajevo')::date);

-- Prijem robe (kao ranije), uz datum isporuke, broj otpremnice/računa i napomenu (sve nije obavezno).
drop function magacin.unesi_prijem(uuid, jsonb);
create function magacin.unesi_prijem(
  p_dobavljac uuid,
  p_stavke jsonb,
  p_dokument text default null,
  p_napomena text default null,
  p_datum date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  v_danas date := (now() at time zone 'Europe/Sarajevo')::date;
  v_prijem uuid;
  s jsonb;
  v_artikal magacin.artikal;
  v_faktor numeric;
  v_pak_id uuid;
  v_kolicina numeric;
  v_cijena numeric;
  v_osnovna_kolicina numeric;
  v_osnovna_cijena numeric;
begin
  if jsonb_typeof(p_stavke) is distinct from 'array' or jsonb_array_length(p_stavke) = 0 then
    raise exception 'Prijem mora imati bar jednu stavku' using errcode = '22023';
  end if;
  if not exists (select 1 from magacin.dobavljac where id = p_dobavljac and aktivan) then
    raise exception 'Izaberite dobavljača (aktivnog)' using errcode = '22023';
  end if;
  if p_datum is not null and p_datum > v_danas then
    raise exception 'Datum isporuke ne može biti u budućnosti' using errcode = '22023';
  end if;

  insert into magacin.prijem (dobavljac_id, korisnik_id, datum_isporuke, dokument, napomena)
  values (
    p_dobavljac, k.id, coalesce(p_datum, v_danas),
    magacin.prazno_u_null(p_dokument), magacin.prazno_u_null(p_napomena)
  )
  returning id into v_prijem;

  for s in select * from jsonb_array_elements(p_stavke) loop
    v_kolicina := (s ->> 'kolicina')::numeric;
    v_cijena := (s ->> 'cijena')::numeric;
    v_pak_id := nullif(s ->> 'pakovanje_id', '')::uuid;

    select * into v_artikal from magacin.artikal where id = (s ->> 'artikal_id')::uuid;
    if not found then
      raise exception 'Artikal ne postoji' using errcode = 'P0002';
    end if;
    if not v_artikal.aktivan then
      raise exception 'Artikal "%" je isključen', v_artikal.naziv using errcode = '22023';
    end if;
    if coalesce(v_kolicina, 0) <= 0 then
      raise exception 'Količina za "%" mora biti veća od nule', v_artikal.naziv using errcode = '22023';
    end if;
    if v_cijena is null or v_cijena < 0 then
      raise exception 'Cijena za "%" ne može biti negativna', v_artikal.naziv using errcode = '22023';
    end if;

    v_faktor := 1;
    if v_pak_id is not null then
      select faktor into v_faktor from magacin.pakovanje
      where id = v_pak_id and artikal_id = v_artikal.id;
      if not found then
        raise exception 'Pakovanje ne pripada artiklu "%"', v_artikal.naziv using errcode = '22023';
      end if;
    end if;

    v_osnovna_kolicina := v_kolicina * v_faktor;
    v_osnovna_cijena := v_cijena / v_faktor;

    insert into magacin.kretanje_magacina
      (artikal_id, vrsta, kolicina, cijena, korisnik_id, prijem_id, pakovanje_id, kolicina_pakovanja)
    values (
      v_artikal.id, 'prijem', v_osnovna_kolicina, v_osnovna_cijena, k.id, v_prijem,
      v_pak_id, case when v_pak_id is not null then v_kolicina end
    );

    -- Jedna naredba drži zaključan red artikla, pa paralelni prijemi ne mogu pokvariti prosjek.
    insert into magacin.zaliha_magacina as z (artikal_id, kolicina, prosjecna_cijena)
    values (v_artikal.id, v_osnovna_kolicina, v_osnovna_cijena)
    on conflict (artikal_id) do update
    set prosjecna_cijena =
          (z.kolicina * z.prosjecna_cijena + excluded.kolicina * excluded.prosjecna_cijena)
          / (z.kolicina + excluded.kolicina),
        kolicina = z.kolicina + excluded.kolicina;
  end loop;

  return v_prijem;
end
$$;

-- Pregled svih dobavljača za period (po datumu isporuke): koliko puta su dolazili, koliko su isporučili,
-- na koliko dana u prosjeku dolaze i kad su zadnji put došli (zadnji dolazak je uvijek iz cijele historije).
-- Poništeni (stornirani) prijemi se ne računaju.
create function magacin.dobavljaci_nabavka(p_od date, p_do date)
returns table (
  dobavljac_id uuid,
  naziv text,
  aktivan boolean,
  broj_isporuka int,
  ukupna_vrijednost numeric,
  prosjecna_vrijednost numeric,
  prosjecan_razmak_dana numeric,
  zadnja_isporuka date,
  stornirano int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  if p_od is null or p_do is null or p_od > p_do then
    raise exception 'Neispravan period: početak mora biti prije kraja' using errcode = '22023';
  end if;

  return query
  with isporuke as (
    select p.id, p.dobavljac_id, p.datum_isporuke, (sn.id is not null) as stornirano,
           coalesce((select sum(ko.kolicina * ko.cijena)
                     from magacin.kretanje_magacina ko
                     where ko.prijem_id = p.id and ko.vrsta = 'prijem'), 0) as vrijednost
    from magacin.prijem p
    left join magacin.storno sn on sn.prijem_id = p.id
  ),
  u_periodu as (
    select * from isporuke i where i.datum_isporuke between p_od and p_do and not i.stornirano
  ),
  dolasci as (
    select distinct u.dobavljac_id, u.datum_isporuke from u_periodu u
  ),
  razmaci as (
    select d.dobavljac_id,
           d.datum_isporuke - lag(d.datum_isporuke) over (partition by d.dobavljac_id order by d.datum_isporuke) as razmak
    from dolasci d
  )
  select d.id, d.naziv, d.aktivan,
         coalesce((select count(*)::int from u_periodu u where u.dobavljac_id = d.id), 0),
         coalesce((select sum(u.vrijednost) from u_periodu u where u.dobavljac_id = d.id), 0),
         coalesce((select avg(u.vrijednost) from u_periodu u where u.dobavljac_id = d.id), 0),
         (select avg(r.razmak)::numeric from razmaci r where r.dobavljac_id = d.id and r.razmak is not null),
         (select max(i.datum_isporuke) from isporuke i where i.dobavljac_id = d.id and not i.stornirano),
         coalesce((select count(*)::int from isporuke i
                   where i.dobavljac_id = d.id and i.stornirano and i.datum_isporuke between p_od and p_do), 0)
  from magacin.dobavljac d
  order by 5 desc, d.naziv;
end
$$;

-- Sve isporuke jednog dobavljača u periodu, najnovije prve: datum, dokument, napomena, ko je primio, vrijednost,
-- razmak od prethodne isporuke i stavke (količina i cijena po osnovnoj mjeri). Stornirane su vidljive s oznakom.
create function magacin.isporuke_dobavljaca(p_dobavljac uuid, p_od date, p_do date)
returns table (
  id uuid,
  datum_isporuke date,
  vrijeme timestamptz,
  dokument text,
  napomena text,
  ime text,
  vrijednost numeric,
  razmak_dana int,
  stornirano boolean,
  storno_razlog text,
  storno_ime text,
  storno_vrijeme timestamptz,
  stavke jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  if p_od is null or p_do is null or p_od > p_do then
    raise exception 'Neispravan period: početak mora biti prije kraja' using errcode = '22023';
  end if;
  if not exists (select 1 from magacin.dobavljac d where d.id = p_dobavljac) then
    raise exception 'Dobavljač ne postoji' using errcode = 'P0002';
  end if;

  return query
  select p.id, p.datum_isporuke, p.vrijeme, p.dokument, p.napomena, u.ime,
         coalesce((select sum(ko.kolicina * ko.cijena) from magacin.kretanje_magacina ko
                   where ko.prijem_id = p.id and ko.vrsta = 'prijem'), 0),
         (p.datum_isporuke - (
            select max(p2.datum_isporuke)
            from magacin.prijem p2
            left join magacin.storno s2 on s2.prijem_id = p2.id
            where p2.dobavljac_id = p.dobavljac_id and s2.id is null
              and (p2.datum_isporuke < p.datum_isporuke
                   or (p2.datum_isporuke = p.datum_isporuke and p2.vrijeme < p.vrijeme))
         ))::int,
         (sn.id is not null), sn.razlog, su.ime, sn.vrijeme,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'artikal', a.naziv,
               'mjera', a.mjera,
               'kolicina', ko.kolicina,
               'cijena', ko.cijena,
               'vrijednost', ko.kolicina * ko.cijena,
               'pakovanje', pk.naziv,
               'kolicina_pakovanja', ko.kolicina_pakovanja
             )
             order by a.naziv
           )
           from magacin.kretanje_magacina ko
           join magacin.artikal a on a.id = ko.artikal_id
           left join magacin.pakovanje pk on pk.id = ko.pakovanje_id
           where ko.prijem_id = p.id and ko.vrsta = 'prijem'
         ), '[]'::jsonb)
  from magacin.prijem p
  join magacin.korisnik u on u.id = p.korisnik_id
  left join magacin.storno sn on sn.prijem_id = p.id
  left join magacin.korisnik su on su.id = sn.korisnik_id
  where p.dobavljac_id = p_dobavljac and p.datum_isporuke between p_od and p_do
  order by p.datum_isporuke desc, p.vrijeme desc;
end
$$;

-- Artikli koje dobavljač donosi: koliko puta, koliko ukupno, vrijednost te zadnja, najniža, najviša i
-- prosječna (ponderisana) cijena po osnovnoj mjeri. Poništeni prijemi se ne računaju.
create function magacin.artikli_dobavljaca(p_dobavljac uuid, p_od date, p_do date)
returns table (
  artikal_id uuid,
  artikal text,
  mjera magacin.mjera,
  broj_isporuka int,
  kolicina numeric,
  vrijednost numeric,
  zadnja_cijena numeric,
  najnizja_cijena numeric,
  najvisa_cijena numeric,
  prosjecna_cijena numeric,
  zadnja_isporuka date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  if p_od is null or p_do is null or p_od > p_do then
    raise exception 'Neispravan period: početak mora biti prije kraja' using errcode = '22023';
  end if;
  if not exists (select 1 from magacin.dobavljac d where d.id = p_dobavljac) then
    raise exception 'Dobavljač ne postoji' using errcode = 'P0002';
  end if;

  return query
  select a.id, a.naziv, a.mjera,
         count(distinct p.id)::int,
         sum(ko.kolicina),
         sum(ko.kolicina * ko.cijena),
         (array_agg(ko.cijena order by p.datum_isporuke desc, p.vrijeme desc, ko.id desc))[1],
         min(ko.cijena),
         max(ko.cijena),
         sum(ko.kolicina * ko.cijena) / sum(ko.kolicina),
         max(p.datum_isporuke)
  from magacin.kretanje_magacina ko
  join magacin.prijem p on p.id = ko.prijem_id
  join magacin.artikal a on a.id = ko.artikal_id
  left join magacin.storno sn on sn.prijem_id = p.id
  where ko.vrsta = 'prijem' and sn.id is null
    and p.dobavljac_id = p_dobavljac and p.datum_isporuke between p_od and p_do
  group by a.id, a.naziv, a.mjera
  order by sum(ko.kolicina * ko.cijena) desc, a.naziv;
end
$$;
