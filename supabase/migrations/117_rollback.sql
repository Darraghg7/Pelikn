-- Rollback for 117.
--
-- Restores hourly_rate to the column grant, which re-opens pay to every
-- employee in the venue. Only run this alongside reverting the client, which
-- otherwise keeps calling staff_pay_rates and will fail with PGRST202.
--
-- Dropping the function is safe on its own; the GRANT is what actually
-- restores the old (exposed) behaviour.

GRANT SELECT (hourly_rate) ON staff TO anon, authenticated;
DROP FUNCTION IF EXISTS staff_pay_rates(uuid);
