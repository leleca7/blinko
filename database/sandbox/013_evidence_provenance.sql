-- Sandbox exclusively. Preserve unknown provenance on legacy fixtures; require provenance on every new application write.
ALTER TABLE os_lab.evidence
 ADD COLUMN source_label text CHECK(source_label IS NULL OR length(btrim(source_label)) BETWEEN 1 AND 200),
 ADD COLUMN recorded_by uuid,
 ADD COLUMN recorded_session_id uuid REFERENCES os_lab.sessions(id),
 ADD COLUMN recorded_at timestamptz,
 ADD CONSTRAINT evidence_recorder_org FOREIGN KEY(recorded_by,org_id) REFERENCES os_lab.members(id,org_id),
 ADD CONSTRAINT evidence_provenance_complete CHECK ((source_label IS NULL AND recorded_by IS NULL AND recorded_session_id IS NULL AND recorded_at IS NULL) OR (source_label IS NOT NULL AND recorded_by IS NOT NULL AND recorded_session_id IS NOT NULL AND recorded_at IS NOT NULL));

CREATE FUNCTION os_lab.record_evidence(target_id uuid,target_project uuid,target_pillar integer,target_kind text,source_text text,summary_text text)
RETURNS os_lab.evidence LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE; e os_lab.evidence%ROWTYPE;
 actor text:=current_setting('os_lab.actor_id',true); sid text:=current_setting('os_lab.session_id',true);
BEGIN
 IF target_id IS NULL OR target_project IS NULL OR target_pillar IS NULL OR target_pillar NOT BETWEEN 0 AND 9 OR target_kind IS NULL OR target_kind NOT IN ('fact','report','hypothesis') OR source_text IS NULL OR length(btrim(source_text)) NOT BETWEEN 1 AND 200 OR summary_text IS NULL OR length(btrim(summary_text)) NOT BETWEEN 1 AND 500 THEN
  RAISE EXCEPTION 'invalid_evidence' USING ERRCODE='22023';
 END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target_project;
 IF NOT FOUND OR NOT os_lab.can_access_project(p.id,p.org_id,true) THEN
  RAISE EXCEPTION 'evidence_denied' USING ERRCODE='42501';
 END IF;
 INSERT INTO os_lab.evidence(id,project_id,org_id,pillar,kind,summary,source_label,recorded_by,recorded_session_id,recorded_at)
 VALUES(target_id,p.id,p.org_id,target_pillar,target_kind,btrim(summary_text),btrim(source_text),actor::uuid,sid::uuid,statement_timestamp())
 ON CONFLICT(id) DO NOTHING RETURNING * INTO e;
 IF NOT FOUND THEN
  SELECT * INTO e FROM os_lab.evidence WHERE id=target_id;
  IF NOT FOUND OR e.project_id<>p.id OR e.org_id<>p.org_id OR e.recorded_by IS DISTINCT FROM actor::uuid OR e.pillar<>target_pillar OR e.kind<>target_kind OR e.source_label IS DISTINCT FROM btrim(source_text) OR e.summary<>btrim(summary_text) THEN
   RAISE EXCEPTION 'evidence_conflict' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN e;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.record_evidence(uuid,uuid,integer,text,text,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.record_evidence(uuid,uuid,integer,text,text,text) TO os_lab_test;

REVOKE INSERT ON os_lab.evidence FROM os_lab_test;
