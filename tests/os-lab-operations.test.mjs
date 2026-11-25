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
