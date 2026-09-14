# Ativação do WhatsApp oficial na Blinko

A base de conversas, mensagens, vínculo com CRM e aprovação humana já existe no Blinko OS.

A integração com a Meta fica **inativa por padrão**. Nenhuma credencial deve ser adicionada ao GitHub.

## Variáveis server-only

Configure no ambiente de produção/Preview da Vercel, conforme necessário:

```text
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_VERIFY_TOKEN=
META_WHATSAPP_APP_SECRET=
META_GRAPH_API_VERSION=
```

`META_GRAPH_API_VERSION` deve ser informada explicitamente no formato `vXX.X`. A aplicação não fixa uma versão da Graph API no código.

Nunca use prefixo `NEXT_PUBLIC_` nessas variáveis.

## Webhook

Endpoint da Blinko:

```text
https://SEU-DOMINIO/api/whatsapp/meta/webhook
```

O endpoint possui:

- `GET` para o challenge de verificação;
- `POST` com validação de `X-Hub-Signature-256` usando o App Secret;
- ingestão idempotente de mensagens recebidas;
- atualização de status de mensagens enviadas (`sent`, `delivered`, `read`, `failed`).

O token usado no challenge deve ser o mesmo valor de `META_WHATSAPP_VERIFY_TOKEN`.

## Fluxo de saída

1. A Blinko cria um rascunho no OS.
2. Um humano aprova o rascunho.
3. Apenas uma mensagem `approved` pode ser reservada para envio.
4. O OS envia pelo provedor oficial.
5. O `message_id` retornado pelo provedor é salvo no histórico.
6. Webhooks posteriores atualizam entrega e leitura.

O claim muda temporariamente a mensagem para `queued`, evitando dois cliques simultâneos enviarem a mesma mensagem duas vezes.

Se o provedor rejeitar a chamada, o claim é liberado e a mensagem volta para `approved`.

Se o provedor aceitar o envio mas houver falha ao registrar localmente, a mensagem permanece `queued` para impedir reenvio acidental e exigir reconciliação.

## Fluxo de entrada

Mensagens recebidas pelo número configurado entram em `/interno/whatsapp`.

Quando o telefone corresponde de forma única a um lead existente, o vínculo com o CRM é feito automaticamente. Quando não há correspondência segura, a conversa continua disponível na caixa de entrada para vínculo humano.

Mensagens duplicadas com o mesmo ID externo não aumentam novamente o contador de não lidas.

## Limites desta etapa

- somente envio de texto livre pelo adaptador oficial;
- templates do WhatsApp ainda não foram implementados;
- anexos recebidos são registrados como metadados, mas download/armazenamento de mídia fica para etapa posterior;
- a IA pode futuramente preparar rascunhos, mas não recebe permissão para enviar mensagens sem aprovação humana;
- credenciais e regras comerciais do provedor continuam externas ao repositório.
