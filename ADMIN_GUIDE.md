
# 🛡️ Admin Access & Role Management Guide

This guide explains how to set up the first Administrator account and how to use the Admin Panel to manage other users.

## 1. How to Create the First Admin

By default, every new user who signs up is assigned the **`user`** role. Since there is no "Super Admin" created by the system automatically, you must manually promote your account to **`admin`** using the Supabase Dashboard.

### Step-by-Step:

1.  **Sign Up in the App:**
    *   Open your running application (e.g., `http://localhost:5173`).
    *   Click **"Sign Up"** on the login screen.
    *   Create an account with your email and password.

2.  **Access Supabase Dashboard:**
    *   Go to your [Supabase Project Dashboard](https://supabase.com/dashboard).
    *   Select your project.

3.  **Update the User Role:**
    *   Go to the **Table Editor** (icon on the left sidebar that looks like a table).
    *   Select the **`profiles`** table (this table is created by the SQL setup provided in `SUPABASE_SETUP.md`).
    *   Find the row corresponding to your email address.
    *   Double-click the **`role`** column for that row.
    *   Change the value from `user` to **`admin`**.
    *   Click **Save** (or press Enter/click away to persist the change).

4.  **Access the Admin Panel:**
    *   Go back to your application.
    *   **Refresh the page** (or Sign Out and Sign In again) to reload your profile permissions.
    *   You will now see a purple **Admin Panel** button at the bottom of the Sidebar.

---

## 2. Using the Admin Panel

Once you have access, click the **Admin Panel** link in the sidebar.

### Features:

*   **Change Roles:** You can promote other users to `admin` or demote them back to `user` directly from the UI.
*   **Manage Budgets:**
    *   **Monthly Limit ($):** Set a hard cap on how much a user can spend on AI credits per month.
    *   **Usage:** View their current spending (calculated based on Token input/output).
*   **Module Access Control:**
    *   Toggle specific modules on or off for individual users.
    *   *Example:* You can give a junior engineer access to "ITP Parser" but restrict them from "Cost Tracker" or "Reconciliation".

---

## 3. SQL Reference (Troubleshooting)

If you cannot see the `profiles` table or the Admin Panel does not appear, ensure you have run the setup SQL found in `SUPABASE_SETUP.md`.

Specifically, check that the Row Level Security (RLS) policies allow admins to update profiles:

```sql
-- Ensure this policy exists in your Supabase SQL Editor
create policy "Admins can update everyone" 
  on profiles for update using ( 
    exists ( select 1 from profiles where id = auth.uid() and role = 'admin' )
  );
```
