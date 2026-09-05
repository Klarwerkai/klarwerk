// ================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE. Knoten sind SCHLAGWORTE, nicht Objekte.
// ================================================================================================
//
// DIE ABNAHME, woertlich: „Auf der bestehenden Klara-Oberflaeche erscheint eine Themenkarte mit
// hoechstens 40 Themen. Knotengroesse entspricht der Menge zugeordneten Wissens. Die Farbe zeigt
// den vorhandenen Freigabe- und Quellenstatus. Eine Kante erscheint nur, wenn zwei Themen in
// demselben freigegebenen Wissensobjekt vorkommen."
//
// WARUM SCHLAGWORTE UND NICHT `category`. Die Kante verlangt, dass ZWEI Themen im SELBEN Objekt
// vorkommen. `category` ist EIN Wert je Objekt (`lesemodell-ports.ts:49`) — zwei Kategorien
// koennen sich in einem Objekt nie begegnen, es gaebe also nie eine Kante. `tags` ist eine Liste;
// nur damit ist die Abnahmebedingung ueberhaupt erfuellbar. Das ist keine neue Ontologie (§3):
// beide Felder existieren, dieses hier ist das passende.
//
// ================================================================================================
// DIE REIHENFOLGE IST BINDEND (Codex' Auflagen, §5b des Auftrags) — und sie steht hier als Code:
// ================================================================================================
//
//   1. RECHTE ZUERST      Diese Datei bekommt ausschliesslich BEREITS GETRIMMTE Objekte. Sie
//                         trifft keine Sichtbarkeitsentscheidung und kann keine treffen — das
//                         Praedikat kommt aus der Naht (`policy-naht.ts`), angewandt in
//                         `lesemodell.ts` vor dem ersten Zaehler.
//   2. GROESSE            `objekte` je Thema zaehlt NUR sichtbare Traeger. Ein Thema, das
//                         ausschliesslich unsichtbare Objekte traegt, existiert hier nicht —
//                         sein blosser Name waere die Auskunft, dass es dazu etwas gibt
//                         (dieselbe Begruendung wie `lesemodell.ts:51-54`).
//   3. UBIQUITAET         Ein Schlagwort ueber `UBIQUITY_MAX_SHARE` Anteil bekommt KEINE Kanten.
//                         Es bleibt als Knoten sichtbar — es ist ja ein echtes Thema —, aber es
//                         verbindet nichts. Ohne diese Regel entsteht das Wollknaeuel, das der
//                         Sanierer gemessen hat: 34 Knoten, 325 Kanten.
//   4. ERST DANN KANTEN   Und zwar hoechstens `KANTEN_JE_KNOTEN` je gezeichnetem Knoten.
//
// KEINE GLOBALEN MENGEN AN DEN CLIENT. Diese Datei gibt weder die Gesamtzahl der Objekte noch die
// vollstaendige Schlagwortliste noch eine Traegerzahl ausserhalb der gezeichneten Knoten heraus.
// `weitere` traegt NAMEN, keine Zaehler, und ist selbst gedeckelt.
import type { ThemenkarteKo } from "./lesemodell-ports";
// Die ERGEBNISTYPEN liegen seit JOB 2600 D7 in einer eigenen Datei. Grund und Begruendung stehen
// dort im Kopf: `lesemodell-ports.ts` braucht `Themenkarte`, diese Datei braucht `ThemenkarteKo` —
// zusammen war das ein Zirkelbezug, der das Tor bei `architecture` abgebrochen hat.
import type { Themenfarbe, Themenkante, Themenkarte, Themenknoten } from "./themenkarte-typen";

// Unveraendert weitergereicht, damit kein Aufrufer seinen Importpfad aendern muss.
export type { Themenfarbe, Themenkante, Themenkarte, Themenknoten } from "./themenkarte-typen";

/**
 * Hoechstzahl gezeichneter Knoten. Woertlich aus der Abnahme („hoechstens 40 Themen"); weitere
 * stehen als Namensliste hinter „Alle Themen" (§3 des Auftrags).
 */
export const THEMEN_KNOTEN_DECKEL = 40;

/**
 * Hoechstzahl der Kanten JE GEZEICHNETEM KNOTEN.
 *
 * Codex' Auflage woertlich: „hoechstens 3 Kanten je sichtbarem Knoten — reicht das nicht, erhoehst
 * du die Mindesthaeufigkeit, statt mehr Kanten zu zeigen." Genau so ist es unten gebaut: Wird eine
 * Kante allein wegen dieses Grades verworfen, steigt die Mindesthaeufigkeit um eins und die
 * Auswahl laeuft neu — die Karte wird duenner, nicht dichter.
 */
export const KANTEN_JE_KNOTEN = 3;

/** Hoechstzahl der Namen hinter „Alle Themen". Eine unbegrenzte Liste waere eine globale Menge. */
export const WEITERE_DECKEL = 200;

/**
 * Obergrenze der Mindesthaeufigkeit. Erreicht die Schleife sie, wird nicht weiter verduennt,
 * sondern der Grad hart gekappt — sonst koennte eine dichte Karte die Kanten ganz verlieren.
 */
export const MINDESTHAEUFIGKEIT_MAX = 10;

/**
 * Die Ubiquitaetsschwellen — WORTGLEICH aus mega68
 * (`services/library-analytics/src/service.ts:61-62`). Sie stehen hier als eigene Konstanten und
 * nicht als Import: `.dependency-cruiser.cjs` erlaubt diesem Modul keinen Cross-Modul-Import an
 * `library-analytics/index.ts` vorbei, und der Index fuehrt sie zwar — aber ein Import von dort
 * zoege das ganze Analytics-Modul in die Wissensnetz-Abhaengigkeiten. Der Wert ist derselbe, und
 * `tests/wissensnetz/themenkarte.test.ts` haelt die Gleichheit fest.
 */
export const UBIQUITY_MAX_SHARE = 0.5;
export const UBIQUITY_MIN_COUNT = 5;

/** Der Status, der als Freigabe zaehlt — `KoStatus = "offen" | "validiert"`. */
const FREIGEGEBEN = "validiert";

interface Traeger {
  objekte: number;
  freigegeben: number;
  belegt: number;
}

function leererTraeger(): Traeger {
  return { objekte: 0, freigegeben: 0, belegt: 0 };
}

/**
 * Die Schlagworte eines Objekts, WIE SIE GESPEICHERT SIND — leere weg, dedupliziert,
 * deterministisch sortiert.
 *
 * ================================================================================================
 * JOB 3073 · V6 / JOB 3075 · P12 — DIES IST DIE EINE THEMENACHSE DES HAUSES. Es gibt keine zweite.
 * ================================================================================================
 *
 * BIS JOB 3075 STAND HIER „DES MODULS". Das war zu klein angegeben und damit dieselbe Art Fehler,
 * gegen die dieser Kommentar steht: eine Stelle, die ihren Wert falsch beschriftet. Die Funktion
 * hat seit JOB 3075 einen Aufrufer AUSSERHALB dieses Moduls — `graph()` in
 * `services/library-analytics/src/service.ts`, die Quelle der Graph-Ansicht `/graph`. Sie leitete
 * ihre Themen bis dahin selbst aus `ko.tags` ab und zog deshalb Kanten, deren Beschriftung leer
 * war, wo die Themenkarte gar kein Thema kannte. Herausgereicht wird die Funktion über
 * `services/wissensnetz/index.ts`; warum das die Enge jenes Index nicht aufweicht, steht dort.
 *
 * Bis JOB 3071 gruppierte `lesemodell.ts` seine `themen` nach `ko.category` und diese Datei ihre
 * Knoten nach `ko.tags`. EINE Antwort trug damit ZWEI Namensraeume: an der echten Route gemessen
 * (`tests/wissensnetz-leseweg/namensraum-kette.test.tsx`, N1) sprach die Liste von
 * „Hygienic Design", waehrend das Bild „Dichtungen" und „Ventile" zeichnete — und kein Feld
 * verband die beiden. Auf dem Telefon, wo es die Zeichnung gar nicht gibt, war die Liste damit
 * eine Auskunft ueber etwas anderes als das Bild.
 *
 * SEITHER RUFT `lesemodell.ts` DIESE FUNKTION. Die Kategorie ist keine Themenquelle mehr; sie
 * steht auch nicht mehr im Vertrag (`lesemodell-ports.ts`). Wer die Achse zurueckdreht, macht
 * `tests/wissensnetz-achse/eine-achse.test.ts` (A, B) und die echte Kette (N1) rot.
 *
 * WARUM DIE SCHLAGWORTE UND NICHT DIE KATEGORIE die verbleibende Achse ist, steht im Kopf dieser
 * Datei (`:10-14`) und ist keine Geschmacksfrage: eine Kante verlangt ZWEI Themen im SELBEN
 * Objekt, und eine Kategorie ist EIN Wert je Objekt — auf ihr entstuende nie eine Kante.
 *
 * EXPORTIERT, damit es bei EINER Definition bleibt: ein zweiter Zerleger irgendwo im Baum waere
 * genau der Zustand, den JOB 3073 abgeloest hat.
 *
 * ================================================================================================
 * JOB 3073 · RUNDE 2 — WARUM DER GESPEICHERTE WERT GILT UND NICHT DER GETRIMMTE.
 * ================================================================================================
 *
 * BIS RUNDE 1 stand hier `tag.trim()`. Das war eine ZWEITE Normalisierung, die sonst niemand im
 * Haus anwendet — und damit derselbe Fehlertyp, gegen den dieser ganze Auftrag gebaut ist: eine
 * zweite Wahrheit darueber, was ein Thema IST.
 *
 * GEMESSEN, nicht vermutet (Codex an Runde 1): Ein Objekt mit dem gespeicherten Schlagwort
 * `" Dichtungen "` (Rand-Leerzeichen; die echten Routen nehmen es an und geben es so zurueck)
 * erzeugte hier das Thema `"Dichtungen"`. Der Themenname geht ueber `themenHref`
 * (`apps/web/src/pages/Wissensnetz.tsx`) als `?tag=` in den Bibliotheksfilter, und der vergleicht
 * die Werte AUF ZEICHENGLEICHHEIT gegen `ko.tags` in der Form, in der sie liegen
 * (`apps/web/src/lib/libraryFacets.ts`, `libraryFilterValues`: `tag: ko.tags ?? []`, ohne Trimm).
 * Der getrimmte Name war dort ein UNBEKANNTER Wert — und ein unbekannter Wert wird nicht etwa
 * zu null Treffern, sondern von `pruneFacetSelectionToKnownValues`
 * (`apps/web/src/lib/libraryUrlFilters.ts`) STILL AUS DER AUSWAHL GEWORFEN. Der Filter verschwand
 * damit ganz, und wer auf ein Thema klickte, sah die GANZE Bibliothek und hielt sie fuer die
 * Objekte dieses Themas. Codex' Messung: „Zeile zaehlt 2 · expected 3 to be 2".
 *
 * DIE REGEL, DIE JETZT GILT, in einem Satz: **Ein Thema heisst so, wie sein Schlagwort gespeichert
 * ist.** Damit ist jeder Themenname zwangslaeufig ein Wert, den die Bibliothek kennt — der Sprung
 * trifft nicht zufaellig, sondern von Bauart wegen. Gemessen in
 * `tests/wissensnetz-achse/bibliothekstreffer.test.tsx` (L1, L4, L5) und an der geklickten
 * Oberflaeche in `tests/design/zielbild-wissensnetz.test.ts` (T3).
 *
 * WAS DABEI IN KAUF GENOMMEN IST, ausgesprochen statt verschwiegen: Liegen `"Dichtungen"` und
 * `" Dichtungen "` NEBENEINANDER im Bestand, sind das hier zwei Themen — zwei Knoten, deren
 * Beschriftung im HTML und im SVG gleich aussieht (beide Formate ziehen Randleerraum zusammen).
 * Das ist unschoen, aber es ist genau das, was die Bibliothek in ihrer Facettenschiene ohnehin
 * zeigt: zwei Werte, zwei verschiedene Objektmengen. Der frueher gezogene Trimm liess EINEN Knoten
 * entstehen, dessen Link dann hoechstens eine der beiden Mengen traf oder gar keine.
 *
 * DIE BESSERE HEILUNG LIEGT AUSSERHALB DIESES AUFTRAGS und ist in der Rueckgabe benannt: Schlagworte
 * gehoerten beim SCHREIBEN normalisiert (`services/knowledge-object/**`), oder die Bibliothek
 * trimmte ihre Facettenwerte (`apps/web/src/lib/libraryFacets.ts`). Beide Pfade sind fuer JOB 3073
 * nicht freigegeben; hier wird deshalb die Normalisierung ENTFERNT und nicht eine zweite gebaut.
 *
 * WAS BLEIBT: Ein Schlagwort ohne jedes sichtbare Zeichen (`""`, `"   "`) ist kein Thema — es
 * haette keinen Namen, den man zeigen oder anklicken koennte. Es faellt weg, wie bisher.
 */
export function themenVon(ko: ThemenkarteKo): string[] {
  const roh = ko.tags ?? [];
  const gesehen = new Set<string>();
  for (const tag of roh) {
    // Geprueft wird auf dem getrimmten Wert („hat dieses Schlagwort ueberhaupt einen Namen?"),
    // GEZAEHLT wird der gespeicherte. Die beiden Rollen auseinanderzuhalten ist der Kern der
    // Korrektur: die Pruefung darf normalisieren, die IDENTITAET nicht.
    if (typeof tag !== "string" || tag.trim() === "") {
      continue;
    }
    gesehen.add(tag);
  }
  return [...gesehen].sort((a, b) => a.localeCompare(b));
}

function istFreigegeben(ko: ThemenkarteKo): boolean {
  return (ko.status ?? "").trim() === FREIGEGEBEN;
}

function hatQuelle(ko: ThemenkarteKo): boolean {
  return (ko.sources ?? []).length > 0;
}

function farbeVon(t: Traeger): Themenfarbe {
  if (t.belegt > 0) {
    return "belegt";
  }
  return t.freigegeben > 0 ? "freigegeben" : "offen";
}

/** Stabiler Schluessel eines ungeordneten Paares. */
function paarSchluessel(a: string, b: string): string {
  return a < b ? `${a} ${b}` : `${b} ${a}`;
}

/**
 * Baut die Themenkarte aus BEREITS SICHTBAREN Objekten.
 *
 * @param sichtbare die getrimmte Grundmenge — diese Funktion trimmt nicht und darf es nicht.
 */
export function themenkarte(sichtbare: readonly ThemenkarteKo[]): Themenkarte {
  // ── 2. GROESSE UND FARBE, nur aus sichtbarem Bestand ──────────────────────────────────────
  const traeger = new Map<string, Traeger>();
  for (const ko of sichtbare) {
    const frei = istFreigegeben(ko);
    // ┌─ OFFENE OWNERFRAGE AUS JOB 2600 D1 — NICHT VON DER BAHN ENTSCHIEDEN ────────────────────┐
    // │ Zaehlt „belegt" auch an UNFREIGEGEBENEN Objekten?                                       │
    // │                                                                                         │
    // │ Heute: NEIN. Das `frei &&` verlangt die Freigabe, bevor eine Quelle als Beleg zaehlt.   │
    // │ Ein unfreigegebenes Objekt mit zwei Quellen faerbt sein Thema also `offen`, nicht       │
    // │ `belegt`. Das ist die vorsichtige Lesart: Die Farbe sagt „hier steht geprueftes,        │
    // │ belegtes Wissen", und ein Entwurf ist nicht geprueft.                                   │
    // │                                                                                         │
    // │ Die Entscheidung liegt beim Chef, nicht bei dieser Bahn (Auftrag §5). Faellt sie        │
    // │ anders aus, ist DIESE Zeile die einzige Stelle, die sich aendert — und die Faelle       │
    // │ `M1` (`tests/app/themenkarte-mischbestand-mounted.test.tsx`) sowie `B2`/`B2a`           │
    // │ (`tests/wissensnetz/themenkarte.test.ts`) sind die Waechter, die dann anschlagen.       │
    // └─────────────────────────────────────────────────────────────────────────────────────────┘
    const quelle = frei && hatQuelle(ko);
    for (const thema of themenVon(ko)) {
      let t = traeger.get(thema);
      if (t === undefined) {
        t = leererTraeger();
        traeger.set(thema, t);
      }
      t.objekte++;
      if (frei) {
        t.freigegeben++;
      }
      if (quelle) {
        t.belegt++;
      }
    }
  }

  // ── 3. UBIQUITAET, gemessen am SICHTBAREN Bestand ─────────────────────────────────────────
  // Der Nenner ist die sichtbare Grundmenge — nicht der Gesamtbestand. Genau diese Entscheidung
  // trifft mega71 fuer die Nachbarschaft (`service.ts:1527-1534`): rechnete der Anteil gegen
  // verborgene Objekte, koennte ein vertraulicher Traeger ein Schlagwort ueber die Schwelle
  // heben, damit eine SICHTBARE Kante entfernen und so unsichtbaren Bestand erkennbar machen.
  const nenner = Math.max(sichtbare.length, 1);
  const ubiquitaer = new Set<string>();
  for (const [thema, t] of traeger) {
    if (t.objekte >= UBIQUITY_MIN_COUNT && t.objekte / nenner > UBIQUITY_MAX_SHARE) {
      ubiquitaer.add(thema);
    }
  }

  // ── 1./2. DIE GEZEICHNETEN KNOTEN ─────────────────────────────────────────────────────────
  const sortiert = [...traeger.entries()].sort(
    (a, b) => b[1].objekte - a[1].objekte || a[0].localeCompare(b[0]),
  );
  const gezeichnet = sortiert.slice(0, THEMEN_KNOTEN_DECKEL);
  const themen: Themenknoten[] = gezeichnet.map(([thema, t]) => ({
    thema,
    objekte: t.objekte,
    farbe: farbeVon(t),
    ohneKanten: ubiquitaer.has(thema),
  }));
  const restliche = sortiert.slice(THEMEN_KNOTEN_DECKEL).map(([thema]) => thema);

  // ── 4. ERST DANN KANTEN ───────────────────────────────────────────────────────────────────
  // Nur FREIGEGEBENE Objekte stiften Kanten (Abnahme: „in demselben freigegebenen
  // Wissensobjekt"), nur zwischen GEZEICHNETEN Knoten, und nie ueber ein ubiquitaeres Thema.
  //
  // `find` → `filter`: Der alte Graph nahm je Objektpaar NUR das erste geteilte Schlagwort
  // (`library-analytics/src/service.ts:1608`, `a.tags.find(...)`). Hier zaehlt jedes gemeinsame
  // Vorkommen — die Kante traegt deshalb ein Gewicht und keine Behauptung.
  const zeichenbar = new Set(themen.filter((k) => !k.ohneKanten).map((k) => k.thema));
  const gewichte = new Map<string, { a: string; b: string; gewicht: number }>();
  for (const ko of sichtbare) {
    if (!istFreigegeben(ko)) {
      continue;
    }
    const eigene = themenVon(ko).filter((thema) => zeichenbar.has(thema));
    for (let i = 0; i < eigene.length; i += 1) {
      for (let j = i + 1; j < eigene.length; j += 1) {
        const a = eigene[i];
        const b = eigene[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        const schluessel = paarSchluessel(a, b);
        const vorhanden = gewichte.get(schluessel);
        if (vorhanden === undefined) {
          gewichte.set(schluessel, { a: a < b ? a : b, b: a < b ? b : a, gewicht: 1 });
        } else {
          vorhanden.gewicht++;
        }
      }
    }
  }

  // ── 4b. WAS DIE UBIQUITAET VERHINDERT HAT ─────────────────────────────────────────────────
  // Dieselbe Schleife wie oben, nur OHNE den `zeichenbar`-Filter: hier interessiert gerade das
  // Paar, das der Filter eben verworfen hat. Gezaehlt werden Paare, nicht Objekte — zwei Objekte
  // mit demselben Themenpaar sind EIN unterdrueckter Zusammenhang, und die Legende sagt „zwei
  // Themen", nicht „zwei Objekte".
  const gezeichnetSet = new Set(themen.map((k) => k.thema));
  const unterdrueckt = new Set<string>();
  for (const ko of sichtbare) {
    if (!istFreigegeben(ko)) {
      continue;
    }
    const eigene = themenVon(ko).filter((thema) => gezeichnetSet.has(thema));
    for (let i = 0; i < eigene.length; i += 1) {
      for (let j = i + 1; j < eigene.length; j += 1) {
        const a = eigene[i];
        const b = eigene[j];
        if (a === undefined || b === undefined) {
          continue;
        }
        if (ubiquitaer.has(a) || ubiquitaer.has(b)) {
          unterdrueckt.add(paarSchluessel(a, b));
        }
      }
    }
  }

  const alle = [...gewichte.values()].sort(
    (x, y) => y.gewicht - x.gewicht || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
  );

  // Die Auswahl bei einer gegebenen Mindesthaeufigkeit. `verworfenWegenGrad` sagt, ob eine Kante
  // ALLEIN am Grad gescheitert ist — nur dann wird verduennt.
  function auswahl(schwelle: number): { kanten: Themenkante[]; verworfenWegenGrad: boolean } {
    const grad = new Map<string, number>();
    const kanten: Themenkante[] = [];
    let verworfenWegenGrad = false;
    for (const kante of alle) {
      if (kante.gewicht < schwelle) {
        continue;
      }
      const gradA = grad.get(kante.a) ?? 0;
      const gradB = grad.get(kante.b) ?? 0;
      if (gradA >= KANTEN_JE_KNOTEN || gradB >= KANTEN_JE_KNOTEN) {
        verworfenWegenGrad = true;
        continue;
      }
      grad.set(kante.a, gradA + 1);
      grad.set(kante.b, gradB + 1);
      kanten.push({ a: kante.a, b: kante.b, gewicht: kante.gewicht });
    }
    return { kanten, verworfenWegenGrad };
  }

  let mindesthaeufigkeit = 1;
  let ergebnis = auswahl(mindesthaeufigkeit);
  while (ergebnis.verworfenWegenGrad && mindesthaeufigkeit < MINDESTHAEUFIGKEIT_MAX) {
    const naechste = mindesthaeufigkeit + 1;
    const versuch = auswahl(naechste);
    // Verduennen lohnt nur, solange dabei ueberhaupt Kanten uebrig bleiben. Eine leere Karte
    // waere keine strengere Aussage, sondern gar keine.
    if (versuch.kanten.length === 0) {
      break;
    }
    mindesthaeufigkeit = naechste;
    ergebnis = versuch;
  }

  return {
    themen,
    kanten: ergebnis.kanten,
    unterdruecktDurchUbiquitaet: unterdrueckt.size,
    weitere: restliche.slice(0, WEITERE_DECKEL),
    weitereAbgeschnitten: restliche.length > WEITERE_DECKEL,
    mindesthaeufigkeit,
  };
}
