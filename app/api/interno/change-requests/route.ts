import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../lib/blinko/internal-auth";
import {
  closeProjectChangeRequest,
  createProjectChangeRequest,
  decideProjectChangeRequest,
  isChangeRequestSchemaPending,
  recordChangeRequestTask,
  routeNewDemandChangeRequest,
  updateProjectChangeRequestAnalysis,
} from "../../../../lib/blinko/change-requests-server";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const classificationValues=new Set(["error_correction","in_scope_revision","scope_change","new_demand"]);
const requesterValues=new Set(["client","blinko","partner","internal","other"]);
const impactValues=new Set(["none","possible","confirmed"]);
const decisionValues=new Set(["approved","rejected","cancelled"]);
const routeValues=new Set(["strategic","transactional"]);
const priorityValues=new Set(["low","normal","high","critical"]);

function value(form:FormData,key:string,max=5000){return String(form.get(key)??"").trim().slice(0,max);}
function optionalUuid(raw:string){return uuidPattern.test(raw)?raw:null;}
function redirect(request:Request,projectId:string,status:string){return NextResponse.redirect(new URL(`/interno/projetos/${projectId}/alteracoes?status=${status}`,request.url),303);}

export async function POST(request:Request){
  const session=await getInternalSession();
  if(!session)return NextResponse.redirect(new URL("/interno/login",request.url),303);

  const form=await request.formData();
  const action=value(form,"action",80);
  const projectId=value(form,"project_id",80);
  if(!uuidPattern.test(projectId))return NextResponse.json({ok:false},{status:404});

  try{
    if(action==="create"){
      const classification=value(form,"classification",80);
      const requesterType=value(form,"requester_type",80);
      const deadlineImpactStatus=value(form,"deadline_impact_status",40)||"none";
      const financialImpactStatus=value(form,"financial_impact_status",40)||"none";
      const description=value(form,"description",8000);
      const requesterLabel=value(form,"requester_label",300);
      const decisionOwnerLabel=value(form,"decision_owner_label",300);
      if(!classificationValues.has(classification)||!requesterValues.has(requesterType)||!impactValues.has(deadlineImpactStatus)||!impactValues.has(financialImpactStatus)||!description||!requesterLabel||!decisionOwnerLabel){
        return redirect(request,projectId,"change_request_invalid");
      }
      await createProjectChangeRequest({
        projectId,
        projectSolutionId:optionalUuid(value(form,"project_solution_id",80)),
        requesterType,requesterLabel,description,classification,
        affectedDeliverableKey:value(form,"affected_deliverable_key",500),
        affectedVersionLabel:value(form,"affected_version_label",300),
        scopeReference:value(form,"scope_reference",1000),
        impactAnalysis:value(form,"impact_analysis",8000),
        deadlineImpactStatus,
        deadlineImpactDescription:value(form,"deadline_impact_description",5000),
        proposedNewDueAt:value(form,"proposed_new_due_at",80)||null,
        financialImpactStatus,
        financialImpactDescription:value(form,"financial_impact_description",5000),
        financialReference:value(form,"financial_reference",1000),
        decisionOwnerLabel,actorLabel:session.user,
      });
      return redirect(request,projectId,"change_request_created");
    }

    const changeRequestId=value(form,"change_request_id",80);
    if(!uuidPattern.test(changeRequestId))return redirect(request,projectId,"change_request_invalid");

    if(action==="analysis"){
      const deadlineImpactStatus=value(form,"deadline_impact_status",40)||"none";
      const financialImpactStatus=value(form,"financial_impact_status",40)||"none";
      const decisionOwnerLabel=value(form,"decision_owner_label",300);
      if(!impactValues.has(deadlineImpactStatus)||!impactValues.has(financialImpactStatus)||!decisionOwnerLabel)return redirect(request,projectId,"change_request_invalid");
      await updateProjectChangeRequestAnalysis({
        changeRequestId,
        impactAnalysis:value(form,"impact_analysis",8000),
        deadlineImpactStatus,deadlineImpactDescription:value(form,"deadline_impact_description",5000),
        proposedNewDueAt:value(form,"proposed_new_due_at",80)||null,
        financialImpactStatus,financialImpactDescription:value(form,"financial_impact_description",5000),
        financialReference:value(form,"financial_reference",1000),decisionOwnerLabel,actorLabel:session.user,
      });
      return redirect(request,projectId,"change_request_analysis_saved");
    }

    if(action==="decision"){
      const decision=value(form,"decision",40);
      if(!decisionValues.has(decision))return redirect(request,projectId,"change_request_invalid");
      await decideProjectChangeRequest({
        changeRequestId,decision,
        decisionNotes:value(form,"decision_notes",5000),
        approvalId:optionalUuid(value(form,"approval_id",80)),
        approvalEvidence:value(form,"approval_evidence",3000),actorLabel:session.user,
      });
      return redirect(request,projectId,"change_request_decided");
    }

    if(action==="route_new_demand"){
      const route=value(form,"commercial_route",40);
      const nextActionAt=value(form,"next_action_at",80);
      if(!routeValues.has(route)||!nextActionAt)return redirect(request,projectId,"change_request_invalid");
      const opportunityId=await routeNewDemandChangeRequest({changeRequestId,route,nextActionAt,actorLabel:session.user});
      return NextResponse.redirect(new URL(`/interno/comercial/${opportunityId}?status=from_change_request`,request.url),303);
    }

    if(action==="task"){
      const title=value(form,"title",300);
      const priority=value(form,"priority",40)||"normal";
      if(!title||!priorityValues.has(priority))return redirect(request,projectId,"change_request_invalid");
      await recordChangeRequestTask({
        changeRequestId,title,responsibleLabel:value(form,"responsible_label",300),
        dueAt:value(form,"due_at",80)||null,priority,estimate:value(form,"estimate",500),
        approvalRequired:value(form,"approval_required",20)==="yes",actorLabel:session.user,
      });
      return redirect(request,projectId,"change_request_task_created");
    }

    if(action==="close"){
      const implementationEvidence=value(form,"implementation_evidence",5000);
      if(!implementationEvidence)return redirect(request,projectId,"change_request_invalid");
      await closeProjectChangeRequest({changeRequestId,implementationEvidence,actorLabel:session.user});
      return redirect(request,projectId,"change_request_closed");
    }

    return redirect(request,projectId,"change_request_invalid");
  }catch(error){
    if(!isChangeRequestSchemaPending(error))console.error("Blinko OS: falha em Change Request",error);
    return redirect(request,projectId,isChangeRequestSchemaPending(error)?"change_request_schema_pending":"change_request_blocked");
  }
}
