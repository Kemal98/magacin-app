# Magacin sportskog centra

Aplikacija za evidenciju robe i troškova (magacin prehrane, prvi objekat ŠANK HOTEL).
Rječnik pojmova je u [CONTEXT.md](CONTEXT.md), specifikacija i zadaci u `.scratch/magacin-prehrana/`.

Poslovna pravila žive u bazi (Supabase/Postgres) kao operacije u šemi `magacin`,
a testovi ih pozivaju direktno na lokalnoj bazi.

## Pokretanje razvoja

Potrebno: Node i **Docker Desktop** (mora biti pokrenut).

```bash
npm install
npm run db:start     # pokreće lokalnu bazu (prvi put preuzima slike, traje nekoliko minuta)
npm run db:reset     # primjenjuje sve migracije od nule
npm test             # testovi kroz seam u bazi
npm run typecheck    # provjera tipova
npm run dev          # aplikacija na http://localhost:3000
npm run db:stop      # gasi lokalnu bazu
```

Lokalna baza: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
(može se promijeniti varijablom `DATABASE_URL`).

## Migracije

Nove migracije: `npx supabase migration new <naziv>`, zatim `npm run db:reset`.
Svaka operacija magacina ide u šemu `magacin` kao funkcija i dobija test u `tests/db/`.

Ako `docker` nije u PATH-u, dodaj `/Applications/Docker.app/Contents/Resources/bin`.

## Napomena o lokalnom Supabaseu

`db:start` pokreće bazu, API gateway (kong), prijavu (gotrue) i REST (postgrest); ostali servisi su
isključeni jer nisu potrebni. Na Apple Silicon Macu je arm64 slika `kong` pokvarena
(`exec format error`), a amd64 verzija radi kroz emulaciju. Zato se jednom lokalno napravi
amd64 slika istog imena:

```bash
printf 'FROM --platform=linux/amd64 public.ecr.aws/supabase/kong:2.8.1\n' \
  | docker build -t public.ecr.aws/supabase/kong:2.8.1 -
```

Ako Supabase javi `exec format error` za kong, ponovi tu naredbu (ostaje samo na tvom računaru).
