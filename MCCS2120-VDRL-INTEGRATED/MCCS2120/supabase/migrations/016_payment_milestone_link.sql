-- MCCS V2.9.7
-- Link actual payments directly to contractual payment milestones.

alter table public.payments
  add column if not exists payment_milestone_id uuid null references public.payment_milestones(id) on delete set null;

create index if not exists idx_payments_payment_milestone_id
  on public.payments(payment_milestone_id)
  where payment_milestone_id is not null;

comment on column public.payments.payment_milestone_id is
  'Optional direct link between an actual payment and the contractual payment milestone it settles.';
