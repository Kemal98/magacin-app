-- Storno: menadžer poništava pogrešan prijem, izdavanje ili otpis uz razlog.
-- Ništa se ne briše niti mijenja: storno je novi zapis u knjizi s obrnutim predznakom, a poseban zapis
-- "storno" pamti ko, kada i zašto. Original ostaje vidljiv uz oznaku storna.

alter table magacin.kretanje_magacina drop constraint kretanje_smjer;
alter table magacin.kretanje_magacina add constraint kretanje_smjer check (
  (vrsta = 'prijem' and kolicina > 0)
  or (vrsta in ('izdavanje', 'otpis', 'storno_prijema') and kolicina < 0)
  or (vrsta in ('storno_izdavanja', 'storno_otpisa') and kolicina > 0)
  or vrsta = 'popis'
);

create table magacin.storno (
  id uuid primary key default gen_random_uuid(),
  vrsta text not null check (vrsta in ('prijem', 'izdavanje', 'otpis')),
  prijem_id uuid references magacin.prijem (id),
  zahtjev_id uuid references magacin.zahtjev (id),
  kretanje_id bigint references magacin.kretanje_magacina (id),
  korisnik_id uuid not null references magacin.korisnik (id),
  razlog text not null check (length(trim(razlog)) > 0),
  vrijeme timestamptz not null default clock_timestamp(),
  check (
    (vrsta = 'prijem' and prijem_id is not null and zahtjev_id is null and kretanje_id is null)
    or (vrsta = 'izdavanje' and zahtjev_id is not null and prijem_id is null and kretanje_id is null)
    or (vrsta = 'otpis' and kretanje_id is not null and prijem_id is null and zahtjev_id is null)
  )
);
-- Isti zapis se ne može poništiti dvaput.
create unique index storno_prijem on magacin.storno (prijem_id) where prijem_id is not null;
create unique index storno_zahtjev on magacin.storno (zahtjev_id) where zahtjev_id is not null;
create unique index storno_kretanje on magacin.storno (kretanje_id) where kretanje_id is not null;

create trigger storno_nepromjenjiv before update or delete on magacin.storno
  for each row execute function magacin.zabrani_izmjenu();

alter table magacin.storno enable row level security;
grant select on magacin.storno to authenticated;
create policy "magacin čita storno" on magacin.storno
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));

-- Poništava cijeli prijem: skida primljeno sa zalihe i vraća prosječnu cijenu kao da prijema nije bilo.
-- Ne može ako je roba već izdata ili otpisana (stanje ne smije otići u minus).
create function magacin.storniraj_prijem(p_prijem uuid, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('menadzer');
  r record;
  v_na_stanju numeric;
begin
  if magacin.prazno_u_null(p_razlog) is null then
    raise exception 'Razlog storna je obavezan' using errcode = '22023';
  end if;
  perform 1 from magacin.prijem where id = p_prijem for update;
  if not found then
    raise exception 'Prijem ne postoji' using errcode = 'P0002';
  end if;
  if exists (select 1 from magacin.storno where prijem_id = p_prijem) then
    raise exception 'Prijem je već poništen' using errcode = '22023';
  end if;

  for r in
    select ko.*, a.naziv, a.mjera
    from magacin.kretanje_magacina ko
    join magacin.artikal a on a.id = ko.artikal_id
    where ko.prijem_id = p_prijem and ko.vrsta = 'prijem'
    order by ko.artikal_id, ko.id
  loop
    -- Iz prosjeka se izuzima upravo ta pošiljka (količina po njenoj cijeni).
    update magacin.zaliha_magacina z
    set prosjecna_cijena = case
          when z.kolicina - r.kolicina > 0
            then greatest((z.kolicina * z.prosjecna_cijena - r.kolicina * r.cijena) / (z.kolicina - r.kolicina), 0)
          else z.prosjecna_cijena
        end,
        kolicina = z.kolicina - r.kolicina
    where z.artikal_id = r.artikal_id and z.kolicina >= r.kolicina;

    if not found then
      select kolicina into v_na_stanju from magacin.zaliha_magacina where artikal_id = r.artikal_id;
      raise exception 'Prijem se ne može poništiti: artikal "%" je već izdat ili otpisan (na stanju % %, a treba skinuti % %)',
        r.naziv, trim_scale(coalesce(v_na_stanju, 0)), r.mjera, trim_scale(r.kolicina), r.mjera
        using errcode = '22023';
    end if;

    insert into magacin.kretanje_magacina
      (artikal_id, vrsta, kolicina, cijena, korisnik_id, prijem_id, pakovanje_id, kolicina_pakovanja, napomena)
    values (r.artikal_id, 'storno_prijema', -r.kolicina, r.cijena, k.id, p_prijem, r.pakovanje_id,
            r.kolicina_pakovanja, trim(p_razlog));
  end loop;

  insert into magacin.storno (vrsta, prijem_id, korisnik_id, razlog) values ('prijem', p_prijem, k.id, trim(p_razlog));
end
$$;

-- Poništava otpis: roba se vraća na stanje po cijeni po kojoj je otpisana.
create function magacin.storniraj_otpis(p_kretanje bigint, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('menadzer');
  o magacin.kretanje_magacina;
begin
  if magacin.prazno_u_null(p_razlog) is null then
    raise exception 'Razlog storna je obavezan' using errcode = '22023';
  end if;
  select * into o from magacin.kretanje_magacina where id = p_kretanje and vrsta = 'otpis' for update;
  if not found then
    raise exception 'Otpis ne postoji' using errcode = 'P0002';
  end if;
  if exists (select 1 from magacin.storno where kretanje_id = p_kretanje) then
    raise exception 'Otpis je već poništen' using errcode = '22023';
  end if;

  insert into magacin.zaliha_magacina as z (artikal_id, kolicina, prosjecna_cijena)
  values (o.artikal_id, -o.kolicina, o.cijena)
  on conflict (artikal_id) do update
  set prosjecna_cijena =
        (z.kolicina * z.prosjecna_cijena + excluded.kolicina * excluded.prosjecna_cijena)
        / (z.kolicina + excluded.kolicina),
      kolicina = z.kolicina + excluded.kolicina;

  insert into magacin.kretanje_magacina
    (artikal_id, vrsta, kolicina, cijena, korisnik_id, pakovanje_id, kolicina_pakovanja, napomena)
  values (o.artikal_id, 'storno_otpisa', -o.kolicina, o.cijena, k.id, o.pakovanje_id, o.kolicina_pakovanja, trim(p_razlog));

  insert into magacin.storno (vrsta, kretanje_id, korisnik_id, razlog) values ('otpis', p_kretanje, k.id, trim(p_razlog));
end
$$;

-- Poništava izdavanje: roba se vraća u magacin (po cijeni po kojoj je izdata), a skida iz zalihe objekta.
-- Moguće dok je zahtjev "na dostavi" ili "primljen", i samo ako roba u objektu nije već potrošena.
-- Zahtjev dobija status "stornirano".
create function magacin.storniraj_izdavanje(p_zahtjev uuid, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('menadzer');
  z magacin.zahtjev;
  r record;
  v_iznos numeric;
  v_cijena numeric;
begin
  if magacin.prazno_u_null(p_razlog) is null then
    raise exception 'Razlog storna je obavezan' using errcode = '22023';
  end if;
  select * into z from magacin.zahtjev where id = p_zahtjev for update;
  if not found then
    raise exception 'Zahtjev ne postoji' using errcode = 'P0002';
  end if;
  if z.status not in ('na_dostavi', 'primljeno') then
    raise exception 'Izdavanje se može poništiti samo za zahtjev koji je na dostavi ili primljen (status: %)', z.status
      using errcode = '22023';
  end if;

  for r in
    select st.*, a.naziv
    from magacin.zahtjev_stavka st
    join magacin.artikal a on a.id = st.artikal_id
    where st.zahtjev_id = z.id and st.izdana_osnovna > 0
    order by st.artikal_id, st.id
  loop
    v_cijena := coalesce(r.izdana_cijena, 0);
    -- Objekat ima ono što je primio (ili, na dostavi, ono što je poslano).
    v_iznos := case when z.status = 'primljeno' then coalesce(r.primljena_osnovna, r.izdana_osnovna) else r.izdana_osnovna end;

    if v_iznos > 0 then
      update magacin.zaliha_objekta zo
      set kolicina = zo.kolicina - v_iznos
      where zo.objekat_id = z.objekat_id
        and zo.artikal_id = r.artikal_id
        and zo.kolicina - coalesce((
              select sum(st2.izdana_osnovna)
              from magacin.zahtjev_stavka st2
              join magacin.zahtjev z2 on z2.id = st2.zahtjev_id
              where z2.objekat_id = zo.objekat_id and z2.status = 'na_dostavi'
                and z2.id <> z.id and st2.artikal_id = zo.artikal_id
            ), 0) >= v_iznos;
      if not found then
        raise exception 'Izdavanje se ne može poništiti: roba "%" je u objektu već potrošena ili otpisana', r.naziv
          using errcode = '22023';
      end if;
    end if;

    -- Knjiga objekta: poništava se izdavanje, a ako je bio manjak pri prijemu i on.
    insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id, zahtjev_id, napomena)
    values (z.objekat_id, r.artikal_id, 'storno_izdavanja', -r.izdana_osnovna, v_cijena, k.id, z.id, trim(p_razlog));
    if z.status = 'primljeno' and coalesce(r.primljena_osnovna, r.izdana_osnovna) < r.izdana_osnovna then
      insert into magacin.kretanje_objekta (objekat_id, artikal_id, vrsta, kolicina, cijena, korisnik_id, zahtjev_id, napomena)
      values (z.objekat_id, r.artikal_id, 'storno_izdavanja', r.izdana_osnovna - r.primljena_osnovna, v_cijena, k.id, z.id, trim(p_razlog));
    end if;

    -- Magacin dobija sve izdato natrag.
    insert into magacin.zaliha_magacina as zm (artikal_id, kolicina, prosjecna_cijena)
    values (r.artikal_id, r.izdana_osnovna, v_cijena)
    on conflict (artikal_id) do update
    set prosjecna_cijena =
          (zm.kolicina * zm.prosjecna_cijena + excluded.kolicina * excluded.prosjecna_cijena)
          / (zm.kolicina + excluded.kolicina),
        kolicina = zm.kolicina + excluded.kolicina;

    insert into magacin.kretanje_magacina
      (artikal_id, vrsta, kolicina, cijena, korisnik_id, zahtjev_id, objekat_id, pakovanje_id, kolicina_pakovanja, napomena)
    values (r.artikal_id, 'storno_izdavanja', r.izdana_osnovna, v_cijena, k.id, z.id, z.objekat_id,
            r.pakovanje_id, r.izdana_kolicina, trim(p_razlog));
  end loop;

  update magacin.zahtjev set status = 'stornirano' where id = z.id;
  insert into magacin.storno (vrsta, zahtjev_id, korisnik_id, razlog) values ('izdavanje', z.id, k.id, trim(p_razlog));
end
$$;

-- Pregled radnji koje se mogu poništiti (prijemi, izdavanja, otpisi), najnovije prve, uz oznaku
-- storna, razlog i ime osobe. Samo za menadžera.
create function magacin.storno_pregled(p_limit int default 50)
returns table (
  vrsta text,
  id text,
  vrijeme timestamptz,
  opis text,
  vrijednost numeric,
  ime text,
  stornirano boolean,
  storno_razlog text,
  storno_ime text,
  storno_vrijeme timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  return query
  select * from (
    select 'prijem'::text as vrsta, p.id::text as id, p.vrijeme,
           d.naziv || ': ' || coalesce((
             select string_agg(a.naziv || ' ' || trim_scale(ko.kolicina) || ' ' || a.mjera, ', ' order by a.naziv)
             from magacin.kretanje_magacina ko
             join magacin.artikal a on a.id = ko.artikal_id
             where ko.prijem_id = p.id and ko.vrsta = 'prijem'
           ), '') as opis,
           coalesce((select sum(ko.kolicina * ko.cijena) from magacin.kretanje_magacina ko
                     where ko.prijem_id = p.id and ko.vrsta = 'prijem'), 0) as vrijednost,
           u.ime as ime,
           (sn.id is not null) as stornirano, sn.razlog as storno_razlog, su.ime as storno_ime, sn.vrijeme as storno_vrijeme
    from magacin.prijem p
    join magacin.dobavljac d on d.id = p.dobavljac_id
    join magacin.korisnik u on u.id = p.korisnik_id
    left join magacin.storno sn on sn.prijem_id = p.id
    left join magacin.korisnik su on su.id = sn.korisnik_id

    union all

    select 'izdavanje'::text, z.id::text, z.izdano_vrijeme,
           o.naziv || ': ' || coalesce((
             select string_agg(a.naziv || ' ' || trim_scale(st.izdana_osnovna) || ' ' || a.mjera, ', ' order by a.naziv)
             from magacin.zahtjev_stavka st
             join magacin.artikal a on a.id = st.artikal_id
             where st.zahtjev_id = z.id and st.izdana_osnovna > 0
           ), ''),
           coalesce((select sum(st.izdana_osnovna * coalesce(st.izdana_cijena, 0)) from magacin.zahtjev_stavka st
                     where st.zahtjev_id = z.id), 0),
           iz.ime,
           (sn.id is not null), sn.razlog, su.ime, sn.vrijeme
    from magacin.zahtjev z
    join magacin.objekat o on o.id = z.objekat_id
    join magacin.korisnik iz on iz.id = z.izdao_id
    left join magacin.storno sn on sn.zahtjev_id = z.id
    left join magacin.korisnik su on su.id = sn.korisnik_id
    where z.izdao_id is not null

    union all

    select 'otpis'::text, ko.id::text, ko.vrijeme,
           a.naziv || ' ' || trim_scale(-ko.kolicina) || ' ' || a.mjera || ' (' || coalesce(ko.napomena, '') || ')',
           -ko.kolicina * ko.cijena,
           u.ime,
           (sn.id is not null), sn.razlog, su.ime, sn.vrijeme
    from magacin.kretanje_magacina ko
    join magacin.artikal a on a.id = ko.artikal_id
    join magacin.korisnik u on u.id = ko.korisnik_id
    left join magacin.storno sn on sn.kretanje_id = ko.id
    left join magacin.korisnik su on su.id = sn.korisnik_id
    where ko.vrsta = 'otpis'
  ) x
  order by x.vrijeme desc, x.id
  limit least(greatest(p_limit, 1), 500);
end
$$;
