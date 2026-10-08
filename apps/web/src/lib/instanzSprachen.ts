// ================================================================================================
// FR-I18N-02 · DIE IM BETRIEB ANGELEGTEN SPRACHEN SIND WÄHLBAR — OHNE CODEÄNDERUNG.
// ================================================================================================
//
// Die Sprachen, die das Bündel mitbringt, stehen fest in `ERLAUBTE_SPRACHEN` (`htmlLang.ts`). Weitere
// Sprachen legt eine Administratorin unter Verwaltung › System › Übersetzungen an
// (`PUT /api/admin/i18n-sprachen/:locale`); `GET /api/i18n/locales` nennt sie. DIESE Datei ist die
// eine Wahrheit darüber, welche angelegten Sprachen die Oberfläche zur Wahl stellt: Kontomenü
// (`components/SprachSchalter.tsx`), Profil (`pages/Profile.tsx`) und die gespeicherte Wahl
// (`lib/sprachwahl.ts`) lesen sie alle hier.
//
// WARUM EIN ZWISCHENSPEICHER IM BROWSER. Die Startsprache wird beim Auswerten von `i18n.ts`
// bestimmt — synchron, bevor irgendein Netzabruf antworten kann. Ohne gemerkte Liste fiele eine
// gewählte Sprache wie „fr" bei jedem Neuladen auf Deutsch zurück, obwohl der Server sie kennt. Die
// Liste wird nach jedem Start gegen den Server abgeglichen (`main.tsx`); nimmt der Server eine Sprache
// nicht mehr, verschwindet sie hier und die Oberfläche fällt auf die Vorgabe zurück.
//
// WAS HIER NICHT GEÄNDERT WIRD: `<html lang>`. Die Ownerentscheidung zu JOB 536 (13.08.2026) betrifft
// ausdrücklich das `lang`-Attribut — „genau `de|en|nl` zulassen, alles andere als No-op" — und gilt
// dort unverändert (`applyHtmlLang`). Ein Verbot weiterer wählbarer Sprachen folgt aus ihr nicht.
//
// DOM-frei (über `persistentToggle.ts`), importierbar aus node-env-Tests.
import { ERLAUBTE_SPRACHEN } from "./htmlLang";
import { readStoredString, safeLocalStorage, writeStoredString } from "./persistentToggle";

/** Der Speicherschlüssel der zuletzt vom Server gemeldeten angelegten Sprachen. */
export const ANGELEGTE_SPRACHEN_KEY = "kw.instanzsprachen";

/** Dieselbe Form wie auf dem Server (`services/app/src/uebersetzungen.ts`, `SPRACHKENNUNG`). */
const SPRACHKENNUNG = /^[a-z]{2,3}(-[A-Z]{2})?$/;

export interface AngelegteSprache {
  kennung: string;
  name: string;
}

type Zuhoerer = () => void;
const zuhoerer = new Set<Zuhoerer>();

function istAngelegteSprache(wert: unknown): wert is AngelegteSprache {
  if (typeof wert !== "object" || wert === null) {
    return false;
  }
  const roh = wert as Record<string, unknown>;
  return (
    typeof roh.kennung === "string" &&
    SPRACHKENNUNG.test(roh.kennung) &&
    !ERLAUBTE_SPRACHEN.includes(roh.kennung) &&
    typeof roh.name === "string" &&
    roh.name.trim().length > 0
  );
}

/** Nur geprüfte Einträge, jede Kennung einmal — ein kaputter Speicher ergibt eine leere Liste. */
function bereinige(liste: readonly unknown[]): AngelegteSprache[] {
  const gesehen = new Set<string>();
  const ergebnis: AngelegteSprache[] = [];
  for (const eintrag of liste) {
    if (istAngelegteSprache(eintrag) && !gesehen.has(eintrag.kennung)) {
      gesehen.add(eintrag.kennung);
      ergebnis.push({ kennung: eintrag.kennung, name: eintrag.name });
    }
  }
  return ergebnis;
}

let stand: AngelegteSprache[] | null = null;

/** Die angelegten Sprachen, wie sie zuletzt vom Server kamen (oder aus dem Speicher dieses Browsers). */
export function angelegteSprachen(): readonly AngelegteSprache[] {
  if (stand === null) {
    const roh = readStoredString(safeLocalStorage(), ANGELEGTE_SPRACHEN_KEY);
    let gelesen: unknown = [];
    try {
      gelesen = roh === null ? [] : JSON.parse(roh);
    } catch {
      gelesen = [];
    }
    stand = Array.isArray(gelesen) ? bereinige(gelesen) : [];
  }
  return stand;
}

/** Übernimmt die Liste des Servers, merkt sie für den nächsten Start und meldet die Änderung. */
export function setzeAngelegteSprachen(liste: readonly unknown[]): void {
  stand = bereinige(liste);
  writeStoredString(safeLocalStorage(), ANGELEGTE_SPRACHEN_KEY, JSON.stringify(stand));
  for (const z of zuhoerer) {
    z();
  }
}

/** Für `useSyncExternalStore`: die Auswahlflächen zeichnen neu, sobald der Server antwortet. */
export function abonniereAngelegteSprachen(z: Zuhoerer): () => void {
  zuhoerer.add(z);
  return () => {
    zuhoerer.delete(z);
  };
}

/** Alle wählbaren Sprachen: die mitgelieferten zuerst, dann die angelegten. */
export function waehlbareSprachen(): string[] {
  return [...ERLAUBTE_SPRACHEN, ...angelegteSprachen().map((s) => s.kennung)];
}

export function istWaehlbareSprache(sprache: string): boolean {
  return waehlbareSprachen().includes(sprache);
}

/** Der Anzeigename einer angelegten Sprache — `null` für die mitgelieferten (die übersetzt werden). */
export function nameDerAngelegtenSprache(kennung: string): string | null {
  return angelegteSprachen().find((s) => s.kennung === kennung)?.name ?? null;
}

/** Ein Eintrag aus `GET /api/i18n/locales` — strukturell, ohne Abhängigkeit vom API-Modul. */
interface ServerSprache {
  kennung: string;
  name: string | null;
  grundsprache: boolean;
}

/** Was der Abgleich an i18next braucht. */
interface SprachwechselI18n {
  language: string;
  changeLanguage(sprache: string): Promise<unknown>;
}

/**
 * Beim App-Start (main.tsx, NACH `sprachBereit`): die angelegten Sprachen vom Server holen und
 * merken. Kennt der Server die aktive Sprache nicht mehr (die Administratorin hat sie entfernt oder
 * der gemerkte Stand war veraltet), gilt wieder die Vorgabe. Ein Ausfall lässt den gemerkten Stand
 * stehen — die Wahl dieses Browsers geht durch eine Netzstörung nicht verloren.
 */
export async function gleicheAngelegteSprachenAb(
  i18n: SprachwechselI18n,
  laden: () => Promise<{ sprachen: readonly ServerSprache[] }>,
  vorgabe: string,
): Promise<void> {
  let antwort: { sprachen: readonly ServerSprache[] };
  try {
    antwort = await laden();
  } catch {
    return;
  }
  setzeAngelegteSprachen(antwort.sprachen.filter((s) => !s.grundsprache));
  if (!istWaehlbareSprache(i18n.language)) {
    await i18n.changeLanguage(vorgabe);
  }
}

/** Nur für Tests: vergisst den gelesenen Stand, damit der nächste Zugriff den Speicher neu liest. */
export function vergissAngelegteSprachen(): void {
  stand = null;
}
