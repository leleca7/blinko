# Blinko OS — entrega da fase 1 para ensaio

## Estado verificado
- Commit de código validado: 55e54345c575f4e6760eac3578bd977e114c4a10.
- [CI 45644126269](https://github.com/leleca7/blinko/actions/runs/45644126269): ambos os jobs aprovados; 50 testes unitários, oito cenários Chromium, TypeScript, 13 migrações SQL, jornada HTTPS local e rejeição de sessão revogada na entrada.
- [Demonstração visual](https://blinko-537a9wg50-blinkojobs.vercel.app/os-preview): commit a383333f, logo transparente verificada, dados fictícios em memória. Não equivale ao laboratório conectado. Rotas persistentes bloqueadas.
- Banco Neon isolado: migrações e testes sintéticos realizados; transporte real da aplicação não validado.

## Diretriz visual confirmada pelo responsável
Manter sistema, dados, metodologia, funcionalidades, permissões, fluxos, logo transparente original e padrão documental aprovado. Protótipo externo é referência exclusivamente estética (cartões, hierarquia, espaçamento, disposição e abas). Não copiar dados, código, estrutura funcional ou substituir o sistema. Branch preview/blinko-referencias-20261125 permanece isolada, sem merge; não contém acervo estratégico privado. Não acrescentar módulo Referências com base apenas no protótipo visual.

## Passagem de responsabilidade
1. Ensaio visual e de usabilidade por integrantes da Blinko em dados fictícios, conforme BLINKO-OS-DIA-1.md.
2. Revisão do parceiro técnico conforme BLINKO-OS-GATE-TECNICO.md. Registrar aceite do ambiente e do commit exato; não compartilhar segredos por chat ou documentos.
3. Configuração restrita de ambiente de teste, somente após aceite técnico. Não alterar main, produção ou aliases públicos. Validar transporte Neon e isolamento.
4. Ensaio conectado conforme BLINKO-OS-DIA-1-CONECTADO.md; registrar resultado por etapa.
5. Corrigir falhas verificadas antes de aprovar piloto real. Congelar expansão de funcionalidades até feedback.

## Registro de devolutiva
Para cada cenário: perfil fictício, dispositivo, ação, comportamento observado, esperado, gravidade, evidência sem dados sensíveis. Classificar passou/falhou/não executado. Falhas de segurança, isolamento, cálculo, perda de dados ou entrega indevida bloqueiam aceite.

## Pendências explícitas
Revisão humana ainda não realizada, conexão real ainda não habilitada, auditoria e retenção definitivas ainda não estabelecidas, assistência determinística não integrada ao workspace persistente, publicação de dados reais vedada. Testes locais não são certificação de produção. A direção comercial e metodologia precisam de aprovação própria.
