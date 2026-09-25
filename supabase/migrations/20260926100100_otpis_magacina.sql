-- Otpis magacina: skida robu sa zalihe zbog kvara, isteka roka ili lomljenja, uz obavezan razlog.
-- Vodi se kao odvojen trošak (ne miješa se s potrošnjom objekata), po prosječnoj cijeni magacina,
-- i vidljiv je menadžeru odmah, bez dodatnog odobravanja.

alter table magacin.kretanje_magacina drop constraint kretanje_smjer;
alter table magacin.kretanje_magacina add constraint kretanje_smjer check (
  (vrsta = 'prijem' and kolicina > 0)
  or (vrsta in ('izdavanje', 'otpis') and kolicina < 0)
);

-- Otpisuje robu iz magacina. Količina je u osnovnoj mjeri ili u pakovanju (p_pakovanje).
create function magacin.otpisi_iz_magacina(
  p_artikal uuid,
  p_kolicina numeric,
  p_razlog text,
  p_pakovanje uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  a magacin.artikal;
  v_faktor numeric := 1;
  v_osnovna numeric;
  v_cijena numeric;
  v_na_stanju numeric;
begin
  if magacin.prazno_u_null(p_razlog) is null then
    raise exception 'Razlog otpisa je obavezan' using errcode = '22023';
  end if;
  if p_kolicina is null or p_kolicina <= 0 then
    raise exception 'Količina otpisa mora biti veća od nule' using errcode = '22023';
  end if;

  select * into a from magacin.artikal where id = p_artikal;
  if not found then
    raise exception 'Artikal ne postoji' using errcode = 'P0002';
  end if;
  if p_pakovanje is not null then
    select faktor into v_faktor from magacin.pakovanje where id = p_pakovanje and artikal_id = a.id;
    if not found then
      raise exception 'Pakovanje ne pripada artiklu "%"', a.naziv using errcode = '22023';
    end if;
  end if;
  v_osnovna := p_kolicina * v_faktor;

  -- Oduzima samo ako ima dovoljno; zaključan red čini paralelne otpise sigurnim.
  update magacin.zaliha_magacina
  set kolicina = kolicina - v_osnovna
  where artikal_id = a.id and kolicina >= v_osnovna
  returning prosjecna_cijena into v_cijena;

  if not found then
    select kolicina into v_na_stanju from magacin.zaliha_magacina where artikal_id = a.id;
    raise exception 'Nema dovoljno artikla "%" u magacinu: na stanju % %, za otpis % %',
      a.naziv, trim_scale(coalesce(v_na_stanju, 0)), a.mjera, trim_scale(v_osnovna), a.mjera
      using errcode = '22023';
  end if;

  insert into magacin.kretanje_magacina
    (artikal_id, vrsta, kolicina, cijena, korisnik_id, pakovanje_id, kolicina_pakovanja, napomena)
  values (
    a.id, 'otpis', -v_osnovna, v_cijena, k.id,
    p_pakovanje, case when p_pakovanje is not null then p_kolicina end, trim(p_razlog)
  );
end
$$;

-- Otpisi magacina, najnoviji prvi, s razlogom, vrijednošću, imenom osobe i vremenom.
create function magacin.otpisi_magacina(p_limit int default 100)
returns table (
  vrijeme timestamptz,
  artikal text,
  mjera magacin.mjera,
  kolicina numeric,
  razlog text,
  cijena numeric,
  vrijednost numeric,
  ime text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  return query
  select ko.vrijeme, a.naziv, a.mjera, -ko.kolicina, ko.napomena, ko.cijena, -ko.kolicina * ko.cijena, u.ime
  from magacin.kretanje_magacina ko
  join magacin.artikal a on a.id = ko.artikal_id
  join magacin.korisnik u on u.id = ko.korisnik_id
  where ko.vrsta = 'otpis'
  order by ko.vrijeme desc, ko.id desc
  limit least(greatest(p_limit, 1), 500);
end
$$;
