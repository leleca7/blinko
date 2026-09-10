# Blinko OS v1 — Simulação 013 — Configurações, automações e templates

Data: 10/09/2026
Branch GitHub: `feat/blinko-os-v1-audit`
Neon: `blinko-os-v1-sim` (`br-soft-violet-aw0lfbud`)
Produção/main: **NÃO ALTERADOS**

## Objetivo

Validar a frente de **Configurações e regras versionadas** prevista no Documento 08, sem transformar constantes técnicas em parâmetros editáveis e sem criar um executor arbitrário de código.

Fonte funcional principal:
- `08 — BLINKO — SISTEMA E AUTOMAÇÃO` · v1.0 · 09/09/2026;
- seções 5.23, 6, 7.11, 11, 12, 16, 17, 18, 22–25.

Princípios aplicados:
- regra de negócio relevante deve possuir versão, evidência e responsável;
- templates devem possuir controle de versão e referência, mantendo o Drive como repositório de conteúdo;
- automação deve ser auditável e idempotente;
- cadastrar/configurar uma regra **não executa nem publica código automaticamente**;
- ativação de automações deve ocorrer somente após processo compreendido, padronizado e testado;
- parâmetros não podem ser inventados para preencher lacunas de negócio.

## Migrações

### 046 — `046_versioned_settings_automation_templates.sql`

Cria:
- `settings.view` e `settings.manage`;
- permissões gerais de Configurações somente para `admin` na V1;
- `os_parameter_definitions`;
- `os_parameter_versions`;
- `automation_rules`;
- `automation_rule_versions`;
- `automation_rule_executions`;
- `document_templates`;
- `document_template_versions`;
- views de catálogo atual;
- funções auditáveis para criar novas versões;
- funções de início/finalização de execução de regra.

O catálogo oficial foi carregado com **A01–A25**, sem criar versões ativas automaticamente.

Também foram registrados os 10 tipos documentais previstos no Documento 08:
- proposta;
- resumo de investimento;
- contrato/anexo de escopo;
- briefing/onboarding modular;
- plano de ação;
- diagnóstico/relatório;
- planejamento;
- ata de reunião;
- relatório de resultados;
- comunicação padronizada.

O conteúdo dos templates **não é duplicado no banco**; a versão guarda referência ao conteúdo no Drive quando houver material validado.

### 047 — `047_automation_rule_idempotency_across_versions.sql`

A primeira modelagem já impedia repetição da mesma chave dentro de uma versão da regra.

Durante a Simulação 013 foi identificado um endurecimento necessário: uma nova versão poderia reutilizar a mesma chave lógica de evento.

A migração 047 adiciona unicidade por:

`rule_id + idempotency_key`

Assim, a mesma ocorrência lógica continua protegida mesmo depois que A24, A25 ou qualquer outra regra ganha uma nova versão.

## Interface implementada

Nova área:
- `/interno/configuracoes`

Camadas:
- `lib/blinko/settings-server.ts`;
- `/api/interno/configuracoes/parameters`;
- `/api/interno/configuracoes/automation/[code]`;
- `/api/interno/configuracoes/templates/[code]`.

A navegação passou a exibir **Configurações** apenas para sessões com `settings.view`.

A tela permite:
- consultar parâmetros gerais vigentes;
- criar nova versão de parâmetro com evidência;
- consultar A01–A25 e a versão governada vigente;
- criar nova versão de uma regra;
- consultar os tipos oficiais de template;
- versionar metadados e referência de template;
- consultar execuções recentes e chaves de idempotência;
- navegar para Indicadores e Usuários sem misturar responsabilidades.

Não existe botão de “executar automação” nessa interface.

## Separação de configuração

A migração 041 continua sendo a fonte para:
- metas de indicadores;
- parâmetros específicos de indicadores, como pesos do forecast.

A migração 046 cobre apenas parâmetros gerais/transversais de negócio.

Constantes técnicas como:
- algoritmo/hash de senha;
- parâmetros do `scrypt`;
- implementação de sessão;
- validações estruturais de UUID;

não foram convertidas em configurações de negócio.

## Validações de schema — `blinko-os-v1-sim`

Estado inicial após 046:
- regras oficiais: **25**;
- tipos oficiais de template: **10**;
- parâmetros gerais: **0**;
- versões de regras: **0**;
- versões de templates: **0**.

Isso comprova que o sistema não inventou parâmetros nem ativou regras automaticamente.

### 1. Evidência obrigatória para parâmetro

Tentativa de registrar `sim013.renewal_notice_days` sem evidência:

**RECUSADA** — `parameter requires evidence/reference`.

### 2. Versionamento de parâmetro

Fixture exclusivamente fictícia:

`sim013.renewal_notice_days`

V1:
- valor: `30`;
- evidência: `SIM013-EVIDENCIA-PARAM-V1`.

V2:
- valor: `45`;
- evidência: `SIM013-EVIDENCIA-PARAM-V2`.

Resultado:
- V1 → `is_current=false`, `status=retired`;
- V2 → `is_current=true`, `status=active`.

Nenhuma versão anterior foi sobrescrita.

Os valores 30 e 45 **não representam política real da Blinko**; existem apenas para testar versionamento.

### 3. Tipo do parâmetro

Tentativa de enviar texto (`"quarenta"`) para parâmetro definido como `number`:

**RECUSADA** — `parameter requires numeric value`.

A falha ocorreu de forma atômica, sem aposentar a versão válida vigente.

### 4. Regra determinística sem runtime

Tentativa de registrar A24 como:
- status `active`;
- execução `deterministic`;
- sem `runtime_binding`.

**RECUSADA** — `deterministic pilot/active rule requires runtime binding`.

Isso impede que a configuração declare uma automação determinística ativa sem implementação responsável.

### 5. A24 em piloto manual

Foi criada uma versão fictícia/piloto de A24 apenas para testar a governança do log.

A versão registra:
- gatilho;
- condições;
- ação;
- exceções;
- responsável;
- resultado esperado;
- política de falha;
- evidência.

O modo `manual` não cria job nem executa alteração comercial real.

### 6. Log de execução

Execução fictícia:
- regra: A24;
- chave: `SIM013-A24-RENOVACAO-001`;
- status final: `succeeded`;
- resultado: log apenas, sem criação de ação real.

A execução recebeu trilha em `audit_events`.

### 7. Idempotência na mesma versão

Nova tentativa com a mesma chave:

**RECUSADA** por unicidade.

### 8. Idempotência atravessando versões

Foi criada A24 V2 fictícia.

A mesma chave `SIM013-A24-RENOVACAO-001` foi tentada novamente.

**RECUSADA** pelo índice `automation_rule_executions_rule_key_uidx`.

Isso motivou e validou a migração 047.

### 9. Template ativo sem conteúdo

Tentativa de ativar `TPL_PROPOSAL` sem `content_reference`:

**RECUSADA** — `active template requires content reference`.

### 10. Versionamento de template

Fixture fictícia `TPL_PROPOSAL`:

V1:
- `draft`;
- sem arquivo real;
- evidência `SIM013-EVIDENCIA-TEMPLATE-V1`.

V2:
- `inactive`;
- sem arquivo real;
- evidência `SIM013-EVIDENCIA-TEMPLATE-V2`.

Resultado:
- V1 aposentada;
- V2 única versão corrente;
- nenhuma referência falsa de Drive foi registrada como template ativo.

### 11. Menor privilégio

Permissões `settings.*` por papel:

- `admin`: `settings.view`, `settings.manage`, `settings.users.manage`;
- `strategy_consulting`: nenhuma;
- `operations`: nenhuma;
- `financial`: nenhuma;
- `partner`: nenhuma;
- `client`: nenhuma.

Na V1, configuração geral é responsabilidade administrativa.

## Fixtures persistidas na simulação

A Simulação 013 deixa registros explicitamente identificados como fictícios na branch de simulação para preservar a evidência do teste:
- parâmetro `sim013.renewal_notice_days`;
- versões fictícias de A24;
- uma execução fictícia de A24;
- versões fictícias/inativas de `TPL_PROPOSAL`.

Nenhum desses registros foi criado em produção.

## CI / Preview

Checkpoint de código após interface + 046/047:
- GitHub Actions `Blinko CI` #338: **success**;
- TypeScript: **success**;
- Next.js build: **success**.

Vercel no mesmo checkpoint:
- status externo: **failure**;
- causa reportada: `build-rate-limit` / upgrade de plano;
- portanto, o Preview não executou por quota de build, não por falha detectada no código.

Esse bloqueio externo deve continuar sendo tratado como pendência de Preview; não deve ser reclassificado como sucesso.

## Conclusão

Status do pacote: **VALIDADO EM SCHEMA + CI; PREVIEW BLOQUEADO POR QUOTA EXTERNA**.

Configurações agora possui governança real:
- identidade estável;
- versão corrente sem apagar histórico;
- evidência e responsável;
- auditoria;
- separação entre catálogo e ativação;
- proteção de tipo;
- templates referenciados em vez de duplicados;
- idempotência inclusive entre versões da automação.

## Próxima frente

Com Configurações/Rules/Templates estruturados, a continuidade natural passa a ser:

**A23–A25 — Ciclos recorrentes, Renovação e Reavaliação Diagnóstica**.

Esses fluxos devem reutilizar o registro de regras/configurações agora existente, sem sobrescrever contratos, projetos ou diagnósticos históricos.
