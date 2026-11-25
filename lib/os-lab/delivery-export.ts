import type {LabDelivery} from "./client";
type Preview=NonNullable<LabDelivery["preview"]>;
// Serialize only the approved customer projection. Never consume an internal report draft.
export function clientDeliveryText(p:Preview):string{
 const lines=["BLINKO — PRÉVIA INTERNA DE ENTREGA","AMBIENTE EXPERIMENTAL — DADOS FICTÍCIOS", "",p.company,"Etapa: "+p.stage,"Prazo: "+(p.due??"Não definido"),"","Síntese",p.summary,"","Próxima etapa",p.nextStep];
 if(p.maturity)lines.push("","Maturidade: "+p.maturity.value+"%","Cobertura: "+p.maturity.coverage+"/10 pilares");
 if(p.actions.length){lines.push("","Plano de ação");for(const a of p.actions)lines.push("- "+a.title+" | "+a.due+" | "+(a.done?"Concluída":"Em aberto"));}
 lines.push("","Prévia autorizada no momento da consulta. Alterações posteriores podem invalidá-la. Não publicar nem enviar a clientes reais.");
 return lines.join("\n")+"\n";
}
