-- Odobren zahtjev koji još nije izdat može se odbiti uz razlog (npr. kad u međuvremenu nema robe),
-- da ne ostane zaglavljen. Izdat zahtjev se i dalje ne može odbiti (za to služi storno).
create or replace function magacin.odbij_zahtjev(p_zahtjev uuid, p_razlog text)
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
  select * into z from magacin.zahtjev where id = p_zahtjev for update;
  if not found then
    raise exception 'Zahtjev ne postoji' using errcode = 'P0002';
  end if;
  if z.status not in ('poslan', 'odobren') then
    raise exception 'Zahtjev je već obrađen (%)', z.status using errcode = '22023';
  end if;
  update magacin.zahtjev
  set status = 'odbijen', obradio_id = k.id, odluka_vrijeme = clock_timestamp(), razlog = trim(p_razlog)
  where id = z.id;
end
$$;
