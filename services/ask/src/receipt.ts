import { createHmac, timingSafeEqual } from "node:crypto";

// FUNKE-FIX P0 (bens Sammel-Nacht, ROT-1): der OPAKE Antwort-/Quellen-Beleg ("Receipt"). Wenn Ask
// eine Antwort liefert, bindet der Server serverseitig, WELCHE Quell-KOs diesem Nutzer in DIESEM
// Antwortvorgang ausgeliefert wurden. `/api/ask/helpful` legt den Receipt vor; der Server verifiziert,
// dass genau DAS gedankte KO in diesem Beleg steht — eine frei gewählte/unbelegte KO-ID ist damit
// nicht mehr wirksam (fremde Wirkung/Glocke/Trust nicht mehr fälschbar).
//
// Bewusst STATELESS über HMAC-SHA256 statt eines serverseitigen Stores: übersteht einen Neustart,
// braucht keine neue Tabelle/Migration und ist unter Nebenläufigkeit trivial atomar (reine Prüfung,
// kein Read-then-Write). Der Beleg ist KURZLEBIG (TTL) und trägt NUR IDs (Nutzer + Quell-KO-IDs +
// Ablauf) — keinen Frage-/Antworttext, kein Secret. Das Secret bleibt serverseitig.

// Bewusst großzügig genug für ein überlegtes „Danke" nach dem Lesen, kurz genug, dass ein
// abgegriffener Beleg nicht dauerhaft nutzbar ist.
export const ANSWER_RECEIPT_TTL_MS = 30 * 60 * 1000; // 30 Minuten

// FUNKE-FIX2 P0 (bens Blocker 2): Mindest-Schlüsselmaterial des Receipt-HMAC. Ein kürzeres/schwächeres
// Operator-Secret wäre anhand eines bekannten Belegs offline erratbar (der Beleg trägt nur IDs — der
// einzige Schutz ist die Signatur). 32 Bytes entspricht randomBytes(32) (dem Default ohne ENV).
export const MIN_RECEIPT_SECRET_BYTES = 32;

export class ReceiptSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptSecretError";
  }
}

const HEX_RE = /^[0-9a-fA-F]+$/;
const BASE64_RE = /^[A-Za-z0-9_+/-]+={0,2}$/;

// FUNKE-FIX3 Security (bens Blocker Receipt): gemeinsame Endprüfung JEDER Deutung. Geprüft werden
// NUR Mindestlänge und offensichtliche Wiederholung (wenige verschiedene Byte-Werte) — das ist
// bewusst KEIN Entropie-Nachweis; ein langer, aber vorhersagbarer Wert bleibt schwach. Empfohlen
// bleibt generiertes Material (`openssl rand -hex 32`).
function acceptSecretBytes(buf: Buffer, deutung: string): Buffer {
  if (buf.length < MIN_RECEIPT_SECRET_BYTES) {
    throw new ReceiptSecretError(
      `KLARWERK_ASK_RECEIPT_SECRET (als ${deutung} gedeutet) ergibt nur ${buf.length} Bytes — mindestens ${MIN_RECEIPT_SECRET_BYTES} dekodierte Bytes erforderlich (z. B. \`openssl rand -hex 32\`). Es gibt bewusst KEINEN Rückfall auf eine andere Deutung; eine rohe Passphrase explizit mit \`utf8:\`-Präfix setzen.`,
    );
  }
  const distinct = new Set(buf).size;
  if (distinct < 8) {
    throw new ReceiptSecretError(
      `KLARWERK_ASK_RECEIPT_SECRET ist offensichtlich repetitiv (nur ${distinct} verschiedene Byte-Werte) — Länge ersetzt keine Zufälligkeit. Bitte generiertes Material verwenden (z. B. \`openssl rand -hex 32\`).`,
    );
  }
  return buf;
}

function decodeHexSecret(value: string): Buffer {
  if (!HEX_RE.test(value) || value.length % 2 !== 0) {
    throw new ReceiptSecretError(
      "KLARWERK_ASK_RECEIPT_SECRET: `hex:`-Wert ist kein gültiges Hex (gerade Länge, nur 0-9a-f).",
    );
  }
  return acceptSecretBytes(Buffer.from(value, "hex"), "hex");
}

function decodeBase64Secret(value: string): Buffer {
  if (!BASE64_RE.test(value)) {
    throw new ReceiptSecretError(
      "KLARWERK_ASK_RECEIPT_SECRET: `base64:`-Wert ist kein gültiges Base64/Base64url.",
    );
  }
  return acceptSecretBytes(Buffer.from(value, "base64"), "base64");
}

function decodeUtf8Secret(value: string): Buffer {
  return acceptSecretBytes(Buffer.from(value, "utf8"), "utf8-Passphrase");
}

// FUNKE-FIX2 P0 (bens Blocker 2) + FUNKE-FIX3 (bens Blocker Receipt): validiert ein per ENV gesetztes
// Receipt-Secret, statt es ungeprüft zu übernehmen. Das Encoding ist EINDEUTIG — jeder Wert hat genau
// EINE Deutung, ein zweiter Interpretationsversuch desselben Strings findet nie statt:
//   - `hex:` / `base64:` / `utf8:`-Präfix erzwingt die Deutung (empfohlen, dokumentierbar);
//   - ohne Präfix wird erkennbares Hex (gerade Länge, nur 0-9a-f) NUR als Hex gedeutet, erkennbares
//     Base64/Base64url NUR als Base64 — dekodiert es zu < 32 Bytes, ist das ein Start-Fehler und wird
//     NICHT als UTF-8 neu interpretiert (vorher ging z. B. "0".repeat(32) als 32 UTF-8-Bytes durch);
//   - alles andere ist eine rohe UTF-8-Passphrase (≥ 32 Bytes). Ehrlich: geprüft werden nur Länge und
//     offensichtliche Wiederholung, KEINE Entropie.
// Ohne ENV bleibt es beim prozess-lokalen randomBytes(32) (s. AskService).
export function parseConfiguredReceiptSecret(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new ReceiptSecretError(
      "KLARWERK_ASK_RECEIPT_SECRET ist leer — mindestens 32 zufällige Bytes (hex/base64) erforderlich.",
    );
  }
  if (trimmed.startsWith("hex:")) {
    return decodeHexSecret(trimmed.slice("hex:".length));
  }
  if (trimmed.startsWith("base64:")) {
    return decodeBase64Secret(trimmed.slice("base64:".length));
  }
  if (trimmed.startsWith("utf8:")) {
    return decodeUtf8Secret(trimmed.slice("utf8:".length));
  }
  if (HEX_RE.test(trimmed) && trimmed.length % 2 === 0) {
    return decodeHexSecret(trimmed);
  }
  if (BASE64_RE.test(trimmed)) {
    return decodeBase64Secret(trimmed);
  }
  return decodeUtf8Secret(trimmed);
}

interface ReceiptPayload {
  // u = Empfänger des Antwortvorgangs (der Nutzer, der die Quellen ausgeliefert bekam).
  u: string;
  // s = die ausgelieferten Quell-KO-IDs (dedupliziert + sortiert → stabiler, kompakter Beleg).
  s: string[];
  // x = Ablauf (Epoch ms).
  x: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(secret: Buffer, body: string): string {
  return b64url(createHmac("sha256", secret).update(body).digest());
}

// Stellt einen signierten Beleg über (Nutzer, ausgelieferte Quell-KOs) aus. Leere Quellenliste ist
// zulässig (dann belegt der Receipt nichts → jedes „Danke" scheitert später an der Mitgliedschaft).
export function signAnswerReceipt(
  secret: Buffer,
  userId: string,
  sources: readonly string[],
  now: number,
  ttlMs: number = ANSWER_RECEIPT_TTL_MS,
): string {
  const payload: ReceiptPayload = {
    u: userId,
    s: [...new Set(sources)].sort(),
    x: now + ttlMs,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(secret, body)}`;
}

// Verifiziert Signatur + Ablauf und liefert die gebundenen Felder — oder null (ungültig/manipuliert/
// abgelaufen). Konstantzeit-Signaturvergleich; defensives Parsen (nie ein Wurf nach außen).
export function verifyAnswerReceipt(
  secret: Buffer,
  token: unknown,
  now: number,
): { userId: string; sources: readonly string[] } | null {
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }
  const dot = token.indexOf(".");
  if (dot <= 0 || dot >= token.length - 1) {
    return null;
  }
  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(secret, body);
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  let payload: ReceiptPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ReceiptPayload;
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.u !== "string" ||
    !Array.isArray(payload.s) ||
    !payload.s.every((id) => typeof id === "string") ||
    typeof payload.x !== "number"
  ) {
    return null;
  }
  if (payload.x < now) {
    return null; // abgelaufen
  }
  return { userId: payload.u, sources: payload.s };
}
