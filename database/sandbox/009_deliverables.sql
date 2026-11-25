-- Synthetic sandbox only. Internal preview, never public client authentication.
-- Conservative monotonic revision invalidates approvals on all project mutations.
-- Full hypothesis persistence and review, real client isolation, and concurrency testing remain pending.
ALTER TABLE os_lab.projects ADD COLUMN content_revision bigint NOT NULL DEFAULT 0 CHECK(content_revision>=0);

CREATE FUNCTION os_lab.bump_project_details_revision() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,os_lab AS $fn$
BEGIN
 IF (OLD.method_stage,OLD.owner_label,OLD.due_on,OLD.label) IS DISTINCT FROM (NEW.method_stage,NEW.owner_label,NEW.due_on,NEW.label) THEN
  NEW.content_revision := OLD.content_revision+1;
 END IF;
 RETURN NEW;
END;
$fn$;

CREATE TRIGGER lab_project_details_revision BEFORE UPDATE ON os_lab.projects FOR EACH ROW EXECUTE FUNCTION os_lab.bump_project_details_revision();

CREATE FUNCTION os_lab.touch_project_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 UPDATE os_lab.projects SET content_revision=content_revision+1 WHERE id=NEW.project_id;
 RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.touch_project_revision() FROM PUBLIC;

CREATE TRIGGER lab_evidence_project_revision AFTER INSERT OR UPDATE ON os_lab.evidence FOR EACH ROW EXECUTE FUNCTION os_lab.touch_project_revision();

CREATE TRIGGER lab_radar_scores_project_revision AFTER INSERT OR UPDATE ON os_lab.radar_scores FOR EACH ROW EXECUTE FUNCTION os_lab.touch_project_revision();

CREATE TRIGGER lab_action_items_project_revision AFTER INSERT OR UPDATE ON os_lab.action_items FOR EACH ROW EXECUTE FUNCTION os_lab.touch_project_revision();

CREATE TRIGGER lab_appointments_project_revision AFTER INSERT OR UPDATE ON os_lab.appointments FOR EACH ROW EXECUTE FUNCTION os_lab.touch_project_revision();

CREATE TRIGGER lab_ledger_entries_project_revision AFTER INSERT OR UPDATE ON os_lab.ledger_entries FOR EACH ROW EXECUTE FUNCTION os_lab.touch_project_revision();

CREATE TABLE os_lab.deliverables (
 project_id uuid PRIMARY KEY,org_id uuid NOT NULL,
 synthesis text NOT NULL CHECK(length(btrim(synthesis)) BETWEEN 1 AND 2000),
 draft_revision bigint NOT NULL DEFAULT 1 CHECK(draft_revision>0),
 review_project_revision bigint, review_draft_revision bigint, review_note text,
 reviewed_by uuid REFERENCES os_lab.members(id),reviewed_at timestamptz,
 client_summary text NOT NULL DEFAULT '',client_next_step text NOT NULL DEFAULT '',
 show_maturity boolean NOT NULL DEFAULT false,show_actions boolean NOT NULL DEFAULT false,
 portal_revision bigint NOT NULL DEFAULT 0 CHECK(portal_revision>=0),
 approved_portal_revision bigint,approved_project_revision bigint,approved_draft_revision bigint,
 approved_by uuid REFERENCES os_lab.members(id),approved_at timestamptz,
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id),
 CHECK(length(client_summary)<=1200 AND length(client_next_step)<=500),
 CHECK(review_note IS NULL OR length(btrim(review_note)) BETWEEN 1 AND 500)
);

CREATE TABLE os_lab.delivery_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES os_lab.projects(id),
 member_id uuid NOT NULL REFERENCES os_lab.members(id),session_id uuid NOT NULL REFERENCES os_lab.sessions(id),
 event_type text NOT NULL CHECK(event_type IN ('draft_saved','reviewed','review_revoked','portal_saved','portal_approved','portal_revoked')),
 project_revision bigint NOT NULL,draft_revision bigint NOT NULL,portal_revision bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

REVOKE ALL ON os_lab.deliverables,os_lab.delivery_events FROM PUBLIC;

ALTER TABLE os_lab.deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_deliverables_read ON os_lab.deliverables FOR SELECT USING(os_lab.can_access_project(project_id,org_id,false));

GRANT SELECT ON os_lab.deliverables TO os_lab_test;

CREATE FUNCTION os_lab.delivery_ready(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 SELECT EXISTS(SELECT 1 FROM os_lab.evidence WHERE project_id=p AND reviewed AND kind<>'hypothesis')
 AND NOT EXISTS(SELECT 1 FROM os_lab.evidence WHERE project_id=p AND NOT reviewed)
 AND (SELECT count(*) FROM os_lab.radar_scores s JOIN os_lab.evidence e ON e.id=s.evidence_id WHERE s.project_id=p AND e.project_id=p AND e.pillar=s.pillar AND e.reviewed AND e.kind<>'hypothesis' AND e.review_revision=s.evidence_revision)=10
 AND EXISTS(SELECT 1 FROM os_lab.action_items WHERE project_id=p)
 AND NOT EXISTS(SELECT 1 FROM os_lab.action_items a JOIN os_lab.evidence e ON e.id=a.evidence_id WHERE a.project_id=p AND (NOT e.reviewed OR e.kind='hypothesis' OR e.review_revision<>a.evidence_revision OR e.project_id<>p))
$fn$;

REVOKE ALL ON FUNCTION os_lab.delivery_ready(uuid) FROM PUBLIC;

CREATE FUNCTION os_lab.delivery_event(target uuid,kind text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 INSERT INTO os_lab.delivery_events(project_id,member_id,session_id,event_type,project_revision,draft_revision,portal_revision)
 SELECT p.id,current_setting('os_lab.actor_id')::uuid,current_setting('os_lab.session_id')::uuid,kind,p.content_revision,d.draft_revision,d.portal_revision FROM os_lab.projects p JOIN os_lab.deliverables d ON d.project_id=p.id WHERE p.id=target
$fn$;

REVOKE ALL ON FUNCTION os_lab.delivery_event(uuid,text) FROM PUBLIC;

CREATE FUNCTION os_lab.save_report(target uuid,body text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE; changed boolean;
BEGIN
 IF body IS NULL OR length(btrim(body)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'invalid_report' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(p.id,p.org_id,true) THEN RAISE EXCEPTION 'delivery_denied' USING ERRCODE='42501'; END IF;
 INSERT INTO os_lab.deliverables(project_id,org_id,synthesis) VALUES(p.id,p.org_id,btrim(body))
 ON CONFLICT(project_id) DO UPDATE SET synthesis=EXCLUDED.synthesis,draft_revision=os_lab.deliverables.draft_revision+1,
 review_project_revision=NULL,review_draft_revision=NULL,review_note=NULL,reviewed_by=NULL,reviewed_at=NULL,
 approved_portal_revision=NULL,approved_project_revision=NULL,approved_draft_revision=NULL,approved_by=NULL,approved_at=NULL
 WHERE os_lab.deliverables.synthesis IS DISTINCT FROM EXCLUDED.synthesis;
 changed:=FOUND; IF changed THEN PERFORM os_lab.delivery_event(target,'draft_saved'); END IF; RETURN changed;
END;
$fn$;

CREATE FUNCTION os_lab.review_report(target uuid,decision boolean,note text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE; d os_lab.deliverables%ROWTYPE;
BEGIN
 IF decision IS NULL OR note IS NULL OR length(btrim(note)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_review' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_finance(p.id,p.org_id) THEN RAISE EXCEPTION 'delivery_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM os_lab.deliverables WHERE project_id=target;
 IF NOT FOUND THEN RAISE EXCEPTION 'report_missing' USING ERRCODE='22023'; END IF;
 IF decision AND NOT os_lab.delivery_ready(target) THEN RAISE EXCEPTION 'report_not_ready' USING ERRCODE='22023'; END IF;
 IF NOT decision AND d.reviewed_at IS NULL THEN RETURN false; END IF;
 UPDATE os_lab.deliverables SET review_project_revision=CASE WHEN decision THEN p.content_revision END,
 review_draft_revision=CASE WHEN decision THEN d.draft_revision END,review_note=btrim(note),
 reviewed_by=CASE WHEN decision THEN current_setting('os_lab.actor_id')::uuid END,
 reviewed_at=CASE WHEN decision THEN statement_timestamp() END,
 approved_portal_revision=NULL,approved_project_revision=NULL,approved_draft_revision=NULL,approved_by=NULL,approved_at=NULL
 WHERE project_id=target;
 PERFORM os_lab.delivery_event(target,CASE WHEN decision THEN 'reviewed' ELSE 'review_revoked' END);
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.save_portal_draft(target uuid,summary text,next_step text,include_maturity boolean,include_actions boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE; changed boolean;
BEGIN
 IF summary IS NULL OR length(btrim(summary)) NOT BETWEEN 1 AND 1200 OR next_step IS NULL OR length(btrim(next_step)) NOT BETWEEN 1 AND 500 OR include_maturity IS NULL OR include_actions IS NULL THEN RAISE EXCEPTION 'invalid_portal' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(p.id,p.org_id,true) THEN RAISE EXCEPTION 'delivery_denied' USING ERRCODE='42501'; END IF;
 UPDATE os_lab.deliverables SET client_summary=btrim(summary),client_next_step=btrim(next_step),show_maturity=include_maturity,show_actions=include_actions,portal_revision=portal_revision+1,
 approved_portal_revision=NULL,approved_project_revision=NULL,approved_draft_revision=NULL,approved_by=NULL,approved_at=NULL
 WHERE project_id=target AND (client_summary,client_next_step,show_maturity,show_actions) IS DISTINCT FROM (btrim(summary),btrim(next_step),include_maturity,include_actions);
 changed:=FOUND; IF changed THEN PERFORM os_lab.delivery_event(target,'portal_saved'); END IF; RETURN changed;
END;
$fn$;

CREATE FUNCTION os_lab.approve_portal(target uuid,decision boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE; d os_lab.deliverables%ROWTYPE;
BEGIN
 IF decision IS NULL THEN RAISE EXCEPTION 'invalid_portal' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_finance(p.id,p.org_id) THEN RAISE EXCEPTION 'delivery_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM os_lab.deliverables WHERE project_id=target;
 IF NOT FOUND THEN RAISE EXCEPTION 'report_missing' USING ERRCODE='22023'; END IF;
 IF decision AND (d.reviewed_at IS NULL OR d.review_project_revision IS DISTINCT FROM p.content_revision OR d.review_draft_revision IS DISTINCT FROM d.draft_revision OR NOT os_lab.delivery_ready(target) OR length(btrim(d.client_summary))=0 OR length(btrim(d.client_next_step))=0) THEN RAISE EXCEPTION 'portal_not_ready' USING ERRCODE='22023'; END IF;
 IF NOT decision AND d.approved_at IS NULL THEN RETURN false; END IF;
 UPDATE os_lab.deliverables SET approved_portal_revision=CASE WHEN decision THEN d.portal_revision END,approved_project_revision=CASE WHEN decision THEN p.content_revision END,
 approved_draft_revision=CASE WHEN decision THEN d.draft_revision END,approved_by=CASE WHEN decision THEN current_setting('os_lab.actor_id')::uuid END,
 approved_at=CASE WHEN decision THEN statement_timestamp() END WHERE project_id=target;
 PERFORM os_lab.delivery_event(target,CASE WHEN decision THEN 'portal_approved' ELSE 'portal_revoked' END); RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.internal_portal_preview(target uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 SELECT jsonb_build_object('projectId',p.id,'company',p.label,'stage',p.method_stage,'due',p.due_on,
 'summary',d.client_summary,'nextStep',d.client_next_step,
 'maturity',CASE WHEN d.show_maturity THEN (SELECT jsonb_build_object('value',round(avg(s.value)*25),'coverage',count(*)) FROM os_lab.radar_scores s WHERE s.project_id=p.id) ELSE NULL END,
 'actions',CASE WHEN d.show_actions THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('title',a.title,'due',a.due_on,'done',a.done) ORDER BY a.due_on,a.id),'[]'::jsonb) FROM os_lab.action_items a WHERE a.project_id=p.id) ELSE '[]'::jsonb END)
 FROM os_lab.projects p JOIN os_lab.deliverables d ON d.project_id=p.id
 WHERE p.id=target AND os_lab.can_access_project(p.id,p.org_id,false)
 AND d.reviewed_at IS NOT NULL AND d.approved_at IS NOT NULL
 AND d.review_project_revision=p.content_revision AND d.review_draft_revision=d.draft_revision
 AND d.approved_project_revision=p.content_revision AND d.approved_draft_revision=d.draft_revision AND d.approved_portal_revision=d.portal_revision
 AND os_lab.delivery_ready(p.id)
$fn$;

REVOKE ALL ON FUNCTION os_lab.save_report(uuid,text),os_lab.review_report(uuid,boolean,text),os_lab.save_portal_draft(uuid,text,text,boolean,boolean),os_lab.approve_portal(uuid,boolean),os_lab.internal_portal_preview(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.save_report(uuid,text),os_lab.review_report(uuid,boolean,text),os_lab.save_portal_draft(uuid,text,text,boolean,boolean),os_lab.approve_portal(uuid,boolean),os_lab.internal_portal_preview(uuid) TO os_lab_test;
