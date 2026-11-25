// Test-only driver. Copied into a disposable CI checkout, never imported by deployed source.
// Match the two known synthetic connection labels; never connect to Neon or other external hosts.
import {Pool} from "pg";
const pools=new Map();
export function neon(url){
 if(process.env.GITHUB_ACTIONS!=="true"||process.env.BLINKO_CI_DISPOSABLE!=="yes")throw Error("CI only");
 const u=new URL(url);
 if(u.hostname!=="ep-old-art-bbztkcnw.c-15.us-east-1.aws.neon.tech"||u.pathname!=="/blinko_sandbox"||!["os_lab_runtime","os_lab_issuer"].includes(u.username)||u.password!=="synthetic-ci-only"||u.search!=="?sslmode=require")throw Error("unexpected test connection label");
 if(!pools.has(u.username))pools.set(u.username,new Pool({host:"127.0.0.1",port:5432,database:"blinko_sandbox",user:u.username,password:"synthetic-ci-only",max:4}));
 const pool=pools.get(u.username);
 const sql=(parts,...values)=>{
  const text=parts.map((p,i)=>i===0?p:"$"+i+p).join("");
  const query={text,values};
  // Lazily execute only when awaited or when used inside a transaction.
  return {query,then(resolve,reject){return pool.query(query).then(r=>r.rows).then(resolve,reject);}};
 };
 sql.transaction=async(queries)=>{
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   const rows=[];
   for(const q of queries)rows.push((await client.query(q.query)).rows);
   await client.query("COMMIT");
   return rows;
  }catch(e){await client.query("ROLLBACK");throw e;}
  finally{client.release();}
 };
 return sql;
}
