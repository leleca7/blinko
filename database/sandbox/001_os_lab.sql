-- Sandbox exclusively: never apply to production. No copied customer data.
-- Reference model for tests, not a replacement for the existing 74-table schema.
CREATE SCHEMA IF NOT EXISTS os_lab;
REVOKE ALL ON SCHEMA os_lab FROM PUBLIC;
CREATE TABLE IF NOT EXISTS os_lab.organizations (
 id uuid PRIMARY KEY, label text NOT NULL CHECK (length(label) BETWEEN 1 AND 120)
);
CREATE TABLE IF NOT EXISTS os_lab.members (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES os_lab.organizations(id),
 role text NOT NULL CHECK (role IN ('admin','operator','viewer')),
 active boolean NOT NULL DEFAULT true, UNIQUE(id,org_id)
);
CREATE TABLE IF NOT EXISTS os_lab.leads (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES os_lab.organizations(id),
 submission_id uuid NOT NULL UNIQUE,
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
 stage text NOT NULL DEFAULT 'triagem' CHECK(stage IN ('triagem','contato','reuniao','proposta','diagnostico')),
 consent_version text NOT NULL CHECK(length(consent_version)>0),
 consent_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,org_id)
);
CREATE TABLE IF NOT EXISTS os_lab.projects (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES os_lab.organizations(id),
 lead_id uuid NOT NULL, label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 UNIQUE(lead_id), UNIQUE(id,org_id),
 FOREIGN KEY (lead_id,org_id) REFERENCES os_lab.leads(id,org_id)
);
CREATE TABLE IF NOT EXISTS os_lab.project_access (
 project_id uuid NOT NULL, member_id uuid NOT NULL, org_id uuid NOT NULL,
 PRIMARY KEY(project_id,member_id),
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id),
 FOREIGN KEY(member_id,org_id) REFERENCES os_lab.members(id,org_id)
);
CREATE TABLE IF NOT EXISTS os_lab.evidence (
 id uuid PRIMARY KEY, project_id uuid NOT NULL, org_id uuid NOT NULL,
 pillar smallint NOT NULL CHECK(pillar BETWEEN 0 AND 9),
 kind text NOT NULL CHECK(kind IN ('fact','report','hypothesis')),
 summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 500),
 reviewed boolean NOT NULL DEFAULT false,
 FOREIGN KEY(project_id,org_id) REFERENCES os_lab.projects(id,org_id)
);
-- No anonymous access. App runtime role is distinct from schema owner.
-- Runtime identity must be derived from a verified server session, never a client header.
-- The following policies use transaction-local actor context; SQL access itself is trusted.
CREATE OR REPLACE FUNCTION os_lab.can_access_project(p uuid, o uuid, writing boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,os_lab
AS $fn$
 SELECT EXISTS (
 SELECT 1 FROM os_lab.members m
 WHERE m.id::text=current_setting('os_lab.actor_id',true) AND m.org_id=o AND m.active
 AND (NOT writing OR m.role IN ('admin','operator'))
 AND (m.role='admin' OR EXISTS (SELECT 1 FROM os_lab.project_access a WHERE a.project_id=p AND a.member_id=m.id AND a.org_id=o))
 )
$fn$;
REVOKE ALL ON FUNCTION os_lab.can_access_project(uuid,uuid,boolean) FROM PUBLIC;
ALTER TABLE os_lab.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_lab.evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY lab_projects_read ON os_lab.projects FOR SELECT USING (os_lab.can_access_project(id,org_id,false));
CREATE POLICY lab_evidence_read ON os_lab.evidence FOR SELECT USING (os_lab.can_access_project(project_id,org_id,false));
CREATE POLICY lab_evidence_add ON os_lab.evidence FOR INSERT WITH CHECK (os_lab.can_access_project(project_id,org_id,true));
-- No runtime UPDATE/DELETE, no public intake grants in this increment.
