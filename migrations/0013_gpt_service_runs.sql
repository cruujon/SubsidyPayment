create table if not exists gpt_service_runs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  service text not null,
  sponsor text,
  subsidy_cents bigint not null default 0,
  payment_mode text not null check (payment_mode in ('sponsored', 'user_direct')),
  tx_hash text,
  created_at timestamptz not null default now()
);

create index if not exists gpt_service_runs_user_id_created_idx
  on gpt_service_runs(user_id, created_at desc);

create index if not exists gpt_service_runs_campaign_id_idx
  on gpt_service_runs(campaign_id);

