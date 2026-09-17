// ================================================================================================
// AUFTRAG-mega52 BLOCK A3 — DIE ANTWORT SAGT, WORAUF SIE STEHT.
// ================================================================================================
//
// DER BEFUND (Pedi, Word-Handlauf 28.07.; am Code erhoben). Die Antwort wusste nicht, welche Quelle
// sie getragen hat. Es gab nur `sources`, pauschal aus allen bis zu acht Kandidaten gefüllt. Der
// Prompt nummerierte die Quellen und ERLAUBTE Verweise — zurückgelesen wurden die Marken nie.
// mega39 D2 hat diese Lücke bereits benannt und die zweite, nichtssagende Liste ausgeblendet; die
// echte Trennung von ZITIERTEN gegen HERANGEZOGENE Quellen war ausdrücklich vertagt. Hier ist sie.
//
// DIE FORM, und warum diese (A3 überlässt sie mir, verlangt aber die Begründung):
//
//  1. EINE Liste, nicht zwei. Zwei Listen untereinander sind genau der Fehler, den mega39 D2 gerade
//     beseitigt hat — dieselben Einträge zweimal lesen sich als Fülltext, nicht als Nachweis. Die
//     bestehende Quellenliste bleibt also die eine Liste; sie bekommt eine Ordnung und ein
//     Kennzeichen.
//  2. TRAGENDE ZUERST, in der Rangfolge des Rankings. Was die Antwort trägt, steht oben und ist als
//     solches beschriftet. Die übrigen folgen darunter und heißen, was sie sind: angesehen, nicht
//     verwendet. Kein Ausblenden — eine herangezogene Quelle zu verschweigen wäre ein neuer blinder
//     Fleck, und `ask.sourcesHint` verspricht seit jeher die vollständige Liste.
//  3. UNBEKANNT IST EIN EIGENER ZUSTAND, nicht „keine". Liefert das Modell keine oder unbrauchbare
//     Marken (A5), trägt KEINE Quelle ein Kennzeichen und die Oberfläche sagt ausdrücklich, dass die
//     Zuordnung nicht möglich war. Niemals raten, niemals stillschweigend auf alle zurückfallen.
//     Genau deshalb sind `undefined` (alter Server, Feld fehlt) und `[]` (Modell ohne Marken) hier
//     DERSELBE Zustand: `unattributed`. Beide heißen „wir wissen es nicht".
//
// WARUM DOM-FREI UND HIER: dieselbe Bauform wie `askSteps.ts`/`askView.ts` — die Entscheidung ist
// eine reine Funktion über Daten, testbar ohne Mount, und Desktop wie Mobil lesen dieselbe eine
// Quelle statt sich je ein eigenes Urteil zu bilden.

import type { KoSource } from "../api/types";
import { objectRawHref } from "./bodyFileLink";
import { quellennachweis } from "./koSource";

/** Minimal, was eine Quellenzeile zum Sortieren braucht — bewusst strukturell (s. askSteps.ts). */
export interface CitableSourceLike {
  id: string;
}

/**
 * `attributed`   — das Modell hat markiert, und mindestens eine Marke war verwertbar.
 * `unattributed` — keine verwertbare Marke ODER der Server kennt das Feld nicht (A5).
 */
export type CitationState = "attributed" | "unattributed";

export function citationState(citedSources: readonly string[] | undefined): CitationState {
  return citedSources !== undefined && citedSources.length > 0 ? "attributed" : "unattributed";
}

/** Eine Quellenzeile plus die eine Frage, die diesen Auftrag ausgelöst hat. */
export type AttributedSource<T> = T & {
  // true  → diese Quelle trägt die Antwort (ihre Marke stand im Antworttext).
  // false → herangezogen, aber nicht verwendet — ODER die Zuordnung ist unbekannt.
  // Wer „unbekannt" von „nicht verwendet" unterscheiden muss, liest `citationState` dazu; ein
  // drittes Flag je Zeile wäre dieselbe Aussage doppelt und könnte auseinanderlaufen.
  carrying: boolean;
};

/**
 * Ordnet die Quellen: tragende zuerst, danach die übrigen. Innerhalb beider Gruppen bleibt die
 * Eingabereihenfolge (die Rangfolge des Rankings) erhalten — stabil, kein Neusortieren nach
 * Titel oder Trust.
 *
 * Ist die Zuordnung unbekannt (A5), trägt KEINE Quelle das Kennzeichen und die Reihenfolge bleibt
 * unverändert. Das ist der Punkt: ohne Wissen wird nichts umsortiert und nichts behauptet.
 */
export function attributeSources<T extends CitableSourceLike>(
  sources: readonly T[],
  citedSources: readonly string[] | undefined,
): AttributedSource<T>[] {
  if (citationState(citedSources) === "unattributed") {
    return sources.map((s) => ({ ...s, carrying: false }));
  }
  const cited = new Set(citedSources ?? []);
  const marked = sources.map((s) => ({ ...s, carrying: cited.has(s.id) }));
  return [...marked.filter((s) => s.carrying), ...marked.filter((s) => !s.carrying)];
}

/**
 * Darf für DIESE Quelle gedankt werden?
 *
 * mega52 A4: der Answer-Receipt bindet serverseitig nur noch die TRAGENDEN Quellen — ein „Danke"
 * auf eine bloß angesehene Quelle würde dort mit 403 enden. Die Oberfläche bietet ihn deshalb gar
 * nicht erst an, statt den Nutzer in einen Fehler laufen zu lassen. Ist die Zuordnung unbekannt,
 * ist für KEINE Quelle ein Danke möglich — ein Vertrauensplus auf Verdacht ist genau die stille
 * Verfälschung, die dieser Block beseitigt.
 */
export function canThank(source: { carrying: boolean }): boolean {
  return source.carrying;
}

// ================================================================================================
// JOB 4224 · D5 — DER BELEG FÜHRT BIS ZUM ORIGINAL, NICHT NUR BIS ZUM AUSZUG.
// ================================================================================================
//
// DER BEFUND (gemessen am main 598fc2c, Cloud-Lauf dd9ef2e8…): `AnswerSourceDetails` zeigte je
// Antwortquelle Status, Trust, eine Kurzvorschau und einen aufklappbaren Auszug — und dieser
// Auszug kam AUSSCHLIESSLICH aus `ko.bodyHtml`. Ein Weg zur hinterlegten Originaldatei oder zur
// Originaladresse stand an keiner Stelle. Die Teile lagen alle da: der ANKER an der Quelle
// (`KoSource.objectId`, JOB 4077), seine Auflösung gegen die eigene Anhangsliste
// (`quellennachweis`, JOB 4013/4077) und die Adresse der Rohbytes (`objectRawHref`, SCRUM-355).
// Niemand hat sie verbunden.
//
// GENAU DAS — UND NICHTS MEHR — TUT DIESE ABLEITUNG. Sie ist kein zweites Regelwerk:
//   · WELCHE DATEI zu einer Quelle gehört, entscheidet weiter `quellennachweis`. Dessen
//     Ehrlichkeitsregel gilt unverändert („fehlen heisst fehlen" in vier Gestalten: kein Anker,
//     leerer Anker, Anhang nicht in der Liste, Anhang ohne brauchbaren Namen).
//   · OB EINE ADRESSE ein Link werden darf, entscheidet weiter `isSavableSourceUrl` — dieselbe
//     Allowlist, die der Server anlegt. Eine Papierfundstelle und ein `javascript:`-Altwert
//     bleiben SICHTBAR, aber Text.
//   · WIE die Adresse der Rohbytes lautet, entscheidet weiter `objectRawHref`.
// Neu ist allein die VERKNÜPFUNG: aus „diese Quelle nennt die Datei X" wird „unter dieser Adresse
// steht X".
//
// KEIN NEUER EGRESS UND KEINE NEUE ROUTE. `/api/objects/:id/raw` gibt es seit SCRUM-45; sie prüft
// die Sichtbarkeit bei JEDEM Abruf über dieselbe eine Entscheidung wie das Wissensobjekt und
// antwortet für „nicht erlaubt" bytegleich wie für „gibt es nicht" (object-routes.ts, JOB 579 D5).
// Die Fläche verspricht also nichts, was der Server nicht trägt: ein entzogenes Recht schliesst den
// Link beim nächsten Klick, ohne dass hier etwas nachgeführt werden müsste.
//
// WARUM DIE FREIEN DATEIEN MITKOMMEN: ein Eintrag kann sein Original tragen, ohne dass eine Quelle
// darauf zeigt (jeder Anhang von vor JOB 4077, jeder Import ohne Belegstelle). Es zu verschweigen
// wäre genau der blinde Fleck, den dieser Auftrag schliesst — und es zu ERFINDEN wäre schlimmer:
// ein Anhang ohne gültige Objektkennung oder ohne brauchbaren Namen erzeugt hier NICHTS.

/** Die hinterlegte Originaldatei — Kennung, Name und die Adresse, unter der sie ausgeliefert wird. */
export interface Originaldatei {
  objectId: string;
  name: string;
  /** `/api/objects/:id/raw` — die vorhandene Route, über `objectRawHref` gebildet. */
  href: string;
}

/** Eine Quelle des Wissensobjekts samt dem, was von ihr aus erreichbar ist. */
export interface Quellenoriginal {
  quelle: KoSource;
  /** Das hinterlegte Original dieser Quelle — `null`, wenn keines auffindbar ist. */
  datei: Originaldatei | null;
  /** Die Adresse/Referenz der Quelle — `null`, wenn keine angegeben ist. */
  adresse: { voll: string; kurz: string; verlinkbar: boolean } | null;
}

export interface Originalweg {
  /** Je Quelle des Wissensobjekts eine Zeile, in der Reihenfolge des Objekts. */
  quellen: Quellenoriginal[];
  /** Hinterlegte Originale, auf die KEINE Quelle zeigt. */
  freieDateien: Originaldatei[];
  /**
   * Führt von hier aus überhaupt ein Weg zu einem Original? Ist das falsch, sagt die Fläche das
   * ehrlich, statt einen Beleg anzudeuten, den es nicht gibt.
   */
  erreichbar: boolean;
}

/** Die Mindestform — bewusst strukturell, damit auch Projektionen sie stellen können. */
export interface OriginalwegEingabe {
  sources?: readonly KoSource[] | undefined;
  attachments?: readonly { objectId?: string | null; name?: string | null }[] | undefined;
}

/**
 * `sprache` reist nur durch: `quellennachweis` formatiert damit den Zeitpunkt. Diese Ableitung
 * liest von seinem Ergebnis ausschliesslich `datei` und `adresse` — sie rechnet beides NICHT nach.
 */
export function originalweg(ko: OriginalwegEingabe, sprache: string): Originalweg {
  const anhaenge = ko.attachments ?? [];
  const verankert = new Set<string>();
  const quellen: Quellenoriginal[] = [];
  for (const quelle of ko.sources ?? []) {
    const nachweis = quellennachweis(quelle, anhaenge, sprache);
    const anker = (quelle.objectId ?? "").trim();
    const href = objectRawHref(anker);
    // BEIDE Bedingungen zählen: `quellennachweis` hat den Anker in der EIGENEN Anhangsliste
    // wiedergefunden (sonst ist `datei` null), UND die Kennung taugt als Adresse. Ohne die zweite
    // Hälfte entstünde aus einem krummen Anker ein Link, der nirgends hinführt.
    const datei =
      nachweis.datei !== null && href !== null
        ? { objectId: anker, name: nachweis.datei, href }
        : null;
    if (datei) {
      verankert.add(anker);
    }
    quellen.push({ quelle, datei, adresse: nachweis.adresse });
  }
  const freieDateien: Originaldatei[] = [];
  for (const anhang of anhaenge) {
    const objectId = (anhang.objectId ?? "").trim();
    const href = objectRawHref(objectId);
    if (href === null || verankert.has(objectId)) {
      continue;
    }
    const name = (anhang.name ?? "").trim();
    if (name.length === 0) {
      // Dieselbe Regel wie in `quellennachweis`: ein leerer Name ist kein Name. Ein Link ohne
      // Beschriftung wäre eine Tür ohne Schild.
      continue;
    }
    freieDateien.push({ objectId, name, href });
  }
  const erreichbar =
    freieDateien.length > 0 ||
    quellen.some((q) => q.datei !== null || q.adresse?.verlinkbar === true);
  return { quellen, freieDateien, erreichbar };
}
