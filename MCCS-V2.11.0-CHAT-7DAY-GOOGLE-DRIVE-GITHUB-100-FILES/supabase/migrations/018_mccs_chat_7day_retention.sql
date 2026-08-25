-- MCCS V2.11.0 private chat with 7-day text retention.
-- Attachments are references to commercial_documents, whose files remain in Google Drive.
create extension if not exists pg_cron;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  attachment_document_id uuid null references public.commercial_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  constraint chat_not_self check (sender_id <> recipient_id),
  constraint chat_has_content check (length(trim(body)) > 0 or attachment_document_id is not null)
);
create index if not exists chat_sender_recipient_created_idx on public.chat_messages(sender_id, recipient_id, created_at desc);
create index if not exists chat_recipient_unread_idx on public.chat_messages(recipient_id, read_at, created_at desc);

alter table public.chat_messages enable row level security;
drop policy if exists chat_read_participants on public.chat_messages;
create policy chat_read_participants on public.chat_messages for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists chat_send_self on public.chat_messages;
create policy chat_send_self on public.chat_messages for insert to authenticated with check (auth.uid() = sender_id and recipient_id <> auth.uid());
drop policy if exists chat_mark_received_read on public.chat_messages;
create policy chat_mark_received_read on public.chat_messages for update to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Allow authenticated users to discover colleagues for chat. Existing profile security still applies to sensitive writes.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_chat_directory') then
    create policy profiles_chat_directory on public.profiles for select to authenticated using (true);
  end if;
end $$;

-- Realtime publication. Ignore duplicate membership if already published.
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

-- Nightly cleanup at 02:15 UTC. Only chat rows are deleted. Google Drive documents are NOT deleted.
select cron.unschedule(jobid) from cron.job where jobname = 'mccs-chat-7day-cleanup';
select cron.schedule(
  'mccs-chat-7day-cleanup',
  '15 2 * * *',
  $$delete from public.chat_messages where created_at < now() - interval '7 days';$$
);
