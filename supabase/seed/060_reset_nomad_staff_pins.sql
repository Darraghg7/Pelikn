-- ============================================================================
-- 060: Reset PINs for Aoife and Helen at Nomad Bakes to '1234'
--
-- Also clears any lockout so they can log in immediately.
-- ============================================================================

UPDATE staff
   SET pin_hash           = crypt('1234', gen_salt('bf')),
       pin_failed_attempts = 0,
       pin_locked_until    = NULL
 WHERE name IN ('Aoife', 'Helen')
   AND venue_id = (
         SELECT id FROM venues WHERE slug = 'nomad-bakes' LIMIT 1
       );
