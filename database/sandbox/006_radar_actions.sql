-- Sandbox only. Scores and actions are tied to the exact evidence review revision.
-- No direct runtime mutations; eligibility is checked again when reading derived results.
ALTER TABLE os_lab.evidence ADD COLUMN review_revision bigint NOT NULL DEFAULT 0 CHECK(review_revision>=0);

CREATE POLICY lab_evidence_initial_revision ON os_lab.evidence AS RESTRICTIVE FOR INSERT WITH CHECK (review_revision=0);

CREATE FUNCTION os_lab.bump_evidence_review_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,os_lab AS $fn$
BEGIN
 NEW.review_revision := OLD.review_revision + CASE WHEN OLD.reviewed IS DISTINCT FROM NEW.reviewed THEN 1 ELSE 0 END;
 RETURN NEW;
END;
$fn$;

CREATE TRIGGER lab_evidence_revision BEFORE UPDATE ON os_lab.evidence FOR EACH ROW EXECUTE FUNCTION os_lab.bump_evidence_review_revision();

CREATE TABLE os_lab.radar_scores (
 project_id uuid NOT NULL, org_id uuid NOT NULL, pillar smallint NOT NULL CHECK(pillar BETWEEN 0 AND 9),
 value smallint NOT NULL CHECK(value BETWEEN 0 AND 4), evidence_id uuid NOT NULL REFERENCES os_lab.evidence(id),
 evidence_revision bigint NOT NULL CHECK(evidence_revision>=0), member_id uuid NOT NULL REFERENCES os_lab.members(id),
 updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(project_id,pillar), FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id)
);

CREATE TABLE os_lab.action_items (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, org_id uuid NOT NULL,
 evidence_id uuid NOT NULL REFERENCES os_lab.evidence(id), evidence_revision bigint NOT NULL CHECK(evidence_revision>=0),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160),
 owner_label text NOT NULL CHECK(owner_label IN ('Atendimento','Pesquisa','Produção','Equipe')),
 due_on date NOT NULL, gravity smallint NOT NULL CHECK(gravity BETWEEN 1 AND 5),
 urgency smallint NOT NULL CHECK(urgency BETWEEN 1 AND 5), tendency smallint NOT NULL CHECK(tendency BETWEEN 1 AND 5),
 gut integer GENERATED ALWAYS AS (gravity*urgency*tendency) STORED,
 done boolean NOT NULL DEFAULT false, member_id uuid NOT NULL REFERENCES os_lab.members(id),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id)
);

REVOKE ALL ON os_lab.radar_scores,os_lab.action_items FROM PUBLIC;

ALTER TABLE os_lab.radar_scores ENABLE ROW LEVEL SECURITY;

ALTER TABLE os_lab.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_radar_read ON os_lab.radar_scores FOR SELECT USING(os_lab.can_access_project(project_id,org_id,false));

CREATE POLICY lab_action_read ON os_lab.action_items FOR SELECT USING(os_lab.can_access_project(project_id,org_id,false));

GRANT SELECT ON os_lab.radar_scores,os_lab.action_items TO os_lab_test;

CREATE FUNCTION os_lab.save_radar_score(target_project uuid,target_pillar integer,target_value integer,target_evidence uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE e os_lab.evidence%ROWTYPE;
BEGIN
 IF target_pillar IS NULL OR target_pillar NOT BETWEEN 0 AND 9 OR target_value IS NULL OR target_value NOT BETWEEN 0 AND 4 THEN
  RAISE EXCEPTION 'invalid_score' USING ERRCODE='22023';
 END IF;
 SELECT * INTO e FROM os_lab.evidence WHERE id=target_evidence AND project_id=target_project FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(e.project_id,e.org_id,true) THEN
  RAISE EXCEPTION 'score_denied' USING ERRCODE='42501';
 END IF;
 IF NOT e.reviewed OR e.kind='hypothesis' OR e.pillar<>target_pillar THEN
  RAISE EXCEPTION 'evidence_not_eligible' USING ERRCODE='22023';
 END IF;
 INSERT INTO os_lab.radar_scores(project_id,org_id,pillar,value,evidence_id,evidence_revision,member_id)
 VALUES(e.project_id,e.org_id,target_pillar,target_value,e.id,e.review_revision,current_setting('os_lab.actor_id')::uuid)
 ON CONFLICT(project_id,pillar) DO UPDATE SET value=EXCLUDED.value,evidence_id=EXCLUDED.evidence_id,
 evidence_revision=EXCLUDED.evidence_revision,member_id=EXCLUDED.member_id,updated_at=statement_timestamp();
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.create_action_item(target_id uuid,target_project uuid,target_evidence uuid,action_title text,owner_name text,due_date date,g integer,u integer,t integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE e os_lab.evidence%ROWTYPE;
BEGIN
 IF target_id IS NULL OR action_title IS NULL OR length(btrim(action_title)) NOT BETWEEN 1 AND 160
 OR owner_name IS NULL OR owner_name NOT IN ('Atendimento','Pesquisa','Produção','Equipe') OR due_date IS NULL
 OR g IS NULL OR g NOT BETWEEN 1 AND 5 OR u IS NULL OR u NOT BETWEEN 1 AND 5 OR t IS NULL OR t NOT BETWEEN 1 AND 5 THEN
  RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023';
 END IF;
 SELECT * INTO e FROM os_lab.evidence WHERE id=target_evidence AND project_id=target_project FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(e.project_id,e.org_id,true) THEN
  RAISE EXCEPTION 'action_denied' USING ERRCODE='42501';
 END IF;
 IF NOT e.reviewed OR e.kind='hypothesis' THEN RAISE EXCEPTION 'evidence_not_eligible' USING ERRCODE='22023'; END IF;
 INSERT INTO os_lab.action_items(id,project_id,org_id,evidence_id,evidence_revision,title,owner_label,due_on,gravity,urgency,tendency,member_id)
 VALUES(target_id,e.project_id,e.org_id,e.id,e.review_revision,btrim(action_title),owner_name,due_date,g,u,t,current_setting('os_lab.actor_id')::uuid);
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.set_action_done(target_id uuid,target_done boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE a os_lab.action_items%ROWTYPE; e os_lab.evidence%ROWTYPE;
BEGIN
 IF target_done IS NULL THEN RAISE EXCEPTION 'invalid_action' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM os_lab.action_items WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(a.project_id,a.org_id,true) THEN RAISE EXCEPTION 'action_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM os_lab.evidence WHERE id=a.evidence_id FOR UPDATE;
 IF target_done AND (NOT FOUND OR NOT e.reviewed OR e.kind='hypothesis' OR e.review_revision<>a.evidence_revision) THEN
  RAISE EXCEPTION 'evidence_not_eligible' USING ERRCODE='22023';
 END IF;
 IF a.done=target_done THEN RETURN false; END IF;
 UPDATE os_lab.action_items SET done=target_done WHERE id=target_id;
 RETURN true;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.save_radar_score(uuid,integer,integer,uuid),os_lab.create_action_item(uuid,uuid,uuid,text,text,date,integer,integer,integer),os_lab.set_action_done(uuid,boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.save_radar_score(uuid,integer,integer,uuid),os_lab.create_action_item(uuid,uuid,uuid,text,text,date,integer,integer,integer),os_lab.set_action_done(uuid,boolean) TO os_lab_test;
