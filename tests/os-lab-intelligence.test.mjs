import test from 'node:test';
import assert from 'node:assert/strict';
import { pillarCoverage, investigationQuestions, assessHypothesis } from '../lib/os-lab/intelligence.ts';
const evidence=[
{id:1,pillar:0,kind:'Fato observado',source:'Visita fictícia',statement:'Registro A',verified:true},
{id:2,pillar:0,kind:'Relato',source:' visita fictícia ',statement:'Registro B',verified:true},
{id:3,pillar:0,kind:'Hipótese',source:'Outra fonte',statement:'Hipótese',verified:true},
{id:4,pillar:0,kind:'Fato observado',source:'Documento',statement:'Registro C',verified:false},
{id:5,pillar:1,kind:'Relato',source:'Entrevista fictícia',statement:'Registro D',verified:true}];
const base={id:1,pillar:0,cause:'Causa fictícia',effect:'Efeito fictício',supportId:1,challengeId:5,decision:'open',rationale:'Parecer fictício'};
test('coverage excludes hypotheses and pending records; normalizes source labels',()=>assert.deepEqual(pillarCoverage(evidence,2)[0],{pillar:0,total:4,reviewed:2,sources:1,pending:1,observed:1}));
test('empty pillar is not treated as zero maturity',()=>assert.equal(pillarCoverage(evidence,3)[2].reviewed,0));
test('questions flag source and observation gaps',()=>{assert.ok(investigationQuestions(evidence,0).some(q=>q.includes('outra perspectiva')));assert.ok(investigationQuestions(evidence,1).some(q=>q.includes('registros observáveis')));assert.ok(investigationQuestions(evidence,2).some(q=>q.includes('situação concreta')))});
test('support requires eligible evidence and human rationale',()=>{assert.equal(assessHypothesis({...base,decision:'supported'},evidence).stale,false);assert.equal(assessHypothesis({...base,decision:'supported',rationale:''},evidence).stale,true);assert.equal(assessHypothesis({...base,supportId:3},evidence).canSupport,false)});
test('rejection requires contrary evidence and distinct links',()=>{assert.equal(assessHypothesis({...base,decision:'rejected'},evidence).stale,false);assert.equal(assessHypothesis({...base,challengeId:null,decision:'rejected'},evidence).stale,true);assert.equal(assessHypothesis({...base,challengeId:1},evidence).stale,true)});
test('revoked evidence invalidates earlier decision',()=>assert.equal(assessHypothesis({...base,decision:'supported'},evidence.map(e=>e.id===1?{...e,verified:false}:e)).stale,true));
