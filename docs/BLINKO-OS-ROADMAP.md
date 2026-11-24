# Blinko OS — roadmap de implementação (proposta de 24/11/2026)

Status: planejamento aprovado para desenvolvimento experimental; regras comerciais, financeiras e profissionais ainda sujeitas à validação das responsáveis. Não substitui a documentação histórica nem constitui autorização de lançamento.

## Fluxo de operação
Triagem gratuita → CRM → reunião inicial → proposta personalizada → contratação do diagnóstico → pesquisa e evidências → maturidade e criticidade → relatório e plano de ação → execução opcional e acompanhamento.

## Escopo e prioridades
| Módulo | Prioridade | Situação inicial |
|---|---|---|
| Visão geral e fila de atenção | P0 | Reutilizar painel existente |
| Autenticação, autorização e segurança | P0 | Revisar implementação existente; verificar sessões, papéis, permissões, auditoria |
| CRM, triagens e atendimento | P0 | Oportunidades, WhatsApp e empresas existentes; validar vínculo entre triagem e lead |
| Clientes, projetos e agenda | P1 | Inventariar funcionalidades; padronizar responsáveis, prazos e estados |
| Orçamentos | P1 | Protótipo de precificação por atividade, horas e custos; proposta individualizada |
| Diagnósticos e evidências | P1 | Estruturar entrevistas, fontes, hipóteses e validação humana |
| Radar Blinko | P1 | Definir critérios, escala 0–4, dados ausentes e cálculo de maturidade |
| Matriz de criticidade | P1 | Protótipo GUT (1–5); critérios e limiares provisórios |
| Documentos | P2 | Propostas, contratos, relatórios e plano de ação, com revisão humana |
| Financeiro | P2 | Receitas, custos, remuneração, margem e reserva; não fixar valores comerciais sem acordo |
| Automação e IA | P3 | Assistência à organização e geração de rascunhos, sem decisões autônomas |
| Portal do cliente | P3 | Acesso por organização, escopo e permissões específicas |

## Auditoria inicial (código)
- `app/interno/page.tsx`: exige sessão e lê fila de atenção existente.
- `app/interno/InternalTopbar.tsx`: navega por Hoje, Oportunidades, WhatsApp e Empresas.
- `lib/blinko/internal-auth.ts`: possui token de sessão com prazo de 8 horas e verificação; revisar papéis individuais, revogação e proteção de todas as rotas.
- `app/api/triagem/route.ts` na branch de apresentação: contém validações de origem, tamanho, consentimento e honeypot. A página pública usa modo demo e `proxy.ts` bloqueia APIs e rotas internas. Preservar esse isolamento.
- A direção operacional histórica em `docs/DIRECAO-OPERACIONAL-2027.md` permanece intacta; o presente roadmap é uma proposta de evolução orientada a diagnóstico.
- Não foram auditados dados reais, configuração de produção, banco, permissões ponta a ponta ou funcionamento de cada módulo.

## Fase 1: protótipo isolado
`/os-preview`: painel experimental sem conexão ao banco, dados exclusivamente fictícios, CRM com movimentação de etapas em memória, estimador de orçamento e matriz GUT. Não inserir dados reais. Recarregar a página restaura o estado. Nenhuma funcionalidade simulada deve ser apresentada como integração concluída.

## Critérios de aceite antes de captar leads reais
1. Definir responsável por dados, finalidade, consentimento, retenção e processo de direitos do titular.
2. Confirmar ambiente de teste com banco separado; revisar autorização no servidor, sessão, limites de requisições, deduplicação e trilha de auditoria.
3. Testar captura parcial/final, repetição de envio, falha de banco, consentimento e visibilidade no CRM com dados fictícios.
4. Revisar limites de atuação profissional e validação das ferramentas metodológicas.
5. Validar precificação, responsabilidades, propriedade e remuneração com as responsáveis; revisão contábil quando necessária.
6. Revisão técnica humana e aprovação explícita antes de ativar produção, credenciais, pagamentos ou coleta real.
7. Não misturar branch experimental e produção. Não registrar segredos ou dados reais no GitHub.

## Ordem de entrega
P0 segurança e integração em ambiente isolado; P1 projetos, estimador e ferramentas diagnósticas; P2 documentos/financeiro; P3 automações/portal após piloto e validação.

## Registro
Primeiro incremento: roadmap, protótipo visual e funções locais de orçamento/criticidade. Próximo incremento: testes de autorização e contrato de integração triagem → CRM em ambiente de teste. Não há execução autônoma após o encerramento da conversa.

## Incremento 02 — fluxo de diagnóstico (24/11/2026)
- Interface experimental mantém menu lateral e telas separadas.
- CRM: simulação explícita de contratação na etapa Diagnóstico; cria projeto independente sem duplicar o mesmo lead.
- Projetos: etapa do método, responsável e prazo.
- Evidências: pilar, fonte, fato observado/relato/hipótese e marcação de revisão humana simulada. Revisão não comprova relato; hipótese isolada não pontua.
- Radar: dez pilares provisórios (Estratégia, Administração, Pessoas, Financeiro, Comercial, Marketing, Marca, Relacionamentos, Experiência e Operação); nota explícita 0–4, evidência revisada do mesmo pilar, média somente dos avaliados e cobertura explícita. Instrumento ainda requer validação metodológica.
- Plano de ação: vinculação a evidência revisada, responsável, prazo, captura da pontuação GUT atual e conclusão; ordenação por prioridade. Revisão revogada invalida a nota e sinaliza ação.
- Todos os registros ficam em memória no navegador; não há persistência, autenticação nova, integração real, nem mudança no proxy. Não inserir dados de clientes.
- Testes de aceite manual: mover lead à etapa Diagnóstico, simular contratação, registrar e revisar fato fictício, selecionar evidência e nota, verificar média/cobertura, criar ação, alternar projetos e revogar revisão. Recarregar deve restaurar a demo.
- P0 continua pendente: banco isolado, contrato de integração, autorização e auditoria técnica. A implementação funcional em memória não encerra esses bloqueios.
