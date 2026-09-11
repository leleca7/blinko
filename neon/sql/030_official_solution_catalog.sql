-- Blinko OS — Catálogo oficial de soluções S01–S40 + vínculo com intervenção/projeto
-- Fonte: 04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS · v1.0 · 09/09/2026
-- Depende de 026_project_onboarding_readiness.sql e das tabelas solution_* existentes.
-- Não contém preço, margem nem percentual de parceiro. Solução é consequência do diagnóstico.

alter table public.solution_blueprints
  add column if not exists official_code text,
  add column if not exists nucleus_code text,
  add column if not exists nucleus_name text,
  add column if not exists official_status text,
  add column if not exists catalog_status text,
  add column if not exists execution_routes text[] not null default '{}',
  add column if not exists diagnostic_triggers text[] not null default '{}',
  add column if not exists related_pillars text[] not null default '{}',
  add column if not exists applicability text,
  add column if not exists prerequisites jsonb not null default '[]'::jsonb,
  add column if not exists base_scope text,
  add column if not exists base_deliverables jsonb not null default '[]'::jsonb,
  add column if not exists exclusions jsonb not null default '[]'::jsonb,
  add column if not exists dependencies jsonb not null default '[]'::jsonb,
  add column if not exists quality_criteria jsonb not null default '[]'::jsonb,
  add column if not exists completion_criteria text,
  add column if not exists result_indicator text,
  add column if not exists source_version text,
  add column if not exists source_document text;

alter table public.solution_blueprints drop constraint if exists solution_blueprints_official_code_check;
alter table public.solution_blueprints add constraint solution_blueprints_official_code_check
  check (official_code is null or official_code ~ '^S(0[1-9]|[1-3][0-9]|40)$');
alter table public.solution_blueprints drop constraint if exists solution_blueprints_catalog_status_check;
alter table public.solution_blueprints add constraint solution_blueprints_catalog_status_check
  check (catalog_status is null or catalog_status in ('active','pilot','structuring','consultation','suspended'));
create unique index if not exists solution_blueprints_official_code_uidx
  on public.solution_blueprints(official_code) where official_code is not null;

insert into public.solution_blueprints(
  official_code,slug,name,category,nucleus_code,nucleus_name,official_status,catalog_status,execution_routes,
  problem_statement,status,customization_level,version,drive_document_url,diagnostic_triggers,related_pillars,
  applicability,prerequisites,base_deliverables,exclusions,completion_criteria,source_version,source_document,notes
) values
('S01','s01-diagnostico-blinko-completo','DIAGNÓSTICO BLINKO COMPLETO','diagnostico_estrategia','N01','Diagnóstico, Fundamentos e Estratégia','ATIVA / validação v1.0','active',array['R1'],'Falta de visão integrada sobre a empresa, prioridades indefinidas e decisões baseadas em percepção isolada.','ready','custom','1.0.0','https://docs.google.com/document/d/1bPzHTsLFulY5SeBcg8QVqE81OAq5kjCUIvgYsfFMRm4/edit',array[]::text[],array['todos'],'Aplicável quando é necessária leitura integrada e priorização estruturada.','[]'::jsonb,'["cadastro/contexto","análise dos dez pilares","índice de maturidade","mapa de achados","ICB","jornada do cliente","SWOT","prioridades","plano de ação","resumo executivo"]'::jsonb,'["execução automática de todas as recomendações"]'::jsonb,'Diagnóstico com controle de qualidade aprovado e prioridades definidas.','v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Solução oficial de diagnóstico; recomendações não são execução automática.'),
('S02','s02-estruturacao-fundamentos-empresariais','ESTRUTURAÇÃO DE FUNDAMENTOS EMPRESARIAIS','diagnostico_estrategia','N01','Diagnóstico, Fundamentos e Estratégia','ATIVA','active',array['R1','R4'],'Ausência ou fragilidade de propósito, missão, visão, valores, objetivos, diferenciais, público e fundamentos institucionais.','ready','custom','1.0.0',null,array['F01','F02','F03','F04','F05','F06','F07','F08','F09'],array['Fundamentos'],'Aplicável após validação de lacunas de fundamentos.','[]'::jsonb,'["documento de fundamentos","objetivos","público prioritário","diferenciais","princípios","SWOT validada","direcionamento de curto/médio prazo"]'::jsonb,'["parecer jurídico","parecer contábil","parecer societário"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S03','s03-organizacao-portfolio-oferta','ORGANIZAÇÃO DE PORTFÓLIO E OFERTA','diagnostico_estrategia','N01','Diagnóstico, Fundamentos e Estratégia','ATIVA','active',array['R1','R4'],'Serviços confusos, excesso de opções, escopos indefinidos e proposta de valor pouco clara.','ready','custom','1.0.0',null,array['O01','O02','O03','O04','O05','O06','O07','O08','O09','O10'],array['Oferta','Comercial','Marca'],'Aplicável quando a oferta precisa ser estruturada antes da venda.','[]'::jsonb,'["arquitetura de ofertas","categorias","escopos","entregáveis","limites","diferenciais","combinações","critérios comerciais preliminares"]'::jsonb,'["definição final de margem sem dados financeiros"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S04','s04-plano-estruturacao-empresarial','PLANO DE ESTRUTURAÇÃO EMPRESARIAL','diagnostico_estrategia','N01','Diagnóstico, Fundamentos e Estratégia','ATIVA','active',array['R1'],'Empresa reconhece problemas, mas não possui sequência executável.','ready','custom','1.0.0',null,array[]::text[],array[]::text[],'Aplicável quando existem prioridades suficientemente validadas.','["Diagnóstico Blinko concluído ou achados suficientemente validados"]'::jsonb,'["roadmap priorizado","responsáveis","dependências","horizontes","critérios de conclusão","indicadores"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S05','s05-naming-revisao-nome','NAMING / REVISÃO DE NOME','marca_identidade','N02','Marca e Identidade','ATIVA SOB ESCOPO','active',array['R1','R5'],'Nome inadequado, genérico, incoerente ou com risco aparente de conflito.','ready','custom','1.0.0',null,array['M01','M02'],array['Marca'],'Aplicável sob escopo e com encaminhamento especializado quando necessário.','[]'::jsonb,'["critérios de nome","geração e triagem de alternativas","análise estratégica","pesquisa preliminar de uso público"]'::jsonb,'["parecer jurídico","garantia de registrabilidade","protocolo no INPI por profissional não habilitado"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S06','s06-posicionamento-proposta-valor','POSICIONAMENTO E PROPOSTA DE VALOR','marca_identidade','N02','Marca e Identidade','ATIVA','active',array['R1'],'Marca genérica, dificuldade de explicar por que escolher a empresa e comunicação desconectada do negócio.','ready','custom','1.0.0',null,array['M05','M06','F04','F06'],array['Marca','Fundamentos'],'Aplicável após clareza mínima sobre negócio, público e oferta.','[]'::jsonb,'["posicionamento","promessa central","diferenciais","público","mensagens-chave","critérios de comunicação"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S07','s07-identidade-visual','IDENTIDADE VISUAL','marca_identidade','N02','Marca e Identidade','ATIVA SOB ESCOPO','active',array['R1','R2'],'Marca visual inexistente, amadora, inconsistente ou inadequada ao posicionamento.','ready','custom','1.0.0',null,array['M03','M04','M09'],array['Marca'],'Aplicável conforme escopo e maturidade do posicionamento.','[]'::jsonb,'["logo","paleta","tipografia","elementos visuais","aplicações essenciais","guia de uso"]'::jsonb,'["impressão","registro de marca","fotografia","site","gestão de redes"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Entregáveis variam conforme escopo.'),
('S08','s08-padronizacao-kit-marca','PADRONIZAÇÃO E KIT DE MARCA','marca_identidade','N02','Marca e Identidade','ATIVA','active',array['R1'],'Arquivos espalhados, versões incorretas e uso inconsistente da identidade.','ready','custom','1.0.0',null,array['M04','M08','M09'],array['Marca'],'Aplicável quando já existe material de marca a organizar/padronizar.','[]'::jsonb,'["organização dos arquivos oficiais","nomenclatura","aplicações","modelos-base","kit de entrega"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S09','s09-estruturacao-processo-comercial','ESTRUTURAÇÃO DO PROCESSO COMERCIAL','comercial','N03','Comercial','ATIVA','active',array['R1','R4'],'Vendas dependentes de improviso, ausência de etapas, follow-up irregular e falta de previsibilidade.','ready','custom','1.0.0',null,array['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12'],array['Comercial'],'Aplicável após confirmação de lacunas no processo comercial.','[]'::jsonb,'["fluxo comercial","etapas","critérios de avanço","responsabilidades","scripts/modelos","status","regras de acompanhamento"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S10','s10-implantacao-organizacao-crm','IMPLANTAÇÃO / ORGANIZAÇÃO DE CRM','comercial','N03','Comercial','PILOTO / SOB CONSULTA conforme ferramenta','pilot',array['R1','R2','R4'],'Leads espalhados, histórico perdido, falta de pipeline e acompanhamento.','beta','custom','1.0.0',null,array['C06','C07','C08','C09','C10','CL10','T03'],array['Comercial','Cliente','Tecnologia'],'Aplicabilidade e viabilidade dependem da ferramenta e do contexto.','[]'::jsonb,'["estrutura de pipeline","campos","status","regras de uso","organização/importação possível de base","orientação de rotina"]'::jsonb,'["licenças de software","integrações complexas","operação diária do CRM"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Não padronizar ferramenta/integração sem consulta.'),
('S11','s11-modelos-orcamento-proposta-comercial','MODELOS DE ORÇAMENTO E PROPOSTA COMERCIAL','comercial','N03','Comercial','ATIVA','active',array['R1'],'Propostas inconsistentes, informação incompleta, dificuldade de comparação e fechamento.','ready','custom','1.0.0',null,array['C04','C05','O04'],array['Comercial','Oferta'],'Aplicável quando o problema é estrutura e padronização da proposta.','[]'::jsonb,'["modelo","estrutura de informação","regras de preenchimento","apresentação","versões padronizadas"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S12','s12-follow-up-oportunidades','ROTINA DE FOLLOW-UP E CONTROLE DE OPORTUNIDADES','comercial','N03','Comercial','ATIVA','active',array['R1','R4'],'Propostas esquecidas e oportunidades sem próxima ação.','ready','custom','1.0.0',null,array['C06','C07','C10'],array['Comercial'],'Aplicável quando há perda de continuidade no acompanhamento comercial.','[]'::jsonb,'["cadência","status","regras de contato","modelos de mensagem","indicadores mínimos"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S13','s13-organizacao-presenca-digital','ORGANIZAÇÃO DA PRESENÇA DIGITAL','marketing_presenca','N04','Marketing e Presença Digital','ATIVA','active',array['R1'],'Canais desconectados, dados incorretos, falta de caminhos de contato e apresentação inconsistente.','ready','custom','1.0.0',null,array['MK01','MK02','MK03','MK04','M09'],array['Marketing','Marca'],'Aplicável quando a presença institucional precisa ser organizada antes de escalar conteúdo/mídia.','[]'::jsonb,'["diagnóstico de canais","correções institucionais","bio/descrições","links","hierarquia de presença","prioridades"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S14','s14-google-business-profile','GOOGLE BUSINESS PROFILE / PRESENÇA LOCAL','marketing_presenca','N04','Marketing e Presença Digital','ATIVA SOB ACESSO','active',array['R1','R4'],'Empresa local difícil de encontrar, perfil incompleto, informações inconsistentes e avaliações não trabalhadas.','ready','custom','1.0.0',null,array['MK02'],array['Marketing'],'Aplicável para presença local com acesso legítimo ao perfil.','["acesso legítimo ao perfil ou processo de reivindicação permitido pela plataforma"]'::jsonb,'["organização do perfil","categorias","informações","descrição","imagens existentes","produtos/serviços quando aplicável","orientação de avaliações","rotina de atualização"]'::jsonb,'["garantia de posição orgânica"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S15','s15-estrategia-planejamento-conteudo','ESTRATÉGIA E PLANEJAMENTO DE CONTEÚDO','marketing_presenca','N04','Marketing e Presença Digital','ATIVA','active',array['R1','R4'],'Conteúdo sem objetivo, frequência aleatória e comunicação genérica.','ready','custom','1.0.0',null,array['MK05','MK06','MK07','MK12'],array['Marketing'],'Aplicável quando existe necessidade validada de estruturar conteúdo.','[]'::jsonb,'["pilares de conteúdo","objetivos","formatos","calendário","campanhas","critérios de produção"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S16','s16-social-media-gestao-conteudo','SOCIAL MEDIA / GESTÃO DE CONTEÚDO','marketing_presenca','N04','Marketing e Presença Digital','ATIVA SOB ESCOPO','active',array['R1','R2','R4'],'Necessidade validada de execução contínua dos canais sociais.','ready','custom','1.0.0',null,array[]::text[],array['Marketing'],'Aplicável somente quando execução contínua é consequência do diagnóstico.','["marca e oferta suficientemente claras","responsável por aprovações","disponibilidade de materiais"]'::jsonb,'["planejamento","pautas","copy","design","calendário","publicação quando contratada","acompanhamento","relatório"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Não vender como resposta automática a qualquer problema de marketing.'),
('S17','s17-campanhas-comunicacao-promocional','CAMPANHAS E COMUNICAÇÃO PROMOCIONAL','marketing_presenca','N04','Marketing e Presença Digital','ATIVA','active',array['R1','R2'],'Oportunidade comercial ou sazonal sem estrutura de campanha.','ready','custom','1.0.0',null,array[]::text[],array['Marketing','Comercial'],'Aplicável quando há objetivo/oferta/campanha validados.','[]'::jsonb,'["objetivo","público","oferta","mensagem","peças","canais","cronograma","critérios de acompanhamento"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S18','s18-midia-paga-trafego','MÍDIA PAGA / TRÁFEGO','marketing_presenca','N04','Marketing e Presença Digital','SOB CONSULTA','consultation',array['R2','R3','R5'],'Necessidade validada de aquisição paga.','draft','custom','1.0.0',null,array[]::text[],array['Marketing','Comercial'],'Viabilidade depende de capacidade, rastreamento, orçamento e parceiro vigente.','["oferta viável","processo comercial apto a responder","rastreamento mínimo","orçamento"]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Não aumentar aquisição quando atendimento, conversão ou capacidade de entrega estiverem comprometidos.'),
('S19','s19-planejamento-audiovisual','PLANEJAMENTO AUDIOVISUAL','audiovisual','N05','Audiovisual','ATIVA','active',array['R1'],'Produção de fotos/vídeos sem finalidade estratégica.','ready','custom','1.0.0',null,array[]::text[],array['Marketing'],'Aplicável antes de captação quando é necessário definir finalidade e uso.','[]'::jsonb,'["pauta","objetivo","formatos","lista de captação","roteiro","referências","uso previsto"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S20','s20-fotografia-captacao-video','FOTOGRAFIA E CAPTAÇÃO DE VÍDEO','audiovisual','N05','Audiovisual','PILOTO / PARCERIA EM CADASTRO','pilot',array['R3','R2'],'Necessidade de material audiovisual profissional validada no diagnóstico ou planejamento.','beta','custom','1.0.0',null,array[]::text[],array['Marketing'],'Execução técnica depende de parceria audiovisual formalizada para o escopo.','["cadastro nominal, tabela e condições do parceiro devem ser formalizados antes de padronização"]'::jsonb,'[]'::jsonb,'["edição, deslocamento, equipamento especial e quantidade não são presumidos sem proposta específica"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Parceria audiovisual ainda em cadastro/piloto.'),
('S21','s21-edicao-adaptacao-audiovisual','EDIÇÃO E ADAPTAÇÃO AUDIOVISUAL','audiovisual','N05','Audiovisual','SOB CONSULTA / PARCERIA','consultation',array['R3','R2'],'Necessidade de transformar material bruto em conteúdo utilizável.','draft','custom','1.0.0',null,array[]::text[],array['Marketing'],'Aplicável sob consulta de parceiro e escopo.','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Escopo deve definir formatos, duração, quantidade, revisões, legendas e arquivos finais.'),
('S22','s22-criacao-peca-grafica','CRIAÇÃO DE PEÇA GRÁFICA','design_grafica','N06','Design e Produção Gráfica','ATIVA','active',array['R1'],'Cliente precisa de arte final para material impresso ou digital.','ready','custom','1.0.0',null,array[]::text[],array['Marca','Marketing'],'Aplicável quando a necessidade de peça está definida por briefing.','[]'::jsonb,'["peça conforme briefing, formato e revisões contratadas"]'::jsonb,'["impressão automática"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S23','s23-preparacao-adaptacao-impressao','PREPARAÇÃO / ADAPTAÇÃO PARA IMPRESSÃO','design_grafica','N06','Design e Produção Gráfica','ATIVA','active',array['R1'],'Arte existente precisa ser ajustada para especificação técnica de produção.','ready','custom','1.0.0',null,array[]::text[],array['Marca'],'Aplicável quando existe fornecedor/especificação técnica definida.','["requisitos técnicos do fornecedor"]'::jsonb,'["arquivo final preparado conforme especificação acordada"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S24','s24-producao-grafica-parceiro-helio','PRODUÇÃO GRÁFICA COM PARCEIRO — HÉLIO','design_grafica','N06','Design e Produção Gráfica','EM ESTRUTURAÇÃO / PILOTO CONTROLADO','structuring',array['R3','R2'],'Produção gráfica coordenada com parceiro ainda em validação operacional/comercial.','draft','custom','1.0.0',null,array[]::text[],array[]::text[],'Somente piloto controlado até validação ampla do parceiro e catálogo.','["catálogo confirmado","custos","prazos","quantidades","acabamentos","requisitos técnicos","logística","política de erro/reimpressão","cancelamento","regra final de divisão/repasse","recorrência de clientes","teste ponta a ponta"]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Não hardcodar percentual de repasse. Documento 07 é a autoridade financeira.'),
('S25','s25-producao-grafica-arte-pronta','PRODUÇÃO GRÁFICA COM ARTE PRONTA DO CLIENTE','design_grafica','N06','Design e Produção Gráfica','PILOTO CONTROLADO','pilot',array['R3'],'Cliente já possui arquivo e necessita apenas da produção.','beta','custom','1.0.0',null,array[]::text[],array[]::text[],'Aplicável em piloto quando arquivo e produção forem tecnicamente viáveis.','["validação técnica do arquivo"]'::jsonb,'[]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Adequações do arquivo podem gerar serviço adicional.'),
('S26','s26-producao-grafica-criacao-blinko','PRODUÇÃO GRÁFICA COM CRIAÇÃO BLINKO','design_grafica','N06','Design e Produção Gráfica','PILOTO CONTROLADO','pilot',array['R1','R3'],'Fluxo integrado de criação Blinko e produção gráfica por parceiro.','beta','custom','1.0.0',null,array[]::text[],array[]::text[],'Aplicável em piloto com briefing, arte aprovada e produção validada.','[]'::jsonb,'["briefing","criação/aprovação da arte","preparação técnica","orçamento de produção","aprovação","produção","conferência","entrega"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S27','s27-mapeamento-jornada-cliente','MAPEAMENTO E REDESENHO DA JORNADA DO CLIENTE','experiencia_cliente','N07','Experiência e Relacionamento com Cliente','ATIVA','active',array['R1','R4'],'Pontos de perda, demora, ruído ou abandono entre descoberta e pós-venda.','ready','custom','1.0.0',null,array['CL01','CL02','CL03','CL04','CL05','CL06','CL07','CL08','CL09','CL10','CL11','CL12'],array['Cliente'],'Aplicável quando a jornada apresenta atritos ou perda de continuidade.','[]'::jsonb,'["mapa atual","atritos","riscos","melhorias","responsabilidades","fluxo futuro"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S28','s28-padronizacao-atendimento-whatsapp','PADRONIZAÇÃO DE ATENDIMENTO E WHATSAPP','experiencia_cliente','N07','Experiência e Relacionamento com Cliente','ATIVA','active',array['R1','R4'],'Atendimento inconsistente, informações perdidas, demora e ausência de padrão.','ready','custom','1.0.0',null,array['CL02','CL03','C02','CL12'],array['Cliente','Comercial'],'Aplicável quando atendimento e registro precisam de padrão operacional.','[]'::jsonb,'["fluxo","mensagens/modelos","critérios de encaminhamento","dados mínimos","horários/regras","integrações possíveis"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S29','s29-pos-venda-satisfacao-retencao','PÓS-VENDA, SATISFAÇÃO E RETENÇÃO','experiencia_cliente','N07','Experiência e Relacionamento com Cliente','ATIVA','active',array['R1','R4'],'Relação termina após a venda; ausência de avaliação, retorno e recompra.','ready','custom','1.0.0',null,array['CL07','CL08','CL09'],array['Cliente'],'Aplicável quando existe necessidade validada de continuidade pós-venda.','[]'::jsonb,'["rotina de pós-venda","pesquisa","pedido de avaliação","cadência de relacionamento","indicadores"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S30','s30-mapeamento-desenho-processos','MAPEAMENTO E DESENHO DE PROCESSOS','operacao_processos','N08','Operação e Processos','ATIVA','active',array['R1','R4'],'Processo depende da memória, etapas não estão claras ou existe retrabalho.','ready','custom','1.0.0',null,array['OP01','OP02','OP03','OP04','OP05','OP06','OP07','OP08','OP09','OP10','OP11'],array['Operação'],'Aplicável quando processo precisa ser entendido antes de padronizar/automatizar.','[]'::jsonb,'["fluxo atual/futuro","etapas","entradas","saídas","responsáveis","controles","riscos"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S31','s31-checklists-procedimentos-padroes','CHECKLISTS, PROCEDIMENTOS E PADRÕES OPERACIONAIS','operacao_processos','N08','Operação e Processos','ATIVA','active',array['R1','R4'],'Execução variável e dependência de conhecimento informal.','ready','custom','1.0.0',null,array[]::text[],array['Operação'],'Aplicável após processo suficientemente entendido.','[]'::jsonb,'["checklist","procedimento operacional","critério de qualidade","responsabilidade"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S32','s32-organizacao-documental-arquivos','ORGANIZAÇÃO DOCUMENTAL E DE ARQUIVOS','operacao_processos','N08','Operação e Processos','ATIVA','active',array['R1','R4'],'Arquivos dispersos, versões duplicadas e dificuldade de localizar documentos.','ready','custom','1.0.0',null,array['OP08','T02','T07','T10'],array['Operação','Tecnologia'],'Aplicável quando a organização documental é um gargalo operacional.','[]'::jsonb,'["arquitetura de pastas","convenção de nomes","permissões","regra de versão","rotina de arquivamento"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S33','s33-organizacao-tarefas-projetos','ORGANIZAÇÃO DE TAREFAS E PROJETOS','operacao_processos','N08','Operação e Processos','ATIVA','active',array['R1','R4'],'Tarefas sem responsável, prazo ou status.','ready','custom','1.0.0',null,array['OP04','G06'],array['Operação','Gestão'],'Aplicável quando gestão de trabalho precisa de estrutura.','[]'::jsonb,'["estrutura de projetos","status","responsáveis","prioridades","revisões","ferramenta quando aplicável"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S34','s34-diagnostico-ferramentas-dados','DIAGNÓSTICO DE FERRAMENTAS E DADOS','tecnologia_automacao','N09','Tecnologia, Sistemas e Automação','ATIVA','active',array['R1'],'Excesso de ferramentas, duplicidade, dados dispersos e retrabalho.','ready','custom','1.0.0',null,array['T01','T02','T03','T04','T05','T06','T07','T08','T09','T10','T11','T12'],array['Tecnologia'],'Aplicável antes de trocar/automatizar ferramentas quando o cenário é incerto.','[]'::jsonb,'["inventário","finalidade","redundâncias","riscos","fluxos de dados","recomendação de simplificação"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S35','s35-sistema-interno-sob-medida','SISTEMA INTERNO SOB MEDIDA','tecnologia_automacao','N09','Tecnologia, Sistemas e Automação','PILOTO / SOB CONSULTA','pilot',array['R1','R2','R3'],'Processo estável e relevante não é bem atendido por ferramenta disponível ou centralização gera ganho suficiente.','beta','custom','1.0.0',null,array[]::text[],array['Tecnologia','Operação'],'Viabilidade depende de requisitos e ganho suficiente para justificar desenvolvimento.','["processo previamente entendido e padronizado","requisitos definidos","responsável pelo processo","viabilidade técnica e econômica"]'::jsonb,'["cadastro","fluxo","permissões","dashboards","documentos","tarefas","integrações","relatórios"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS','Não digitalizar processo que ainda muda constantemente.'),
('S36','s36-automacao-processos','AUTOMAÇÃO DE PROCESSOS','tecnologia_automacao','N09','Tecnologia, Sistemas e Automação','PILOTO / SOB CONSULTA','pilot',array['R1','R2','R3'],'Trabalho repetitivo e previsível com regra clara.','beta','custom','1.0.0',null,array['T04','T10','T12'],array['Tecnologia','Operação'],'Aplicável somente a processo estabilizado e suficientemente determinístico.','["processo estabilizado"]'::jsonb,'["alertas","mudanças de status","tarefas recorrentes","cálculos","integrações e outras automações definidas em escopo"]'::jsonb,'["decisões estratégicas sem validação humana"]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S37','s37-dashboards-indicadores-operacionais','DASHBOARDS E INDICADORES OPERACIONAIS','tecnologia_automacao','N09','Tecnologia, Sistemas e Automação','PILOTO','pilot',array['R1','R2'],'Informação existe, mas não está consolidada para decisão.','beta','custom','1.0.0',null,array[]::text[],array['Tecnologia','Gestão'],'Aplicável quando fonte de dados é minimamente confiável.','["fonte de dados minimamente confiável"]'::jsonb,'["indicadores","visualização","periodicidade","regras de atualização"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S38','s38-estrutura-metas-indicadores','ESTRUTURA DE METAS E INDICADORES','gestao','N10','Gestão','ATIVA','active',array['R1','R4'],'Empresa opera sem definição clara do que acompanhar.','ready','custom','1.0.0',null,array['G01','G02','G03','G11'],array['Gestão'],'Aplicável quando objetivos e indicadores precisam ser estruturados.','[]'::jsonb,'["objetivos","indicadores","responsáveis","fonte","periodicidade","metas quando houver base"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S39','s39-rotina-gestao-acompanhamento','ROTINA DE GESTÃO E ACOMPANHAMENTO','gestao','N10','Gestão','ATIVA','active',array['R1','R4'],'Decisões não são acompanhadas e planos desaparecem na rotina.','ready','custom','1.0.0',null,array['G04','G05','G06','G12'],array['Gestão'],'Aplicável quando falta cadência de acompanhamento e decisão.','[]'::jsonb,'["agenda de gestão","modelo de reunião","pauta","registro de decisão","pendências","revisão periódica"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null),
('S40','s40-papeis-responsabilidades','ORGANIZAÇÃO DE PAPÉIS E RESPONSABILIDADES','gestao','N10','Gestão','ATIVA','active',array['R1','R4'],'Centralização, conflito de responsabilidade e tarefas sem dono.','ready','custom','1.0.0',null,array['F09','F10','OP02','G08'],array['Fundamentos','Operação','Gestão'],'Aplicável quando responsabilidades e decisores estão pouco claros.','[]'::jsonb,'["mapa de responsabilidades","funções críticas","decisores","matriz simples de responsabilidade quando necessário"]'::jsonb,'[]'::jsonb,null,'v1.0','04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',null)
on conflict (slug) do update set
  official_code=excluded.official_code,name=excluded.name,category=excluded.category,nucleus_code=excluded.nucleus_code,
  nucleus_name=excluded.nucleus_name,official_status=excluded.official_status,catalog_status=excluded.catalog_status,
  execution_routes=excluded.execution_routes,problem_statement=excluded.problem_statement,status=excluded.status,
  customization_level=excluded.customization_level,version=excluded.version,drive_document_url=coalesce(excluded.drive_document_url,public.solution_blueprints.drive_document_url),
  diagnostic_triggers=excluded.diagnostic_triggers,related_pillars=excluded.related_pillars,applicability=excluded.applicability,
  prerequisites=excluded.prerequisites,base_deliverables=excluded.base_deliverables,exclusions=excluded.exclusions,
  completion_criteria=excluded.completion_criteria,source_version=excluded.source_version,source_document=excluded.source_document,
  notes=excluded.notes,updated_at=now();

-- Todas as linhas oficiais apontam para o mesmo Documento 04; evita repetir URL em 39 inserts acima.
update public.solution_blueprints
set drive_document_url='https://docs.google.com/document/d/1bPzHTsLFulY5SeBcg8QVqE81OAq5kjCUIvgYsfFMRm4/edit',updated_at=now()
where official_code is not null and drive_document_url is null;

alter table public.diagnostic_interventions
  add column if not exists blueprint_id uuid references public.solution_blueprints(id) on delete set null,
  add column if not exists selected_execution_route text;
alter table public.diagnostic_interventions drop constraint if exists diagnostic_interventions_execution_route_check;
alter table public.diagnostic_interventions add constraint diagnostic_interventions_execution_route_check
  check (selected_execution_route is null or selected_execution_route in ('R1','R2','R3','R4','R5','R6'));
create index if not exists diagnostic_interventions_blueprint_idx
  on public.diagnostic_interventions(blueprint_id) where blueprint_id is not null;

update public.diagnostic_interventions i
set blueprint_id=b.id,updated_at=now()
from public.solution_blueprints b
where b.official_code=upper(trim(i.library_key)) and i.blueprint_id is distinct from b.id;

create or replace function public.validate_diagnostic_intervention_catalog()
returns trigger language plpgsql set search_path=public as $$
declare v_blueprint_id uuid;v_code text;v_routes text[];
begin
  if new.blueprint_id is null and new.library_key ~* '^S(0[1-9]|[1-3][0-9]|40)$' then
    select id into v_blueprint_id from public.solution_blueprints where official_code=upper(trim(new.library_key));
    if v_blueprint_id is null then raise exception 'official solution code not found'; end if;
    new.blueprint_id:=v_blueprint_id;
  end if;

  if new.blueprint_id is not null then
    select official_code,execution_routes into v_code,v_routes from public.solution_blueprints where id=new.blueprint_id;
    if v_code is null then raise exception 'intervention blueprint is not an official solution'; end if;
    new.library_key:=v_code;
    if new.selected_execution_route is not null and not (new.selected_execution_route=any(v_routes)) then
      raise exception 'execution route is not allowed for official solution %',v_code;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists validate_diagnostic_intervention_catalog_trg on public.diagnostic_interventions;
create trigger validate_diagnostic_intervention_catalog_trg
  before insert or update of library_key,blueprint_id,selected_execution_route on public.diagnostic_interventions
  for each row execute function public.validate_diagnostic_intervention_catalog();

create table if not exists public.project_solutions(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  intervention_id uuid not null references public.diagnostic_interventions(id) on delete restrict,
  blueprint_id uuid not null references public.solution_blueprints(id) on delete restrict,
  company_solution_id uuid references public.company_solutions(id) on delete set null,
  solution_code text not null,
  selected_route text check (selected_route is null or selected_route in ('R1','R2','R3','R4','R5','R6')),
  route_status text not null default 'to_define' check (route_status in ('to_define','confirmed')),
  status text not null default 'onboarding' check (status in ('onboarding','active','paused','completed','cancelled')),
  completion_evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,intervention_id)
);
create index if not exists project_solutions_project_idx on public.project_solutions(project_id,status);
create index if not exists project_solutions_blueprint_idx on public.project_solutions(blueprint_id);

create or replace function public.ensure_project_solution_links(p_project_id uuid)
returns void language plpgsql set search_path=public as $$
declare
  v_company_id uuid;v_created_by text;v_item text;v_intervention public.diagnostic_interventions%rowtype;
  v_blueprint public.solution_blueprints%rowtype;v_company_solution_id uuid;v_project_solution_id uuid;v_module text;
begin
  select company_id,created_by_label into v_company_id,v_created_by from public.projects where id=p_project_id;
  if v_company_id is null then raise exception 'project not found'; end if;

  for v_item in select value from jsonb_array_elements_text(coalesce((select intervention_ids from public.projects where id=p_project_id),'[]'::jsonb)) loop
    select * into v_intervention from public.diagnostic_interventions where id=v_item::uuid;
    if v_intervention.id is null then continue; end if;
    if v_intervention.blueprint_id is null and v_intervention.library_key ~* '^S(0[1-9]|[1-3][0-9]|40)$' then
      select id into v_intervention.blueprint_id from public.solution_blueprints where official_code=upper(trim(v_intervention.library_key));
      if v_intervention.blueprint_id is not null then update public.diagnostic_interventions set blueprint_id=v_intervention.blueprint_id,updated_at=now() where id=v_intervention.id; end if;
    end if;
    if v_intervention.blueprint_id is null then continue; end if;

    select * into v_blueprint from public.solution_blueprints where id=v_intervention.blueprint_id and official_code is not null;
    if v_blueprint.id is null then continue; end if;

    insert into public.company_solutions(company_id,blueprint_id,status,selected_version,notes,selected_by_label)
    values(v_company_id,v_blueprint.id,'selected',coalesce(v_blueprint.source_version,v_blueprint.version),'Originada de intervenção validada no Diagnóstico Blinko.',coalesce(v_created_by,'system'))
    on conflict(company_id,blueprint_id) do update
      set selected_version=excluded.selected_version,updated_at=now()
    returning id into v_company_solution_id;

    insert into public.project_solutions(project_id,intervention_id,blueprint_id,company_solution_id,solution_code,selected_route,route_status,status)
    values(p_project_id,v_intervention.id,v_blueprint.id,v_company_solution_id,v_blueprint.official_code,v_intervention.selected_execution_route,
      case when v_intervention.selected_execution_route is null then 'to_define' else 'confirmed' end,
      case when (select status from public.projects where id=p_project_id)='active' then 'active' else 'onboarding' end)
    on conflict(project_id,intervention_id) do update
      set blueprint_id=excluded.blueprint_id,company_solution_id=excluded.company_solution_id,solution_code=excluded.solution_code,
          selected_route=coalesce(public.project_solutions.selected_route,excluded.selected_route),
          route_status=case when coalesce(public.project_solutions.selected_route,excluded.selected_route) is null then 'to_define' else 'confirmed' end,
          updated_at=now()
    returning id into v_project_solution_id;

    v_module:='solution_'||lower(v_blueprint.official_code)||'_route';
    insert into public.project_onboarding_items(project_id,solution_code,module_code,label,category,requirement,status,source_type,source_reference,evidence,notes)
    values(p_project_id,v_blueprint.official_code,v_module,v_blueprint.official_code||' · Rota de execução confirmada','solution','required',
      case when v_intervention.selected_execution_route is null then 'pending' else 'done' end,
      'solution',v_blueprint.id::text,
      case when v_intervention.selected_execution_route is null then null else 'Rota '||v_intervention.selected_execution_route||' registrada na intervenção.' end,
      'Rotas permitidas: '||array_to_string(v_blueprint.execution_routes,', '))
    on conflict(project_id,module_code) do nothing;

    if jsonb_array_length(v_blueprint.prerequisites)>0 then
      v_module:='solution_'||lower(v_blueprint.official_code)||'_prerequisites';
      insert into public.project_onboarding_items(project_id,solution_code,module_code,label,category,requirement,status,source_type,source_reference,notes)
      values(p_project_id,v_blueprint.official_code,v_module,v_blueprint.official_code||' · Pré-requisitos da solução validados','solution','required','pending','solution',v_blueprint.id::text,v_blueprint.prerequisites::text)
      on conflict(project_id,module_code) do nothing;
    end if;
  end loop;

  if exists(select 1 from public.project_solutions where project_id=p_project_id) then
    update public.project_onboarding_items
       set requirement='not_required',status='not_applicable',notes='Substituído pelos módulos específicos das soluções oficiais.',updated_at=now()
     where project_id=p_project_id and module_code='solution_specific_setup' and requirement='to_define';
  end if;
end; $$;

-- Toda garantia do onboarding também garante os vínculos de solução.
create or replace function public.ensure_project_onboarding_items(p_project_id uuid)
returns void language plpgsql set search_path=public as $$
declare v_company_id uuid;v_proposal_id uuid;v_diagnostic_id uuid;
begin
  select p.company_id,p.proposal_id,pr.diagnostic_id into v_company_id,v_proposal_id,v_diagnostic_id
  from public.projects p join public.proposals pr on pr.id=p.proposal_id where p.id=p_project_id;
  if v_company_id is null then raise exception 'project not found'; end if;

  insert into public.project_onboarding_items(project_id,module_code,label,category,requirement,status,source_type,source_reference)
  values
    (p_project_id,'operational_owner_confirmed','Responsável operacional confirmado','governance','required','pending','company',v_company_id::text),
    (p_project_id,'communication_flow_defined','Fluxo de comunicação e aprovações definido','communication','required','pending','project',p_project_id::text),
    (p_project_id,'delivery_plan_confirmed','Plano inicial de entregas confirmado','planning','required','pending','proposal',v_proposal_id::text),
    (p_project_id,'measurement_baseline_confirmed','Linha de base/forma de medição confirmada','measurement','required','pending','diagnostic',v_diagnostic_id::text),
    (p_project_id,'kickoff_completed','Kickoff concluído','kickoff','required','pending','project',p_project_id::text),
    (p_project_id,'solution_specific_setup','Configuração específica da solução','solution','to_define','pending','solution',null)
  on conflict(project_id,module_code) do nothing;

  perform public.ensure_project_solution_links(p_project_id);
end; $$;

create or replace function public.set_project_solution_route(p_project_id uuid,p_project_solution_id uuid,p_route text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$
declare v_blueprint_id uuid;v_intervention_id uuid;v_code text;v_routes text[];v_module text;
begin
  perform public.ensure_project_onboarding_items(p_project_id);
  select ps.blueprint_id,ps.intervention_id,ps.solution_code,b.execution_routes
    into v_blueprint_id,v_intervention_id,v_code,v_routes
  from public.project_solutions ps join public.solution_blueprints b on b.id=ps.blueprint_id
  where ps.id=p_project_solution_id and ps.project_id=p_project_id for update;
  if v_blueprint_id is null then raise exception 'project solution not found'; end if;
  if p_route is null or not (p_route=any(v_routes)) then raise exception 'execution route is not allowed for solution %',v_code; end if;

  update public.project_solutions set selected_route=p_route,route_status='confirmed',updated_at=now() where id=p_project_solution_id;
  update public.diagnostic_interventions set selected_execution_route=p_route,updated_at=now() where id=v_intervention_id;
  v_module:='solution_'||lower(v_code)||'_route';
  perform public.set_project_onboarding_item(p_project_id,v_module,'required','done','Rota '||p_route||' confirmada para '||v_code||'.',p_actor_label,null,null,null,null,'Rota escolhida entre as permitidas pelo catálogo oficial.',p_actor_label);

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_solution',p_project_solution_id,'project_solution_route_confirmed',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'solution_code',v_code,'route',p_route));
  return p_project_solution_id;
end; $$;

create or replace function public.project_solution_sync_from_project()
returns trigger language plpgsql set search_path=public as $$
begin
  perform public.ensure_project_solution_links(new.id);
  if new.status='active' then update public.project_solutions set status='active',updated_at=now() where project_id=new.id and status='onboarding';
  elsif new.status='paused' then update public.project_solutions set status='paused',updated_at=now() where project_id=new.id and status in ('onboarding','active');
  elsif new.status in ('completed','closed') then update public.project_solutions set status='completed',updated_at=now() where project_id=new.id and status not in ('completed','cancelled');
  end if;
  return new;
end; $$;

drop trigger if exists project_solution_sync_trg on public.projects;
create trigger project_solution_sync_trg after insert or update of status,intervention_ids on public.projects
for each row execute function public.project_solution_sync_from_project();

-- Backfill apenas por códigos Sxx já registrados explicitamente nas intervenções.
do $$ declare r record; begin
  for r in select id from public.projects loop
    perform public.ensure_project_onboarding_items(r.id);
  end loop;
end $$;
