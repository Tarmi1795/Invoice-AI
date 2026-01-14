
# Supabase Setup for Self-Learning AI

Run the following SQL in your Supabase SQL Editor to enable the learning engine.

```sql
-- Create the training data table
create table if not exists training_data (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  module_id text not null,     -- 'qp_report', 'invoice_summary', etc.
  input_context text not null, -- The extracted text content from the document
  output_json jsonb not null,  -- The verified "Golden Record"
  user_id text                 -- Optional: ID of the user who verified it
);

-- Add an index for faster lookups by module
create index if not exists idx_training_data_module on training_data(module_id, created_at desc);

-- Enable Row Level Security (RLS)
alter table training_data enable row level security;

-- Policy: Allow anonymous read/write (Update this for production with actual auth)
create policy "Allow public access" on training_data for all using (true);
```

### Rate Table Updates
Run this to ensure the Rate Manager works with the ITP Parser's overwrite feature.

```sql
-- 1. Ensure rates table has ot_rate
alter table rates add column if not exists ot_rate float default 0;

-- 2. Make reference_no unique to enable UPSERT (Overwriting old rates with new ITP data)
-- NOTE: If you have duplicates currently, you must delete them before running this.
ALTER TABLE rates ADD CONSTRAINT rates_reference_no_key UNIQUE (reference_no);
```
