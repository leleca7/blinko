# Checklist técnico — liberação do Blinko OS
Estado: prévia experimental. Não autoriza publicação nem uso de dados reais.

## Gate A — aceitação do laboratório
- Conferir o workflow Blinko OS - sandbox acceptance na branch experimental.
- Registrar SHA, resultado dos 27 testes unitários e execução Chromium, não apenas o build da Vercel.
- Inspecionar PDF, TXT, captura mobile e eventuais erros. Confirmar que são fictícios.
- Se houver falha, corrigir o caso específico e executar novamente.
- Confirmar que /api/triagem, /api/os-lab/projects e /interno retornam 404 na prévia.
- Confirmar separação dos projetos, invalidação de revisão e ausência de campos internos na projeção do portal.
- Não interpretar a aprovação da demo como auditoria ou teste de autenticação.

## Gate B — revisão técnica humana
- Revisar lib/os-lab/session.ts, repository.ts, app/api/os-lab/projects/route.ts e database/sandbox/001_os_lab.sql.
- Definir identidade individual, emissão de sessão após autenticação, revogação, expiração, cookies Secure/HttpOnly/SameSite, rate limiting e tratamento de erros.
- Confirmar papel de runtime restrito, sem bypass de RLS, sem privilégios administrativos, com acesso exclusivo ao sandbox.
- Revisar escopo por organização/projeto, políticas de escrita e trilha de auditoria. Contexto SQL do ator só pode vir da sessão validada.
- Configurar credenciais por canal seguro, fora do GitHub e do chat, somente em ambiente protegido e isolado. Não habilitar LOGIN ou abrir proxy nesta etapa sem aprovação técnica.

## Gate C — integração protegida com o sandbox
- Usar somente o banco sintético independente. Conferir host, banco e papel esperados; nunca utilizar fallback de produção.
- Testar HTTP: ausência de sessão, sessão alterada/expirada/revogada, usuário inativo, permissão de leitura/escrita, projeto alheio e outra organização, origem indevida, corpo inválido, falha de banco.
- Confirmar gravação e leitura em nova sessão, concorrência, deduplicação e integridade. Testar auditoria.
- Integrar interface por etapas; manter triagem pública e portal externo bloqueados.
- Não conectar provedor de IA até aprovar tratamento de dados, limites e revisão humana.

## Gate D — piloto comercial
- Aprovar metodologia, escopo profissional, precificação, privacidade, retenção e contratos.
- Validar processo de atendimento e resposta a incidentes.
- Exigir aceite humano explícito, backup, plano de rollback e revisão dos ambientes antes de qualquer publicação.
- O site institucional oficial, banco de produção e domínios atuais não fazem parte desta liberação experimental.

## Evidência de aceite
Para cada gate, registrar responsável, data, commit, ambiente, resultado observado e pendências. Sem evidência, manter pendente. Não guardar senhas, tokens, dados de clientes ou detalhes pessoais neste repositório público.
