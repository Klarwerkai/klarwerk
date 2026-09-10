// ================================================================================================
// JOB 3511 · DIE MARKENEBENE — EIN ZWEITES WURZELATTRIBUT, NEBEN DER DARSTELLUNGSWAHL.
// ================================================================================================
//
// Pedi hat am 10.09. mit „Setz es um" freigegeben: Admin → Vorführdaten → Demo-Erscheinungsbild
// schaltet ein Firmenprofil (heute genau eines: Advisor) für ALLE ein. KLARWERK trägt dann das
// Advisor-Logo und die Advisor-Hausfarben; zurückgelegt sieht alles wieder aus wie vorher.
//
// WARUM DAS EINE EIGENE DATEI IST UND NICHT `designTheme.ts` MIT ANFASST — das ist die
// Kernentscheidung dieses Auftrags und keine Geschmacksfrage:
//
//   · `designTheme.ts` trägt die WAHL DES BROWSERS (klassisch/modern, je Mensch, im localStorage).
//   · Diese Datei trägt die WAHL DER INSTALLATION (Firmen-CI, zentral, vom Server).
//
// Zwei Wahrheiten mit verschiedenen Eigentümern und verschiedener Lebensdauer. Läge beides an
// EINEM Attribut, müsste das Einschalten der Firmen-CI die gespeicherte klassisch/modern-Wahl
// überschreiben — und das Ausschalten könnte sie nicht mehr zurückgeben. Deshalb: `data-brand`
// ZUSÄTZLICH zu `data-theme`, nie anstelle davon. Diese Datei schreibt NICHTS in den Browser-
// speicher (Auftrag §6: „Keine zweite Speicherschicht im Browser für die Markenwahl").
//
// AUSSCHALTEN HEISST: ATTRIBUT WEG. Es gibt keinen `data-brand="keine"`-Zustand, an den sich je
// eine Regel hängen könnte — genau die Bauform, die `designTheme.ts:41` für „klassisch" gewählt
// hat, und aus demselben Grund. Alle Advisor-Regeln hängen ausschließlich unter
// `[data-brand="advisor"]` (`styles/marke.css`); ohne das Attribut kann keine von ihnen matchen,
// und damit ist jeder berechnete Wert wieder exakt der vorherige. Das prüft der Bindungssammler
// `tests/demo-firmen-ci-web/marke-bindung.test.ts`.
//
// ZWEI WIRKUNGEN, ZWEI WEGE, EINE QUELLE: die FARBEN wirken über das Wurzelattribut und die
// Kaskade; das LOGO ist ein `<img>` mit echtem Alternativtext in `shell/Logo.tsx` und holt seinen
// Stand über `abonniereBranding`/`aktuellesBranding` aus genau diesem Modul. Die Hülle fragt den
// Server bewusst nicht selbst — das wäre ein zweiter, ungedrosselter Takt neben dem hier.
//
// DOM-frei über strukturelle Typen (wie `designTheme.ts:33`) — importierbar aus node-env-Tests.
import { ApiError, api } from "../api/client";

/** Das EINE Wurzelattribut der Markenebene. Sein Wert ist das Profil, nicht „an"/„aus". */
export const BRAND_ATTRIBUT = "data-brand";

/** Das heute einzige Firmenprofil. Es steht hier, weil die Adminfläche es anbieten muss. */
export const BRAND_PROFIL_ADVISOR = "advisor";

/**
 * Der Alternativtext des Logos, JE PROFIL.
 *
 * Er steht hier und NICHT in `i18n.ts`: „Advisor ICT solutions logo" ist der Alternativtext der
 * Originaldatei (`gespraech/ci-advisor/AUFTRAGSGRUNDLAGE.md`) — eine Eigenschaft des Bildes, keine
 * Übersetzung. Und er steht als Zuordnung statt als einzelne Zeichenkette, damit ein zweites
 * Firmenprofil nicht stillschweigend den Alternativtext von Advisor erbt.
 */
export const BRAND_LOGO_ALT: Readonly<Record<"advisor", string>> = {
  advisor: "Advisor ICT solutions logo",
};

/** Der Vertrag zum Server (JOB 3510, mit Codex abgestimmt) — wörtlich diese zwei Wege. */
export const BRANDING_PFAD = "/branding";
export const BRANDING_ADMIN_PFAD = "/admin/branding";

/**
 * Die Untergrenze zwischen zwei Abrufen (Auftrag, Lieferung 7: „danach höchstens alle 60
 * Sekunden"). Sie gilt für die anlassbezogenen Abrufe — Sichtbarwerden des Tabs und Fokus —,
 * nicht für den einen Abruf beim Start.
 */
export const BRANDING_MINDESTABSTAND_MS = 60_000;

export type BrandProfil = "advisor" | null;

export interface BrandFarben {
  readonly primaer: string;
  readonly schrift: string;
}

export interface BrandMarke {
  readonly name: string;
  readonly farben: BrandFarben;
  readonly logo: string;
}

/** Die Antwort von `GET /api/branding` und `PUT /api/admin/branding` — identisch geformt. */
export interface BrandingStand {
  readonly profil: BrandProfil;
  readonly aktiv: boolean;
  readonly version: number;
  readonly marke: BrandMarke | null;
}

/** Der Rumpf von `PUT /api/admin/branding` — genau zwei Felder, mehr nimmt der Server nicht. */
export interface BrandingWunsch {
  readonly profil: BrandProfil;
  readonly aktiv: boolean;
}

// Strukturell statt lib.dom, damit dieser Helfer auch im DOM-freien Typkontext kompiliert.
type DocumentLike = {
  readonly visibilityState?: string;
  documentElement: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  };
  addEventListener(typ: string, hoerer: () => void): void;
};

type FensterLike = {
  document?: DocumentLike;
  addEventListener?: (typ: string, hoerer: () => void) => void;
  // Der Rückgabewert bleibt bewusst `unknown`: im Browser ist es eine Zahl, in node ein `Timeout`.
  // Diese Datei hält den Takt für die Lebensdauer der Anwendung und beendet ihn nie — sie braucht
  // den Wert also nicht, und ein Typ, der sich auf eine der beiden Welten festlegt, wäre falsch.
  setInterval?: (hoerer: () => void, ms: number) => unknown;
};

const fenster = (): FensterLike => globalThis as unknown as FensterLike;

/** Der Stand ist nur dann sichtbar, wenn ein Profil gewählt UND der Schalter an ist. */
export function markeAktiv(stand: BrandingStand): boolean {
  return stand.aktiv && stand.profil !== null;
}

/**
 * Der Stand einer Installation, deren Server den Branding-Weg GAR NICHT KENNT (404).
 *
 * DAS IST KEINE NOTLÜGE, SONDERN DIE WAHRHEIT ÜBER DIESE INSTALLATION: Antwortet der Server auf
 * `GET /api/branding` mit „gibt es hier nicht", dann gibt es hier auch keine Firmen-CI, und „kein
 * Firmenprofil · aus" ist die richtige Auskunft. Die Unterscheidung zu jedem ANDEREN Fehler bleibt
 * scharf: 5xx, Zeitüberschreitung und Netzausfall sagen nichts über die Installation aus, werden
 * deshalb weitergereicht und erscheinen auf der Fläche als „nicht abrufbar" mit „Erneut versuchen"
 * (LEHREN §7: eine Tatsachenaussage hängt an ihrer Voraussetzung).
 *
 * DER ANLASS IST GEMESSEN, NICHT ANGENOMMEN: Der Serverweg entsteht in JOB 3510, der parallel
 * läuft. Ohne diese Unterscheidung stünde in der Karte „Demodaten" auf jedem Stand ohne 3510
 * DAUERHAFT eine Fehlerbox — gefunden vom Torlauf über `tests/design/h6-detail-zustandsweg.test.ts`
 * (Fall K: „ohne Störung gibt es in keiner Karte einen Fehlerzustand").
 *
 * `version: -1` ist bewusst ein Wert, den der Server nie senden kann (er zählt ab 0 aufwärts):
 * kommt der echte Weg später dazu, ist SEINE erste Version garantiert eine andere, und die Marke
 * wird übernommen statt als „schon bekannt" verworfen.
 */
export const BRANDING_UNBEKANNT: BrandingStand = {
  profil: null,
  aktiv: false,
  version: -1,
  marke: null,
};

export async function ladeBranding(): Promise<BrandingStand> {
  try {
    return await api.get<BrandingStand>(BRANDING_PFAD);
  } catch (fehler) {
    if (fehler instanceof ApiError && fehler.status === 404) {
      return BRANDING_UNBEKANNT;
    }
    throw fehler;
  }
}

export function setzeBranding(wunsch: BrandingWunsch): Promise<BrandingStand> {
  // AUSDRÜCKLICH neu aufgebaut und nicht durchgereicht: der Vertrag kennt genau zwei Felder. Ein
  // durchgereichtes Objekt würde jedes Feld mitschicken, das die Fläche irgendwann daranhängt.
  return api.put<BrandingStand>(BRANDING_ADMIN_PFAD, {
    profil: wunsch.profil,
    aktiv: wunsch.aktiv,
  });
}

// ------------------------------------------------------------------------------------------------
// Der Zustand dieser Sitzung. Bewusst modul-lokal und NICHT im Browserspeicher: die Markenwahl ist
// zentral und kommt vom Server; ein zweiter Speicher wäre eine zweite Wahrheit (Auftrag §6).
// ------------------------------------------------------------------------------------------------
let letzteVersion: number | null = null;
let letzterAbrufMs = Number.NEGATIVE_INFINITY;
let laeuft = false;
let angemeldet = false;
let aktuellerStand: BrandingStand | null = null;
const zuhoerer = new Set<() => void>();

/**
 * Der zuletzt vom Server bestätigte Stand — `null`, solange noch keiner eingetroffen ist.
 *
 * `null` heißt AUSDRÜCKLICH „noch nicht bekannt" und nicht „aus": die Hülle zeigt in beiden Fällen
 * dasselbe (die reine KLARWERK-Wortmarke), aber die Unterscheidung bleibt hier lesbar, statt an
 * einem `false` zu verschwinden.
 */
export function aktuellesBranding(): BrandingStand | null {
  return aktuellerStand;
}

/**
 * Die Anbindung für React (`useSyncExternalStore` in `shell/Logo.tsx`) — und der Grund, warum die
 * Hülle den Stand NICHT selbst abfragt: es gibt genau EINE Quelle, dieses Modul. Eine zweite
 * Abfrage in der Hülle wäre ein zweiter Takt neben dem hier gedrosselten.
 *
 * Wichtig für `useSyncExternalStore`: `aktuellesBranding()` gibt zwischen zwei Meldungen dieselbe
 * Objektreferenz zurück — es wird nur bei geänderter `version` überhaupt ein neues gesetzt.
 */
export function abonniereBranding(melden: () => void): () => void {
  zuhoerer.add(melden);
  return () => {
    zuhoerer.delete(melden);
  };
}

/**
 * Den gelieferten Stand auf die Wurzel schreiben und die Hülle davon in Kenntnis setzen.
 *
 * Auch die Adminfläche ruft das nach ihrem `PUT` — damit sieht der schaltende Mensch die Wirkung
 * sofort, ohne auf den nächsten Abruf zu warten, und `letzteVersion` bleibt dabei richtig.
 */
export function uebernimmBranding(stand: BrandingStand): void {
  letzteVersion = stand.version;
  aktuellerStand = stand;
  for (const melden of zuhoerer) {
    melden();
  }
  const doc = fenster().document;
  if (!doc) {
    return;
  }
  if (markeAktiv(stand) && stand.profil !== null) {
    doc.documentElement.setAttribute(BRAND_ATTRIBUT, stand.profil);
  } else {
    doc.documentElement.removeAttribute(BRAND_ATTRIBUT);
  }
}

/**
 * Einmal nachsehen, ob sich die Marke geändert hat.
 *
 * FÄLLT DER ABRUF AUS, PASSIERT NICHTS — der zuletzt bekannte Zustand bleibt stehen, es fliegt
 * keine Ausnahme, es erscheint kein Banner, und die Anwendung bleibt voll bedienbar (Lieferung 7).
 * Das ist dieselbe Regel wie in LEHREN 7: eine gescheiterte Hintergrund-Auffrischung leert nichts.
 */
async function frischeMarke(erzwingen: boolean): Promise<void> {
  if (laeuft) {
    return;
  }
  const jetzt = Date.now();
  if (!erzwingen && jetzt - letzterAbrufMs < BRANDING_MINDESTABSTAND_MS) {
    return;
  }
  laeuft = true;
  letzterAbrufMs = jetzt;
  try {
    const stand = await ladeBranding();
    // ================================================================================================
    // NUR VORWÄRTS. BENs Befund an Runde 1 (Korrekturpflicht 2), gemessen und nicht vermutet:
    // ================================================================================================
    // Hier stand `stand.version !== letzteVersion` — also „jede ANDERE Version", auch eine ÄLTERE.
    // Der Fall, den das kaputtmacht, ist keine Theorie und braucht keinen Fehler: Ein
    // Hintergrundabruf startet, WÄHREND er läuft schaltet Pedi die Marke ein, sein `PUT` bestätigt
    // Version 2 und die Marke steht — und danach löst der ältere `GET` mit Version 1 auf und dreht
    // seine gerade bestätigte Schaltung wieder zurück. Zwei Antworten überholen einander; das ist
    // im Netz der Normalfall und nicht die Ausnahme.
    //
    // `>` statt `!==` ist die ganze Abwehr: ein Stand, der ÄLTER ist als der zuletzt übernommene,
    // trägt keine Neuigkeit und wird verworfen. `letzteVersion === null` ist der Start — die erste
    // Antwort wird immer übernommen.
    //
    // WAS DAS BEWUSST NICHT KANN: Setzt ein Server seinen Zähler zurück (neu aufgesetzte Instanz),
    // gilt sein kleinerer Stand erst nach einem Neuladen der Seite. Das ist der richtige Tausch —
    // eine zurückgedrehte Schaltung sieht der Mensch sofort, ein neu aufgesetzter Server ist ein
    // Neustart-Ereignis. Die Alternative (Zeitstempel statt Zähler) steht nicht im Vertrag.
    if (letzteVersion === null || stand.version > letzteVersion) {
      uebernimmBranding(stand);
    }
  } catch {
    // Absicht: kein Zurücksetzen, keine Meldung. Siehe Kopfkommentar dieser Funktion.
  } finally {
    laeuft = false;
  }
}

/**
 * Beim App-Start (main.tsx). Holt die Marke einmal und hält sie danach nach — auf DREI Wegen, die
 * sich dieselbe Drosselung von einem Abruf je Minute teilen:
 *
 *   · beim Sichtbarwerden des Tabs (`visibilitychange`),
 *   · beim Fokus (`focus`),
 *   · und im festen Takt, ganz OHNE Ereignis.
 *
 * ================================================================================================
 * DER TAKT IST BENs BEFUND AN RUNDE 1 (Korrekturpflicht 1) — und er ist der WICHTIGSTE der drei.
 * ================================================================================================
 * Bis hierher hingen alle Abrufe an Ereignissen. Genau der Bildschirm, um den es am Freitag geht,
 * erzeugt aber keine: das Kopfband liegt dauerhaft sichtbar auf einem zweiten Monitor, niemand
 * klickt hinein, niemand schaltet den Tab weg. Ein solches Fenster hätte die Marke NIE nachgeführt
 * — Pedi legt den Schalter um, und die Vorführfläche daneben bleibt, wie sie war. Gemessen von BEN:
 * „Nach 120 Sekunden ohne Fokuswechsel weiterhin nur ein Abruf."
 *
 * WARUM DAS TROTZDEM KEIN ZWEITER TAKT IST: Der Intervallschlag ruft dieselbe `frischeMarke(false)`
 * wie die beiden Ereignisse und läuft damit durch dieselbe Drosselung. Wer gerade eben durch einen
 * Fokuswechsel geholt hat, holt beim nächsten Schlag NICHT noch einmal — die Zusage „höchstens alle
 * 60 Sekunden" (Auftrag, Lieferung 7) gilt über alle drei Wege zusammen, nicht je Weg.
 *
 * Der Aufruf ist idempotent — zweimal aufgerufen hängt er weder die Hörer noch den Takt zweimal an.
 * BLOCKIERT DEN START NICHT: das Versprechen wird bewusst nicht abgewartet.
 */
export function initBrandTheme(): void {
  if (angemeldet) {
    return;
  }
  angemeldet = true;
  const g = fenster();
  g.document?.addEventListener("visibilitychange", () => {
    // Nur das SICHTBARWERDEN zählt; beim Wegschalten hat ein Abruf keinen Adressaten.
    if (g.document?.visibilityState !== "hidden") {
      void frischeMarke(false);
    }
  });
  g.addEventListener?.("focus", () => {
    void frischeMarke(false);
  });
  g.setInterval?.(() => {
    void frischeMarke(false);
  }, BRANDING_MINDESTABSTAND_MS);
  void frischeMarke(true);
}
