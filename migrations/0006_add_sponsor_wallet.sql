-- Add sponsor_wallet_address column to campaigns table
alter table campaigns
  add column if not exists sponsor_wallet_address text;

-- Create index for faster filtering
create index if not exists campaigns_sponsor_wallet_idx
  on campaigns(sponsor_wallet_address);

