import test from 'node:test';
import assert from 'node:assert/strict';
import {clientDeliveryText} from '../lib/os-lab/delivery-export.ts';
const p={projectId:'fixture',company:'Empresa fictícia',stage:'Investigar',due:null,summary:'Resumo aprovado',nextStep:'Próxima etapa',maturity:{value:50,coverage:10},actions:[{title:'Ação autorizada',due:'2026-12-15',done:true}]};
test('exports only explicit approved projection fields',()=>{
 const text=clientDeliveryText({...p,ledger:'SECRET_FINANCE',synthesis:'SECRET_INTERNAL',review_note:'SECRET_REVIEW',evidence:'SECRET_EVIDENCE'});
 for(const fragment of ['Empresa fictícia','Resumo aprovado','Maturidade: 50%','10/10 pilares','Ação autorizada','Concluída','DADOS FICTÍCIOS'])assert.ok(text.includes(fragment));
 assert.ok(!text.includes('SECRET_'));
});
test('optional indicators and actions remain omitted',()=>{
 const text=clientDeliveryText({...p,maturity:null,actions:[]});
 assert.ok(!text.includes('Maturidade:'));
 assert.ok(!text.includes('Plano de ação'));
});
