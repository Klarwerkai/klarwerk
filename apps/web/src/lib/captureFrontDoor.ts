import type { Confidentiality, DraftPayload, StructureResult } from "../api/types";
// AUFTRAG-mega7 Block A: gemeinsame Leerwert-Semantik für den Body (dieselbe wie im Erfassen-Weg).
// AUFTRAG-mega69 Block A: der EINE vorhandene Bild-Anker (DOCX-Vertrag) — beim Entwurf-Laden auch
// für Klara-Bilder, die der Draft-Weg unverankert liefert.
import { wrapImagesInFigures } from "./docx";
import { draftBodyPatch } from "./draftBody";
import { htmlToPlainText, normalizePastedHtml } from "./richText";

export const CAPTURE_FRONT_DOOR_ROUTE = "/capture/frontdoor";
// SCRUM-487 (i18n): der Fallback-Titel wird als echter KO-Titel gespeichert (Daten, nicht nur
// Anzeige). Diese Konstante bleibt der deutsche DEFAULT; die Ansicht reicht den lokalisierten Wert
// (t("cfd.fallbackTitle")) über die Parameter unten durch, damit der gespeicherte Titel der Sprache
// folgt, ohne dass die Lib den i18n-Kontext braucht.
export const CAPTURE_FRONT_DOOR_FALLBACK_TITLE = "Unbenanntes Wissensobjekt";
export const FRONT_DOOR_SAVE_TIMEOUT_MS = 30000;
export const FRONT_DOOR_SAVE_TIMEOUT_MESSAGE =
  "Speichern dauert zu lange. Bitte prüfe Bibliothek oder Entwürfe, bevor du erneut speicherst.";
// SCRUM-487 (i18n): reine Anzeigemeldung → stabiler i18n-Key; die Ansicht macht t(...).
export const FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY = "cfd.structuringUnavailable";

export class FrontDoorSaveTimeoutError extends Error {
  constructor() {
    super(FRONT_DOOR_SAVE_TIMEOUT_MESSAGE);
    this.name = "FrontDoorSaveTimeoutError";
  }
}

const MAX_TITLE_LENGTH = 90;
const MAX_STATEMENT_LENGTH = 500;
const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function firstBlockHtml(html: string): string {
  const heading = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i.exec(html);
  if (heading?.[1]) {
    return heading[1];
  }
  const block =
    /<(?:p|div|li|blockquote|td|th)\b[^>]*>([\s\S]*?)<\/(?:p|div|li|blockquote|td|th)>/i.exec(html);
  return block?.[1] ?? html;
}

function compactTitle(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH).trim();
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char] ?? char);
}

export function deriveFrontDoorTitle(
  manualTitle: string,
  bodyHtml: string,
  fallbackTitle: string = CAPTURE_FRONT_DOOR_FALLBACK_TITLE,
): string {
  const explicitTitle = compactTitle(manualTitle);
  if (explicitTitle) {
    return explicitTitle;
  }

  const normalizedBody = normalizePastedHtml(bodyHtml);
  const derived = compactTitle(htmlToPlainText(firstBlockHtml(normalizedBody)));
  return derived || fallbackTitle;
}

export function frontDoorStatement(bodyHtml: string, title: string): string {
  const text = htmlToPlainText(bodyHtml).slice(0, MAX_STATEMENT_LENGTH).trim();
  return text || title;
}

// AUFTRAG-mega9 Block A (KW-E2E-001): Beim FORTSETZEN gilt dieselbe Unterscheidung, die
// draftBodyPatch beim Speichern trifft — sonst repariert die eine Richtung, was die andere
// wieder einsammelt:
//
//   bodyHtml FEHLT (undefined) ⇒ es gab nie einen Body → Aussage als Einstieg zeigen.
//   bodyHtml VORHANDEN, aber leer ("" oder null) ⇒ AUSDRÜCKLICH geleert → leer bleiben.
//
// `null` zählt dabei zum zweiten Fall — das ist die Leerwert-Konvention dieser Payloads (vgl.
// `asset: … : null`). Nur das WEGLASSEN des Schlüssels heißt „kein Wert vorhanden"; genau so
// behandeln es auch die Payloads, die bodyHtml wegen der Bilddaten bewusst auslassen (api/types.ts).
//
// Vorher fiel auch der ausdrücklich geleerte Body auf die Aussage zurück. Da der Vordertür-Payload
// die Aussage aus dem Body ableitet (frontDoorStatement: leerer Body → Titel), erschien nach dem
// Leeren und Fortsetzen der TITEL als Fließtext im Editor — bewusst entfernter Inhalt kehrte über
// einen zweiten Weg zurück, genau der Effekt, den mega7 für das Studio beseitigt hat.
export function frontDoorBodyFromDraft(payload: DraftPayload): string {
  if (payload.bodyHtml !== undefined) {
    // AUFTRAG-mega69 Block A (gemessen, _relay/messung/mega69-klara-bildanker-probe.ts): der
    // Klara-Draft-Weg liefert eingebettete Bilder als NACKTE <img data:image…> — der Server-
    // Sanitizer erhält sie, erzeugt aber KEINEN figure/figcaption-Anker (den baut nur der
    // DOCX-/PPTX-Import clientseitig, lib/docx.ts). Ohne Anker: kein Galerie-Eintrag, keine
    // Fußnote, totes Bildbeschreibungs-Formular. Deshalb wird beim LADEN eines Entwurfs mit
    // DERSELBEN vorhandenen Funktion verankert (bereits verankerte figures bleiben unberührt).
    // Persistiert wird der Anker über den normalen Speicher-/Submit-Weg (Sanitizer erlaubt ihn).
    return payload.bodyHtml?.trim() ? wrapImagesInFigures(payload.bodyHtml, "") : "";
  }
  const statement = payload.statement?.trim();
  return statement ? `<p>${escapeHtml(statement)}</p>` : "";
}

export function buildFrontDoorPayload(input: {
  title: string;
  bodyHtml: string;
  fallbackTitle?: string;
  // SCRUM-502 Schicht 2 (Round 3): die im Front-Door gewählte Vertraulichkeit fließt in den Entwurf
  // (und damit ins spätere KO), damit Anzeige/Egress konsistent zur Erfassung sind. Standard „intern".
  confidentiality?: Confidentiality;
  // AUFTRAG-mega7 Block A (bens Ship-Blocker): liegt ein bestehender Entwurf vor, ist dieser Payload
  // ein PUT über den Bestand — dann muss ein bewusst geleerter Body als ausdrücklicher Leerwert
  // mitreisen, sonst holt der partielle Server-Merge den alten Body zurück (und der Promote trägt
  // ihn ins Wissensobjekt). Ohne Entwurfs-Id ist es ein Neuanlegen: kein Altwert, kein Löschmarker.
  activeDraftId?: string | null;
  // JOB 2695 (Review-Befund R2-19): der EINREICHEN-Weg fordert den vollständigen Rumpf an, auch
  // über einen bestehenden Entwurf. Warum das nötig ist, steht im Block unter dieser Signatur.
  vollstaendig?: boolean;
}): DraftPayload {
  const bodyHtml = normalizePastedHtml(input.bodyHtml);
  const title = deriveFrontDoorTitle(input.title, bodyHtml, input.fallbackTitle);

  // ==============================================================================================
  // JOB 2695 (Review-Befund R2-19) — WAS DIESE FLÄCHE NICHT FÜHRT, DARF SIE NICHT LÖSCHEN.
  // ==============================================================================================
  //
  // DER SCHADEN: Die Vordertür lädt JEDE `?draft=<id>` aus der URL, nicht nur ihre eigenen. Sie
  // sendete bisher für jeden geladenen Entwurf `tags: []`, `conditions: []`, `measures: []` mit —
  // und der Merge des Entwurfsdienstes liest mitgeschickte Leerwerte als LÖSCHUNG. Er sagt das
  // selbst (`services/capture/src/service.ts:371-372`):
  //
  //     Schlüssel NICHT mitgeschickt (oder Wert `undefined`) ⇒ Altwert bleibt.
  //     Schlüssel mitgeschickt mit LEERWERT ([], "", …)      ⇒ Altwert geht.
  //
  // Ein Studio-Entwurf mit Maßnahmen verlor sie also beim ersten Speichern in der Vordertür —
  // still, ohne Fehlermeldung. Und mit `origin: "frontdoor"` wurde er dauerhaft zu einem
  // Vordertür-Entwurf: Das Studio schickte ihn beim Fortsetzen zurück in die Vordertür, der Mensch
  // kam nie wieder an seine Felder.
  //
  // DIE REGEL BLEIBT RICHTIG, NICHT DER AUFRUFER. Ohne Löschsemantik könnte niemand ein Feld je
  // wieder leeren; genau das war der Ship-Blocker aus mega7 Block A. Falsch war, dass die
  // Vordertür Leerwerte schickte, die sie gar nicht meinte. Deshalb wird hier geschnitten und
  // nicht im Dienst.
  //
  // ZWEI FRAGEN, DIE VORHER DIESELBE WAREN — und ihre Vermengung hat in D3 Pedis Einreichen-Weg
  // gebrochen, der einen Tag zuvor grün geworden war:
  //
  //     ueberBestand · Reist dieser Payload über einen VORHANDENEN Entwurf? Davon hängt der
  //                    Löschmarker für einen bewusst geleerten Body ab (mega7 Block A).
  //     nurEigene    · Soll er auf die Felder schrumpfen, die DIESE Fläche führt? Nur beim
  //                    SPEICHERN — nicht beim Einreichen.
  //
  // `submitFrontDoorDraft` baut seinen Rumpf mit DERSELBEN Funktion und schickt ihn als
  // `draftPayload` ins Promote, wo daraus ein Wissensobjekt entsteht. Ohne `type` und `category`
  // weist die Route ihn mit `400 INCOMPLETE` ab. Deshalb fordert der Einreichen-Weg
  // `vollstaendig: true` an — und nur er.
  //
  // `origin` REIST BEIM ÄNDERN NICHT MEHR MIT: Ein Entwurf wechselt seine Herkunft nicht, weil ihn
  // jemand einmal woanders geöffnet hat. Beim Neuanlegen wird sie gesetzt, denn dort gibt es keine.
  const ueberBestand = Boolean(input.activeDraftId);
  const nurEigene = ueberBestand && input.vollstaendig !== true;

  const eigeneFelder: DraftPayload = {
    title,
    statement: frontDoorStatement(bodyHtml, title),
    ...draftBodyPatch(bodyHtml, ueberBestand),
    ...(input.confidentiality && input.confidentiality !== "intern"
      ? { confidentiality: input.confidentiality }
      : {}),
  };

  if (nurEigene) {
    return eigeneFelder;
  }

  return {
    ...eigeneFelder,
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    conditions: [],
    measures: [],
    origin: "frontdoor",
  };
}

// WP-D7 (Befund 3, Latenz/FALLBACK-Diagnose): Bei großen Dokumenten (z. B. das ganze BAADER-PDF inkl.
// Inhaltsverzeichnis) ging bisher der KOMPLETTE Klartext als Prompt an den Reasoner. Ein riesiger Prompt
// ist langsam (→ „hängt sehr lange") und läuft ins Modell-Timeout (30 s) → deterministischer Fallback
// (FALLBACK-Badge). Der Struktur-Vorschlag braucht für Titel/Struktur nur den Anfang. Deshalb wird der
// Prompt-Input hier sinnvoll gekappt (erste N Zeichen an einer Wortgrenze + ehrlicher Kürzungshinweis).
// Das ändert NICHTS am gespeicherten Body — nur den an die KI gereichten Text (Original bleibt heilig).
export const FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS = 12000;
// WP-D7b (Klein-Fix 3): Der Kürzungshinweis wird ins Budget EINGERECHNET — die Rückgabe überschreitet die
// Konstante nie. Führendes Leerzeichen + Klammer-Ellipse (ein Zeichen U+2026).
const STRUCTURE_INPUT_TRUNCATION_SUFFIX = " […]";

function capStructureInput(text: string): string {
  if (text.length <= FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS) {
    return text;
  }
  // WP-D7b (Klein-Fix 3): codepoint-bewusst kappen — ein einfaches slice(0, N) könnte ein Surrogatpaar
  // (z. B. Emoji) mitten durchtrennen und einen kaputten Codepoint hinterlassen. Budget = Max ABZÜGLICH
  // Suffixlänge, damit die Rückgabe inkl. „[…]" die Konstante nicht überschreitet. Wir füllen den Kopf
  // codepoint-weise (for..of iteriert Codepoints) bis knapp unters Budget — nie in ein Surrogatpaar hinein.
  const budget = FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS - STRUCTURE_INPUT_TRUNCATION_SUFFIX.length;
  let head = "";
  for (const codePoint of text) {
    if (head.length + codePoint.length > budget) {
      break;
    }
    head += codePoint;
  }
  // An der letzten Wortgrenze kappen, sofern sie nicht zu weit vorne liegt (kein zerrissenes Wort). Das
  // Leerzeichen ist BMP → der Schnitt an lastSpace trennt garantiert kein Surrogatpaar.
  const lastSpace = head.lastIndexOf(" ");
  const trimmed = (lastSpace > budget * 0.8 ? head.slice(0, lastSpace) : head).trimEnd();
  return `${trimmed}${STRUCTURE_INPUT_TRUNCATION_SUFFIX}`;
}

export function buildFrontDoorStructureInput(input: {
  title: string;
  bodyHtml: string;
}): string {
  const title = compactTitle(input.title);
  const body = htmlToPlainText(normalizePastedHtml(input.bodyHtml));
  const combined = [title, body]
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
  return capStructureInput(combined);
}

function renderList(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (clean.length === 0) {
    return "";
  }
  return `<ul>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function frontDoorStructuredBodyHtml(result: StructureResult): string {
  const sections: string[] = [];
  const title = compactTitle(result.title);
  const statement = result.statement.trim();

  if (title) {
    sections.push(`<h2>${escapeHtml(title)}</h2>`);
  }
  if (statement) {
    sections.push(`<p><strong>Kernaussage:</strong> ${escapeHtml(statement)}</p>`);
  }
  const conditions = renderList(result.conditions);
  if (conditions) {
    sections.push(`<h3>Bedingungen</h3>${conditions}`);
  }
  const measures = renderList(result.measures);
  if (measures) {
    sections.push(`<h3>Massnahmen</h3>${measures}`);
  }
  if (result.tags.length > 0) {
    sections.push(`<p><strong>Hinweise:</strong> ${escapeHtml(result.tags.join(", "))}</p>`);
  }

  return sections.join("");
}

export function withFrontDoorSaveTimeout<T>(
  save: Promise<T>,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new FrontDoorSaveTimeoutError());
    }, timeoutMs);

    save.then(resolve, reject).finally(() => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    });
  });
}

export function createFrontDoorDraft<TDraft>(
  input: {
    title: string;
    bodyHtml: string;
    fallbackTitle?: string;
    confidentiality?: Confidentiality;
  },
  createDraft: (payload: DraftPayload) => Promise<TDraft>,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<TDraft> {
  return withFrontDoorSaveTimeout(createDraft(buildFrontDoorPayload(input)), timeoutMs);
}

export interface FrontDoorDraftRef {
  id: string;
}

// ================================================================================================
// AUFTRAG-mega23 Block A — DIE VORDERTÜR BEKOMMT EINEN VORGANG, DER DIE WIEDERHOLUNG ÜBERLEBT.
// ================================================================================================
//
// DER BEFUND (ben, sammel22). Der Server bietet Idempotenz nur an, wenn `operationId` mitkommt.
// Die Vordertür schickte ihn NICHT — sie verdrahtete `promoteDraft: (id) => promote(id)`. Der
// Kommentar in `capture-routes.ts` behauptete das Gegenteil („Capture.tsx, CaptureFrontDoor.tsx
// schicken ihn ausnahmslos"); für diese Tür war er objektiv falsch.
//
// DIE TEURE GESTALT — und sie steht auf dem Weg, den ein neuer Nutzer als ERSTEN geht: frische
// Eingabe, Entwurf wird angelegt, Promote gelingt serverseitig, die ANTWORT geht verloren. Der
// Browser kannte die erzeugte Entwurfskennung nirgends ausserhalb dieses Helfers. Der nächste
// Klick legte einen NEUEN Entwurf an und promotete ihn — ZWEI Wissensobjekte für EINE Eingabe.
// Das ist kein Anzeigefehler, sondern eine stille Dublette im Bestand.
//
// DIE ZWEITE GESTALT: ein fortgesetzter Entwurf. Das Promote gelingt und LÖSCHT den Entwurf; der
// Wiederholversuch lief zuerst in `updateDraft` und endete mit 404, bevor irgendein Nachschlag
// erreicht war — derselbe Mangel, den mega21 Block B für den Dokumentweg und mega22 Block H für
// den Erfassen-Promote geschlossen haben, zwei Türen weiter.
//
// ZWEI EIGENSCHAFTEN SCHLIESSEN BEIDE, und beide sind DIESELBE Bauart wie im Erfassen-Weg — kein
// zweiter Mechanismus:
//
//   1. DER SCHLÜSSEL LEBT IN EINER REF DER SEITE, nicht in der Mutationsfunktion, und er entsteht
//      VOR dem ersten Aufruf. Wann er bleibt und wann er fällt, steht ausgeschrieben in
//      lib/createOperation.ts — hier gelten dieselben Regeln, ohne eigene Auslegung.
//
//   2. DER ENTWURF DIESES VORGANGS WIRD FESTGEHALTEN (`draftRef`). Ohne ihn wäre der Schlüssel
//      wertlos: der Serverabdruck bindet den Vorgang an die ENTWURFSKENNUNG
//      (capture-routes.ts, `createOperationFingerprint({draftId, …})`). Ein Wiederholversuch, der
//      einen ZWEITEN Entwurf anlegte, trüge einen anderen Abdruck und wäre für den Server ein
//      anderer Vorgang — der Nachschlag liefe ins Leere und die Dublette entstünde trotzdem.
//
// UND DIE REIHENFOLGE: KEIN `updateDraft` MEHR VOR DEM PROMOTE. Der Stand reist als `draftPayload`
// IM Promote-Request, also HINTER dem serverseitigen Nachschlag. Ein Wiederholversuch fasst damit
// keinen Entwurf mehr an, den der eigene erste Lauf gerade gelöscht hat.

/** Der Vorgang EINES Einreichens der Vordertür — er überlebt jede Wiederholung. */
export interface FrontDoorSubmitOperation {
  /** Der Wiederholschlüssel. Entsteht VOR dem ersten Aufruf (s. `newCreateOperationId`). */
  id: string;
  /**
   * Der Entwurf DIESES Vorgangs. Wird ein Entwurf frisch angelegt, steht er danach hier — damit
   * die Wiederholung DENSELBEN adressiert und nicht einen zweiten anlegt. Eine Ref und kein
   * Rückgabewert, weil der Vorgang genau dann weiterlebt, wenn der Aufruf NICHT zurückkam.
   */
  draftRef: { current: string | null };
}

export interface FrontDoorSubmitClient<TDraft extends FrontDoorDraftRef, TKo> {
  createDraft: (payload: DraftPayload) => Promise<TDraft>;
  /** Derselbe Vertrag wie im Erfassen-Weg: Schlüssel und Stand reisen MIT dem Promote. */
  promoteDraft: (
    id: string,
    vorgang: { operationId: string; draftPayload: DraftPayload; expectedUpdatedAt?: string },
  ) => Promise<TKo>;
}

export async function submitFrontDoorDraft<TDraft extends FrontDoorDraftRef, TKo>(
  input: {
    title: string;
    bodyHtml: string;
    activeDraftId?: string | null;
    fallbackTitle?: string;
    confidentiality?: Confidentiality;
    // JOB 2684 D1: der beim Laden gesehene Stand eines FORTGESETZTEN Entwurfs — ein frisch
    // angelegter hat keinen (er kann noch niemandem in einem zweiten Tab begegnet sein).
    expectedUpdatedAt?: string | null;
  },
  client: FrontDoorSubmitClient<TDraft, TKo>,
  operation: FrontDoorSubmitOperation,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<TKo> {
  // AUFTRAG-mega7 Block A: `input` trägt die activeDraftId bereits — der Payload weiß damit selbst,
  // ob er ein Update (Löschmarker für einen geleerten Body) oder ein Neuanlegen ist.
  //
  // AUFTRAG-mega23 Block A: der Payload wird AUS DEM UNVERÄNDERTEN `input` gebaut und NICHT aus dem
  // inzwischen gemerkten Entwurf. Das ist keine Feinheit: der Serverabdruck enthält diesen Payload.
  // Würde die Wiederholung ihn wegen des gemerkten Entwurfs anders bauen (Löschmarker), wäre der
  // Abdruck ein anderer — und der Server antwortete IDEMPOTENCY_PAYLOAD_MISMATCH auf eine
  // Wiederholung, die inhaltlich dieselbe ist.
  //
  // JOB 2695 (Review-Befund R2-19): `vollstaendig: true` — und ohne dieses eine Wort wäre dieser
  // Weg kaputt. Der Payload-Bauer schrumpft über einem bestehenden Entwurf auf die Felder, die die
  // Vordertür selbst führt (der Fix gegen den stillen Datenverlust). Dieser Rumpf geht aber als
  // `draftPayload` weiter ins Promote, und ein Wissensobjekt ohne `type`/`category` wird dort mit
  // `400 INCOMPLETE` abgewiesen. Gemessen in D3 an
  // `tests/capture/job2656-d4-einreichen-knopf-mounted.test.tsx`; hier zusätzlich am Vertrag
  // gepinnt (F5 in `tests/capture/job2695-vordertuer-loescht-nicht.test.tsx`).
  const payload = buildFrontDoorPayload({ ...input, vollstaendig: true });
  // Der Entwurf dieses Vorgangs: der bereits angelegte (Wiederholung), der fortgesetzte, oder ein
  // frisch anzulegender.
  let draftId = operation.draftRef.current ?? input.activeDraftId ?? null;
  if (!draftId) {
    const draft = await withFrontDoorSaveTimeout(client.createDraft(payload), timeoutMs);
    draftId = draft.id;
    operation.draftRef.current = draft.id;
  }
  // JOB 2684 D1: der Stand reist nur mit, wenn er zu DIESEM Entwurf gehört — bei einem soeben
  // angelegten Entwurf gibt es keinen gesehenen Stand, also auch keinen Vergleich.
  const expectedUpdatedAt =
    input.activeDraftId && draftId === input.activeDraftId && input.expectedUpdatedAt
      ? input.expectedUpdatedAt
      : undefined;
  return client.promoteDraft(draftId, {
    operationId: operation.id,
    draftPayload: payload,
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });
}
