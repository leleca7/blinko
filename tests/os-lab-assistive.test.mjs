import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssistiveDraft, validateSuggestion, portalProjection, portalApprovalKey, canPreviewPortal } from '../lib/os-lab/assistive.ts';
const sources=[
{id:1,pillar:0,kind:'Fato observado',source:'Visita',statement:'Fictício',verified:true},
{id:2,pillar:0,kind:'Hipótese',source:'Entrevista',statement:'Fictício',verified:true},
{id:3,pillar:0,kind:'Relato',source:'Entrevista',statement:'Fictício',verified:false},
{id:4,pillar:1,kind:'Relato',source:'Documento',statement:'Fictício',verified:true}];
const input={projectId:1,company:'Empresa fictícia',stage:'Investigar',due:'2027-01-01',maturity:75,coverage:10,actions:[{title:'Ação fictícia',done:false,due:'2027-01-01',owner:'interno',gut:125}],draft:{summary:'Resumo fictício',nextStep:'Próxima etapa',showMaturity:false,showActions:false},ledger:[{amount:123}],evidence:sources,internalNotes:'Interno'};
test('suggestions cite eligible sources only in selected pillar',()=>{const result=buildAssistiveDraft(sources,0);assert.equal(result.length,2);for(const s of result)assert.deepEqual(s.sourceIds,[1]);});
test('empty evidence yields collection question only',()=>{const [s]=buildAssistiveDraft(sources,2);assert.deepEqual(s.sourceIds,[]);assert.match(s.limitation,/Sem evidências/);});
test('validator rejects fabricated, revoked, cross-pillar and repeated references',()=>{const [s]=buildAssistiveDraft(sources,0);assert.deepEqual(validateSuggestion(s,sources,0),s);for(const ids of [[99],[2],[3],[4],[1,1]])assert.equal(validateSuggestion({...s,sourceIds:ids},sources,0),null);assert.equal(validateSuggestion({...s,extra:'secret'},sources,0),null);});
test('portal excludes internal fields and defaults optional sections off',()=>{const p=portalProjection(input);assert.equal(p.maturity,null);assert.deepEqual(p.actions,[]);for(const key of ['ledger','evidence','internalNotes','draft'])assert.ok(!(key in p));});
test('optional actions expose only allowlisted fields',()=>{const p=portalProjection({...input,draft:{...input.draft,showActions:true,showMaturity:true}});assert.deepEqual(p.actions,[{title:'Ação fictícia',done:false,due:'2027-01-01'}]);assert.deepEqual(p.maturity,{value:75,coverage:10});});
test('portal approval is tied to project, reviewed content and current preview',()=>{const k=portalApprovalKey(input,'review1');assert.equal(canPreviewPortal(input,true,k,'review1'),true);assert.equal(canPreviewPortal(input,false,k,'review1'),false);assert.equal(canPreviewPortal(input,true,k,'review2'),false);assert.equal(canPreviewPortal({...input,projectId:2},true,k,'review1'),false);assert.equal(canPreviewPortal({...input,draft:{...input.draft,summary:'Mudança'}},true,k,'review1'),false);const blank={...input,draft:{...input.draft,summary:' '}};assert.equal(canPreviewPortal(blank,true,portalApprovalKey(blank,'review1'),'review1'),false);});
