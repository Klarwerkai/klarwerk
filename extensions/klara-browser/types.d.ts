export type Form = { title: string; context: string; confidentiality: string };
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
/** Die drei bewussten Umfänge. Ein vierter entsteht nicht aus Versehen. */
export type Mode = "selection" | "article" | "page";
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
  receipt: string | null;
};
export type State = {
  auth?: Auth | null;
  work?: Work | null;
  captureStatus?: string | null;
  sourceChangedId?: string;
  pendingCapture?: boolean;
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
};
export type Message = {
  type: string;
  captureId?: string;
  mode?: string;
  form?: Form;
  email?: string;
  password?: string;
};
export type Payload = {
  title: string;
  statement: string;
  bodyHtml: string;
  pendingSources: { label: string; url: string; excerpt: string; sourceProvider: string }[];
  confidentiality?: string;
};
export type Wire = {
  token?: string;
  user?: { id?: string; email?: string };
  id?: string;
  originalAuthor?: string;
  payload?: Partial<Payload>;
};
export type ConfirmedDraft = Wire & { id: string };
/** Das Ergebnis des Inhaltsskripts — Seitendaten, also niemals ungeprüft weiterverwendet. */
export type CaptureResult = {
  text: string;
  title: string;
  url: string;
  variants?: Partial<Record<string, unknown>>;
};
type Tab = { id?: number; url?: string; title?: string };
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
  const chrome: {
    runtime: {
      id: string;
      getURL(path: string): string;
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
      onUpdated: Event<(tabId: number, info: { url?: string }) => void>;
    };
    i18n: { getMessage(key: string): string };
  };
}
