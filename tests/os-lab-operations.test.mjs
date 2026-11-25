import test from 'node:test';
import assert from 'node:assert/strict';
import {validateOperation} from '../lib/os-lab/operations.ts';
const id='00000000-0000-4000-8000-000000000041';
const evidenceId='00000000-0000-4000-8000-000000000051';
const score={type:'score',projectId:id,pillar:0,value:2,evidenceId};
const action={type:'action',id:'00000000-0000-4000-8000-0000000000b4',projectId:id,evidenceId,title:' Synthetic action ',owner:'Equipe',due:'2026-12-10',gravity:4,urgency:4,tendency:3};
test('score accepts zero and explicit integer values, rejects missing or client-controlled fields',()=>{
 assert.deepEqual(validateOperation(score),score);
 assert.equal(validateOperation({...score,value:0}).value,0);
 for(const patch of [{value:5},{value:2.5},{value:null},{pillar:10},{evidenceId:'invalid'},{orgId:id},{reviewed:true},{eligible:true},{evidenceRevision:1}])assert.equal(validateOperation({...score,...patch}),null);
});
test('action requires responsible, actual calendar date, bounded dimensions and no client gut',()=>{
 assert.deepEqual(validateOperation(action),{...action,title:'Synthetic action'});
 for(const patch of [{owner:'A definir'},{due:'2026-02-30'},{due:'2026-2-01'},{gravity:0},{urgency:6},{tendency:2.2},{gut:48},{done:true},{title:' '},{title:'x'.repeat(161)}])assert.equal(validateOperation({...action,...patch}),null);
});
test('completion is boolean and cannot change ownership, project or evidence',()=>{
 const c={type:'completion',id:action.id,done:true};
 assert.deepEqual(validateOperation(c),c);
 assert.equal(validateOperation({...c,done:false}).done,false);
 for(const patch of [{done:'true'},{id:'invalid'},{projectId:id},{evidenceId},{actorId:id}])assert.equal(validateOperation({...c,...patch}),null);
});

const appointment={type:'appointment',id:action.id,projectId:id,title:' Synthetic meeting ',kind:'Reunião',due:'2026-12-10'};
const ledger={type:'ledger',id:action.id,projectId:id,label:' Synthetic receipt ',kind:'income',cents:200000,due:'2026-12-10'};
test('appointments require an allowed type, valid date and no initial completion flag',()=>{
 assert.deepEqual(validateOperation(appointment),{...appointment,title:'Synthetic meeting'});
 for(const patch of [{kind:'other'},{due:'2026-02-29'},{title:' '},{done:true},{orgId:id}])assert.equal(validateOperation({...appointment,...patch}),null);
 assert.equal(validateOperation({...appointment,due:'2028-02-29'}).due,'2028-02-29');
});
test('ledger accepts exact positive integer cents, not client settlement or actor fields',()=>{
 assert.deepEqual(validateOperation(ledger),{...ledger,label:'Synthetic receipt'});
 assert.equal(validateOperation({...ledger,kind:'expense',cents:1}).cents,1);
 for(const patch of [{cents:0},{cents:-1},{cents:1.5},{cents:'200000'},{cents:10000000001},{kind:'other'},{settled:true},{settledAt:'2026-12-10'},{actorId:id},{due:'2026-13-01'}])assert.equal(validateOperation({...ledger,...patch}),null);
});
test('appointment and ledger status updates accept only id and exact boolean',()=>{
 const event={type:'appointment_done',id:action.id,done:true};
 const entry={type:'ledger_settled',id:action.id,settled:false};
 assert.deepEqual(validateOperation(event),event);
 assert.deepEqual(validateOperation(entry),entry);
 for(const patch of [{done:'true'},{projectId:id},{id:'invalid'}])assert.equal(validateOperation({...event,...patch}),null);
 for(const patch of [{settled:'false'},{cents:1},{id:'invalid'},{settledAt:'2026-12-10'}])assert.equal(validateOperation({...entry,...patch}),null);
});

const lead={type:'lead_create',id,submissionId:evidenceId,company:'Empresa fictícia Teste',consent:true};
test('CRM entry requires synthetic name and explicit consent, disallows supplied organization',()=>{
 assert.deepEqual(validateOperation(lead),lead);
 for(const patch of [{company:'Real company'},{consent:false},{submissionId:'invalid'},{orgId:id},{assignedMember:id},{stage:'diagnostico'}])assert.equal(validateOperation({...lead,...patch}),null);
});
test('CRM completion and transitions validate shape; database decides allowed transition',()=>{
 const complete={type:'lead_complete',id,challenge:' Organização comercial '};
 assert.equal(validateOperation(complete).challenge,'Organização comercial');
 assert.equal(validateOperation({...complete,challenge:' '}),null);
 assert.equal(validateOperation({...complete,intakeComplete:true}),null);
 const move={type:'lead_move',id,expectedStage:'triagem',nextStage:'contato'};
 assert.deepEqual(validateOperation(move),move);
 assert.equal(validateOperation({...move,nextStage:'unknown'}),null);
 assert.equal(validateOperation({...move,expectedStage:undefined}),null);
});
test('synthetic contract needs explicit confirmation and project metadata accepts nullable valid deadline',()=>{
 const contract={type:'lead_contract',id,projectId:evidenceId,confirmed:true};
 assert.deepEqual(validateOperation(contract),contract);
 assert.equal(validateOperation({...contract,confirmed:false}),null);
 assert.equal(validateOperation({...contract,orgId:id}),null);
 const details={type:'project_details',id,stage:'Investigar',owner:'Pesquisa',due:null};
 assert.deepEqual(validateOperation(details),details);
 assert.equal(validateOperation({...details,due:'2026-02-30'}),null);
 assert.equal(validateOperation({...details,owner:'other'}),null);
 assert.equal(validateOperation({...details,stage:'other'}),null);
});

test('report synthesis and review require bounded text and reject client approval metadata',()=>{
 const draft={type:'report_save',id,synthesis:' Synthetic synthesis '};
 assert.equal(validateOperation(draft).synthesis,'Synthetic synthesis');
 for(const patch of [{synthesis:' '},{synthesis:'x'.repeat(2001)},{reviewed:true},{draftRevision:1}])assert.equal(validateOperation({...draft,...patch}),null);
 const review={type:'report_review',id,reviewed:false,note:' Synthetic revocation '};
 assert.deepEqual(validateOperation(review),{...review,note:'Synthetic revocation'});
 for(const patch of [{note:' '},{reviewed:'true'},{reviewedBy:id},{projectRevision:2}])assert.equal(validateOperation({...review,...patch}),null);
});
test('portal requires explicit options and rejects internal data and client-selected authorization',()=>{
 const draft={type:'portal_save',id,summary:' Synthetic summary ',nextStep:'Next step',showMaturity:false,showActions:false};
 assert.deepEqual(validateOperation(draft),{...draft,summary:'Synthetic summary'});
 for(const patch of [{summary:' '},{nextStep:'x'.repeat(501)},{showActions:1},{ledger:[]},{evidence:[]},{approved:true},{portalRevision:1}])assert.equal(validateOperation({...draft,...patch}),null);
 const approval={type:'portal_approve',id,approved:true};
 assert.deepEqual(validateOperation(approval),approval);
 assert.equal(validateOperation({...approval,approved:'true'}),null);
 assert.equal(validateOperation({...approval,approvedBy:id}),null);
});

test('hypothesis requires distinct evidence and rationale for human conclusions',()=>{
 const h={type:'hypothesis_save',id,projectId:id,pillar:1,cause:' Synthetic cause ',effect:'Synthetic effect',supportId:evidenceId,challengeId:null,decision:'supported',rationale:'Reason'};
 assert.deepEqual(validateOperation(h),{...h,cause:'Synthetic cause'});
 assert.equal(validateOperation({...h,supportId:null,decision:'open',rationale:''}).decision,'open');
 for(const patch of [{supportId:null},{challengeId:evidenceId},{decision:'rejected'},{rationale:' '},{supportRevision:1},{pillar:10},{cause:'x'.repeat(501)}])assert.equal(validateOperation({...h,...patch}),null);
});
test('quote accepts exact integer minutes, cents and basis points without client price',()=>{
 const q={type:'quote_create',id,leadId:evidenceId,minutes:2400,hourlyCents:3000,expenseCents:30000,feeBps:800,marginBps:2000};
 assert.deepEqual(validateOperation(q),q);
 for(const patch of [{minutes:0},{minutes:1.5},{hourlyCents:-1},{expenseCents:0,hourlyCents:0},{feeBps:8000},{marginBps:10000},{priceCents:208334},{approved:true},{orgId:id}])assert.equal(validateOperation({...q,...patch}),null);
});
