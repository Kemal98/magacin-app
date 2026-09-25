-- Potvrda prijema: objekat jednim dodirom potvrđuje "STIGLO" (ili upisuje stvarno primljene
-- količine). Roba je pri izdavanju već ušla u zalihu objekta, pa se ovdje samo ispravlja
-- manjak: zaliha objekta se smanjuje za razliku, a razlika ostaje vidljiva magacioneru i menadžeru.

alter table magacin.zahtjev
  add column primio_id uuid references magacin.korisnik (id),
  add column primljeno_vrijeme timestamptz;

alter table magacin.zahtjev_stavka
  add column izdana_cijena numeric check (izdana_cijena >= 0),
  add column primljena_kolicina numeric check (primljena_kolicina >= 0),
  add column primljena_osnovna numeric check (primljena_osnovna >= 0);

create or replace function magacin.izdaj_zahtjev(p_zahtjev uuid, p_stavke jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  z magacin.zahtjev;
  s jsonb;
  st magacin.zahtjev_stavka;
  r record;
  v_kolicina numeric;
  v_cijena numeric;
  v_na_stanju numeric;
begin
  -- Zaključan zahtjev: isti zahtjev se ne može izdati dvaput istovremeno.
  select * into z from magacin.zahtjev where id = p_zahtjev for update;
  if not found then
    raise exception 'Zahtjev ne postoji' using errcode = 'P0002';
  end if;
  if z.status <> 'odobren' then
    raise exception 'Zahtjev nije odobren (status: %), izdavanje nije moguće', z.status using errcode = '22023';
  end if;

  update magacin.zahtjev_stavka
  set izdana_kolicina = odobrena_kolicina, izdana_osnovna = odobrena_osnovna
  where zahtjev_id = z.id;

  for s in select * from jsonb_array_elements(coalesce(p_stavke, '[]'::jsonb)) loop
    select * into st from magacin.zahtjev_stavka
    where id = (s ->> 'stavka_id')::uuid and zahtjev_id = z.id;
    if not found then
      raise exception 'Stavka ne pripada ovom zahtjevu' using errcode = '22023';
    end if;
    v_kolicina := (s ->> 'kolicina')::numeric;
    if v_kolicina is null or v_kolicina < 0 then
      raise exception 'Količina ne može biti negativna' using errcode = '22023';
    end if;
    if v_kolicina > st.odobrena_kolicina then
      raise exception 'Ne možete izdati više nego što je odobreno' using errcode = '22023';
    end if;
    update magacin.zahtjev_stavka
    set izdana_kolicina = v_kolicina,
        izdana_osnovna = v_kolicina * st.trazena_osnovna / st.trazena_kolicina
    where id = st.id;
  end loop;

  if (select coalesce(sum(izdana_osnovna), 0) from magacin.zahtjev_stavka where zahtjev_id = z.id) = 0 then
    raise exception 'Izdajte bar jednu stavku' using errcode = '22023';
  end if;

  -- Artikli se obrađuju uvijek istim redoslijedom, da paralelna izdavanja ne zapnu jedno o drugo.
  for r in
    select st2.*, a.naziv, a.mjera
    from magacin.zahtjev_stavka st2
    join magacin.artikal a on a.id = st2.artikal_id
    where st2.zahtjev_id = z.id and st2.izdana_osnovna > 0
    order by st2.artikal_id, st2.id
  loop
    -- Jedna naredba oduzima samo ako ima dovoljno; zaključan red čini paralelna izdavanja
    -- istog artikla nemogućim da pređu stanje.
    update magacin.zaliha_magacina
    set kolicina = kolicina - r.izdana_osnovna
    where artikal_id = r.artikal_id and kolicina >= r.izdana_osnovna
    returning prosjecna_cijena into v_cijena;

    if not found then
      select kolicina into v_na_stanju from magacin.zaliha_magacina where artikal_id = r.artikal_id;
      raise exception 'Nema dovoljno artikla "%" u magacinu: na stanju % %, potrebno % %',
        r.naziv, trim_scale(coalesce(v_na_stanju, 0)), r.mjera, trim_scale(r.izdana_osnovna), r.mjera
        using errcode = '22023';
    end if;

    -- Cijena po kojoj je stavka izdana; potrebna za vrijednost eventualne razlike pri prijemu.
    update magacin.zahtjev_stavka set izdana_cijena = v_cijena where id = r.id;

    insert into magacin.kretanje_magacina
      (artikal_id, vrsta, kolicina, cijena, korisnik_id, zahtjev_id, objekat_id, pakovanje_id, kolicina_pakovanja)
    values (
      r.artikal_id, 'izdavanje', -r.izdana_osnovna, v_cijena, k.id, z.id, z.objekat_id,
      r.pakovanje_id, case when r.pakovanje_id is not null then r.izdana_kolicina end
    );

    insert into magacin.zaliha_objekta as zo (objekat_id, artikal_id, kolicina, prosjecna_cijena)
    values (z.objekat_id, r.artikal_id, r.izdana_osnovna, v_cijena)
    on conflict (objekat_id, artikal_id) do update
    set prosjecna_cijena =
          (zo.kolicina * zo.prosjecna_cijena + excluded.kolicina * excluded.prosjecna_cijena)
          / (zo.kolicina + excluded.kolicina),
        kolicina = zo.kolicina + excluded.kolicina;

    insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id, zahtjev_id)
    values (z.objekat_id, r.artikal_id, 'izdavanje', r.izdana_osnovna, v_cijena, k.id, z.id);
  end loop;

  update magacin.zahtjev
  set status = 'na_dostavi', izdao_id = k.id, izdano_vrijeme = clock_timestamp()
  where id = z.id;
end
$$;

-- Zahtjevi: uz potvrdu prijema (ko je primio, kada, primljene količine i razlika).
drop function magacin.zahtjevi(magacin.status_zahtjeva[], int);
create function magacin.zahtjevi(
  p_statusi magacin.status_zahtjeva[] default null,
  p_limit int default 100
)
returns table (
  id uuid,
  vrijeme timestamptz,
  status magacin.status_zahtjeva,
  objekat text,
  poslao text,
  odobrio text,
  odluka_vrijeme timestamptz,
  razlog text,
  izdao text,
  izdano_vrijeme timestamptz,
  primio text,
  primljeno_vrijeme timestamptz,
  stavke jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat', 'magacioner', 'menadzer');
  v_magacin boolean := k.uloga <> 'objekat';
begin
  if not v_magacin and k.objekat_id is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;

  return query
  select z.id, z.vrijeme, z.status, o.naziv, ps.ime, ob.ime, z.odluka_vrijeme, z.razlog,
         iz.ime, z.izdano_vrijeme, pr.ime, z.primljeno_vrijeme,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'id', st.id,
               'artikal_id', a.id,
               'naziv', a.naziv,
               'mjera', a.mjera,
               'bar_kod', a.bar_kod,
               'pakovanje', p.naziv,
               'pakovanje_bar_kod', p.bar_kod,
               'faktor', p.faktor,
               'trazena_kolicina', st.trazena_kolicina,
               'trazena_osnovna', st.trazena_osnovna,
               'odobrena_kolicina', st.odobrena_kolicina,
               'odobrena_osnovna', st.odobrena_osnovna,
               'izdana_kolicina', st.izdana_kolicina,
               'izdana_osnovna', st.izdana_osnovna,
               'primljena_kolicina', st.primljena_kolicina,
               'primljena_osnovna', st.primljena_osnovna,
               'razlika_osnovna', st.primljena_osnovna - st.izdana_osnovna,
               'na_stanju', case when v_magacin then coalesce(zm.kolicina, 0) end
             )
             order by a.naziv
           )
           from magacin.zahtjev_stavka st
           join magacin.artikal a on a.id = st.artikal_id
           left join magacin.pakovanje p on p.id = st.pakovanje_id
           left join magacin.zaliha_magacina zm on zm.artikal_id = a.id
           where st.zahtjev_id = z.id
         ), '[]'::jsonb)
  from magacin.zahtjev z
  join magacin.objekat o on o.id = z.objekat_id
  join magacin.korisnik ps on ps.id = z.korisnik_id
  left join magacin.korisnik ob on ob.id = z.obradio_id
  left join magacin.korisnik iz on iz.id = z.izdao_id
  left join magacin.korisnik pr on pr.id = z.primio_id
  where (v_magacin or z.objekat_id = k.objekat_id)
    and (p_statusi is null or z.status = any (p_statusi))
  order by z.vrijeme desc, z.id
  limit least(greatest(p_limit, 1), 500);
end
$$;

-- Objekat potvrđuje da je roba stigla. p_stavke (nije obavezno) je niz {stavka_id, kolicina} sa stvarno
-- primljenom količinom (u jedinici u kojoj je traženo); nenavedene stavke su primljene u izdanoj količini.
create function magacin.potvrdi_primljeno(p_zahtjev uuid, p_stavke jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat');
  z magacin.zahtjev;
  s jsonb;
  st magacin.zahtjev_stavka;
  r record;
  v_kolicina numeric;
  v_razlika numeric;
begin
  if k.objekat_id is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;

  select * into z from magacin.zahtjev where id = p_zahtjev and objekat_id = k.objekat_id for update;
  if not found then
    raise exception 'Zahtjev ne postoji' using errcode = 'P0002';
  end if;
  if z.status <> 'na_dostavi' then
    raise exception 'Zahtjev nije na dostavi (status: %)', z.status using errcode = '22023';
  end if;

  update magacin.zahtjev_stavka
  set primljena_kolicina = izdana_kolicina, primljena_osnovna = izdana_osnovna
  where zahtjev_id = z.id;

  for s in select * from jsonb_array_elements(coalesce(p_stavke, '[]'::jsonb)) loop
    select * into st from magacin.zahtjev_stavka
    where id = (s ->> 'stavka_id')::uuid and zahtjev_id = z.id;
    if not found then
      raise exception 'Stavka ne pripada ovom zahtjevu' using errcode = '22023';
    end if;
    v_kolicina := (s ->> 'kolicina')::numeric;
    if v_kolicina is null or v_kolicina < 0 then
      raise exception 'Količina ne može biti negativna' using errcode = '22023';
    end if;
    if v_kolicina > st.izdana_kolicina then
      raise exception 'Ne možete primiti više nego što je poslano. Ako je stiglo više, javite magacioneru.'
        using errcode = '22023';
    end if;
    update magacin.zahtjev_stavka
    set primljena_kolicina = v_kolicina,
        primljena_osnovna = v_kolicina * st.trazena_osnovna / st.trazena_kolicina
    where id = st.id;
  end loop;

  -- Manjak: zaliha objekta se smanjuje, a razlika ulazi u knjigu objekta po cijeni izdatog.
  for r in
    select st2.*, a.naziv
    from magacin.zahtjev_stavka st2
    join magacin.artikal a on a.id = st2.artikal_id
    where st2.zahtjev_id = z.id and st2.primljena_osnovna < st2.izdana_osnovna
    order by st2.artikal_id, st2.id
  loop
    v_razlika := r.izdana_osnovna - r.primljena_osnovna;
    update magacin.zaliha_objekta
    set kolicina = kolicina - v_razlika
    where objekat_id = z.objekat_id and artikal_id = r.artikal_id and kolicina >= v_razlika;
    if not found then
      raise exception 'Zaliha objekta za "%" je manja od razlike; javite se menadžeru', r.naziv
        using errcode = '22023';
    end if;
    insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id, zahtjev_id)
    values (z.objekat_id, r.artikal_id, 'razlika_pri_prijemu', -v_razlika, coalesce(r.izdana_cijena, 0), k.id, z.id);
  end loop;

  update magacin.zahtjev
  set status = 'primljeno', primio_id = k.id, primljeno_vrijeme = clock_timestamp()
  where id = z.id;
end
$$;

-- Razlike pri prijemu (izdano se razlikuje od primljenog), najnovije prve. Sadrži cijene,
-- pa ga vide samo magacioner i menadžer.
create function magacin.razlike_pri_prijemu(p_limit int default 100)
returns table (
  zahtjev_id uuid,
  vrijeme timestamptz,
  objekat text,
  artikal text,
  mjera magacin.mjera,
  izdano numeric,
  primljeno numeric,
  razlika numeric,
  vrijednost_razlike numeric,
  primio text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  return query
  select z.id, z.primljeno_vrijeme, o.naziv, a.naziv, a.mjera,
         st.izdana_osnovna, st.primljena_osnovna,
         st.primljena_osnovna - st.izdana_osnovna,
         (st.primljena_osnovna - st.izdana_osnovna) * coalesce(st.izdana_cijena, 0),
         pr.ime
  from magacin.zahtjev_stavka st
  join magacin.zahtjev z on z.id = st.zahtjev_id
  join magacin.objekat o on o.id = z.objekat_id
  join magacin.artikal a on a.id = st.artikal_id
  join magacin.korisnik pr on pr.id = z.primio_id
  where z.status = 'primljeno' and st.primljena_osnovna <> st.izdana_osnovna
  order by z.primljeno_vrijeme desc, st.id
  limit least(greatest(p_limit, 1), 500);
end
$$;
