-- Popis magacina: magacioner izbroji stvarno stanje, vidi razliku prema sistemu i tek onda potvrdi
-- usklađivanje. Razlika se knjiži u nepromjenjivu knjigu (manjak po prosječnoj cijeni, višak po
-- prosječnoj ili navedenoj cijeni), a popis pamti ko, kada i šta je brojano.
-- Popis se može označiti kao početno stanje (prvi popis na dan početka rada).

create table magacin.popis (
  id uuid primary key default gen_random_uuid(),
  korisnik_id uuid not null references magacin.korisnik (id),
  vrijeme timestamptz not null default clock_timestamp(),
  pocetno boolean not null default false
);

create table magacin.popis_stavka (
  id uuid primary key default gen_random_uuid(),
  popis_id uuid not null references magacin.popis (id),
  artikal_id uuid not null references magacin.artikal (id),
  -- Stanje u sistemu u trenutku potvrde, brojano stanje i razlika (brojano − sistem).
  sistem numeric not null check (sistem >= 0),
  brojano numeric not null check (brojano >= 0),
  razlika numeric not null,
  -- Cijena po osnovnoj mjeri kojom je razlika vrednovana (KM bez PDV-a).
  cijena numeric not null check (cijena >= 0),
  vrijednost_razlike numeric not null,
  unique (popis_id, artikal_id)
);
create index popis_stavka_artikal on magacin.popis_stavka (artikal_id);

alter table magacin.kretanje_magacina
  add column popis_id uuid references magacin.popis (id);

alter table magacin.kretanje_magacina drop constraint kretanje_smjer;
alter table magacin.kretanje_magacina add constraint kretanje_smjer check (
  (vrsta = 'prijem' and kolicina > 0)
  or (vrsta in ('izdavanje', 'otpis') and kolicina < 0)
  or vrsta = 'popis'
);

create trigger popis_nepromjenjiv before update or delete on magacin.popis
  for each row execute function magacin.zabrani_izmjenu();
create trigger popis_stavka_nepromjenjiva before update or delete on magacin.popis_stavka
  for each row execute function magacin.zabrani_izmjenu();

alter table magacin.popis enable row level security;
alter table magacin.popis_stavka enable row level security;
grant select on magacin.popis, magacin.popis_stavka to authenticated;
create policy "magacin čita popise" on magacin.popis
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "magacin čita stavke popisa" on magacin.popis_stavka
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));

-- Zajednički račun za pregled i potvrdu: p_stavke je niz {artikal_id, brojano, sistem?, cijena?}.
-- Pri potvrdi (p_zakljucaj) redovi zalihe se zaključavaju, da stanje ne može promijeniti usred obračuna.
create function magacin.izracunaj_popis(p_stavke jsonb, p_zakljucaj boolean)
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  sistem numeric,
  brojano numeric,
  razlika numeric,
  cijena numeric,
  vrijednost_razlike numeric,
  treba_cijenu boolean,
  ocekivano numeric,
  prosjecna numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s jsonb;
  a magacin.artikal;
  v_brojano numeric;
  v_sistem numeric;
  v_prosjecna numeric;
  v_navedena numeric;
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  if jsonb_typeof(p_stavke) is distinct from 'array' or jsonb_array_length(p_stavke) = 0 then
    raise exception 'Popis nema nijedan artikal' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_stavke) as x(artikal_id uuid) group by x.artikal_id having count(*) > 1
  ) then
    raise exception 'Isti artikal je unesen dvaput' using errcode = '22023';
  end if;

  -- Uvijek istim redoslijedom, da se paralelni popisi i izdavanja ne zaglave.
  for s in
    select e.value
    from jsonb_array_elements(p_stavke) e
    order by (e.value ->> 'artikal_id')
  loop
    select * into a from magacin.artikal where id = (s ->> 'artikal_id')::uuid;
    if not found then
      raise exception 'Artikal ne postoji' using errcode = 'P0002';
    end if;
    v_brojano := (s ->> 'brojano')::numeric;
    if v_brojano is null or v_brojano < 0 then
      raise exception 'Brojano stanje za "%" mora biti broj, nula ili veće', a.naziv using errcode = '22023';
    end if;
    v_navedena := (s ->> 'cijena')::numeric;
    if v_navedena is not null and v_navedena < 0 then
      raise exception 'Cijena za "%" ne može biti negativna', a.naziv using errcode = '22023';
    end if;

    if p_zakljucaj then
      select zm.kolicina, zm.prosjecna_cijena into v_sistem, v_prosjecna
      from magacin.zaliha_magacina zm where zm.artikal_id = a.id for update;
    else
      select zm.kolicina, zm.prosjecna_cijena into v_sistem, v_prosjecna
      from magacin.zaliha_magacina zm where zm.artikal_id = a.id;
    end if;
    v_sistem := coalesce(v_sistem, 0);

    artikal_id := a.id;
    naziv := a.naziv;
    mjera := a.mjera;
    sistem := v_sistem;
    brojano := v_brojano;
    razlika := v_brojano - v_sistem;
    ocekivano := (s ->> 'sistem')::numeric;
    prosjecna := v_prosjecna;
    if razlika > 0 then
      cijena := coalesce(v_navedena, case when coalesce(v_prosjecna, 0) > 0 then v_prosjecna end);
      treba_cijenu := cijena is null;
    else
      cijena := coalesce(v_prosjecna, v_navedena, 0);
      treba_cijenu := false;
    end if;
    vrijednost_razlike := razlika * coalesce(cijena, 0);
    return next;
  end loop;
end
$$;

-- Pregled razlika prije potvrde; ništa se ne upisuje.
create function magacin.pregled_popisa(p_stavke jsonb)
returns table (
  artikal_id uuid,
  naziv text,
  mjera magacin.mjera,
  sistem numeric,
  brojano numeric,
  razlika numeric,
  cijena numeric,
  vrijednost_razlike numeric,
  treba_cijenu boolean
)
language sql
security definer
set search_path = ''
as $$
  select r.artikal_id, r.naziv, r.mjera, r.sistem, r.brojano, r.razlika, r.cijena, r.vrijednost_razlike, r.treba_cijenu
  from magacin.izracunaj_popis(p_stavke, false) r
  order by r.naziv
$$;

-- Potvrđuje popis i usklađuje stanje. Ako se stanje nekog artikla promijenilo od pregleda
-- (navedeno "sistem" se ne poklapa), potvrda se odbija. Sve ili ništa.
create function magacin.potvrdi_popis(p_stavke jsonb, p_pocetno boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  v_popis uuid;
  r record;
begin
  insert into magacin.popis (korisnik_id, pocetno) values (k.id, coalesce(p_pocetno, false))
  returning id into v_popis;

  for r in select * from magacin.izracunaj_popis(p_stavke, true) loop
    if r.ocekivano is not null and r.ocekivano <> r.sistem then
      raise exception 'Stanje artikla "%" se promijenilo od pregleda (bilo %, sada %). Ponovite pregled.',
        r.naziv, trim_scale(r.ocekivano), trim_scale(r.sistem) using errcode = '22023';
    end if;
    if r.treba_cijenu then
      raise exception 'Upišite cijenu za artikal "%" (nema prosječne cijene)', r.naziv using errcode = '22023';
    end if;

    if r.razlika < 0 then
      update magacin.zaliha_magacina set kolicina = r.brojano where artikal_id = r.artikal_id;
    elsif r.razlika > 0 then
      insert into magacin.zaliha_magacina as z (artikal_id, kolicina, prosjecna_cijena)
      values (r.artikal_id, r.razlika, r.cijena)
      on conflict (artikal_id) do update
      set prosjecna_cijena =
            (z.kolicina * z.prosjecna_cijena + excluded.kolicina * excluded.prosjecna_cijena)
            / (z.kolicina + excluded.kolicina),
          kolicina = z.kolicina + excluded.kolicina;
    end if;

    if r.razlika <> 0 then
      insert into magacin.kretanje_magacina (artikal_id, vrsta, kolicina, cijena, korisnik_id, popis_id)
      values (r.artikal_id, 'popis', r.razlika, r.cijena, k.id, v_popis);
    end if;

    insert into magacin.popis_stavka (popis_id, artikal_id, sistem, brojano, razlika, cijena, vrijednost_razlike)
    values (v_popis, r.artikal_id, r.sistem, r.brojano, r.razlika, r.cijena, r.vrijednost_razlike);
  end loop;

  return v_popis;
end
$$;

-- Popisi magacina, najnoviji prvi, sa stavkama i ukupnom vrijednošću razlike; odmah vidljivi menadžeru.
create function magacin.popisi_magacina(p_limit int default 50)
returns table (
  id uuid,
  vrijeme timestamptz,
  ime text,
  pocetno boolean,
  vrijednost_razlike numeric,
  stavke jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('magacioner', 'menadzer');
  return query
  select p.id, p.vrijeme, u.ime, p.pocetno,
         coalesce((select sum(ps.vrijednost_razlike) from magacin.popis_stavka ps where ps.popis_id = p.id), 0),
         coalesce((
           select jsonb_agg(
             jsonb_build_object(
               'artikal', a.naziv,
               'mjera', a.mjera,
               'sistem', ps.sistem,
               'brojano', ps.brojano,
               'razlika', ps.razlika,
               'cijena', ps.cijena,
               'vrijednost_razlike', ps.vrijednost_razlike
             )
             order by a.naziv
           )
           from magacin.popis_stavka ps
           join magacin.artikal a on a.id = ps.artikal_id
           where ps.popis_id = p.id
         ), '[]'::jsonb)
  from magacin.popis p
  join magacin.korisnik u on u.id = p.korisnik_id
  order by p.vrijeme desc, p.id
  limit least(greatest(p_limit, 1), 500);
end
$$;
