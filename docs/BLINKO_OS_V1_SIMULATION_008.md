# Blinko OS v1 — Simulação 008

Data: 09/09/2026
Branch GitHub: `feat/blinko-os-v1-audit`
PR: #25
Ambiente Neon: `blinko-os-v1-sim`

## Objetivo

Validar o pacote de continuidade após os gates de formalização/onboarding:

1. Contatos permanentes + Empresa 360;
2. catálogo oficial de soluções S01–S40;
3. vínculo Diagnóstico → Solução → Empresa → Projeto;
4. escolha de rota de execução R1–R6 apenas entre rotas permitidas;
5. validação adicional de viabilidade para solução em piloto/estruturação/sob consulta;
6. bloqueio de P14 enquanto rota e viabilidade não estiverem resolvidas.

Produção/main não recebeu estas migrações.

## Migrações envolvidas

- `028_contacts_company_360.sql`
- `029_contact_company_reuse.sql`
- `030_official_solution_catalog.sql`
- `031_project_solution_lifecycle_alignment.sql`
- `032_project_solution_gate_hardening.sql`
- `033_project_solution_route_control.sql`

## Pacote 06 — Contatos permanentes + Empresa 360

Status: **VALIDADO EM `blinko-os-v1-sim`**.

### Regras comprovadas

- Lead permanece como origem/entrada comercial.
- Contato é uma entidade permanente e pode existir sem Empresa quando o vínculo ainda não foi validado.
- Empresa não é fundida nem associada por coincidência de nome.
- O backfill criou um Contato para cada Lead existente.
- Leads com evidência relacional inequívoca herdaram a Empresa correta.
- Leads sem relação inequívoca permaneceram sem `company_id`.
- Uma Empresa pode ter vários Contatos, várias Oportunidades, Diagnósticos e Projetos.
- Novas Oportunidades herdam Contato + Empresa quando o Contato já está vinculado.
- Confirmar pagamento de novo Diagnóstico reutiliza a Empresa existente vinculada ao Contato.
- Teste de reutilização: total de Empresas permaneceu 4 antes e depois do pagamento do novo Diagnóstico fictício.
- Cadastro de Contato pela Empresa 360 não cria Lead artificial (`source_lead_id = null`).
- Mudanças humanas de vínculo/cadastro são registradas em `audit_events`.

### Interface

Implementado:

- Central de Contatos;
- revisão explícita de vínculo para Contatos sem Empresa;
- Empresa 360 com Contatos, Oportunidades, Diagnósticos, Projetos/ciclos e Sistemas conectados;
- cadastro de novo Contato diretamente na Empresa 360 sem duplicar Lead/Empresa.

## Pacote 07 — Catálogo oficial S01–S40

Fonte de autoridade: `04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS`, v1.0 de 09/09/2026.

Status: **CATÁLOGO E GATES VALIDADOS EM `blinko-os-v1-sim`**.

### Catálogo

- 40/40 códigos S01–S40 carregados sem duplicação.
- Rotas oficiais R1–R6 estruturadas por solução.
- Status, núcleo, problemas/gargalos, gatilhos, pré-requisitos, entregáveis e limites registrados.
- Nenhum preço, margem ou percentual de parceiro foi hardcodado no catálogo.
- `diagnostic_interventions.library_key` histórico foi convertido em vínculo real com `solution_blueprints` quando o código Sxx era válido.
- Cinco intervenções históricas da Simulação 001 (S08, S10, S30, S36 e S38) ganharam vínculo oficial.
- `company_solutions` preserva a solução já utilizada pela Empresa.
- `project_solutions` registra a solução efetivamente executada em cada Projeto.

### Integridade de histórico

O projeto histórico encerrado recebeu as soluções oficiais correspondentes, mas nenhuma rota de execução foi inventada retroativamente.

A tentativa de registrar rota em projeto já encerrado foi recusada.

### Rotas

- A rota escolhida no Projeto deve pertencer às rotas permitidas pela solução.
- Teste S08: tentativa de selecionar R3 foi recusada, pois S08 permite apenas R1.
- Módulos `solution_*_route` não podem ser concluídos pelo setter genérico de onboarding.
- A conclusão da rota passa exclusivamente pelo controle especializado `set_project_solution_route`.

### Viabilidade

Soluções com status oficial contendo piloto, estruturação ou sob consulta recebem módulo obrigatório de validação de viabilidade antes da operação.

Esse módulo não transforma condição experimental em regra comercial fixa; registra apenas a decisão contextual daquele Projeto.

## Simulação 008 — S10 / Implantação e organização de CRM

Empresa reutilizada: `Ateliê Horizonte Móveis — SIMULAÇÃO 001`.
Contato novo vinculado explicitamente à Empresa.
Solução: `S10 — IMPLANTAÇÃO / ORGANIZAÇÃO DE CRM`.
Status oficial: `PILOTO / SOB CONSULTA conforme ferramenta`.
Rotas permitidas: R1, R2 ou R4.

### Fluxo validado

1. novo Lead gerou Contato permanente sem associação por nome;
2. vínculo humano associou o Contato ao Ateliê;
3. nova Oportunidade herdou Contato + Empresa;
4. novo Diagnóstico reutilizou a mesma Empresa, sem criar duplicata;
5. problema/achado fictício foi validado no Diagnóstico;
6. intervenção S10 nasceu já vinculada ao `blueprint_id` oficial, sem rota pré-escolhida;
7. proposta foi criada e aceita;
8. oportunidade chegou a P10;
9. contrato válido levou o fluxo por P11→P12;
10. as 10 condições de início foram avaliadas explicitamente;
11. `commercial_start_readiness`: 0 aplicabilidades pendentes, 0 bloqueios e `ready_for_onboarding=true`;
12. projeto foi criado por `create_project_from_accepted_proposal` e entrou em P13;
13. o `contract_reference` textual legado foi ignorado e substituído pela referência do contrato válido;
14. S10 entrou no Projeto com `selected_route = null` e `route_status = to_define`;
15. onboarding criou `solution_s10_route` e `solution_s10_viability` como módulos obrigatórios;
16. todos os módulos gerais foram concluídos e restaram exatamente rota + viabilidade;
17. tentativa de ativar o Projeto nesse estado foi recusada com `BLOQUEADO PARA OPERAÇÃO`;
18. tentativa de selecionar R3 para S10 foi recusada: `execution route is not allowed for solution S10`;
19. R4 foi aceita e registrada; o módulo de rota passou a `done` com evidência auditável;
20. após R4, permaneceu exatamente um bloqueio: `solution_s10_viability`;
21. nova tentativa de ativação continuou recusada;
22. viabilidade foi validada com evidência contextual do fixture, sem criar regra fixa para cliente real;
23. `project_onboarding_readiness` passou para `ready_for_operation=true` com 0 pendências;
24. ativação foi aceita;
25. Projeto ficou `active`;
26. Oportunidade avançou P13→P14 e recebeu `outcome_status = won`;
27. `project_solution` terminou `active`, S10, rota R4 confirmada;
28. auditoria registrou criação do Projeto, tarefas, atualizações de onboarding, confirmação da rota e ativação final.

## Regressão encontrada e corrigida no CI

O primeiro HEAD do pacote falhou no TypeScript porque a rota:

`app/api/interno/projetos/[id]/solutions/[solutionId]/route/route.ts`

usava imports relativos com profundidade incorreta.

Correção: commit `b9c35368764e87bb2c77f49ea6eb26f7d0bccede`.

Validação desse commit:

- TypeScript: **success**;
- Next.js build: **success**;
- Vercel Preview: **success / Deployment has completed**.

## Resultado

Os pacotes **Contatos + Empresa 360** e **Catálogo S01–S40 + rota/viabilidade por Projeto** estão funcionalmente validados na branch de simulação.

A cadeia operacional comprovada agora é:

`Empresa → Contato → Oportunidade → Diagnóstico → Achado/Prioridade → Solução oficial → Proposta → Contrato → Condições de início → Projeto → Rota de execução → Viabilidade → Onboarding → P14/WON`.

## Segurança / promoção

- Neon main/produção não recebeu 028–033.
- PR #25 deve permanecer draft.
- Não promover migrações automaticamente.
- Antes de produção, revisar diff e backfill contra cópia/branch isolada do estado atual de produção.

## Próximo ponto de continuidade

Próxima frente oficial: **Change Request**.

Objetivo: diferenciar de forma auditável durante um Projeto:

1. correção/erro de execução;
2. ajuste incluído no escopo/revisões contratadas;
3. mudança de escopo com impacto comercial, prazo, custo ou nova aprovação.

Depois: parceiros gerais e regras validadas de repasse; indicadores; papéis/permissões; configurações versionadas; reavaliação/renovação/ciclos recorrentes.
