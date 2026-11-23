# Blinko · Triagem V2 — implantação controlada

Esta branch é PRÉVIA. NÃO substituir a versão de produção automaticamente.

## Arquitetura

- /diagnostico: duas telas. A primeira salva contato após consentimento explícito.
- /diagnostico/completo: preserva o questionário antigo, mais longo, para etapa posterior encaminhada pela equipe.
- /api/triagem: cria contato inicial (started), conclui (submitted) e registra abertura do link WhatsApp (whatsapp_opened — NÃO confirma mensagem enviada).
- Neon: public.blinko_triage_v2 é a fonte primária. A migração está em migrations/20261123_triage_v2.sql. Não está aplicada automaticamente.
- Google Sheets: espelho opcional de ambos os formulários, feito pelo Web App integrations/google-apps-script/Code.gs.
- E-mail: avisos internos via Apps Script após conclusão e, se ativado o gatilho, lembretes de possíveis abandonos após 24 horas.
- WhatsApp: encaminhamento por wa.me após a triagem, dependente do número comercial; o visitante precisa tocar em Enviar. Mensagem real recebida só pode ser confirmada pela equipe ou pelo WhatsApp Business Cloud API integrado.

## Central de Leads

Planilha Google Sheets já criada (estrutura inicial, sem dados):
https://docs.google.com/spreadsheets/d/1w5fBSKN8b81hdjET8fQJxLVlpmXPwiffTTXCrMWeO6I/edit

Abas:
- Triagem: ID, etapas, datas, contato, demanda, status, próximo contato. Coluna Q calcula Possível abandono após 24 horas sem conclusão.
- Diagnóstico: respostas do questionário completo, pendências e responsável.
- Painel: contagens.
- Instruções: conceitos e limites de interpretação.

## Passos para TESTE — ainda não executados

1. Validar política de privacidade, base legal, período de retenção, quem acessa os dados e como solicitar exclusão. O formulário pede autorização para registro e retorno, não para marketing.
2. Aplicar a migração SOMENTE numa branch de teste do Neon; conferir índices, permissões e ausência de leitura pública. Não modificar produção sem revisão e autorização.
3. Configurar DATABASE_URL da Vercel Preview para a branch de teste Neon. Não reutilizar a variável de produção sem uma decisão consciente.
4. Na Central de Leads, abrir Extensões > Apps Script, colar Code.gs e criar propriedades de script:
   BLINKO_SPREADSHEET_ID = ID da planilha da URL.
   BLINKO_WEBHOOK_SECRET = segredo aleatório forte, fora do repositório.
   BLINKO_ALERT_EMAILS = e-mails internos separados por vírgula (opcional).
5. Revisar exposição: um Web App do Apps Script acessível a Vercel pode exigir acesso amplo à URL. Se publicado para Qualquer pessoa, a segurança depende da proteção do segredo. Para produção, preferir integração com conta de serviço e Google Sheets API ou gateway autenticado para dados pessoais. Não publicar antes da revisão de segurança.
6. Após autorizar permissões de planilha e e-mail, implantar o Apps Script como Web App Executar como eu, com URL /exec. Configurar em Vercel Preview:
   BLINKO_SHEETS_WEBHOOK_URL = URL /exec.
   BLINKO_SHEETS_WEBHOOK_SECRET = mesmo segredo do Apps Script.
   BLINKO_WHATSAPP_NUMBER = número comercial em formato internacional, somente dígitos, com DDI 55 se Brasil.
7. Opcional: criar gatilho de tempo para checkAbandoned (a cada hora ou por dia). Ele envia aviso PARA A EQUIPE se alguém consentiu e não terminou em 24h. Não envia mensagem automática ao visitante.
8. Testar no mobile/desktop em ambiente separado: começar e abandonar, concluir, abrir WhatsApp sem enviar, envio completo, erros de rede, tentativas repetidas, contatos inválidos, e-mail e planilha.
9. Confirmar proteção de dados e idempotência. O espelho do Sheets é melhor esforço; se o Apps Script falhar, o registro permanece no Neon e exigirá conciliar registros pendentes. Antes da produção, adicionar retry ou reconciliação segura.
10. Só publicar no domínio real depois dos testes, da decisão comercial das duas rotas, da aprovação dos textos de privacidade e da revisão de acesso.

## Regras de negócio ainda em aberto

- Rota Express de briefing simples x exigência de diagnóstico pago antes de todo serviço: decisão pendente.
- WhatsApp oficial e e-mails de destino: não informados.
- Prazo de atendimento e responsável pelo retorno: a definir.
- Questionário completo ainda pede contato no fim. Para evitar duplicação, considerar convite autenticado/temporário associado à triagem, sem dados pessoais em parâmetros de URL.
- O CRM da Blinko já possui leads; integrar essa fonte antes de operar duas filas paralelas.
- Só contar mensagem enviada após webhook de recebimento ou confirmação humana; clicar em link não é prova.

## Nota LGPD e segurança

Registrar autorização com versão e data. Minimizar dados (e-mail opcional), restringir acesso à planilha, nunca incluir respostas privadas na URL do WhatsApp, não enviar promoções com essa autorização, estabelecer prazo de guarda e exclusão. Proteger endpoint contra spam e abuso (Vercel WAF/rate limit) antes de receber tráfego.
