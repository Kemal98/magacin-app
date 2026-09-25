-- Zahtjevi objekata za robu iz magacina: poslan → odobren (puna ili manja količina) ili odbijen.
-- Kasniji zadaci dodaju statuse "na dostavi" i "primljeno" (izdavanje i potvrda prijema).
-- Zahtjev ne mijenja zalihu; roba se skida tek pri izdavanju.

create type magacin.status_zahtjeva as enum ('poslan', 'odobren', 'odbijen');

create table magacin.zahtjev (
  id uuid primary key default gen_random_uuid(),
  objekat_id uuid not null references magacin.objekat (id),
  korisnik_id uuid not null references magacin.korisnik (id),
  vrijeme timestamptz not null default clock_timestamp(),
  status magacin.status_zahtjeva not null default 'poslan',
  -- Ko je i kada odobrio ili odbio, i razlog odbijanja.
  obradio_id uuid references magacin.korisnik (id),
  odluka_vrijeme timestamptz,
  razlog text
);
create index zahtjev_objekat on magacin.zahtjev (objekat_id, vrijeme desc);
create index zahtjev_status on magacin.zahtjev (status, vrijeme desc);

create table magacin.zahtjev_stavka (
  id uuid primary key default gen_random_uuid(),
  zahtjev_id uuid not null references magacin.zahtjev (id),
  artikal_id uuid not null references magacin.artikal (id),
  pakovanje_id uuid references magacin.pakovanje (id),
  -- Traženo, kako je uneseno (npr. 2 kutije) i u osnovnoj mjeri (20 kg).
  trazena_kolicina numeric not null check (trazena_kolicina > 0),
  trazena_osnovna numeric not null check (trazena_osnovna > 0),
  -- Odobreno, u istoj jedinici kao traženo i u osnovnoj mjeri; null dok se ne odluči.
  odobrena_kolicina numeric check (odobrena_kolicina >= 0),
  odobrena_osnovna numeric check (odobrena_osnovna >= 0)
);
create index zahtjev_stavka_zahtjev on magacin.zahtjev_stavka (zahtjev_id);

alter table magacin.zahtjev enable row level security;
alter table magacin.zahtjev_stavka enable row level security;
grant select on magacin.zahtjev, magacin.zahtjev_stavka to authenticated;

create policy "magacin čita zahtjeve" on magacin.zahtjev
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "objekat čita svoje zahtjeve" on magacin.zahtjev
  for select to authenticated
  using (magacin.ima_ulogu('objekat') and objekat_id = magacin.moj_objekat());
create policy "magacin čita stavke" on magacin.zahtjev_stavka
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "objekat čita svoje stavke" on magacin.zahtjev_stavka
  for select to authenticated
  using (
    magacin.ima_ulogu('objekat')
    and exists (
      select 1 from magacin.zahtjev z
      where z.id = zahtjev_id and z.objekat_id = magacin.moj_objekat()
    )
  );

-- Objekat šalje zahtjev: p_stavke je niz {artikal_id, pakovanje_id?, kolicina}.
-- Količina je u jedinici u kojoj se traži (osnovna mjera ili pakovanje).
create function magacin.posalji_zahtjev(p_stavke jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat');
  v_zahtjev uuid;
  s jsonb;
  v_artikal magacin.artikal;
  v_pak_id uuid;
  v_faktor numeric;
  v_kolicina numeric;
begin
  if k.objekat_id is null then
    raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_stavke) is distinct from 'array' or jsonb_array_length(p_stavke) = 0 then
    raise exception 'Zahtjev mora imati bar jednu stavku' using errcode = '22023';
  end if;

  insert into magacin.zahtjev (objekat_id, korisnik_id)
  values (k.objekat_id, k.id)
  returning id into v_zahtjev;

  for s in select * from jsonb_array_elements(p_stavke) loop
    v_kolicina := (s ->> 'kolicina')::numeric;
    v_pak_id := nullif(s ->> 'pakovanje_id', '')::uuid;

    select * into v_artikal from magacin.artikal where id = (s ->> 'artikal_id')::uuid;
    if not found then
      raise exception 'Artikal ne postoji' using errcode = 'P0002';
    end if;
    if not v_artikal.aktivan then
      raise exception 'Artikal "%" je isključen', v_artikal.naziv using errcode = '22023';
    end if;
    if not exists (
      select 1 from magacin.objekat_artikal
      where objekat_id = k.objekat_id and artikal_id = v_artikal.id
    ) then
      raise exception 'Artikal "%" nije na popisu vašeg objekta', v_artikal.naziv using errcode = '42501';
    end if;
    if coalesce(v_kolicina, 0) <= 0 then
      raise exception 'Količina za "%" mora biti veća od nule', v_artikal.naziv using errcode = '22023';
    end if;

    v_faktor := 1;
    if v_pak_id is not null then
      select faktor into v_faktor from magacin.pakovanje
      where id = v_pak_id and artikal_id = v_artikal.id;
      if not found then
        raise exception 'Pakovanje ne pripada artiklu "%"', v_artikal.naziv using errcode = '22023';
      end if;
    end if;

    insert into magacin.zahtjev_stavka (zahtjev_id, artikal_id, pakovanje_id, trazena_kolicina, trazena_osnovna)
    values (v_zahtjev, v_artikal.id, v_pak_id, v_kolicina, v_kolicina * v_faktor);
  end loop;

  return v_zahtjev;
end
$$;

-- Zaključava zahtjev i provjerava da još čeka odluku (dva magacionera ne mogu obraditi isti).
create function magacin.zakljucaj_zahtjev_na_cekanju(p_zahtjev uuid)
returns magacin.zahtjev
language plpgsql
security definer
set search_path = ''
as $$
declare
  z magacin.zahtjev;
begin
  select * into z from magacin.zahtjev where id = p_zahtjev for update;
  if not found then
    raise exception 'Zahtjev ne postoji' using errcode = 'P0002';
  end if;
  if z.status <> 'poslan' then
    raise exception 'Zahtjev je već obrađen (%)', z.status using errcode = '22023';
  end if;
  return z;
end
$$;

-- Odobrava zahtjev. p_stavke (nije obavezno) je niz {stavka_id, kolicina} s manjim količinama;
-- stavke koje nisu navedene odobravaju se u traženoj količini.
create function magacin.odobri_zahtjev(p_zahtjev uuid, p_stavke jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  z magacin.zahtjev := magacin.zakljucaj_zahtjev_na_cekanju(p_zahtjev);
  s jsonb;
  st magacin.zahtjev_stavka;
  v_kolicina numeric;
begin
  update magacin.zahtjev_stavka
  set odobrena_kolicina = trazena_kolicina, odobrena_osnovna = trazena_osnovna
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
    if v_kolicina > st.trazena_kolicina then
      raise exception 'Ne možete odobriti više nego što je traženo' using errcode = '22023';
    end if;
    update magacin.zahtjev_stavka
    set odobrena_kolicina = v_kolicina,
        odobrena_osnovna = v_kolicina * st.trazena_osnovna / st.trazena_kolicina
    where id = st.id;
  end loop;

  if (select coalesce(sum(odobrena_osnovna), 0) from magacin.zahtjev_stavka where zahtjev_id = z.id) = 0 then
    raise exception 'Ništa nije odobreno. Odbijte zahtjev uz razlog.' using errcode = '22023';
  end if;

  update magacin.zahtjev
  set status = 'odobren', obradio_id = k.id, odluka_vrijeme = clock_timestamp()
  where id = z.id;
end
$$;

create function magacin.odbij_zahtjev(p_zahtjev uuid, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  z magacin.zahtjev;
begin
  if magacin.prazno_u_null(p_razlog) is null then
    raise exception 'Razlog odbijanja je obavezan' using errcode = '22023';
  end if;
  z := magacin.zakljucaj_zahtjev_na_cekanju(p_zahtjev);
  update magacin.zahtjev
  set status = 'odbijen', obradio_id = k.id, odluka_vrijeme = clock_timestamp(), razlog = trim(p_razlog)
  where id = z.id;
end
$$;

-- Zahtjevi s imenima i stavkama, najnoviji prvi. Objekat dobija samo zahtjeve svog objekta
-- (bez stanja magacina), a magacioner i menadžer sve, uz trenutno stanje magacina po stavci.
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
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'id', st.id,
               'artikal_id', a.id,
               'naziv', a.naziv,
               'mjera', a.mjera,
               'pakovanje', p.naziv,
               'faktor', p.faktor,
               'trazena_kolicina', st.trazena_kolicina,
               'trazena_osnovna', st.trazena_osnovna,
               'odobrena_kolicina', st.odobrena_kolicina,
               'odobrena_osnovna', st.odobrena_osnovna,
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
  where (v_magacin or z.objekat_id = k.objekat_id)
    and (p_statusi is null or z.status = any (p_statusi))
  order by z.vrijeme desc, z.id
  limit least(greatest(p_limit, 1), 500);
end
$$;
