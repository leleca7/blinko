-- Synthetic sandbox only. One-time high-entropy code hashes are provisioned out of band by a trusted owner.
-- No LOGIN enabled, no real credentials. Issuer has no business-table access; runtime cannot issue sessions.
CREATE ROLE os_lab_issuer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

GRANT os_lab_issuer TO sandbox_owner;

CREATE TABLE os_lab.access_codes (
 code_hash text PRIMARY KEY CHECK(code_hash ~ '^[0-9a-f]{64}$'),
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '15 minutes'),
 CHECK(consumed_at IS NULL OR consumed_at>=created_at)
);

REVOKE ALL ON os_lab.access_codes FROM PUBLIC;

GRANT USAGE ON SCHEMA os_lab TO os_lab_issuer;

CREATE FUNCTION os_lab.redeem_access_code(digest text,new_session uuid)
RETURNS TABLE(member_id uuid,session_id uuid,issued_epoch bigint,expires_epoch bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE c os_lab.access_codes%ROWTYPE; issued timestamptz:=statement_timestamp(); expires timestamptz;
BEGIN
 IF digest IS NULL OR digest !~ '^[0-9a-f]{64}$' OR new_session IS NULL THEN RETURN; END IF;
 SELECT a.* INTO c FROM os_lab.access_codes a JOIN os_lab.members m ON m.id=a.member_id
 WHERE a.code_hash=digest AND a.consumed_at IS NULL AND a.expires_at>issued AND a.created_at<=issued AND m.active
 FOR UPDATE OF a;
 IF NOT FOUND THEN RETURN; END IF;
 expires:=issued+interval '1 hour';
 INSERT INTO os_lab.sessions(id,member_id,issued_at,expires_at) VALUES(new_session,c.member_id,issued,expires);
 UPDATE os_lab.access_codes a SET consumed_at=issued WHERE a.code_hash=digest;
 RETURN QUERY SELECT c.member_id,new_session,floor(extract(epoch FROM issued))::bigint,floor(extract(epoch FROM expires))::bigint;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.redeem_access_code(text,uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.redeem_access_code(text,uuid) TO os_lab_issuer;

CREATE FUNCTION os_lab.revoke_own_session() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE actor text:=current_setting('os_lab.actor_id',true); sid text:=current_setting('os_lab.session_id',true);
BEGIN
 IF NOT os_lab.session_is_active(actor,sid) THEN RETURN false; END IF;
 UPDATE os_lab.sessions s SET revoked_at=statement_timestamp() WHERE s.id::text=sid AND s.member_id::text=actor AND s.revoked_at IS NULL;
 RETURN FOUND;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.revoke_own_session() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.revoke_own_session() TO os_lab_test;
