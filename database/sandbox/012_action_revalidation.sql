-- Synthetic sandbox only. Revalidation explicitly reopens an action and audits its changed evidence basis.
CREATE TABLE os_lab.action_revalidation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 action_id uuid NOT NULL REFERENCES os_lab.action_items(id),
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 session_id uuid NOT NULL REFERENCES os_lab.sessions(id),
 old_evidence_id uuid NOT NULL REFERENCES os_lab.evidence(id),
 old_revision bigint NOT NULL,
 new_evidence_id uuid NOT NULL REFERENCES os_lab.evidence(id),
 new_revision bigint NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

REVOKE ALL ON os_lab.action_revalidation_events FROM PUBLIC;

CREATE FUNCTION os_lab.revalidate_action(target_id uuid,target_evidence uuid,reason_text text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE a os_lab.action_items%ROWTYPE; e os_lab.evidence%ROWTYPE;
BEGIN
 IF target_id IS NULL OR target_evidence IS NULL OR reason_text IS NULL OR length(btrim(reason_text)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_action_revalidation' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM os_lab.action_items WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(a.project_id,a.org_id,true) THEN RAISE EXCEPTION 'action_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM os_lab.evidence WHERE id=target_evidence AND project_id=a.project_id AND org_id=a.org_id FOR UPDATE;
 IF NOT FOUND OR NOT e.reviewed OR e.kind='hypothesis' THEN RAISE EXCEPTION 'evidence_not_eligible' USING ERRCODE='22023'; END IF;
 IF a.evidence_id=e.id AND a.evidence_revision=e.review_revision THEN RETURN false; END IF;
 -- Reopen explicitly; a new basis is not evidence of completed work.
 UPDATE os_lab.action_items SET evidence_id=e.id,evidence_revision=e.review_revision,done=false,member_id=current_setting('os_lab.actor_id')::uuid WHERE id=a.id;
 INSERT INTO os_lab.action_revalidation_events(action_id,member_id,session_id,old_evidence_id,old_revision,new_evidence_id,new_revision,reason)
 VALUES(a.id,current_setting('os_lab.actor_id')::uuid,current_setting('os_lab.session_id')::uuid,a.evidence_id,a.evidence_revision,e.id,e.review_revision,btrim(reason_text));
 RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.revalidate_action(uuid,uuid,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.revalidate_action(uuid,uuid,text) TO os_lab_test;
