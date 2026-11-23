import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

const CONTACT = "https://wa.me/5571920027233?text=" + encodeURIComponent("Olá! Gostaria de solicitar informações, correção ou exclusão dos meus dados pessoais mantidos pela Blinko.");
export const metadata: Metadata = {
 title:"Solicitações de Dados | Blinko Studio",
 description:"Como solicitar acesso, correção, esclarecimentos ou exclusão de dados pessoais tratados pela Blinko.",
 robots:{index:false,follow:true},
};

export default function DireitosTitular() {
 return <div className={styles.page}>
  <header className={styles.top}><Link className={styles.brand} href="/">blinko<span>*</span> studio</Link><Link className={styles.back} href="/">← Voltar ao site</Link></header>
  <main className={styles.main}>
   <span className={styles.eyebrow}>Blinko Studio · Direitos dos titulares</span>
   <h1>Solicitações de Dados</h1>
   <p className={styles.updated}>Versão para revisão · 23 de novembro de 2026</p>
   <p className={styles.lede}>Você pode solicitar informações, correção ou exclusão de dados pessoais associados à triagem, ao contato comercial ou ao diagnóstico, nos casos previstos na LGPD.</p>
   <h2>1. Como solicitar</h2>
   <ol>
    <li>Entre em contato com a Blinko pelo WhatsApp comercial: <a href={CONTACT} target="_blank" rel="noopener noreferrer">+55 (71) 92002-7233</a>.</li>
    <li>Informe que deseja exercer um direito de privacidade e descreva o pedido: acesso, correção, exclusão, revogação de consentimento ou esclarecimento.</li>
    <li>Para localizar registros, podemos pedir apenas os dados de contato anteriormente utilizados e verificar sua identidade de forma proporcional. <strong>Não envie senha, documento pessoal ou outros dados sensíveis pela triagem.</strong></li>
    <li>A equipe analisará o pedido e informará o resultado ou eventual motivo legal para conservação de algum registro.</li>
   </ol>
   <h2>2. Que registros podem ser abrangidos?</h2>
   <p>Dados de identificação e contato, triagens iniciadas ou concluídas, registros de atendimento, respostas de diagnóstico, documentos e outros dados pessoais guardados pela Blinko e associados à solicitação, quando localizáveis e sujeitos ao seu controle.</p>
   <h2>3. O que pode precisar ser conservado?</h2>
   <p>Informações relacionadas a contratos, pagamentos, obrigações legais e exercício regular de direitos podem exigir conservação mesmo depois de um pedido de exclusão. Quando aplicável, explicaremos essa limitação. Não prometemos remoção de dados de sistemas mantidos diretamente por plataformas externas e fora do controle da Blinko.</p>
   <h2>4. Plataformas e mensagens</h2>
   <p>As solicitações à Blinko dizem respeito aos dados sob sua responsabilidade. Para dados administrados diretamente por WhatsApp, Meta, Google e outros fornecedores, também poderão ser aplicáveis os próprios canais e controles de privacidade dessas plataformas.</p>
   <h2>5. Proteção contra pedidos de terceiros</h2>
   <p>Antes de compartilhar, alterar ou remover dados, poderemos confirmar que o pedido parte da pessoa titular ou de representante legítimo. A verificação deve ser proporcional e feita por canal adequado, sem solicitar informações desnecessárias.</p>
   <h2>6. Mais informações</h2>
   <p>Veja também a <Link href="/privacidade">Política de Privacidade</Link> e os <Link href="/termos-de-uso">Termos de Uso</Link>. Uma solicitação de exclusão não implica, por si só, exclusão imediata antes da identificação segura do registro e da avaliação de obrigações aplicáveis.</p>
   <p className={styles.note}>O procedimento operacional, a pessoa responsável, os prazos internos e a rotina de exclusão nas bases de dados e cópias deverão ser validados antes da publicação definitiva.</p>
   <a className={styles.contact} href={CONTACT} target="_blank" rel="noopener noreferrer">Fazer solicitação pelo WhatsApp ↗</a>
  </main>
  <footer className={styles.footer}><span>Blinko Studio · Privacidade e transparência</span><nav className={styles.links}><Link href="/">Início</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos</Link><Link href="/solicitacoes-de-dados">Solicitações de dados</Link></nav></footer>
 </div>
}
