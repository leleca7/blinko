import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyLabSession,validateEvidence,validateEvidenceReview,isSandboxConnection,signLabSession,accessCodeDigest,isIssuerConnection} from '../lib/os-lab/session.ts';
const key='synthetic-unit-test-key-not-a-credential-123';
const now=10000;
const actor='00000000-0000-4000-8000-000000000011';
const sid='00000000-0000-4000-8000-000000000081';
const project='00000000-0000-4000-8000-000000000041';
const token=(patch={})=>{const body=Buffer.from(JSON.stringify({aud:'blinko-os-sandbox',sub:actor,sid,iat:now-1,exp:now+60,...patch})).toString('base64url');return body+'.'+createHmac('sha256',key).update(body).digest('base64url')};
test('valid session yields verified actor and registered session ID',()=>assert.deepEqual(verifyLabSession(token(),key,now),{actorId:actor,sessionId:sid}));
test('absent, altered, extra segments, wrong key',()=>{for(const t of [undefined,token()+'x',token()+'.extra'])assert.equal(verifyLabSession(t,key,now),null);assert.equal(verifyLabSession(token(),key+'wrong',now),null);});
test('expired, future, excessive lifetime, wrong audience or invalid subject',()=>{for(const p of [{exp:now},{iat:now+1},{exp:now+4000},{aud:'production'},{sub:'admin'},{sid:undefined},{sid:'invalid'},{exp:'10060'}])assert.equal(verifyLabSession(token(p),key,now),null)});
test('rejects client-selected actor, org, review and invalid evidence',()=>{const valid={id:actor,projectId:project,pillar:2,kind:'fact',source:' Synthetic interview ',summary:' synthetic '};assert.equal(validateEvidence(valid).source,'Synthetic interview');assert.equal(validateEvidence(valid).summary,'synthetic');for(const p of [{actorId:actor},{orgId:actor},{reviewed:true},{pillar:10},{kind:'other'},{summary:' '},{summary:'a'.repeat(501)},{source:''},{source:'a'.repeat(201)},{id:'invalid'}])assert.equal(validateEvidence({...valid,...p}),null)});
test('database allowlist refuses production, owner role, wrong database, insecure connection',()=>{const base='postgresql://os_lab_runtime:fiction@ep-old-art-bbztkcnw.c-15.us-east-1.aws.neon.tech/blinko_sandbox?sslmode=require';assert.equal(isSandboxConnection(base),true);for(const s of [base.replace('old-art','other-host'),base.replace('os_lab_runtime','sandbox_owner'),base.replace('blinko_sandbox','neondb'),base.replace('require','disable')])assert.equal(isSandboxConnection(s),false)});

test('evidence review requires a reason and exact command scope',()=>{
 const good={evidenceId:project,reviewed:true,reason:' Synthetic review '};
 assert.deepEqual(validateEvidenceReview(good),{...good,reason:'Synthetic review'});
 assert.equal(validateEvidenceReview({...good,reviewed:false}).reviewed,false);
 for(const patch of [{reviewed:'true'},{reason:' '},{reason:'a'.repeat(501)},{actorId:actor},{orgId:actor},{evidenceId:'invalid'}]) assert.equal(validateEvidenceReview({...good,...patch}),null);
});

test('sandbox connection rejects extra and duplicate connection parameters',()=>{
 const base='postgresql://os_lab_runtime:fiction@ep-old-art-bbztkcnw.c-15.us-east-1.aws.neon.tech/blinko_sandbox?sslmode=require';
 assert.equal(isSandboxConnection(base),true);
 for(const suffix of ['&sslmode=disable','&sslmode=require','&host=other.example','&options=test','&port=5433'])assert.equal(isSandboxConnection(base+suffix),false);
});

test('issuer and runtime URLs are distinct; code digest accepts only canonical high-entropy code shape',()=>{
 const base='postgresql://os_lab_runtime:fiction@ep-old-art-bbztkcnw.c-15.us-east-1.aws.neon.tech/blinko_sandbox?sslmode=require';
 const issuer=base.replace('os_lab_runtime','os_lab_issuer');
 assert.equal(isIssuerConnection(issuer),true);
 assert.equal(isIssuerConnection(base),false);
 assert.equal(isSandboxConnection(issuer),false);
 assert.equal(isIssuerConnection(issuer+'&sslmode=disable'),false);
 const sample='ab'.repeat(32);
 assert.match(accessCodeDigest(sample),/^[a-f0-9]{64}$/);
 assert.notEqual(accessCodeDigest(sample),sample);
 for(const value of [null,'a'.repeat(63),'z'.repeat(64),'A'.repeat(64),sample+' '])assert.equal(accessCodeDigest(value),null);
});
test('session signer accepts only valid bounded registered claims',()=>{
 const signed=signLabSession(actor,sid,now-1,now+60,key,now);
 assert.deepEqual(verifyLabSession(signed,key,now),{actorId:actor,sessionId:sid});
 for(const [a,s,i,e,k] of [['bad',sid,now-1,now+60,key],[actor,'bad',now-1,now+60,key],[actor,sid,now+1,now+60,key],[actor,sid,now-1,now+4000,key],[actor,sid,now-1,now,key],[actor,sid,now-1,now+60,'short']])assert.equal(signLabSession(a,s,i,e,k,now),null);
});
