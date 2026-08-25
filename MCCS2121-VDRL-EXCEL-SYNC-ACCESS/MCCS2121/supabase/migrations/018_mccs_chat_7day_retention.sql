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
