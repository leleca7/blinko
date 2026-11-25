import {NextRequest,NextResponse} from "next/server";
import {LAB_COOKIE} from "../../../../lib/os-lab/session";
import {redeemLabCode,endLabSession} from "../../../../lib/os-lab/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function json(data:unknown,status=200){
 return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
function enabled(){return process.env.BLINKO_OS_LAB_ENABLED==="true"&&process.env.VERCEL_ENV!=="production";}
function allowedOrigin(request:NextRequest){
 const origin=process.env.BLINKO_OS_LAB_ORIGIN;
 return !!origin&&origin.startsWith("https://")&&request.headers.get("origin")===origin&&request.nextUrl.origin===origin;
}
const options={httpOnly:true,secure:true,sameSite:"strict" as const,path:"/"};
export async function POST(request:NextRequest){
 if(!enabled())return json({ok:false,error:"lab_disabled"},404);
 if(!allowedOrigin(request))return json({ok:false,error:"origin_not_allowed"},403);
 if(!request.body||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")return json({ok:false,error:"invalid_body"},400);
 let body="";
 const reader=request.body.getReader();
 const decoder=new TextDecoder("utf-8",{fatal:true});
 let bytes=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>512){await reader.cancel();return json({ok:false,error:"body_too_large"},413);}body+=decoder.decode(value,{stream:true});}
  body+=decoder.decode();
 }catch{return json({ok:false,error:"invalid_body"},400);}
 finally{reader.releaseLock();}
 let input:unknown;
 try{input=JSON.parse(body);}catch{return json({ok:false,error:"invalid_body"},400);}
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==1||!("code" in input))return json({ok:false,error:"invalid_body"},400);
 try{
  const session=await redeemLabCode(input.code);
  if(!session)return json({ok:false,error:"invalid_access_code"},401);
  const result=json({ok:true});
  result.cookies.set(LAB_COOKIE,session.token,{...options,maxAge:session.maxAge});
  return result;
 }catch{return json({ok:false,error:"auth_unavailable"},503);}
}
export async function DELETE(request:NextRequest){
 if(!enabled())return json({ok:false,error:"lab_disabled"},404);
 if(!allowedOrigin(request))return json({ok:false,error:"origin_not_allowed"},403);
 try{
  await endLabSession(request.cookies.get(LAB_COOKIE)?.value);
  const result=json({ok:true});
  result.cookies.set(LAB_COOKIE,"",{...options,maxAge:0});
  return result;
 }catch{return json({ok:false,error:"logout_unconfirmed"},503);}
}
