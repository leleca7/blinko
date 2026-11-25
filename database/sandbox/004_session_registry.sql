-- Dedicated synthetic sandbox only. No authentication credentials or production data.
CREATE TABLE os_lab.sessions (
 id uuid PRIMARY KEY,
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 issued_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at > issued_at AND expires_at <= issued_at + interval '1 hour'),
 CHECK(revoked_at IS NULL OR revoked_at >= issued_at)
);
REVOKE ALL ON os_lab.sessions FROM PUBLIC;
CREATE FUNCTION os_lab.session_is_active(actor text, session_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab
AS $fn$
 SELECT EXISTS (
 SELECT 1 FROM os_lab.sessions s JOIN os_lab.members m ON m.id=s.member_id
 WHERE s.id::text=session_id AND m.id::text=actor AND m.active
 AND s.revoked_at IS NULL AND s.issued_at<=statement_timestamp() AND s.expires_at>statement_timestamp()
 )
$fn$;
REVOKE ALL ON FUNCTION os_lab.session_is_active(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION os_lab.session_is_active(text,text) TO os_lab_test;
-- Enforce the registered session in every policy evaluation, not only in the API.
CREATE OR REPLACE FUNCTION os_lab.can_access_project(p uuid, o uuid, writing boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab
AS $fn$
 SELECT os_lab.session_is_active(current_setting('os_lab.actor_id',true),current_setting('os_lab.session_id',true))
 AND EXISTS (
 SELECT 1 FROM os_lab.members m
 WHERE m.id::text=current_setting('os_lab.actor_id',true) AND m.org_id=o AND m.active
 AND (NOT writing OR m.role IN ('admin','operator'))
 AND (m.role='admin' OR EXISTS (SELECT 1 FROM os_lab.project_access a WHERE a.project_id=p AND a.member_id=m.id AND a.org_id=o))
 )
$fn$;
-- Session creation/revocation is deliberately not granted to the runtime role.
