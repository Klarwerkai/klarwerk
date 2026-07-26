// ==============================================================================================
// AUFTRAG-mega20 Block C — DIE MODULÜBERGREIFENDE REFERENZPRÜFUNG.
// ==============================================================================================
//
// WARUM SIE HIER LIEGT UND NICHT IM OBJECT-STORE. Der Object-Store weiß, WAS er gespeichert hat.
// Er weiß und darf nicht wissen, WER es benutzt: Entwürfe gehören capture, Wissensobjekte und ihre
// Versionen und Belege gehören knowledge-object. Eine Prüfung im Store müsste über beide
// Modulgrenzen greifen und würde die Abhängigkeitsrichtung umdrehen (dependency-cruiser lässt das
// zu Recht nicht durch). `services/app` ist die Composition-Root — der einzige Ort, der alle
// Module gleichzeitig kennen DARF. Deshalb steht sie hier. (Der Entwurfsbefund aus mega19; ben hat
// ihn bestätigt.)
//
// WAS SIE BEANTWORTET. Genau eine Frage: „Hängt an diesem Objekt noch irgendetwas?" Sie ENTSCHEIDET
// NICHTS. Sie löscht nichts, sie markiert nichts, sie läuft von selbst nicht los. Der Waisen-Sweep
// ist ausdrücklich nicht Teil dieses Blocks — erst der Datenvertrag, dann getrennt der Lauf.
//
// ============================================================================================
// DIE VIER ORTE, AN DENEN EINE REFERENZ STEHEN KANN — und warum keiner fehlen darf
// ============================================================================================
//
//   1. WISSENSOBJEKTE — `attachments[].objectId`. Der offensichtliche Ort.
//      INKLUSIVE GETRASHTER: ein Objekt im Papierkorb ist wiederherstellbar, seine Anhänge müssen
//      es also auch sein. Ein Lauf, der den Papierkorb übersieht, macht aus „gelöscht" ein
//      „unwiederbringlich".
//
//   2. DER INHALT — `bodyHtml`. Bilder und Dateilinks im Fließtext zeigen als
//      `/api/objects/<id>/raw` auf den Store, OHNE dass ein `attachments`-Eintrag existieren muss
//      (RichTextEditor/bodyFileLink erzeugen genau solche Links). Wer nur `attachments` prüft,
//      hält jedes eingebettete Bild für eine Waise — das wäre der teuerste Einzelfehler dieser
//      Datei, weil er sichtbaren Inhalt zerstört.
//
//   3. VERSIONS-SNAPSHOTS — jeder Snapshot trägt einen VOLLSTÄNDIGEN früheren Stand, also eigene
//      `attachments` und ein eigenes `bodyHtml`. Ein Anhang, der in der aktuellen Fassung entfernt
//      wurde, ist in einer alten Fassung weiterhin sichtbar; ohne diese Quelle würde die
//      Versionshistorie stillschweigend Löcher bekommen.
//
//   4. EVIDENCE-RECORDS — `objectId`. Die Belegkette ist append-only und überlebt Änderungen am
//      Objekt absichtlich. Sie ist damit die letzte Instanz, die ein Original schützt, auch wenn
//      alle anderen Spuren verschwunden sind.
//
//   5. ENTWÜRFE — `bodyHtml` und (ab Block D) die persistierten Belegstellen-Referenzen. Ein
//      Entwurf ist unfertige Nutzerarbeit; sie zu beschädigen ist derselbe Verlust wie bei einem
//      Wissensobjekt, nur schlechter zu bemerken.
//
// ============================================================================================
// DIE RICHTUNG DES ZWEIFELS
// ============================================================================================
//
// Diese Datei irrt in EINE Richtung: sie hält lieber etwas für referenziert, was es nicht ist, als
// umgekehrt. Der Id-Scan im HTML sucht deshalb nach der Objekt-Id ALS ZEICHENKETTE im Rohtext und
// nicht nach einem exakt geformten Link — ein Link mit anderer Schreibweise, ein Rest aus einem
// alten Editor oder eine Id in einem Attribut zählt dann eben mit. Das kostet höchstens Platz.
// Die andere Richtung kostet ein Original.

import type { Draft } from "../../capture";
import type { EvidenceRecord, KnowledgeObject, KoVersionSnapshot } from "../../knowledge-object";

/**
 * Woher eine Referenz stammt. Für den Aufrufer die eigentliche Nutzinformation: „referenziert"
 * allein sagt nicht, ob man einem Fund trauen soll — „referenziert von Snapshot v3 des Objekts
 * X" schon.
 */
export type ObjectReferenceKind =
  | "ko-attachment"
  | "ko-body"
  | "ko-version"
  | "ko-evidence"
  | "draft-body"
  | "draft-source"
  // AUFTRAG-mega21 Block E: das gesicherte ORIGINAL eines Entwurfs (`payload.anchorDocuments[]`).
  // Eigene Art und nicht unter „draft-source" mitgezählt: ein Ankerdokument DARF ohne parallelen
  // `pendingSources`-Eintrag im Entwurf stehen (capture/src/service.ts) — wer beide zusammenwirft,
  // sieht genau diesen Fall nicht mehr.
  | "draft-anchor";

export interface ObjectReference {
  kind: ObjectReferenceKind;
  /** Die Kennung des referenzierenden Trägers (KO-Id bzw. Entwurfs-Id). */
  holderId: string;
}

/**
 * Die Quellen, die die Prüfung befragt. BEWUSST als Funktionen injiziert und nicht als Module
 * importiert: so kann der Aufrufer entscheiden, ob er den vollen Bestand oder einen Ausschnitt
 * liefert, und die Prüfung bleibt ohne eigene Persistenzkenntnis testbar.
 *
 * `kos` MUSS getrashte Objekte einschliessen — s. oben, Punkt 1. Der Aufrufer, der hier die
 * gefilterte Liste übergibt, baut sich lautlos einen Datenverlust.
 */
export interface ObjectReferenceSources {
  kos: () => Promise<readonly KnowledgeObject[]>;
  drafts: () => Promise<readonly Draft[]>;
  versions: (koId: string) => Promise<readonly KoVersionSnapshot[]>;
  evidence: (koId: string) => Promise<readonly EvidenceRecord[]>;
}

// Findet die Id als Zeichenkette im HTML. Absichtlich grob (s. „Die Richtung des Zweifels").
function htmlErwaehnt(html: string | null | undefined, objectId: string): boolean {
  return typeof html === "string" && html.includes(objectId);
}

function ausWissensobjekt(ko: KnowledgeObject, objectId: string): ObjectReferenceKind | null {
  if ((ko.attachments ?? []).some((a) => a.objectId === objectId)) {
    return "ko-attachment";
  }
  if (htmlErwaehnt(ko.bodyHtml, objectId)) {
    return "ko-body";
  }
  return null;
}

/**
 * ALLE Referenzen auf ein Objekt — vollständig, nicht beim ersten Treffer abbrechend.
 *
 * Die Vollständigkeit ist der Zweck: wer wissen will, ob ein Objekt entfernt werden DARF, braucht
 * eine Liste, die er lesen kann, keinen Wahrheitswert. Ein einzelner Treffer aus einer Quelle, die
 * man später für unerheblich hält, sieht sonst genauso aus wie zwanzig Treffer aus der Belegkette.
 */
export async function findObjectReferences(
  objectId: string,
  sources: ObjectReferenceSources,
): Promise<ObjectReference[]> {
  const treffer: ObjectReference[] = [];
  const id = objectId.trim();
  if (id.length === 0) {
    return treffer;
  }
  for (const ko of await sources.kos()) {
    const direkt = ausWissensobjekt(ko, id);
    if (direkt) {
      treffer.push({ kind: direkt, holderId: ko.id });
    }
    // Frühere Fassungen: der Anhang kann aus der aktuellen Fassung längst entfernt sein.
    for (const snapshot of await sources.versions(ko.id)) {
      if (ausWissensobjekt(snapshot.snapshot, id)) {
        treffer.push({ kind: "ko-version", holderId: ko.id });
        break; // eine Fassung genügt als Nachweis; die Liste soll lesbar bleiben.
      }
    }
    // Die Belegkette ist append-only und überlebt jede Änderung — die letzte Schutzinstanz.
    if ((await sources.evidence(ko.id)).some((record) => record.objectId === id)) {
      treffer.push({ kind: "ko-evidence", holderId: ko.id });
    }
  }
  for (const draft of await sources.drafts()) {
    if (htmlErwaehnt(draft.payload.bodyHtml, id)) {
      treffer.push({ kind: "draft-body", holderId: draft.id });
    }
    // AUFTRAG-mega20 Block D: der Entwurf trägt die gesicherte Original-Referenz je Belegstelle.
    if ((draft.payload.pendingSources ?? []).some((src) => src.objectId === id)) {
      treffer.push({ kind: "draft-source", holderId: draft.id });
    }
    // AUFTRAG-mega21 Block E: die ANKERDOKUMENTE des Entwurfs. Sie fehlten hier, obwohl die
    // Entwurfs-Ankerprüfung genau diese Kennungen als Referenzen behandelt
    // (`verifyDraftAnchors`, capture/src/service.ts) — und obwohl ein Entwurf ein Ankerdokument
    // OHNE zugehörigen `pendingSources`-Eintrag tragen darf. Es gibt heute keinen Waisen-Sweep,
    // der daraus einen Verlust machen könnte; genau deshalb ist der richtige Zeitpunkt JETZT. Ein
    // Referenzscan, der eine Referenzart nicht kennt, ist eine tickende Falle: er ist erst dann
    // gefährlich, wenn jemand ihm vertraut, und dann ist es zu spät, es zu bemerken.
    if ((draft.payload.anchorDocuments ?? []).some((doc) => doc.objectId === id)) {
      treffer.push({ kind: "draft-anchor", holderId: draft.id });
    }
  }
  return treffer;
}

/**
 * Die kurze Form: hängt überhaupt noch etwas dran?
 *
 * Sie sagt bewusst nichts über die Schutzfrist (`isWithinRetention`) und nichts über den Zweck
 * (`isTransientMedia`). Das sind DREI getrennte Urteile, und ein späterer Lauf muss alle drei
 * einzeln fällen — sie hier zu einem „darf weg" zu verschmelzen, wäre genau die Entscheidung, die
 * dieser Block ausdrücklich nicht trifft.
 */
export async function isObjectReferenced(
  objectId: string,
  sources: ObjectReferenceSources,
): Promise<boolean> {
  return (await findObjectReferences(objectId, sources)).length > 0;
}
