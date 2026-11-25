BEGIN;
INSERT INTO os_lab.access_codes(code_hash,member_id,created_at,expires_at) VALUES
(repeat('a',64),'00000000-0000-4000-8000-000000000011',now()-interval '1 minute',now()+interval '10 minutes'),
(repeat('b',64),'00000000-0000-4000-8000-000000000011',now()-interval '10 minutes',now()-interval '1 minute'),
(repeat('c',64),'00000000-0000-4000-8000-000000000014',now()-interval '1 minute',now()+interval '10 minutes');
SET LOCAL ROLE os_lab_issuer;
DO $test$
DECLARE row_data record;
BEGIN
 SELECT * INTO row_data FROM os_lab.redeem_access_code(repeat('a',64),'40000000-0000-4000-8000-000000000001');
 IF NOT FOUND OR row_data.member_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000011'::uuid OR row_data.expires_epoch-row_data.issued_epoch<>3600 THEN RAISE EXCEPTION 'issuance failed'; END IF;
 IF EXISTS(SELECT 1 FROM os_lab.redeem_access_code(repeat('a',64),gen_random_uuid())) THEN RAISE EXCEPTION 'reused code'; END IF;
 IF EXISTS(SELECT 1 FROM os_lab.redeem_access_code(repeat('b',64),gen_random_uuid())) THEN RAISE EXCEPTION 'expired code'; END IF;
 IF EXISTS(SELECT 1 FROM os_lab.redeem_access_code(repeat('c',64),gen_random_uuid())) THEN RAISE EXCEPTION 'inactive member'; END IF;
 IF EXISTS(SELECT 1 FROM os_lab.redeem_access_code(repeat('d',64),gen_random_uuid())) THEN RAISE EXCEPTION 'unknown code'; END IF;
 BEGIN
  PERFORM 1 FROM os_lab.projects;
  RAISE EXCEPTION 'issuer can read projects';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM 1 FROM os_lab.access_codes;
  RAISE EXCEPTION 'issuer can read code hashes';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RAISE NOTICE 'PASS one-time issuance, expiry, replay and issuer isolation';
END
$test$;
RESET ROLE;
SET LOCAL ROLE os_lab_runtime;
DO $test$
BEGIN
 PERFORM set_config('os_lab.actor_id','00000000-0000-4000-8000-000000000011',true);
 PERFORM set_config('os_lab.session_id','40000000-0000-4000-8000-000000000001',true);
 IF NOT os_lab.session_is_active(current_setting('os_lab.actor_id'),current_setting('os_lab.session_id')) THEN RAISE EXCEPTION 'issued session not active'; END IF;
 BEGIN
  PERFORM os_lab.redeem_access_code(repeat('d',64),gen_random_uuid());
  RAISE EXCEPTION 'runtime may issue session';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('os_lab.actor_id','00000000-0000-4000-8000-000000000015',true);
 IF os_lab.revoke_own_session() THEN RAISE EXCEPTION 'wrong actor revoked session'; END IF;
 PERFORM set_config('os_lab.actor_id','00000000-0000-4000-8000-000000000011',true);
 IF NOT os_lab.revoke_own_session() THEN RAISE EXCEPTION 'revocation failed'; END IF;
 IF os_lab.session_is_active(current_setting('os_lab.actor_id'),current_setting('os_lab.session_id')) OR EXISTS(SELECT 1 FROM os_lab.projects) THEN RAISE EXCEPTION 'revoked session still has access'; END IF;
 IF os_lab.revoke_own_session() THEN RAISE EXCEPTION 'repeat revocation changed'; END IF;
 RAISE NOTICE 'PASS runtime separation, own-session logout and immediate revocation';
END
$test$;
RESET ROLE;
ROLLBACK;
