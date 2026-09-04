# Supabase online synchronisatie

## 1. Maak een gratis project

Maak een project aan op https://supabase.com. Gebruik in de app de **Project URL** en de **anon public key** uit `Project Settings > API`.

Gebruik nooit de `service_role` key in de browser.

## 2. Maak de operations-tabel

Voer dit uit in de Supabase SQL Editor:

```sql
create table if not exists public.race_operations (
  operation_id text primary key,
  event_id text not null,
  participant_id text,
  type text not null,
  device_id text not null,
  operator_id text not null,
  device_timestamp timestamptz not null,
  server_timestamp timestamptz,
  payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists race_operations_event_id_idx
  on public.race_operations (event_id, device_timestamp);
```

## 3. Beveiliging voor een eerste test

Voor een eerste test kan de tabel tijdelijk lees- en schrijfbaar zijn voor de anon key:

```sql
alter table public.race_operations enable row level security;

create policy "race operations insert for anon"
  on public.race_operations for insert
  to anon
  with check (true);

create policy "race operations read for anon"
  on public.race_operations for select
  to anon
  using (true);
```

Voor productie moet dit worden beperkt met Supabase Auth en een event-/organisatiecontrole. Publiceren met alleen de anon key zonder RLS-beperkingen maakt de data openbaar wijzigbaar.

## 4. Registreer de app

Open **Instellingen > Online Synchronisatie** en vul in:

- Supabase Project URL
- Supabase anon public key
- Event-ID, bijvoorbeeld `event-de-haan-2026`
- Schakel online synchronisatie in

Klik eerst op **Verbinding testen** en daarna op **Instellingen opslaan**.

De racegegevens blijven lokaal in IndexedDB. De knop voor synchroniseren uploadt de lokale `RaceOperation`-records naar Supabase. De unieke `operation_id` voorkomt dubbele records.

## Gratis alternatief

Google Drive blijft geschikt voor handmatige JSON-back-ups, maar niet als realtime database. Gebruik Supabase voor synchronisatie en Drive eventueel voor back-ups.
