import type { Metadata } from "next";
import Link from "next/link";
import { BLINKO_LOGO_DARK_DATA_URI } from "../../lib/blinko/brand-logo-data";
import styles from "./privacidade.module.css";

export const metadata: Metadata = {
  title: "Privacidade | Blinko",
  description: "Entenda como a Blinko utiliza as informações enviadas no pré-diagnóstico e nos seus canais de contato.",
};

export default function PrivacidadePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="Blinko, início"><img src={BLINKO_LOGO_DARK_DATA_URI} alt="Blinko" /></Link>
        <Link href="/diagnostico">Pré-diagnóstico</Link>
      </header>

      <section className={styles.hero}>
        <span>PRIVACIDADE · BLINKO</span>
        <h1>Se a empresa confia contexto à Blinko, esse contexto precisa ser tratado com critério.</h1>
        <p>Esta página explica, em linguagem direta, como utilizamos as informações enviadas voluntariamente pelo site e pelo pré-diagnóstico.</p>
      </section>

      <section className={styles.content}>
        <article>
          <span>01</span>
          <div><h2>Quais informações podem ser enviadas</h2><p>No pré-diagnóstico, podemos receber dados de contato, informações básicas da empresa, objetivo, percepção sobre áreas do negócio, sinais operacionais, contexto adicional e respostas relacionadas aos sete pilares analisados pela Blinko.</p></div>
        </article>

        <article>
          <span>02</span>
          <div><h2>Para que usamos essas informações</h2><p>As informações são utilizadas para registrar a solicitação, organizar o pré-diagnóstico, apoiar a revisão interna, preparar uma eventual devolutiva, acompanhar o relacionamento comercial relacionado à solicitação e melhorar a consistência do processo Blinko.</p></div>
        </article>

        <article>
          <span>03</span>
          <div><h2>Uso de tecnologia e inteligência artificial</h2><p>Ferramentas de tecnologia e IA podem apoiar a organização e a análise interna dos dados. Isso não significa que uma conclusão sobre a empresa seja gerada ou enviada automaticamente. Leituras personalizadas, decisões e comunicações relevantes permanecem sujeitas a revisão humana.</p></div>
        </article>

        <article>
          <span>04</span>
          <div><h2>Compartilhamento</h2><p>Os dados do pré-diagnóstico não são tratados como produto para venda a terceiros. Prestadores de infraestrutura e tecnologia podem processar informações na medida necessária para hospedar, armazenar ou operar os sistemas utilizados pela Blinko.</p></div>
        </article>

        <article>
          <span>05</span>
          <div><h2>Armazenamento e acesso</h2><p>As informações podem permanecer armazenadas enquanto forem necessárias para análise da solicitação, acompanhamento do relacionamento e registro operacional. O acesso deve ficar restrito às pessoas e sistemas necessários para essas finalidades.</p></div>
        </article>

        <article>
          <span>06</span>
          <div><h2>Seus pedidos sobre os dados</h2><p>Você pode solicitar informações sobre os dados enviados, correção de informações incorretas ou exclusão quando aplicável. Para isso, utilize os canais oficiais de contato disponibilizados pela Blinko e identifique a solicitação de forma suficiente para que possamos localizá-la com segurança.</p></div>
        </article>

        <article>
          <span>07</span>
          <div><h2>Contato comercial</h2><p>Ao enviar o pré-diagnóstico e marcar o consentimento, você autoriza contato relacionado àquela solicitação por e-mail ou WhatsApp. O consentimento não obriga contratação de diagnóstico, execução ou qualquer outro serviço.</p></div>
        </article>

        <article>
          <span>08</span>
          <div><h2>Atualizações desta página</h2><p>Esta política pode ser atualizada conforme o processo, a infraestrutura ou as obrigações aplicáveis evoluam. A versão publicada no site representa a orientação vigente para os canais públicos da Blinko.</p></div>
        </article>
      </section>

      <section className={styles.finalCta}>
        <h2>Quer entender o processo antes de enviar qualquer informação?</h2>
        <div><Link href="/diagnostico-blinko">Conhecer o Diagnóstico Blinko →</Link><Link href="/">Voltar ao site →</Link></div>
      </section>
    </main>
  );
}