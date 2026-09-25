-- Korisnici i uloge: ko je prijavljen i šta smije.
-- Prijava ide kroz Supabase Auth; ova migracija dodaje ime i ulogu osobe
-- te operacije koje sve kasnije operacije koriste da znaju ko radi i smije li.

create type magacin.uloga as enum ('magacioner', 'objekat', 'menadzer');

create table magacin.korisnik (
  id uuid primary key references auth.users (id) on delete cascade,
  ime text not null check (length(trim(ime)) > 0),
  uloga magacin.uloga not null,
  aktivan boolean not null default true,
  napravljen timestamptz not null default now()
);

alter table magacin.korisnik enable row level security;

grant usage on schema magacin to anon, authenticated;
grant select on magacin.korisnik to authenticated;

-- Vraća osobu koja radi (po prijavi). Odbija neprijavljene i isključene.
create function magacin.trenutni_korisnik()
returns magacin.korisnik
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik;
begin
  select * into k from magacin.korisnik where id = auth.uid() and aktivan;
  if not found then
    raise exception 'Korisnik nije prijavljen' using errcode = '28000';
  end if;
  return k;
end
$$;

-- Propušta osobu samo ako joj je uloga među dozvoljenima; inače odbija radnju.
create function magacin.zahtijevaj_ulogu(variadic dozvoljene magacin.uloga[])
returns magacin.korisnik
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.trenutni_korisnik();
begin
  if not (k.uloga = any (dozvoljene)) then
    raise exception 'Nemate pravo na ovu radnju' using errcode = '42501';
  end if;
  return k;
end
$$;

create function magacin.je_menadzer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from magacin.korisnik
    where id = auth.uid() and uloga = 'menadzer' and aktivan
  )
$$;

-- Imena za izbor na ekranu za prijavu (tablet još nema prijavljenu osobu).
-- Menadžer se ne nudi na listi; prijavljuje se lozinkom.
create function magacin.korisnici_za_prijavu()
returns table (id uuid, ime text, uloga magacin.uloga)
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, k.ime, k.uloga
  from magacin.korisnik k
  where k.aktivan and k.uloga in ('magacioner', 'objekat')
  order by k.ime
$$;

create policy "osoba vidi sebe" on magacin.korisnik
  for select to authenticated
  using (id = auth.uid());

create policy "menadzer vidi sve" on magacin.korisnik
  for select to authenticated
  using (magacin.je_menadzer());
