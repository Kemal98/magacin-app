-- Smjene i evidencija potrošnje.
--
-- Objekat na kraju smjene upiše završno stanje po artiklu. Potrošnja je ono što je u sistemu
-- moglo biti na zalihi objekta, a nije ostalo: početno + primljeno − izuzeci − završno.
-- Trošak objekta nastaje tek tu, po prosječnoj cijeni zalihe objekta (cijena izdatog), i zauvijek
-- ostaje u nepromjenjivoj knjizi objekta; kasnije promjene cijena u magacinu ga ne diraju.
-- Roba koja je tek na dostavi ne ulazi u brojanje jer još nije fizički stigla.

-- Raspored smjena objekta (naziv i satnica); menadžer ga zadaje.
create table magacin.smjena_raspored (
  id uuid primary key default gen_random_uuid(),
  objekat_id uuid not null references magacin.objekat (id),
  naziv text not null check (length(trim(naziv)) > 0),
  pocetak time not null,
  kraj time not null check (kraj <> pocetak),
  redoslijed int not null default 0
);
create index smjena_raspored_objekat on magacin.smjena_raspored (objekat_id, redoslijed);

-- Zatvorena smjena. Nepromjenjiva; ispravke idu kroz storno.
create table magacin.smjena (
  id uuid primary key default gen_random_uuid(),
  objekat_id uuid not null references magacin.objekat (id),
  -- Prijavljeni račun objekta, a ime je osoba koja je stvarno zatvorila smjenu.
  zatvorio_id uuid not null references magacin.korisnik (id),
  ime_osobe text not null check (length(trim(ime_osobe)) > 0),
  naziv text,
  zatvorena timestamptz not null default clock_timestamp()
);
create index smjena_objekat on magacin.smjena (objekat_id, zatvorena desc);

create table magacin.smjena_stavka (
  id uuid primary key default gen_random_uuid(),
  smjena_id uuid not null references magacin.smjena (id),
  artikal_id uuid not null references magacin.artikal (id),
  pocetno numeric not null,
  -- Neto primljeno u smjeni (izvedeno: moguće − početno + izuzeci).
  primljeno numeric not null,
  izuzeci numeric not null check (izuzeci >= 0),
  zavrsno numeric not null check (zavrsno >= 0),
  potrosnja numeric not null check (potrosnja >= 0),
  -- Završno veće od mogućeg: višak i razlog koji je objekat naveo.
  visak numeric not null default 0 check (visak >= 0),
  razlog text,
  -- Prosječna cijena zalihe objekta pri zatvaranju; trošak obične potrošnje i izuzetaka.
  cijena numeric not null check (cijena >= 0),
  trosak numeric not null check (trosak >= 0),
  trosak_izuzetaka numeric not null default 0 check (trosak_izuzetaka >= 0),
  unique (smjena_id, artikal_id)
);
create index smjena_stavka_artikal on magacin.smjena_stavka (artikal_id);

create trigger smjena_nepromjenjiva before update or delete on magacin.smjena
  for each row execute function magacin.zabrani_izmjenu();
create trigger smjena_stavka_nepromjenjiva before update or delete on magacin.smjena_stavka
  for each row execute function magacin.zabrani_izmjenu();

alter table magacin.smjena_raspored enable row level security;
alter table magacin.smjena enable row level security;
alter table magacin.smjena_stavka enable row level security;
grant select on magacin.smjena_raspored, magacin.smjena, magacin.smjena_stavka to authenticated;

create policy "raspored čitaju svi prijavljeni svog objekta" on magacin.smjena_raspored
  for select to authenticated
  using (
    magacin.ima_ulogu('magacioner', 'menadzer')
    or (magacin.ima_ulogu('objekat') and objekat_id = magacin.moj_objekat())
  );
-- Smjene sadrže cijene i trošak: direktno ih čita samo menadžer, a objekat kroz smjene_objekta().
create policy "menadžer čita smjene" on magacin.smjena
  for select to authenticated using (magacin.ima_ulogu('menadzer'));
create policy "menadžer čita stavke smjena" on magacin.smjena_stavka
  for select to authenticated using (magacin.ima_ulogu('menadzer'));

-- Menadžer zadaje smjene objekta: niz {naziv, pocetak: "HH:MM", kraj: "HH:MM"}; zamjenjuje raniji raspored.
create function magacin.postavi_smjene_objekta(p_objekat uuid, p_smjene jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s jsonb;
  v_pocetak time;
  v_kraj time;
  v_redni int := 0;
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  if not exists (select 1 from magacin.objekat where id = p_objekat) then
    raise exception 'Objekat ne postoji' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_smjene) is distinct from 'array' then
    raise exception 'Smjene moraju biti niz' using errcode = '22023';
  end if;

  delete from magacin.smjena_raspored where objekat_id = p_objekat;
  for s in select * from jsonb_array_elements(p_smjene) loop
    if magacin.prazno_u_null(s ->> 'naziv') is null then
      raise exception 'Naziv smjene je obavezan' using errcode = '22023';
    end if;
    begin
      v_pocetak := (s ->> 'pocetak')::time;
      v_kraj := (s ->> 'kraj')::time;
    exception when others then
      raise exception 'Neispravna satnica smjene "%" (očekuje se HH:MM)', trim(s ->> 'naziv') using errcode = '22023';
    end;
    if v_pocetak is null or v_kraj is null or v_pocetak = v_kraj then
      raise exception 'Neispravna satnica smjene "%": početak i kraj moraju se razlikovati', trim(s ->> 'naziv')
        using errcode = '22023';
    end if;
    v_redni := v_redni + 1;
    insert into magacin.smjena_raspored (objekat_id, naziv, pocetak, kraj, redoslijed)
    values (p_objekat, trim(s ->> 'naziv'), v_pocetak, v_kraj, v_redni);
  end loop;
end
$$;

-- Objekat vidi raspored svog objekta; magacioner i menadžer navode objekat.
create function magacin.smjene_raspored(p_objekat uuid default null)
returns table (id uuid, naziv text, pocetak time, kraj time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat', 'magacioner', 'menadzer');
  v_objekat uuid := p_objekat;
begin
  if k.uloga = 'objekat' then
    if k.objekat_id is null then
      raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
    end if;
    if p_objekat is not null and p_objekat <> k.objekat_id then
      raise exception 'Nemate pravo na ovu radnju' using errcode = '42501';
    end if;
    v_objekat := k.objekat_id;
  elsif v_objekat is null then
    raise exception 'Navedite objekat' using errcode = '22023';
  end if;
  return query
  select r.id, r.naziv, r.pocetak, r.kraj
  from magacin.smjena_raspored r
  where r.objekat_id = v_objekat
  order by r.redoslijed;
end
$$;

-- Smjena koja u zadano vrijeme traje (lokalno vrijeme Sarajeva; smjena može ići preko ponoći).
create function magacin.trenutna_smjena(p_objekat uuid default null, p_vrijeme timestamptz default now())
returns table (naziv text, pocetak time, kraj time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat', 'magacioner', 'menadzer');
  v_objekat uuid := coalesce(case when k.uloga = 'objekat' then k.objekat_id end, p_objekat);
  v_lokalno time := (p_vrijeme at time zone 'Europe/Sarajevo')::time;
begin
  if k.uloga = 'objekat' and p_objekat is not null and p_objekat is distinct from k.objekat_id then
    raise exception 'Nemate pravo na ovu radnju' using errcode = '42501';
  end if;
  return query
  select r.naziv, r.pocetak, r.kraj
  from magacin.smjena_raspored r
  where r.objekat_id = v_objekat
    and ((r.pocetak < r.kraj and v_lokalno >= r.pocetak and v_lokalno < r.kraj)
      or (r.pocetak > r.kraj and (v_lokalno >= r.pocetak or v_lokalno < r.kraj)))
  order by r.redoslijed
  limit 1;
end
$$;

-- Izuzetak u toku smjene (razbijeno, proliveno): odvojen od obične potrošnje, uz obavezan razlog.
-- Skida se sa zalihe objekta i ulazi u trošak po prosječnoj cijeni zalihe (cijeni izdatog).
create function magacin.dodaj_izuzetak(p_artikal uuid, p_kolicina numeric, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat');
  v_cijena numeric;
  v_naziv text;
  v_moguce numeric;
begin
  if k.objekat_id is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;
  if magacin.prazno_u_null(p_razlog) is null then
    raise exception 'Razlog izuzetka je obavezan' using errcode = '22023';
  end if;
  if p_kolicina is null or p_kolicina <= 0 then
    raise exception 'Količina izuzetka mora biti veća od nule' using errcode = '22023';
  end if;

  -- Samo roba koja je stvarno stigla; ona koja je tek na dostavi se ne može otpisati.
  update magacin.zaliha_objekta zo
  set kolicina = zo.kolicina - p_kolicina
  where zo.objekat_id = k.objekat_id
    and zo.artikal_id = p_artikal
    and zo.kolicina - coalesce((
          select sum(st.izdana_osnovna)
          from magacin.zahtjev_stavka st
          join magacin.zahtjev z on z.id = st.zahtjev_id
          where z.objekat_id = zo.objekat_id and z.status = 'na_dostavi' and st.artikal_id = zo.artikal_id
        ), 0) >= p_kolicina
  returning zo.prosjecna_cijena into v_cijena;

  if not found then
    select a.naziv into v_naziv from magacin.artikal a where a.id = p_artikal;
    select coalesce(zo.kolicina, 0) - coalesce((
             select sum(st.izdana_osnovna)
             from magacin.zahtjev_stavka st
             join magacin.zahtjev z on z.id = st.zahtjev_id
             where z.objekat_id = k.objekat_id and z.status = 'na_dostavi' and st.artikal_id = p_artikal
           ), 0)
    into v_moguce
    from (select 1) x
    left join magacin.zaliha_objekta zo on zo.objekat_id = k.objekat_id and zo.artikal_id = p_artikal;
    raise exception 'Nema dovoljno artikla "%" u zalihi objekta: na stanju %', coalesce(v_naziv, '?'), trim_scale(greatest(coalesce(v_moguce, 0), 0))
      using errcode = '22023';
  end if;

  insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id, napomena)
  values (k.objekat_id, p_artikal, 'izuzetak', -p_kolicina, v_cijena, k.id, trim(p_razlog));
end
$$;

-- Izuzeci u smjeni koja je u toku (od zadnjeg zatvaranja), bez cijena.
create function magacin.izuzeci_tekuce_smjene()
returns table (vrijeme timestamptz, artikal text, mjera magacin.mjera, kolicina numeric, razlog text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat');
  v_od timestamptz;
begin
  if k.objekat_id is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;
  select max(s.zatvorena) into v_od from magacin.smjena s where s.objekat_id = k.objekat_id;
  return query
  select ko.vrijeme, a.naziv, a.mjera, -ko.kolicina, ko.napomena
  from magacin.kretanje_objekta ko
  join magacin.artikal a on a.id = ko.artikal_id
  where ko.objekat_id = k.objekat_id and ko.vrsta = 'izuzetak'
    and (v_od is null or ko.vrijeme > v_od)
  order by ko.vrijeme desc, ko.id desc;
end
$$;

-- Podaci za ekran zatvaranja smjene: po artiklu početno, primljeno, izuzeci i moguće stanje.
-- Artikli s popisa objekta i svi koji su na zalihi; oni s mogućim stanjem > 0 se moraju izbrojati.
create function magacin.stanje_za_zatvaranje()
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  bar_kod text,
  pocetno numeric,
  primljeno numeric,
  izuzeci numeric,
  moguce numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat');
  v_prethodna uuid;
  v_od timestamptz;
begin
  if k.objekat_id is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;
  select s.id, s.zatvorena into v_prethodna, v_od
  from magacin.smjena s where s.objekat_id = k.objekat_id order by s.zatvorena desc, s.id limit 1;

  return query
  with artikli as (
    select oa.artikal_id from magacin.objekat_artikal oa where oa.objekat_id = k.objekat_id
    union
    select zo.artikal_id from magacin.zaliha_objekta zo where zo.objekat_id = k.objekat_id and zo.kolicina > 0
  ),
  tranzit as (
    select st.artikal_id, sum(st.izdana_osnovna) as kolicina
    from magacin.zahtjev_stavka st
    join magacin.zahtjev z on z.id = st.zahtjev_id
    where z.objekat_id = k.objekat_id and z.status = 'na_dostavi'
    group by st.artikal_id
  ),
  izuzeci as (
    select ko.artikal_id, sum(-ko.kolicina) as kolicina
    from magacin.kretanje_objekta ko
    where ko.objekat_id = k.objekat_id and ko.vrsta = 'izuzetak' and (v_od is null or ko.vrijeme > v_od)
    group by ko.artikal_id
  ),
  osnova as (
    select a.id as artikal_id, a.naziv, a.mjera, a.bar_kod,
           coalesce((select ss.zavrsno from magacin.smjena_stavka ss
                     where ss.smjena_id = v_prethodna and ss.artikal_id = a.id), 0) as pocetno,
           coalesce(i.kolicina, 0) as izuzeci,
           greatest(coalesce(zo.kolicina, 0) - coalesce(t.kolicina, 0), 0) as moguce
    from artikli x
    join magacin.artikal a on a.id = x.artikal_id and a.aktivan
    left join magacin.zaliha_objekta zo on zo.objekat_id = k.objekat_id and zo.artikal_id = a.id
    left join tranzit t on t.artikal_id = a.id
    left join izuzeci i on i.artikal_id = a.id
  )
  select o.artikal_id, o.naziv, o.mjera, o.bar_kod, o.pocetno,
         o.moguce - o.pocetno + o.izuzeci, o.izuzeci, o.moguce
  from osnova o
  order by (o.moguce > 0) desc, o.naziv;
end
$$;

-- Zatvara smjenu objekta. p_stanje je niz {artikal_id, zavrsno, razlog?} i mora sadržavati svaki artikal
-- koji je po sistemu na zalihi. Završno veće od mogućeg je dozvoljeno samo uz razlog i ne blokira zatvaranje.
-- Sve ili ništa.
create function magacin.zatvori_smjenu(p_ime text, p_stanje jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat');
  v_objekat uuid := k.objekat_id;
  v_smjena uuid;
  v_prethodna uuid;
  v_od timestamptz;
  v_naziv_smjene text;
  r record;
  v_naziv text;
  v_nedostaje text[] := '{}';
  v_moguce numeric;
  v_pocetno numeric;
  v_izuzeci numeric;
  v_trosak_izuzetaka numeric;
  v_zavrsno numeric;
  v_potrosnja numeric;
  v_visak numeric;
  v_cijena numeric;
begin
  if v_objekat is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;
  if magacin.prazno_u_null(p_ime) is null then
    raise exception 'Upišite ime osobe koja zatvara smjenu' using errcode = '22023';
  end if;
  if jsonb_typeof(p_stanje) is distinct from 'array' then
    raise exception 'Završno stanje je obavezno' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_stanje) as x(artikal_id uuid) group by x.artikal_id having count(*) > 1
  ) then
    raise exception 'Isti artikal je unesen dvaput' using errcode = '22023';
  end if;

  -- Jedna smjena objekta se zatvara odjednom, i zaliha objekta se ne mijenja usred brojanja.
  perform 1 from magacin.objekat where id = v_objekat for update;
  perform 1 from magacin.zaliha_objekta where objekat_id = v_objekat for update;

  select s.id, s.zatvorena into v_prethodna, v_od
  from magacin.smjena s where s.objekat_id = v_objekat order by s.zatvorena desc, s.id limit 1;
  select t.naziv into v_naziv_smjene from magacin.trenutna_smjena(v_objekat) t;

  insert into magacin.smjena (objekat_id, zatvorio_id, ime_osobe, naziv)
  values (v_objekat, k.id, trim(p_ime), v_naziv_smjene)
  returning id into v_smjena;

  for r in
    with unos as (
      select x.artikal_id, x.zavrsno, x.razlog
      from jsonb_to_recordset(p_stanje) as x(artikal_id uuid, zavrsno numeric, razlog text)
    ),
    tranzit as (
      select st.artikal_id, sum(st.izdana_osnovna) as kolicina
      from magacin.zahtjev_stavka st
      join magacin.zahtjev z on z.id = st.zahtjev_id
      where z.objekat_id = v_objekat and z.status = 'na_dostavi'
      group by st.artikal_id
    )
    select coalesce(u.artikal_id, zo.artikal_id) as artikal_id,
           (u.artikal_id is not null) as uneseno,
           u.zavrsno as zavrsno_uneseno,
           u.razlog as razlog_unosa,
           zo.kolicina as zaliha,
           zo.prosjecna_cijena as cijena_zalihe,
           coalesce(t.kolicina, 0) as tranzit
    from unos u
    full join (select * from magacin.zaliha_objekta where objekat_id = v_objekat) zo on zo.artikal_id = u.artikal_id
    left join tranzit t on t.artikal_id = coalesce(u.artikal_id, zo.artikal_id)
    order by 1
  loop
    v_moguce := greatest(coalesce(r.zaliha, 0) - r.tranzit, 0);
    select a.naziv into v_naziv from magacin.artikal a where a.id = r.artikal_id;

    if not r.uneseno then
      if v_moguce > 0 then
        v_nedostaje := v_nedostaje || v_naziv;
      end if;
      continue;
    end if;

    if r.zavrsno_uneseno is null or r.zavrsno_uneseno < 0 then
      raise exception 'Završno stanje za "%" ne može biti prazno ni negativno', v_naziv using errcode = '22023';
    end if;
    if r.zaliha is null and not exists (
      select 1 from magacin.objekat_artikal oa where oa.objekat_id = v_objekat and oa.artikal_id = r.artikal_id
    ) then
      raise exception 'Artikal "%" nije na popisu vašeg objekta', coalesce(v_naziv, '?') using errcode = '42501';
    end if;

    v_zavrsno := r.zavrsno_uneseno;
    v_pocetno := coalesce((
      select ss.zavrsno from magacin.smjena_stavka ss where ss.smjena_id = v_prethodna and ss.artikal_id = r.artikal_id
    ), 0);
    select coalesce(sum(-ko.kolicina), 0), coalesce(sum(-ko.kolicina * ko.cijena), 0)
    into v_izuzeci, v_trosak_izuzetaka
    from magacin.kretanje_objekta ko
    where ko.objekat_id = v_objekat and ko.artikal_id = r.artikal_id and ko.vrsta = 'izuzetak'
      and (v_od is null or ko.vrijeme > v_od);

    if v_zavrsno <= v_moguce then
      v_potrosnja := v_moguce - v_zavrsno;
      v_visak := 0;
    else
      v_visak := v_zavrsno - v_moguce;
      v_potrosnja := 0;
      if magacin.prazno_u_null(r.razlog_unosa) is null then
        raise exception 'Završno stanje za "%" (%) je veće od mogućeg (%). Upišite razlog.',
          v_naziv, trim_scale(v_zavrsno), trim_scale(v_moguce) using errcode = '22023';
      end if;
    end if;

    v_cijena := coalesce(
      r.cijena_zalihe,
      (select zm.prosjecna_cijena from magacin.zaliha_magacina zm where zm.artikal_id = r.artikal_id),
      0
    );

    if v_pocetno = 0 and v_moguce = 0 and v_zavrsno = 0 and v_izuzeci = 0 then
      continue;
    end if;

    if v_potrosnja > 0 then
      insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id)
      values (v_objekat, r.artikal_id, 'potrosnja', -v_potrosnja, v_cijena, k.id);
    end if;
    if v_visak > 0 then
      insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id, napomena)
      values (v_objekat, r.artikal_id, 'visak_pri_zatvaranju', v_visak, v_cijena, k.id, trim(r.razlog_unosa));
    end if;

    -- Zaliha objekta postaje ono što je izbrojano, uz robu koja je još na putu.
    insert into magacin.zaliha_objekta as zo (objekat_id, artikal_id, kolicina, prosjecna_cijena)
    values (v_objekat, r.artikal_id, v_zavrsno + r.tranzit, v_cijena)
    on conflict (objekat_id, artikal_id) do update set kolicina = excluded.kolicina;

    insert into magacin.smjena_stavka
      (smjena_id, artikal_id, pocetno, primljeno, izuzeci, zavrsno, potrosnja, visak, razlog, cijena, trosak, trosak_izuzetaka)
    values (
      v_smjena, r.artikal_id, v_pocetno, v_moguce - v_pocetno + v_izuzeci, v_izuzeci, v_zavrsno,
      v_potrosnja, v_visak, case when v_visak > 0 then trim(r.razlog_unosa) end,
      v_cijena, v_potrosnja * v_cijena, v_trosak_izuzetaka
    );
  end loop;

  if cardinality(v_nedostaje) > 0 then
    raise exception 'Upišite završno stanje za: %', array_to_string(array(select unnest(v_nedostaje) order by 1), ', ')
      using errcode = '22023';
  end if;

  return v_smjena;
end
$$;

-- Zatvorene smjene, najnovije prve. Objekat vidi samo svoje i bez cijena i troška;
-- menadžer vidi sve (ili samo objekat koji navede) uz trošak.
create function magacin.smjene_objekta(p_objekat uuid default null, p_limit int default 20)
returns table (
  id uuid,
  objekat text,
  naziv text,
  ime_osobe text,
  zatvorena timestamptz,
  trosak numeric,
  trosak_izuzetaka numeric,
  stavke jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat', 'menadzer');
  v_cijene boolean := k.uloga = 'menadzer';
  v_objekat uuid := p_objekat;
begin
  if k.uloga = 'objekat' then
    if k.objekat_id is null then
      raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
    end if;
    if p_objekat is not null and p_objekat <> k.objekat_id then
      raise exception 'Nemate pravo na ovu radnju' using errcode = '42501';
    end if;
    v_objekat := k.objekat_id;
  end if;

  return query
  select s.id, o.naziv, s.naziv, s.ime_osobe, s.zatvorena,
         case when v_cijene then coalesce((select sum(ss.trosak) from magacin.smjena_stavka ss where ss.smjena_id = s.id), 0) end,
         case when v_cijene then coalesce((select sum(ss.trosak_izuzetaka) from magacin.smjena_stavka ss where ss.smjena_id = s.id), 0) end,
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'artikal', a.naziv,
               'mjera', a.mjera,
               'pocetno', ss.pocetno,
               'primljeno', ss.primljeno,
               'izuzeci', ss.izuzeci,
               'zavrsno', ss.zavrsno,
               'potrosnja', ss.potrosnja,
               'visak', ss.visak,
               'razlog', ss.razlog,
               'trosak', case when v_cijene then ss.trosak end,
               'trosak_izuzetaka', case when v_cijene then ss.trosak_izuzetaka end
             )
             order by a.naziv
           )
           from magacin.smjena_stavka ss
           join magacin.artikal a on a.id = ss.artikal_id
           where ss.smjena_id = s.id
         ), '[]'::jsonb)
  from magacin.smjena s
  join magacin.objekat o on o.id = s.objekat_id
  where (v_objekat is null or s.objekat_id = v_objekat)
  order by s.zatvorena desc, s.id
  limit least(greatest(p_limit, 1), 500);
end
$$;

-- Upozorenja za menadžera: smjene zatvorene s većim završnim stanjem od mogućeg, s razlogom.
create function magacin.upozorenja_smjena(p_limit int default 100)
returns table (
  smjena_id uuid,
  zatvorena timestamptz,
  objekat text,
  ime_osobe text,
  artikal text,
  mjera magacin.mjera,
  visak numeric,
  razlog text,
  vrijednost numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  return query
  select s.id, s.zatvorena, o.naziv, s.ime_osobe, a.naziv, a.mjera, ss.visak, ss.razlog, ss.visak * ss.cijena
  from magacin.smjena_stavka ss
  join magacin.smjena s on s.id = ss.smjena_id
  join magacin.objekat o on o.id = s.objekat_id
  join magacin.artikal a on a.id = ss.artikal_id
  where ss.visak > 0
  order by s.zatvorena desc, ss.id
  limit least(greatest(p_limit, 1), 500);
end
$$;
