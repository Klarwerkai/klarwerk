/**
 * JOB 3280 · CHR-06: `origin` ist die HERKUNFTSANGABE der Person zum eingefügten Text
 * (`"" | "ki_chat" | "web" | "eigen"`). Sie ist eine Aussage, keine Messung — der Browser sieht
 * die Zwischenablage erst im Augenblick des Einfügens. Für die Umfänge aus JOB 3278/3279 bleibt
 * sie leer und erscheint nicht im Entwurfskörper.
 */
export type Form = { title: string; context: string; confidentiality: string; origin: string };
/**
 * JOB 3279 · CHR-05: was NICHT mitgekommen ist. `kind` ist ein festes Schlüsselwort (beide
 * Sprachen und der Entwurfskörper leiten ihre Beschriftung daraus ab), `detail` nennt die
 * betroffene Adresse oder Zahl. Erfundene Freitexte aus der Seite gibt es hier nicht.
 */
export type Gap = { kind: string; detail: string };
/**
 * JOB 3279 · der übernommene Inhalt als BAUM, nicht als HTML-Zeichenkette. Genau ein Baum füttert
 * beides: die Vorschau in der Leiste (panel.js baut ihn mit createElement) und den Entwurfskörper
 * (worker.js schreibt ihn als HTML). Damit kann die Vorschau nicht etwas anderes zeigen als das
 * Gespeicherte — es gibt keine zweite Quelle, aus der sie schöpfen könnte.
 * Textknoten tragen `tag: "#text"`.
 */
export type Piece = {
  tag: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: Piece[];
};
/** Ein wählbarer Umfang: Markierung, Artikel oder zugängliche Seite. */
export type Variant = {
  available: boolean;
  text: string;
  nodes: Piece[];
  gaps: Gap[];
  images: number;
};
/**
 * Die bewussten Umfänge. Einer entsteht nicht aus Versehen.
 * JOB 3280 · CHR-06: `clipboard` kommt NUR durch einen Klick auf „Aus Zwischenablage einfügen"
 * zustande — die Seite liefert ihn nie, und er ist nie Vorbelegung nach einer Erfassung.
 */
export type Mode = "selection" | "article" | "page" | "clipboard";
export type Variants = Record<Mode, Variant>;
export type Selection = {
  text: string;
  title: string;
  url: string;
  capturedAt: string;
  tabId: number;
};
export type Auth = { id: string; email: string; token: string };
export type Work = {
  id: string;
  selection: Selection;
  variants: Variants;
  /** JOB 3279 R2: `""` heisst „noch nicht gewaehlt" — nie stillschweigend die ganze Seite. */
  mode: Mode | "";
  form: Form;
  owner: string | null;
  operations: { id: string; owner: string; fingerprint: string }[];
  status: string;
  /**
   * JOB 3280 R3: DIE ANLAGE, DEREN AUSGANG UNKLAR IST — Schlüssel, Abdruck und die Fassung, die
   * hinausging. Sie steht hier, sobald eine Sendung beginnt, und geht erst wieder weg, wenn ein
   * Entwurf bestätigt ist oder die Antwort eine Anlage ausschliesst. Nur mit der Fassung lässt sie
   * sich zeichengleich wiederholen; ohne sie wäre der einzige Ausweg ein zweiter Entwurf.
   */
  pendingCreate: { id: string; fingerprint: string; form: Form } | null;
  /**
   * JOB 3280 · CHR-07: der EINE Entwurf, der zu dieser Übernahme gehört. Anders als `receipt`
   * überlebt er jede Bearbeitung — er ist die Zusicherung „ein Vorgang, ein Entwurf". Nur
   * Verwerfen, Abmelden und ein Kontowechsel nehmen ihn weg.
   */
  draftId: string | null;
  /** Der zuletzt gesehene Stand dieses Entwurfs (`expectedUpdatedAt` beim nächsten PUT). */
  updatedAt: string | null;
  /** Die Einstufung, die SERVERSEITIG steht — sie kann von hier aus nicht geleert werden. */
  savedLevel: string;
  receipt: string | null;
};
/** BPA-02: eine Tabelle der Seite — Abschnitt, optionaler Anker, Kopf und Zeilen als Text. */
export type Tabelle = { abschnitt: string; anker: string; kopf: string[]; zeilen: string[][] };
/** BPA-02: der Beleg, den `POST /api/technische-daten/*` verlangt. */
export type Beleg = {
  art: "html" | "datenblatt";
  url: string;
  abschnitt: string;
  anker?: string;
  titel: string;
  abgerufenAm: string;
  kopf: string[];
  zeilen: string[][];
};
/** BPA-02: was die Leiste von einer Serverauswertung zeigt — nur Texte. */
export type TechnikErgebnis = { werte: string[]; klaerungen: string[]; abweichungen: string[] };
/**
 * BPA-02 (Nacharbeit 5): eine Quelle einer Übernahme — der Tab, in dem sie erfasst wurde, ihre
 * Adresse, die gewählte Art (Webseite oder ausdrücklich gewähltes Datenblatt) und die Tabelle.
 */
export type TechnikQuelle = {
  tabId: number;
  url: string;
  titel: string;
  art: "html" | "datenblatt";
  tabelle: Tabelle;
  erfasstAm: string;
};
/** BPA-02: die markierte Tabelle einer Übernahme und ihr Prüfstand. */
export type Technik = {
  captureId: string;
  tabelle: Tabelle;
  ziel: { objekt: string; variante: string };
  /** Die Quellen der letzten Prüfung, in der Reihenfolge ihrer Belege. */
  quellen: TechnikQuelle[] | null;
  belege: Beleg[] | null;
  vorschaubeleg: string | null;
  ergebnis: TechnikErgebnis | null;
  /** Ergebnis des letzten Quellenabgleichs, als Textzeilen. */
  abgleich: string[] | null;
  /** Nacharbeit 7: der Abschnitt fehlte bei der letzten frischen Lesung (Zeitpunkt). */
  klaerung?: { am: string; unlesbar?: boolean } | null;
  entwurfId: string | null;
  /** Die erneute Übernahme fand dieselbe Fassung schon als Wissensobjekt. */
  wissensobjektId: string | null;
  imWissenFreigegeben: boolean;
};
/** BPA-02 (Nacharbeit 5): bewusst gemerkte weitere Belege, gebunden an das angemeldete Konto. */
export type TechnikSammlung = { owner: string; quellen: TechnikQuelle[] };
export type TechnikSicht = {
  abschnitt: string;
  ziel: { objekt: string; variante: string };
  geprueft: boolean;
  belege: string[];
  sammlung: string[];
  ergebnis?: TechnikErgebnis;
  abgleich?: string[];
  klaerung?: boolean;
  /** Nacharbeit 8: die Quelle war gar nicht lesbar (nicht nur der Abschnitt fehlte). */
  klaerungUnlesbar?: boolean;
  link?: string;
  wissenLink?: string;
  imWissenFreigegeben?: boolean;
};
// ================================================================================================
// BPA-01 · DIE KONTEXTKARTE (`kontext.js`) — eine Seite und ihre Markierung, gebunden an Konto,
// Tab und Fassung. Der Vertrag selbst ist rein; der Worker hält seinen Zustand im Sitzungsspeicher.
// ================================================================================================
export type Konto = { mandant: string; nutzer: string; sitzung: string };
/**
 * `einmalig` ist das, was Chrome mit `activeTab` gewährt: dieser Tab, diese Herkunft, bis der Tab
 * eine andere Herkunft lädt oder geschlossen wird. `bereich` ist die eingerichtete Freigabe einer
 * Herkunft und die einzige, die fortgesetzte Beobachtung erlaubt.
 */
export type Freigabe =
  | { art: "einmalig"; tabId: number; url: string; erteiltAm: string }
  | { art: "bereich"; herkunft: string; erteiltAm: string };
export type Sperre = { grund: string; text: string; naechsterSchritt: string };
export type KartenTabelle = { zeilen: { kopf: boolean; zellen: string[] }[] };
export type Faehigkeit = { art: string; status: string; text: string; adresse?: string };
export type Erfassung = {
  quelle: "seite" | "assistenzfenster";
  tabId: number;
  url: string;
  titel: string;
  text: string;
  nodes?: Piece[];
  gaps?: Gap[];
  incognito?: boolean;
  frameId?: number;
  pdfUrl?: string;
  browser: { name: string; version: string };
  erweiterung: string;
};
export type Karte = {
  schema: string;
  folge: number;
  konto: Konto;
  host: { browser: string; version: string; erweiterung: string };
  tabId: number;
  url: string;
  titel: string;
  auswahl: { text: string; tabelle: KartenTabelle | null };
  fassung: string;
  erfasstAm: string;
  freigabe: "einmalig" | "bereich";
  faehigkeiten: Faehigkeit[];
  hinweise: string[];
  aktionen: string[];
  veraltet: boolean;
};
export type KontextImport = {
  draftId: string;
  url: string;
  herkunft: string;
  fassung: string;
  folge: number;
  verbindung: "aktiv" | "widerrufen";
};
export type KontextZustand = {
  konto: Konto;
  folge: number;
  karte: Karte | null;
  verlauf: { folge: number; url: string; titel: string; fassung: string }[];
  freigaben: Freigabe[];
  widerrufen: string[];
  importe: KontextImport[];
};
export type KontextZiel = { url: string; tabId: number; incognito?: boolean; frameId?: number };
export type KontextZugang =
  | { erlaubt: true; freigabe: Freigabe; sperre?: undefined }
  | { erlaubt: false; sperre: Sperre; freigabe?: undefined };
/**
 * `dokument`: der Tab lädt ein neues Dokument, dessen Adresse die Erweiterung nicht sieht. Die
 * Karte endet; über die Freigabe entscheidet Chrome beim nächsten Lesen selbst.
 */
export type KontextWechsel =
  | { art: "tab" | "geschlossen" | "dokument"; tabId: number }
  | { art: "navigation"; tabId: number; url: string };
export type KontextAntwort = { folge: number; tabId: number; konto: Konto; fassung: string };
export type KontextFrisch = { tabId: number; url: string; text: string; nodes?: Piece[] };
export type KontextAnzeige = {
  browser: string;
  seite: string;
  domain: string;
  auswahl: string;
  tabelle: boolean;
  erfasstAm: string;
  fassung: string;
  veraltet: boolean;
  nichtGeliefert: string[];
};
export type KontextApi = {
  SCHEMA: string;
  fassung(text: string): string;
  auswahlFassung(text: string, tabelle: KartenTabelle | null): string;
  tabelle(nodes: Piece[]): KartenTabelle | null;
  sperrText(grund: string, sprache: string): { text: string; naechsterSchritt: string } | null;
  sitzung(konto: Konto, folge?: number): KontextZustand;
  zugang(zustand: KontextZustand, ziel: KontextZiel): KontextZugang;
  beobachtenErlaubt(zustand: KontextZustand, url: string): boolean;
  freigeben(zustand: KontextZustand, freigabe: Freigabe): KontextZustand;
  binden(
    zustand: KontextZustand,
    erfassung: Erfassung,
    jetzt: string,
  ): { zustand: KontextZustand; karte: Karte | null; sperre: Sperre | null };
  wechseln(zustand: KontextZustand, ereignis: KontextWechsel): KontextZustand;
  kontoWechseln(zustand: KontextZustand, konto: Konto): KontextZustand;
  kontoZuordnen(zustand: KontextZustand, konto: Konto): KontextZustand;
  antwortPruefen(
    zustand: KontextZustand,
    antwort: KontextAntwort,
  ): { zustellen: boolean; grund: string; einfuegeziel: { tabId: number; url: string } | null };
  abgleichen(
    zustand: KontextZustand,
    frisch: KontextFrisch,
  ): { zustand: KontextZustand; aktuell: boolean; sperre: Sperre | null; neueFassung: string };
  uebermittlung(zustand: KontextZustand): {
    erlaubt: boolean;
    sperre: Sperre | null;
    daten: {
      schema: string;
      folge: number;
      konto: Konto;
      host: Karte["host"];
      url: string;
      titel: string;
      fassung: string;
      erfasstAm: string;
      inhaltsrolle: string;
      auswahl: { text: string; tabelle: KartenTabelle | null };
    } | null;
  };
  auswahlFuerFrage(auswahl: { text: string; tabelle: KartenTabelle | null }): string | null;
  erklaerungAus(roh: unknown): Erklaerungsinhalt;
  quellenAdresse(koId: string): string | null;
  erklaerungsText(schluessel: string, sprache: string): string;
  begleiterHallo(angaben: { nonce: string; erweiterung: string; nutzer: string }): object;
  begleiterAntwort(
    roh: unknown,
    nonce: string,
  ): { ok: true; version: string; macos: string; protokoll: number } | { ok: false; grund: string };
  begleiterKarte(karte: Karte): object;
  begleiterQuittung(roh: unknown, karte: Karte): boolean;
  anzeige(karte: Karte): KontextAnzeige;
  importMerken(zustand: KontextZustand, draftId: string): KontextZustand;
  widerrufen(zustand: KontextZustand, domain: string): KontextZustand;
};
/**
 * Die Bindung an den vorhandenen Klara-Kern (`POST /api/klara/sessions`). `folge`/`fassung` sagen,
 * zu WELCHER Karte die Kernsitzung zuletzt bestätigt wurde; passt keine, gilt sie nicht als
 * verbunden. Die Kennungen sind opak und kommen vom Server.
 */
export type Kern = {
  instanz: string;
  sessionId: string;
  documentContextId: string;
  folge: number;
  fassung: string;
  url: string;
};
/**
 * Klaras Antwort auf „Erkläre mir diese Angaben" — gebunden an Folge, Fassung und Tab der Karte,
 * zu der sie gestellt wurde. `text: null` heisst: der Kern hat keine Antwort geliefert.
 */
export type KontextErklaerung = {
  folge: number;
  fassung: string;
  tabId: number;
  url: string;
} & Erklaerungsinhalt;
/** Eine Quelle der Antwort — tragend (mit Titel, Fassung, Prüfstand) oder nur herangezogen. */
export type ErklaerungsQuelle = {
  koId: string;
  titel: string | null;
  version: number | null;
  validiert: boolean | null;
  tragend: boolean;
};
/**
 * Der gemeinsame Quellen- und Belegvertrag des Ausführungswegs, so wie die Leiste ihn zeigt:
 * Antwort, Lage und Gründe der Belastbarkeit, Einschränkungen, Quellen und die Zuordnung der
 * Absätze zu ihren Quellen.
 */
export type Erklaerungsinhalt = {
  text: string | null;
  answerId: string | null;
  beantwortet: boolean;
  lage: string | null;
  gruende: string[];
  vorbehalt: boolean;
  konflikt: boolean;
  konfliktUnbekannt: boolean;
  quellen: ErklaerungsQuelle[];
  absaetze: { text: string; quellen: string[] }[];
};
/** Die Antwort des Workers an die Leiste zum Kontext — nie eine `View` der Übernahme. */
export type KontextSicht = {
  kontext: true;
  status: string;
  angemeldet: boolean;
  karte: KontextAnzeige | null;
  sperre: string | null;
  verbunden: boolean;
  beobachtung: boolean;
  importe: { herkunft: string; verbindung: string }[];
  /** Gibt es etwas zu stoppen (Karte, Freigabe, Kernsitzung, laufender Schritt)? */
  widerrufbar: boolean;
  /** Läuft gerade Verbinden oder Erklären? */
  laeuft: boolean;
  /** Nur die Antwort, die zur AKTUELLEN Karte und Fassung gehört. */
  antwort: (Erklaerungsinhalt & { fassung: string }) | null;
  /** AC10: der Begleiter auf diesem Mac — verbunden (mit Fassungen) oder der letzte Fehler. */
  begleiter: {
    verbunden: boolean;
    version: string;
    macos: string;
    uebergeben: boolean;
    fehler: string;
  } | null;
};
/** AC10: was der Worker über die Begleiter-Verbindung festhält. */
export type BegleiterStand = {
  version: string;
  macos: string;
  protokoll: number;
  verbundenAm: string;
  /** Folge der Karte, die der Begleiter angenommen hat; `-1` = keine. */
  folge: number;
  fassung: string;
  fehler: string;
};
/** Der Native-Messaging-Kanal zu Chromes Host (`chrome.runtime.connectNative`). */
export type NativePort = {
  postMessage(nachricht: object): void;
  disconnect(): void;
  onMessage: {
    addListener(fn: (nachricht: unknown) => void): void;
    removeListener(fn: (nachricht: unknown) => void): void;
  };
  onDisconnect: {
    addListener(fn: () => void): void;
    removeListener(fn: () => void): void;
  };
};
export type State = {
  auth?: Auth | null;
  work?: Work | null;
  captureStatus?: string | null;
  sourceChangedId?: string;
  pendingCapture?: boolean;
  technik?: Technik | null;
  technikSammlung?: TechnikSammlung | null;
  kontext?: KontextZustand | null;
  kontextSperre?: Sperre | null;
  kern?: Kern | null;
  /** Steigt mit jedem Widerruf; ein Schritt, der unter einer älteren Epoche begann, wirkt nicht. */
  kontextEpoche?: number;
  kontextAntwort?: KontextErklaerung | null;
  begleiter?: BegleiterStand | null;
  /** BPA-03: der laufende oder zuletzt gegebene Browserauftrag dieser Leiste. */
  aktion?: AktionZustand | null;
};
// ================================================================================================
// BPA-03 · BERECHTIGTE FUNKTIONEN AUF DER SEITE — was Worker und Leiste vom Aktionskern kennen.
// ================================================================================================
/** Ein Schritt des Kerns für die Seite: genau eine Handlung von `aktion.js`. */
export type AktionBefehl = {
  nr: number;
  art: "lage" | "fuelle" | "klicke" | "loesche";
  tabId: number;
  args: Record<string, unknown>;
  /** Welche Teile der Adresse das Ziel binden (Seitenprofil): Abfrageparameter, Anker. */
  adresse?: { parameter: string[]; anker: boolean };
  /** Schon einmal abgeholt: ohne gemerkte Antwort wird er nicht ausgeführt. */
  wiederholt?: boolean;
};
export type AktionSchritt = {
  nr: number;
  aktionskennung: string;
  art: string;
  feld: string | null;
  knopf: string | null;
  stand: string;
  beleg: string | null;
};
/** Die Sicht des Kerns auf einen Browserauftrag (`BrowserAuftragSicht` am Server), nur gelesen. */
export type AuftragSicht = {
  id: string;
  quelle: string;
  wortlaut: string;
  ort: string;
  formular: string | null;
  stand: string;
  erfolg: boolean;
  text: string;
  schritte: AktionSchritt[];
  ergebnis: { entwurfId: string; nachgelesen: boolean; zurueckgenommen: boolean } | null;
  klaerung: string | null;
  uebergabe: { grund: string; schritt: string } | null;
  bestaetigung: { knopf: string; bestaetigtAm: string } | null;
  bedarf: {
    knopf: string;
    text: string;
    fingerabdruck: string;
    werte: { label: string; wert: string }[];
  } | null;
  ruecknahme: { art: string; text: string; am: string } | null;
  ruecknahmeAngebot: string | null;
  host: { browser: string; version: string; erweiterung: string; adapter: string };
  laeuft: boolean;
  steuerbar: boolean;
};
export type AktionZustand = {
  id: string | null;
  vorgang: string;
  tabId: number;
  url: string;
  /** Die Widerrufsepoche (BPA-01) beim Start: ändert sie sich, trägt die Freigabe nicht mehr. */
  epoche: number;
  nutzer: string;
  folge: number;
  sicht: AuftragSicht | null;
  klaerung: string | null;
  fehler: string | null;
  /** Die Nummer, deren Ausführung begonnen hat (vor der Ausführung gemerkt). */
  ausfuehrend?: number | null;
  /** Der zuletzt ausgeführte Befehl und seine Antwort — dieselbe Nummer wird nie zweimal ausgeführt. */
  erledigt: {
    nr: number;
    ergebnis: unknown;
    seite: { recht?: string; grund?: string; adapter?: string } | null;
  } | null;
  laeuft: boolean;
};
export type AktionSicht = {
  aktion: true;
  status: string;
  angemeldet: boolean;
  ziel: { url: string } | null;
  laeuft: boolean;
  klaerung: string | null;
  fehler: string | null;
  auftrag: AuftragSicht | null;
};
export type View = {
  status: string;
  captureId?: string;
  selection?: Selection | undefined;
  variants?: Variants | undefined;
  mode?: Mode | "" | undefined;
  aiChat?: boolean;
  preview?: Piece[] | undefined;
  gaps?: Gap[] | undefined;
  form?: Form | undefined;
  user?: { id: string; email: string } | undefined;
  link?: string | undefined;
  sourceChanged?: boolean;
  attempted?: boolean;
  pendingCapture?: boolean;
  /** JOB 3280: DASS ein Entwurf existiert — ohne Adresse. Der Link entsteht nur aus `link`. */
  draftId?: string;
  /** JOB 3280 R3: DASS eine Anlage unklar ist — und der Inhalt deshalb bis zur Klärung still steht. */
  unresolvedCreate?: boolean;
  /** BPA-02: die markierte Tabelle dieser Übernahme, ihr Prüfergebnis und der Entwurfslink. */
  technik?: TechnikSicht;
};
export type Message = {
  type: string;
  captureId?: string;
  mode?: string;
  form?: Partial<Form>;
  /** JOB 3280 · CHR-06: der eingefügte und in der Leiste bearbeitete Text. */
  text?: string;
  email?: string;
  password?: string;
  /** BPA-02: Erfassungsziel und Schutzklasse der technischen Daten (leer = unbekannt). */
  ziel?: { objekt?: string; variante?: string };
  schutzklasse?: string;
  /** BPA-02 (Nacharbeit 5): die Art des aktuellen Belegs — `html` oder `datenblatt`. */
  art?: string;
  /** BPA-01: die Sprache der Leiste für Klaras Antwort (`de`/`en`). */
  sprache?: string;
  /** BPA-03: der Auftrag in den Worten der Person, seine Quelle und sein Vorgangsschlüssel. */
  wortlaut?: string;
  quelle?: string;
  vorgang?: string;
  /** BPA-03: woran die Außenaktionsbestätigung gebunden ist. */
  fingerabdruck?: string;
};
export type Payload = {
  title: string;
  statement: string;
  bodyHtml: string;
  /**
   * JOB 3280: `url` ist OPTIONAL. Beim eingefügten Text gibt es keine belegbare Quelladresse; der
   * offene Tab ist nicht die Quelle. Ein Feld, das dann leer BLIEBE, wäre ehrlicher als eines,
   * das die falsche Adresse trägt — und der Serververtrag lässt es weg
   * (`services/capture/src/types.ts:56-63`, `url?`).
   */
  pendingSources: { label: string; url?: string; excerpt: string; sourceProvider: string }[];
  confidentiality?: string;
};
export type Wire = {
  token?: string;
  user?: { id?: string; email?: string };
  id?: string;
  originalAuthor?: string;
  /** JOB 3280: der Stand des Entwurfs — Grundlage von `expectedUpdatedAt` beim nächsten PUT. */
  updatedAt?: string;
  payload?: Partial<Payload>;
};
export type ConfirmedDraft = Wire & { id: string };
/** Das Ergebnis des Inhaltsskripts — Seitendaten, also niemals ungeprüft weiterverwendet. */
export type CaptureResult = {
  text: string;
  title: string;
  url: string;
  variants?: Partial<Record<string, unknown>>;
  /** BPA-02: die sichtbaren Tabellen und die Stelle der markierten (−1 = keine). */
  tabellen?: unknown[];
  tabelleGewaehlt?: unknown;
};
type Tab = { id?: number; url?: string; title?: string; incognito?: boolean };
type Click = {
  menuItemId: string | number;
  pageUrl?: string;
  frameUrl?: string;
  frameId?: number;
  selectionText?: string;
};
type Event<Callback> = { addListener(callback: Callback): void };
declare global {
  var KLARA_TEXT: Record<string, Record<string, string>>;
  /** BPA-03: die Texte des Abschnitts „Auf dieser Seite ausführen“ (i18n.js). */
  var KLARA_AKTION_TEXT: Record<string, Record<string, string>>;
  /** BPA-01: der Kontextvertrag aus `kontext.js`; fehlt er, bindet die Erweiterung keinen Kontext. */
  var KlaraKontext: KontextApi | undefined;
  const chrome: {
    runtime: {
      id: string;
      getURL(path: string): string;
      getManifest?(): { version: string };
      /**
       * AC10: nur vorhanden, wenn das optionale Recht `nativeMessaging` erteilt ist. Chrome startet
       * dann den registrierten Host, wenn dessen Manifest diese Erweiterung zulässt.
       */
      connectNative?(host: string): NativePort;
      onInstalled: Event<() => void>;
      onMessage: Event<
        (
          message: Message,
          sender: { id?: string; url?: string; tab?: Tab },
          respond: (view: View) => void,
        ) => boolean
      >;
      sendMessage(message: Message): Promise<View>;
    };
    storage: {
      session: {
        get(key: null): Promise<State>;
        set(state: Partial<State>): Promise<void>;
        clear(): Promise<void>;
        setAccessLevel(options: { accessLevel: "TRUSTED_CONTEXTS" }): Promise<void>;
      };
      /**
       * JOB 3279 (Pedi 08.09., Vorführung live umschaltbar): NUR die Sprachwahl der Leiste.
       * Kein Inhalt, keine Auswahl, keine Anmeldung — die bleiben flüchtig in `session`.
       */
      local: {
        get(defaults: { language: string | null }): Promise<{ language?: string | null }>;
        set(values: { language: string }): Promise<void>;
      };
      onChanged: Event<
        (
          changes: {
            auth?: { newValue?: Auth };
            work?: { newValue?: Work };
            sourceChangedId?: { newValue?: string };
            /** JOB 3279 R2: das Erfassungsergebnis und die wartende Übernahme melden sich mit. */
            captureStatus?: { newValue?: string | null };
            pendingCapture?: { newValue?: boolean };
            /** BPA-01: Karte, Sperre und Kernbindung melden sich; die Leiste liest sie neu. */
            kontext?: { newValue?: unknown };
            kontextSperre?: { newValue?: unknown };
            kern?: { newValue?: unknown };
            kontextAntwort?: { newValue?: unknown };
            begleiter?: { newValue?: unknown };
          },
          area: string,
        ) => void
      >;
    };
    action: { onClicked: Event<(tab: Tab) => void> };
    contextMenus: {
      onClicked: Event<(info: Click, tab?: Tab) => void>;
      removeAll(): Promise<void>;
      create(properties: {
        id: string;
        title: string;
        contexts: string[];
        documentUrlPatterns: string[];
      }): void;
    };
    scripting: {
      executeScript(options: { target: { tabId: number }; files: string[] }): Promise<
        { result?: CaptureResult }[]
      >;
      /** BPA-03: genau eine Handlung des Seitenausführers in derselben isolierten Welt. */
      executeScript<A extends unknown[], R>(options: {
        target: { tabId: number };
        func: (...args: A) => R;
        args: A;
      }): Promise<{ result?: R }[]>;
    };
    // JOB 3278 · CHR-02: the panel is a side panel, so the worker no longer creates tabs. Only
    // `open` and `setPanelBehavior` are declared — `setOptions` is deliberately absent, because a
    // per-tab panel would lose the original source on a tab switch.
    sidePanel: {
      open(options: { tabId: number }): Promise<void>;
      setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void>;
    };
    tabs: {
      onActivated: Event<(info: { tabId: number }) => void>;
      onUpdated: Event<(tabId: number, info: { url?: string; status?: string }) => void>;
      /** Optional, weil ältere Prüfstände ihn nicht stellen; Chrome liefert ihn immer. */
      onRemoved?: Event<(tabId: number) => void>;
      /** BPA-03: ob der Tab des Auftrags noch da ist (wirft, wenn nicht). */
      get(tabId: number): Promise<{ id?: number; url?: string; incognito?: boolean }>;
    };
    i18n: { getMessage(key: string): string };
  };
}
