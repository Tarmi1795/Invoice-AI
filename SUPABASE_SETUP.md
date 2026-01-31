
# Supabase Setup

## 1. AI Training Data (Existing)

```sql
create table if not exists training_data (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  module_id text not null,     -- 'qp_report', 'invoice_summary', etc.
  input_context text not null, -- The extracted text content from the document
  output_json jsonb not null,  -- The verified "Golden Record"
  user_id text                 -- Optional: ID of the user who verified it
);
create index if not exists idx_training_data_module on training_data(module_id, created_at desc);
alter table training_data enable row level security;
create policy "Allow public access" on training_data for all using (true);
```

## 2. Rate Manager Updates (Existing)

```sql
alter table rates add column if not exists ot_rate float default 0;
ALTER TABLE rates ADD CONSTRAINT rates_reference_no_key UNIQUE (reference_no);
```

## 3. User Profiles & Authentication (NEW)

Run this to create the user management system.

```sql
-- Create a table for public profiles (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  role text default 'user', -- 'admin', 'user'
  monthly_limit float default 5.0, -- Budget in USD
  current_usage float default 0.0, -- Current month usage
  allowed_modules text[] default '{invoice,po,timesheet,rates,cost}'::text[],
  updated_at timestamp with time zone
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone" 
  on profiles for select using ( true );

create policy "Users can update own profile" 
  on profiles for update using ( auth.uid() = id );

create policy "Admins can update everyone" 
  on profiles for update using ( 
    exists ( select 1 from profiles where id = auth.uid() and role = 'admin' )
  );

-- Function to handle new user signup automatically
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, role, allowed_modules, monthly_limit)
  values (
    new.id, 
    new.email, 
    'user', -- Default role
    '{invoice,po,timesheet,rates,cost}', -- Default modules
    5.00 -- Default $5 limit
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function on signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 4. Admin Setup

After signing up your first user in the App, go to the Supabase Table Editor > `profiles` table and manually change your user's `role` from `user` to `admin`.
