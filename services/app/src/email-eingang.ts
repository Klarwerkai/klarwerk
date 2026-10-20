import { createHash } from "node:crypto";
import type { AuditService } from "../../audit";
import type { Draft, DraftPayload } from "../../capture";
import { kernaussageAusKlartext } from "../../structure";
import { anlageAusBasisadresse } from "./instanzbindung";

export const EMAIL_ANGENOMMEN = "email.entwurf-aufgenommen";

/** L-1: Die serverseitige Mailoperation bleibt bis zur dauerhaften Annahme unverbraucht. */
export async function pruefeEmailVerbrauch(
  draft: Draft,
  audit: Pick<AuditService, "list">,
): Promise<void> {
  const vorgang = draft.createOperation?.id;
  // Reservierter Namespace des Mailadapters, unveränderlich am Draft, nie aus seinem Payload.
  if (!vorgang || !/^email:[0-9a-f]{64}$/.test(vorgang)) return;
  const belege = await audit.list({ action: EMAIL_ANGENOMMEN, target: vorgang });
  if (belege.some((b) => b.payload.entwurfId === draft.id)) return;
  throw Object.assign(
    new Error(
      "Die Mail-Annahme ist noch nicht gesichert. Die Zustellung erneut übernehmen, bevor der Entwurf eingereicht oder endgültig entfernt wird.",
    ),
    { code: "CONFLICT" },
  );
}

/** Ein Eingang je Firmeninstanz. Die Bindung kommt nie aus der Nachricht. */
export interface EmailEingang {
  adresse: string;
  anlage: string;
  dienstId: string;
  eigentuemerId: string;
}

const MAILBOX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export function ladeEmailEingang(
  env: Record<string, string | undefined> = process.env,
): EmailEingang | null {
  try {
    const wert = JSON.parse(env.KLARWERK_EMAIL_EINGANG ?? "null");
    if (!wert || typeof wert !== "object" || Array.isArray(wert)) return null;
    const { adresse, anlage, dienstId, eigentuemerId } = wert;
    if (
      typeof adresse !== "string" ||
      adresse.length > 254 ||
      !MAILBOX.test(adresse) ||
      typeof anlage !== "string" ||
      anlage !== anlageAusBasisadresse(env.APP_BASE_URL) ||
      typeof dienstId !== "string" ||
      !/^[a-z0-9][a-z0-9-]{1,47}$/.test(dienstId) ||
      typeof eigentuemerId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(eigentuemerId)
    )
      return null;
    return { adresse: adresse.toLowerCase(), anlage, dienstId, eigentuemerId };
  } catch {
    return null;
  }
}

export class EmailEingangFehler extends Error {
  constructor(readonly code: "EMAIL_FORM" | "EMAIL_ANHAENGE" | "EMAIL_ADRESSE") {
    super(code);
  }
}

function kopf(wert: unknown, max: number): wert is string {
  return (
    typeof wert === "string" &&
    wert.trim().length > 0 &&
    wert.length <= max &&
    !Array.from(wert).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  );
}

const escapeText = (wert: string) =>
  wert
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Dekodierter Klartext vom berechtigten Mailadapter; kein MIME-Parser, kein Netzaufruf. */
export function emailAlsEntwurf(
  roh: unknown,
  eingang: EmailEingang,
): {
  payload: DraftPayload;
  vorgang: string;
  fingerprint: string;
  original: string;
} {
  if (!roh || typeof roh !== "object" || Array.isArray(roh))
    throw new EmailEingangFehler("EMAIL_FORM");
  const m = roh as Record<string, unknown>;
  const felder = ["recipient", "messageId", "from", "subject", "sentAt", "text", "attachments"];
  if (Object.keys(m).some((key) => !felder.includes(key)))
    throw new EmailEingangFehler("EMAIL_FORM");
  if (m.attachments !== undefined && (!Array.isArray(m.attachments) || m.attachments.length > 0)) {
    throw new EmailEingangFehler("EMAIL_ANHAENGE");
  }
  if (!kopf(m.recipient, 254) || m.recipient.toLowerCase() !== eingang.adresse) {
    throw new EmailEingangFehler("EMAIL_ADRESSE");
  }
  if (
    !kopf(m.messageId, 180) ||
    !kopf(m.from, 200) ||
    !kopf(m.subject, 200) ||
    !kopf(m.sentAt, 35) ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(m.sentAt) ||
    !Number.isFinite(Date.parse(m.sentAt)) ||
    typeof m.text !== "string" ||
    !m.text.trim() ||
    m.text.length > 100_000 ||
    Array.from(m.text).some((c) => c.charCodeAt(0) < 32 && !"\t\r\n".includes(c))
  )
    throw new EmailEingangFehler("EMAIL_FORM");

  // Kanonische JSON-Fassung: Der Hash gehört exakt zu den gesicherten UTF-8-Bytes.
  const original = JSON.stringify({
    format: "klarwerk-email-eingang-v1",
    anlage: eingang.anlage,
    recipient: eingang.adresse,
    messageId: m.messageId,
    from: m.from,
    subject: m.subject,
    sentAt: m.sentAt,
    text: m.text,
    attachments: [],
  });
  const fingerprint = sha256(original);
  const vorgang = `email:${sha256(
    JSON.stringify([eingang.anlage, eingang.adresse, eingang.eigentuemerId, m.messageId]),
  )}`;
  const label = `E-Mail: ${m.subject}`;
  const excerpt = `Message-ID: ${m.messageId} · SHA256: ${fingerprint}`;
  const zeilen = [
    "Weitergeleitete E-Mail – fachlich ungeprüft. Absender und Datum sind ungeprüfte Kopfzeilen.",
    `Eingang: ${eingang.adresse}`,
    `Absender laut Nachricht: ${m.from}`,
    `Datum laut Nachricht: ${m.sentAt}`,
    excerpt,
  ];
  return {
    vorgang,
    fingerprint,
    original,
    payload: {
      origin: "frontdoor",
      title: m.subject,
      statement: kernaussageAusKlartext(m.text),
      bodyHtml: `${zeilen.map((z) => `<p>${escapeText(z)}</p>`).join("")}<hr>${m.text
        .split(/\r?\n/)
        .map((z) => `<p>${escapeText(z)}</p>`)
        .join("")}`,
      // Keine fachliche Kategorie, Wissensart oder Stufe aus Mailheadern ableiten.
      pendingSources: [{ label, excerpt, sourceProvider: "Organisations-E-Mail" }],
    },
  };
}
