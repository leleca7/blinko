-- Dedicated synthetic sandbox only. Existing fixtures remain untouched. No public intake or real contracts.
-- Provisional rule: only assigned operator or organization admin may access lead.
ALTER TABLE os_lab.leads ADD COLUMN intake_complete boolean NOT NULL DEFAULT false, ADD COLUMN challenge text CHECK(challenge IS NULL OR length(btrim(challenge)) BETWEEN 1 AND 500), ADD COLUMN assigned_member uuid, ADD CONSTRAINT lab_lead_member_org FOREIGN KEY(assigned_member,org_id) REFERENCES os_lab.members(id,org_id);

ALTER TABLE os_lab.projects ADD COLUMN method_stage text NOT NULL DEFAULT 'Escutar' CHECK(method_stage IN ('Escutar','Investigar','Priorizar','Estruturar','Acompanhar')), ADD COLUMN owner_label text NOT NULL DEFAULT 'A definir' CHECK(owner_label IN ('A definir','Atendimento','Pesquisa','Produção','Equipe')), ADD COLUMN due_on date;

CREATE FUNCTION os_lab.can_access_lead(o uuid,assigned uuid,writing boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 SELECT os_lab.session_is_active(current_setting('os_lab.actor_id',true),current_setting('os_lab.session_id',true))
 AND EXISTS(SELECT 1 FROM os_lab.members m WHERE m.id::text=current_setting('os_lab.actor_id',true)
 AND m.active AND m.org_id=o AND (NOT writing OR m.role IN ('admin','operator'))
 AND (m.role='admin' OR m.id=assigned))
$fn$;

REVOKE ALL ON FUNCTION os_lab.can_access_lead(uuid,uuid,boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.can_access_lead(uuid,uuid,boolean) TO os_lab_test;

ALTER TABLE os_lab.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_leads_read ON os_lab.leads FOR SELECT USING(os_lab.can_access_lead(org_id,assigned_member,false));

GRANT SELECT ON os_lab.leads TO os_lab_test;

CREATE TABLE os_lab.lead_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL REFERENCES os_lab.leads(id),
 member_id uuid NOT NULL REFERENCES os_lab.members(id),session_id uuid NOT NULL REFERENCES os_lab.sessions(id),
 event_type text NOT NULL CHECK(event_type IN ('created','completed','stage_changed','contracted')),
 previous_stage text,new_stage text,created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

REVOKE ALL ON os_lab.lead_events FROM PUBLIC;

CREATE FUNCTION os_lab.create_synthetic_lead(target_id uuid,submission uuid,company text,consent boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE m os_lab.members%ROWTYPE; l os_lab.leads%ROWTYPE;
BEGIN
 IF target_id IS NULL OR submission IS NULL OR consent IS DISTINCT FROM true OR company IS NULL OR length(btrim(company)) NOT BETWEEN 1 AND 120 OR btrim(company) NOT LIKE 'Empresa fictícia %' THEN
 RAISE EXCEPTION 'invalid_synthetic_lead' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM os_lab.members WHERE id::text=current_setting('os_lab.actor_id',true);
 IF NOT FOUND OR NOT os_lab.can_access_lead(m.org_id,m.id,true) THEN RAISE EXCEPTION 'lead_denied' USING ERRCODE='42501'; END IF;
 INSERT INTO os_lab.leads(id,org_id,submission_id,display_name,consent_version,consent_at,assigned_member)
 VALUES(target_id,m.org_id,submission,btrim(company),'lab-only',statement_timestamp(),m.id)
 ON CONFLICT(submission_id) DO NOTHING RETURNING * INTO l;
 IF FOUND THEN
 INSERT INTO os_lab.lead_events(lead_id,member_id,session_id,event_type,new_stage)
 VALUES(l.id,m.id,current_setting('os_lab.session_id')::uuid,'created','triagem');
 RETURN l.id;
 END IF;
 SELECT * INTO l FROM os_lab.leads WHERE submission_id=submission;
 IF NOT FOUND OR NOT os_lab.can_access_lead(l.org_id,l.assigned_member,true) OR l.display_name<>btrim(company) THEN
 RAISE EXCEPTION 'lead_conflict' USING ERRCODE='23505'; END IF;
 RETURN l.id;
END;
$fn$;

CREATE FUNCTION os_lab.complete_synthetic_lead(target_id uuid,challenge_text text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE l os_lab.leads%ROWTYPE;
BEGIN
 IF challenge_text IS NULL OR length(btrim(challenge_text)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'invalid_challenge' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM os_lab.leads WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_lead(l.org_id,l.assigned_member,true) THEN RAISE EXCEPTION 'lead_denied' USING ERRCODE='42501'; END IF;
 IF l.intake_complete THEN
 IF l.challenge=btrim(challenge_text) THEN RETURN false; END IF;
 RAISE EXCEPTION 'lead_conflict' USING ERRCODE='23505';
 END IF;
 UPDATE os_lab.leads SET intake_complete=true,challenge=btrim(challenge_text) WHERE id=target_id;
 INSERT INTO os_lab.lead_events(lead_id,member_id,session_id,event_type)
 VALUES(l.id,current_setting('os_lab.actor_id')::uuid,current_setting('os_lab.session_id')::uuid,'completed');
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.move_lead(target_id uuid,expected_stage text,next_stage text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE l os_lab.leads%ROWTYPE; stages text[]:=ARRAY['triagem','contato','reuniao','proposta','diagnostico'];
BEGIN
 IF expected_stage IS NULL OR next_stage IS NULL OR NOT(expected_stage=ANY(stages)) OR NOT(next_stage=ANY(stages)) THEN RAISE EXCEPTION 'invalid_stage' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM os_lab.leads WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_lead(l.org_id,l.assigned_member,true) THEN RAISE EXCEPTION 'lead_denied' USING ERRCODE='42501'; END IF;
 IF l.stage<>expected_stage THEN RAISE EXCEPTION 'stage_conflict' USING ERRCODE='23505'; END IF;
 IF l.stage=next_stage THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM os_lab.projects p WHERE p.lead_id=l.id) OR array_position(stages,next_stage)<>array_position(stages,l.stage)+1
 OR (next_stage='diagnostico' AND NOT l.intake_complete) THEN RAISE EXCEPTION 'invalid_transition' USING ERRCODE='22023'; END IF;
 UPDATE os_lab.leads SET stage=next_stage WHERE id=l.id;
 INSERT INTO os_lab.lead_events(lead_id,member_id,session_id,event_type,previous_stage,new_stage)
 VALUES(l.id,current_setting('os_lab.actor_id')::uuid,current_setting('os_lab.session_id')::uuid,'stage_changed',l.stage,next_stage);
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.contract_synthetic_lead(target_id uuid,project_id uuid,confirmed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE l os_lab.leads%ROWTYPE; existing uuid;
BEGIN
 IF project_id IS NULL OR confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'invalid_contract' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM os_lab.leads WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_lead(l.org_id,l.assigned_member,true) THEN RAISE EXCEPTION 'lead_denied' USING ERRCODE='42501'; END IF;
 IF NOT l.intake_complete OR l.stage<>'diagnostico' THEN RAISE EXCEPTION 'invalid_contract' USING ERRCODE='22023'; END IF;
 SELECT p.id INTO existing FROM os_lab.projects p WHERE p.lead_id=l.id;
 IF FOUND THEN RETURN existing; END IF;
 INSERT INTO os_lab.projects(id,org_id,lead_id,label) VALUES(project_id,l.org_id,l.id,l.display_name);
 INSERT INTO os_lab.project_access(project_id,member_id,org_id) VALUES(project_id,current_setting('os_lab.actor_id')::uuid,l.org_id) ON CONFLICT DO NOTHING;
 IF l.assigned_member IS NOT NULL THEN
 INSERT INTO os_lab.project_access(project_id,member_id,org_id) VALUES(project_id,l.assigned_member,l.org_id) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO os_lab.lead_events(lead_id,member_id,session_id,event_type,new_stage)
 VALUES(l.id,current_setting('os_lab.actor_id')::uuid,current_setting('os_lab.session_id')::uuid,'contracted','diagnostico');
 RETURN project_id;
END;
$fn$;

CREATE FUNCTION os_lab.update_project_details(target_id uuid,next_stage text,owner_name text,deadline date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE;
BEGIN
 IF next_stage IS NULL OR next_stage NOT IN ('Escutar','Investigar','Priorizar','Estruturar','Acompanhar') OR owner_name IS NULL OR owner_name NOT IN ('A definir','Atendimento','Pesquisa','Produção','Equipe') THEN RAISE EXCEPTION 'invalid_project_details' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(p.id,p.org_id,true) THEN RAISE EXCEPTION 'project_denied' USING ERRCODE='42501'; END IF;
 IF p.method_stage=next_stage AND p.owner_label=owner_name AND p.due_on IS NOT DISTINCT FROM deadline THEN RETURN false; END IF;
 UPDATE os_lab.projects SET method_stage=next_stage,owner_label=owner_name,due_on=deadline WHERE id=target_id;
 RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.create_synthetic_lead(uuid,uuid,text,boolean),os_lab.complete_synthetic_lead(uuid,text),os_lab.move_lead(uuid,text,text),os_lab.contract_synthetic_lead(uuid,uuid,boolean),os_lab.update_project_details(uuid,text,text,date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.create_synthetic_lead(uuid,uuid,text,boolean),os_lab.complete_synthetic_lead(uuid,text),os_lab.move_lead(uuid,text,text),os_lab.contract_synthetic_lead(uuid,uuid,boolean),os_lab.update_project_details(uuid,text,text,date) TO os_lab_test;
