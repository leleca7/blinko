/**
 * BLINKO · Central de Leads (modelo de integração)
 * Instalar no Apps Script VINCULADO à planilha "Central de Leads".
 * NÃO publicar em produção sem revisar acesso, LGPD e credenciais.
 * Configurar propriedades do script (em Settings > Script properties):
 * BLINKO_SPREADSHEET_ID
 * BLINKO_WEBHOOK_SECRET
 * BLINKO_ALERT_EMAILS (opcional; destinatários separados por vírgula)
 */

const TRIAGE_FIELDS = [
  "id", "created_at", "updated_at", "completed_at", "whatsapp_link_opened_at",
  "name", "company_name", "whatsapp", "email", "request_kind", "challenge",
  "timeframe", "preferred_channel", "status", "stage", "source"
];

const FULL_FIELDS = [
  "id", "received_at", "name", "company_name", "whatsapp", "email",
  "city_state", "segment", "objective", "perceived_blocker",
  "perceived_areas", "operational_signals", "company_moment", "urgency",
  "review_status", "owner", "next_action", "source", "response_summary"
];

function response_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function text_(raw, max) {
  const s = raw == null ? "" : String(raw).slice(0, max || 16000);
  // Impedir fórmulas injetadas em dados fornecidos por visitantes.
  return /^[\s]*[=+\-@]/.test(s) ? "'" + s : s;
}

function date_(raw) {
  if (!raw) return "";
  const v = new Date(raw);
  return isNaN(v.getTime()) ? "" : v;
}

function emails_() {
  return (PropertiesService.getScriptProperties().getProperty("BLINKO_ALERT_EMAILS") || "")
    .split(",").map(s => s.trim()).filter(Boolean).join(",");
}

function getBook_() {
  const id = PropertiesService.getScriptProperties().getProperty("BLINKO_SPREADSHEET_ID");
  if (!id) throw new Error("BLINKO_SPREADSHEET_ID não configurado");
  return SpreadsheetApp.openById(id);
}

function findRow_(sheet, id) {
  const count = Math.max(sheet.getLastRow() - 1, 1);
  const values = sheet.getRange(2, 1, count, 1).getValues();
  let firstEmpty = null;
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === id) return i + 2;
    if (!values[i][0] && firstEmpty === null) firstEmpty = i + 2;
  }
  const row = firstEmpty || (sheet.getLastRow() + 1);
  if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
  return row;
}

function notifyTeam_(subject, lines) {
  const to = emails_();
  if (!to) return false;
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: lines.join("\n"),
    name: "Blinko · Central de Leads"
  });
  return true;
}

function upsertTriage_(book, event, lead) {
  const sh = book.getSheetByName("Triagem");
  if (!sh) throw new Error("Aba Triagem não encontrada");
  const row = findRow_(sh, lead.id);
  const values = TRIAGE_FIELDS.map(key =>
    (key.endsWith("_at") || key === "created_at" || key === "updated_at" || key === "completed_at") ?
      date_(lead[key]) : text_(lead[key], key === "challenge" ? 650 : 240)
  );
  sh.getRange(row, 1, 1, 16).setValues([values]);
  if (!sh.getRange(row, 17).getFormula()) {
    sh.getRange(row, 17).setFormula('=IF(A' + row + '="","",IF(N' + row +
      '="submitted","Concluída",IF(AND(N' + row +
      '="started",C' + row + '<>"",NOW()-C' + row +
      '>=1),"Possível abandono","Em andamento")))');
  }
  sh.getRange(row, 2, 1, 4).setNumberFormat("dd/MM/yyyy HH:mm");
  if (event === "submitted" && !sh.getRange(row, 23).getValue()) {
    const sent = notifyTeam_(
      "Blinko · nova triagem concluída (" + lead.id.slice(0, 8) + ")",
      [
        "Uma nova triagem foi registrada.",
        "Nome: " + lead.name,
        "Empresa: " + lead.company_name,
        "WhatsApp: " + lead.whatsapp,
        "E-mail: " + lead.email,
        "Tipo de pedido: " + lead.request_kind,
        "Descrição: " + lead.challenge,
        "Status de envio WhatsApp: NÃO CONFIRMADO.",
        "Consulte a Central de Leads: " + book.getUrl()
      ]
    );
    if (sent) sh.getRange(row, 23).setValue(new Date());
  }
  return { row: row, received: true };
}

function upsertFull_(book, lead) {
  const sh = book.getSheetByName("Diagnóstico");
  if (!sh) throw new Error("Aba Diagnóstico não encontrada");
  const row = findRow_(sh, lead.id);
  const values = FULL_FIELDS.map(key =>
    key === "received_at" ? date_(lead[key]) : text_(lead[key], key === "response_summary" ? 12000 : 1800)
  );
  sh.getRange(row, 1, 1, 19).setValues([values]);
  sh.getRange(row, 2).setNumberFormat("dd/MM/yyyy HH:mm");
  if (!sh.getRange(row, 21).getValue()) {
    const sent = notifyTeam_(
      "Blinko · questionário completo recebido (" + lead.id.slice(0, 8) + ")",
      [
        "O questionário detalhado foi recebido para revisão humana.",
        "Nome: " + lead.name,
        "Empresa: " + lead.company_name,
        "WhatsApp: " + lead.whatsapp,
        "E-mail: " + lead.email,
        "Acesse o registro completo na Central: " + book.getUrl()
      ]
    );
    if (sent) sh.getRange(row, 21).setValue(new Date());
  }
  return { row: row, received: true };
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return response_({ ok: false, error: "empty_request" });
    const p = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty("BLINKO_WEBHOOK_SECRET");
    if (!expected || !p.secret || String(p.secret) !== expected) return response_({ ok: false, error: "unauthorized" });
    if (!p.lead || !/^[0-9a-f-]{36}$/i.test(String(p.lead.id))) {
      return response_({ ok: false, error: "invalid_record" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const book = getBook_();
      const result = p.kind === "triage" ?
        upsertTriage_(book, p.event, p.lead) :
        p.kind === "diagnostic" ? upsertFull_(book, p.lead) : null;
      if (!result) return response_({ ok: false, error: "invalid_kind" });
      return response_({ ok: true, ...result });
    } finally { lock.releaseLock(); }
  } catch (error) {
    console.error("Webhook Blinko: " + (error && error.message ? error.message : "unknown"));
    return response_({ ok: false, error: "internal_error" });
  }
}

/**
 * Gatilho OPCIONAL de horário, por ex. 1x ao dia ou 1x por hora.
 * Envia aviso INTERNO para leads consentidos, inacabados há mais de 24h.
 * Nunca envia mensagens automaticamente a prospects.
 */
function checkAbandoned() {
  const book = getBook_();
  const sh = book.getSheetByName("Triagem");
  const to = emails_();
  if (!sh || !to) return;
  const now = new Date().getTime();
  const rows = Math.max(sh.getLastRow() - 1, 1);
  const data = sh.getRange(2, 1, rows, 24).getValues();
  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    const id = String(a[0] || "");
    const last = a[2] instanceof Date ? a[2].getTime() : 0;
    const status = a[13];
    const alreadyNotified = a[23];
    if (!id || !last || status !== "started" || alreadyNotified || now - last < 24 * 3600000) continue;
    notifyTeam_(
      "Blinko · contato sem conclusão (" + id.slice(0, 8) + ")",
      [
        "Um visitante registrou contato, mas não terminou a triagem há pelo menos 24h.",
        "Nome: " + String(a[5]),
        "Empresa: " + String(a[6]),
        "WhatsApp: " + String(a[7]),
        "E-mail: " + String(a[8]),
        "Confirme o contexto antes de entrar em contato.",
        "Central de Leads: " + book.getUrl()
      ]
    );
    sh.getRange(i + 2, 24).setValue(new Date());
  }
}
