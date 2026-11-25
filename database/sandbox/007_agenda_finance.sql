-- Dedicated synthetic sandbox only. Finance access is provisionally restricted to admins.
-- Action deadlines stay in action_items; agenda reads both sources, no duplicate completion state.
CREATE TABLE os_lab.appointments (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, org_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK(kind IN ('Reunião','Entrevista','Visita','Entrega','Revisão')),
 due_on date NOT NULL, done boolean NOT NULL DEFAULT false,
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id)
);

CREATE TABLE os_lab.ledger_entries (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, org_id uuid NOT NULL,
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 120),
 kind text NOT NULL CHECK(kind IN ('income','expense')),
 cents bigint NOT NULL CHECK(cents BETWEEN 1 AND 10000000000),
 due_on date NOT NULL, settled_at timestamptz,
 member_id uuid NOT NULL REFERENCES os_lab.members(id),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id)
);

CREATE FUNCTION os_lab.can_access_finance(p uuid,o uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
 SELECT os_lab.can_access_project(p,o,true) AND EXISTS(
 SELECT 1 FROM os_lab.members m WHERE m.id::text=current_setting('os_lab.actor_id',true)
 AND m.org_id=o AND m.role='admin' AND m.active)
$fn$;

REVOKE ALL ON FUNCTION os_lab.can_access_finance(uuid,uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.can_access_finance(uuid,uuid) TO os_lab_test;

REVOKE ALL ON os_lab.appointments,os_lab.ledger_entries FROM PUBLIC;

ALTER TABLE os_lab.appointments ENABLE ROW LEVEL SECURITY;

ALTER TABLE os_lab.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY lab_appointments_read ON os_lab.appointments FOR SELECT USING(os_lab.can_access_project(project_id,org_id,false));

CREATE POLICY lab_ledger_read ON os_lab.ledger_entries FOR SELECT USING(os_lab.can_access_finance(project_id,org_id));

GRANT SELECT ON os_lab.appointments,os_lab.ledger_entries TO os_lab_test;

CREATE FUNCTION os_lab.create_appointment(target_id uuid,target_project uuid,event_title text,event_kind text,due_date date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE;
BEGIN
 IF target_id IS NULL OR event_title IS NULL OR length(btrim(event_title)) NOT BETWEEN 1 AND 120
 OR event_kind IS NULL OR event_kind NOT IN ('Reunião','Entrevista','Visita','Entrega','Revisão') OR due_date IS NULL
 THEN RAISE EXCEPTION 'invalid_appointment' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target_project;
 IF NOT FOUND OR NOT os_lab.can_access_project(p.id,p.org_id,true) THEN RAISE EXCEPTION 'appointment_denied' USING ERRCODE='42501'; END IF;
 INSERT INTO os_lab.appointments(id,project_id,org_id,title,kind,due_on,member_id)
 VALUES(target_id,p.id,p.org_id,btrim(event_title),event_kind,due_date,current_setting('os_lab.actor_id')::uuid);
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.set_appointment_done(target_id uuid,target_done boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE a os_lab.appointments%ROWTYPE;
BEGIN
 IF target_done IS NULL THEN RAISE EXCEPTION 'invalid_appointment' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM os_lab.appointments WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_project(a.project_id,a.org_id,true) THEN RAISE EXCEPTION 'appointment_denied' USING ERRCODE='42501'; END IF;
 IF a.done=target_done THEN RETURN false; END IF;
 UPDATE os_lab.appointments SET done=target_done WHERE id=target_id;
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.create_ledger_entry(target_id uuid,target_project uuid,entry_label text,entry_kind text,entry_cents bigint,due_date date)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE p os_lab.projects%ROWTYPE;
BEGIN
 IF target_id IS NULL OR entry_label IS NULL OR length(btrim(entry_label)) NOT BETWEEN 1 AND 120
 OR entry_kind IS NULL OR entry_kind NOT IN ('income','expense') OR entry_cents IS NULL OR entry_cents NOT BETWEEN 1 AND 10000000000 OR due_date IS NULL
 THEN RAISE EXCEPTION 'invalid_ledger_entry' USING ERRCODE='22023'; END IF;
 SELECT * INTO p FROM os_lab.projects WHERE id=target_project;
 IF NOT FOUND OR NOT os_lab.can_access_finance(p.id,p.org_id) THEN RAISE EXCEPTION 'finance_denied' USING ERRCODE='42501'; END IF;
 INSERT INTO os_lab.ledger_entries(id,project_id,org_id,label,kind,cents,due_on,member_id)
 VALUES(target_id,p.id,p.org_id,btrim(entry_label),entry_kind,entry_cents,due_date,current_setting('os_lab.actor_id')::uuid);
 RETURN true;
END;
$fn$;

CREATE FUNCTION os_lab.set_ledger_settled(target_id uuid,target_settled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
DECLARE a os_lab.ledger_entries%ROWTYPE;
BEGIN
 IF target_settled IS NULL THEN RAISE EXCEPTION 'invalid_ledger_entry' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM os_lab.ledger_entries WHERE id=target_id FOR UPDATE;
 IF NOT FOUND OR NOT os_lab.can_access_finance(a.project_id,a.org_id) THEN RAISE EXCEPTION 'finance_denied' USING ERRCODE='42501'; END IF;
 IF (a.settled_at IS NOT NULL)=target_settled THEN RETURN false; END IF;
 UPDATE os_lab.ledger_entries SET settled_at=CASE WHEN target_settled THEN statement_timestamp() ELSE NULL END WHERE id=target_id;
 RETURN true;
END;
$fn$;

CREATE TABLE os_lab.ledger_settlement_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid NOT NULL REFERENCES os_lab.ledger_entries(id),
 member_id uuid NOT NULL REFERENCES os_lab.members(id), session_id uuid NOT NULL REFERENCES os_lab.sessions(id),
 settled boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

REVOKE ALL ON os_lab.ledger_settlement_events FROM PUBLIC;

CREATE FUNCTION os_lab.audit_ledger_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,os_lab AS $fn$
BEGIN
 IF OLD.settled_at IS DISTINCT FROM NEW.settled_at THEN
 INSERT INTO os_lab.ledger_settlement_events(entry_id,member_id,session_id,settled)
 VALUES(NEW.id,current_setting('os_lab.actor_id')::uuid,current_setting('os_lab.session_id')::uuid,NEW.settled_at IS NOT NULL);
 END IF;
 RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION os_lab.audit_ledger_settlement() FROM PUBLIC;

CREATE TRIGGER lab_ledger_settlement_audit AFTER UPDATE OF settled_at ON os_lab.ledger_entries FOR EACH ROW EXECUTE FUNCTION os_lab.audit_ledger_settlement();

REVOKE ALL ON FUNCTION os_lab.create_appointment(uuid,uuid,text,text,date),os_lab.set_appointment_done(uuid,boolean),os_lab.create_ledger_entry(uuid,uuid,text,text,bigint,date),os_lab.set_ledger_settled(uuid,boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION os_lab.create_appointment(uuid,uuid,text,text,date),os_lab.set_appointment_done(uuid,boolean),os_lab.create_ledger_entry(uuid,uuid,text,text,bigint,date),os_lab.set_ledger_settled(uuid,boolean) TO os_lab_test;
