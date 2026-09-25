-- Razvojni korisnici (samo lokalna baza; izvršava se pri `supabase db reset`).
-- NE koristi ove lozinke i PIN-ove nigdje van razvoja.
--
--   Menadžer:            menadzer@magacin.local  lozinka: menadzer123
--   Magacioner (PIN):    "Test Magacioner"       PIN: 111111
--   Objekat (PIN):       "ŠANK HOTEL (test)"     PIN: 222222
--
-- Prijava PIN-om ide preko adrese <id>@korisnik.magacin.local; PIN je lozinka.

create function pg_temp.napravi_korisnika(
  korisnik_id uuid, adresa text, lozinka text, ime text, uloga magacin.uloga
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', korisnik_id, 'authenticated', 'authenticated',
    adresa, extensions.crypt(lozinka, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), korisnik_id,
    jsonb_build_object('sub', korisnik_id::text, 'email', adresa, 'email_verified', true),
    'email', korisnik_id::text, now(), now(), now()
  );
  insert into magacin.korisnik (id, ime, uloga) values (korisnik_id, ime, uloga);
end
$$;

select pg_temp.napravi_korisnika(
  '11111111-1111-4111-8111-111111111111', 'menadzer@magacin.local', 'menadzer123',
  'Menadžer', 'menadzer');
select pg_temp.napravi_korisnika(
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222222@korisnik.magacin.local', '111111',
  'Test Magacioner', 'magacioner');
select pg_temp.napravi_korisnika(
  '33333333-3333-4333-8333-333333333333',
  '33333333-3333-4333-8333-333333333333@korisnik.magacin.local', '222222',
  'ŠANK HOTEL (test)', 'objekat');
