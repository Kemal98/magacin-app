-- Izdavanje: odobren zahtjev postaje "na dostavi". Roba se skida sa zalihe magacina po
-- prosječnoj cijeni tog trenutka i ulazi u zalihu objekta. Izdavanje ne knjiži trošak;
-- trošak nastaje tek evidencijom potrošnje u objektu.

alter table magacin.zahtjev
  add column izdao_id uuid references magacin.korisnik (id),
  add column izdano_vrijeme timestamptz;

-- Izdano, u istoj jedinici kao traženo i u osnovnoj mjeri (može biti manje od odobrenog).
alter table magacin.zahtjev_stavka
  add column izdana_kolicina numeric check (izdana_kolicina >= 0),
  add column izdana_osnovna numeric check (izdana_osnovna >= 0);

alter table magacin.kretanje_magacina
  add column zahtjev_id uuid references magacin.zahtjev (id),
  add column objekat_id uuid references magacin.objekat (id),
  add constraint kretanje_smjer check (
    (vrsta = 'prijem' and kolicina > 0) or (vrsta = 'izdavanje' and kolicina < 0)
  );

create type magacin.vrsta_kretanja_objekta as enum ('izdavanje');

-- Knjiga kretanja zalihe objekta (nepromjenjiva): ulaz pozitivan, izlaz negativan.
create table magacin.kretanje_objekta (
  id bigint generated always as identity primary key,
  objekat_id uuid not null references magacin.objekat (id),
  artikal_id uuid not null references magacin.artikal (id),
  vrsta magacin.vrsta_kretanja_objekta not null,
  kolicina numeric not null check (kolicina <> 0),
  -- Cijena po osnovnoj mjeri (KM bez PDV-a), kakva je bila pri izdavanju.
  cijena numeric not null check (cijena >= 0),
  korisnik_id uuid not null references magacin.korisnik (id),
  vrijeme timestamptz not null default clock_timestamp(),
  zahtjev_id uuid references magacin.zahtjev (id),
  napomena text
);
create index kretanje_objekta_objekat on magacin.kretanje_objekta (objekat_id, artikal_id, vrijeme);

create trigger kretanje_objekta_nepromjenjivo before update or delete on magacin.kretanje_objekta
  for each row execute function magacin.zabrani_izmjenu();

-- Roba u objektu koja još nije potrošena, s prosječnom cijenom izdatog.
create table magacin.zaliha_objekta (
  objekat_id uuid not null references magacin.objekat (id),
  artikal_id uuid not null references magacin.artikal (id),
  kolicina numeric not null check (kolicina >= 0),
  prosjecna_cijena numeric not null check (prosjecna_cijena >= 0),
  primary key (objekat_id, artikal_id)
);

-- Tabele sadrže cijene, pa ih direktno čitaju samo magacioner i menadžer;
-- objekat vidi svoju zalihu kroz zaliha_objekta() bez cijena.
alter table magacin.kretanje_objekta enable row level security;
alter table magacin.zaliha_objekta enable row level security;
grant select on magacin.kretanje_objekta, magacin.zaliha_objekta to authenticated;
create policy "magacin čita knjigu objekata" on magacin.kretanje_objekta
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "magacin čita zalihe objekata" on magacin.zaliha_objekta
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));

-- Označava odobren zahtjev kao "na dostavi". p_stavke (nije obavezno) je niz {stavka_id, kolicina}
-- s manjom količinom od odobrene; ostale stavke se izdaju u odobrenoj količini. Sve ili ništa.
create function magacin.izdaj_zahtjev(p_zahtjev uuid, p_stavke jsonb default null)
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

-- Zaliha objekta (roba izdana objektu, još nepotrošena). Objekat vidi samo svoju i bez cijena;
-- magacioner i menadžer navode objekat i vide cijene i vrijednost.
create function magacin.zaliha_objekta(p_objekat uuid default null)
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  kolicina numeric,
  prosjecna_cijena numeric,
  vrijednost numeric
)
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
  select a.id, a.naziv, a.mjera, zo.kolicina,
         case when k.uloga <> 'objekat' then zo.prosjecna_cijena end,
         case when k.uloga <> 'objekat' then zo.kolicina * zo.prosjecna_cijena end
  from magacin.zaliha_objekta zo
  join magacin.artikal a on a.id = zo.artikal_id
  where zo.objekat_id = v_objekat and zo.kolicina > 0
  order by a.naziv;
end
$$;

-- Zahtjevi: isto kao ranije, uz izdavanje (ko je izdao, kada, izdane količine) i bar kodove
-- stavki za provjeru skenerom.
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
         iz.ime, z.izdano_vrijeme,
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
  where (v_magacin or z.objekat_id = k.objekat_id)
    and (p_statusi is null or z.status = any (p_statusi))
  order by z.vrijeme desc, z.id
  limit least(greatest(p_limit, 1), 500);
end
$$;
