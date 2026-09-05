"use client";

import { FormEvent, useMemo, useState } from "react";
import styles from "./solucoes-graficas.module.css";

const categories = [
  ["cartoes", "Cartões de visita"],
  ["panfletos-folders", "Panfletos e folders"],
  ["adesivos", "Adesivos"],
  ["banners", "Banners e wind banners"],
  ["fachadas-vitrines", "Fachadas e vitrines"],
  ["sacolas-embalagens", "Sacolas e embalagens"],
  ["delivery", "Materiais para delivery"],
  ["eventos", "Credenciais e eventos"],
  ["personalizados", "Personalizados"],
  ["outro", "Outro material"],
] as const;

type CategoryKey = (typeof categories)[number][0];

export default function GraphicRequestForm() {
  const [category, setCategory] = useState<CategoryKey | "">("");
  const [artStatus, setArtStatus] = useState("ready");
  const [delivery, setDelivery] = useState("retirada");
  const [reviewing, setReviewing] = useState(false);

  const categoryLabel = useMemo(() => categories.find(([key]) => key === category)?.[1] ?? "Material não selecionado", [category]);
  const needsDimensions = ["adesivos", "banners", "fachadas-vitrines", "sacolas-embalagens", "personalizados", "outro"].includes(category);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewing(true);
    requestAnimationFrame(() => document.getElementById("resumo-solicitacao")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.formSection}>
        <span className={styles.step}>01 / MATERIAL</span>
        <h2>O que você precisa produzir?</h2>
        <p>Escolha a categoria mais próxima. Os detalhes podem ser refinados depois.</p>
        <div className={styles.choiceGrid}>
          {categories.map(([key, label]) => (
            <label className={styles.choice} data-selected={category === key ? "true" : "false"} key={key}>
              <input required type="radio" name="category" value={key} checked={category === key} onChange={() => setCategory(key)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <span className={styles.step}>02 / ESPECIFICAÇÃO</span>
        <h2>Agora, o básico para cotar certo.</h2>
        <div className={styles.fieldGrid}>
          <label><span>Quantidade</span><input required name="quantity" type="number" min="1" placeholder="Ex.: 1.000" /></label>
          {needsDimensions && <label><span>Medidas aproximadas</span><input name="dimensions" placeholder="Ex.: 5 × 5 cm" /></label>}
          <label className={styles.wide}><span>Material, acabamento ou referência técnica</span><input name="specification" placeholder="Se souber, descreva aqui. Se não souber, tudo bem." /></label>
          <label className={styles.wide}><span>Referência / observações</span><textarea name="notes" rows={4} placeholder="Conte como você imagina o material, onde será usado ou qualquer detalhe importante." /></label>
        </div>
      </section>

      <section className={styles.formSection}>
        <span className={styles.step}>03 / ARTE</span>
        <h2>Como está o arquivo?</h2>
        <div className={styles.inlineChoices}>
          {[["ready","Tenho a arte pronta"],["adjust","Tenho, mas precisa de ajustes"],["create","Preciso que a Blinko crie"]].map(([value,label]) => (
            <label data-selected={artStatus === value ? "true" : "false"} key={value}>
              <input type="radio" name="artStatus" value={value} checked={artStatus === value} onChange={() => setArtStatus(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className={styles.contextNote}>{artStatus === "ready" ? "A cotação considera somente a produção. A conferência técnica do arquivo acontece antes de produzir." : artStatus === "adjust" ? "Vamos separar o custo de produção do eventual ajuste criativo." : "A criação entra como serviço Blinko separado da produção gráfica."}</div>
      </section>

      <section className={styles.formSection}>
        <span className={styles.step}>04 / PRAZO E ENTREGA</span>
        <div className={styles.fieldGrid}>
          <label><span>Quando você precisa?</span><input name="neededBy" type="date" /></label>
          <label><span>Como prefere receber?</span><select name="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}><option value="retirada">Retirada</option><option value="entrega">Entrega</option><option value="avaliar">Quero avaliar as opções</option></select></label>
          {delivery === "entrega" && <label className={styles.wide}><span>Endereço / região de entrega</span><input name="deliveryAddress" placeholder="Bairro, cidade ou endereço completo" /></label>}
        </div>
      </section>

      <section className={styles.formSection}>
        <span className={styles.step}>05 / CONTATO</span>
        <h2>Para quem enviamos a cotação?</h2>
        <div className={styles.fieldGrid}>
          <label><span>Seu nome</span><input required name="name" autoComplete="name" /></label>
          <label><span>Empresa / negócio</span><input name="business" autoComplete="organization" /></label>
          <label><span>WhatsApp</span><input required name="whatsapp" inputMode="tel" autoComplete="tel" placeholder="(75) 99999-9999" /></label>
          <label><span>E-mail</span><input name="email" type="email" autoComplete="email" /></label>
          <label className={styles.wide}><span>Cidade</span><input name="city" autoComplete="address-level2" /></label>
        </div>
      </section>

      <div className={styles.submitArea}>
        <div><span>Antes de enviar</span><p>Você poderá conferir o resumo do pedido. Preço, disponibilidade e prazo só são confirmados depois da análise.</p></div>
        <button type="submit">Revisar solicitação →</button>
      </div>

      {reviewing && (
        <section className={styles.review} id="resumo-solicitacao" aria-live="polite">
          <span className={styles.step}>RESUMO / PRÉVIA</span>
          <h2>{categoryLabel}</h2>
          <p>O pedido já está estruturado para virar uma solicitação comercial. Nesta versão de revisão, o envio ao banco ainda está desligado para não tocar a produção.</p>
          <div className={styles.reviewTags}><span>Origem: site</span><span>Arte: {artStatus === "ready" ? "pronta" : artStatus === "adjust" ? "ajuste" : "criação Blinko"}</span><span>Entrega: {delivery}</span></div>
          <button type="button" onClick={() => setReviewing(false)}>Voltar e editar</button>
        </section>
      )}
    </form>
  );
}
