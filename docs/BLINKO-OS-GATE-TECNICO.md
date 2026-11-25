# Blinko OS — gate técnico para Dia 1 conectado

Status: checklist de revisão, não aprovação. Somente dados fictícios. Nenhum segredo ou senha deve ser enviado por chat, GitHub, documento ou captura de tela.

## 1. Evidências verificadas em 25/11/2026
- CI 45642763522, commit 797a8b6: 50/50 unitários, oito cenários do protótipo, TypeScript, 13 migrações, testes SQL e HTTPS local autenticado. Inclui reenvio concorrente de evidência, sessão, CRM, Radar, ações, agenda, hipóteses, estimativas, financeiro, entrega, fila, PDF/TXT, revogação.
- Neon isolado: projeto small-snow-62924776, banco blinko_sandbox, sem cópia da produção. Papéis os_lab_runtime, os_lab_issuer e os_lab_test confirmados NOLOGIN, sem superuser, bypass RLS, criação de papel ou banco. Runtime sem INSERT direto em evidence.
- Vercel projeto blinko: SSO informado como all_except_custom_domains; proteção por senha desativada. Isso não prova bloqueio de todos os aliases. Não usar domínio customizado ou link de bypass para o laboratório.
- Proxy versionado bloqueia /api, /interno, /internal, /os-workspace e diagnóstico completo. Flag permanece desativada; acesso persistente não publicado. Transporte Neon não foi exercitado via HTTP real.

## 2. Revisão conjunta com responsável técnico — antes de qualquer habilitação
- [ ] Revisar as 13 migrações, grants, funções SECURITY DEFINER, search_path, RLS, isolamento entre organizações/projetos e sessão vinculada ao membro. GUC de identidade é confiável apenas dentro do servidor; jamais disponibilizar credenciais SQL aos clientes.
- [ ] Definir ambiente exclusivamente de teste e hostname protegido, sem domínio público/customizado, com confirmação externa de SSO e lista de participantes autorizados. Manter projeto público e produção sem alterações.
- [ ] Revisar estratégia de login temporário, códigos aleatórios de 256 bits, expiração, revogação, limitação de tentativas/abuso e entrega por canal seguro. Não considerar este modelo a autenticação definitiva.
- [ ] Aprovar provisionamento privado de credenciais separadas de emissor/runtime, exclusivamente no sandbox. Confirmar papéis mínimos e rotação/revogação; não usar proprietário ou DATABASE_URL de produção. Não imprimir, registrar em logs ou enviar segredos.
- [ ] Aprovar configuração restrita ao ambiente de teste: BLINKO_OS_LAB_DATABASE_URL, BLINKO_OS_LAB_ISSUER_URL, BLINKO_OS_LAB_SESSION_SECRET, BLINKO_OS_LAB_ORIGIN. Habilitação BLINKO_OS_LAB_ENABLED somente após confirmação dos controles. Nunca em produção.
- [ ] Revisar exceção de proxy estritamente para quatro rotas do laboratório, condicionada ao ambiente e origem configurados. Demais APIs e áreas internas devem continuar bloqueadas. Não mesclar na main.
- [ ] Definir usuários fictícios de ensaio, perfil admin e operator com acessos necessários, e teste negativo viewer/sem acesso. Código de acesso gerado fora da aplicação com hash e validade limitada; sem reutilização.
- [ ] Confirmar política de logs sem códigos/tokens/payloads sensíveis, limites de tráfego, monitoramento, desligamento emergencial (flag e revogação) e responsável por incidentes.

## 3. Aceite técnico obrigatório
- [ ] Verificar transporte Neon real pelo servidor usando credenciais mínimas; confirmar que conexões para host/banco/papel não autorizados falham.
- [ ] Verificar 404 no ambiente público e produção; testar 401 sem sessão, 403 origem errada, sessão revogada, expiração, reuso de código, isolamento entre projetos e perfis, respostas no-store.
- [ ] Testar concorrência real no Neon, autoria, reenvio, cálculo, exportação e invalidação. Conferir PDF visualmente.
- [ ] Verificar ausência de exposição de segredos e dados de outro projeto. Revisar as limitações atuais: lista limitada, ações revalidadas explicitamente, origem autodeclarada não comprova veracidade, prévia exportada não revogável, ausência de snapshot imutável, auditoria parcial, retenção e recuperação de dados ainda não definidas.
- [ ] Registrar responsável, commit exato, hostname protegido, data, evidências e decisão aprovado/reprovado. Sem aprovação, manter bloqueado.

## 4. Dia 1
Somente após gate técnico, executar o roteiro conectado com dois perfis fictícios. Teste de usabilidade não equivale a aprovação para clientes reais. Separadamente, decidir metodologia, limites profissionais, regras comerciais e financeiras, LGPD, retenção, direitos e segurança definitiva antes de piloto real.
