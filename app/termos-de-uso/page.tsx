import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

const CONTACT = "https://wa.me/5571920027233?text=" + encodeURIComponent("Olá, gostaria de esclarecer uma dúvida sobre os termos de uso da Blinko.");
export const metadata: Metadata = {
 title:"Termos de Uso | Blinko Studio",
 description:"Condições gerais de uso do site, da triagem e de contratação do Diagnóstico Blinko.",
 robots:{index:false,follow:true},
};

export default function TermosUso() {
 return <div className={styles.page}>
  <header className={styles.top}><Link className={styles.brand} href="/" aria-label="Blinko Studio — início"><img src="/brand/logo-fundo-verde.svg" alt="Blinko Studio" /></Link><Link className={styles.back} href="/">← Voltar ao site</Link></header>
  <main className={styles.main}>
   <span className={styles.eyebrow}>Blinko Studio · Condições de utilização</span>
   <h1>Termos de Uso</h1>
   <p className={styles.updated}>Versão para revisão · 23 de novembro de 2026</p>
   <p className={styles.lede}>Estes termos esclarecem as condições gerais de utilização dos canais digitais da Blinko Studio e distinguem a triagem inicial do Diagnóstico Blinko, seu serviço principal.</p>
   <h2>1. Objetivo do site</h2>
   <p>O site apresenta a Blinko, sua abordagem de diagnóstico e estruturação de negócios e os canais para iniciar contato. Informações publicadas no site são institucionais; não substituem proposta comercial, contrato ou avaliação específica.</p>
   <h2>2. Triagem inicial</h2>
   <p>A triagem é gratuita, breve e destinada ao primeiro contato. Ela não equivale a um diagnóstico técnico, laudo, consultoria contratada ou recomendação definitiva. O interessado deve fornecer informações verdadeiras e não enviar senhas ou documentos sensíveis pelo formulário inicial.</p>
   <h2>3. Diagnóstico Blinko</h2>
   <p>O Diagnóstico Blinko é um serviço pago, contratado separadamente, mediante escopo, entregas, condições comerciais, responsabilidades e prazos previamente apresentados em proposta. A investigação pode envolver escuta, observação, pesquisa e análise de evidências; acesso a dados e entrevistas depende de autorização e disponibilidade das fontes.</p>
   <h2>4. Recomendações e eventual execução</h2>
   <p>O diagnóstico é o serviço de entrada obrigatório antes de qualquer execução oferecida pela Blinko. Seu resultado pode indicar diferentes soluções, que poderão ser realizadas pelo cliente, por profissionais externos ou, quando houver capacidade e contratação, pela Blinko e seus parceiros. A contratação da implementação é facultativa e dependerá de proposta e aceite específicos.</p>
   <h2>5. Limites e resultados</h2>
   <p>As recomendações serão delimitadas pelas informações verificáveis, pelo escopo e pela metodologia do projeto. Não existe garantia automática de crescimento, vendas, lucro ou correção de todos os problemas. A Blinko não substitui profissionais legalmente habilitados em matérias como direito, contabilidade ou outras áreas reguladas.</p>
   <h2>6. Funcionamento dos canais digitais</h2>
   <p>O site e os formulários podem ficar temporariamente indisponíveis para manutenção, atualização ou segurança. O envio e o recebimento de mensagens pelo WhatsApp dependem do funcionamento da plataforma e de confirmação do atendimento. Abrir o WhatsApp não significa que uma mensagem foi enviada.</p>
   <h2>7. Privacidade e segurança</h2>
   <p>O tratamento de informações pessoais segue a <Link href="/privacidade">Política de Privacidade</Link> e as orientações de <Link href="/solicitacoes-de-dados">Solicitações de Dados</Link>. É proibido utilizar o site para envio automatizado abusivo, inserção de código malicioso, tentativa de acesso indevido ou qualquer interferência na operação.</p>
   <h2>8. Conteúdos e uso da marca</h2>
   <p>Textos, elementos visuais e materiais institucionais são apresentados para conhecimento do público. A utilização ou reprodução por terceiros não deve sugerir autorização, parceria ou responsabilidade da Blinko sem acordo correspondente.</p>
   <h2>9. Contato e atualizações</h2>
   <p>Para informações gerais, dúvidas sobre o diagnóstico ou esclarecimentos sobre estes termos, contate a Blinko pelo WhatsApp comercial: <a href={CONTACT} target="_blank" rel="noopener noreferrer">+55 (71) 92002-7233</a>. Os termos poderão ser revisados para refletir mudanças efetivas nos serviços e na legislação.</p>
   <p className={styles.note}>Versão preliminar de revisão. As condições definitivas de contratação devem constar de proposta e contrato próprios; estes termos não substituem a revisão jurídica.</p>
   <a className={styles.contact} href={CONTACT} target="_blank" rel="noopener noreferrer">Falar com a Blinko ↗</a>
  </main>
  <footer className={styles.footer}><span>Blinko Studio · Diagnóstico antes da solução</span><nav className={styles.links}><Link href="/">Início</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos</Link><Link href="/solicitacoes-de-dados">Solicitações de dados</Link></nav></footer>
 </div>
}
