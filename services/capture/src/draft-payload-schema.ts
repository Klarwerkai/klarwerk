// AUFTRAG-mega22 Block D — DAS REQUEST-SCHEMA DER ENTWURFSLADUNG.
//
// ============================================================================================
// DER BEFUND, DER DIESE DATEI ERZWUNGEN HAT (bens SB-E)
// ============================================================================================
//
// `applyAndLoad` (services/app/src/build-app.ts) fing JEDE Exception aus `continueDraft` und gab
// ihre `error.message` als `invalid` zurück; die Route machte daraus 400. Zwei getrennte Schäden
// aus einer Zeile:
//
//   · EINE STÖRUNG WURDE ZUM NUTZERFEHLER. Ein Repository- oder Datenbankfehler beim Schreiben des
//     Entwurfs kam beim Aufrufer als „deine Eingabe ist ungültig" an. Der Client löscht daraufhin
//     seinen Vorgangsschlüssel (4xx gilt als eindeutige Ablehnung, lib/createOperation.ts) — und
//     wirft damit die Wiederholbarkeit genau in dem Moment weg, in dem sie gebraucht würde.
//   · EINE ROHMELDUNG GING NACH AUSSEN. Bei `draftPayload: null` lief `mergeDraftPayload` in
//     `Object.entries(null)` und der TypeError-Text („Cannot convert undefined or null to object")
//     landete als 400-Meldung beim Client. Der zentrale Fehlerpfad redigiert genau so etwas; dieser
//     Weg lief an ihm vorbei.
//
// ============================================================================================
// WARUM EIN SCHEMA UND NICHT EIN BESSERER `catch`
// ============================================================================================
//
// Ein `catch`, der Fehlerklassen sortiert, ist eine Diagnose NACH dem Schaden. Ein Formfehler soll
// gar nicht erst in die Tiefe laufen: er ist am RAND entscheidbar, weil er nur die GESTALT des
// Bodys betrifft und keinen Bestand kennt. Was hier abgewiesen wird, kann `continueDraft` danach
// nicht mehr werfen — und was `continueDraft` danach doch wirft, ist deshalb eine Störung und wird
// als solche behandelt (erneut geworfen, zentraler redigierter Pfad), nicht als 400.
//
// DIE ABGRENZUNG, die diese Datei NICHT überschreitet: sie prüft GESTALT, nicht INHALT. Längen,
// Mengen, URL-Allowlist und Sanitizing bleiben, wo sie sind — an der Persistenzgrenze
// (normalizeDraftPayload/sanitizeDraftPayload). Eine zweite Auffassung davon, was ein zu langes
// Label ist, wäre genau der Doppelvertrag, den dieses Projekt sonst überall zusammenführt. Das
// Schema beantwortet nur die eine Frage, an der `continueDraft` sonst hart scheitert:
// IST DAS ÜBERHAUPT EINE LADUNG, und tragen ihre Felder Typen, mit denen weitergerechnet werden kann?

import { CONFIDENTIALITY_LEVELS, isValidConfidentiality } from "../../knowledge-object";
import type { DraftPayload } from "./types";

export type DraftPayloadShapeResult =
  | { ok: true; payload: DraftPayload }
  | { ok: false; message: string };

/** Die Felder, deren FALSCHER Typ in der Tiefe rechnet statt normalisiert zu werden. */
const TEXTFELDER = ["title", "statement", "type", "category", "origin"] as const;
const LISTENFELDER = ["tags", "conditions", "measures", "reviewerIds"] as const;

function istEinfachesObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/**
 * AUFTRAG-mega22 Block D — die Gestaltprüfung einer Entwurfsladung, am Rand.
 *
 * Sie WIRFT NICHT. Der Aufrufer bekommt eine Entscheidung und eine Meldung, die einem Menschen
 * sagt, was an seinem Body nicht stimmt — und die deshalb auch nach aussen darf.
 */
export function validateDraftPayloadShape(wert: unknown): DraftPayloadShapeResult {
  // Der Fall, der bisher als TypeError-Rohtext nach aussen ging.
  if (wert === null) {
    return { ok: false, message: "draftPayload darf nicht null sein — erwartet wird ein Objekt." };
  }
  if (wert === undefined) {
    return { ok: false, message: "draftPayload fehlt — erwartet wird ein Objekt." };
  }
  if (!istEinfachesObjekt(wert)) {
    return {
      ok: false,
      message: "draftPayload muss ein Objekt sein (keine Liste, kein Text, keine Zahl).",
    };
  }
  for (const feld of TEXTFELDER) {
    const v = wert[feld];
    if (v !== undefined && typeof v !== "string") {
      return { ok: false, message: `draftPayload.${feld} muss Text sein.` };
    }
  }
  for (const feld of LISTENFELDER) {
    const v = wert[feld];
    if (v !== undefined && !Array.isArray(v)) {
      return { ok: false, message: `draftPayload.${feld} muss eine Liste sein.` };
    }
  }
  // `bodyHtml` und `asset` tragen BEWUSST `null` als gültigen Wert — das ist die ausdrückliche
  // Leerung aus dem Merge-Vertrag (mergeDraftPayload) und kein Formfehler. Genau diesen
  // Unterschied bildet seit mega22 auch der Inhaltsabdruck ab (K8, document-create.ts).
  for (const feld of ["bodyHtml", "asset"] as const) {
    const v = wert[feld];
    if (v !== undefined && v !== null && typeof v !== "string") {
      return { ok: false, message: `draftPayload.${feld} muss Text oder null sein.` };
    }
  }
  // JOB 3082 (Q3 a) — DIE STUFE IST AM ENTWURF OPTIONAL UND IM WERT GEBUNDEN.
  //
  // OPTIONAL, weil SICHERN frei bleibt: ein halber Gedanke muss sich wegspeichern lassen, und die
  // Pflicht greift am EINREICHEN (`toKoInput`), nicht am Zwischenstand. Ein hier erzwungenes Feld
  // machte aus jedem Entwurf ohne Stufe einen Formfehler — und die Oberfläche müsste die Wahl vor
  // dem ersten Speichern verlangen.
  //
  // IM WERT GEBUNDEN, weil ein beliebiger String KEINE Einstufung ist. Er käme sonst bis in den
  // geteilten Pool und stünde dort als Stufe, die es nicht gibt; beim Einreichen bräche der Weg
  // dann weit hinten ab. Dieselbe Grenze, die `normalizeOriginIn` für die Herkunft zieht — nur
  // dass ein Formfehler hier am RAND entschieden wird und eine Meldung bekommt, die einem
  // Menschen sagt, was an seinem Body nicht stimmt.
  // Die Liste der Stufen wird NICHT abgeschrieben, sondern ist die des Moduls knowledge-object
  // (`CONFIDENTIALITY_LEVELS`) — eine zweite Auffassung davon, welche Stufen es gibt, wäre genau
  // der Doppelvertrag, den diese Datei sonst vermeidet.
  const stufe = wert.confidentiality;
  if (stufe !== undefined && !isValidConfidentiality(stufe)) {
    return {
      ok: false,
      message: `draftPayload.confidentiality muss eine der Stufen ${CONFIDENTIALITY_LEVELS.join(", ")} sein.`,
    };
  }
  // `neededValidations` rechnet in validateMetadata weiter (Vergleich gegen 1..5). Ein Text käme
  // dort durch die Vergleiche, ohne je eine Zahl gewesen zu sein.
  const needed = wert.neededValidations;
  if (needed !== undefined && (typeof needed !== "number" || !Number.isFinite(needed))) {
    return { ok: false, message: "draftPayload.neededValidations muss eine endliche Zahl sein." };
  }
  // Die verschachtelten Strukturen werden an der Persistenzgrenze typ-tolerant normalisiert
  // (falscher Container ⇒ Feld fällt weg) und können dort nicht werfen. Hier wird deshalb NUR
  // geprüft, was `mergeDraftPayload` selbst anfassen würde.
  return { ok: true, payload: wert as DraftPayload };
}
