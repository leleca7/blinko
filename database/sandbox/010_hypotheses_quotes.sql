-- Synthetic sandbox only. Provisional quote permission: organization administrator; estimates are not approved offers.
-- Hypothesis decisions are human judgments, not proven causality. Open hypotheses remain disclosed.
CREATE TABLE os_lab.hypotheses (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, org_id uuid NOT NULL,
 pillar smallint NOT NULL CHECK(pillar BETWEEN 0 AND 9),
 cause text NOT NULL CHECK(length(btrim(cause)) BETWEEN 1 AND 500),
 effect text NOT NULL CHECK(length(btrim(effect)) BETWEEN 1 AND 500),
 support_id uuid REFERENCES os_lab.evidence(id), support_revision bigint,
 challenge_id uuid REFERENCES os_lab.evidence(id), challenge_revision bigint,
 decision text NOT NULL CHECK(decision IN ('open','supported','rejected')),
 rationale text NOT NULL DEFAULT '' CHECK(length(rationale)<=500),
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id),
 CHECK(support_id IS NULL OR challenge_id IS NULL OR support_id<>challenge_id),
 CHECK((support_id IS NULL)=(support_revision IS NULL)),
 CHECK((challenge_id IS NULL)=(challenge_revision IS NULL)),
 CHECK(decision='open' OR (length(btrim(rationale))>0 AND (decision='supported' AND support_id IS NOT NULL OR decision='rejected' AND challenge_id IS NOT NULL)))
);

REVOKE ALL ON os_lab.hypotheses FROM PUBLIC;

ALTER TABLE os_lab.hypotheses ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_hypotheses_read ON os_lab.hypotheses FOR SELECT USING(os_lab.can_access_project(project_id,org_id,false));

GRANT SELECT ON os_lab.hypotheses TO os_lab_test;

CREATE TRIGGER lab_hypotheses_project_revision AFTER INSERT OR UPDATE ON os_lab.hypotheses FOR EACH ROW EXECUTE FUNCTION os_lab.touch_project_revision();

CREATE FUNCTION os_lab.save_hypothesis(target_id uuid,target_project uuid,target_pillar integer,cause_text text,effect_text text,support uuid,challenge uuid,decision_text text,rationale_text text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE; s bigint; c bigint;
BEGIN
 IF target_id IS NULL OR target_pillar IS NULL OR target_pillar NOT BETWEEN 0 AND 9 OR cause_text IS NULL OR length(btrim(cause_text)) NOT BETWEEN 1 AND 500 OR effect_text IS NULL OR length(btrim(effect_text)) NOT BETWEEN 1 AND 500
 OR decision_text IS NULL OR decision_text NOT IN ('open','supported','rejected') OR rationale_text IS NULL OR length(btrim(rationale_text))>500
 OR (support IS NOT NULL AND support=challenge) OR (decision_text<>'open' AND length(btrim(rationale_text))=0)
 OR (decision_text='supported' AND support IS NULL) OR (decision_text='rejected' AND challenge IS NULL)
 THEN RAISE EXCEPTION 'invalid_hypothesis' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target_project;
 IF NOT FOUND OR NOT os_lab.can_access_project(p.id,p.org_id,true) THEN RAISE EXCEPTION 'hypothesis_denied' USING ERRCODE='42501'; END IF;
 IF support IS NOT NULL THEN
 SELECT e.review_revision INTO s FROM os_lab.evidence e WHERE e.id=support AND e.project_id=p.id AND e.reviewed AND e.kind<>'hypothesis' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ineligible_support' USING ERRCODE='22023'; END IF;
 END IF;
 IF challenge IS NOT NULL THEN
 SELECT e.review_revision INTO c FROM os_lab.evidence e WHERE e.id=challenge AND e.project_id=p.id AND e.reviewed AND e.kind<>'hypothesis' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ineligible_challenge' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO os_lab.hypotheses(id,project_id,org_id,pillar,cause,effect,support_id,support_revision,challenge_id,challenge_revision,decision,rationale,member_id)
 VALUES(target_id,p.id,p.org_id,target_pillar,btrim(cause_text),btrim(effect_text),support,s,challenge,c,decision_text,btrim(rationale_text),current_setting('os_lab.actor_id')::uuid)
 ON CONFLICT(id) DO UPDATE SET pillar=EXCLUDED.pillar,cause=EXCLUDED.cause,effect=EXCLUDED.effect,support_id=EXCLUDED.support_id,support_revision=EXCLUDED.support_revision,challenge_id=EXCLUDED.challenge_id,challenge_revision=EXCLUDED.challenge_revision,decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,member_id=EXCLUDED.member_id,updated_at=statement_timestamp()
 WHERE os_lab.hypotheses.project_id=p.id AND os_lab.hypotheses.org_id=p.org_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'hypothesis_conflict' USING ERRCODE='23505'; END IF;
 RETURN true;
END;
$fn$;

CREATE OR REPLACE FUNCTION os_lab.delivery_ready(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 SELECT EXISTS(SELECT 1 FROM os_lab.evidence WHERE project_id=p AND reviewed AND kind<>'hypothesis')
 AND NOT EXISTS(SELECT 1 FROM os_lab.evidence WHERE project_id=p AND NOT reviewed)
 AND (SELECT count(*) FROM os_lab.radar_scores s JOIN os_lab.evidence e ON e.id=s.evidence_id WHERE s.project_id=p AND e.project_id=p AND e.pillar=s.pillar AND e.reviewed AND e.kind<>'hypothesis' AND e.review_revision=s.evidence_revision)=10
 AND EXISTS(SELECT 1 FROM os_lab.action_items WHERE project_id=p)
 AND NOT EXISTS(SELECT 1 FROM os_lab.action_items a JOIN os_lab.evidence e ON e.id=a.evidence_id WHERE a.project_id=p AND (NOT e.reviewed OR e.kind='hypothesis' OR e.review_revision<>a.evidence_revision OR e.project_id<>p))
 AND NOT EXISTS(SELECT 1 FROM os_lab.hypotheses h LEFT JOIN os_lab.evidence s ON s.id=h.support_id LEFT JOIN os_lab.evidence c ON c.id=h.challenge_id WHERE h.project_id=p AND (
 (h.support_id IS NOT NULL AND (s.reviewed IS DISTINCT FROM true OR s.kind='hypothesis' OR s.review_revision IS DISTINCT FROM h.support_revision OR s.project_id IS DISTINCT FROM p))
 OR (h.challenge_id IS NOT NULL AND (c.reviewed IS DISTINCT FROM true OR c.kind='hypothesis' OR c.review_revision IS DISTINCT FROM h.challenge_revision OR c.project_id IS DISTINCT FROM p))))
$fn$;

CREATE TABLE os_lab.quote_estimates (
 id uuid PRIMARY KEY, lead_id uuid NOT NULL, org_id uuid NOT NULL,
 minutes integer NOT NULL CHECK(minutes BETWEEN 1 AND 600000),
 hourly_cents integer NOT NULL CHECK(hourly_cents BETWEEN 0 AND 10000000),
 expense_cents bigint NOT NULL CHECK(expense_cents BETWEEN 0 AND 10000000000),
 fee_bps integer NOT NULL CHECK(fee_bps BETWEEN 0 AND 9999),
 margin_bps integer NOT NULL CHECK(margin_bps BETWEEN 0 AND 9999),
 cost_cents bigint GENERATED ALWAYS AS (ceil(minutes::numeric*hourly_cents/60)::bigint+expense_cents) STORED,
 price_cents bigint GENERATED ALWAYS AS (ceil((ceil(minutes::numeric*hourly_cents/60)+expense_cents)*10000/NULLIF(10000-fee_bps-margin_bps,0))::bigint) STORED,
 member_id uuid NOT NULL REFERENCES os_lab.members(id),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 FOREIGN KEY(lead_id,org_id) REFERENCES os_lab.leads(id,org_id),
 CHECK(fee_bps+margin_bps<10000), CHECK(hourly_cents>0 OR expense_cents>0)
);

CREATE FUNCTION os_lab.can_access_quote(o uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 SELECT os_lab.session_is_active(current_setting('os_lab.actor_id',true),current_setting('os_lab.session_id',true))
 AND EXISTS(SELECT 1 FROM os_lab.members m WHERE m.id::text=current_setting('os_lab.actor_id',true) AND m.org_id=o AND m.active AND m.role='admin')
$fn$;

REVOKE ALL ON FUNCTION os_lab.can_access_quote(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.can_access_quote(uuid) TO os_lab_test;

REVOKE ALL ON os_lab.quote_estimates FROM PUBLIC;

ALTER TABLE os_lab.quote_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_quote_read ON os_lab.quote_estimates FOR SELECT USING(os_lab.can_access_quote(org_id));

GRANT SELECT ON os_lab.quote_estimates TO os_lab_test;

CREATE FUNCTION os_lab.create_quote(target_id uuid,target_lead uuid,work_minutes integer,rate_cents integer,expenses bigint,fees integer,margin integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE l os_lab.leads%ROWTYPE; q os_lab.quote_estimates%ROWTYPE;
BEGIN
 IF target_id IS NULL OR work_minutes IS NULL OR work_minutes NOT BETWEEN 1 AND 600000 OR rate_cents IS NULL OR rate_cents NOT BETWEEN 0 AND 10000000 OR expenses IS NULL OR expenses NOT BETWEEN 0 AND 10000000000 OR (rate_cents=0 AND expenses=0) OR fees IS NULL OR margin IS NULL OR fees NOT BETWEEN 0 AND 9999 OR margin NOT BETWEEN 0 AND 9999 OR fees+margin>=10000 THEN
 RAISE EXCEPTION 'invalid_quote' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM os_lab.leads WHERE id=target_lead;
 IF NOT FOUND OR NOT os_lab.can_access_quote(l.org_id) THEN RAISE EXCEPTION 'quote_denied' USING ERRCODE='42501'; END IF;
 INSERT INTO os_lab.quote_estimates(id,lead_id,org_id,minutes,hourly_cents,expense_cents,fee_bps,margin_bps,member_id)
 VALUES(target_id,l.id,l.org_id,work_minutes,rate_cents,expenses,fees,margin,current_setting('os_lab.actor_id')::uuid)
 ON CONFLICT(id) DO NOTHING RETURNING * INTO q;
 IF FOUND THEN RETURN q.id; END IF;
 SELECT * INTO q FROM os_lab.quote_estimates WHERE id=target_id AND lead_id=l.id AND org_id=l.org_id;
 IF NOT FOUND OR (q.minutes,q.hourly_cents,q.expense_cents,q.fee_bps,q.margin_bps) IS DISTINCT FROM (work_minutes,rate_cents,expenses,fees,margin) THEN RAISE EXCEPTION 'quote_conflict' USING ERRCODE='23505'; END IF;
 RETURN q.id;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.save_hypothesis(uuid,uuid,integer,text,text,uuid,uuid,text,text),os_lab.create_quote(uuid,uuid,integer,integer,bigint,integer,integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.save_hypothesis(uuid,uuid,integer,text,text,uuid,uuid,text,text),os_lab.create_quote(uuid,uuid,integer,integer,bigint,integer,integer) TO os_lab_test;
