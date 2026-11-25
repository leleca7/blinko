-- Executed only against an empty disposable CI database, after migrations 001..010.
-- The owner sets synthetic session context, then tests as the actual restricted runtime role.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO os_lab.sessions(id,member_id,issued_at,expires_at) VALUES
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011',now(),now()+interval '30 minutes'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000013',now(),now()+interval '30 minutes'),
('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000015',now(),now()+interval '30 minutes');
SET LOCAL ROLE os_lab_runtime;
DO $test$
DECLARE
 op uuid:='00000000-0000-4000-8000-000000000011';
 adm uuid:='00000000-0000-4000-8000-000000000013';
 org uuid:='00000000-0000-4000-8000-000000000001';
 lead uuid:='20000000-0000-4000-8000-000000000001';
 submission uuid:='20000000-0000-4000-8000-000000000002';
 project uuid:='20000000-0000-4000-8000-000000000003';
 action uuid:='20000000-0000-4000-8000-000000000004';
 appointment uuid:='20000000-0000-4000-8000-000000000005';
 receipt uuid:='20000000-0000-4000-8000-000000000006';
 expense uuid:='20000000-0000-4000-8000-000000000007';
 quote uuid:='20000000-0000-4000-8000-000000000008';
 hyp uuid:='20000000-0000-4000-8000-000000000009';
 ev uuid[]:=ARRAY(SELECT ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(0,9) i);
 i integer; preview jsonb;
BEGIN
 PERFORM set_config('os_lab.actor_id',op::text,true);
 PERFORM set_config('os_lab.session_id','10000000-0000-4000-8000-000000000001',true);
 IF os_lab.create_synthetic_lead(lead,submission,'Empresa fictícia CI',true)<>lead THEN RAISE EXCEPTION 'lead id'; END IF;
 IF os_lab.create_synthetic_lead(gen_random_uuid(),submission,'Empresa fictícia CI',true)<>lead THEN RAISE EXCEPTION 'lead dedup'; END IF;
 BEGIN
  PERFORM os_lab.contract_synthetic_lead(lead,project,true);
  RAISE EXCEPTION 'premature contract accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM os_lab.complete_synthetic_lead(lead,'Organização comercial');
 PERFORM os_lab.move_lead(lead,'triagem','contato');
 PERFORM os_lab.move_lead(lead,'contato','reuniao');
 PERFORM os_lab.move_lead(lead,'reuniao','proposta');
 PERFORM os_lab.move_lead(lead,'proposta','diagnostico');
 IF os_lab.contract_synthetic_lead(lead,project,true)<>project OR os_lab.contract_synthetic_lead(lead,gen_random_uuid(),true)<>project THEN RAISE EXCEPTION 'contract dedup'; END IF;
 PERFORM os_lab.update_project_details(project,'Investigar','Pesquisa','2026-12-15');
 FOR i IN 0..9 LOOP
  INSERT INTO os_lab.evidence(id,project_id,org_id,pillar,kind,summary) VALUES(ev[i+1],project,org,i,'fact','Synthetic evidence '||i);
 END LOOP;
 BEGIN
  PERFORM os_lab.save_radar_score(project,0,2,ev[1]);
  RAISE EXCEPTION 'unreviewed score accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 RAISE NOTICE 'PASS CRM, consent, deduplication and evidence';
 PERFORM set_config('os_lab.actor_id',adm::text,true);
 PERFORM set_config('os_lab.session_id','10000000-0000-4000-8000-000000000002',true);
 FOR i IN 0..9 LOOP
  PERFORM os_lab.review_evidence(ev[i+1],true,'Synthetic review');
  PERFORM os_lab.save_radar_score(project,i,2,ev[i+1]);
 END LOOP;
 PERFORM os_lab.create_action_item(action,project,ev[1],'Synthetic action','Equipe','2026-12-15',4,4,3);
 PERFORM os_lab.create_appointment(appointment,project,'Synthetic appointment','Reunião','2026-12-15');
 PERFORM os_lab.set_appointment_done(appointment,true);
 PERFORM os_lab.set_action_done(action,true);
 IF NOT EXISTS(SELECT 1 FROM os_lab.action_items WHERE id=action AND gut=48 AND done) THEN RAISE EXCEPTION 'action status'; END IF;
 PERFORM os_lab.save_hypothesis(hyp,project,1,'Synthetic cause','Synthetic effect',ev[2],ev[3],'supported','Synthetic rationale');
 PERFORM os_lab.create_quote(quote,lead,2400,3000,30000,800,2000);
 IF NOT EXISTS(SELECT 1 FROM os_lab.quote_estimates WHERE id=quote AND cost_cents=150000 AND price_cents=208334) THEN RAISE EXCEPTION 'quote arithmetic'; END IF;
 PERFORM os_lab.create_ledger_entry(receipt,project,'Synthetic income','income',200000,'2026-12-15');
 PERFORM os_lab.create_ledger_entry(expense,project,'Synthetic expense','expense',30000,'2026-12-15');
 PERFORM os_lab.set_ledger_settled(receipt,true);
 PERFORM os_lab.set_ledger_settled(expense,true);
 IF (SELECT sum(CASE WHEN kind='income' THEN cents ELSE -cents END) FROM os_lab.ledger_entries WHERE project_id=project AND settled_at IS NOT NULL) IS DISTINCT FROM 170000::numeric THEN RAISE EXCEPTION 'ledger balance'; END IF;
 RAISE NOTICE 'PASS radar, GUT, hypothesis, agenda, quote and finance';
 PERFORM os_lab.save_report(project,'Synthetic report');
 PERFORM os_lab.review_report(project,true,'Synthetic review');
 PERFORM os_lab.save_portal_draft(project,'Synthetic summary','Synthetic next step',true,true);
 PERFORM os_lab.approve_portal(project,true);
 preview:=os_lab.internal_portal_preview(project);
 IF preview IS NULL OR preview->'maturity'->>'value' IS DISTINCT FROM '50' OR preview->'maturity'->>'coverage' IS DISTINCT FROM '10' OR preview ? 'ledger' OR preview ? 'synthesis' OR preview ? 'review_note' OR preview ? 'evidence' THEN RAISE EXCEPTION 'portal projection'; END IF;
 PERFORM os_lab.save_report(project,'Changed');
 PERFORM os_lab.save_report(project,'Synthetic report');
 IF os_lab.internal_portal_preview(project) IS NOT NULL THEN RAISE EXCEPTION 'approval resurrected'; END IF;
 PERFORM os_lab.review_report(project,true,'Synthetic renewed review');
 PERFORM os_lab.approve_portal(project,true);
 PERFORM os_lab.review_evidence(ev[2],false,'Synthetic revocation');
 PERFORM os_lab.review_evidence(ev[2],true,'Synthetic reapproval');
 IF os_lab.internal_portal_preview(project) IS NOT NULL THEN RAISE EXCEPTION 'stale evidence approval'; END IF;
 PERFORM os_lab.save_radar_score(project,1,2,ev[2]);
 BEGIN
  PERFORM os_lab.review_report(project,true,'Synthetic review');
  RAISE EXCEPTION 'stale hypothesis accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 PERFORM os_lab.save_hypothesis(hyp,project,1,'Synthetic cause','Synthetic effect',ev[2],ev[3],'supported','Synthetic renewed rationale');
 PERFORM os_lab.review_report(project,true,'Synthetic renewed review');
 PERFORM os_lab.approve_portal(project,true);
 IF os_lab.internal_portal_preview(project) IS NULL THEN RAISE EXCEPTION 'new approval unavailable'; END IF;
 RAISE NOTICE 'PASS delivery, revision invalidation and explicit revalidation';
 PERFORM set_config('os_lab.actor_id',op::text,true);
 PERFORM set_config('os_lab.session_id','10000000-0000-4000-8000-000000000001',true);
 IF EXISTS(SELECT 1 FROM os_lab.ledger_entries WHERE project_id=project) OR EXISTS(SELECT 1 FROM os_lab.quote_estimates WHERE lead_id=lead) THEN RAISE EXCEPTION 'finance exposed'; END IF;
 PERFORM set_config('os_lab.actor_id','00000000-0000-4000-8000-000000000015',true);
 PERFORM set_config('os_lab.session_id','10000000-0000-4000-8000-000000000003',true);
 IF EXISTS(SELECT 1 FROM os_lab.projects WHERE id=project) OR EXISTS(SELECT 1 FROM os_lab.leads WHERE id=lead) OR os_lab.internal_portal_preview(project) IS NOT NULL THEN RAISE EXCEPTION 'project isolation'; END IF;
 PERFORM set_config('os_lab.session_id','',true);
 IF EXISTS(SELECT 1 FROM os_lab.projects) THEN RAISE EXCEPTION 'unauthenticated visibility'; END IF;
 RAISE NOTICE 'PASS runtime role, restricted finance, project and session isolation';
END
$test$;
ROLLBACK;
