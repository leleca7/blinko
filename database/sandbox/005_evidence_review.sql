-- Synthetic sandbox only. Admin review role is provisional; never enable production access here.
-- No caller may create pre-reviewed evidence; only the scoped review function changes status.
CREATE POLICY lab_evidence_unreviewed_insert ON os_lab.evidence AS RESTRICTIVE FOR INSERT WITH CHECK (NOT reviewed);

CREATE TABLE os_lab.evidence_review_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evidence_id uuid NOT NULL REFERENCES os_lab.evidence(id),
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 session_id uuid NOT NULL REFERENCES os_lab.sessions(id),
 reviewed boolean NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

REVOKE ALL ON os_lab.evidence_review_events FROM PUBLIC;

CREATE FUNCTION os_lab.review_evidence(target uuid, decision boolean, reason_text text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab
AS $fn$
DECLARE
 actor text := current_setting('os_lab.actor_id',true);
 sid text := current_setting('os_lab.session_id',true);
 item os_lab.evidence%ROWTYPE;
BEGIN
 IF decision IS NULL OR reason_text IS NULL OR length(btrim(reason_text)) NOT BETWEEN 1 AND 500 THEN
   RAISE EXCEPTION 'invalid_review' USING ERRCODE='22023';
 END IF;
 IF NOT os_lab.session_is_active(actor,sid) THEN
   RAISE EXCEPTION 'review_denied' USING ERRCODE='42501';
 END IF;
 SELECT * INTO item FROM os_lab.evidence e WHERE e.id=target FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(item.project_id,item.org_id,true)
 OR NOT EXISTS (SELECT 1 FROM os_lab.members m WHERE m.id::text=actor AND m.org_id=item.org_id AND m.role='admin' AND m.active) THEN
   RAISE EXCEPTION 'review_denied' USING ERRCODE='42501';
 END IF;
 IF item.reviewed=decision THEN RETURN false; END IF;
 UPDATE os_lab.evidence SET reviewed=decision WHERE id=target;
 INSERT INTO os_lab.evidence_review_events(evidence_id,member_id,session_id,reviewed,reason)
 VALUES(target,actor::uuid,sid::uuid,decision,btrim(reason_text));
 RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.review_evidence(uuid,boolean,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.review_evidence(uuid,boolean,text) TO os_lab_test;
