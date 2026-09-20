// SCRUM-305: DOM-freie, EINE Quelle der Wahrheit für die Einstiegsführung „so läuft der erste
// Arbeitsweg" (Hilfeseite). Ordnet die ehrlichen Stage-1-Prüfpunkte entlang Capture → Validation →
// Use → Gap → Maintain und verweist AUSSCHLIESSLICH auf vorhandene App-Routen. Kein Backend, kein
// Tracking, keine Feedback-DB, keine neue Route/Engine. Reine Datenbeschreibung — testbar ohne DOM.
//
// ================================================================================================
// JOB 4022 · EINSTIEG-HILFE — JEDER SCHRITT KENNT DIE ROLLE, DIE ER VERLANGT.
// ================================================================================================
//
// DER BEFUND (Stand 1.0.0-beta.1.503): Die Liste stand jedem offen — `/hilfe` trägt `minRole:
// "viewer"` (`app/navigation.ts:348-357`) —, vier ihrer fünf Schritte führten aber auf Routen, die
// eine höhere Rolle verlangen (`/erfassen` experte; `/validierung`, `/risiko`, `/lebenszyklus`
// controller). Wer als Gast klickte, landete in der Sperrkarte `RoleNotice`
// (`routes.tsx:184-188`) statt auf der versprochenen Seite. Die Führung führte ins Leere.
//
// DIE ROLLE WIRD ABGELEITET, NIE ABGESCHRIEBEN. `pilotSchritte` schlägt den Pfad in `ALL_ITEMS`
// nach und fragt `roleAllows` — dieselbe Funktion, über die der Router entscheidet. Eine hier
// eingetragene Rollenangabe liefe beim nächsten Rollenumbau auseinander und behauptete auf der
// Hilfeseite etwas, das der Router anders sieht (dieselbe Erwägung wie `routes.tsx:176-178` für
// die bewachten Deep-Links).
//
// WARUM NICHT `routePathAllows` (navigation.ts:561)? Sie beantwortet die Frage fail-OPEN: ein Pfad
// ohne Gate gilt als erreichbar — richtig für ein Klickziel, das der Router ohnehin durchlässt.
// Diese Liste ist aber eine FÜHRUNG: ein Schritt, dessen Pfad in `ALL_ITEMS` gar nicht vorkommt,
// ist ein Fehler in der Führung selbst und darf nicht stillschweigend als „für alle offen" gelten.
// Er wird deshalb als `routeUnbekannt` gemeldet (weder Link noch Rollenaussage) — und der Wächter
// in `tests/einstieg-gastweg/hilfe-fuehrt-den-gast-nicht-ins-leere.test.tsx` (G5) macht ihn rot,
// bevor er in eine Lieferung gerät.
import { ALL_ITEMS, HOME_ROUTE, type Role, roleAllows } from "../app/navigation";

export interface PilotCheckItem {
  id: string;
  n: number; // 1-basierte Reihenfolge im Arbeitsweg
  labelKey: string; // i18n-Key für den ehrlichen Prüfpunkt
  to: string; // vorhandene App-Route zum Ausprobieren
}

// Reihenfolge = Reihenfolge des ersten Arbeitswegs. Jede Aussage bleibt Stage-1-ehrlich (kein
// Stage-2-Versprechen):
//  1. Der Einstieg zeigt, was ansteht (JOB 4022: der Weg beginnt, wo der Gast steht)
//  2. Die Bibliothek zeigt den vorhandenen Bestand mit Status und Quelle (JOB 4022)
//  3. Erfassen speichert OFFEN (nicht validiert)
//  4. Validierung ist Review/Entscheidung (keine Auto-Freigabe)
//  5. Fragen/Bibliothek nutzen Wissen quellen-/statusbewusst
//  6. Keine Grundlage → ehrliche Lücke führt in die Erfassung (kein erfundenes Wissen)
//  7. Revalidierung ist „Aktuell halten" (keine automatische Dauergültigkeit)
export const PILOT_CHECKLIST: readonly PilotCheckItem[] = [
  { id: "start", n: 1, labelKey: "pilot.check.start", to: HOME_ROUTE },
  { id: "library", n: 2, labelKey: "pilot.check.library", to: "/bibliothek" },
  { id: "capture", n: 3, labelKey: "pilot.check.capture", to: "/erfassen" },
  { id: "validation", n: 4, labelKey: "pilot.check.validation", to: "/validierung" },
  { id: "use", n: 5, labelKey: "pilot.check.use", to: "/fragen" },
  { id: "gap", n: 6, labelKey: "pilot.check.gap", to: "/risiko" },
  { id: "maintain", n: 7, labelKey: "pilot.check.maintain", to: "/lebenszyklus" },
];

export function pilotChecklist(): readonly PilotCheckItem[] {
  return PILOT_CHECKLIST;
}

/**
 * Ein Schritt samt der Auskunft, ob die lesende Rolle ihn gehen darf.
 *
 * VIER ZUSTÄNDE, und drei davon sind keine Erfindung, sondern die Lagen, in denen die Fläche
 * WENIGER sagen muss als „offen"/„gesperrt":
 *   · `offen`          — die Rolle reicht; die Fläche darf führen.
 *   · `gesperrt`       — die Rolle reicht nicht; die verlangte Rolle steht daneben (`minRole`).
 *   · `rolleUnbekannt` — die Rolle steht noch nicht fest. Weder Link noch Sperrbehauptung: eine
 *                        Voreinstellung auf „offen" wäre der alte Fehler in neuer Form, eine auf
 *                        „gesperrt" eine unbelegte negative Aussage.
 *   · `routeUnbekannt` — der Pfad steht in keinem Navigationseintrag. Dann ist die verlangte Rolle
 *                        NICHT bekannt, und es wird auch keine behauptet (s. Kopf).
 */
export type PilotSchritt =
  | { item: PilotCheckItem; zugang: "offen" }
  | { item: PilotCheckItem; zugang: "gesperrt"; minRole: Role }
  | { item: PilotCheckItem; zugang: "rolleUnbekannt" }
  | { item: PilotCheckItem; zugang: "routeUnbekannt" };

/**
 * JOB 4358 · WELCHE ROLLE DIE FÜHRUNG ÜBERHAUPT BEHAUPTEN DARF.
 *
 * `RoleProvider` liefert IMMER eine Rolle — auch dann, wenn keine Sitzung feststeht: ohne
 * Session-Nutzer greift der lokale Vorschauwert, und der steht auf `"experte"`
 * (`app/RoleContext.tsx:34`, `lib/effectiveRole.ts:6-8`). Für den Router ist das richtig (er
 * entscheidet über dieselbe effektive Rolle, die Ansicht bleibt in sich stimmig); für eine AUSSAGE
 * über den Lesenden ist es falsch.
 *
 * GEMESSEN, NICHT VERMUTET (`tests/einstieg-gastweg/hilfe-rollenhinweise-sitzung.test.tsx`, Lauf
 * fb366e66038a51e10b456857): Solange `/auth/me` noch nicht geantwortet hatte — und ebenso nach 401,
 * 500 und Netzfehler — führte die Karte `/start`, `/bibliothek`, `/erfassen` und `/fragen` als offen
 * und rechnete „Als Experte stehen dir 4 von 7 offen" vor. `/erfassen` verlangt `experte`: einer
 * Betrachterin wurde also ein Weg angeboten, den ihr die nächste Antwort wieder wegnimmt, und über
 * ihre Rolle wurde etwas behauptet, wozu der Server nichts gesagt hat.
 *
 * DIE GRENZE IST DESHALB DIE HERKUNFT: Nur eine Rolle AUS EINER SITZUNG (`isSessionRole`, also ein
 * bestätigter Nutzer) trägt eine Aussage. Alles andere ist `null` — und damit dieselbe ehrliche
 * Lage wie ohne Rollenquelle (`rolleUnbekannt`, s. unten): weder Link noch Sperrbehauptung noch
 * Zahl. Die Vorschau eines ANGEMELDETEN Administrators bleibt unberührt: dort steht ein Nutzer
 * fest, und die gewählte Ansicht ist seine eigene Entscheidung.
 *
 * Kein Rechteeingriff: hier wird nichts geöffnet und nichts geschlossen, es wird nur weniger
 * behauptet.
 */
export function pilotRolleAusSitzung(quelle: { role: Role; isSessionRole: boolean }): Role | null {
  return quelle.isSessionRole ? quelle.role : null;
}

/**
 * Die Einstiegsführung, gelesen aus der Sicht EINER Rolle.
 *
 * `role === null` heißt „die Rolle steht noch nicht fest" — nicht „keine Rechte".
 */
export function pilotSchritte(role: Role | null): readonly PilotSchritt[] {
  return PILOT_CHECKLIST.map((item): PilotSchritt => {
    const eintrag = ALL_ITEMS.find((nav) => nav.path === item.to);
    if (!eintrag) {
      return { item, zugang: "routeUnbekannt" };
    }
    if (role === null) {
      return { item, zugang: "rolleUnbekannt" };
    }
    return roleAllows(eintrag, role)
      ? { item, zugang: "offen" }
      : { item, zugang: "gesperrt", minRole: eintrag.minRole };
  });
}
