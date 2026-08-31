-- MCCS V2.11.x private chat: 7-day message retention.
-- Chat attachments reference existing MCCS documents by UUID, but are NOT deleted by chat cleanup.
-- Safe to rerun.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  attachment_document_id uuid null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint chat_not_self check (sender_id <> recipient_id),
  constraint chat_has_content check (length(trim(body)) > 0 or attachment_document_id is not null)
);

alter table public.chat_messages add column if not exists body text not null default '';
alter table public.chat_messages add column if not exists attachment_document_id uuid null;
alter table public.chat_messages add column if not exists created_at timestamptz not null default now();
alter table public.chat_messages add column if not exists read_at timestamptz null;

create index if not exists chat_sender_recipient_created_idx on public.chat_messages(sender_id, recipient_id, created_at desc);
create index if not exists chat_recipient_sender_created_idx on public.chat_messages(recipient_id, sender_id, created_at desc);
create index if not exists chat_recipient_unread_idx on public.chat_messages(recipient_id, read_at, created_at desc);
create index if not exists chat_created_at_idx on public.chat_messages(created_at);

alter table public.chat_messages enable row level security;

drop policy if exists chat_read_participants on public.chat_messages;
drop policy if exists chat_send_self on public.chat_messages;
drop policy if exists chat_mark_received_read on public.chat_messages;
drop policy if exists chat_delete_own on public.chat_messages;

create policy chat_read_participants on public.chat_messages
for select to authenticated
using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy chat_send_self on public.chat_messages
for insert to authenticated
with check (auth.uid() = sender_id and recipient_id <> auth.uid());

create policy chat_mark_received_read on public.chat_messages
for update to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

create policy chat_delete_own on public.chat_messages
for delete to authenticated
using (auth.uid() = sender_id);

do $$
begin
  if to_regclass('public.profiles') is not null and not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles' and policyname='profiles_chat_directory'
  ) then
    execute $policy$create policy profiles_chat_directory on public.profiles for select to authenticated using (true)$policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

alter table public.chat_messages replica identity full;

do $$
declare old_job_id bigint;
begin
  select jobid into old_job_id from cron.job where jobname='mccs-chat-7day-cleanup' limit 1;
  if old_job_id is not null then perform cron.unschedule(old_job_id); end if;
end $$;

select cron.schedule(
  'mccs-chat-7day-cleanup',
  '15 2 * * *',
  $cleanup$delete from public.chat_messages where created_at < now() - interval '7 days';$cleanup$
);

-- MCCS V2.13.1 global collaboration + WebRTC voice calling upgrade.
-- Safe to rerun. This supersedes the earlier 7-day TEXT cleanup because MCCS now retains
-- full chat history and paginates it on demand. Google Drive files remain independently controlled.

do $$
declare old_job_id bigint;
begin
  select jobid into old_job_id from cron.job where jobname='mccs-chat-7day-cleanup' limit 1;
  if old_job_id is not null then perform cron.unschedule(old_job_id); end if;
end $$;

alter table public.chat_messages add column if not exists message_type text not null default 'text';
alter table public.chat_messages add column if not exists voice_duration_seconds integer null;
alter table public.chat_messages add column if not exists voice_waveform jsonb null;

create table if not exists public.chat_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null,
  call_type text not null default 'voice',
  status text not null default 'calling',
  started_at timestamptz null,
  ringing_at timestamptz null,
  answered_at timestamptz null,
  ended_at timestamptz null,
  duration_seconds integer not null default 0,
  ended_by uuid null references auth.users(id) on delete set null,
  missed boolean not null default false,
  screen_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_calls_not_self check (caller_id <> receiver_id),
  constraint chat_calls_voice_only check (call_type = 'voice')
);

-- Compatibility with any earlier chat_calls migration.
alter table public.chat_calls add column if not exists conversation_id uuid null;
alter table public.chat_calls add column if not exists ringing_at timestamptz null;
alter table public.chat_calls add column if not exists answered_at timestamptz null;
alter table public.chat_calls add column if not exists ended_by uuid null references auth.users(id) on delete set null;
alter table public.chat_calls add column if not exists missed boolean not null default false;
alter table public.chat_calls add column if not exists screen_shared boolean not null default false;
alter table public.chat_calls add column if not exists updated_at timestamptz not null default now();

-- Remove obsolete LiveKit-only room field requirement if a previous release created it.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='chat_calls' and column_name='room_name') then
    alter table public.chat_calls alter column room_name drop not null;
  end if;
exception when others then null;
end $$;

do $$ begin
  if exists (select 1 from information_schema.table_constraints where table_schema='public' and table_name='chat_calls' and constraint_name='chat_calls_call_type_check') then
    alter table public.chat_calls drop constraint chat_calls_call_type_check;
  end if;
exception when others then null;
end $$;

create index if not exists chat_calls_caller_created_idx on public.chat_calls(caller_id, created_at desc);
create index if not exists chat_calls_receiver_created_idx on public.chat_calls(receiver_id, created_at desc);
create index if not exists chat_calls_receiver_status_idx on public.chat_calls(receiver_id, status, created_at desc);

alter table public.chat_calls enable row level security;
drop policy if exists chat_calls_participants_select on public.chat_calls;
drop policy if exists chat_calls_caller_insert on public.chat_calls;
drop policy if exists chat_calls_participants_update on public.chat_calls;
create policy chat_calls_participants_select on public.chat_calls for select to authenticated using (auth.uid()=caller_id or auth.uid()=receiver_id);
create policy chat_calls_caller_insert on public.chat_calls for insert to authenticated with check (auth.uid()=caller_id and receiver_id<>auth.uid() and call_type='voice');
create policy chat_calls_participants_update on public.chat_calls for update to authenticated using (auth.uid()=caller_id or auth.uid()=receiver_id) with check (auth.uid()=caller_id or auth.uid()=receiver_id);

create table if not exists public.chat_call_signals (
  id bigint generated by default as identity primary key,
  call_id uuid not null references public.chat_calls(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer','answer','ice','hangup','screen-start','screen-stop','renegotiate')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_call_signals_not_self check (sender_id <> recipient_id)
);
create index if not exists chat_call_signals_call_created_idx on public.chat_call_signals(call_id, created_at);
create index if not exists chat_call_signals_recipient_created_idx on public.chat_call_signals(recipient_id, created_at);
alter table public.chat_call_signals enable row level security;
drop policy if exists chat_call_signals_participants_select on public.chat_call_signals;
drop policy if exists chat_call_signals_sender_insert on public.chat_call_signals;
drop policy if exists chat_call_signals_participants_delete on public.chat_call_signals;
create policy chat_call_signals_participants_select on public.chat_call_signals for select to authenticated using (auth.uid()=sender_id or auth.uid()=recipient_id);
create policy chat_call_signals_sender_insert on public.chat_call_signals for insert to authenticated with check (
  auth.uid()=sender_id and exists (
    select 1 from public.chat_calls c where c.id=call_id and ((c.caller_id=sender_id and c.receiver_id=recipient_id) or (c.receiver_id=sender_id and c.caller_id=recipient_id))
  )
);
create policy chat_call_signals_participants_delete on public.chat_call_signals for delete to authenticated using (auth.uid()=sender_id or auth.uid()=recipient_id);

alter table public.chat_calls replica identity full;
alter table public.chat_call_signals replica identity full;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_calls') then
    alter publication supabase_realtime add table public.chat_calls;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_call_signals') then
    alter publication supabase_realtime add table public.chat_call_signals;
  end if;
end $$;
