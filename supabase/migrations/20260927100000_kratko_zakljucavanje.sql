-- Kraće zaključavanje: interni softver, ali javno dostupan. Peti uzastopni pogrešan pokušaj zaključava
-- račun na 1 minut (umjesto 15); pokušaji stariji od 10 minuta se ne računaju.
create or replace function magacin.zabiljezi_neuspjeli_pokusaj(p_korisnik uuid)
returns table (neuspjesnih int, zakljucan_do timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_najvise constant int := 5;
  c_zakljucaj constant interval := interval '1 minute';
  c_zaboravi constant interval := interval '10 minutes';
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
