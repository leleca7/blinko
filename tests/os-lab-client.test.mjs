import test from 'node:test';
import assert from 'node:assert/strict';
import {createLabClient,LabClientError,labErrorMessage} from '../lib/os-lab/client.ts';
const id='00000000-0000-4000-8000-000000000041';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
test('client uses only same-origin endpoint, never exposes credentials in payload or retries',async()=>{
 const calls=[];
 const client=createLabClient(async(path,options)=>{calls.push({path,options});return json({ok:true,data:{changed:true}})});
 await client.mutate({type:'completion',id,done:true});
 assert.equal(calls.length,1);
 assert.equal(calls[0].path,'/api/os-lab/projects');
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.cache,'no-store');
 assert.equal(calls[0].options.redirect,'error');
 assert.deepEqual(JSON.parse(calls[0].options.body),{type:'completion',id,done:true});
 assert.equal(calls[0].options.headers.Authorization,undefined);
});
test('read paths reject invalid project identifiers without network request',async()=>{
 let calls=0;
 const client=createLabClient(async(path)=>{calls++;assert.equal(path,'/api/os-lab/projects?project='+id+'&scope=operations');return json({ok:true,data:{scores:[]}})});
 assert.throws(()=>client.operations('../other'),LabClientError);
 assert.deepEqual(await client.operations(id),{scores:[]});
 assert.equal(calls,1);
});
test('denied, malformed and failed responses are never presented as successful writes',async()=>{
 for(const [reply,status] of [[()=>json({ok:false,error:'operation_denied'},403),403],[()=>new Response('not json',{status:404}),404],[()=>json({ok:true}),200],[()=>{throw Error('network')},0]]){
  let calls=0;
  const client=createLabClient(async()=>{calls++;return reply()});
  await assert.rejects(client.mutate({type:'completion',id,done:true}),e=>e instanceof LabClientError&&e.status===status);
  assert.equal(calls,1);
 }
 assert.match(labErrorMessage(new LabClientError(401,'session_inactive')),/expirada/);
});
