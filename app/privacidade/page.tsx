import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

const CONTACT = "https://wa.me/5571920027233?text=" + encodeURIComponent("Olá, gostaria de falar sobre privacidade e meus dados pessoais na Blinko.");
export const metadata: Metadata = {
 title:"Política de Privacidade | Blinko Studio",
 description:"Como a Blinko trata dados pessoais recebidos na triagem, no diagnóstico e nos canais de atendimento.",
 robots:{index:false,follow:true},
};

export default function PoliticaPrivacidade() {
 return <div className={styles.page}>
  <header className={styles.top}><Link className={styles.brand} href="/" aria-label="Blinko Studio — início"><img src="/brand/logo-fundo-verde.svg" alt="Blinko Studio" /></Link><Link className={styles.back} href="/">← Voltar ao site</Link></header>
  <main className={styles.main}>
   <span className={styles.eyebrow}>Blinko Studio · Transparência e dados</span>
   <h1>Política de Privacidade</h1>
   <p className={styles.updated}>Versão para revisão · 23 de novembro de 2026</p>
   <p className={styles.lede}>Esta política explica como a Blinko Studio trata dados pessoais de quem entra em contato pelo site, preenche a triagem inicial, participa do processo de diagnóstico ou conversa pelos canais de atendimento.</p>
   <h2>1. Responsável e contato</h2>
   <p>A Blinko Studio é responsável pelo tratamento de dados relacionados às solicitações recebidas em seus canais. Para dúvidas, solicitações ou exercício de direitos, entre em contato pelo WhatsApp comercial: <a href={CONTACT} target="_blank" rel="noopener noreferrer">+55 (71) 92002-7233</a>. A identificação jurídica completa e demais informações de contato deverão ser confirmadas antes da publicação definitiva.</p>
   <h2>2. Quais dados podemos receber</h2>
   <ul>
    <li><strong>Triagem inicial:</strong> nome, número de WhatsApp, empresa e e-mail (quando informados), motivo do contato, descrição breve e preferência de retorno.</li>
    <li><strong>Continuidade do atendimento e diagnóstico:</strong> informações comerciais e operacionais compartilhadas pelo cliente, documentos, mensagens, entrevistas e dados necessários ao escopo acordado. O tratamento de dados de terceiros exige finalidade definida e cuidado adicional.</li>
    <li><strong>Registros operacionais:</strong> identificadores de solicitação, datas de registro, conclusão ou interrupção de formulários, histórico de atendimento e registros técnicos indispensáveis à segurança e à operação.</li>
   </ul>
   <p>Evite informar senhas, dados bancários, documentos pessoais sensíveis ou informações de saúde no formulário de triagem. Se informações adicionais forem necessárias, orientaremos um canal adequado.</p>
   <h2>3. Para que usamos os dados</h2>
   <ul>
    <li>Receber, compreender e responder solicitações; organizar o acompanhamento e retornar sobre uma triagem iniciada com autorização;</li>
    <li>Preparar reunião, proposta, escopo e eventual contratação do Diagnóstico Blinko;</li>
    <li>Executar o diagnóstico contratado, produzir análises e recomendações, manter registros necessários à relação contratual e cumprir obrigações legais;</li>
    <li>Prevenir abuso, tentativas de acesso indevido, spam e incidentes técnicos, com medidas proporcionais à finalidade;</li>
    <li>Atender pedidos de acesso, correção, eliminação e outras solicitações previstas em lei.</li>
   </ul>
   <p>O registro do contato e a autorização para retorno <strong>não autorizam automaticamente</strong> campanhas promocionais ou divulgação pública de informações, imagens e casos de clientes.</p>
   <h2>4. Bases legais e autorização</h2>
   <p>O tratamento observa as hipóteses aplicáveis da LGPD, conforme cada finalidade: consentimento quando solicitado, procedimentos preliminares e execução de contrato, cumprimento de obrigações legais e outras bases previstas em lei quando efetivamente cabíveis. No formulário inicial, solicitamos autorização explícita para guardar o contato e as respostas para tratar a solicitação, inclusive caso a pessoa interrompa o preenchimento.</p>
   <h2>5. Formulário incompleto e contato posterior</h2>
   <p>Se o visitante autorizar o registro e concluir a primeira etapa, seus dados de contato poderão ser guardados antes das perguntas seguintes. Se interromper depois, a solicitação pode ficar marcada como não concluída para acompanhamento. Quem não informou dados nem autorizou o registro não será identificado pessoalmente pela Blinko por esse formulário.</p>
   <p>A abertura de um link do WhatsApp não comprova que uma mensagem foi enviada. Não fazemos conclusões técnicas sobre a empresa a partir de respostas da triagem.</p>
   <h2>6. Hospedagem, prestadores e compartilhamento</h2>
   <p>O site utiliza serviços de hospedagem e infraestrutura. Quando os respectivos recursos estiverem efetivamente ativados, dados de triagem e diagnóstico poderão ser tratados em banco de dados, planilhas internas e notificações de e-mail com acesso restrito. A integração com WhatsApp está sujeita às condições da plataforma Meta. Esses fornecedores poderão tratar dados conforme suas funções técnicas e políticas aplicáveis, inclusive com armazenamento ou tratamento fora do Brasil, conforme configuração e termos de cada serviço.</p>
   <p>As integrações ainda não ativadas não devem ser apresentadas como um envio em operação. Não divulgamos informações de clientes em portfólios ou publicações sem autorização adequada.</p>
   <h2>7. Segurança e acesso</h2>
   <p>Adotamos e aperfeiçoamos medidas de controle de acesso, validação de entradas, restrição de credenciais, proteção dos canais e monitoramento proporcional aos riscos. Somente pessoas autorizadas devem acessar registros de clientes. Nenhuma medida técnica elimina integralmente a possibilidade de incidentes.</p>
   <h2>8. Conservação e exclusão</h2>
   <p>As informações serão mantidas pelo período necessário às finalidades informadas, à execução de contratos e às obrigações legais ou à proteção de direitos, conforme critérios a serem formalizados internamente. Dados que não precisem mais ser conservados deverão ser excluídos ou anonimizados quando cabível. A simples solicitação de exclusão poderá exigir confirmação de identidade e avaliação de eventual obrigação de retenção.</p>
   <h2>9. Seus direitos</h2>
   <p>O titular pode solicitar, nos termos da LGPD, informações sobre tratamento e compartilhamento, acesso, correção, anonimização, bloqueio, eliminação quando cabível, portabilidade nas condições aplicáveis, revogação de consentimento e oposição nos casos previstos em lei. Consulte <Link href="/solicitacoes-de-dados">Solicitações de Dados</Link> para orientações de pedido e verificação segura.</p>
   <h2>10. Cookies e mudanças desta política</h2>
   <p>Recursos técnicos essenciais ao funcionamento, à autenticação de áreas restritas e à segurança podem usar cookies ou registros de acesso. Ferramentas de publicidade ou medição não devem ser ativadas sem revisão das finalidades, fornecedores e informações de privacidade. Esta política deve ser atualizada sempre que houver mudanças relevantes no site, nas ferramentas ou nas finalidades.</p>
   <p className={styles.note}>Esta é uma versão de revisão, baseada nas funcionalidades conhecidas do projeto. Antes da publicação final, confirmar identificação jurídica, bases legais por operação, período de retenção, fornecedores efetivos e canal oficial de privacidade.</p>
   <Link href="/solicitacoes-de-dados">Como solicitar acesso, correção ou exclusão de dados</Link>
  </main>
  <footer className={styles.footer}><span>Blinko Studio · Clareza e responsabilidade</span><nav className={styles.links}><Link href="/">Início</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos</Link><Link href="/solicitacoes-de-dados">Solicitações de dados</Link></nav></footer>
 </div>
}
