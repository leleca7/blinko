"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./quick-triage.module.css";

type Stage = "contact" | "details" | "success";
type ContactResponse = { ok?: boolean; saved?: boolean; error?: string };
type CompleteResponse = { ok?: boolean; saved?: boolean; contactUrl?: string | null; reference?: string; error?: string };

const INSTAGRAM = "https://www.instagram.com/blinko_studio/";
const KIND_OPTIONS = [
  ["current_problem", "Meu negócio enfrenta uma dificuldade", "Quero entender o que está acontecendo e suas possíveis causas."],
  ["growth_goal", "Quero melhorar a estrutura do negócio", "Busco mais clareza sobre prioridades, processos ou comunicação."],
  ["learn_diagnosis", "Quero conhecer o Diagnóstico Blinko", "Gostaria de entender como funciona essa investigação."],
] as const;

export default function QuickTriageForm() {
  const session = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>("contact");
  const [storageStatus, setStorageStatus] = useState<"checking" | "ready" | "unavailable">("checking");

  useEffect(() => {
    let mounted = true;
    fetch("/api/triagem", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ ready?: boolean }> : { ready: false })
      .then((result) => { if (mounted) setStorageStatus(result.ready ? "ready" : "unavailable"); })
      .catch(() => { if (mounted) setStorageStatus("unavailable"); });
    return () => { mounted = false; };
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [kind, setKind] = useState("");
  const [challenge, setChallenge] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [contactUrl, setContactUrl] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/triagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, id: session.current, companyFax: "" }),
      cache: "no-store",
    });
    const data = (await response.json()) as ContactResponse & CompleteResponse;
    if (!response.ok || !data.ok) throw new Error(data.error || "temporary_error");
    return data;
  }

  async function captureContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || storageStatus !== "ready") return;
    setError("");
    session.current ??= crypto.randomUUID();
    setLoading(true);
    try {
      const result = await post({ action: "start", name, companyName, whatsapp, email, consent });
      if (!result.saved) throw new Error("not_saved");
      setStage("details");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      const errorCode = caught instanceof Error ? caught.message : "";
      setError(errorCode === "service_not_configured" || errorCode === "migration_required"
        ? "O armazenamento da triagem ainda não está ativado. Nenhum dado foi salvo. A integração precisa ser configurada antes de receber contatos."
        : "Não foi possível registrar seu contato no momento. Nenhum dado foi salvo; tente novamente quando o formulário estiver disponível.");
    } finally {
      setLoading(false);
    }
  }

  async function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await post({ action: "complete", kind, challenge, timeframe, channel });
      if (!result.saved) throw new Error("not_saved");
      setContactUrl(result.contactUrl || null);
      setReference(result.reference || "");
      setStage("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Não conseguimos concluir a triagem. Seu contato inicial continua salvo; tente novamente para finalizar.");
    } finally {
      setLoading(false);
    }
  }

  function recordWhatsAppOpening() {
    if (!session.current) return;
    // Abrir o link não significa que o usuário enviou uma mensagem.
    void fetch("/api/triagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "whatsapp_opened", id: session.current }),
      keepalive: true,
    }).catch(() => undefined);
  }

  if (stage === "success") {
    return (
      <section className={styles.success} aria-live="polite">
        <span className={styles.kicker}>TRIAGEM REGISTRADA</span>
        <h2>Agora podemos conversar.</h2>
        <p>Recebemos sua triagem inicial. Nossa equipe poderá explicar o escopo e a contratação do Diagnóstico Blinko, nosso serviço principal. Esta triagem não é um diagnóstico técnico.</p>
        <p className={styles.reference}>Referência: <strong>{reference}</strong></p>
        {contactUrl ? (
          <>
            <a className={styles.primary} target="_blank" rel="noopener noreferrer" href={contactUrl} onClick={recordWhatsAppOpening}>
              Abrir conversa no WhatsApp <span aria-hidden="true">↗</span>
            </a>
            <p className={styles.note}>O WhatsApp abrirá com uma mensagem pronta. Você precisa tocar em enviar para iniciar a conversa. Seu pedido já está registrado mesmo se não enviar.</p>
          </>
        ) : (
          <>
            <a className={styles.primary} target="_blank" rel="noopener noreferrer" href={INSTAGRAM}>Conversar pelo Instagram ↗</a>
            <p className={styles.note}>O WhatsApp comercial ainda não foi configurado nesta versão de teste. Seu pedido fica registrado na base quando a integração estiver habilitada.</p>
          </>
        )}
        <a className={styles.backLink} href="/">Voltar ao site</a>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-label="Triagem rápida da Blinko">
      <div className={styles.progressTop}>
        <span>COMECE AQUI</span>
        <span>{stage === "contact" ? "1 de 2 · contato" : "2 de 2 · sua necessidade"}</span>
      </div>
      <div className={styles.track} aria-hidden="true"><span style={{ width: stage === "contact" ? "50%" : "100%" }} /></div>
      {storageStatus !== "ready" && (
        <p className={styles.previewNotice} role="status">
          {storageStatus === "checking"
            ? "Conferindo a disponibilidade do formulário..."
            : "Prévia em configuração: o recebimento de contatos ainda não está disponível. Não preencha dados pessoais reais até a ativação da triagem."}
        </p>
      )}

      {stage === "contact" ? (
        <form className={styles.form} onSubmit={captureContact}>
          <div className={styles.head}>
            <span className={styles.kicker}>PRIMEIRO, VOCÊ</span>
            <h2>Com quem vamos conversar?</h2>
            <p>Deixe um contato para que a gente possa retornar mesmo se você não conseguir terminar agora.</p>
          </div>
          <div className={styles.grid}>
            <label>Seu nome <input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Como podemos chamar você?" /></label>
            <label>WhatsApp <input required type="tel" minLength={10} maxLength={30} autoComplete="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" /></label>
          </div>
          <div className={styles.optionalBlock}>
            <p className={styles.optionalIntro}>Se quiser, conte um pouco mais <span>Opcional</span></p>
            <div className={styles.grid}>
              <label>Nome do negócio <input maxLength={140} autoComplete="organization" value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Empresa ou projeto" /></label>
              <label>E-mail <input type="email" maxLength={180} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com.br" /></label>
            </div>
          </div>
          <label className={styles.consent}>
            <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required />
            <span>Autorizo a Blinko a registrar meu contato e estas respostas para tratar minha solicitação, inclusive se eu não concluir o formulário, e a retornar por WhatsApp ou e-mail. Não autorizo automaticamente mensagens promocionais.</span>
          </label>
          <p className={styles.privacy}>Saiba como tratamos seus dados na <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>. Veja também os <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">Termos de Uso</a> e como <a href="/solicitacoes-de-dados" target="_blank" rel="noopener noreferrer">solicitar acesso, correção ou exclusão</a>.</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primary} disabled={loading || !consent || storageStatus !== "ready"}>{loading ? "Salvando contato..." : storageStatus !== "ready" ? "Triagem em preparação" : "Continuar →"}</button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={complete}>
          <div className={styles.head}>
            <span className={styles.kicker}>SÓ MAIS UM POUCO</span>
            <h2>O que trouxe você até aqui?</h2>
            <p>Sua resposta ajuda a preparar o primeiro contato. Nosso serviço começa pelo Diagnóstico Blinko.</p>
          </div>
          <div className={styles.kindOptions}>
            {KIND_OPTIONS.map(([value,title,detail])=>(
              <label key={value} className={styles.choice} data-selected={kind===value?"true":"false"}>
                <input type="radio" name="kind" value={value} checked={kind===value} onChange={()=>setKind(value)} required />
                <span><strong>{title}</strong><small>{detail}</small></span>
              </label>
            ))}
          </div>
          <label className={styles.bigLabel}>Quer contar mais alguma coisa? (opcional)
            <textarea maxLength={650} rows={3} value={challenge} onChange={e=>setChallenge(e.target.value)} placeholder="Ex.: não sei por que as vendas caíram; ou preciso reformular meu cardápio." />
          </label>
          <div className={styles.grid}>
            <label>Quando gostaria de começar? <span>opcional</span>
              <select value={timeframe} onChange={e=>setTimeframe(e.target.value)}>
                <option value="">Ainda não sei</option><option value="now">O quanto antes</option><option value="this_month">Neste mês</option><option value="next_months">Nos próximos meses</option><option value="just_looking">Estou pesquisando</option>
              </select>
            </label>
            <label>Prefere nosso retorno por
              <select value={channel} onChange={e=>setChannel(e.target.value as "whatsapp" | "email")}>
                <option value="whatsapp">WhatsApp</option>
                {email && <option value="email">E-mail</option>}
              </select>
            </label>
          </div>
          <p className={styles.savedNote}>Seu contato já foi registrado. Se você fechar agora, poderemos retornar conforme sua autorização.</p>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.back} onClick={()=>setStage("contact")} disabled={loading}>← Voltar</button>
            <button type="submit" className={styles.primary} disabled={loading || !kind}>{loading ? "Registrando..." : "Enviar triagem →"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
