import { NextRequest, NextResponse } from "next/server";
import { LAB_COOKIE, verifyLabSession } from "../../../../lib/os-lab/session";
import { LabError, listLabProjects, listLabEvidence, createLabEvidence, reviewLabEvidence, listLabOperations, mutateLabOperation, listLabLeads, getLabDelivery, listLabQuotes } from "../../../../lib/os-lab/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status=200) {
  return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
function failure(error: unknown) {
  if (error instanceof LabError) return json({ok:false,error:error.code},error.status);
  return json({ok:false,error:"lab_request_failed"},500);
}
function enabled() {
  return process.env.BLINKO_OS_LAB_ENABLED==="true" && process.env.VERCEL_ENV!=="production";
}
async function readJson(request: NextRequest) {
  if (!request.body || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new LabError(400,"invalid_body");
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0, value="";
  try {
    while (true) {
      const {done,value:chunk}=await reader.read();
      if (done) break;
      size+=chunk.byteLength;
      if (size>4096) { await reader.cancel(); throw new LabError(413,"body_too_large"); }
      value+=decoder.decode(chunk,{stream:true});
    }
    return JSON.parse(value+decoder.decode());
  } catch(error) {
    if(error instanceof LabError) throw error;
    throw new LabError(400,"invalid_json");
  } finally { reader.releaseLock(); }
}

// Intentionally unreachable through the experimental proxy until review.
// No login issuance, public triage or production data access here.
export async function GET(request: NextRequest) {
  if (!enabled()) return json({ok:false,error:"lab_disabled"},404);
  try {
    const token=request.cookies.get(LAB_COOKIE)?.value;
    const projectId=request.nextUrl.searchParams.get("project");
    const scope=request.nextUrl.searchParams.get("scope");
    if(scope!==null && scope!=="operations" && scope!=="crm" && scope!=="delivery" && scope!=="quotes") throw new LabError(400,"invalid_scope");
    if((scope==="operations" || scope==="delivery") && projectId===null) throw new LabError(400,"invalid_project");
    if((scope==="crm" || scope==="quotes") && projectId!==null) throw new LabError(400,"invalid_scope");
    const data=scope==="quotes"?await listLabQuotes(token):scope==="delivery" && projectId!==null?await getLabDelivery(token,projectId):scope==="crm"?await listLabLeads(token):scope==="operations" && projectId!==null?await listLabOperations(token,projectId):projectId===null?await listLabProjects(token):await listLabEvidence(token,projectId);
    return json({ok:true,data});
  } catch(error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  if (!enabled()) return json({ok:false,error:"lab_disabled"},404);
  const origin=process.env.BLINKO_OS_LAB_ORIGIN;
  if (!origin || request.headers.get("origin")!==origin || request.nextUrl.origin!==origin) return json({ok:false,error:"origin_not_allowed"},403);
  try {
    const token=request.cookies.get(LAB_COOKIE)?.value;
    if(!verifyLabSession(token,process.env.BLINKO_OS_LAB_SESSION_SECRET??"")) throw new LabError(401,"session_required");
    const body=await readJson(request);
    const data=await createLabEvidence(token,body);
    return json({ok:true,data},201);
  } catch(error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  if (!enabled()) return json({ok:false,error:"lab_disabled"},404);
  const origin=process.env.BLINKO_OS_LAB_ORIGIN;
  if (!origin || request.headers.get("origin")!==origin || request.nextUrl.origin!==origin) return json({ok:false,error:"origin_not_allowed"},403);
  try {
    const token=request.cookies.get(LAB_COOKIE)?.value;
    if(!verifyLabSession(token,process.env.BLINKO_OS_LAB_SESSION_SECRET??"")) throw new LabError(401,"session_required");
    const body=await readJson(request);
    const data=await reviewLabEvidence(token,body);
    return json({ok:true,data});
  } catch(error) { return failure(error); }
}

export async function PUT(request: NextRequest) {
  if (!enabled()) return json({ok:false,error:"lab_disabled"},404);
  const origin=process.env.BLINKO_OS_LAB_ORIGIN;
  if (!origin || request.headers.get("origin")!==origin || request.nextUrl.origin!==origin) return json({ok:false,error:"origin_not_allowed"},403);
  try {
    const token=request.cookies.get(LAB_COOKIE)?.value;
    if(!verifyLabSession(token,process.env.BLINKO_OS_LAB_SESSION_SECRET??"")) throw new LabError(401,"session_required");
    const body=await readJson(request);
    const data=await mutateLabOperation(token,body);
    return json({ok:true,data});
  } catch(error) { return failure(error); }
}
