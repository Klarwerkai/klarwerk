// Reine, DOM-freie Logik fürs Entwurfs-Formular & Fortsetzen (SCRUM-113 / FE-CAP-07).
// Mapping Formular ↔ DraftPayload, Resume-Status, Vollständigkeit. Kein DOM, kein API-Aufruf.
import type { Draft, DraftPayload, KnowledgeType } from "../api/types";
import {
  type DraftBodyFoto,
  type DraftBodySegment,
  draftBodyFromText,
  draftBodyMitFotos,
  draftBodyPatch,
  draftBodyText,
  splitDraftBody,
} from "./draftBody";

/** Ein am Handy aufgenommenes oder aus der Mediathek gewähltes Foto (FR-CAP-04). */
export interface DraftFormFoto extends DraftBodyFoto {
  readonly id: string;
}

/**
 * Was das Handy-Interview über die Kernaussage hinaus festhält (FR-MOB-02) — dieselbe Zuordnung
 * Antwort → Feld wie der deterministische Interviewweg des Servers (`condenseInterview`,
 * services/reasoner/src/provider.ts): Bedingung, Maßnahme, Stichworte.
 */
export interface DraftFormStruktur {
  readonly conditions: readonly string[];
  readonly measures: readonly string[];
  readonly tags: readonly string[];
}

// Schlankes Mobile-/Resume-Formular: Titel + Aussage genügen für einen Entwurf.
export interface DraftFormState {
  title: string;
  statement: string;
  /**
   * JOB 3377 — DER FLIESSTEXT DES ENTWURFS, wenn er einen `bodyHtml` hat.
   *
   * Er steht NEBEN `statement`, nicht an dessen Stelle: welches der beiden Felder die Fläche zeigt,
   * entscheidet allein `segments` (s. `draftToForm`). Ein Entwurf ohne Body verhält sich
   * unverändert wie bisher — dort fehlen `body` und `segments`, und die Kernaussage bleibt das eine
   * Feld. Deshalb sind beide OPTIONAL: der bisherige Weg bleibt wörtlich der bisherige.
   */
  body?: string;
  /**
   * Die Zerlegung des GESPEICHERTEN Bodys. Sie ist zugleich der Schalter („trägt dieser Entwurf
   * einen Body?") und der Bauplan für die Rückwandlung — Bilder, Tabellen und Auszeichnung reisen
   * darin wörtlich mit (s. `draftBodyFromText`).
   *
   * Sie liegt bewusst IM Formularzustand und nicht als zweiter Parameter an `formToPayload`: so
   * gibt es keine Aufrufform, die den Body versehentlich weglässt — der Weg ist einer, nicht zwei.
   */
  segments?: readonly DraftBodySegment[];
  /**
   * JOB 4193 — DER BEIM LADEN GESEHENE STAND (`Draft.updatedAt`) DES FORTGESETZTEN ENTWURFS.
   *
   * Er reist aus demselben Grund im Formularzustand mit wie `segments`: es soll keinen
   * Speicherweg geben können, der ihn vergisst (Knopf, Wächter, Warteschlange). Ein FRISCH
   * angelegter Entwurf hat keinen — er kann noch niemandem am Desktop begegnet sein, und dort
   * bleibt jede Zeile wörtlich wie bisher.
   *
   * ER IST KEIN ENTWURFSFELD. `formToPayload` nimmt ihn deshalb NICHT auf; er reist NEBEN der
   * Nutzlast (`formToUpdate` → `endpoints.drafts.update(id, payload, { expectedUpdatedAt })`),
   * genau wie der Promote-Weg es seit JOB 2684 D1 tut (`captureFrontDoor.ts`). Gepinnt in
   * `tests/app/job2684-draft-stale-route.test.ts`: `payload.expectedUpdatedAt` bleibt `undefined`.
   */
  gesehenerStand?: string;
  /**
   * FR-MOB-02 — die Felder, die das Handy-Interview zusätzlich zur Kernaussage füllt. Nur an einem
   * NEUEN Entwurf ohne Body; fehlt das Feld, bleibt jeder Weg wörtlich wie bisher.
   */
  struktur?: DraftFormStruktur;
  /**
   * FR-CAP-04 — Fotos eines NEUEN Entwurfs. Sie reisen aus demselben Grund im Formularzustand wie
   * `segments`: Knopf, Weggeh-Wächter und Warteschlange bauen ihre Nutzlast alle über
   * `formToPayload` — keiner davon kann die Fotos vergessen.
   */
  fotos?: readonly DraftFormFoto[];
}

export const EMPTY_DRAFT_FORM: DraftFormState = { title: "", statement: "" };

/**
 * Formular → DraftPayload (nur gesetzte Felder; getrimmt).
 *
 * JOB 3377: MIT `segments` (der Entwurf hat einen Body) wird der BODY geschrieben und `statement`
 * bewusst NICHT mitgeschickt — der partielle Merge (`mergeDraftPayload`, services/capture/src/
 * service.ts) lässt die gespeicherte Kernaussage damit unangetastet stehen. `draftBodyPatch` oben
 * regelt wie bisher den Leerfall, und zwar als EINZIGE Quelle dafür. `segments` gibt es nur an
 * einem FORTGESETZTEN Entwurf mit Body, also immer an einem Update — daher `isDraftUpdate = true`.
 * OHNE `segments` bleibt alles Zeile für Zeile wie vorher.
 */
export function formToPayload(form: DraftFormState): DraftPayload {
  const payload: DraftPayload = {};
  const title = form.title.trim();
  if (title) {
    payload.title = title;
  }
  if (form.segments) {
    return {
      ...payload,
      ...draftBodyPatch(draftBodyFromText(form.segments, form.body ?? ""), true),
    };
  }
  const statement = form.statement.trim();
  if (statement) {
    payload.statement = statement;
  }
  // FR-MOB-02: nur gesetzte Einträge — ein leeres Interviewfeld legt am Entwurf nichts an.
  const struktur = form.struktur;
  if (struktur) {
    const conditions = nichtLeer(struktur.conditions);
    const measures = nichtLeer(struktur.measures);
    const tags = nichtLeer(struktur.tags);
    if (conditions.length > 0) {
      payload.conditions = conditions;
    }
    if (measures.length > 0) {
      payload.measures = measures;
    }
    if (tags.length > 0) {
      payload.tags = tags;
    }
  }
  // FR-CAP-04: Fotos gehen als Body mit. Die Kernaussage bleibt daneben stehen — wie an jedem
  // Entwurf mit Body (JOB 3377), und `draftTitle` findet den Listentitel weiterhin dort.
  if (form.fotos && form.fotos.length > 0) {
    payload.bodyHtml = draftBodyMitFotos(form.statement, form.fotos);
  }
  return payload;
}

function nichtLeer(werte: readonly string[]): string[] {
  return werte.map((w) => w.trim()).filter((w) => w.length > 0);
}

/** Vergleichbare Kurzform der Interviewfelder — für „geändert?" und „speicherbar?". */
function strukturText(form: DraftFormState): string {
  const s = form.struktur;
  if (!s) {
    return "";
  }
  const teile = [s.conditions, s.measures, s.tags].map((l) => nichtLeer(l));
  return teile.some((l) => l.length > 0) ? JSON.stringify(teile) : "";
}

function fotoKennungen(form: DraftFormState): string {
  return (form.fotos ?? []).map((f) => f.id).join(",");
}

/**
 * Bestehenden Entwurf ins Formular laden (Resume).
 *
 * JOB 3377: trägt er einen Body, steht im Textfeld DERSELBE Text, den die Vollversion im Editor
 * zeigt. FEHLT EIN GESICHERTES ORIGINAL (`anchorsMissing`), wird der Body NICHT angefasst: der
 * Server hat ihn dann bewusst ausgedünnt (`withAnchorCheck`, services/capture/src/service.ts) und
 * liefert `bodyHtml: null` — ein Zurückschreiben aus diesem Stand hiesse, den echten Body zu
 * löschen. Dann bleibt es beim Kernaussage-Weg, genau wie bisher.
 *
 * JOB 4193: `updatedAt` ist OPTIONAL am Eingang, und das ist keine Bequemlichkeit. Es gibt einen
 * echten Aufrufer ohne Stand — die offline in der Warteschlange liegende Fassung
 * (`QueuedOp.payload`, Mobile.tsx). Sie IST eine Nutzlast und kein Entwurf; ihr einen Stand
 * anzudichten, hiesse eine Voraussetzung zu behaupten, die sie nicht hat.
 */
export function draftToForm(
  draft: Pick<Draft, "payload" | "anchorsMissing"> & Partial<Pick<Draft, "updatedAt">>,
): DraftFormState {
  const ankerFehlt = (draft.anchorsMissing?.length ?? 0) > 0;
  const segments =
    !ankerFehlt && draft.payload.bodyHtml?.trim() ? splitDraftBody(draft.payload.bodyHtml) : null;
  return {
    title: draft.payload.title ?? "",
    statement: draft.payload.statement ?? "",
    ...(segments ? { body: draftBodyText(segments), segments } : {}),
    ...(draft.updatedAt ? { gesehenerStand: draft.updatedAt } : {}),
  };
}

/**
 * JOB 4193 — EIN AKTUALISIERUNGSVORGANG: die Nutzlast UND der gesehene Stand daneben.
 *
 * Es gibt am Handy zwei Speicherwege (der Knopf und der Weggeh-Wächter) und die Warteschlange.
 * Damit sie nicht auseinanderlaufen können, baut sie alle DIESE eine Funktion — wer sie ruft,
 * kann den Stand nicht vergessen, und wer ihn nicht hat (neuer Entwurf), sendet ihn auch nicht
 * als Leerwert.
 */
export interface DraftUpdateRequest {
  payload: DraftPayload;
  /** Fehlt bei einem NEU angelegten Entwurf — dort gibt es keinen gesehenen Stand. */
  expectedUpdatedAt?: string;
}

export function formToUpdate(form: DraftFormState): DraftUpdateRequest {
  const payload = formToPayload(form);
  return form.gesehenerStand ? { payload, expectedUpdatedAt: form.gesehenerStand } : { payload };
}

/** Die Felder, die ein Mensch am Handy wirklich vor sich hat. */
export type DraftFeld = "title" | "statement" | "body";

/**
 * Das EINE Textfeld dieser Fläche — und welches es ist, entscheidet allein `segments` (JOB 3377,
 * s. `bodyMode` in Mobile.tsx). Ein Entwurf mit Body zeigt den Fliesstext, einer ohne die
 * Kernaussage. Deshalb wird auch nur DAS verglichen, was sichtbar ist: eine Abweichung in einem
 * Feld, das die Fläche gar nicht zeigt, wäre für den Menschen eine Behauptung ohne Gegenstand.
 */
function textfeld(form: DraftFormState): { feld: DraftFeld; wert: string } {
  return form.segments !== undefined
    ? { feld: "body", wert: (form.body ?? "").trim() }
    : { feld: "statement", wert: form.statement.trim() };
}

/**
 * JOB 4193 — WELCHES FELD WEICHT AB: die Feldangabe der Rückfrage.
 *
 * Verglichen wird getrimmt, wie `isDraftFormChanged` es tut (nur äussere Leerzeichen sind keine
 * Änderung) — sonst meldete ein angehängter Zeilenumbruch einen Unterschied, den niemand sieht.
 * Zeigen die beiden Fassungen VERSCHIEDENE Textfelder (die eine hat einen Body, die andere nicht),
 * ist das ein Unterschied in genau dem Feld, das der Mensch vor sich hat.
 */
export function abweichendeFelder(meins: DraftFormState, anderes: DraftFormState): DraftFeld[] {
  const felder: DraftFeld[] = [];
  if (meins.title.trim() !== anderes.title.trim()) {
    felder.push("title");
  }
  const a = textfeld(meins);
  const b = textfeld(anderes);
  if (a.feld !== b.feld || a.wert !== b.wert) {
    felder.push(a.feld);
  }
  return felder;
}

// Nur die bearbeitbaren Textfelder zählen; segments ist der unverändert mitreisende Bauplan.
// Interviewfelder und Fotos sind Eingaben wie der Text — auch sie schützt der Weggeh-Wächter.
export function isDraftFormChanged(form: DraftFormState, baseline: DraftFormState): boolean {
  return (
    form.title.trim() !== baseline.title.trim() ||
    form.statement.trim() !== baseline.statement.trim() ||
    (form.body ?? "").trim() !== (baseline.body ?? "").trim() ||
    strukturText(form) !== strukturText(baseline) ||
    fotoKennungen(form) !== fotoKennungen(baseline)
  );
}

// Ein Entwurf ist speicherbar, sobald irgendein Inhalt da ist — auch ein Foto allein ist etwas,
// das an der Anlage festgehalten werden will.
export function isDraftFormFillable(form: DraftFormState): boolean {
  return (
    form.title.trim().length > 0 ||
    form.statement.trim().length > 0 ||
    (form.body ?? "").trim().length > 0 ||
    strukturText(form).length > 0 ||
    (form.fotos?.length ?? 0) > 0
  );
}

// Kurzer, sicherer Anzeigetitel für die Entwurfsliste.
export function draftTitle(draft: Pick<Draft, "payload">, fallback: string): string {
  const t = draft.payload.title?.trim();
  if (t) {
    return t;
  }
  const s = draft.payload.statement?.trim();
  return s ? s.slice(0, 60) : fallback;
}

// FR-CAP-07: Promote setzt ein KO voraus — Pflichtfelder vollständig?
// type/category sind im schlanken Formular nicht erfasst → fehlen i. d. R. (ehrlich gemeldet).
export function isPromotable(payload: DraftPayload): boolean {
  return Boolean(
    payload.title?.trim() && payload.statement?.trim() && payload.type && payload.category,
  );
}

export const KNOWLEDGE_TYPES_DRAFT: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];

// FR-STR-01 (R-0315): die vom Strukturierungsvorschlag gelieferte Wissensart vorbelegen. Geschützt
// ist jede ENTSCHIEDENE Wissensart — vom Menschen gewählt (auch wenn er bewusst den Standardwert
// zurückstellt) oder aus einem gespeicherten Entwurf geladen. Der Standardwert allein ist KEINE
// Freigabe (Bens Befund Nacharbeit 2): ob entschieden wurde, muss der Aufrufer ausdrücklich
// mitführen. Liefert der Vorschlag keine (oder eine unbekannte) Wissensart, bleibt der aktuelle Wert.
// Die Auswahl bleibt danach frei änderbar — der Mensch korrigiert und speichert.
export function adoptProposedKnowledgeType(
  current: KnowledgeType,
  decided: boolean,
  proposed: KnowledgeType | undefined,
): KnowledgeType {
  if (decided) {
    return current;
  }
  return proposed && KNOWLEDGE_TYPES_DRAFT.includes(proposed) ? proposed : current;
}
