"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./diagnostico.module.css";

const areas = ["Marca", "Digital", "Financeiro", "Operação", "Atendimento", "Gestão", "Equipe", "Não sei identificar ainda"];

const operationalSignals = [
  "Informações ficam espalhadas",
  "Clientes precisam cobrar retorno",
  "Tarefas são esquecidas",
  "Muita coisa depende de uma única pessoa",
  "Preços/orçamentos demoram ou variam sem regra clara",
  "Retrabalho é frequente",
  "Não sabemos quais números acompanhar",
  "Há demanda, mas a operação não acompanha",
  "A empresa tem capacidade, mas falta demanda",
  "Comunicação/marketing parece não representar bem a empresa",
  "Sistemas/ferramentas não conversam entre si",
  "Nenhuma dessas",
];

const pillarQuestions = [
  {
    key: "brand",
    label: "Marca",
    question: "Uma pessoa que conhece a empresa pela primeira vez entende rapidamente o que vocês fazem e por que escolher vocês?",
    options: [["clear", "Sim, com clareza"], ["partial", "Parcialmente"], ["no", "Não"], ["unknown", "Não sei"]],
  },
  {
    key: "digital",
    label: "Digital",
    question: "Os canais digitais ajudam a gerar ou conduzir oportunidades de forma previsível?",
    options: [["yes", "Sim"], ["partial", "Parcialmente"], ["no", "Não"], ["not_relevant", "Não usamos de forma relevante"], ["unknown", "Não sei medir"]],
  },
  {
    key: "financial",
    label: "Financeiro",
    question: "A empresa consegue acompanhar com segurança receitas, custos e margem do que vende?",
    options: [["yes", "Sim"], ["partial", "Parcialmente"], ["no", "Não"], ["unknown", "Não sei"]],
  },
  {
    key: "operation",
    label: "Operação",
    question: "O trabalho acontece por processos claros ou depende muito de improviso e memória das pessoas?",
    options: [["clear", "Processos claros"], ["mixed", "Mistura de processo e improviso"], ["improvised", "Depende bastante de improviso"], ["unknown", "Não sei avaliar"]],
  },
  {
    key: "service",
    label: "Atendimento",
    question: "Quando um cliente entra em contato, a empresa consegue responder, acompanhar e não perder oportunidades com consistência?",
    options: [["yes", "Sim"], ["mostly", "Na maior parte"], ["frequent_failures", "Temos perdas/falhas frequentes"], ["no_process", "Não temos processo definido"], ["unknown", "Não sei medir"]],
  },
  {
    key: "management",
    label: "Gestão",
    question: "Existe clareza sobre prioridades, responsáveis e acompanhamento do que precisa acontecer?",
    options: [["yes", "Sim"], ["partial", "Parcialmente"], ["no", "Não"], ["owner_dependent", "Depende muito do dono/gestor"], ["unknown", "Não sei"]],
  },
  {
    key: "team",
    label: "Equipe",
    question: "As pessoas sabem o que é responsabilidade delas e conseguem executar sem depender de confirmação o tempo todo?",
    options: [["yes", "Sim"], ["partial", "Parcialmente"], ["no", "Não"], ["not_applicable", "Equipe muito pequena / não se aplica"], ["unknown", "Não sei"]],
  },
] as const;

function values(form: FormData, name: string) {
  return form.getAll(name).map(String);
}

export default function PreDiagnosticForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const submissionIdRef = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);

    submissionIdRef.current ??= crypto.randomUUID();

    const pillarAnswers = Object.fromEntries(
      pillarQuestions.map((pillar) => [pillar.key, String(form.get(`pillar_${pillar.key}`) || "")]),
    );

    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      whatsapp: form.get("whatsapp"),
      companyName: form.get("companyName"),
      companyRole: form.get("companyRole"),
      cityState: form.get("cityState"),
      segment: form.get("segment"),
      website: form.get("website"),
      socialUrl: form.get("socialUrl"),
      objective: form.get("objective"),
      urgency: form.get("urgency"),
      perceivedBlocker: form.get("perceivedBlocker"),
      perceivedAreas: values(form, "perceivedAreas"),
      pillarAnswers,
      operationalSignals: values(form, "operationalSignals"),
      teamSize: form.get("teamSize"),
      companyMoment: form.get("companyMoment"),
      opennessToChange: form.get("opennessToChange"),
      investmentIntent: form.get("investmentIntent"),
      additionalContext: form.get("additionalContext"),
      consent: form.get("consent") === "yes",
      companyFax: form.get("companyFax"),
    };

    setStatus("sending");
    try {
      const response = await fetch("/api/pre-diagnostico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blinko-Submission-Id": submissionIdRef.current,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("submission failed");
      setStatus("success");
      element.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <section className={styles.success} aria-live="polite">
        <span>RECEBIDO</span>
        <h2>Agora a gente olha com calma.</h2>
        <p>
          Seu pré-diagnóstico entrou na fila de revisão da Blinko. As respostas ajudam a organizar sinais, mas ainda não são uma conclusão sobre a empresa.
        </p>
        <a href="/">Voltar para o site →</a>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.honeypot} aria-hidden="true">
        <label>Fax da empresa<input name="companyFax" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <fieldset className={styles.block}>
        <legend><span>01</span> Quem está falando com a Blinko</legend>
        <div className={styles.gridTwo}>
          <label>Seu nome<input name="name" required maxLength={120} /></label>
          <label>E-mail<input name="email" type="email" required maxLength={180} /></label>
          <label>WhatsApp<input name="whatsapp" required maxLength={40} placeholder="(00) 00000-0000" /></label>
          <label>Empresa<input name="companyName" required maxLength={160} /></label>
          <label>Seu cargo/função<input name="companyRole" required maxLength={120} /></label>
          <label>Cidade / estado<input name="cityState" required maxLength={120} /></label>
          <label>Segmento principal<input name="segment" required maxLength={120} /></label>
          <label>Site <small>opcional</small><input name="website" maxLength={240} placeholder="https://" /></label>
          <label>Instagram/rede principal <small>opcional</small><input name="socialUrl" maxLength={240} /></label>
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend><span>02</span> Onde vocês querem chegar</legend>
        <label className={styles.wideLabel}>
          Qual é o objetivo mais importante da empresa nos próximos meses?
          <textarea name="objective" required maxLength={1200} rows={4} placeholder="Ex.: aumentar vendas sem sobrecarregar a operação, organizar atendimento, melhorar margem..." />
        </label>
        <label className={styles.wideLabel}>
          Em quanto tempo esse objetivo precisa começar a mostrar evolução?
          <select name="urgency" required defaultValue="">
            <option value="" disabled>Selecione</option>
            <option value="critical">Imediatamente / situação crítica</option>
            <option value="up_to_3_months">Até 3 meses</option>
            <option value="3_to_6_months">De 3 a 6 meses</option>
            <option value="6_to_12_months">De 6 a 12 meses</option>
            <option value="no_clear_deadline">Ainda não existe prazo claro</option>
          </select>
        </label>
        <label className={styles.wideLabel}>
          Hoje, o que mais parece estar impedindo a empresa de chegar nesse objetivo?
          <textarea name="perceivedBlocker" required maxLength={1600} rows={5} />
        </label>
        <div className={styles.questionGroup}>
          <p>Em quais áreas você sente que existem problemas ou oportunidades importantes?</p>
          <div className={styles.checkGrid}>
            {areas.map((area) => <label className={styles.check} key={area}><input type="checkbox" name="perceivedAreas" value={area} /><span>{area}</span></label>)}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend><span>03</span> Leitura rápida dos 7 pilares</legend>
        <p className={styles.helper}>Isso registra sinais percebidos. Não confirma que exista um problema em cada área.</p>
        <div className={styles.pillars}>
          {pillarQuestions.map((pillar) => (
            <div className={styles.pillarQuestion} key={pillar.key}>
              <span>{pillar.label}</span>
              <p>{pillar.question}</p>
              <div className={styles.radioGrid}>
                {pillar.options.map(([value, label]) => (
                  <label className={styles.radio} key={value}>
                    <input type="radio" name={`pillar_${pillar.key}`} value={value} required />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend><span>04</span> O que acontece na rotina</legend>
        <div className={styles.questionGroup}>
          <p>Quais situações acontecem com frequência hoje?</p>
          <div className={styles.checkList}>
            {operationalSignals.map((signal) => <label className={styles.check} key={signal}><input type="checkbox" name="operationalSignals" value={signal} /><span>{signal}</span></label>)}
          </div>
        </div>
        <div className={styles.gridTwo}>
          <label>Tamanho aproximado da equipe<select name="teamSize" required defaultValue=""><option value="" disabled>Selecione</option><option value="founder_only">Somente fundador/dono</option><option value="2_5">2 a 5 pessoas</option><option value="6_15">6 a 15</option><option value="16_50">16 a 50</option><option value="50_plus">Mais de 50</option><option value="prefer_not">Prefiro não informar</option></select></label>
          <label>Momento da empresa<select name="companyMoment" required defaultValue=""><option value="" disabled>Selecione</option><option value="starting">Começando</option><option value="organizing">Opera, mas precisa organizar</option><option value="growing">Crescendo</option><option value="stable">Estabilizada buscando nova evolução</option><option value="difficulty">Passando por dificuldade/queda</option><option value="other">Outro</option></select></label>
        </div>
      </fieldset>

      <fieldset className={styles.block}>
        <legend><span>05</span> Fit para mudança</legend>
        <div className={styles.questionGroup}>
          <p>Se descobrirmos que o problema está em uma área diferente da que você imaginava, a empresa está aberta a mudar a prioridade?</p>
          <div className={styles.radioGrid}>
            <label className={styles.radio}><input type="radio" name="opennessToChange" value="yes" required /><span>Sim</span></label>
            <label className={styles.radio}><input type="radio" name="opennessToChange" value="maybe" required /><span>Talvez, dependendo do caso</span></label>
            <label className={styles.radio}><input type="radio" name="opennessToChange" value="defined_solution_only" required /><span>Preferimos uma solução já definida</span></label>
          </div>
        </div>
        <div className={styles.questionGroup}>
          <p>Se existir um problema relevante e uma solução com sentido financeiro, a empresa tem intenção de investir na melhoria?</p>
          <div className={styles.radioGrid}>
            <label className={styles.radio}><input type="radio" name="investmentIntent" value="yes" required /><span>Sim, existe orçamento/possibilidade</span></label>
            <label className={styles.radio}><input type="radio" name="investmentIntent" value="need_value" required /><span>Precisamos entender retorno e valor antes</span></label>
            <label className={styles.radio}><input type="radio" name="investmentIntent" value="low_capacity" required /><span>Temos pouca capacidade agora</span></label>
            <label className={styles.radio}><input type="radio" name="investmentIntent" value="researching" required /><span>Estamos apenas pesquisando</span></label>
          </div>
        </div>
        <label className={styles.wideLabel}>Tem algo importante que não capturamos? <small>opcional</small><textarea name="additionalContext" maxLength={1800} rows={4} /></label>
        <label className={styles.consent}>
          <input type="checkbox" name="consent" value="yes" required />
          <span>Autorizo a Blinko a usar estas informações para analisar esta solicitação, armazená-las para acompanhamento comercial e entrar em contato por e-mail ou WhatsApp sobre este pré-diagnóstico.</span>
        </label>
      </fieldset>

      {status === "error" && <p className={styles.error} role="alert">Não conseguimos registrar agora. Confira os campos e tente novamente.</p>}

      <div className={styles.submitRow}>
        <div><strong>O envio não gera diagnóstico automático.</strong><span>A equipe recebe os sinais para uma leitura inicial.</span></div>
        <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Enviando…" : "Enviar pré-diagnóstico"}</button>
      </div>
    </form>
  );
}
