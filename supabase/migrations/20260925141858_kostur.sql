-- Kostur: šema u kojoj žive poslovna pravila magacina.
-- Sve operacije (prijem, zahtjev, izdavanje, ...) dodaju se u ovu šemu
-- kao funkcije i testiraju direktno kroz bazu.

create schema if not exists magacin;

-- Probna operacija: potvrđuje da su migracije primijenjene i da se
-- operacije u bazi mogu pozvati iz testova.
create function magacin.zdravlje()
returns text
language sql
stable
as $$ select 'ok'::text $$;
