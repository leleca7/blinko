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

## Incremento 03 — documentos, agenda e financeiro
- Agenda por projeto: compromissos simulados e prazos do plano de ação, com conclusão sincronizada em memória.
- Relatório: compilação determinística de evidências revisadas, hipóteses separadas, cobertura do Radar, prioridades e síntese humana. Exportação TXT; não é relatório aprovado, não inclui dados financeiros e não utiliza IA generativa.
- Financeiro: lançamentos fictícios em centavos, vencimento, distinção entre previsto e realizado, saldo por projeto. Não implementa cobranças, impostos, conciliação bancária, remuneração ou divisão de lucros.
- Neon: inventário somente de metadados na branch de simulação existente. Há tabelas de leads, pré-diagnósticos, diagnósticos, evidências, projetos, tarefas, contas a receber, custos, planos financeiros, modelos de documentos, papéis, usuários, acesso por projeto e auditoria. Não duplicar essas entidades antes de mapear contratos, estados e relações.
- A branch de simulação deriva de dados da main. Isso não garante anonimização. Nenhuma linha de cliente foi consultada, nenhuma escrita foi realizada e nenhuma credencial foi recuperada.
- Próximo passo P0: obter autorização e confirmar um banco exclusivamente sintético (não apenas cópia da produção), revisar permissões por organização/projeto no servidor, criar testes de acesso e mapear a triagem para leads/pré-diagnósticos, antes de conectar o protótipo. Não alterar produção, abrir endpoints bloqueados ou expor credenciais.
- Testes manuais: alternar projetos; registrar compromisso e concluir ação pela agenda; verificar exportação com e sem evidências; verificar que receita/despesa prevista não altera saldo realizado até marcar recebimento/pagamento. Recarregar restaura a demonstração.

## Incremento 04 — banco sintético e autorização no banco
- Autorizada a criação de ambiente exclusivamente de testes. Projeto Neon separado, novo e vazio: `blinko-os-sandbox`, banco `blinko_sandbox`, branch `sandbox`. Plano gratuito; configurações padrão (personalização de suspensão rejeitada pelo plano). Nenhuma cópia da produção.
- Estrutura versionada em [001_os_lab.sql](../database/sandbox/001_os_lab.sql) e [002_synthetic_fixtures.sql](../database/sandbox/002_synthetic_fixtures.sql). Modelo de laboratório para testar contratos; não é substituto das tabelas existentes na Blinko.
- Criadas seis tabelas isoladas (organizações, membros, leads, projetos, acesso a projetos e evidências), duas organizações fictícias, cinco membros fictícios, três leads e três projetos iniciais. Nenhum dado real ou segredo no GitHub.
- Papel de teste NOLOGIN e NOBYPASSRLS; políticas RLS em projetos e evidências. Contexto de ator deve vir de sessão validada no servidor; não aceitar identidade enviada pelo cliente. O papel não tem permissão de alteração/exclusão nem de gravação de leads.
- Testes SQL reais: ausência de sessão (0 projetos), operador autorizado (1), leitor (1, sem escrita), administrador (2 da própria organização), membro inativo (0), membro sem projeto (0); todos passaram.
- Escritas: leitor, operador em outro projeto e operador em outra organização bloqueados por RLS (42501); operador autorizado inseriu uma evidência sintética, confirmada em nova transação. Restrição de submissão duplicada (23505) e vínculo cruzado entre organizações (23503) confirmadas.
- Nenhuma mudança em banco oficial, domínios, API, proxy, sessão, ambiente da Vercel ou interface pública. O protótipo ainda usa memória local.
- Próximo gate: revisão técnica humana das políticas e do modelo de sessão; provisionar papel de runtime com credenciais restritas, fora do GitHub, somente para o sandbox. Implementar adaptador server-side e testes HTTP, incluindo negação de acesso, sessão expirada, deduplicação idempotente e consentimento. Não liberar captação real até aprovação.

## Incremento 05 — integração server-side preparada, desativada
- Criado `lib/os-lab/session.ts`: valida HMAC, audiência exclusiva do sandbox, UUID do ator, prazo máximo de uma hora, assinatura, campos e endereço permitido do banco. Não há emissão de tokens nem login implementado neste incremento.
- `lib/os-lab/repository.ts`: acesso exclusivamente server-side, sem fallback para credenciais oficiais, com flag desativada por padrão e bloqueio de ambiente de produção. Contexto do ator dentro de cada transação Neon, SQL parametrizado, escopo RLS. Lista projetos/evidências e insere evidências; organização derivada no servidor, revisão não atribuível pelo cliente.
- `app/api/os-lab/projects/route.ts`: contrato GET/POST, cookie próprio, origem exata para escrita, limite de corpo 4096 bytes, erros genéricos e cache desabilitado. O proxy experimental continua bloqueando TODAS as rotas /api, portanto não é uma integração HTTP ativa.
- `tests/os-lab-session.test.mjs`: cinco grupos de testes locais (Node 22, `node --experimental-strip-types --test tests/os-lab-session.test.mjs`) passaram no código equivalente antes do commit; não são testes HTTP nem auditoria de segurança.
- `database/sandbox/003_runtime_role.sql`: papel de runtime criado e conferido no banco sintético, NOLOGIN, sem superusuário, criação de banco/papel, bypass RLS, leitura de leads ou atualização de evidências. Herda apenas as permissões do papel de laboratório. Sem credenciais.
- **Gate humano:** revisar código/políticas, decidir emissão/revogação de sessão e cookies Secure/HttpOnly/SameSite, prover credenciais do papel de runtime exclusivamente no sandbox, por canal seguro. Não colar senha aqui ou no GitHub. Depois, em ambiente protegido, configurar `BLINKO_OS_LAB_DATABASE_URL`, `BLINKO_OS_LAB_SESSION_SECRET`, `BLINKO_OS_LAB_ORIGIN` e só então autorizar flag de laboratório e exceção estreita ao proxy. Necessário testar HTTP ponta a ponta antes de conectar UI, inclusive revogação, acesso cruzado, falhas e prevenção de abuso. Não usar ambiente público nem produção.
- Pendente: autenticação individual real e revogação, integração com interface, intake e deduplicação idempotente, auditoria de ações, revisão do modelo de dados, controle de uso e captação real.

## Incremento 06 — qualidade, relatório editorial e triagem simulada
- Interface 0.4: Central de revisão humana com critérios mínimos provisórios, parecer, registro e revogação simulados. Revisão válida apenas enquanto conteúdo do relatório e registros associados coincidirem com o snapshot revisado; sem assinatura digital ou aprovação profissional. Exige cobertura 10/10 para marcar revisão completa nesta demonstração; relatório parcial continua disponível como rascunho.
- Relatório com capa editorial, indicadores e conteúdo consolidado, exportação TXT e impressão A4/salvar PDF pelo navegador; sempre identificado como fictício. Validação visual de impressão pendente.
- Simulação da triagem: contato fictício fixo, consentimento explícito, captura parcial, conclusão, reenvio idempotente e conflito sem sobrescrita. Adiciona somente um lead ao CRM em memória; não chama a API, não persiste ao recarregar e não envia WhatsApp.
- `lib/os-lab/synthetic-intake.ts` e `tests/os-lab-intake.test.mjs`: 6 testes unitários passaram localmente na cópia do módulo (Node 22, `node --experimental-strip-types --test tests/os-lab-intake.test.mjs`). Não são testes de integração HTTP, concorrência ou autenticação real.
- API pública existente permanece bloqueada. Próximos requisitos de integração real: identidade de submissão não controlada apenas por UUID, autorização para completar contato, consentimento versionado, limites de corpo e requisição, idempotência transacional, tratamento de falha, revisão de retenção e auditoria. Revisão técnica e credenciais continuam pendentes.

## Incremento 07 — Central de Inteligência Blinko
- Interface 0.5: cobertura dos dez pilares, número de registros elegíveis, nomes de fontes distintas e registros pendentes. Nomes distintos não comprovam independência; ausência de evidência não é nota zero.
- Perguntas de investigação geradas por regras explícitas para lacunas de fontes, observação, revisão e explicações alternativas. Não há interpretação semântica automática nem IA generativa.
- Mapa de hipóteses causais por projeto: possível causa e efeito, registros favorável e contrário distintos, parecer humano, decisão provisória ou refutação. Alterar vínculos/parecer reabre investigação; revogar revisão de registro vinculado sinaliza hipótese para nova revisão. Não comprova causalidade automaticamente.
- Relatório inclui hipóteses, pareceres e status; revisão humana considera alterações de hipóteses e vínculos inválidos. Todos os dados continuam em memória e fictícios.
- Seis testes unitários aprovados em cópia local do módulo e arquivo de testes, Node 22 (download direto do GitHub indisponível no ambiente local). Arquivos versionados em `lib/os-lab/intelligence.ts` e `tests/os-lab-intelligence.test.mjs`; ainda não são testes de navegador.
- Próximo passo: revisão metodológica, preparar contrato de IA assistiva com fontes rastreáveis e saídas revisáveis, sem ativar serviços externos nem enviar dados reais. Gates de segurança e autenticação anteriores continuam vigentes.

## Incremento 08 — assistência investigativa e prévia do portal
- Interface 0.6: sugestões determinísticas de perguntas, com referências elegíveis do pilar ativo, limitações explícitas e decisão humana de selecionar ou descartar. As decisões ficam vinculadas ao projeto, à sugestão e aos registros de origem; nenhuma nota, diagnóstico ou ação é alterada automaticamente.
- Contrato de saída assistiva em `lib/os-lab/assistive.ts`: valida estrutura, limites, referências existentes/revisadas e escopo do pilar. A validação não comprova que o conteúdo gerado é verdadeiro. Nenhum provedor de IA foi conectado, nenhuma credencial foi criada e nenhum dado foi enviado externamente.
- Portal: prévia dentro do laboratório, resumo e próximos passos redigidos pela equipe, maturidade e ações opcionais desativadas inicialmente. Projeção por lista explícita de campos; não inclui automaticamente evidências brutas, custos, margem, pareceres e responsáveis internos. Textos livres e títulos de ações ainda precisam de conferência humana de confidencialidade.
- A prévia só aparece com revisão interna atual, conteúdo preenchido e autorização simulada vinculada ao projeto e à versão projetada. Alterações que rompem a correspondência ou revogação da revisão bloqueiam a visualização. Não é autorização real nem isolamento de dados no navegador; futuro portal precisa de projeção server-side, autenticação e controle de acesso por cliente/projeto.
- Seis testes unitários passaram em Node 22, com os hashes Git dos dois arquivos locais conferidos contra o GitHub: `node --experimental-strip-types --test tests/os-lab-assistive.test.mjs`. Verificações de referências inválidas, escopo, minimização de campos e autorização da prévia. Testes de navegação e publicação real não realizados.
- Próximo marco: consolidar fluxo Cliente Zero com fixtures e testes ponta a ponta; revisão técnica humana, autenticação e persistência no sandbox antes de conectar IA, portal ou triagem real. Não liberar dados reais nem modificar produção.

## Incremento 09 — Cliente Zero e correções de fluxo
- Interface 0.7: roteiro de ensaio em 12 etapas, com empresa fictícia Z distinta dos demais exemplos. Início e conclusão usam o contrato de triagem sintética existente, depois o lead entra no CRM local; o usuário conduz a contratação simulada e cria o projeto.
- Material de ensaio inclui dez registros não revisados (um por pilar), um compromisso e dois lançamentos previstos. Não sobrescreve projeto que já possui registros; não define notas, cria ações nem aprova o relatório automaticamente. Parâmetros de preço apresentados no roteiro são apenas exemplos.
- Corrigido fluxo: leads oriundos da triagem simulada só permitem contratação após conclusão do formulário e chegada à etapa de diagnóstico. Restaurar etapas preserva os dois leads sintéticos sem introduzir contatos inexistentes.
- Qualquer alteração no projeto ou no texto/parecer do relatório descarta as aprovações internas e de portal; restaurar conteúdo anterior não reativa autorização antiga. Por prudência, também invalida com alterações financeiras e de agenda neste protótipo.
- Quatro testes unitários de fixture e regras de ciclo de vida passaram em Node 22. Hashes Git da cópia local de `pilot.ts` e `os-lab-pilot.test.mjs` conferidos com os blobs do GitHub; a dependência `assistive.ts` também corresponde ao blob do incremento 08.
- Testes completos de navegador e impressão continuam pendentes: ambiente local sem resolução DNS para GitHub/Vercel, sem CLI Vercel autenticada. A verificação via conector HTTP não exercita cliques. O roteiro orienta o ensaio manual, não certifica o fluxo ponta a ponta.
- Não houve alterações em produção, banco, credenciais, proxy ou APIs. Antes de dados reais: revisar segurança e metodologia, autenticação individual, persistência, isolamento por projeto, testes HTTP e autorização de lançamento.
