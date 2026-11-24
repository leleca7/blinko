// Pure, in-memory synthetic intake contract. Not the public intake API.
export type LabIntake = {id:string; company:string; stage:"partial"|"complete"; challenge?:string};
export type LabIntakeResult = {rows:LabIntake[]; status:"created"|"updated"|"duplicate"|"consent_required"|"contact_missing"|"conflict"|"invalid"};
export function syntheticIntake(rows:LabIntake[], input:{action:"start"|"complete";id:string;consent?:boolean;company?:string;challenge?:string}):LabIntakeResult {
  const done=(status:LabIntakeResult["status"],next=rows):LabIntakeResult=>({rows:next,status});
  if(!/^fixture-[0-9]+$/.test(input.id))return done("invalid");
  const existing=rows.find(row=>row.id===input.id);
  if(input.action==="start"){
    if(input.consent!==true)return done("consent_required");
    if(!input.company || !/^Empresa fictícia [A-Z]$/.test(input.company))return done("invalid");
    if(existing)return done(existing.company===input.company?"duplicate":"conflict");
    return done("created",[...rows,{id:input.id,company:input.company,stage:"partial"}]);
  }
  if(!existing)return done("contact_missing");
  if(!input.challenge || !["Organização comercial","Comunicação","Processos internos"].includes(input.challenge))return done("invalid");
  if(existing.stage==="complete")return done(existing.challenge===input.challenge?"duplicate":"conflict");
  return done("updated",rows.map(row=>row.id===input.id?{...row,stage:"complete",challenge:input.challenge}:row));
}
