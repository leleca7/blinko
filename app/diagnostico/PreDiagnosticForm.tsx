"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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

const steps = [
  { eyebrow: "COMEÇANDO PELO ESSENCIAL", title: "Onde você quer chegar?", helper: "Primeiro, queremos entender o movimento que a empresa precisa fazer — sem tentar diagnosticar nada ainda." },
  { eyebrow: "LEITURA RÁPIDA", title: "Como a empresa funciona hoje?", helper: "Passe pelos sete pilares com a percepção que você tem agora. Não existe resposta certa." },
  { eyebrow: "ROTINA REAL", title: "O que acontece no dia a dia?", helper: "Agora saímos da percepção geral e olhamos para situações que aparecem na operação." },
  { eyebrow: "CONTEXTO", title: "Conte um pouco sobre a empresa.", helper: "Esses dados ajudam a interpretar as respostas dentro da realidade do negócio." },
  { eyebrow: "ÚLTIMA ETAPA", title: "Como seguimos a partir daqui?", helper: "Só precisamos entender abertura para mudança e como falar com você depois da leitura." },
] as const;

const DRAFT_KEY = "blinko:pre-diagnostico:draft:v1";
const DRAFT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

type DraftValue = string | string[];
type DraftPayload = {
  savedAt: number;
  step: number;
  pillarStep: number;
  fields: Record<string, DraftValue>;
};

function values(form: FormData, name: string) {
  return form.getAll(name).map(String);
}

export default function PreDiagnosticForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [step, setStep] = useState(0);
  const [pillarStep, setPillarStep] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);
  const submissionIdRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw) as DraftPayload;
      if (!draft?.savedAt || Date.now() - draft.savedAt > DRAFT_MAX_AGE) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }

      for (const [name, saved] of Object.entries(draft.fields ?? {})) {
        const controls = Array.from(
          form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`),
        );
        const savedValues = Array.isArray(saved) ? saved : [saved];

        for (const control of controls) {
          if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
            control.checked = savedValues.includes(control.value);
          } else {
            control.value = savedValues[0] ?? "";
          }
        }
      }

      setStep(Math.min(Math.max(Number(draft.step) || 0, 0), steps.length - 1));
      setPillarStep(Math.min(Math.max(Number(draft.pillarStep) || 0, 0), pillarQuestions.length - 1));
      setHasDraft(true);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  function collectDraftFields(form: HTMLFormElement) {
    const data = new FormData(form);
    const fields: Record<string, DraftValue> = {};

    for (const [name, rawValue] of data.entries()) {
      if (name === "companyFax" || name === "consent") continue;
      const value = String(rawValue);
      const current = fields[name];
      if (current === undefined) fields[name] = value;
      else if (Array.isArray(current)) current.push(value);
      else fields[name] = [current, value];
    }

    return fields;
  }

  function saveDraft(nextStep = step, nextPillarStep = pillarStep) {
    const form = formRef.current;
    if (!form) return;

    const draft: DraftPayload = {
      savedAt: Date.now(),
      step: nextStep,
      pillarStep: nextPillarStep,
      fields: collectDraftFields(form),
    };

    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
    } catch {
      // O preenchimento continua funcionando mesmo se o navegador bloquear armazenamento local.
    }
  }

  function scrollToProgress() {
    requestAnimationFrame(() => {
      progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function moveToStep(nextStep: number, nextPillarStep = pillarStep) {
    setStep(nextStep);
    setPillarStep(nextPillarStep);
    setStatus("idle");
    saveDraft(nextStep, nextPillarStep);
    scrollToProgress();
  }

  function validateContainer(container: HTMLElement | null) {
    if (!container) return false;
    const requiredControls = Array.from(container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[required], select[required], textarea[required]"));
    const invalid = requiredControls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  }

  function validateStep(stepIndex: number) {
    const form = formRef.current;
    if (!form) return false;
    return validateContainer(form.querySelector<HTMLElement>(`[data-step="${stepIndex}"]`));
  }

  function validatePillar(pillarIndex: number) {
    const form = formRef.current;
    if (!form) return false;
    return validateContainer(form.querySelector<HTMLElement>(`[data-pillar="${pillarIndex}"]`));
  }

  function next() {
    if (step === 1) {
      if (!validatePillar(pillarStep)) return;
      if (pillarStep < pillarQuestions.length - 1) {
        moveToStep(1, pillarStep + 1);
        return;
      }
      moveToStep(2, pillarStep);
      return;
    }

    if (!validateStep(step)) return;
    moveToStep(Math.min(step + 1, steps.length - 1), pillarStep);
  }

  function back() {
    if (step === 1 && pillarStep > 0) {
      moveToStep(1, pillarStep - 1);
      return;
    }
    if (step === 2) {
      moveToStep(1, pillarQuestions.length - 1);
      return;
    }
    moveToStep(Math.max(step - 1, 0), pillarStep);
  }

  function firstInvalidLocation() {
    const form = formRef.current;
    if (!form) return null;

    for (let index = 0; index < steps.length; index += 1) {
      if (index === 1) {
        for (let pillarIndex = 0; pillarIndex < pillarQuestions.length; pillarIndex += 1) {
          const pillar = form.querySelector<HTMLElement>(`[data-pillar="${pillarIndex}"]`);
          const required = Array.from(pillar?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[required], select[required], textarea[required]") ?? []);
          if (required.some((control) => !control.checkValidity())) return { step: 1, pillar: pillarIndex };
        }
        continue;
      }

      const container = form.querySelector<HTMLElement>(`[data-step="${index}"]`);
      const required = Array.from(container?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input[required], select[required], textarea[required]") ?? []);
      if (required.some((control) => !control.checkValidity())) return { step: index, pillar: null as number | null };
    }
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const invalid = firstInvalidLocation();
    if (invalid) {
      if (invalid.pillar !== null) setPillarStep(invalid.pillar);
      moveToStep(invalid.step, invalid.pillar ?? pillarStep);
      requestAnimationFrame(() => invalid.pillar !== null ? validatePillar(invalid.pillar) : validateStep(invalid.step));
      return;
    }

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
      window.localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      setStatus("success");
      element.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      saveDraft();
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

  const progress = ((step + 1) / steps.length) * 100;
  const stepLabel = step === 1 ? `Pilar ${pillarStep + 1} de ${pillarQuestions.length}` : `Etapa ${step + 1} de ${steps.length}`;

  return (
    <form
      className={styles.form}
      onSubmit={submit}
      onInput={() => saveDraft()}
      onChange={() => saveDraft()}
      ref={formRef}
      noValidate
    >
      <div className={styles.honeypot} aria-hidden="true">
        <label>Fax da empresa<input name="companyFax" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <div className={styles.progressShell} ref={progressRef}>
        <div className={styles.progressMeta}>
          <span>{stepLabel}</span>
          <span>{steps[step].eyebrow}</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <div className={styles.stepIntro}>
          <h2>{steps[step].title}</h2>
          <p>{steps[step].helper}</p>
        </div>
        {step === 1 ? (
          <div className={styles.pillarProgress} aria-hidden="true">
            {pillarQuestions.map((pillar, index) => <span key={pillar.key} data-active={index <= pillarStep ? "true" : "false"} />)}
          </div>
        ) : null}
      </div>

      <fieldset className={styles.stepPanel} data-step="0" hidden={step !== 0}>
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
          <textarea name="perceivedBlocker" required maxLength={1600} rows={5} placeholder="Pode responder do seu jeito. Não precisa usar termos técnicos." />
        </label>
        <div className={styles.questionGroup}>
          <p>Em quais áreas você sente que existem problemas ou oportunidades importantes?</p>
          <div className={styles.checkGrid}>
            {areas.map((area) => <label className={styles.check} key={area}><input type="checkbox" name="perceivedAreas" value={area} /><span>{area}</span></label>)}
          </div>
        </div>
      </fieldset>

      <fieldset className={styles.stepPanel} data-step="1" hidden={step !== 1}>
        <p className={styles.helper}>Isso registra sinais percebidos. Não confirma que exista um problema em cada área.</p>
        <div className={styles.pillars}>
          {pillarQuestions.map((pillar, index) => (
            <div className={styles.pillarQuestion} key={pillar.key} data-pillar={index} hidden={pillarStep !== index}>
              <div className={styles.pillarHeading}><span>{pillar.label}</span><small>{index + 1}/7</small></div>
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

      <fieldset className={styles.stepPanel} data-step="2" hidden={step !== 2}>
        <div className={styles.questionGroupFirst}>
          <p>Quais situações acontecem com frequência hoje?</p>
          <div className={styles.checkList}>
            {operationalSignals.map((signal) => <label className={styles.check} key={signal}><input type="checkbox" name="operationalSignals" value={signal} /><span>{signal}</span></label>)}
          </div>
        </div>
        <div className={styles.gridTwoSpaced}>
          <label>Tamanho aproximado da equipe<select name="teamSize" required defaultValue=""><option value="" disabled>Selecione</option><option value="founder_only">Somente fundador/dono</option><option value="2_5">2 a 5 pessoas</option><option value="6_15">6 a 15</option><option value="16_50">16 a 50</option><option value="50_plus">Mais de 50</option><option value="prefer_not">Prefiro não informar</option></select></label>
          <label>Momento da empresa<select name="companyMoment" required defaultValue=""><option value="" disabled>Selecione</option><option value="starting">Começando</option><option value="organizing">Opera, mas precisa organizar</option><option value="growing">Crescendo</option><option value="stable">Estabilizada buscando nova evolução</option><option value="difficulty">Passando por dificuldade/queda</option><option value="other">Outro</option></select></label>
        </div>
      </fieldset>

      <fieldset className={styles.stepPanel} data-step="3" hidden={step !== 3}>
        <div className={styles.gridTwo}>
          <label>Empresa<input name="companyName" required maxLength={160} /></label>
          <label>Segmento principal<input name="segment" required maxLength={120} /></label>
          <label>Seu cargo/função<input name="companyRole" required maxLength={120} /></label>
          <label>Cidade / estado<input name="cityState" required maxLength={120} /></label>
          <label>Site <small>opcional</small><input name="website" maxLength={240} placeholder="https://" /></label>
          <label>Instagram/rede principal <small>opcional</small><input name="socialUrl" maxLength={240} /></label>
        </div>
      </fieldset>

      <fieldset className={styles.stepPanel} data-step="4" hidden={step !== 4}>
        <div className={styles.questionGroupFirst}>
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

        <div className={styles.contactCard}>
          <div className={styles.contactIntro}>
            <span>PARA RECEBER A DEVOLUTIVA</span>
            <h3>Como podemos falar com você?</h3>
            <p>Seus dados de contato entram só agora, depois de você nos contar sobre a empresa.</p>
          </div>
          <div className={styles.gridTwo}>
            <label>Seu nome<input name="name" required maxLength={120} autoComplete="name" /></label>
            <label>E-mail<input name="email" type="email" required maxLength={180} autoComplete="email" /></label>
            <label>WhatsApp<input name="whatsapp" required maxLength={40} placeholder="(00) 00000-0000" autoComplete="tel" /></label>
          </div>
        </div>

        <label className={styles.consent}>
          <input type="checkbox" name="consent" value="yes" required />
          <span>Autorizo a Blinko a usar estas informações para analisar esta solicitação, armazená-las para acompanhamento comercial e entrar em contato por e-mail ou WhatsApp sobre este pré-diagnóstico.</span>
        </label>
      </fieldset>

      {status === "error" && <p className={styles.error} role="alert">Não conseguimos registrar agora. Suas respostas continuam salvas neste navegador; tente novamente.</p>}

      <div className={styles.stepActions}>
        {step > 0 ? <button className={styles.secondaryButton} type="button" onClick={back}>← Voltar</button> : <span />}
        {step < steps.length - 1 ? (
          <button className={styles.primaryButton} type="button" onClick={next}>{step === 1 && pillarStep < pillarQuestions.length - 1 ? "Próximo pilar →" : "Continuar →"}</button>
        ) : (
          <button className={styles.primaryButton} type="submit" disabled={status === "sending"}>{status === "sending" ? "Enviando…" : "Enviar pré-diagnóstico"}</button>
        )}
      </div>

      <p className={styles.formFootnote}>{hasDraft ? "Rascunho salvo neste navegador. Você pode sair e voltar depois para continuar." : step === 1 ? "Um pilar por vez. Suas respostas anteriores ficam preservadas." : "Você pode voltar entre as etapas sem perder o que já respondeu."}</p>

      {status === "sending" ? (
        <div className={styles.sendingOverlay} role="status" aria-live="polite" aria-busy="true">
          <div className={styles.sendingCard}>
            <span className={styles.spinner} aria-hidden="true" />
            <small>BLINKO</small>
            <h3>Registrando suas respostas…</h3>
            <p>Estamos organizando o pré-diagnóstico com segurança. Não feche esta página.</p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
