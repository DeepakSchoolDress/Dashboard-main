-- Update commission_rate constraint to allow rupee values instead of percentages
ALTER TABLE commissions DROP CONSTRAINT IF EXISTS commissions_commission_rate_check;
ALTER TABLE commissions ADD CONSTRAINT commissions_commission_rate_check CHECK (commission_rate >= 0 AND commission_rate <= 1000000); 