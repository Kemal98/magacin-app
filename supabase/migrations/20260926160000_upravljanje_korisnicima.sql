-- Upravljanje korisnicima (menadžer) i zaštita PIN prijave od pogađanja.
--
-- Račun za prijavu (auth.users) pravi server preko administratorskog API-ja; ove funkcije upisuju i mijenjaju
-- osobu u magacinu i dozvoljene su samo menadžeru. Brojač pogrešnih PIN-ova mijenja isključivo server
-- (service_role), jer bi inače svako mogao poništavati svoj brojač.

grant usage on schema magacin to service_role;

-- Dodaje osobu u magacin. Račun (p_id) mora već postojati u sistemu prijave.
create function magacin.dodaj_korisnika(
  p_id uuid,
  p_ime text,
  p_uloga magacin.uloga,
  p_objekat uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  if magacin.prazno_u_null(p_ime) is null then
    raise exception 'Ime je obavezno' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_id) then
    raise exception 'Račun ne postoji u sistemu prijave' using errcode = 'P0002';
  end if;
  if exists (select 1 from magacin.korisnik where id = p_id) then
    raise exception 'Korisnik je već dodan' using errcode = '23505';
  end if;
  if exists (select 1 from magacin.korisnik where lower(trim(ime)) = lower(trim(p_ime))) then
    raise exception 'Korisnik s tim imenom već postoji' using errcode = '23505';
  end if;
  if p_uloga = 'objekat' then
    if p_objekat is null then
      raise exception 'Osoblje objekta mora biti vezano za objekat' using errcode = '22023';
    end if;
    if not exists (select 1 from magacin.objekat where id = p_objekat and aktivan) then
      raise exception 'Objekat ne postoji ili je isključen' using errcode = '22023';
    end if;
  elsif p_objekat is not null then
    raise exception 'Samo osoblje objekta se veže za objekat' using errcode = '22023';
  end if;

  insert into magacin.korisnik (id, ime, uloga, objekat_id)
  values (p_id, trim(p_ime), p_uloga, p_objekat);
end
$$;

-- Mijenja ime i (za osoblje objekta) objekat. Uloga se ne mijenja.
create function magacin.izmijeni_korisnika(p_id uuid, p_ime text, p_objekat uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik;
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  select * into k from magacin.korisnik where id = p_id;
  if not found then
    raise exception 'Korisnik ne postoji' using errcode = 'P0002';
  end if;
  if magacin.prazno_u_null(p_ime) is null then
    raise exception 'Ime je obavezno' using errcode = '22023';
  end if;
  if exists (
    select 1 from magacin.korisnik
    where lower(trim(ime)) = lower(trim(p_ime)) and id <> p_id
  ) then
    raise exception 'Korisnik s tim imenom već postoji' using errcode = '23505';
  end if;
  if k.uloga = 'objekat' then
    if p_objekat is null or not exists (select 1 from magacin.objekat where id = p_objekat and aktivan) then
      raise exception 'Osoblje objekta mora biti vezano za aktivan objekat' using errcode = '22023';
    end if;
  else
    p_objekat := null;
  end if;

  update magacin.korisnik set ime = trim(p_ime), objekat_id = p_objekat where id = p_id;
end
$$;

-- Isključuje ili ponovo uključuje osobu. Isključena osoba nestaje s ekrana za prijavu i ne može raditi.
create function magacin.postavi_aktivnost_korisnika(p_id uuid, p_aktivan boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja magacin.korisnik := magacin.zahtijevaj_ulogu('menadzer');
  k magacin.korisnik;
begin
  select * into k from magacin.korisnik where id = p_id;
  if not found then
    raise exception 'Korisnik ne postoji' using errcode = 'P0002';
  end if;
  if not p_aktivan then
    if p_id = ja.id then
      raise exception 'Ne možete isključiti sami sebe' using errcode = '22023';
    end if;
    if k.uloga = 'menadzer' and not exists (
      select 1 from magacin.korisnik where uloga = 'menadzer' and aktivan and id <> p_id
    ) then
      raise exception 'Mora ostati bar jedan aktivan menadžer' using errcode = '22023';
    end if;
  end if;
  update magacin.korisnik set aktivan = p_aktivan where id = p_id;
end
$$;

-- Brojač pogrešnih pokušaja prijave po računu. Nikome osim serveru nije dostupan.
create table magacin.pokusaj_prijave (
  korisnik_id uuid primary key references magacin.korisnik (id) on delete cascade,
  neuspjesnih int not null default 0,
  zadnji_pokusaj timestamptz,
  zakljucan_do timestamptz
);
alter table magacin.pokusaj_prijave enable row level security;
revoke all on table magacin.pokusaj_prijave from public, anon, authenticated;

-- Vraća do kada je račun zaključan, ili null ako nije. Poziva ga server prije provjere PIN-a.
create function magacin.provjeri_zakljucavanje(p_korisnik uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select p.zakljucan_do
  from magacin.pokusaj_prijave p
  where p.korisnik_id = p_korisnik and p.zakljucan_do > clock_timestamp()
$$;

-- Bilježi pogrešan pokušaj. Peti uzastopni pogrešan pokušaj zaključava račun na 15 minuta; dok je račun
-- zaključan, novi pokušaji ga ne produžavaju. Pokušaji stariji od pola sata i istekla zaključavanja se ne računaju.
create function magacin.zabiljezi_neuspjeli_pokusaj(p_korisnik uuid)
returns table (neuspjesnih int, zakljucan_do timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_najvise constant int := 5;
  c_zakljucaj constant interval := interval '15 minutes';
  c_zaboravi constant interval := interval '30 minutes';
  p magacin.pokusaj_prijave;
  sada timestamptz := clock_timestamp();
begin
  if not exists (select 1 from magacin.korisnik where id = p_korisnik) then
    return query select 0, null::timestamptz;
    return;
  end if;
  insert into magacin.pokusaj_prijave (korisnik_id) values (p_korisnik) on conflict do nothing;
  select * into p from magacin.pokusaj_prijave where korisnik_id = p_korisnik for update;

  if p.zakljucan_do is not null and p.zakljucan_do > sada then
    return query select p.neuspjesnih, p.zakljucan_do;
    return;
  end if;
  if p.zakljucan_do is not null or p.zadnji_pokusaj < sada - c_zaboravi then
    p.neuspjesnih := 0;
    p.zakljucan_do := null;
  end if;

  p.neuspjesnih := p.neuspjesnih + 1;
  if p.neuspjesnih >= c_najvise then
    p.zakljucan_do := sada + c_zakljucaj;
  end if;
  update magacin.pokusaj_prijave
  set neuspjesnih = p.neuspjesnih, zadnji_pokusaj = sada, zakljucan_do = p.zakljucan_do
  where korisnik_id = p_korisnik;
  return query select p.neuspjesnih, p.zakljucan_do;
end
$$;

-- Uspješna prijava poništava brojač.
create function magacin.zabiljezi_uspjesnu_prijavu(p_korisnik uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from magacin.pokusaj_prijave where korisnik_id = p_korisnik
$$;

-- Račun po e-adresi (za prijavu menadžera), jer se brojač vodi po računu.
create function magacin.korisnik_po_emailu(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  join magacin.korisnik k on k.id = u.id
  where lower(u.email) = lower(trim(p_email))
$$;

revoke all on function
  magacin.provjeri_zakljucavanje(uuid),
  magacin.zabiljezi_neuspjeli_pokusaj(uuid),
  magacin.zabiljezi_uspjesnu_prijavu(uuid),
  magacin.korisnik_po_emailu(text)
from public, anon, authenticated;
grant execute on function
  magacin.provjeri_zakljucavanje(uuid),
  magacin.zabiljezi_neuspjeli_pokusaj(uuid),
  magacin.zabiljezi_uspjesnu_prijavu(uuid),
  magacin.korisnik_po_emailu(text)
to service_role;

-- Menadžer odmah otključava račun.
create function magacin.otkljucaj_korisnika(p_korisnik uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  delete from magacin.pokusaj_prijave where korisnik_id = p_korisnik;
end
$$;

-- Zaključani računi (za menadžera).
create function magacin.zakljucani_racuni()
returns table (korisnik_id uuid, ime text, neuspjesnih int, zakljucan_do timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  return query
  select p.korisnik_id, k.ime, p.neuspjesnih, p.zakljucan_do
  from magacin.pokusaj_prijave p
  join magacin.korisnik k on k.id = p.korisnik_id
  where p.zakljucan_do > clock_timestamp()
  order by p.zakljucan_do desc;
end
$$;

-- Svi korisnici za ekran upravljanja. E-adresu vidi samo za menadžere (ostalim se prijavljuje PIN-om
-- preko tehničke adrese, koja nikome ništa ne znači).
create function magacin.korisnici_pregled()
returns table (
  id uuid,
  ime text,
  uloga magacin.uloga,
  aktivan boolean,
  objekat_id uuid,
  objekat text,
  email text,
  neuspjesnih int,
  zakljucan_do timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  return query
  select k.id, k.ime, k.uloga, k.aktivan, k.objekat_id, o.naziv,
         case when k.uloga = 'menadzer' then u.email::text end,
         coalesce(p.neuspjesnih, 0),
         case when p.zakljucan_do > clock_timestamp() then p.zakljucan_do end
  from magacin.korisnik k
  left join magacin.objekat o on o.id = k.objekat_id
  left join auth.users u on u.id = k.id
  left join magacin.pokusaj_prijave p on p.korisnik_id = k.id
  order by k.uloga, k.ime;
end
$$;
