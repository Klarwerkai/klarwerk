// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE EINE ENTSCHEIDUNG „ORIGINAL ODER ÜBERSETZUNG" UND IHR VORRAT.
// ================================================================================================
//
// DIE REGEL, an EINER Stelle: gezeigt wird die Übersetzung nur, wenn (1) die Oberflächensprache
// eine ANDERE ist als die Originalsprache des Objekts, (2) für genau diese Sprache eine Variante
// vorliegt und (3) der Leser nicht ausdrücklich „Original anzeigen" gewählt hat. Fehlt eines davon,
// steht das Original da — ohne Hinweis, ohne Umschalter, ohne Behauptung.
//
// WARUM EIN EIGENER KLEINER VORRAT UND KEIN REACT-QUERY-CACHE: Die Kurzvorschau (`KoSummaryDisclosure`)
// wird an Stellen gerendert, die keinen `QueryClientProvider` in ihrem Baum haben müssen — ein
// `useQuery` dort WIRFT. Dieser Vorrat ist ein reines Modul-Objekt mit `useSyncExternalStore`
// (dieselbe Bauform wie `shell/Meldungen.tsx`): er braucht keinen Provider, und wenn der Abruf
// scheitert, bleibt er ehrlich leer — dann liest man das Original, und das ist der richtige
// Rückfall. Er lädt LAZY: erst wenn zum ersten Mal jemand nach einer Variante fragt.
//
// WAS ER NICHT TUT: Er übersetzt nichts. Er ruft kein Modell. Er hält nur, was der Server aus der
// lokalen Lieferung kennt.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { KandidatenLesevariante, Lesevariante, LesevarianteKurz } from "../api/types";

// ================================================================================================
// DIE TEXTE DIESER FUNKTION — und WARUM sie hier stehen und nicht in `i18n.ts` (JOB 3326 R4).
// ================================================================================================
//
// GEMESSEN, nicht vermutet: `apps/web/src/i18n.ts` ist auf dem Basisstand 1.043.344 B gross. Biome
// verarbeitet keine Datei ueber `files.maxSize` (1 MiB = 1.048.576 B) und bricht dann mit einem
// Fehler ab. Die 27 Schluessel dieser Funktion kosten in DE + EN + NL zusammen 5.688 B und haben
// die Datei damit auf 1.049.032 B gehoben — 456 B ueber den Deckel. Genau daran war das Tor der
// Runde 3 rot, an nichts sonst.
//
// WARUM NICHT DER DECKEL, sondern die Datei. Der naheliegende Weg — ein `overrides`-Eintrag in
// `biome.json`, der NUR fuer `i18n.ts` ein groesseres `maxSize` erlaubt — ist mit der hier
// installierten Biome-Fassung 1.9.4 nicht baubar; sie kennt in `overrides` kein `files`:
//
//     biome.json:15:7 deserialize  x Found an unknown key `files`.
//     i Known keys: ignore, include, javascript, json, css, graphql, formatter, linter,
//                   organizeImports
//
// Den globalen Deckel anzuheben oder `i18n.ts` auszunehmen waere kein Ausweg, sondern der Verzicht
// auf den Schutz (und ausdruecklich untersagt): eine Woerterbuchdatei, die niemand mehr prueft und
// formatiert, waechst still weiter. Also traegt die Funktion ihre eigenen Texte — `i18n.ts` faellt
// damit auf 1.043.6xx B zurueck, behaelt seinen Vorlauf von rund 5 KB, und JEDE Datei bleibt unter
// demselben 1-MiB-Schutz. `tests/lesevariante/i18n-groessendeckel.test.ts` misst das ab jetzt als
// Test, statt es erst im Tor als Lint-Fehler sichtbar werden zu lassen.
//
// KEIN NEUES MUSTER: Alle uebrigen Schluessel der App bleiben, wo sie sind. Das allgemeine
// Aufteilen des Woerterbuchs ist ein eigener Auftrag; hier traegt nur diese Funktion ihre Last.
//
// DIE DREI SPRACHEN sind ueber `typeof lesevarianteTexteDe` aneinander gebunden — fehlt in EN oder
// NL ein Schluessel, ist das ein Compilerfehler, nicht ein leerer Text auf der Flaeche. Jeder Text
// sagt ausdruecklich, dass es sich um eine UEBERSETZUNG handelt und dass das Original die Wahrheit
// bleibt; es gibt hier bewusst keinen Text, der eine Freigabe der Uebersetzung nahelegt.
export const lesevarianteTexteDe = {
  "lesevariante.badge.uebersetzung": "Übersetzung · Original: {{sprache}}",
  "lesevariante.badge.original": "Original ({{sprache}})",
  "lesevariante.zeigeOriginal": "Original anzeigen",
  "lesevariante.zeigeUebersetzung": "Übersetzung anzeigen",
  "lesevariante.keineFreigabe": "Übersetzung, keine Freigabe",
  "lesevariante.herkunft": "Herkunft: {{herkunft}}",
  "lesevariante.originalGeaendert":
    "Das Original wurde seit dieser Übersetzung geändert — maßgeblich ist das Original.",
  "lesevariante.zuordnungUnbestaetigt":
    "Zuordnung unbestätigt: der gelieferte Quellabdruck lässt sich mit dem gespeicherten Original nicht vergleichen. Die Übersetzung ist deshalb nicht als zu genau diesem Text gehörend belegt.",
  "lesevariante.leseansicht": "Leseansicht",
  "lesevariante.originalUnten": "Unten steht das Original in unveränderter Fassung.",
  "lesevariante.abrufFehler":
    "Die Übersetzung konnte nicht geladen werden. Angezeigt wird das Original.",
  "lesevariante.sprache.de": "Deutsch",
  "lesevariante.sprache.en": "Englisch",
  "lesevariante.sprache.nl": "Niederländisch",
  "lesevariante.laden.title": "Übersetzungen für Paket laden",
  "lesevariante.laden.hint":
    "Hängt die mitgelieferten deutschen Lesefassungen an bereits vorhandene Wissensobjekte (Confluence-Import oder Demopaket). Es entsteht kein neues Wissensobjekt, es wird kein Modell gerufen; zweites Laden aktualisiert.",
  "lesevariante.laden.button": "Übersetzungen laden",
  "lesevariante.laden.busy": "Lädt …",
  "lesevariante.laden.result":
    "{{zugeordnet}} Datensätze · {{objekte}} Objekte · {{neu}} neu · {{aktualisiert}} aktualisiert · {{unbestaetigt}} ohne Quellbeleg",
  "lesevariante.laden.unmatched":
    "{{count}} Datensätze ohne passendes Wissensobjekt (unübersetzt): {{keys}}",
};

/** Spiegel der DE-Schluessel — die Begruendung steht dort. */
export const lesevarianteTexteEn: typeof lesevarianteTexteDe = {
  "lesevariante.badge.uebersetzung": "Translation · original: {{sprache}}",
  "lesevariante.badge.original": "Original ({{sprache}})",
  "lesevariante.zeigeOriginal": "Show original",
  "lesevariante.zeigeUebersetzung": "Show translation",
  "lesevariante.keineFreigabe": "Translation, not an approval",
  "lesevariante.herkunft": "Source: {{herkunft}}",
  "lesevariante.originalGeaendert":
    "The original has changed since this translation — the original prevails.",
  "lesevariante.zuordnungUnbestaetigt":
    "Match unconfirmed: the delivered source digest cannot be compared with the stored original. This translation is therefore not proven to belong to exactly this text.",
  "lesevariante.leseansicht": "Reading view",
  "lesevariante.originalUnten": "The unchanged original is shown below.",
  "lesevariante.abrufFehler": "The translation could not be loaded. The original is shown.",
  "lesevariante.sprache.de": "German",
  "lesevariante.sprache.en": "English",
  "lesevariante.sprache.nl": "Dutch",
  "lesevariante.laden.title": "Load translations for a package",
  "lesevariante.laden.hint":
    "Attaches the delivered German reading versions to knowledge objects that already exist (Confluence import or demo package). No knowledge object is created, no model is called; loading again updates.",
  "lesevariante.laden.button": "Load translations",
  "lesevariante.laden.busy": "Loading …",
  "lesevariante.laden.result":
    "{{zugeordnet}} records · {{objekte}} objects · {{neu}} new · {{aktualisiert}} updated · {{unbestaetigt}} without source proof",
  "lesevariante.laden.unmatched":
    "{{count}} records without a matching knowledge object (untranslated): {{keys}}",
};

/** Spiegel der DE-Schluessel — die Begruendung steht dort. */
export const lesevarianteTexteNl: typeof lesevarianteTexteDe = {
  "lesevariante.badge.uebersetzung": "Vertaling · origineel: {{sprache}}",
  "lesevariante.badge.original": "Origineel ({{sprache}})",
  "lesevariante.zeigeOriginal": "Origineel tonen",
  "lesevariante.zeigeUebersetzung": "Vertaling tonen",
  "lesevariante.keineFreigabe": "Vertaling, geen goedkeuring",
  "lesevariante.herkunft": "Herkomst: {{herkunft}}",
  "lesevariante.originalGeaendert":
    "Het origineel is sinds deze vertaling gewijzigd — het origineel is bepalend.",
  "lesevariante.zuordnungUnbestaetigt":
    "Koppeling onbevestigd: de geleverde bronafdruk is niet te vergelijken met het opgeslagen origineel. Deze vertaling is daarom niet aantoonbaar aan precies deze tekst gekoppeld.",
  "lesevariante.leseansicht": "Leesweergave",
  "lesevariante.originalUnten": "Hieronder staat het ongewijzigde origineel.",
  "lesevariante.abrufFehler": "De vertaling kon niet worden geladen. Het origineel wordt getoond.",
  "lesevariante.sprache.de": "Duits",
  "lesevariante.sprache.en": "Engels",
  "lesevariante.sprache.nl": "Nederlands",
  "lesevariante.laden.title": "Vertalingen voor pakket laden",
  "lesevariante.laden.hint":
    "Koppelt de meegeleverde Duitse leesversies aan reeds bestaande kennisobjecten (Confluence-import of demopakket). Er ontstaat geen nieuw kennisobject en er wordt geen model aangeroepen; opnieuw laden werkt bij.",
  "lesevariante.laden.button": "Vertalingen laden",
  "lesevariante.laden.busy": "Bezig met laden …",
  "lesevariante.laden.result":
    "{{zugeordnet}} records · {{objekte}} objecten · {{neu}} nieuw · {{aktualisiert}} bijgewerkt · {{unbestaetigt}} zonder bronbewijs",
  "lesevariante.laden.unmatched":
    "{{count}} records zonder passend kennisobject (onvertaald): {{keys}}",
};

/**
 * Der Zustand des VORRATS (Listen-Vorschau). Bewusst nicht mehr exportiert: seit JOB 3326 R3 liest
 * ihn nur noch diese Datei — die Leseansicht entscheidet aus ihrem eigenen frischen Abruf.
 */
interface LesevariantenStand {
  /** Die Sprache, für die dieser Stand gilt — `null`, solange nichts geholt wurde. */
  lang: string | null;
  laeuft: boolean;
  geladen: boolean;
  /**
   * Der Abruf ist gescheitert. Der Stand bleibt dann LEER und die Oberfläche zeigt das Original —
   * ausdrücklich kein „keine Übersetzung vorhanden", sondern ein benennbarer Fehlzustand.
   */
  fehler: boolean;
  jeKo: ReadonlyMap<string, LesevarianteKurz>;
}

const LEER: ReadonlyMap<string, LesevarianteKurz> = new Map();

let stand: LesevariantenStand = {
  lang: null,
  laeuft: false,
  geladen: false,
  fehler: false,
  jeKo: LEER,
};

const zuhoerer = new Set<() => void>();

function setze(naechster: LesevariantenStand): void {
  stand = naechster;
  for (const melde of zuhoerer) {
    melde();
  }
}

function abonniere(melde: () => void): () => void {
  zuhoerer.add(melde);
  return () => {
    zuhoerer.delete(melde);
  };
}

function lies(): LesevariantenStand {
  return stand;
}

/**
 * ================================================================================================
 * JOB 3326 R3 (Codex 300d1c3a, Punkt 3) — DIE ANFRAGEGENERATION.
 * ================================================================================================
 *
 * Bis Runde 2 entschied allein `stand.lang`, ob eine eintreffende Antwort schreiben darf. Das
 * reicht nicht, und der Fall ist real: DE(A) → EN → DE(B). Wenn A verspätet ankommt, steht der
 * Vorrat wieder auf „de" — A besteht die Prüfung und überschreibt den frischen Stand B mit
 * Zahlen, die aus dem ersten Klick stammen. Nach der Reihenfolge der Antworten hätte die
 * Oberfläche dann mal den einen, mal den anderen Stand gezeigt.
 *
 * Jede Anfrage bekommt deshalb eine laufende Nummer. Schreiben darf NUR die jeweils letzte; jede
 * frühere Antwort wird verworfen, auch wenn ihre Sprache zufällig wieder stimmt. `verwerfen` zählt
 * ebenfalls hoch — eine Antwort, die zu einem weggeworfenen Vorrat gehört, hat kein Schreibrecht
 * mehr.
 */
let anfrage = 0;

/**
 * Holt die Übersicht für `lang`, falls das für diese Sprache noch nicht geschehen ist. Ein zweiter
 * Aufruf während des Laufs tut nichts (kein Sturm aus jeder gemounteten Vorschau).
 *
 * DER ABRUF STEHT IM `try`, und das ist kein Zierrat: Diese Funktion läuft in einem Effekt der
 * LESEFLÄCHE. Wirft sie SYNCHRON (und nicht als abgelehntes Versprechen), reisst sie die ganze
 * Seite mit — der Leser sähe statt des Originals gar nichts. Die Lesevariante ist aber eine
 * ZUSATZ-Lesart: ihr Ausfall darf das Original nie verdecken. Der Fehlzustand wird deshalb
 * festgehalten (`fehler: true`) und von der Fläche BENANNT, statt die Seite zu beenden.
 */
export function lesevariantenSicherstellen(lang: string): void {
  if (stand.lang === lang && (stand.laeuft || stand.geladen)) {
    return;
  }
  const meine = ++anfrage;
  setze({ lang, laeuft: true, geladen: false, fehler: false, jeKo: LEER });
  let angefragt: Promise<{ eintraege: LesevarianteKurz[] }>;
  try {
    angefragt = endpoints.lesevarianten.uebersicht(lang);
  } catch (fehler) {
    setze({ lang, laeuft: false, geladen: true, fehler: true, jeKo: LEER });
    return;
  }
  void angefragt
    .then((antwort) => {
      // NUR die jeweils letzte Anfrage schreibt. Die Sprache allein genügt nicht (s. oben).
      if (meine !== anfrage) {
        return;
      }
      setze({
        lang,
        laeuft: false,
        geladen: true,
        fehler: false,
        jeKo: new Map(antwort.eintraege.map((e) => [e.koId, e])),
      });
    })
    .catch(() => {
      if (meine !== anfrage) {
        return;
      }
      setze({ lang, laeuft: false, geladen: true, fehler: true, jeKo: LEER });
    });
}

/**
 * Verwirft den Vorrat — nach der Admin-Aktion „Übersetzungen laden". Ohne das zeigte die
 * Oberfläche bis zum nächsten Neuladen weiter „keine Übersetzung", obwohl gerade welche entstanden.
 *
 * Dieselbe Funktion setzt den Vorrat in Tests zwischen zwei Fällen zurück; eine zweite, nur für
 * Tests exportierte Fassung daneben wäre ein Export ohne Aufrufer im Produkt.
 */
export function lesevariantenVerwerfen(): void {
  // Auch laufende Antworten verlieren hier ihr Schreibrecht: sie gehören zu einem Vorrat, den es
  // nicht mehr gibt.
  anfrage += 1;
  setze({ lang: null, laeuft: false, geladen: false, fehler: false, jeKo: LEER });
}

/**
 * DIE REGEL. Eine Variante wird gezeigt, wenn sie in einer ANDEREN Sprache steht als das Original.
 * Fehlt die Variante oder ist die Oberflächensprache die Originalsprache, ist die Antwort
 * `undefined` — und die Fläche zeigt das Original ohne jeden Hinweis.
 */
export function anzuzeigendeVariante<T extends { originalLanguage: string }>(
  variante: T | undefined,
  uiSprache: string,
): T | undefined {
  if (!variante) {
    return undefined;
  }
  return variante.originalLanguage === uiSprache ? undefined : variante;
}

/** Die aktuelle Oberflächensprache, auf den reinen Sprachcode gekürzt („de-DE" → „de"). */
export function sprachcode(sprache: string | undefined): string {
  return (sprache ?? "de").split("-")[0] ?? "de";
}

/**
 * Die Kurzvariante eines Objekts in der aktuellen Oberflächensprache — oder `undefined`, wenn es
 * keine gibt, die Sprache die Originalsprache ist oder der Abruf scheiterte.
 */
export function useLesevariante(koId: string | undefined): LesevarianteKurz | undefined {
  const { i18n } = useTranslation();
  const lang = sprachcode(i18n.language);
  const aktuell = useSyncExternalStore(abonniere, lies, lies);
  useEffect(() => {
    lesevariantenSicherstellen(lang);
  }, [lang]);
  if (!koId || aktuell.lang !== lang) {
    return undefined;
  }
  return anzuzeigendeVariante(aktuell.jeKo.get(koId), lang);
}

// ================================================================================================
// JOB 3326 R3 (BEN R2 ROT + Codex 300d1c3a, Punkte 1 und 2) — DIE LESEFLÄCHE FRAGT SELBST.
// ================================================================================================
//
// WAS FALSCH WAR. Die Detailansicht nahm Titel, Kernaussage UND die beiden Vorbehalte
// („Original seit Übersetzung geändert", „Zuordnung unbestätigt") aus dem VORRAT. Der Vorrat wird
// je Sprache genau EINMAL gefüllt und danach nie wieder — er ist eine Liste, kein Live-Blick.
// Zwei Folgen, beide gemessen:
//
//   · BEN R2: Detail öffnen, Original ändern, Detail erneut öffnen — die Warnung blieb weg. Der
//     frische Abruf lief zwar, aber nur für den Fließtext; über die Warnung entschied weiter die
//     alte Kurzzeile. Eine Warnung, die vom Alter eines Caches abhängt, ist keine Warnung.
//   · Codex: Ist das Objekt inzwischen gelöscht oder nicht mehr sichtbar, antwortet der Server auf
//     den frischen Abruf mit 404 — und die Kurzkarte zeigte den alten deutschen Text WEITER, neben
//     einer Fläche, die den Zugriff schon ablehnt.
//
// DIE ANTWORT DARAUF IST NICHT EIN KLÜGERER CACHE, SONDERN KEINER. Die Leseansicht fragt bei jedem
// Öffnen selbst — ein GET je Detailaufruf. Was sie zeigt, stammt AUSSCHLIESSLICH aus dieser einen
// frischen Antwort; solange sie aussteht, steht nichts Übersetztes da. Damit kann keine Anzeige
// älter sein als der Blick, der sie erzeugt hat.
//
// DER PREIS, ehrlich: ein Objekt OHNE Übersetzung kostet je Detailaufruf einen 404. Das ist der
// bewusst gewählte Tausch — die frühere Ersparnis war genau die Quelle beider Befunde. Der Vorrat
// bleibt für die LISTEN-Vorschau (`KoSummaryDisclosure`), wo ein Abruf je Zeile ein Anfragesturm
// wäre und wo keine Warnung hängt.
//
// JOB 3363: DIESELBE LAGE, ZWEI GEGENSTÄNDE. Die Prüfkarte in Stufe 2 zeigt Kandidaten, die noch
// KEIN Wissensobjekt sind — sie haben keine `koId`, also greift `useFrischeLesevariante` für sie
// nicht. Der Zustandsraum, die Anfragegeneration, die Regel „in der Originalsprache nicht
// übersetzt zeigen" und die Unterscheidung „es gibt keine" gegen „der Abruf ist gescheitert" sind
// aber Wort für Wort dieselben. Deshalb ist der Typ über die Variante GENERISCH und darunter steht
// EIN Haken, der beide Quellen bedient — kein zweiter, der dieselben vier Fälle noch einmal
// auslegt und beim nächsten Befund nur an einer Stelle nachgeführt wird.
export type LesevariantenLage<V = Lesevariante> =
  /** Für diesen Gegenstand gibt es in dieser Sprache keine Übersetzung — kein Hinweis, kein Vorbehalt. */
  | { zustand: "aus" }
  /** Der Abruf läuft. Es steht noch NICHTS Übersetztes da (auch nichts Altes). */
  | { zustand: "laedt" }
  | { zustand: "da"; variante: V }
  /** Der Abruf ist gescheitert (kein Zugriff, Netz, Serverfehler) — die Fläche sagt es. */
  | { zustand: "fehlt" };

/**
 * WOFÜR die Übersetzung geholt wird — der Endpunkt und die Frage „ist diese Antwort lesbar?".
 * Alles danach (Zustandsraum, Anfragegeneration, Sprachregel, Fehlerunterscheidung) ist gleich.
 *
 * ES GIBT GENAU ZWEI, UND SIE SIND MODULKONSTANTEN. Damit ist die Abruffunktion bei jedem Rendern
 * DIESELBE — eine je Aufruf neu gebildete Funktion in der Abhängigkeitsliste des Effekts löste
 * einen Abruf je Rendern aus. Und weil `lesbar` ein Typprädikat der jeweiligen Art ist, entsteht
 * die Verengung im Haken ohne ein einziges `as`.
 */
interface Variantenart<V extends { originalLanguage: string }> {
  hole(id: string, lang: string): Promise<unknown>;
  lesbar(antwort: unknown): antwort is V;
}

/**
 * Trägt diese Antwort wirklich eine LESBARE Variante? Geprüft werden genau die Felder, die die
 * Leseansicht zeigt und der Hinweis benennt.
 *
 * WARUM DAS HIER STEHT UND NICHT „wird schon stimmen": Eine Antwort ohne `originalLanguage` würde
 * sonst zu einer Karte „Übersetzung · Original: UNDEFINED" mit leerem Titel — eine erfundene
 * Auskunft aus einer unvollständigen. Fehlt ein Feld, gibt es für diese Fläche keine Variante;
 * dann steht das Original da. Wissenslücke statt Erfindung.
 */
function istLesbareVariante(antwort: unknown): antwort is Lesevariante {
  return tragfaehig(antwort);
}

/**
 * Die vier Felder, ohne die KEINE Fläche etwas Übersetztes zeigen darf: die Originalsprache (sonst
 * stünde da „Übersetzung · Original: UNDEFINED"), Titel, Kernaussage und Fließtext.
 *
 * JOB 3363: DIESELBE Prüfung gilt für die Kandidatenvariante. Sie trägt dieselben vier Felder
 * (Auftrag §5.1 „title/statement/body"); die Prüfkarte ZEIGT den Fließtext zwar nicht — dort bleibt
 * der ganze importierte Seitentext das Original, weil er der Prüfgegenstand ist —, aber eine
 * abgeschnittene Antwort ist auch hier keine Variante. Eine zweite, schwächere Fassung dieser
 * Prüfung daneben wäre die zweite Auslegung derselben Frage.
 */
function tragfaehig(antwort: unknown): boolean {
  const v = antwort as Partial<Lesevariante> | null;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.originalLanguage === "string" &&
    v.originalLanguage.length > 0 &&
    typeof v.title === "string" &&
    typeof v.statement === "string" &&
    typeof v.bodyHtml === "string"
  );
}

/** JOB 3363: dieselbe Tragfähigkeit, anderer Gegenstand — s. `tragfaehig`. */
function istLesbareKandidatenvariante(antwort: unknown): antwort is KandidatenLesevariante {
  return tragfaehig(antwort);
}

/** Die Übersetzung eines WISSENSOBJEKTS — volle Fassung mit Fließtext. */
const KO_VARIANTE: Variantenart<Lesevariante> = {
  hole: (id, lang) => endpoints.lesevarianten.fuerKo(id, lang),
  lesbar: istLesbareVariante,
};

/** JOB 3363 · Die live aufgelöste Übersetzung eines noch nicht angenommenen Kandidaten. */
const KANDIDATEN_VARIANTE: Variantenart<KandidatenLesevariante> = {
  hole: (id, lang) => endpoints.lesevarianten.fuerKandidat(id, lang),
  lesbar: istLesbareKandidatenvariante,
};

/**
 * Die Übersetzung EINES Gegenstands, frisch geholt. Art, Kennung und `uiSprache` bestimmen die
 * Anfrage; jeder Wechsel verwirft die vorherige Antwort über eine eigene Anfragegeneration (eine
 * verspätete Antwort auf ein anderes Objekt darf nie schreiben).
 */
function useFrischeVariante<V extends { originalLanguage: string }>(
  art: Variantenart<V>,
  id: string | undefined,
  uiSprache: string,
): LesevariantenLage<V> {
  const [lage, setLage] = useState<LesevariantenLage<V>>({ zustand: "aus" });
  const laufende = useRef(0);
  useEffect(() => {
    const meine = ++laufende.current;
    if (!id) {
      setLage({ zustand: "aus" });
      return;
    }
    setLage({ zustand: "laedt" });
    let angefragt: Promise<unknown>;
    try {
      angefragt = art.hole(id, uiSprache);
    } catch {
      setLage({ zustand: "fehlt" });
      return;
    }
    void angefragt
      .then((variante) => {
        if (meine !== laufende.current) {
          return;
        }
        // Dieselbe eine Regel wie überall: in der Originalsprache wird nicht übersetzt gezeigt.
        // Und eine Antwort, die keine lesbare Variante trägt, ist keine.
        setLage(
          art.lesbar(variante) && anzuzeigendeVariante(variante, uiSprache)
            ? { zustand: "da", variante }
            : { zustand: "aus" },
        );
      })
      .catch((fehler: unknown) => {
        if (meine !== laufende.current) {
          return;
        }
        // „Es gibt keine Übersetzung" ist KEIN Fehler — dann steht schlicht das Original da, ohne
        // Hinweis. Alles andere (Objekt weg, kein Zugriff, Netz) ist einer und wird benannt.
        const ohneVariante = fehler instanceof ApiError && fehler.code === "NO_LESEVARIANTE";
        setLage(ohneVariante ? { zustand: "aus" } : { zustand: "fehlt" });
      });
  }, [art, id, uiSprache]);
  return lage;
}

/** Die Übersetzung eines WISSENSOBJEKTS (`/wissen/:id`, Bibliotheks-Lesefläche). */
export function useFrischeLesevariante(
  koId: string | undefined,
  uiSprache: string,
): LesevariantenLage {
  return useFrischeVariante(KO_VARIANTE, koId, uiSprache);
}

/**
 * JOB 3363: Die Übersetzung eines noch NICHT angenommenen Import-KANDIDATEN (Prüfkarte, Stufe 2).
 *
 * Gefragt wird über die Kandidaten-Kennung; Provider und Quellkennung löst der SERVER auf. Der
 * Abruf ändert am Kandidaten nichts — er nimmt ihn nicht an, verschiebt keinen Status und legt
 * kein Wissensobjekt an.
 */
export function useFrischeKandidatenLesevariante(
  kandidatId: string | undefined,
  uiSprache: string,
): LesevariantenLage<KandidatenLesevariante> {
  return useFrischeVariante(KANDIDATEN_VARIANTE, kandidatId, uiSprache);
}
