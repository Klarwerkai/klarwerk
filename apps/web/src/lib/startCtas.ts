// ================================================================================================
// AUFTRAG-mega38 BLOCK G3 (Pedi 27.07.) — DER ERSTE WEG FÜHRT ZUR EIGENEN ARBEIT.
// ================================================================================================
// Der größte, dunkelste Knopf oben rechts hiess für Controller UND Admins „Validierung öffnen" und
// schickte damit jede Erstnutzerin als ALLERERSTES in fremde Prüfarbeit — in eine Warteschlange
// mit dem Wissen anderer Leute, zu der sie noch gar keine Meinung haben kann.
//
// Der lauteste Weg führt jetzt dorthin, wo sie selbst etwas beitragen kann: fragen oder erfassen.
// Die Warteschlange ist NICHT verschwunden — sie steht als ruhiger Zweitweg daneben, in der
// Navigation und in „Nächste Handlungen" darunter mit ihrer echten Zahl. Weggenommen wurde ihr
// nicht der Zugang, sondern die Lautstärke.
//
// AUFTRAG-mega51 BLOCK A: die beiden Tabellen standen bis hierher in pages/Start.tsx und waren
// damit für den Sammler unsichtbar, der prüft, ob JEDES Ziel der Startseite für die angemeldete
// Rolle erreichbar ist. Sie stehen jetzt als DOM-freie Quelle hier — wie startHelp, startOrientation
// und stufe2Hint; die Seite rendert sie nur noch.
import type { Role } from "../app/navigation";

export interface StartCta {
  to: string;
  key: string;
}

const CTA_ASK: StartCta = { to: "/fragen", key: "start.ctaAsk" };

export const CTA_PRIMARY: Record<string, StartCta> = {
  viewer: CTA_ASK,
  experte: { to: "/erfassen", key: "start.ctaCapture" },
  controller: CTA_ASK,
  admin: CTA_ASK,
};

// Der Zweitweg existiert nur für die Rollen, die ihn überhaupt bedienen dürfen.
export const CTA_QUEUE: Record<string, StartCta> = {
  controller: { to: "/validierung", key: "start.ctaValidate" },
  admin: { to: "/validierung", key: "start.ctaValidate" },
};

export function startCta(role: Role): StartCta {
  return CTA_PRIMARY[role] ?? CTA_ASK;
}

export function startQueueCta(role: Role): StartCta | null {
  return CTA_QUEUE[role] ?? null;
}
