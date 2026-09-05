"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
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
type Orientation = "horizontal" | "vertical";
type Finish = "standard" | "matte" | "gloss";
type Corner = "straight" | "rounded";
type ArtStatus = "ready" | "adjust" | "create";

const cardSteps = ["Formato", "Quantidade", "Impressão", "Acabamento", "Arte", "Entrega", "Resumo"];

function BusinessCardPreview({
  orientation,
  sides,
  finish,
  corner,
  artPreview,
  business,
  name,
  whatsapp,
}: {
  orientation: Orientation;
  sides: 1 | 2;
  finish: Finish;
  corner: Corner;
  artPreview: string | null;
  business: string;
  name: string;
  whatsapp: string;
}) {
  return (
    <div className={styles.previewStage}>
      <div className={styles.previewLabel}>
        <span>PRÉVIA CONCEITUAL</span>
        <small>o arquivo final será conferido antes da produção</small>
      </div>

      <div
        className={styles.cardScene}
        data-orientation={orientation}
        data-sides={String(sides)}
      >
        {sides === 2 && (
          <div
            className={`${styles.businessCard} ${styles.cardBack}`}
            data-finish={finish}
            data-corner={corner}
            aria-hidden="true"
          >
            <div className={styles.backPattern} />
            <strong>{business || "SUA MARCA"}</strong>
            <span>verso</span>
          </div>
        )}

        <div
          className={`${styles.businessCard} ${styles.cardFront}`}
          data-finish={finish}
          data-corner={corner}
        >
          {artPreview ? (
            <div className={styles.uploadedArtWrap}>
              <img src={artPreview} alt="Prévia do arquivo enviado" />
            </div>
          ) : (
            <>
              <div className={styles.cardMark}>
                <i />
                <span>{business || "SUA MARCA"}</span>
              </div>
              <div className={styles.cardIdentity}>
                <strong>{name || "Seu nome"}</strong>
                <span>{whatsapp || "(75) 99999-9999"}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.previewSpec}>
        <span>{orientation === "horizontal" ? "Horizontal" : "Vertical"}</span>
        <span>{sides === 2 ? "Frente + verso" : "Somente frente"}</span>
        <span>{finish === "matte" ? "Preferência fosca" : finish === "gloss" ? "Preferência brilho" : "Sem acabamento definido"}</span>
      </div>
    </div>
  );
}

function BusinessCardConfigurator({ onChangeCategory }: { onChangeCategory: () => void }) {
  const [step, setStep] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [quantity, setQuantity] = useState("500");
  const [customQuantity, setCustomQuantity] = useState("");
  const [sides, setSides] = useState<1 | 2>(2);
  const [finish, setFinish] = useState<Finish>("standard");
  const [corner, setCorner] = useState<Corner>("straight");
  const [artStatus, setArtStatus] = useState<ArtStatus>("ready");
  const [artPreview, setArtPreview] = useState<string | null>(null);
  const [delivery, setDelivery] = useState("retirada");
  const [neededBy, setNeededBy] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const finalQuantity = quantity === "custom" ? customQuantity : quantity;
  const progress = ((step + 1) / cardSteps.length) * 100;
  const canContinue = step < 5 || Boolean(name.trim() && whatsapp.trim());

  function readPreviewFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setArtPreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setArtPreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function next() {
    if (!canContinue) return;
    setStep((current) => Math.min(current + 1, cardSteps.length - 1));
  }

  function previous() {
    setSubmitted(false);
    setStep((current) => Math.max(current - 1, 0));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form className={styles.cardConfigurator} onSubmit={submit}>
      <div className={styles.configuratorTopline}>
        <button className={styles.changeProduct} type="button" onClick={onChangeCategory}>← trocar material</button>
        <div className={styles.progressTrack} aria-label={`Etapa ${step + 1} de ${cardSteps.length}`}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <span>{String(step + 1).padStart(2, "0")} / {String(cardSteps.length).padStart(2, "0")}</span>
      </div>

      <div className={styles.configuratorGrid}>
        <section className={styles.questionPane}>
          <div className={styles.stepRail}>
            {cardSteps.map((label, index) => (
              <button
                type="button"
                key={label}
                data-active={index === step ? "true" : "false"}
                data-complete={index < step ? "true" : "false"}
                onClick={() => index <= step && setStep(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.questionContent}>
            {step === 0 && (
              <>
                <span className={styles.step}>01 / FORMATO</span>
                <h2>Como você imagina seu cartão?</h2>
                <p>A proporção muda na hora para você sentir o formato. O tamanho técnico final será confirmado na cotação.</p>
                <div className={styles.visualOptions}>
                  <button type="button" data-selected={orientation === "horizontal" ? "true" : "false"} onClick={() => setOrientation("horizontal")}>
                    <i className={styles.horizontalShape} />
                    <strong>Horizontal</strong>
                    <span>clássico e direto</span>
                  </button>
                  <button type="button" data-selected={orientation === "vertical" ? "true" : "false"} onClick={() => setOrientation("vertical")}>
                    <i className={styles.verticalShape} />
                    <strong>Vertical</strong>
                    <span>mais editorial</span>
                  </button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <span className={styles.step}>02 / QUANTIDADE</span>
                <h2>Quantos cartões você precisa?</h2>
                <p>Escolha uma referência de quantidade. Depois ligamos essas opções à tabela real de produção.</p>
                <div className={styles.quantityOptions}>
                  {["100", "250", "500", "1000"].map((value) => (
                    <button type="button" key={value} data-selected={quantity === value ? "true" : "false"} onClick={() => setQuantity(value)}>
                      <strong>{Number(value).toLocaleString("pt-BR")}</strong>
                      <span>unidades</span>
                    </button>
                  ))}
                  <button type="button" data-selected={quantity === "custom" ? "true" : "false"} onClick={() => setQuantity("custom")}>
                    <strong>Outra</strong>
                    <span>quantidade</span>
                  </button>
                </div>
                {quantity === "custom" && (
                  <label className={styles.singleField}>
                    <span>Informe a quantidade</span>
                    <input value={customQuantity} onChange={(event) => setCustomQuantity(event.target.value)} inputMode="numeric" placeholder="Ex.: 2.000" />
                  </label>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <span className={styles.step}>03 / IMPRESSÃO</span>
                <h2>Uma face ou duas?</h2>
                <p>O verso aparece no mockup quando você escolhe frente e verso.</p>
                <div className={styles.largeOptions}>
                  <button type="button" data-selected={sides === 1 ? "true" : "false"} onClick={() => setSides(1)}>
                    <span>01</span><strong>Somente frente</strong><small>uma face impressa</small>
                  </button>
                  <button type="button" data-selected={sides === 2 ? "true" : "false"} onClick={() => setSides(2)}>
                    <span>02</span><strong>Frente + verso</strong><small>duas faces impressas</small>
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <span className={styles.step}>04 / ACABAMENTO</span>
                <h2>Qual sensação você prefere?</h2>
                <p>Por enquanto isso registra uma preferência visual. Materiais e acabamentos disponíveis serão validados com a produção.</p>
                <div className={styles.finishOptions}>
                  {[
                    ["standard", "Sem preferência", "deixe a produção sugerir"],
                    ["matte", "Fosco", "visual mais suave"],
                    ["gloss", "Brilho", "mais reflexo e contraste"],
                  ].map(([value, label, description]) => (
                    <button type="button" key={value} data-selected={finish === value ? "true" : "false"} onClick={() => setFinish(value as Finish)}>
                      <i data-finish={value} />
                      <strong>{label}</strong>
                      <span>{description}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.cornerChoice}>
                  <span>Cantos</span>
                  <button type="button" data-selected={corner === "straight" ? "true" : "false"} onClick={() => setCorner("straight")}>Retos</button>
                  <button type="button" data-selected={corner === "rounded" ? "true" : "false"} onClick={() => setCorner("rounded")}>Arredondados</button>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <span className={styles.step}>05 / ARTE</span>
                <h2>E a parte visual?</h2>
                <p>A produção e a criação continuam separadas. Aqui você só nos diz em que ponto está.</p>
                <div className={styles.artOptions}>
                  {[
                    ["ready", "Tenho a arte pronta", "vamos conferir o arquivo"],
                    ["adjust", "Tenho, mas precisa ajustar", "a Blinko avalia o ajuste"],
                    ["create", "Quero que a Blinko crie", "criação entra separada"],
                  ].map(([value, label, description]) => (
                    <button type="button" key={value} data-selected={artStatus === value ? "true" : "false"} onClick={() => setArtStatus(value as ArtStatus)}>
                      <strong>{label}</strong><span>{description}</span>
                    </button>
                  ))}
                </div>
                <label className={styles.uploadField}>
                  <span>Quer testar sua logo ou arte na prévia?</span>
                  <small>Opcional. Nesta versão, o arquivo é usado apenas para a visualização local.</small>
                  <input type="file" accept="image/*" onChange={readPreviewFile} />
                </label>
                {artPreview && <button type="button" className={styles.clearPreview} onClick={() => setArtPreview(null)}>remover imagem da prévia</button>}
              </>
            )}

            {step === 5 && (
              <>
                <span className={styles.step}>06 / ENTREGA E CONTATO</span>
                <h2>Agora só precisamos saber para quem cotar.</h2>
                <div className={styles.fieldGrid}>
                  <label><span>Seu nome</span><input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
                  <label><span>Empresa / negócio</span><input value={business} onChange={(e) => setBusiness(e.target.value)} autoComplete="organization" /></label>
                  <label><span>WhatsApp</span><input required value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(75) 99999-9999" /></label>
                  <label><span>E-mail</span><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" /></label>
                  <label><span>Cidade</span><input value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" /></label>
                  <label><span>Quando precisa?</span><input value={neededBy} onChange={(e) => setNeededBy(e.target.value)} type="date" /></label>
                  <label className={styles.wide}><span>Como prefere receber?</span><select value={delivery} onChange={(e) => setDelivery(e.target.value)}><option value="retirada">Retirada</option><option value="entrega">Entrega</option><option value="avaliar">Quero avaliar as opções</option></select></label>
                  {delivery === "entrega" && <label className={styles.wide}><span>Região / endereço de entrega</span><input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Bairro, cidade ou endereço" /></label>}
                </div>
              </>
            )}

            {step === 6 && (
              <>
                <span className={styles.step}>07 / SEU PEDIDO</span>
                <h2>Seu cartão está tomando forma.</h2>
                <p>Esta é a estrutura que chegará para a Blinko analisar e transformar em cotação.</p>
                <div className={styles.orderSummary}>
                  <div><span>Produto</span><strong>Cartão de visita</strong></div>
                  <div><span>Quantidade</span><strong>{finalQuantity ? `${finalQuantity} un.` : "a definir"}</strong></div>
                  <div><span>Formato</span><strong>{orientation === "horizontal" ? "Horizontal" : "Vertical"}</strong></div>
                  <div><span>Impressão</span><strong>{sides === 2 ? "Frente + verso" : "Somente frente"}</strong></div>
                  <div><span>Acabamento</span><strong>{finish === "matte" ? "Preferência fosca" : finish === "gloss" ? "Preferência brilho" : "A definir"}</strong></div>
                  <div><span>Arte</span><strong>{artStatus === "ready" ? "Pronta" : artStatus === "adjust" ? "Precisa de ajuste" : "Criação Blinko"}</strong></div>
                  <div><span>Cliente</span><strong>{business || name}</strong></div>
                  <div><span>Entrega</span><strong>{delivery === "retirada" ? "Retirada" : delivery === "entrega" ? "Entrega" : "Avaliar opções"}</strong></div>
                </div>
                {!submitted ? (
                  <button className={styles.prototypeSubmit} type="submit">Concluir simulação →</button>
                ) : (
                  <div className={styles.prototypeSuccess}>
                    <strong>Fluxo concluído.</strong>
                    <span>Nesta revisão o pedido ainda não é enviado ao banco. Já podemos ajustar a experiência antes de ligar a automação real.</span>
                  </div>
                )}
              </>
            )}

            {step < 6 && (
              <div className={styles.wizardActions}>
                {step > 0 ? <button type="button" className={styles.secondaryAction} onClick={previous}>← anterior</button> : <span />}
                <button type="button" className={styles.primaryAction} disabled={!canContinue} onClick={next}>{step === 5 ? "Revisar pedido" : "Continuar"} →</button>
              </div>
            )}
            {step === 6 && <button type="button" className={styles.backEdit} onClick={previous}>← voltar e editar</button>}
          </div>
        </section>

        <aside className={styles.previewPane}>
          <BusinessCardPreview
            orientation={orientation}
            sides={sides}
            finish={finish}
            corner={corner}
            artPreview={artPreview}
            business={business}
            name={name}
            whatsapp={whatsapp}
          />
          <div className={styles.liveSummary}>
            <span>SEU PEDIDO AGORA</span>
            <strong>{finalQuantity || "—"} cartões</strong>
            <p>{orientation === "horizontal" ? "Horizontal" : "Vertical"} · {sides === 2 ? "frente e verso" : "somente frente"} · {finish === "standard" ? "acabamento a definir" : finish === "matte" ? "preferência fosca" : "preferência brilho"}</p>
          </div>
        </aside>
      </div>
    </form>
  );
}

function StandardRequestForm({ category, onChangeCategory }: { category: CategoryKey; onChangeCategory: () => void }) {
  const [artStatus, setArtStatus] = useState<ArtStatus>("ready");
  const [delivery, setDelivery] = useState("retirada");
  const [reviewing, setReviewing] = useState(false);
  const categoryLabel = useMemo(() => categories.find(([key]) => key === category)?.[1] ?? "Material", [category]);
  const needsDimensions = ["adesivos", "banners", "fachadas-vitrines", "sacolas-embalagens", "personalizados", "outro"].includes(category);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewing(true);
  }

  return (
    <form className={styles.standardForm} onSubmit={submit}>
      <button className={styles.changeProduct} type="button" onClick={onChangeCategory}>← trocar material</button>
      <section className={styles.formSection}>
        <span className={styles.step}>02 / ESPECIFICAÇÃO</span>
        <h2>{categoryLabel}</h2>
        <p>Este produto ainda usa o briefing rápido. Depois do piloto do cartão, podemos dar a ele uma experiência visual própria.</p>
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
              <input type="radio" name="artStatus" value={value} checked={artStatus === value} onChange={() => setArtStatus(value as ArtStatus)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <span className={styles.step}>04 / PRAZO, ENTREGA E CONTATO</span>
        <div className={styles.fieldGrid}>
          <label><span>Seu nome</span><input required name="name" autoComplete="name" /></label>
          <label><span>Empresa / negócio</span><input name="business" autoComplete="organization" /></label>
          <label><span>WhatsApp</span><input required name="whatsapp" inputMode="tel" autoComplete="tel" placeholder="(75) 99999-9999" /></label>
          <label><span>E-mail</span><input name="email" type="email" autoComplete="email" /></label>
          <label><span>Quando você precisa?</span><input name="neededBy" type="date" /></label>
          <label><span>Como prefere receber?</span><select name="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}><option value="retirada">Retirada</option><option value="entrega">Entrega</option><option value="avaliar">Quero avaliar as opções</option></select></label>
          {delivery === "entrega" && <label className={styles.wide}><span>Endereço / região de entrega</span><input name="deliveryAddress" placeholder="Bairro, cidade ou endereço completo" /></label>}
        </div>
      </section>

      <div className={styles.submitArea}>
        <div><span>Antes de enviar</span><p>Preço, disponibilidade e prazo só são confirmados depois da análise.</p></div>
        <button type="submit">Revisar solicitação →</button>
      </div>

      {reviewing && <div className={styles.prototypeSuccess}><strong>Briefing estruturado.</strong><span>Nesta versão de revisão, o envio ao banco segue desligado.</span></div>}
    </form>
  );
}

export default function GraphicRequestForm() {
  const [category, setCategory] = useState<CategoryKey | "">("");

  return (
    <div className={styles.experience}>
      {!category && (
        <section className={styles.productChooser}>
          <div className={styles.chooserIntro}>
            <span className={styles.step}>01 / ESCOLHA O MATERIAL</span>
            <h2>O que vamos produzir?</h2>
            <p>Alguns produtos terão uma montagem visual própria. Vamos começar testando essa experiência com cartão de visita.</p>
          </div>
          <div className={styles.choiceGrid}>
            {categories.map(([key, label]) => (
              <button className={styles.choiceButton} type="button" onClick={() => setCategory(key)} key={key}>
                <span>{label}</span>
                <i>{key === "cartoes" ? "experimentar →" : "selecionar →"}</i>
              </button>
            ))}
          </div>
        </section>
      )}

      {category === "cartoes" && <BusinessCardConfigurator onChangeCategory={() => setCategory("")} />}
      {category && category !== "cartoes" && <StandardRequestForm category={category} onChangeCategory={() => setCategory("")} />}
    </div>
  );
}
