-- Popis artikala po objektu: menadžer zadaje koje artikle koji objekat vidi i traži.
-- Osoblje objekta je vezano za svoj objekat (korisnik.objekat_id) i vidi samo njegov popis.

alter table magacin.korisnik
  add column objekat_id uuid references magacin.objekat (id);

create table magacin.objekat_artikal (
  objekat_id uuid not null references magacin.objekat (id) on delete cascade,
  artikal_id uuid not null references magacin.artikal (id) on delete cascade,
  primary key (objekat_id, artikal_id)
);
create index objekat_artikal_artikal on magacin.objekat_artikal (artikal_id);

-- Objekat osobe koja radi (null ako nije osoblje objekta).
create function magacin.moj_objekat()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select objekat_id from magacin.korisnik where id = auth.uid() and aktivan
$$;

alter table magacin.objekat_artikal enable row level security;
grant select on magacin.objekat_artikal to authenticated;

create policy "magacin i menadžer čitaju popise" on magacin.objekat_artikal
  for select to authenticated using (magacin.ima_ulogu('magacioner', 'menadzer'));
create policy "objekat čita svoj popis" on magacin.objekat_artikal
  for select to authenticated
  using (magacin.ima_ulogu('objekat') and objekat_id = magacin.moj_objekat());

-- Zamjenjuje popis artikala objekta zadanim (dodaje nove, uklanja izostavljene).
create function magacin.postavi_artikle_objekta(p_objekat uuid, p_artikli uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trazeno uuid[] := coalesce(array(select distinct unnest(p_artikli)), '{}');
begin
  perform magacin.zahtijevaj_ulogu('menadzer');
  if not exists (select 1 from magacin.objekat where id = p_objekat) then
    raise exception 'Objekat ne postoji' using errcode = 'P0002';
  end if;
  if (select count(*) from magacin.artikal where id = any (v_trazeno)) <> cardinality(v_trazeno) then
    raise exception 'Neki od izabranih artikala ne postoji' using errcode = 'P0002';
  end if;

  delete from magacin.objekat_artikal
  where objekat_id = p_objekat and artikal_id <> all (v_trazeno);
  insert into magacin.objekat_artikal (objekat_id, artikal_id)
  select p_objekat, unnest(v_trazeno)
  on conflict do nothing;
end
$$;

-- Aktivni artikli s popisa objekta, s onim što treba za unos (mjera, bar kod, pakovanja).
-- Objekat dobija samo svoj popis; magacioner i menadžer navode objekat.
create function magacin.artikli_objekta(p_objekat uuid default null)
returns table (
  id uuid,
  naziv text,
  mjera magacin.mjera,
  bar_kod text,
  vrsta magacin.vrsta_magacina,
  pakovanja jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k magacin.korisnik := magacin.zahtijevaj_ulogu('objekat', 'magacioner', 'menadzer');
  v_objekat uuid := p_objekat;
begin
  if k.uloga = 'objekat' then
    if k.objekat_id is null then
      raise exception 'Vaš račun nije vezan za objekat. Obratite se menadžeru.' using errcode = '22023';
    end if;
    if p_objekat is not null and p_objekat <> k.objekat_id then
      raise exception 'Nemate pravo na ovu radnju' using errcode = '42501';
    end if;
    v_objekat := k.objekat_id;
  elsif v_objekat is null then
    raise exception 'Navedite objekat' using errcode = '22023';
  end if;

  return query
  select a.id, a.naziv, a.mjera, a.bar_kod, a.vrsta,
         coalesce(
           (select jsonb_agg(
                     jsonb_build_object('id', p.id, 'naziv', p.naziv, 'faktor', p.faktor, 'bar_kod', p.bar_kod)
                     order by p.faktor)
            from magacin.pakovanje p where p.artikal_id = a.id),
           '[]'::jsonb)
  from magacin.objekat_artikal oa
  join magacin.artikal a on a.id = oa.artikal_id
  where oa.objekat_id = v_objekat and a.aktivan
  order by a.naziv;
end
$$;
