// ================================================================================================
// R-1034 / FR-I18N-02 · IM BETRIEB GEPFLEGTE TEXTE ÜBER DEN MITGELIEFERTEN BESTAND LEGEN.
// ================================================================================================
//
// Der mitgelieferte Bestand (Wörterbücher und Textmodule im Bündel) bleibt unangetastet. Was eine
// Administratorin unter „Verwaltung › System › Übersetzungen" ändert, liegt auf dem Server
// (`GET /api/i18n/:locale`) und wird hier ÜBER die aktive Sprache gelegt — beim Start und bei jedem
// Sprachwechsel. Fällt der Abruf aus, bleibt es still beim mitgelieferten Text: eine fehlende
// Anpassung ist kein Grund, die Oberfläche zu stören.
//
// WARUM ERST NACH DEM LADEN DER SPRACHE. Ein Bündel, das i18next schon kennt, holt es über den
// Nachlader (`lib/sprachNachlader.ts`) nicht mehr. Legte diese Datei Texte über eine Sprache, deren
// Paket noch unterwegs ist, gälte das Paket als vorhanden und bliebe für immer aus. Deshalb hört sie
// auf `languageChanged` — das feuert erst, wenn das Paket da ist — und wird in `main.tsx` erst nach
// `sprachBereit` gebunden.
//
// WARUM DIE ORIGINALE GEMERKT WERDEN. „Zurücksetzen" heißt: der mitgelieferte Text gilt wieder. Ist
// er im Speicher von i18next schon überdeckt, wüsste niemand mehr, wie er lautete. Diese Datei merkt
// ihn sich beim ersten Überdecken und gibt ihn der Pflegekarte als Vergleichstext heraus.
//
// DOM-frei, strukturell typisiert wie `htmlLang.ts` — prüfbar ohne das große Wörterbuch.
import { I18N_LANGUAGE_CHANGED_EVENT, type I18nLike, type SprachZuhoerer } from "./htmlLang";
import { OBERFLAECHEN_SPRACHEN } from "./sprachregister";

/** Die Antwort von `GET /api/i18n/:locale`. */
export interface GepflegteTexte {
  sprache: string;
  texte: Record<string, string>;
}

/** Eine Sprache aus `GET /api/i18n/locales`. */
export interface InstanzSprache {
  kennung: string;
  /** Anzeigename einer angelegten Sprache; `null` bei den mitgelieferten. */
  name: string | null;
  grundsprache: boolean;
}

export interface InstanzSprachen {
  locales: string[];
  sprachen: InstanzSprache[];
}

const NAMENSRAUM = "translation";

/** Was diese Datei an i18next braucht — nicht mehr. */
export type TextpflegeI18n = I18nLike & {
  getResource(sprache: string, namensraum: string, schluessel: string): unknown;
  addResource(sprache: string, namensraum: string, schluessel: string, wert: string): unknown;
  hasResourceBundle(sprache: string, namensraum: string): boolean;
};

export type TextpflegeLader = (sprache: string) => Promise<Record<string, string>>;

type Originale = Map<string, Map<string, string | null>>;

/** Je i18n-Instanz: Sprache → Schlüssel → mitgelieferter Text (oder `null`, wenn es keinen gab). */
const originaleJeInstanz = new WeakMap<TextpflegeI18n, Originale>();

function originaleVon(i18n: TextpflegeI18n): Originale {
  const vorhanden = originaleJeInstanz.get(i18n);
  if (vorhanden) {
    return vorhanden;
  }
  const neu: Originale = new Map();
  originaleJeInstanz.set(i18n, neu);
  return neu;
}

function merkeOriginal(i18n: TextpflegeI18n, sprache: string, schluessel: string): void {
  const originale = originaleVon(i18n);
  const jeSprache = originale.get(sprache) ?? new Map<string, string | null>();
  if (!jeSprache.has(schluessel)) {
    const wert = i18n.getResource(sprache, NAMENSRAUM, schluessel);
    jeSprache.set(schluessel, typeof wert === "string" ? wert : null);
  }
  originale.set(sprache, jeSprache);
}

/**
 * Der MITGELIEFERTE Text eines Schlüssels — auch dann, wenn er in dieser Sitzung schon überdeckt ist.
 * `null`: das Bündel bringt für diese Sprache keinen Text mit (die Oberfläche fällt auf Deutsch zurück).
 */
export function mitgelieferterText(
  i18n: TextpflegeI18n,
  sprache: string,
  schluessel: string,
): string | null {
  const gemerkt = originaleVon(i18n).get(sprache);
  if (gemerkt?.has(schluessel)) {
    return gemerkt.get(schluessel) ?? null;
  }
  const wert = i18n.getResource(sprache, NAMENSRAUM, schluessel);
  return typeof wert === "string" ? wert : null;
}

/**
 * Darf jetzt überlegt werden? Eine MITGELIEFERTE Sprache — de|en|nl und jede über ihre Ressource
 * angemeldete (R-0997, `OBERFLAECHEN_SPRACHEN`) — erst, wenn ihr Paket da ist (siehe Kopf). Eine im
 * Betrieb angelegte Sprache (FR-I18N-02) hat nie ein Paket, das ausbleiben könnte — ihre gepflegten
 * Texte SIND ihr Bestand und dürfen immer gelegt werden.
 */
function darfUeberlegen(i18n: TextpflegeI18n, sprache: string): boolean {
  return !OBERFLAECHEN_SPRACHEN.includes(sprache) || i18n.hasResourceBundle(sprache, NAMENSRAUM);
}

/**
 * Legt gepflegte Texte über eine Sprache — eine mitgelieferte nur, wenn i18next ihr Paket schon
 * geladen hat (siehe Kopf). Eine noch nicht geladene bekommt ihre Texte beim nächsten Wechsel dorthin.
 */
export function legeTexteUeber(
  i18n: TextpflegeI18n,
  sprache: string,
  texte: Readonly<Record<string, string>>,
): void {
  if (!darfUeberlegen(i18n, sprache)) {
    return;
  }
  for (const [schluessel, text] of Object.entries(texte)) {
    merkeOriginal(i18n, sprache, schluessel);
    i18n.addResource(sprache, NAMENSRAUM, schluessel, text);
  }
}

/** Nimmt eine Anpassung in dieser Sitzung zurück: der mitgelieferte Text gilt wieder. */
export function setzeTextZurueck(i18n: TextpflegeI18n, sprache: string, schluessel: string): void {
  const gemerkt = originaleVon(i18n).get(sprache);
  if (!gemerkt?.has(schluessel)) {
    return;
  }
  const original = gemerkt.get(schluessel);
  // Brachte das Bündel für diese Sprache keinen Text mit, zeigte die Oberfläche vor der Anpassung den
  // deutschen (`fallbackLng`). Entfernen kann i18next einen einzelnen Eintrag nicht; also steht
  // derselbe deutsche Text wieder da — sichtbar dasselbe wie vor der Anpassung.
  const ersatz = original ?? mitgelieferterText(i18n, "de", schluessel) ?? schluessel;
  i18n.addResource(sprache, NAMENSRAUM, schluessel, ersatz);
  gemerkt.delete(schluessel);
}

/**
 * Übernimmt den VOLLSTÄNDIGEN Serverbestand einer Sprache (`GET /api/i18n/:locale`).
 *
 * Anders als `legeTexteUeber` (eine einzelne Speicherantwort, also eine Teiländerung) ist diese
 * Antwort die ganze Wahrheit: eine Anpassung, die diese Sitzung früher übernommen hat und die jetzt
 * fehlt, ist auf dem Server zurückgesetzt worden — etwa von einer anderen Administratorin. Sie wird
 * hier zurückgenommen; sonst stünde der entfernte Text in jeder schon geöffneten Sitzung weiter da,
 * auch nach einem Sprachwechsel. Wie `legeTexteUeber` nur für eine bereits geladene Sprache.
 */
export function uebernimmBestand(
  i18n: TextpflegeI18n,
  sprache: string,
  texte: Readonly<Record<string, string>>,
): void {
  if (!darfUeberlegen(i18n, sprache)) {
    return;
  }
  const bisher = [...(originaleVon(i18n).get(sprache)?.keys() ?? [])];
  for (const schluessel of bisher) {
    if (!Object.hasOwn(texte, schluessel)) {
      setzeTextZurueck(i18n, sprache, schluessel);
    }
  }
  legeTexteUeber(i18n, sprache, texte);
}

/**
 * Beim App-Start (main.tsx, NACH `sprachBereit`): die gepflegten Texte der aktiven Sprache holen und
 * bei jedem Sprachwechsel die der neuen Sprache. Rückgabe ist die Abmeldung (idempotent, für Tests).
 */
export function bindTextpflege(i18n: TextpflegeI18n, laden: TextpflegeLader): () => void {
  const hole = (sprache: string): void => {
    laden(sprache).then(
      // Der Abruf liefert den ganzen Bestand — entfernte Anpassungen werden mit zurückgenommen.
      (texte) => uebernimmBestand(i18n, sprache, texte),
      () => {
        // Ausfall: der mitgelieferte Text bleibt stehen — kein Banner, kein Abbruch.
      },
    );
  };
  const zuhoerer: SprachZuhoerer = (sprache) => hole(sprache);
  hole(i18n.language);
  i18n.on(I18N_LANGUAGE_CHANGED_EVENT, zuhoerer);

  let abgemeldet = false;
  return () => {
    if (abgemeldet) {
      return;
    }
    abgemeldet = true;
    i18n.off(I18N_LANGUAGE_CHANGED_EVENT, zuhoerer);
  };
}

/** Die Platzhalter eines Textes (`{{name}}`), sortiert und ohne Doppel. */
export function platzhalter(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1] ?? ""))].sort();
}

/**
 * Trägt ein neuer Text dieselben Platzhalter wie der mitgelieferte? Fehlt einer, stünde an seiner
 * Stelle später nichts; ein fremder bliebe als `{{…}}` sichtbar stehen. Gibt die Abweichungen zurück.
 */
export function platzhalterAbweichung(
  vorlage: string,
  neu: string,
): { fehlend: string[]; fremd: string[] } {
  const soll = platzhalter(vorlage);
  const ist = platzhalter(neu);
  return {
    fehlend: soll.filter((p) => !ist.includes(p)),
    fremd: ist.filter((p) => !soll.includes(p)),
  };
}
