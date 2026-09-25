-- Šifrarnik: artikli (s pakovanjima), objekti i dobavljači.
-- Čitati smije svaka prijavljena osoba; mijenja samo menadžer, isključivo
-- kroz operacije ispod (tabele nemaju pravo upisa izvan njih).

create type magacin.mjera as enum ('kg', 'l', 'kom');
create type magacin.vrsta_magacina as enum ('prehrana', 'materijal');

create table magacin.artikal (
  id uuid primary key default gen_random_uuid(),
  naziv text not null check (length(trim(naziv)) > 0),
  mjera magacin.mjera not null,
  bar_kod text check (bar_kod is null or length(trim(bar_kod)) > 0),
  minimum numeric not null default 0 check (minimum >= 0),
  vrsta magacin.vrsta_magacina not null,
  aktivan boolean not null default true,
  napravljen timestamptz not null default now()
);
create unique index artikal_bar_kod on magacin.artikal (bar_kod);

-- Pakovanje: 1 kutija = faktor osnovnih mjera artikla (npr. 10 kg).
create table magacin.pakovanje (
  id uuid primary key default gen_random_uuid(),
  artikal_id uuid not null references magacin.artikal (id) on delete cascade,
  naziv text not null check (length(trim(naziv)) > 0),
  faktor numeric not null check (faktor > 0),
  bar_kod text check (bar_kod is null or length(trim(bar_kod)) > 0)
);
create unique index pakovanje_bar_kod on magacin.pakovanje (bar_kod);
create index pakovanje_artikal on magacin.pakovanje (artikal_id);

create table magacin.objekat (
  id uuid primary key default gen_random_uuid(),
  naziv text not null check (length(trim(naziv)) > 0),
  aktivan boolean not null default true,
  napravljen timestamptz not null default now()
);
create unique index objekat_naziv on magacin.objekat (lower(trim(naziv)));

create table magacin.dobavljac (
  id uuid primary key default gen_random_uuid(),
  naziv text not null check (length(trim(naziv)) > 0),
  aktivan boolean not null default true,
  napravljen timestamptz not null default now()
);
create unique index dobavljac_naziv on magacin.dobavljac (lower(trim(naziv)));

-- Prijavljena i aktivna osoba bilo koje uloge (za pravila čitanja).
create function magacin.je_aktivan_korisnik()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from magacin.korisnik where id = auth.uid() and aktivan)
$$;

alter table magacin.artikal enable row level security;
alter table magacin.pakovanje enable row level security;
alter table magacin.objekat enable row level security;
alter table magacin.dobavljac enable row level security;

grant select on magacin.artikal, magacin.pakovanje, magacin.objekat, magacin.dobavljac
  to authenticated;

create policy "prijavljeni čitaju artikle" on magacin.artikal
  for select to authenticated using (magacin.je_aktivan_korisnik());
create policy "prijavljeni čitaju pakovanja" on magacin.pakovanje
  for select to authenticated using (magacin.je_aktivan_korisnik());
create policy "prijavljeni čitaju objekte" on magacin.objekat
  for select to authenticated using (magacin.je_aktivan_korisnik());
create policy "prijavljeni čitaju dobavljače" on magacin.dobavljac
  for select to authenticated using (magacin.je_aktivan_korisnik());

-- Prazan tekst iz forme tretira kao "nema".
create function magacin.prazno_u_null(tekst text)
returns text
language sql
immutable
as $$ select nullif(trim(tekst), '') $$;

-- Odbija bar kod koji već koristi drugi artikal ili pakovanje.
create function magacin.provjeri_bar_kod(
  kod text, osim_artikla uuid, osim_pakovanja uuid
) returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if kod is null then return; end if;
  if exists (
    select 1 from magacin.artikal where bar_kod = kod and id is distinct from osim_artikla
  ) or exists (
    select 1 from magacin.pakovanje where bar_kod = kod and id is distinct from osim_pakovanja
  ) then
    raise exception 'Bar kod % već koristi drugi artikal ili pakovanje', kod
      using errcode = '23505';
  end if;
end
$$;

-- Dodaje (p_id null) ili mijenja artikal. p_pakovanja je niz
-- {id?, naziv, faktor, bar_kod?}; pakovanja koja nisu poslana se uklanjaju.
create function magacin.sacuvaj_artikal(
  p_id uuid,
  p_naziv text,
  p_mjera magacin.mjera,
  p_bar_kod text,
  p_minimum numeric,
  p_vrsta magacin.vrsta_magacina,
  p_pakovanja jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_bar_kod text := magacin.prazno_u_null(p_bar_kod);
  p jsonb;
  v_pak_id uuid;
  v_pak_kod text;
  v_zadrzana uuid[] := '{}';
begin
  perform magacin.zahtijevaj_ulogu('menadzer');

  if magacin.prazno_u_null(p_naziv) is null then
    raise exception 'Naziv artikla je obavezan' using errcode = '22023';
  end if;
  if p_minimum < 0 then
    raise exception 'Minimum ne može biti negativan' using errcode = '22023';
  end if;
  perform magacin.provjeri_bar_kod(v_bar_kod, p_id, null);

  if p_id is null then
    insert into magacin.artikal (naziv, mjera, bar_kod, minimum, vrsta)
    values (trim(p_naziv), p_mjera, v_bar_kod, p_minimum, p_vrsta)
    returning id into v_id;
  else
    update magacin.artikal
    set naziv = trim(p_naziv), mjera = p_mjera, bar_kod = v_bar_kod,
        minimum = p_minimum, vrsta = p_vrsta
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Artikal ne postoji' using errcode = 'P0002';
    end if;
  end if;

  for p in select * from jsonb_array_elements(coalesce(p_pakovanja, '[]'::jsonb)) loop
    v_pak_id := nullif(p ->> 'id', '')::uuid;
    v_pak_kod := magacin.prazno_u_null(p ->> 'bar_kod');
    if magacin.prazno_u_null(p ->> 'naziv') is null then
      raise exception 'Naziv pakovanja je obavezan' using errcode = '22023';
    end if;
    if coalesce((p ->> 'faktor')::numeric, 0) <= 0 then
      raise exception 'Faktor pakovanja mora biti veći od nule' using errcode = '22023';
    end if;
    -- Bar kod ne smije ni biti isti kao kod samog artikla.
    if v_pak_kod is not null and v_pak_kod = v_bar_kod then
      raise exception 'Bar kod % već koristi drugi artikal ili pakovanje', v_pak_kod
        using errcode = '23505';
    end if;
    perform magacin.provjeri_bar_kod(v_pak_kod, null, v_pak_id);

    if v_pak_id is null then
      insert into magacin.pakovanje (artikal_id, naziv, faktor, bar_kod)
      values (v_id, trim(p ->> 'naziv'), (p ->> 'faktor')::numeric, v_pak_kod)
      returning id into v_pak_id;
    else
      update magacin.pakovanje
      set naziv = trim(p ->> 'naziv'), faktor = (p ->> 'faktor')::numeric, bar_kod = v_pak_kod
      where id = v_pak_id and artikal_id = v_id;
      if not found then
        raise exception 'Pakovanje ne pripada ovom artiklu' using errcode = 'P0002';
      end if;
    end if;
    v_zadrzana := v_zadrzana || v_pak_id;
  end loop;

  delete from magacin.pakovanje where artikal_id = v_id and id <> all (v_zadrzana);
  return v_id;
end
$$;

create function magacin.postavi_aktivnost_artikla(p_id uuid, p_aktivan boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  update magacin.artikal set aktivan = p_aktivan where id = p_id;
  if not found then
    raise exception 'Artikal ne postoji' using errcode = 'P0002';
  end if;
end
$$;

create function magacin.sacuvaj_objekat(p_id uuid, p_naziv text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  if magacin.prazno_u_null(p_naziv) is null then
    raise exception 'Naziv objekta je obavezan' using errcode = '22023';
  end if;
  if exists (
    select 1 from magacin.objekat
    where lower(trim(naziv)) = lower(trim(p_naziv)) and id is distinct from p_id
  ) then
    raise exception 'Objekat s tim nazivom već postoji' using errcode = '23505';
  end if;
  if p_id is null then
    insert into magacin.objekat (naziv) values (trim(p_naziv)) returning id into v_id;
  else
    update magacin.objekat set naziv = trim(p_naziv) where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Objekat ne postoji' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end
$$;

create function magacin.postavi_aktivnost_objekta(p_id uuid, p_aktivan boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  update magacin.objekat set aktivan = p_aktivan where id = p_id;
  if not found then
    raise exception 'Objekat ne postoji' using errcode = 'P0002';
  end if;
end
$$;

create function magacin.sacuvaj_dobavljaca(p_id uuid, p_naziv text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  if magacin.prazno_u_null(p_naziv) is null then
    raise exception 'Naziv dobavljača je obavezan' using errcode = '22023';
  end if;
  if exists (
    select 1 from magacin.dobavljac
    where lower(trim(naziv)) = lower(trim(p_naziv)) and id is distinct from p_id
  ) then
    raise exception 'Dobavljač s tim nazivom već postoji' using errcode = '23505';
  end if;
  if p_id is null then
    insert into magacin.dobavljac (naziv) values (trim(p_naziv)) returning id into v_id;
  else
    update magacin.dobavljac set naziv = trim(p_naziv) where id = p_id returning id into v_id;
    if v_id is null then
      raise exception 'Dobavljač ne postoji' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end
$$;

create function magacin.postavi_aktivnost_dobavljaca(p_id uuid, p_aktivan boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  update magacin.dobavljac set aktivan = p_aktivan where id = p_id;
  if not found then
    raise exception 'Dobavljač ne postoji' using errcode = 'P0002';
  end if;
end
$$;
