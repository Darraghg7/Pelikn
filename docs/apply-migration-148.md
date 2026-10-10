# Turning on "Allocate holiday pay" (migration 148)

**What this does:** adds one new table, `holiday_pay_allocations`. It stores the hours a manager pays for each day of booked holiday, chosen from the timesheet. Those hours are what the timesheet pays and what comes off the person's holiday balance.

Nothing existing is changed or deleted. Only staff signed in to your venue (and the venue owner) can see or change the rows, the same rules as time-off requests.

**Order doesn't matter.** The app works with or without this table:
- **Without it:** holiday pay is estimated automatically, as it is today. The timesheet shows a note that allocating needs a database update.
- **With it:** holiday pay is only paid once a manager allocates it.

---

## Step 0: Take a backup

GitHub → Actions → **Daily Database Backup** → **Run workflow**. Wait for the green tick before carrying on.

## Step 1: Run the SQL

1. Supabase Dashboard → your project → **SQL Editor** → **New query**.
2. Open `supabase/migrations/148_holiday_pay_allocations.sql` in GitHub, copy **all** of it, and paste it in.
3. Press **Run**.
4. The result panel should show one row: `table_ready` = **true**.

Running it a second time is harmless.

## Step 2: Check it in the app

1. Sign in as a manager. Go to **Team → Timesheets** and pick a week where someone has approved holiday.
2. A **Holiday pay** card should appear above the staff list, showing "X days not paid yet" and an **Allocate** button. If it still says "needs a database update", fully close and reopen the app.
3. Press **Allocate**. Check the suggested hours, change them if needed, then press **Allocate**.
4. The week's wage bill and the CSV/PDF export now include that holiday pay.
5. On **Time off**, that person's hours left now go down by exactly the hours you allocated.

## Good to know

- **Holiday pay is no longer automatic** once this is on. A week with booked holiday shows £0 holiday pay until it's allocated. This includes past weeks you open again, so allocate before exporting payroll.
- A week **locked for payroll** can't have holiday pay added or removed. Unlock it first.
- To fix a mistake, open **Allocate** (or **View**), press **Remove** on the day, then allocate it again.

## Undo

Paste and run `supabase/migrations/148_rollback.sql` in the SQL Editor. This **deletes every allocation** (take a backup first), and the app goes back to estimating holiday pay automatically.
