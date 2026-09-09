# BLINKO OS v1 — HANDOFF COMPLETO DA CONVERSA E CONTINUIDADE

Data do handoff: 09/09/2026
Repositório: `leleca7/blinko`
Branch de trabalho: `feat/blinko-os-v1-audit`
PR principal: #25 — **Blinko OS v1: auditoria + evolução inicial da tela Hoje**
Ambiente Neon de simulação: `blinko-os-v1-sim`
Produção/Neon main: **NÃO deve receber migrações sem promoção controlada e nova validação.**

---

## 0. Para que este arquivo existe

Este documento foi criado para permitir encerrar a conversa atual sem perder contexto. Ele consolida:

- a definição da Blinko;
- as decisões de negócio e de arquitetura tomadas ao longo da conversa;
- os documentos oficiais usados como fonte funcional;
- a estrutura desejada do sistema;
- tudo que foi implementado no GitHub nesta branch;
- tudo que foi aplicado e testado apenas no Neon de simulação;
- as simulações feitas;
- os defeitos encontrados e corrigidos;
- os módulos já utilizáveis;
- o que ainda está incompleto;
- riscos que não podem ser esquecidos;
- regras de continuidade;
- o ponto exato de retomada.

Este arquivo deve funcionar como **handoff técnico, funcional e estratégico** para a próxima conversa.

---

# 1. O que é a Blinko

A Blinko **não deve ser tratada como uma agência de social media**.

A definição consolidada ao longo da estruturação foi:

> **A Blinko diagnostica empresas, identifica falhas e gargalos e estrutura as soluções necessárias para fazê-las funcionar, se posicionar e crescer melhor.**

Versão curta usada como posicionamento:

> **Diagnóstico, estrutura e execução para negócios que precisam funcionar melhor.**

A lógica central é:

**DIAGNOSTICAR → PRIORIZAR → ESTRUTURAR → EXECUTAR → MEDIR → MELHORAR**

A regra metodológica mais importante é:

> **NÃO PRESCREVER ANTES DE DIAGNOSTICAR.**

Soluções são consequência do diagnóstico. Não são a identidade da Blinko.

A Blinko pode:

1. executar diretamente;
2. executar e coordenar terceiros;
3. coordenar parceiro;
4. orientar o cliente a executar;
5. encaminhar para especialista externo;
6. apenas monitorar quando ainda não é hora de intervir.

---

# 2. Objetivo do Blinko OS

O sistema nasceu porque a Blinko precisa operar com pouca dependência de memória, WhatsApp solto, pastas soltas e trabalho manual repetitivo.

O objetivo não é criar apenas um CRM ou um gerenciador de tarefas.

O objetivo é criar um **sistema operacional da Blinko** capaz de acompanhar a empresa cliente do primeiro contato até diagnóstico, intervenção, operação, financeiro, entrega, encerramento, reavaliação e futura renovação.

A cadeia conceitual que o sistema deve representar é:

**Empresa → Diagnóstico → Gargalos → Prioridades → Soluções → Projeto → Tarefas → Arquivos → Financeiro → Indicadores**

E, comercialmente:

**Contato → Lead → Oportunidade → Proposta → Cliente → Projeto**

Regra importante consolidada depois:

- **Lead não é oportunidade.**
- **Lead é a entrada/pessoa/origem comercial.**
- **Oportunidade é o negócio comercial em si.**
- **Empresa é o cadastro permanente.**
- Uma mesma empresa pode ter várias oportunidades e vários projetos ao longo do tempo.
- Não duplicar empresa/cliente apenas porque surgiu uma nova demanda.

---

# 3. Princípios de implantação que não devem ser quebrados

A ordem de evolução definida foi:

**FAZER MANUALMENTE → ENTENDER → PADRONIZAR → TESTAR → AUTOMATIZAR**

Não pular direto para automação de algo que ainda não foi compreendido operacionalmente.

Outros princípios:

- Drive é **repositório de arquivos**, não o banco operacional principal.
- O sistema é a interface de status, entidades, relacionamentos, tarefas, aprovações, financeiro e regras.
- O usuário não deve precisar navegar manualmente por dezenas de pastas para operar o negócio.
- Arquivo deve poder ser enviado pelo sistema, receber nome padrão e ser roteado para o Drive.
- Informação registrada uma vez deve ser reaproveitada em diagnóstico, proposta, contrato, briefing, projeto e relatórios.
- IA deve ser **opcional**, nunca requisito para a V1 funcionar.
- O sistema precisa continuar funcionando com regras determinísticas sem IA paga.
- A IA pode apoiar análise, mas não deve validar automaticamente causas, estratégia ou decisões críticas sem revisão humana.
- Decisões importantes devem gerar auditoria.
- Nenhum trabalho crítico deve existir apenas no WhatsApp ou na memória.

---

# 4. Cliente Zero e piloto

Definido na conversa:

- **Blinko = Cliente Zero**
- **Pint Services = Piloto 01 externo**

A Blinko deve primeiro usar o próprio sistema para provar campos, fluxos, automações, tarefas, arquivos, status, indicadores e regras.

Depois a Pint Services serve como primeiro caso externo real/piloto.

A Pint Services não é a Blinko; é outra empresa que está sendo organizada pela Blinko.

---

# 5. Documentação oficial da Blinko

Foi construída uma arquitetura documental pequena, com documentos oficiais em vez de dezenas de arquivos conflitantes.

Árvore oficial:

- `00 — BLINKO — MAPA MESTRE`
- `01 — BLINKO — MARCA E ESTRATÉGIA`
- `02 — BLINKO — MÉTODO BLINKO`
- `03 — BLINKO — DIAGNÓSTICO BLINKO`
- `04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS`
- `05 — BLINKO — COMERCIAL E JORNADA DO CLIENTE`
- `06 — BLINKO — OPERAÇÃO E QUALIDADE`
- `07 — BLINKO — FINANCEIRO E INDICADORES`
- `08 — BLINKO — SISTEMA E AUTOMAÇÃO`

O GitHub/OS passou a usar essa documentação como fonte funcional.

No código e auditoria atual:

- Documento 03 governa o diagnóstico oficial estruturado;
- Documento 05 governa o comercial P00–P14;
- Documento 06 governa operação, tarefas, QA, aprovação e encerramento;
- Documento 07 governa financeiro e indicadores;
- Documento 08 v1.0 é a fonte funcional principal da arquitetura do Blinko OS.

Regra documental:

- uma fonte de verdade por assunto;
- não criar “final 2”, “novo final”, etc.;
- documento antigo que conflita com oficial deve ser migrado/arquivado;
- materiais FRAME/social-media antigos são legado/referência, não autoridade atual.

---

# 6. Método Blinko — estrutura que o sistema precisa respeitar

Ciclo oficial:

**DIAGNOSTICAR → PRIORIZAR → ESTRUTURAR → EXECUTAR → MEDIR → MELHORAR**

10 pilares oficiais:

1. Fundamentos
2. Marca
3. Oferta
4. Comercial
5. Marketing
6. Cliente
7. Operação
8. Financeiro
9. Tecnologia
10. Gestão

Maturidade por item:

- 0 — inexistente
- 1 — improvisado
- 2 — básico
- 3 — estruturado
- 4 — otimizado
- NV — não verificado
- N/A — não aplicável

Regras do diagnóstico:

- N/A sai do denominador;
- NV não entra na pontuação, mas reduz completude;
- se mais de 20% dos itens aplicáveis de um pilar estiverem NV, o pilar é **INCONCLUSIVO**;
- índice de maturidade = `soma dos scores ÷ (itens avaliados × 4) × 100`.

Faixas:

- 0–24: Frágil
- 25–49: Básica
- 50–74: Em Estruturação
- 75–89: Estruturada
- 90–100: Otimizada

Tipos de achado:

- Força
- Lacuna
- Gargalo
- Risco
- Oportunidade
- Inconsistência

ICB:

**ICB = Impacto × Urgência × Risco/Tendência**

Cada componente: 1–5.

Faixas:

- 1–15: baixa
- 16–39: média
- 40–79: alta
- 80–125: crítica

Dependência:

- D0–D3

Esforço:

- E1–E5

Esforço nunca reduz a criticidade de um problema; serve para planejamento da intervenção.

---

# 7. Catálogo de soluções

O Documento 04 definiu 40 soluções oficiais S01–S40, distribuídas entre:

- diagnóstico/fundamentos/estratégia;
- marca;
- comercial;
- marketing/presença;
- audiovisual;
- design/produção gráfica;
- experiência do cliente;
- operação/processos;
- tecnologia/sistemas;
- gestão.

Rotas de execução:

- R1 — Blinko executa
- R2 — Blinko executa e coordena terceiros
- R3 — parceiro coordenado pela Blinko
- R4 — cliente executa com orientação
- R5 — especialista externo/encaminhamento
- R6 — monitoramento

Regra crítica:

> **Solução é consequência do diagnóstico, não ponto de partida da venda.**

O módulo de soluções no OS ainda precisa ser sincronizado integralmente com S01–S40 e seus pré-requisitos/status.

---

# 8. Parceiros — regra que não pode ser esquecida

A conversa tratou principalmente de parceria gráfica e audiovisual.

Pontos definidos:

- parceiro gráfico em validação/piloto;
- parceiro audiovisual ainda precisa de cadastro/condições formais;
- custos, disponibilidade e escopo devem ser validados antes da execução;
- entrega de parceiro coordenado pela Blinko passa por QA interno antes de ir ao cliente;
- erro de parceiro não deve ser simplesmente encaminhado ao cliente sem revisão;
- o sistema deve registrar prazo, custo, qualidade, revisão, incidente e histórico do parceiro.

**Muito importante:** houve conversa antiga sobre “50%” na parceria gráfica, mas a base de cálculo nunca ficou oficialmente fechada. Portanto:

> **NÃO hardcodar 50% como margem, comissão ou participação oficial da Blinko.**

A auditoria encontrou uma regra antiga de 50% em módulo gráfico experimental. Isso **não pode virar padrão do núcleo financeiro** antes de validação formal no Documento 07/regras de parceiro.

---

# 9. Jornada comercial oficial

Existem duas rotas comerciais.

## 9.1 Rota estratégica

Usar quando a demanda é ampla, sintomática, estrutural, multiárea ou há risco de vender a solução errada.

Fluxo:

**Contato → Qualificação → Diagnóstico/Triagem → Leitura → Prioridades → Solução → Proposta → Formalização → Onboarding → Operação**

## 9.2 Rota transacional

Usar quando a demanda é objetiva e delimitada, por exemplo:

- impressão com arte pronta;
- adaptação técnica simples;
- peça gráfica isolada;
- serviço de catálogo claro.

Fluxo:

**Contato → Qualificação mínima → Brief técnico → Orçamento/Proposta → Aprovação → Formalização necessária → Operação**

A rota transacional não pode ser usada para fugir de um diagnóstico quando existem sinais estruturais.

---

# 10. Pipeline comercial P00–P14

O pipeline oficial implementado nesta conversa é:

- P00 — IDENTIFICADO
- P01 — CONTATO PENDENTE
- P02 — CONTATADO
- P03 — EM QUALIFICAÇÃO
- P04 — OPORTUNIDADE QUALIFICADA
- P05 — DIAGNÓSTICO / TRIAGEM
- P06 — RECOMENDAÇÃO / SOLUÇÃO DEFINIDA
- P07 — PROPOSTA EM PREPARAÇÃO
- P08 — PROPOSTA ENVIADA
- P09 — NEGOCIAÇÃO / AJUSTES
- P10 — APROVADA COMERCIALMENTE
- P11 — FORMALIZAÇÃO PENDENTE
- P12 — PAGAMENTO / CONDIÇÃO DE INÍCIO PENDENTE
- P13 — ONBOARDING
- P14 — PRONTO PARA OPERAÇÃO

Resultados/saídas:

- GANHO
- PERDIDO
- NUTRIÇÃO
- DESQUALIFICADO
- PAUSADO
- SEM RESPOSTA

Regra central do Documento 05 e agora do banco:

> **Nenhuma oportunidade ativa pode ficar sem status, responsável, próxima ação e data de acompanhamento.**

Na implementação nova, oportunidades P01–P13 exigem:

- `owner_label`;
- `next_action_title`;
- `next_action_at`.

Teste realizado na simulação:

- tentar mover uma oportunidade ativa sem próxima ação/data foi **recusado pelo banco**, como esperado.

Perda:

- resultado `lost` exige motivo de perda.
- tentativa sem motivo foi tratada como caso inválido e a função foi endurecida para não depender apenas da constraint.

---

# 11. Próxima ação como fonte oficial

Antes desta conversa, o fluxo comercial dependia principalmente de `crm_actions`.

Decisão tomada:

- `crm_actions` continua servindo para ações específicas de workflow;
- a **próxima ação comercial oficial** passa a morar na **Oportunidade**;
- a tela `Hoje` deve usar a próxima ação da oportunidade para responder “o que fazer nesta venda?”;
- quando existe oportunidade oficial, não mostrar a ação CRM espelhada como segunda pendência duplicada.

---

# 12. Arquitetura tecnológica atual

A ideia inicial chegou a considerar Supabase, mas a implementação real evoluiu para:

- **Next.js / App Router** — aplicação;
- **PostgreSQL / Neon** — banco;
- **Vercel** — deploy/Preview;
- **GitHub** — versionamento, PR e CI;
- **Google Drive** — arquivos/repositório;
- autenticação interna atual por credencial única de ambiente + cookie assinado.

IA:

- provider existe, mas pode ficar desligado;
- análise manual precisa continuar disponível;
- Cliente Fictício 001 percorreu o diagnóstico sem necessidade de IA paga.

Limitação conhecida:

- autenticação interna única ainda é insuficiente para usuários individuais, papéis e menor privilégio;
- módulo de permissões continua pendente.

---

# 13. Estado da PR #25 no momento deste handoff

PR: #25

- estado: aberta;
- draft: sim;
- base: `main`;
- head: `feat/blinko-os-v1-audit`;
- mergeable: sim;
- aproximadamente 50 commits antes da criação deste handoff;
- 36 arquivos alterados antes da criação deste handoff;
- código da branch foi validado diversas vezes por CI e Preview.

No HEAD imediatamente anterior a este handoff (`05863a0...`):

- GitHub CI `validate`: **success**;
- Vercel Preview check: **success/READY**.

A criação deste arquivo gera um novo commit e novo ciclo de checks.

---

# 14. Regra de segurança entre produção e simulação

Foi criada uma branch Neon permanente:

`blinko-os-v1-sim`

Objetivo:

- empresas fictícias;
- testes ponta a ponta;
- evolução de schema;
- simulação de regras;
- validação antes de promoção.

Regra mantida durante toda a conversa:

> **Não aplicar automaticamente as migrações experimentais na main/produção.**

Produção/main continuou intacta durante os ciclos de 012–020 e a evolução posterior foi testada primeiro na simulação.

Para promoção futura:

1. revisar migração versionada;
2. preparar migration em branch temporária quando possível;
3. testar regras e dados;
4. comparar schema;
5. verificar CI/Preview;
6. obter decisão humana para promover;
7. aplicar à main somente depois disso.

Nunca colocar `DATABASE_URL`, senha ou connection string em código, commit, comentário ou documentação.

---

# 15. Tela “Hoje” — evolução realizada

A auditoria inicial encontrou a tela Hoje muito limitada ao CRM.

Ela foi evoluída para consolidar operação.

Grupos oficiais:

- **Preciso fazer**
- **Aguardando cliente**
- **Aguardando parceiro**
- **Bloqueado**

Fontes que a fila passou a considerar ao longo da conversa:

- CRM;
- tarefas de projeto;
- aprovações;
- financeiro/recebíveis;
- projetos aptos a encerramento;
- oportunidade comercial/próxima ação oficial.

A tela precisa responder:

- o que preciso fazer agora?
- o que está vencido?
- o que está aguardando cliente?
- o que está aguardando parceiro?
- o que está bloqueado?
- qual próxima ação comercial?
- qual próxima ação financeira?

Fallbacks foram mantidos para ambientes onde schemas novos ainda não existem.

---

# 16. Migração 012 — estados operacionais de tarefa

Arquivo:

`neon/sql/012_project_task_states.sql`

Implementado/testado:

- `waiting_partner`;
- `blocked`;
- `dependency_note`;
- `blocking_reason`;
- `blocking_owner_label`;
- `blocking_impact`;
- `next_check_at`;
- `completed_at`;
- função auditada de atualização de estado.

Testes realizados:

1. waiting_partner sem dependência → recusado;
2. waiting_partner com dependência + próxima checagem → aceito;
3. blocked sem responsável pelo desbloqueio → recusado;
4. blocked com motivo + responsável + impacto + próxima checagem → aceito;
5. done sem evidência → recusado;
6. done com evidência → aceito;
7. eventos válidos entram em auditoria.

---

# 17. Migração 013 — ações CRM concluídas

Arquivo:

`neon/sql/013_close_completed_crm_review_actions.sql`

Defeito encontrado durante Cliente 001:

- `review_pre_diagnostic` permanecia pending mesmo após revisão humana;
- `review_initial_reading` permanecia pending mesmo após aprovação/envio.

Correção:

- fechar as ações quando o fato correspondente é concluído;
- backfill para históricos já concluídos;
- manter auditoria/idempotência.

Ao final da Simulação 001, ações CRM abertas = 0.

---

# 18. Drive e arquivos — migração 014

Arquivo:

`neon/sql/014_drive_approvals.sql`

Na simulação foi criada estrutura real de pastas no Google Drive dentro de:

`BLINKO/05 - CLIENTES`

Estrutura de projeto usada:

- Escopo / Briefing
- Insumos
- Produção
- Revisão / Aprovações
- Entregas
- Evidências
- Parceiros

Pastas principais foram registradas no banco via `drive_items`, ligadas a empresa/projeto.

Princípio futuro:

- sistema deve criar/rotear arquivos;
- Drive guarda bytes/arquivos;
- banco guarda relacionamento, tipo, status, contexto e versão lógica.

Ainda falta evoluir o módulo geral de arquivos para ficar totalmente operacional em todos os fluxos.

---

# 19. Aprovações — migrações 014 e 015

Foi criada estrutura geral de aprovação.

Defeito importante encontrado:

> tarefa com `approval_required=true` conseguia ser marcada como concluída mesmo com aprovação pendente.

Correção:

`neon/sql/015_task_requires_approved_approval.sql`

Reteste:

- conclusão antes da aprovação → bloqueada;
- aprovação `approved` → tarefa pôde concluir.

Regra conceitual de revisão discutida:

- **ERRO/CORREÇÃO** = desvio do briefing/especificação; não deve consumir revisão do cliente;
- **AJUSTE INCLUSO** = refinamento dentro do escopo/revisões;
- **MUDANÇA DE ESCOPO** = altera objetivo/brief/deliverável e deve retornar ao comercial.

Essa classificação ainda deve ser aprofundada no núcleo de mudanças de escopo.

---

# 20. Financeiro — migração 016

Arquivo:

`neon/sql/016_finance_core.sql`

Criado núcleo financeiro geral para projeto.

Na Simulação 001, inicialmente:

- receita contratada: R$ 4.800;
- custos planejados: R$ 2.600;
- contribuição projetada: R$ 2.200;
- margem projetada: 45,83%;
- recebíveis abertos inicialmente: R$ 4.800.

Isso deixou de depender do módulo gráfico específico.

---

# 21. Financeiro — migração 017

Arquivo:

`neon/sql/017_finance_lifecycle.sql`

Defeito/regra corrigida:

> custo interno deve afetar rentabilidade, mas não necessariamente gerar saída de caixa.

Após fechamento da Simulação 001:

- receita: R$ 4.800;
- custo realizado: R$ 2.600;
- contribuição realizada: R$ 2.200;
- margem realizada: 45,83%;
- recebíveis abertos: R$ 0;
- custos abertos: R$ 0.

Regra de parceiro continua pendente de validação; não usar 50% como padrão.

---

# 22. Encerramento de projeto — migração 018

Arquivo:

`neon/sql/018_project_closure.sql`

Encerramento não pode significar simplesmente “marcou closed”.

A simulação validou um gate com requisitos de:

- tarefas concluídas;
- aprovações resolvidas;
- evidências;
- financeiro coerente;
- resumo de encerramento;
- aprendizados.

Foram adicionadas rotas/tela para:

- preparar encerramento;
- confirmar encerramento.

Ao final do Cliente 001:

- projeto: closed;
- tarefas: 5/5 done;
- aprovações: 3/3 approved;
- ações CRM abertas: 0.

---

# 23. Diagnóstico oficial estruturado — migração 019

Arquivo:

`neon/sql/019_diagnostic_structured_scoring.sql`

Criado núcleo normalizado para:

- catálogo de pilares;
- catálogo de itens;
- respostas por item;
- evidência por item;
- confiança;
- achados;
- ICB;
- dependência;
- esforço;
- scores por pilar;
- score geral;
- flags de qualidade;
- rastreabilidade.

Tabelas/estruturas importantes:

- `diagnostic_pillars_catalog`
- `diagnostic_items_catalog`
- `diagnostic_item_responses`
- `diagnostic_item_evidence`
- `diagnostic_findings`

Views/funções incluem:

- `diagnostic_pillar_scores`
- `diagnostic_overall_scores`
- `diagnostic_quality_flags`
- `diagnostic_findings_scored`
- inicialização estruturada;
- upsert da resposta;
- inclusão de evidência;
- registro de achado.

---

# 24. Catálogo oficial de 114 itens — migração 020

Arquivo:

`neon/sql/020_diagnostic_catalog_v1.sql`

Foi cadastrado o diagnóstico oficial do Documento 03:

- 10 pilares;
- 114 itens.

Testes matemáticos realizados na branch Neon de simulação:

- 20% NV → pilar permanece válido;
- mais de 20% NV → pilar inconclusivo;
- N/A sai do denominador.

---

# 25. Rastreabilidade do Cliente 001 — C07

Foi escolhida uma cadeia real para provar a ligação do método com o banco.

Item:

`C07`

Situação encontrada:

- o problema comercial antigo já existia;
- o item oficial ainda estava NV;
- foi corrigido para score 0 (inexistente) com evidência.

Cadeia validada:

**C07 = 0 → Evidência A / confiança alta → Gargalo → ICB 100 / Crítico → Prioridade #1 → Implantação e organização de CRM**

Isso provou que o diagnóstico não fica apenas como questionário: o sistema consegue ligar item, evidência, achado, criticidade, prioridade e intervenção.

IDs úteis da simulação 001, caso seja necessário continuar consultas técnicas:

- diagnostic_id: `5df33105-7448-42e1-a1e4-e406b72a78b3`
- collection_version_id: `038886e3-d70c-4731-aef0-1c070e57409a`
- C07 response_id: `a9ad14a5-1cf6-4d51-8e4c-8db5c2ef242a`
- finding_id: `07058722-6edd-4d52-aed6-1de8ed9dffdb`
- priority_id: `2327ab63-0d01-4279-b552-35b62f95213a`
- intervention_id: `ae0afae4-df73-4edd-8e9f-e540f7956d50`

Todos são dados de simulação fictícia.

---

# 26. Interface do diagnóstico oficial

Arquivos adicionados/evoluídos:

- `lib/blinko/diagnostic-structured-server.ts`
- `app/interno/diagnosticos/[id]/DiagnosticStructuredSection.tsx`
- `app/api/interno/diagnosticos/[id]/structured-init/route.ts`
- `app/api/interno/diagnosticos/[id]/structured-item/route.ts`
- `app/interno/diagnosticos/[id]/page.tsx`
- `lib/blinko/diagnostic-collection-server.ts`

A tela passou a oferecer:

- resumo geral;
- maturidade/completude;
- 10 pilares colapsáveis;
- 114 itens;
- notas 0–4;
- NV;
- N/A;
- contexto/nota do consultor;
- evidência opcional;
- classe de evidência;
- confiança;
- alertas de qualidade;
- achados.

A coleta narrativa antiga de 7 blocos **não foi destruída**.

Ela permanece como compatibilidade/fallback durante transição.

Novas versões de coleta tentam inicializar os 114 itens em NV automaticamente quando o schema estruturado existe.

Se 019–020 não estiverem no ambiente, o fluxo antigo continua sem quebrar.

---

# 27. Issue #27

Issue criada:

**Blinko OS v1 — Estruturar diagnóstico oficial (114 itens, maturidade, completude e ICB)**

A implementação correspondente foi concluída na branch de validação e testada na simulação.

A issue pode continuar aberta até ocorrer decisão de promoção/aceitação em main.

Não considerar “produção pronta” apenas porque a implementação da branch passou nos testes.

---

# 28. Comercial oficial — migração 021

Arquivo:

`neon/sql/021_commercial_opportunities.sql`

Decisão arquitetural principal:

> Lead não será transformado no funil. Foi criada a entidade `commercial_opportunities`.

Ela liga:

- lead;
- empresa quando existir;
- pré-diagnóstico;
- diagnóstico;
- proposta;
- projeto indiretamente pelas relações;
- rota;
- etapa P00–P14;
- fit;
- necessidade;
- responsável;
- próxima ação;
- data da próxima ação;
- interação;
- valor estimado;
- forecast;
- resultado;
- motivo de perda.

Eventos ficam em:

`commercial_opportunity_events`

Funções criadas incluem:

- criar oportunidade;
- mudar etapa;
- registrar interação;
- encerrar oportunidade;
- sincronizar oportunidade a partir de eventos do diagnóstico/proposta/projeto.

Regra crítica no banco:

- oportunidade ativa não pode ficar sem owner + next action + date.

---

# 29. Backfill e views comerciais — migração 022

Arquivo:

`neon/sql/022_commercial_backfill_views.sql`

Foi separado do 021 para evitar que histórico inconsistente quebre a criação do núcleo.

Objetivos:

- migrar registros históricos;
- ligar oportunidades a diagnósticos/propostas existentes;
- criar views de pipeline/forecast;
- manter regra de perda com motivo.

Na branch de simulação o backfill encontrou duas oportunidades históricas relevantes:

1. uma oportunidade ainda ativa em P04;
2. Cliente Fictício 001 em P14 / GANHO.

Cliente 001 após backfill:

- pipeline: P14;
- outcome: won;
- valor associado: R$ 4.800;
- projeto: closed.

---

# 30. Sincronização do pré-diagnóstico comercial — migração 023

Arquivo:

`neon/sql/023_commercial_prediagnostic_sync.sql`

Objetivo:

- fazer etapas iniciais P01→P04 acompanharem fatos reais do pré-diagnóstico/revisão humana/leitura inicial;
- evitar atualização manual do pipeline quando o próprio sistema já conhece o fato que ocorreu.

**Estado exato no momento do handoff:**

- arquivo 023 está versionado no GitHub;
- o commit que o adicionou passou em CI/Preview;
- ele ainda deve ser **aplicado e testado explicitamente na branch Neon `blinko-os-v1-sim`** antes de ser considerado validado no banco.

Esta é uma das primeiras ações da próxima conversa.

---

# 31. Tela Comercial

Foi criada navegação interna:

**Hoje | Comercial | Empresas**

Rotas novas:

- `/interno/comercial`
- `/interno/comercial/[id]`

Arquivos principais:

- `app/interno/comercial/page.tsx`
- `app/interno/comercial/[id]/page.tsx`
- `lib/blinko/commercial-server.ts`
- `app/api/interno/comercial/[id]/stage/route.ts`
- `app/api/interno/comercial/[id]/interaction/route.ts`
- `app/api/interno/comercial/[id]/close/route.ts`

A tela oferece:

- visão do pipeline P00–P14;
- oportunidades ativas;
- próximas ações;
- oportunidades vencidas/atrasadas;
- oportunidades ganhas;
- valor estimado/forecast conforme dados disponíveis.

No detalhe da oportunidade é possível:

- mudar etapa;
- definir responsável;
- definir próxima ação;
- definir data;
- registrar interação;
- registrar follow-up;
- encerrar;
- informar motivo de perda;
- consultar histórico de eventos.

---

# 32. Comercial dentro da tela Hoje

`lib/blinko/internal-queue.ts`, `lib/blinko/today-server.ts` e `app/interno/page.tsx` foram evoluídos.

Regra desejada/implementada na branch:

- se existe oportunidade oficial ativa, usar a próxima ação da oportunidade na fila principal;
- não duplicar a mesma pendência com `crm_action` espelhada;
- ambientes sem schema comercial novo continuam com fallback antigo.

---

# 33. Cliente Fictício 001 — cenário completo

Empresa fictícia:

**Ateliê Horizonte Móveis — SIMULAÇÃO 001**

Contato fictício:

Marina Teste.

Cenário:

- móveis planejados/marcenaria;
- Salvador/BA;
- score comercial 9/10;
- prioridade alta;
- problemas percebidos: CRM ausente, follow-up manual, marca inconsistente, arquivos dispersos e financeiro fragmentado.

Entrada foi criada pela função oficial:

`create_pre_diagnostic_submission`

Ela gerou:

- lead;
- pré-diagnóstico;
- ação CRM;
- auditoria.

Decisão humana:

**Diagnóstico Blinko Completo**

Motivo:

problemas simultâneos em Comercial, Marca, Operação, Financeiro e Tecnologia.

Leitura inicial:

- criada;
- aprovada;
- marcada como enviada por canal fictício;
- nenhuma comunicação real disparada.

Identificador fictício:

`SIM-001-LEITURA-INICIAL`

Pagamento fictício do diagnóstico:

`SIM-001-PAGAMENTO-FICTICIO`

Nenhuma cobrança real foi realizada.

Fluxo percorrido:

**Lead → Pré-diagnóstico → Revisão humana → Leitura inicial → Diagnóstico ofertado → Pagamento fictício → Empresa → Coleta → Análise manual → Revisão da análise → Problemas/Causas/Prioridades/Intervenções → Devolutiva fictícia → Proposta → Revisão interna → Envio fictício → Aceite fictício → Projeto → Tarefas → Drive → Aprovações → Financeiro → Entrega → Encerramento**

Estado final:

- projeto: closed;
- tarefas: 5/5 done;
- aprovações: 3/3 approved;
- ações CRM abertas: 0;
- receita fictícia: R$ 4.800;
- custo realizado: R$ 2.600;
- contribuição realizada: R$ 2.200;
- margem realizada: 45,83%;
- recebíveis abertos: R$ 0;
- custos abertos: R$ 0;
- oportunidade comercial após backfill: P14 / won.

Essa simulação validou o fluxo mais completo do OS até agora.

---

# 34. Cliente Fictício 002 — validação da nova oportunidade

Empresa fictícia:

**Café Aurora — SIMULAÇÃO 002**

Objetivo:

provar que a oportunidade nova nasce automaticamente do fluxo oficial, sem ligação manual em SQL.

Entrada feita por `create_pre_diagnostic_submission`.

Resultado:

- lead criado;
- pré-diagnóstico criado;
- oportunidade criada automaticamente;
- etapa inicial: P01;
- fit: high;
- responsável: Blinko;
- próxima ação: `Revisar pré-diagnóstico`.

IDs úteis da simulação 002:

- lead_id: `f66ba195-91f5-4e17-8f05-8d252ed620ae`
- pre_diagnostic_id: `12a56469-1145-4938-ae56-26f9f87d9367`
- opportunity_id: `60289abe-9dc1-466c-b744-a12bc2576412`

Todos são fictícios.

Próximo teste:

usar o Cliente 002 para validar 023 e confirmar transições automáticas iniciais sem intervenção manual no pipeline.

---

# 35. Bugs/defeitos importantes encontrados e corrigidos

## 35.1 Tarefa aguardando parceiro sem dependência

Bloqueado pela regra 012.

## 35.2 Tarefa bloqueada sem owner/motivo/check

Bloqueado pela regra 012.

## 35.3 Tarefa concluída sem evidência

Bloqueado pela regra 012.

## 35.4 Ações CRM antigas permanecendo pending

Corrigido/backfill em 013.

## 35.5 Tarefa com approval_required concluindo sem aprovação

Corrigido em 015.

## 35.6 Custo interno tratado como movimento de caixa

Corrigido em 017: afeta margem, mas não necessariamente caixa.

## 35.7 Projeto fechando cedo demais

Corrigido em 018 com gate de encerramento.

## 35.8 Diagnóstico calculado manualmente/JSON

Resolvido na branch com 019–020.

## 35.9 C07 possuía problema antigo, mas item oficial seguia NV

Corrigido na simulação e transformado em cadeia oficial score/evidência/achado/ICB/prioridade/intervenção.

## 35.10 Perda comercial sem motivo

Regra endurecida no novo núcleo de oportunidades.

## 35.11 Histórico comercial podendo quebrar criação do núcleo

Migrações comerciais foram separadas:

- 021 = núcleo;
- 022 = backfill/views.

---

# 36. Inventário dos arquivos alterados na PR antes deste handoff

## API / Comercial

- `app/api/interno/comercial/[id]/close/route.ts`
- `app/api/interno/comercial/[id]/interaction/route.ts`
- `app/api/interno/comercial/[id]/stage/route.ts`

## API / Diagnóstico

- `app/api/interno/diagnosticos/[id]/structured-init/route.ts`
- `app/api/interno/diagnosticos/[id]/structured-item/route.ts`

## API / Projetos

- `app/api/interno/projetos/[id]/close/route.ts`
- `app/api/interno/projetos/[id]/prepare-closure/route.ts`

## Interface interna

- `app/interno/InternalTopbar.tsx`
- `app/interno/comercial/[id]/page.tsx`
- `app/interno/comercial/page.tsx`
- `app/interno/diagnosticos/[id]/DiagnosticStructuredSection.tsx`
- `app/interno/diagnosticos/[id]/page.tsx`
- `app/interno/interno.module.css`
- `app/interno/page.tsx`
- `app/interno/projetos/[id]/page.tsx`

## Documentação

- `docs/BLINKO_OS_V1_AUDIT.md`
- `docs/BLINKO_OS_V1_SIMULATION_001.md`
- `docs/BLINKO_OS_V1_VALIDATION_LOG.md`
- este arquivo de handoff

## Lib / server-only

- `lib/blinko/commercial-server.ts`
- `lib/blinko/diagnostic-collection-server.ts`
- `lib/blinko/diagnostic-structured-server.ts`
- `lib/blinko/internal-queue.ts`
- `lib/blinko/project-extensions-server.ts`
- `lib/blinko/today-server.ts`

## Migrações Neon

- `neon/sql/012_project_task_states.sql`
- `neon/sql/013_close_completed_crm_review_actions.sql`
- `neon/sql/014_drive_approvals.sql`
- `neon/sql/015_task_requires_approved_approval.sql`
- `neon/sql/016_finance_core.sql`
- `neon/sql/017_finance_lifecycle.sql`
- `neon/sql/018_project_closure.sql`
- `neon/sql/019_diagnostic_structured_scoring.sql`
- `neon/sql/020_diagnostic_catalog_v1.sql`
- `neon/sql/021_commercial_opportunities.sql`
- `neon/sql/022_commercial_backfill_views.sql`
- `neon/sql/023_commercial_prediagnostic_sync.sql`

---

# 37. Auditoria inicial — o que já existia e o que faltava

A auditoria técnica inicial registrou:

Infra já existente:

- Next.js;
- Vercel;
- GitHub;
- Neon/Postgres;
- CI básico;
- audit_events;
- IA opcional.

Principais lacunas encontradas originalmente:

- empresa sem visão 360 completa;
- contato sem entidade própria;
- diagnóstico não normalizado;
- catálogo S01–S40 não sincronizado;
- comercial sem oportunidade P00–P14;
- contrato sem entidade geral;
- onboarding pouco estruturado;
- projeto/status/tarefas incompletos;
- Hoje limitado;
- arquivos/Drive sem módulo operacional;
- aprovação sem entidade geral;
- financeiro geral inexistente;
- parceiros sem cadastro geral;
- indicadores parciais;
- configurações/regras sem módulo;
- permissões frágeis.

Nesta conversa avançamos bastante em:

- tarefas;
- Hoje;
- Drive;
- aprovações;
- financeiro;
- encerramento;
- diagnóstico oficial;
- comercial oficial.

Ainda restam principalmente os blocos descritos abaixo.

---

# 38. O QUE PRECISA CONTINUAR — ORDEM RECOMENDADA

## PRIORIDADE 1 — Validar 023 na simulação

Aplicar `023_commercial_prediagnostic_sync.sql` **somente** em `blinko-os-v1-sim`.

Testar com Cliente Fictício 002:

1. P01 — contato pendente;
2. revisão do pré-diagnóstico;
3. leitura inicial;
4. qualificação;
5. verificar se a oportunidade avança automaticamente às etapas previstas;
6. conferir eventos em `commercial_opportunity_events`;
7. conferir `audit_events`;
8. garantir owner + next action + date;
9. garantir que `Hoje` não duplique CRM + oportunidade.

Não promover ainda.

---

## PRIORIDADE 2 — Validar sincronização comercial completa P04→P14

021 já contém automações ligadas a diagnóstico/proposta/projeto.

É necessário percorrer um cenário novo e provar:

- diagnóstico iniciado → P05;
- recomendação definida → P06;
- proposta sendo preparada → P07;
- proposta enviada → P08;
- negociação → P09;
- aprovação → P10;
- formalização → P11;
- condição de início → P12;
- onboarding → P13;
- projeto liberado → P14;
- ganho → outcome won.

A ideia é eliminar atualização manual de estágio quando o próprio sistema tem evidência do fato.

---

## PRIORIDADE 3 — CONTRATO + CONDIÇÕES DE INÍCIO + ONBOARDING

Este é o **próximo grande bloco estrutural**.

Hoje P11, P12 e P13 existem conceitualmente/comercialmente, mas ainda não têm o nível de gate que o restante do OS ganhou.

Criar entidade geral de contrato.

Campos sugeridos:

- contract_id;
- company_id;
- opportunity_id;
- proposal_id;
- project_id;
- tipo;
- referência documental;
- versão;
- data de aceite/assinatura;
- início;
- fim/renovação;
- investimento;
- condições;
- responsável;
- status;
- arquivo/link;
- observações;
- auditoria.

Condições de início:

- contrato/aceite válido;
- pagamento/sinal se aplicável;
- cadastro mínimo;
- briefing mínimo;
- acessos;
- materiais;
- autorização;
- parceiro validado quando necessário;
- disponibilidade operacional;
- demais pré-requisitos da solução.

Regra:

> Proposta aprovada não significa projeto liberado.

Se faltar item obrigatório:

**BLOQUEADO PARA INÍCIO**

Onboarding:

- modular por solução;
- não repetir dados já presentes em empresa/diagnóstico/proposta;
- solicitar apenas o que falta;
- materiais/acessos/pré-requisitos precisam ter status.

Ao concluir onboarding:

- criar/liberar projeto;
- tarefas;
- responsáveis;
- dependências;
- pastas/arquivos;
- financeiro inicial;
- milestone inicial.

---

## PRIORIDADE 4 — Entidade geral de Contatos

A auditoria ainda considera Contato uma lacuna.

Hoje dados estão muito acoplados ao lead.

Criar:

- contatos por empresa;
- decisor;
- responsável operacional;
- aprovador;
- financeiro;
- telefone/e-mail;
- papel;
- principal/secundário;
- histórico.

Depois oportunidade deve apontar para contato/decisor correto.

---

## PRIORIDADE 5 — Empresa como visão 360

A empresa precisa virar o principal ponto de consulta.

A página da empresa deve reunir:

- contatos;
- diagnósticos;
- maturidade;
- achados;
- oportunidades;
- propostas;
- contratos;
- projetos;
- tarefas abertas;
- aprovações;
- Drive/arquivos;
- financeiro;
- soluções contratadas/recomendadas;
- parceiros envolvidos;
- indicadores;
- próxima reavaliação;
- histórico.

---

## PRIORIDADE 6 — Catálogo S01–S40 no OS

Sincronizar o catálogo oficial.

Cada solução precisa ter:

- código;
- nome;
- categoria;
- status;
- rota de execução;
- pré-requisitos;
- checklist de briefing;
- checklist de QA;
- templates de tarefa;
- parceiros elegíveis;
- indicadores aplicáveis;
- vínculo com achados/pilares.

Assim o diagnóstico pode recomendar solução sem depender de texto solto.

---

## PRIORIDADE 7 — Mudança de escopo

Criar entidade de Solicitação de Mudança / Change Request.

Classificação:

- correção por erro;
- ajuste incluso;
- mudança de escopo.

Mudança de escopo relevante:

- volta ao Comercial;
- gera nova versão de proposta/aditivo quando necessário;
- não deve ser executada silenciosamente.

---

## PRIORIDADE 8 — Parceiros

Criar cadastro geral de parceiro.

Campos:

- tipo;
- serviços;
- status;
- capacidade;
- disponibilidade;
- condições;
- custos;
- base de repasse quando validada;
- prazo;
- qualidade;
- revisões;
- incidentes;
- histórico.

Não hardcodar 50%.

---

## PRIORIDADE 9 — Indicadores

Indicadores comerciais:

- leads por origem;
- oportunidades qualificadas;
- diagnósticos;
- propostas;
- aprovação;
- conversão;
- perdas por motivo;
- valor proposto;
- valor contratado;
- tempo entre etapas;
- oportunidades sem próxima ação;
- follow-ups vencidos;
- forecast.

Operação:

- tarefas no prazo;
- tarefas vencidas;
- tempo de ciclo;
- tempo bloqueado;
- bloqueios por fonte;
- tempo de aprovação;
- retrabalho;
- incidentes;
- atraso de parceiro;
- mudança de escopo;
- conclusão de projeto.

Financeiro:

- receita;
- custos;
- contribuição;
- margem;
- recebíveis;
- inadimplência;
- despesas;
- repasses;
- caixa;
- rentabilidade por projeto/cliente/solução.

Diagnóstico:

- maturidade geral;
- maturidade por pilar;
- completude;
- achados críticos;
- evolução na reavaliação.

---

## PRIORIDADE 10 — Usuários, papéis e permissões

O login único por ambiente serve para fase atual, mas não para operação madura.

Papéis previstos:

- owner;
- operations;
- commercial;
- specialist;
- viewer.

Implementar:

- usuário individual;
- permissões;
- menor privilégio;
- auditoria por usuário;
- proteção de financeiro/contratos;
- eventual acesso externo/cliente somente quando necessário.

---

## PRIORIDADE 11 — Configurações e regras

Hoje várias regras estão codificadas no SQL/código.

Futuro módulo deve permitir controlar:

- templates;
- regras ativas;
- versão metodológica;
- automações;
- SLAs/metas por solução;
- parâmetros de alerta;
- status de soluções;
- status de parceiros;
- regras financeiras aprovadas.

Sem transformar a V1 num sistema excessivamente configurável antes de provar necessidade.

---

## PRIORIDADE 12 — Reavaliação, renovação e recorrência

Ainda precisa aprofundar:

- ciclos recorrentes;
- renovação de contrato;
- alertas de renovação;
- reavaliação do diagnóstico;
- comparação antes/depois;
- abertura de nova oportunidade por necessidade real;
- não fazer upsell automático sem evidência.

---

# 39. Templates discutidos para o futuro

Biblioteca de templates deve nascer a partir dos documentos oficiais e das entidades, não de arquivos duplicados.

Exemplos:

- ficha de lead;
- qualificação;
- primeiro contato;
- triagem;
- proposta;
- resumo de investimento;
- contrato pontual;
- contrato recorrente;
- ordem transacional;
- onboarding modular;
- pedido de materiais;
- follow-up de proposta;
- aprovação;
- mudança de escopo;
- reunião;
- QA;
- entrega;
- encerramento;
- relatório;
- reavaliação.

Classificar templates como:

- Interno;
- Cliente;
- Equipe;
- Cliente + Equipe.

Dados devem ser autofill sempre que já existirem no sistema.

---

# 40. Comunicação operacional

Decisões importantes feitas por WhatsApp precisam ser registradas no sistema.

Não é necessário copiar cada mensagem.

Registrar:

- decisão;
- aprovação;
- mudança de escopo;
- prazo;
- bloqueio;
- responsável;
- próximo passo.

Idealmente definir aprovador principal por projeto.

---

# 41. QA e qualidade

Checklist comum discutido:

1. escopo correto;
2. dados corretos;
3. aderência à marca quando aplicável;
4. especificação técnica;
5. links/arquivos/acessos;
6. nomenclatura/versão;
7. qualidade de parceiro;
8. alertas legais/permissões quando aplicável;
9. entregáveis completos;
10. aprovação exigida quando aplicável.

Como a Blinko ainda pode operar com equipe pequena, não fingir revisão “quatro olhos” quando só existe uma pessoa.

Nesses casos usar checklist estruturado e, em saídas de alto risco, validação do cliente/especialista apropriado.

---

# 42. Nomenclatura de arquivos

Padrão sugerido:

`CLIENTE_PROJETO_TIPO_AAAA-MM-DD_V01.ext`

Evitar:

- final;
- final2;
- final_agora;
- novo_final;
- etc.

Status de aprovação deve ficar no sistema; versão no nome do arquivo.

---

# 43. Estrutura de Drive discutida

Conceitualmente foi discutida uma estrutura universal de cliente/projeto.

Exemplo geral:

CLIENTE

- 01 Administrativo
- 02 Diagnóstico e Estratégia
- 03 Projetos
- 04 Materiais Cliente
- 05 Reuniões
- 06 Relatórios
- 07 Arquivo

Projeto:

- 01 Briefing e Escopo
- 02 Planejamento
- 03 Produção
- 04 Aprovação
- 05 Entrega
- 06 Evidências
- 07 Relatórios

A Pint Services tinha uma estrutura própria anterior:

- 01 Administrativo
- 02 Diagnóstico
- 03 Marca
- 04 Planejamento
- 05 Projetos
- 06 Conteúdo
- 07 Materiais
- 08 Aprovações
- 09 Relatórios
- 10 Financeiro

A evolução do OS deve evitar obrigar todo cliente a usar pastas específicas de social media. O núcleo deve ser universal e módulos específicos devem entrar conforme solução contratada.

---

# 44. Kanban de conteúdo antigo

Foi discutido anteriormente:

**Ideias → Planejamento → Produção → Revisão Interna → Cliente → Alterações Solicitadas → Aprovado → Publicado**

Isso pode continuar existindo como workflow específico para projetos de conteúdo/social media.

Não usar como status universal de todo projeto Blinko.

---

# 45. O que o sistema deve responder no futuro

Exemplos que motivaram a arquitetura:

- o que está faltando na Pint Services?
- quais clientes aguardam aprovação?
- quais diagnósticos estão incompletos?
- quais empresas têm problema de marca?
- quem precisa de Google?
- o que eu preciso fazer hoje?
- quantos Reels faltam?
- quem renova este mês?
- quais recebíveis estão vencidos?
- quais projetos estão bloqueados?
- qual parceiro está atrasando?
- quais oportunidades estão sem follow-up?

---

# 46. Automações discutidas desde o início

Exemplos originais:

## Contrato assinado

→ onboarding
→ criar estrutura de arquivos
→ gerar briefing
→ liberar formulário
→ mensagem de boas-vindas
→ tarefa aguardando materiais

## Briefing recebido

→ arquivar
→ atualizar status
→ liberar planejamento

## Planejamento aprovado

→ criar produção
→ abrir entregáveis
→ calendário

## Diagnóstico

Se “não existe CRM”
→ achado de ausência de gestão de leads

Impacto alto + urgência alta
→ prioridade elevada

Solução tipo sistema
→ mapear para Sistemas Blinko

O desenvolvimento atual já começou a transformar essas ideias em eventos/regras reais, mas ainda não cobre todas as A01–A25 do Documento 08.

---

# 47. Riscos que não podem ser esquecidos

1. **Não transformar a Blinko novamente em agência de social media.**
2. **Não vender solução antes de entender/diagnosticar quando a demanda é estrutural.**
3. **Não transformar Drive em banco de dados.**
4. **Não tornar IA dependência obrigatória.**
5. **Não hardcodar regra de parceiro de 50%.**
6. **Não duplicar Lead, Empresa e Oportunidade como se fossem a mesma entidade.**
7. **Não promover migração experimental direto para produção.**
8. **Não apagar compatibilidade antiga antes da transição estar segura.**
9. **Não permitir tarefa crítica sem responsável/prazo/evidência apropriada.**
10. **Não permitir oportunidade ativa sem próxima ação.**
11. **Não permitir perda sem motivo.**
12. **Não permitir aprovação obrigatória ser ignorada.**
13. **Não considerar proposta aprovada igual a projeto pronto para começar.**
14. **Não fechar projeto sem gate de encerramento.**
15. **Não considerar custo interno automaticamente saída de caixa.**
16. **Não esconder inconsistência de banco apenas com filtro de interface; corrigir a regra de origem.**
17. **Não sobrescrever histórico de versões quando o modelo prevê versionamento/auditoria.**

---

# 48. Estado atual resumido por módulo

## Infraestrutura

- Next.js: existe
- GitHub: existe
- Vercel: existe
- Neon: existe
- CI: existe e passou no último HEAD anterior ao handoff
- auditoria: existe

## Hoje

- muito evoluído
- integra operação/comercial/aprovação/financeiro/encerramento
- ainda pode receber reuniões/alertas/configurações futuras

## Tarefas

- waiting_client
- waiting_partner
- blocked
- evidência de conclusão
- bloqueios estruturados
- boa base

## Diagnóstico

- 114 itens estruturados na branch
- scoring oficial
- evidências
- achados
- ICB
- interface
- falta promoção e evolução de reavaliação

## Comercial

- oportunidades P00–P14 implementadas na branch
- interface criada
- próxima ação obrigatória
- perdas com motivo
- backfill/views
- 023 ainda precisa validação no Neon sim

## Drive

- estrutura e vínculo testados
- falta módulo geral completo de arquivos/upload/versionamento

## Aprovações

- núcleo criado
- trava de conclusão implementada
- falta aprofundar revisão/mudança de escopo/follow-up

## Financeiro

- núcleo criado
- rentabilidade e caixa separados
- falta parceiros/repasses/regras finais/indicadores maduros

## Projetos

- tarefas, Drive, aprovação, financeiro e encerramento avançaram
- falta contrato/onboarding/prontidão universal mais forte

## Contratos

- **principal lacuna estrutural atual**

## Onboarding

- ainda precisa modularização/gate formal

## Contatos

- entidade própria ainda pendente

## Parceiros

- núcleo geral ainda pendente

## Indicadores

- parcial

## Permissões

- pendente

## Configurações/Regras

- pendente

---

# 49. Critério de prontidão para primeiro cliente real

Critério definido na auditoria:

O Blinko OS estará pronto para receber o primeiro cliente real quando um cenário fictício conseguir percorrer sem controle paralelo obrigatório:

**Lead → Qualificação → Diagnóstico → Prioridades → Soluções → Proposta → Aceite → Contrato → Onboarding → Projeto → Tarefas → Arquivos/Aprovação → Financeiro → Entrega → Encerramento**

A Simulação 001 já provou grande parte desse caminho, mas `Contrato` e `Onboarding modular/prontidão` ainda precisam ser estruturados no nível oficial antes de considerar o sistema realmente pronto.

---

# 50. PONTO EXATO DE RETOMADA NA PRÓXIMA CONVERSA

Começar com esta sequência, sem voltar para auditoria geral do zero:

### Passo 1

Abrir o repositório `leleca7/blinko`, PR #25, branch `feat/blinko-os-v1-audit`.

### Passo 2

Ler este arquivo:

`docs/BLINKO_OS_V1_HANDOFF_COMPLETO_2026-09-09.md`

### Passo 3

Conferir HEAD/CI/Preview depois do commit deste handoff.

### Passo 4

No Neon, usar **somente `blinko-os-v1-sim`** para testes.

### Passo 5

Aplicar e testar:

`neon/sql/023_commercial_prediagnostic_sync.sql`

### Passo 6

Usar Cliente Fictício 002 (`Café Aurora — SIMULAÇÃO 002`) para provar transições P01→P04.

### Passo 7

Percorrer um cenário para validar automações P04→P14.

### Passo 8

Depois implementar o próximo grande pacote:

**Contrato + Condições de Início + Onboarding Modular + Gate de Prontidão**

Esse pacote deve ser desenvolvido primeiro na branch GitHub atual e Neon de simulação, com fallback/compatibilidade quando necessário.

---

# 51. Prompt de retomada sugerido para outra conversa

Copiar e enviar algo como:

> Vamos continuar o Blinko OS. Use o repositório `leleca7/blinko`, PR #25, branch `feat/blinko-os-v1-audit`. Primeiro leia `docs/BLINKO_OS_V1_HANDOFF_COMPLETO_2026-09-09.md`. Não recomece a auditoria. Confira o HEAD e o CI atuais. No Neon use apenas `blinko-os-v1-sim`. O ponto de retomada é validar `023_commercial_prediagnostic_sync.sql` com o Cliente Fictício 002 e depois avançar para Contrato + Condições de Início + Onboarding Modular + Gate de Prontidão. Preserve todas as decisões de negócio e arquitetura descritas no handoff, principalmente: Lead ≠ Oportunidade ≠ Empresa; IA é opcional; Drive é repositório; não hardcodar 50% de parceiro; e não aplicar migração na main sem promoção controlada.

---

# 52. Referências internas do próprio GitHub

Documentos já existentes na branch:

- `docs/BLINKO_OS_V1_AUDIT.md`
- `docs/BLINKO_OS_V1_VALIDATION_LOG.md`
- `docs/BLINKO_OS_V1_SIMULATION_001.md`

Issue relevante:

- #27 — Diagnóstico oficial estruturado

PR principal:

- #25

Ambiente de simulação:

- Neon `blinko-os-v1-sim`

---

# 53. Observação final de continuidade

Não usar apenas este handoff como desculpa para ignorar o código atual.

Na retomada:

1. ler este handoff;
2. conferir PR/HEAD real;
3. conferir migrations existentes;
4. conferir CI;
5. conferir schema do Neon sim;
6. só então continuar.

O objetivo é preservar contexto sem congelar a realidade técnica do repositório.

**Fim do handoff completo — 09/09/2026.**
