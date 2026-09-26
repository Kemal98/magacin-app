-- Zaključavanje računa zbog pogrešnih PIN-ova je ukinuto (odluka vlasnika). Funkcije ostaju da server
-- i pregled menadžera rade nepromijenjeno, ali nikad ne zaključavaju i ne bilježe pokušaje.
create or replace function magacin.zabiljezi_neuspjeli_pokusaj(p_korisnik uuid)
returns table (neuspjesnih int, zakljucan_do timestamptz)
language sql
security definer
set search_path = ''
as $$
  select 0, null::timestamptz
$$;

create or replace function magacin.provjeri_zakljucavanje(p_korisnik uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select null::timestamptz
$$;

-- Račune koji su bili zaključani prije ove promjene odmah oslobađa.
delete from magacin.pokusaj_prijave;
