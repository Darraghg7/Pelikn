# Turning on holiday booked in hours (migration 148)

**What this does:** adds two columns to existing tables. Nothing is deleted or moved.
- `time_off_requests.hours`: the holiday hours a booking uses and pays.
- `leave_entitlements.carry_over_hours`: unused hours carried into a holiday year.

**How holiday works once it's on:**
1. **Staff book holiday in hours.** The app fills in their average shift × working days, and they can change it. Their "hours left" drops straight away and shows "awaiting approval".
2. **The manager approves it, and that's the "yes, pay them".** The hours are shown on the request and can be changed before approving.
3. **The timesheet pays it automatically** in the week(s) the holiday falls in. It shows under **Holiday pay** and is included in the wage bill and the CSV/PDF exports.
4. **Holiday pay for a week someone isn't working:** Time off → Team annual leave → **+** next to them → pick the week, enter the hours → **Add leave**. It's approved and paid in one go.
5. **Carry-over:** the **Carry over** button next to someone sets the unused hours brought into this holiday year.

**Order doesn't matter.** Until this is run, the app works as it does now: no hours boxes, and holiday is estimated from days × usual hours.

---

## Step 0: Take a backup

GitHub → Actions → **Daily Database Backup** → **Run workflow**. Wait for the green tick.

## Step 1: Run the SQL

1. Supabase Dashboard → your project → **SQL Editor** → **New query**.
2. Open `supabase/migrations/148_holiday_hours.sql` in GitHub, copy **all** of it, and paste it in.
3. Press **Run**.
4. The result should show one row, with `hours_ready` and `carry_over_ready` both **true**.

Running it a second time is harmless.

## Step 2: Check it in the app

Fully close and reopen the app first so it picks up the change.

1. As a staff member, open **Time off → Request**, pick annual leave and dates. A **Holiday hours** box appears, already filled in. Submit, and your "hours left" drops, showing "awaiting approval".
2. As a manager, the request shows **Holiday hours to pay** and an **Approve · pay X h** button. Approve it.
3. **Team → Timesheets**, the week of that holiday: the **Holiday pay** card lists them with the hours and £, and the wage bill includes it.
4. **Time off → Team annual leave → Carry over** next to someone: enter hours, save, and their hours left go up.

## Good to know

- Holiday booked **before** this change has no hours stored. It's still paid and counted as before: working days × their average shift (or contracted hours per day).
- To change the hours on an approved booking, open it (from the calendar or the request list) and edit **Holiday hours**.
- A rejected or withdrawn request gives its hours straight back.

## Undo

Paste and run `supabase/migrations/148_rollback.sql` in the SQL Editor. It removes both columns, **deleting the hours on every booking and all carry-overs** (take a backup first), and the app goes back to estimating holiday from days.
