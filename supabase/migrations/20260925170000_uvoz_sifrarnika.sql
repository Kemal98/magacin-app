-- Uvoz šifrarnika (iz starog Excela): dodaje artikle, objekte i dobavljače kojih još nema.
-- Poređenje je po nazivu bez razlike u velikim slovima i razmacima, pa ponovni uvoz
-- ne pravi duplikate i ne prepisuje ništa što je menadžer već ispravio.
-- Uvoz ne dira zalihe; zalihe počinju prazne i nastaju prijemom.

create function magacin.uvezi_sifrarnik(
  p_artikli jsonb,
  p_objekti jsonb,
  p_dobavljaci jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a jsonb;
  v_naziv text;
  n_artikala int := 0;
  n_objekata int := 0;
  n_dobavljaca int := 0;
  dodano int;
begin
  perform magacin.zahtijevaj_ulogu('menadzer');

  for a in select * from jsonb_array_elements(coalesce(p_artikli, '[]'::jsonb)) loop
    v_naziv := magacin.prazno_u_null(a ->> 'naziv');
    if v_naziv is null then
      raise exception 'Naziv artikla je obavezan' using errcode = '22023';
    end if;
    insert into magacin.artikal (naziv, mjera, vrsta)
    select v_naziv, (a ->> 'mjera')::magacin.mjera, (a ->> 'vrsta')::magacin.vrsta_magacina
    where not exists (
      select 1 from magacin.artikal x where lower(trim(x.naziv)) = lower(v_naziv)
    );
    get diagnostics dodano = row_count;
    n_artikala := n_artikala + dodano;
  end loop;

  for v_naziv in select jsonb_array_elements_text(coalesce(p_objekti, '[]'::jsonb)) loop
    v_naziv := magacin.prazno_u_null(v_naziv);
    if v_naziv is null then
      raise exception 'Naziv objekta je obavezan' using errcode = '22023';
    end if;
    insert into magacin.objekat (naziv)
    select v_naziv
    where not exists (
      select 1 from magacin.objekat x where lower(trim(x.naziv)) = lower(v_naziv)
    );
    get diagnostics dodano = row_count;
    n_objekata := n_objekata + dodano;
  end loop;

  for v_naziv in select jsonb_array_elements_text(coalesce(p_dobavljaci, '[]'::jsonb)) loop
    v_naziv := magacin.prazno_u_null(v_naziv);
    if v_naziv is null then
      raise exception 'Naziv dobavljača je obavezan' using errcode = '22023';
    end if;
    insert into magacin.dobavljac (naziv)
    select v_naziv
    where not exists (
      select 1 from magacin.dobavljac x where lower(trim(x.naziv)) = lower(v_naziv)
    );
    get diagnostics dodano = row_count;
    n_dobavljaca := n_dobavljaca + dodano;
  end loop;

  return jsonb_build_object(
    'artikli', n_artikala, 'objekti', n_objekata, 'dobavljaci', n_dobavljaca
  );
end
$$;
