-- Prijem robe i stanje magacina.
--
-- Knjiga kretanja (kretanje_magacina) je nepromjenjiv niz zapisa: ko, kada, koji artikal,
-- koliko (u osnovnoj mjeri) i po kojoj cijeni. Stanje magacina (zaliha_magacina) čuva
-- količinu i ponderisanu prosječnu cijenu; mijenja se samo operacijama, u istoj
-- transakciji u kojoj se piše u knjigu. Izdavanje, otpis, popis i storno dodaju nove vrste
-- kretanja u ovu istu knjigu.

create type magacin.vrsta_kretanja as enum ('prijem');

-- Prijem robe od dobavljača (zaglavlje); stavke su zapisi u knjizi s ovim prijem_id.
create table magacin.prijem (
  id uuid primary key default gen_random_uuid(),
  dobavljac_id uuid not null references magacin.dobavljac (id),
  korisnik_id uuid not null references magacin.korisnik (id),
  vrijeme timestamptz not null default clock_timestamp()
);

create table magacin.kretanje_magacina (
  id bigint generated always as identity primary key,
  artikal_id uuid not null references magacin.artikal (id),
  vrsta magacin.vrsta_kretanja not null,
  -- U osnovnoj mjeri artikla; ulaz je pozitivan, izlaz negativan.
  kolicina numeric not null check (kolicina <> 0),
  -- Cijena po osnovnoj mjeri, u KM bez PDV-a.
  cijena numeric not null check (cijena >= 0),
  korisnik_id uuid not null references magacin.korisnik (id),
  vrijeme timestamptz not null default clock_timestamp(),
  prijem_id uuid references magacin.prijem (id),
  -- Kako je uneseno (ako je u pakovanju), radi provjere prema računu dobavljača.
  pakovanje_id uuid references magacin.pakovanje (id),
  kolicina_pakovanja numeric,
  napomena text
);
create index kretanje_artikal on magacin.kretanje_magacina (artikal_id, vrijeme);
create index kretanje_prijem on magacin.kretanje_magacina (prijem_id);

create table magacin.zaliha_magacina (
  artikal_id uuid primary key references magacin.artikal (id),
  kolicina numeric not null check (kolicina >= 0),
  prosjecna_cijena numeric not null check (prosjecna_cijena >= 0)
);

-- Knjiga se ne mijenja: ispravke idu novim zapisom (storno), nikad izmjenom ni brisanjem.
create function magacin.zabrani_izmjenu()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Knjiga je nepromjenjiva: zapisi se ne mijenjaju ni brišu (%)', tg_table_name
    using errcode = '42501';
end
$$;

create trigger prijem_nepromjenjiv before update or delete on magacin.prijem
  for each row execute function magacin.zabrani_izmjenu();
create trigger kretanje_nepromjenjivo before update or delete on magacin.kretanje_magacina
  for each row execute function magacin.zabrani_izmjenu();

-- Pravo čitanja imaju magacioner i menadžer (objekat ne vidi cijene ni stanje magacina).
create function magacin.ima_ulogu(variadic uloge magacin.uloga[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from magacin.korisnik
    where id = auth.uid() and aktivan and uloga = any (uloge)
  )
$$;

alter table magacin.prijem enable row level security;
alter table magacin.kretanje_magacina enable row level security;
alter table magacin.zaliha_magacina enable row level security;

grant select on magacin.prijem, magacin.kretanje_magacina, magacin.zaliha_magacina to authenticated;

create policy "magacin čita prijeme" on magacin.prijem
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "magacin čita knjigu" on magacin.kretanje_magacina
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "magacin čita stanje" on magacin.zaliha_magacina
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));

-- Unosi prijem: p_stavke je niz {artikal_id, pakovanje_id?, kolicina, cijena}.
-- Količina i cijena su u jedinici u kojoj se unose (osnovna mjera ili pakovanje);
-- u knjigu i stanje ulaze u osnovnoj mjeri. Sve ili ništa.
create function magacin.unesi_prijem(p_dobavljac uuid, p_stavke jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
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

  insert into magacin.prijem (dobavljac_id, korisnik_id)
  values (p_dobavljac, k.id)
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

-- Stanje magacina: svi aktivni artikli magacina (i oni bez zalihe) s količinom,
-- prosječnom cijenom i vrijednošću.
create function magacin.stanje_magacina(p_vrsta magacin.vrsta_magacina)
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  bar_kod text,
  kolicina numeric,
  prosjecna_cijena numeric,
  vrijednost numeric
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
         coalesce(z.kolicina * z.prosjecna_cijena, 0)
  from magacin.artikal a
  left join magacin.zaliha_magacina z on z.artikal_id = a.id
  where a.vrsta = p_vrsta and a.aktivan
  order by a.naziv;
end
$$;

-- Zadnji prijemi s imenom osobe i vremenom (ime dolazi ovdje jer magacioner
-- inače vidi samo svoj zapis korisnika).
create function magacin.zadnji_prijemi(p_limit int default 10)
returns table (
  id uuid,
  vrijeme timestamptz,
  dobavljac text,
  ime text,
  broj_stavki int,
  vrijednost numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  return query
  select p.id, p.vrijeme, d.naziv, ko.ime, count(k.id)::int, coalesce(sum(k.kolicina * k.cijena), 0)
  from magacin.prijem p
  join magacin.dobavljac d on d.id = p.dobavljac_id
  join magacin.korisnik ko on ko.id = p.korisnik_id
  left join magacin.kretanje_magacina k on k.prijem_id = p.id
  group by p.id, d.naziv, ko.ime
  order by p.vrijeme desc, p.id
  limit least(greatest(p_limit, 1), 100);
end
$$;
