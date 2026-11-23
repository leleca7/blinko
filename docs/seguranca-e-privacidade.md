# BLINKO — Segurança e Privacidade do Site (cópia de trabalho)
Última revisão: 23/11/2026

## Objetivo
Usar como referência a estrutura documentada na VALTEC (Privacidade, Termos, Solicitações de Dados e proteção administrativa), **adaptando** às operações, ferramentas, dados e riscos reais da Blinko.

Este registro não é certificado de conformidade LGPD, laudo de pentest ou garantia de ausência de ataques.

## Realizado na branch de prévia
- Página /privacidade — categorias de dados, finalidades, bases legais, fornecedores, acesso, conservação e direitos; sinaliza pendências institucionais.
- Página /termos-de-uso — separa triagem gratuita, diagnóstico pago obrigatório e implementação posterior e facultativa.
- Página /solicitacoes-de-dados — canal e procedimento de solicitações do titular, sem coletar documentos sensíveis na triagem.
- Rodapé da home e consentimento da triagem com links diretos às páginas legais; consentimento da segunda etapa com links.
- Cabeçalhos HTTP globais: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS e CSP **parcial** (base-uri, form-action, frame-ancestors, object-src, upgrade-insecure-requests).
- Cache-Control no-store em rotas /api/* e /interno/*.
- Verificação de Origin e limite de payload nas rotas de login/logout; verificação de Origin e tamanho no questionário completo.
- GitHub Actions secret-guard para rejeitar .env rastreado e detectar alguns padrões de credenciais. Não substitui ferramentas dedicadas de detecção nem revisão humana.
- O login administrativo existente usa comparação de credenciais protegida contra diferenças temporais, cookie HttpOnly/SameSite/Secure e sessão com assinatura HMAC e expiração. Ele NÃO oferece limitação de tentativas por si só.

## BLOQUEADORES para ativar recebimento de dados ou publicar
1. **Banco de teste** — migrar a tabela de triagem no ambiente de teste isolado, validar tipos, chaves, privilégios, backup e recuperação. Não aplicar migrações de prévia diretamente na produção sem revisão. A triagem atual deve permanecer indisponível enquanto a tabela não existir.
2. **Rate limiting / WAF** — configurar regras efetivas por rota e testar limites para /api/triagem, /api/pre-diagnostico e /api/interno/login. A infraestrutura atual não mostrou regra personalizada ativa. Medidas client-side ou em memória de função serverless não são suficientes contra abuso distribuído.
3. **Proteção antispam** — validar honeypot de campo REAL no formulário curto ou implantar desafio/serviço anti-bot proporcional ao risco. A API verifica campo companyFax, mas o formulário curto ainda envia esse campo sempre vazio, portanto o mecanismo não captura bots que ignoram o campo.
4. **Controle de acesso** — revisão humana de todos os endpoints /api/interno/*, permissões mínimas no banco e planilha, contas individualizadas para pessoas autorizadas, rotação de credenciais, autenticação forte e proteção específica da área administrativa.
5. **Integrações** — testar de ponta a ponta Neon ↔ Sheets ↔ e-mails; estabelecer sincronização, retries e alertas de falha. A abertura de link WhatsApp NÃO comprova mensagem enviada. Não expor URL/segredo do webhook em cliente ou repositório.
6. **Identificação jurídica e privacidade** — preencher e validar identificação do controlador, canal de privacidade, responsável interno, inventário de dados, fornecedores efetivos, bases legais por finalidade, eventuais transferências, retenção (com prazo e critérios), exclusão de banco/planilha/backups e resposta a direitos.
7. **Transparência e cookies** — examinar scripts e cookies realmente presentes no build de produção. Se ativar analytics, publicidade ou pixels, revisar necessidade de consentimento, configurações e aviso antes de coletar.
8. **Incidentes** — designar responsável, canal de reporte, procedimento de contenção, preservação de evidências, avaliação de riscos e notificação à ANPD/titulares quando cabível.
9. **Testes** — fluxo e consentimento em dispositivo móvel, dados fictícios, fluxo de abandono, anonimização de logs, formulários longos, rate limit, permissões negativas, headers em ambiente publicado, acessibilidade, revisão de dependências e eventual pentest proporcional ao risco.
10. **Publicação** — alinhar domínio, proteção de deploy da Vercel, robots, URL canônica, privacidade e termos aprovados. Preview protegida não equivale a acesso público de cliente; não remover proteção da administração ao liberar a home.

## Princípios operacionais
- Coletar apenas dados necessários, explicar a finalidade e permitir retorno quando autorizado; não usar consentimento de atendimento como opt-in de marketing.
- Separar diagnóstico gratuito? **Não**: a triagem inicial é gratuita; o diagnóstico é pago e obrigatório antes da execução.
- Não solicitar documentos pessoais, senhas, dados de cartão ou informações sensíveis pelo formulário curto.
- Preservar confidencialidade de pesquisas empresariais e de pessoas entrevistadas; limitar compartilhamento de dados e acesso de prestadores.
- Ao usar casos ou resultados de clientes, exigir verificação e autorização, sem divulgar dados de terceiros.
- Fazer cópia/testes em ambiente isolado sem exportar dados reais, aplicar princípio do menor privilégio e evitar logs contendo dados pessoais.
- Segurança é processo contínuo: atualizar dependências, verificar alertas, revisar acessos e reavaliar riscos após novas integrações.

## Fontes oficiais e referências
- ANPD — Guia de Segurança para Agentes de Tratamento de Pequeno Porte:
  https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-sobre-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte
- ANPD — Regulamento para agentes de tratamento de pequeno porte:
  https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
- OWASP — HTTP Security Headers:
  https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet
- OWASP — Authentication:
  https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

## Arquivos desta revisão
- app/privacidade/page.tsx
- app/termos-de-uso/page.tsx
- app/solicitacoes-de-dados/page.tsx
- app/legal.module.css
- app/page.tsx
- app/diagnostico/QuickTriageForm.tsx
- app/diagnostico/completo/ComprehensiveDiagnosticForm.tsx
- app/api/interno/login/route.ts e logout/route.ts
- app/api/pre-diagnostico/route.ts
- next.config.ts
- .github/workflows/secret-guard.yml
