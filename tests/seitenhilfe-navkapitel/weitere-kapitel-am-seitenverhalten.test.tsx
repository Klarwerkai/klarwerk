// @vitest-environment jsdom
// ================================================================================================
// JOB 3795 — DREI WEITERE KAPITEL WERDEN AM VERHALTEN IHRER EIGENEN SEITE BELEGT.
// ================================================================================================
//
// DIE BESTELLUNG (`archiv/3741/runde-4/RUECKGABE.md:94`, woertlich): die Kapitel `/konflikte`,
// `/output` und `/graph` tragen „Zuordnungs-, Uebersetzungs-, DOM- und Suchbeleg, aber KEINEN
// gemounteten Verhaltensbeleg ihrer jeweiligen Seite".
//
// WARUM DAS KEIN FORMALISMUS IST: dieselbe Pruefung hat in JOB 3741 Runde 1 DREI von drei
// untersuchten Texten als falsch entlarvt (Themenkarte unter 900 px gar nicht vorhanden; „liegt das
// an deiner Rolle" falsch; „danach rueckt der naechste nach" frei erfunden). Ein Erklaersatz, der
// etwas verspricht, was die Seite nicht tut, ist fuer einen Neuling schlimmer als gar keiner — er
// sucht dann einen Knopf, den es nicht gibt.
//
// DIE BAUFORM IST DIE DES NACHBARN `die-texte-stimmen-mit-der-seite.test.tsx`: je Behauptung stehen
// ZWEI Dinge nebeneinander — das gemessene Verhalten der GEMOUNTETEN Seite UND der Satz, der es
// beschreibt. Der Satz wird dabei aus dem heutigen Bestand GELESEN (`behauptung()` unten), nicht
// abgeschrieben; verschwindet eine Behauptung aus dem Kapitel, faellt GENAU ihr Fall rot auf und
// nennt Route und Behauptung (Lehre JOB 3587 R4: ein Zaehlwaechter, der Einzelentfernungen nicht
// bemerkt, ist kein Waechter).
//
// WAS DIESE DATEI AUSDRUECKLICH NICHT WIEDERHOLT:
//   · `zahnrad-zeigt-den-erklaersatz.test.tsx` montiert das KOPFBAND und liest, dass Titel und Text
//     der Route dort STEHEN. Hier wird die SEITE montiert und gemessen, ob der Text STIMMT.
//   · `tests/wissensgraph-lesbarkeit/graph-lesbarkeit.test.tsx` belegt das Verhalten des Graphen
//     fuer sich (eindeutige Beschriftungen, Trefferflaechen, Ladezustaende). Neu ist hier allein die
//     BINDUNG dieses Verhaltens an `help.graph.body`.
//
// DREI SAETZE STIMMEN NICHT OHNE BEDINGUNG — sie werden hier gemessen und als Nachfuehr-Pin
// festgehalten, NICHT repariert (`i18n.ts` ist in diesem Takt von anderen Auftraegen gehalten):
// KF1d (die dritte Wahl gibt es nur am automatisch erkannten Konflikt), KF1e (das entschiedene Paar
// verschwindet vom Brett) und GF3d (Klick und Tastatur fuehren nur zu BEKANNTEN Objekten).
//
// RUNDE 2 · KORREKTURPFLICHT 1 (BEN): GF3b und GF3c verglichen die angekommene Adresse gegen
// `koDetailPath(<id>)` — gegen dieselbe Produktfunktion also, aus der die Seite ihr Ziel baut. BEN
// hat `lib/graphNav.ts:8` auf `/wissen/falsches-objekt` umgebogen: beide Seiten des Vergleichs
// bewegten sich mit, die Faelle blieben gruen, JEDER Knoten fuehrte zum falschen Objekt. Seit
// dieser Runde kommt der Sollwert allein aus dem Pruefstand (`kennungImBestand`), das Produkt wird
// dafuer nicht mehr importiert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// Der Stand „auf der Serverseite" — EINE Ablage, die alle drei Seiten teilen. Die Entscheidung auf
// `/konflikte` SCHREIBT hier hinein, und derselbe Abruf liest danach neu aus: nur so ist „vorher"
// und „nachher" das Ergebnis einer AUSGEFUEHRTEN Operation und nicht zweier im Test
// ausgeschriebener Listen (Lehre 3741 R3, Korrekturpflicht 1).
// ------------------------------------------------------------------------------------------------
const d = vi.hoisted(() => {
  type Satz = Record<string, unknown>;
  const s: {
    kos: Satz[];
    konflikte: Satz[];
    quellen: Satz[];
    knoten: { id: string; title: string }[];
    kanten: { a: string; b: string; via: string }[];
  } = { kos: [], konflikte: [], quellen: [], knoten: [], kanten: [] };
  const kopie = (l: readonly Satz[]): Satz[] => l.map((x) => ({ ...x }));

  return {
    setze: (teil: Partial<typeof s>): void => {
      Object.assign(s, { kos: [], konflikte: [], quellen: [], knoten: [], kanten: [] }, teil);
    },
    lies: (): typeof s => ({
      kos: kopie(s.kos),
      konflikte: kopie(s.konflikte),
      quellen: kopie(s.quellen),
      knoten: [...s.knoten],
      kanten: [...s.kanten],
    }),
    /** `GET /api/kos` — der Bestand, ungefiltert. */
    koListe: vi.fn(async () => kopie(s.kos)),
    /**
     * `GET /api/conflicts` — der Server gibt `unresolved()` aus, also NUR die offenen
     * (`services/app/src/routes/conflicts-routes.ts:222-227`, `services/conflicts/src/service.ts:549`).
     * Genau diese Filterung ist der Grund, aus dem KF1e ueberhaupt etwas zu messen hat.
     */
    konfliktListe: vi.fn(async () => kopie(s.konflikte).filter((c) => c.status !== "geloest")),
    /**
     * `PUT /api/kos/:id` mit `{action:"resolve-conflict"}` — die Entscheidung. Sie schreibt
     * Status, Entscheidung und Entscheider an den Konflikt und entfernt NICHTS
     * (`services/conflicts/src/service.ts:189-199`).
     */
    koAkt: vi.fn(
      async (id: string, body: { action?: string; conflictId?: string; decision?: string }) => {
        if (body.action !== "resolve-conflict") {
          throw new Error(`Pruefstand: unerwartete Aktion ${String(body.action)}`);
        }
        const k = s.konflikte.find((c) => c.id === body.conflictId);
        if (!k) {
          throw new Error(`Pruefstand: kein Konflikt ${String(body.conflictId)}`);
        }
        k.status = "geloest";
        k.decision = body.decision;
        k.decidedBy = "u1";
        k.resolutionReason = "decided";
        return { ...(s.kos.find((x) => x.id === id) ?? {}) };
      },
    ),
    /** `GET /api/output/sources`. */
    quellenListe: vi.fn(async () => kopie(s.quellen)),
    /** `POST /api/output/generate` — erzeugt das Dokument (und erst dieser Schritt tut es). */
    erzeuge: vi.fn(async (body: { kind: string; koIds: string[] }) => ({
      kind: body.kind,
      title: `Dokument ${body.kind}`,
      audienceRole: "admin",
      generatedAt: "2026-09-12T09:00:00.000Z",
      markdown: `# Dokument\n${body.koIds.join("\n")}`,
      provenance: body.koIds.map((koId) => {
        const q = s.quellen.find((x) => x.id === koId);
        return {
          koId,
          title: String(q?.title ?? koId),
          status: "validiert",
          trust: Number(q?.trust ?? 0),
          version: Number(q?.version ?? 1),
          validity: "gueltig",
          uncertain: false,
        };
      }),
    })),
    /** `GET /api/graph`. */
    graphAbruf: vi.fn(async () => ({ nodes: [...s.knoten], edges: [...s.kanten] })),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // `admin`: `/output` und `/graph` sind `minRole: "admin"` UND `stufe2: true`
    // (`app/navigation.ts:299-306`, `:324-332`) — jede andere Rolle saehe die Seiten gar nicht.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  // Alles, was diese Faelle NICHT messen, antwortet leer — aber es antwortet. Ohne den Rueckfall
  // stuerzten die Reiterkoepfe an der ersten unbekannten Ecke ab, und der Fall maesse nichts.
  const leer = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(ziel, name, empfaenger) {
          if (name in ziel || typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          return leer();
        },
      },
    );
  const mit = (echt: Record<string, unknown>): unknown =>
    new Proxy(echt, {
      get(ziel, name, empfaenger) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empfaenger);
        }
        return leer();
      },
    });
  return {
    endpoints: mit({
      conflicts: mit({ list: d.konfliktListe }),
      ko: mit({ list: d.koListe, act: d.koAkt }),
      library: mit({ graph: d.graphAbruf }),
      output: mit({ sources: d.quellenListe, generate: d.erzeuge }),
      // Der KI-Deckel-Vorbehalt im „?"-Menue der Pruefseite liest ein OBJEKT, keine Liste.
      aiCheck: mit({
        coverageSummary: vi.fn(async () => ({
          total: 2,
          incomplete: 0,
          unchecked: 0,
          noCoverage: 0,
        })),
      }),
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, type NavItem, canSee, roleAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
// KEIN Import von `koDetailPath`: die produktive Pfadfunktion darf hier nicht zugleich den Weg und
// den Erwartungswert liefern (BEN 3795 R1, Korrekturpflicht 1 — siehe `kennungImBestand` unten).
import { OUTPUT_KIND_OPTIONS } from "../../apps/web/src/lib/outputDoc";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { GraphView, Output } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Der persistierte Stufe-2-Umschalter (`lib/stufe2Storage.ts:7`). Admin + an ⇒ beide Seiten da. */
const STUFE2_KEY = "kw.stufe2.v1";

type KapitelId = "konflikte" | "output" | "graph";

/** Der hinterlegte deutsche Wert EINER Zeichenkette — gelesen, nicht abgeschrieben. */
function wert(key: string): string {
  return String(i18n.getResource("de", "translation", key) ?? "");
}

/** Der Kapiteltext, wie er HEUTE hinterlegt ist. */
function kapitel(id: KapitelId): string {
  return wert(`help.${id}.body`);
}

/**
 * Die Behauptung, die dieser Fall am Seitenverhalten misst — sie muss woertlich im heutigen
 * Kapiteltext stehen. Faellt sie dort weg, wird GENAU dieser Fall rot und nennt Route und
 * Behauptung; ein Fall, dessen Satz gar nicht mehr da ist, misst nichts mehr (Lieferung 5).
 */
function behauptung(route: string, id: KapitelId, satzteil: string): void {
  expect(
    kapitel(id),
    `${route}: die Behauptung „${satzteil}“ steht nicht mehr in help.${id}.body — dieser Fall misst sie am Seitenverhalten und misst ohne sie nichts`,
  ).toContain(satzteil);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function abbauen(): void {
  if (!steht) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  steht = false;
}

/** Die Sonde auf der Detailroute: sie zeigt, WOHIN navigiert wurde (Bauform aus der Graph-Suite). */
function Sonde(): JSX.Element {
  const { id } = useParams();
  return createElement("div", { "data-testid": "sonde" }, id ?? "");
}

/**
 * Die ECHTE Seite mit den Anbietern, die sie braucht — Attrappe ist allein die Endpunktgrenze.
 * `mitZiel` haengt die Detailroute daneben, damit ein Klick ein MESSBARES Ziel hat.
 */
async function montiere(seite: () => JSX.Element, pfad: string, mitZiel = false): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const inhalt = mitZiel
    ? createElement(
        Routes,
        null,
        createElement(Route, { path: pfad, element: createElement(seite) }),
        createElement(Route, { path: "/wissen/:id", element: createElement(Sonde) }),
      )
    : createElement(seite);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: [pfad] }, inhalt),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Durchlaeufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
  steht = true;
}

async function klicke(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

// ------------------------------------------------------------------------------------------------
// Der Bestand: zwei Wissensobjekte, die sich widersprechen, und ein drittes daneben.
// ------------------------------------------------------------------------------------------------
const AUSSAGE_A = "Der Filter wird alle 14 Tage gewechselt.";
const AUSSAGE_B = "Der Filter wird alle 30 Tage gewechselt.";
const TITEL_A = "Wartungsplan Nord";
const TITEL_B = "Wartungsplan Sued";
const TITEL_C = "Filterwechsel Werk 3";

const ko = (id: string, titel: string, aussage: string): Record<string, unknown> => ({
  id,
  title: titel,
  statement: aussage,
  status: "validiert",
  category: "Technik",
  type: "regel",
  trust: 80,
  confidence: 70,
  version: 2,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", TITEL_A, AUSSAGE_A),
  ko("ko-b", TITEL_B, AUSSAGE_B),
  ko("ko-c", TITEL_C, "Der Filter wird nach Betriebsstunden gewechselt."),
];

/**
 * Ein automatisch erkannter Konflikt, so wie `services/conflicts/src/service.ts:115-133` ihn
 * schreibt. NUR dieser Zweig bekommt auf der Flaeche die vierte Schaltflaeche „Kein Widerspruch"
 * (`canDismiss`, `lib/conflictBoard.ts:43-45`) — daran haengt KF1d.
 */
const konfliktAuto = (id: string, typ: string): Record<string, unknown> => ({
  id,
  koA: "ko-a",
  koB: "ko-b",
  type: typ,
  description: "Automatisch erkannt: unterschiedliche Fristen fuer denselben Vorgang.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  origin: "auto",
  detector: {
    trigger: "background",
    method: "model",
    confidence: 0.9,
    rationale: "Beide Aussagen nennen unterschiedliche Fristen fuer denselben Vorgang.",
  },
  createdAt: "2026-08-01T06:00:00.000Z",
});

/**
 * Der von Hand angelegte Konflikt: `origin: "manual"`, kein `detector`
 * (`services/conflicts/src/service.ts:79-96`).
 */
const KONFLIKT_MANUELL: Record<string, unknown> = {
  ...konfliktAuto("c-manuell", "truth"),
  description: "Die eine Angabe nennt 14 Tage, die andere 30 — beide berufen sich auf den Plan.",
  origin: "manual",
  detector: undefined,
  createdBy: "u1",
};

/**
 * ZWEI Konflikte ueber DEMSELBEN Paar, mit verschiedener Art. Das ist kein Kunstgriff: der Dienst
 * kennt keine Entduplizierung (`service.ts:79-98` fuegt jeden Eingang ein), und zwei Objekte
 * koennen sich in mehr als einem Punkt widersprechen. Der zweite Konflikt ist es, der nach der
 * ausgefuehrten Entscheidung in KF1c beweist, dass BEIDE Wissensobjekte noch gezeichnet werden.
 */
const ZWEI_KONFLIKTE = [konfliktAuto("c-wahrheit", "truth"), konfliktAuto("c-kontext", "context")];

const QUELLEN = [
  {
    id: "q1",
    title: TITEL_A,
    status: "validiert",
    trust: 80,
    version: 3,
    category: "Technik",
    type: "regel",
  },
  {
    id: "q2",
    title: TITEL_C,
    status: "validiert",
    trust: 75,
    version: 1,
    category: "Technik",
    type: "regel",
  },
];

const KNOTEN = [
  { id: "ko-a", title: TITEL_A },
  { id: "ko-b", title: TITEL_B },
  { id: "ko-c", title: TITEL_C },
];
const KANTEN = [
  { a: "ko-a", b: "ko-b", via: "wartung" },
  { a: "ko-b", b: "ko-c", via: "filter" },
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.setItem(STUFE2_KEY, "1");
  // jsdom bringt kein `matchMedia` mit. Der Wert ist fuer GF3e beweglich (schmal/breit).
  setzeBreite(false);
});

afterEach(() => {
  abbauen();
  window.localStorage.removeItem(STUFE2_KEY);
  vi.clearAllMocks();
});

let istSchmal = false;
function setzeBreite(schmal: boolean): void {
  istSchmal = schmal;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    matches: istSchmal,
    media: abfrage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  (globalThis as unknown as { innerWidth: number }).innerWidth = schmal ? 360 : 1280;
}

// ================================================================================================
// L4 · DIE SICHTBARKEITSSCHALTER — unter welcher Bedingung die drei Seiten ueberhaupt erscheinen.
// ================================================================================================
describe("JOB 3795 L4 · die Bedingungen, unter denen gemessen wird", () => {
  function punkt(pfad: string): NavItem {
    const i = ALL_ITEMS.find((x) => x.path === pfad);
    if (!i) {
      throw new Error(`kein Menuepunkt ${pfad} — der Fall misst nichts`);
    }
    return i;
  }

  it("L4a: /output und /graph liegen hinter dem Stufe-2-Schalter; /konflikte nicht", () => {
    // Der Schalter entscheidet nicht nur ueber den Menuepunkt: `routes.tsx:187-190` ersetzt die
    // Seite bei ausgeschalteten Modulen durch `Stage2Notice` — ohne ihn gibt es die gemessene
    // Flaeche gar nicht. Alle Faelle unten laufen deshalb mit gesetztem `kw.stufe2.v1`.
    for (const pfad of ["/output", "/graph"]) {
      const i = punkt(pfad);
      expect(i.stufe2, `${pfad}: nicht mehr hinter dem Stufe-2-Schalter`).toBe(true);
      expect(roleAllows(i, "admin"), `${pfad}: die Rolle admin reicht nicht`).toBe(true);
      expect(canSee(i, "admin", false), `${pfad}: mit Schalter AUS sichtbar`).toBe(false);
      expect(canSee(i, "admin", true), `${pfad}: mit Schalter AN unsichtbar`).toBe(true);
    }
    const k = punkt("/konflikte");
    expect(k.stufe2 ?? false, "/konflikte haengt jetzt am Stufe-2-Schalter").toBe(false);
  });
});

// ================================================================================================
// KF1 · /konflikte — „Die Seite stellt die zwei Aussagen nebeneinander …"
// ================================================================================================
describe("JOB 3795 KF1 · /konflikte — was das Kapitel verspricht, tut die Seite", () => {
  it("KF1a: die zwei Aussagen stehen NEBENEINANDER — beide gleichzeitig im gezeichneten Paar", async () => {
    behauptung("/konflikte", "konflikte", "die zwei Aussagen nebeneinander");
    d.setze({ kos: KOS, konflikte: [konfliktAuto("c-wahrheit", "truth")] });
    await montiere(Conflicts, "/konflikte");

    const paar = marke("pruefen-paar");
    expect(paar, "/konflikte: die Seite zeichnet gar kein Kartenpaar").not.toBeNull();
    const links = marke("pruefen-paar-text-a");
    const rechts = marke("pruefen-paar-text-b");
    expect(links, "/konflikte: die linke Aussage ist gar nicht gezeichnet").not.toBeNull();
    expect(rechts, "/konflikte: die rechte Aussage ist gar nicht gezeichnet").not.toBeNull();
    expect(links?.textContent ?? "", "/konflikte: die linke Aussage fehlt").toContain(AUSSAGE_A);
    expect(rechts?.textContent ?? "", "/konflikte: die rechte Aussage fehlt").toContain(AUSSAGE_B);
    // „nebeneinander" heisst: BEIDE in DEMSELBEN gezeichneten Paar, nicht nacheinander.
    expect(paar?.contains(links as Node), "/konflikte: die linke Karte steht nicht im Paar").toBe(
      true,
    );
    expect(paar?.contains(rechts as Node), "/konflikte: die rechte Karte steht nicht im Paar").toBe(
      true,
    );
    expect(
      marke("pruefen-paar-karte-a")?.textContent,
      "/konflikte: die linke Karte nennt ihr Wissensobjekt nicht",
    ).toContain(TITEL_A);
    expect(
      marke("pruefen-paar-karte-b")?.textContent,
      "/konflikte: die rechte Karte nennt ihr Wissensobjekt nicht",
    ).toContain(TITEL_B);
  });

  it("KF1b: die angebotenen Wahlmoeglichkeiten sind genau die drei genannten — an den echten Beschriftungen", async () => {
    behauptung("/konflikte", "konflikte", "welche gilt");
    behauptung("/konflikte", "konflikte", "je nach Zusammenhang gelten");
    // Diese eine Wahl steht WOERTLICH als Beschriftung auf der Flaeche — sie wird deshalb gegen den
    // Bestand gebunden und nicht abgetippt.
    expect(
      kapitel("konflikte").toLowerCase(),
      `/konflikte: der Kapiteltext nennt die Beschriftung „${wert("con.side.none")}“ nicht`,
    ).toContain(wert("con.side.none").toLowerCase());

    d.setze({ kos: KOS, konflikte: [konfliktAuto("c-wahrheit", "truth")] });
    await montiere(Conflicts, "/konflikte");

    const band = marke("pruefen-aktionsband");
    expect(band, "/konflikte: es gibt gar kein Aktionsband").not.toBeNull();
    const knopf = (kennung: string): Element | null => marke(`pruefen-knopf-${kennung}`);
    expect(knopf("links-gilt")?.textContent, "/konflikte: „welche gilt“ (links) fehlt").toBe(
      wert("con.side.left"),
    );
    expect(knopf("rechts-gilt")?.textContent, "/konflikte: „welche gilt“ (rechts) fehlt").toBe(
      wert("con.side.right"),
    );
    expect(knopf("beide-gelten")?.textContent, "/konflikte: „beide gelten“ fehlt").toBe(
      wert("con.side.both"),
    );
    expect(knopf("kein-widerspruch")?.textContent, "/konflikte: „kein Widerspruch“ fehlt").toBe(
      wert("con.side.none"),
    );
    // Und es sind GENAU diese vier Schaltflaechen fuer die drei Wahlmoeglichkeiten — daneben steht
    // allein der Textlink „Zweitmeinung anfragen", der nichts entscheidet.
    const beschriftungen = [...(band?.querySelectorAll("button") ?? [])].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(beschriftungen, "/konflikte: das Aktionsband bietet etwas anderes an").toEqual([
      wert("con.side.left"),
      wert("con.side.right"),
      wert("con.side.both"),
      wert("con.side.none"),
      wert("con.secondOpinionAdd"),
    ]);
  });

  it("KF1c: nach einer AUSGEFUEHRTEN Entscheidung sind beide Wissensobjekte noch da, und ein Vermerk ist entstanden", async () => {
    behauptung("/konflikte", "konflikte", "als Vermerk festgehalten");
    behauptung("/konflikte", "konflikte", "gelöscht wird nichts");
    d.setze({ kos: KOS, konflikte: ZWEI_KONFLIKTE });
    await montiere(Conflicts, "/konflikte");

    // VORHER — aus dem Abruf der Seite, nicht aus dieser Datei.
    const vorher = [
      marke("pruefen-paar-karte-a")?.textContent ?? "",
      marke("pruefen-paar-karte-b")?.textContent ?? "",
    ];
    expect(vorher[0], "/konflikte: das linke Objekt ist vorher nicht gezeichnet").toContain(
      AUSSAGE_A,
    );
    expect(vorher[1], "/konflikte: das rechte Objekt ist vorher nicht gezeichnet").toContain(
      AUSSAGE_B,
    );
    expect(text(), "/konflikte: es liegen nicht zwei Befunde vor").toContain(
      i18n.t("pruefen.kVonN", { k: 1, n: 2 }),
    );

    // DIE ENTSCHEIDUNG — zwei echte Klicks auf der Seite: waehlen, dann speichern.
    await klicke(marke("pruefen-knopf-links-gilt"));
    const feld = container.querySelector("textarea");
    expect(feld, "/konflikte: die Entscheidung bietet kein Begruendungsfeld").not.toBeNull();
    expect(
      (feld as HTMLTextAreaElement).value,
      "/konflikte: die Begruendung ist nicht vorbelegt",
    ).toBe(i18n.t("con.prefill.side", { title: TITEL_A }));
    const speichern = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === wert("con.resolveConfirm"),
    );
    await klicke(speichern);

    // DER VERMERK — die Entscheidung hat den Server WIRKLICH erreicht und liegt am Konflikt.
    expect(
      d.koAkt,
      "/konflikte: die Entscheidung hat den Server gar nicht erreicht",
    ).toHaveBeenCalledWith("ko-a", {
      action: "resolve-conflict",
      conflictId: "c-wahrheit",
      decision: i18n.t("con.prefill.side", { title: TITEL_A }),
    });
    const entschieden = d.lies().konflikte.find((c) => c.id === "c-wahrheit");
    expect(entschieden?.decision, "/konflikte: kein Vermerk am Konflikt").toBe(
      i18n.t("con.prefill.side", { title: TITEL_A }),
    );
    expect(entschieden?.decidedBy, "/konflikte: der Vermerk nennt niemanden").toBe("u1");

    // NACHHER — wieder aus dem Abruf der Seite. GELOESCHT IST NICHTS: beide Wissensobjekte werden
    // weiter gezeichnet (jetzt am zweiten Befund desselben Paares), und beide Konflikte liegen noch
    // in der Ablage — der entschiedene mit seinem neuen Stand.
    const nachher = [
      marke("pruefen-paar-karte-a")?.textContent ?? "",
      marke("pruefen-paar-karte-b")?.textContent ?? "",
    ];
    expect(
      nachher[0],
      "/konflikte: das linke Wissensobjekt ist nach der Entscheidung weg",
    ).toContain(AUSSAGE_A);
    expect(
      nachher[1],
      "/konflikte: das rechte Wissensobjekt ist nach der Entscheidung weg",
    ).toContain(AUSSAGE_B);
    expect(
      d.lies().kos.map((k) => k.id),
      "/konflikte: die Entscheidung hat ein Wissensobjekt geloescht",
    ).toEqual(["ko-a", "ko-b", "ko-c"]);
    expect(
      d.lies().konflikte.map((c) => c.id),
      "/konflikte: die Entscheidung hat den Konflikt geloescht statt ihn zu vermerken",
    ).toEqual(["c-wahrheit", "c-kontext"]);
  });

  it("KF1d · NACHFUEHR-PIN: die dritte Wahl gibt es NUR am automatisch erkannten Konflikt", async () => {
    // GEMESSEN, nicht vermutet: `canDismiss` (`lib/conflictBoard.ts:43-45`) gibt nur fuer
    // `origin === "auto"` wahr. Am VON HAND angelegten Konflikt fehlt „Kein Widerspruch" also —
    // waehrend `help.konflikte.body` die Wahl ohne jede Bedingung verspricht.
    d.setze({ kos: KOS, konflikte: [KONFLIKT_MANUELL] });
    await montiere(Conflicts, "/konflikte");
    expect(
      marke("pruefen-knopf-links-gilt"),
      "/konflikte: der manuelle Fall zeichnet kein Band",
    ).not.toBeNull();
    expect(
      marke("pruefen-knopf-kein-widerspruch"),
      "/konflikte: „Kein Widerspruch“ steht jetzt AUCH am manuellen Konflikt — dann ist der Kapitelsatz endlich unbedingt wahr. Jetzt KF1b auf beide Herkuenfte ausweiten und diesen Pin KF1d loeschen.",
    ).toBeNull();
    // Und der Satz nennt die Bedingung bis heute nicht. Steht sie eines Tages da, wird dieser Pin
    // rot — genau das ist seine Aufgabe.
    const t = kapitel("konflikte").toLowerCase();
    for (const wort of ["automatisch", "erkannt"]) {
      expect(
        t,
        `/konflikte: der Kapitelsatz nennt jetzt die Bedingung („${wort}“). Jetzt KF1d durch einen Fall ersetzen, der die Bedingung am Verhalten belegt, und diesen Pin loeschen.`,
      ).not.toContain(wort);
    }
  });

  it("KF1e · NACHFUEHR-PIN: das entschiedene Paar verschwindet vom Brett — „gelöscht wird nichts“ sieht ein Mensch anders", async () => {
    // `GET /api/conflicts` liefert `unresolved()` (`conflicts-routes.ts:227`), der entschiedene
    // Befund faellt also aus der Liste. Der Datensatz bleibt; die Flaeche zeigt ihn nicht mehr.
    d.setze({ kos: KOS, konflikte: [konfliktAuto("c-wahrheit", "truth")] });
    await montiere(Conflicts, "/konflikte");
    expect(marke("pruefen-paar"), "/konflikte: vorher steht kein Paar da").not.toBeNull();

    await klicke(marke("pruefen-knopf-beide-gelten"));
    const speichern = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === wert("con.resolveConfirm"),
    );
    await klicke(speichern);

    expect(
      d.lies().konflikte.find((c) => c.id === "c-wahrheit")?.status,
      "/konflikte: der Befund ist nicht entschieden — der Fall misst nichts",
    ).toBe("geloest");
    expect(
      marke("pruefen-paar"),
      "/konflikte: das entschiedene Paar steht jetzt weiter auf dem Brett. Jetzt KF1e loeschen und die neue Anzeige des entschiedenen Befundes belegen.",
    ).toBeNull();
    expect(
      text(),
      "/konflikte: nach der letzten Entscheidung fehlt der ehrliche Leersatz",
    ).toContain(wert("con.empty"));
  });

  it("KF1f · §9: im erfolgreich LEEREN Bestand gibt es kein Paar — „nimm dir ein Paar vor“ trifft dann nicht zu", async () => {
    behauptung("/konflikte", "konflikte", "nimm dir ein Paar vor");
    // Ein Leerzustand ist ein Zustand, kein Nichts (Lehre JOB 3762 R1). Beide Abrufe sind
    // ERFOLGREICH zurueck — nur der Bestand ist leer.
    d.setze({ kos: KOS, konflikte: [] });
    await montiere(Conflicts, "/konflikte");
    expect(text(), "/konflikte: der Leerzustand sagt nichts").toContain(wert("con.empty"));
    expect(marke("pruefen-paar"), "/konflikte: im Leerzustand steht ein Paar da").toBeNull();
    expect(
      marke("pruefen-aktionsband"),
      "/konflikte: im Leerzustand gibt es etwas zu waehlen",
    ).toBeNull();
  });
});

// ================================================================================================
// AF2 · /output — „Du waehlst die Art des Dokuments, stellst die Wissensobjekte zusammen …"
// ================================================================================================
describe("JOB 3795 AF2 · /output — was das Kapitel verspricht, tut die Seite", () => {
  /** Die Titel in der gezeichneten Reihenfolge der Zusammenstellung (`<ol>` der Vorschau-Karte). */
  function reihenfolge(): string[] {
    const liste = container.querySelector("ol");
    return [...(liste?.querySelectorAll("li") ?? [])].map((li) => {
      const treffer = QUELLEN.find((q) => (li.textContent ?? "").includes(q.title));
      return treffer?.title ?? (li.textContent ?? "").trim();
    });
  }

  /** Die Kaestchen der Quellenliste, in gezeichneter Reihenfolge. */
  function kaestchen(): HTMLInputElement[] {
    return [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
  }

  async function mitZweiQuellen(): Promise<void> {
    d.setze({ quellen: QUELLEN });
    await montiere(Output, "/output");
    const boxen = kaestchen();
    expect(boxen.length, "/output: die Seite zeichnet die Quellen nicht").toBe(QUELLEN.length);
    await klicke(boxen[0]);
    await klicke(boxen[1]);
  }

  it("AF2a: die Art des Dokuments ist waehlbar — die Wahl schlaegt auf die Zusammenstellung durch", async () => {
    behauptung("/output", "output", "Du wählst die Art des Dokuments");
    await mitZweiQuellen();

    // Alle angebotenen Arten stehen als Schaltflaeche da — erhoben aus `OUTPUT_KIND_OPTIONS`,
    // nicht abgetippt.
    const knoepfe = [...container.querySelectorAll("button")].map((b) =>
      (b.textContent ?? "").trim(),
    );
    for (const o of OUTPUT_KIND_OPTIONS) {
      expect(
        knoepfe.some((k) => k.startsWith(wert(o.labelKey))),
        `/output: die Art „${wert(o.labelKey)}“ ist nicht waehlbar`,
      ).toBe(true);
    }
    // Vorbelegt ist die erste Art; die Vorschau nennt sie.
    expect(text(), "/output: die Vorschau nennt die vorbelegte Art nicht").toContain(
      i18n.t("out.previewSummary", { kind: wert("out.kind.instruction"), n: 2 }),
    );
    // EINE AUSGEFUEHRTE WAHL: eine andere Art anklicken — die Zusammenstellung nennt danach sie.
    const andere = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").startsWith(wert("out.kind.checklist")),
    );
    await klicke(andere);
    expect(
      text(),
      "/output: die gewaehlte Art schlaegt nicht auf die Zusammenstellung durch",
    ).toContain(i18n.t("out.previewSummary", { kind: wert("out.kind.checklist"), n: 2 }));
  });

  it("AF2b: die Wissensobjekte lassen sich zusammenstellen UND in eine andere Reihenfolge bringen", async () => {
    behauptung("/output", "output", "stellst die Wissensobjekte zusammen");
    behauptung("/output", "output", "bringst sie in die Reihenfolge");
    await mitZweiQuellen();

    const vorher = reihenfolge();
    expect(vorher, "/output: die Zusammenstellung nimmt die Auswahl nicht auf").toEqual([
      QUELLEN[0]?.title,
      QUELLEN[1]?.title,
    ]);
    // EINE AUSGEFUEHRTE BEDIENHANDLUNG, kein vorhandener Knopf: den ersten Eintrag nach unten.
    const runter = container.querySelector(`ol li button[aria-label="${wert("out.moveDown")}"]`);
    await klicke(runter);
    const nachher = reihenfolge();
    expect(
      nachher,
      "/output: die Reihenfolge hat sich durch die Bedienhandlung NICHT geaendert",
    ).toEqual([QUELLEN[1]?.title, QUELLEN[0]?.title]);
    expect(
      nachher,
      "/output: die Bedienhandlung hat etwas anderes getan als umzuordnen",
    ).not.toEqual(vorher);
  });

  it("AF2c: die Vorschau zeigt die Zusammenstellung VOR dem Erzeugen — und das Dokument entsteht erst danach", async () => {
    behauptung(
      "/output",
      "output",
      "eine Vorschau zeigt die Zusammenstellung, bevor das Dokument erzeugt wird",
    );
    await mitZweiQuellen();

    // GEMESSEN VOR dem Erzeugen-Schritt: die Vorschau steht da, MIT dem Inhalt der
    // Zusammenstellung — und erzeugt wurde noch nichts.
    expect(text(), "/output: es gibt keine Kompositionsvorschau").toContain(
      wert("out.previewCompositionTitle"),
    );
    expect(reihenfolge(), "/output: die Vorschau zeigt die Zusammenstellung nicht").toEqual([
      QUELLEN[0]?.title,
      QUELLEN[1]?.title,
    ]);
    expect(text(), "/output: die Vorschau nennt die Zahl der Bausteine nicht").toContain(
      i18n.t("out.previewSummary", { kind: wert("out.kind.instruction"), n: 2 }),
    );
    expect(
      d.erzeuge,
      "/output: das Dokument wurde VOR dem Erzeugen-Knopf erzeugt",
    ).not.toHaveBeenCalled();
    expect(text(), "/output: das erzeugte Dokument steht vor dem Erzeugen da").not.toContain(
      wert("out.previewTitle"),
    );

    // DER ERZEUGEN-SCHRITT.
    const erzeugen = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === wert("out.generate"),
    );
    await klicke(erzeugen);
    expect(d.erzeuge, "/output: der Erzeugen-Knopf erzeugt nichts").toHaveBeenCalledWith({
      kind: "instruction",
      koIds: ["q1", "q2"],
      audienceRole: "admin",
    });
    expect(text(), "/output: nach dem Erzeugen fehlt das Dokument").toContain(
      wert("out.previewTitle"),
    );
  });

  it("AF2d · §9: im erfolgreich LEEREN Quellenbestand gibt es weder Zusammenstellung noch Vorschau", async () => {
    d.setze({ quellen: [] });
    await montiere(Output, "/output");
    expect(text(), "/output: der leere Quellenbestand sagt nichts").toContain(
      wert("out.noValidated"),
    );
    expect(
      container.querySelector("ol"),
      "/output: leerer Bestand, trotzdem Zusammenstellung",
    ).toBeNull();
    expect(text(), "/output: leerer Bestand, trotzdem Kompositionsvorschau").not.toContain(
      wert("out.previewCompositionTitle"),
    );
    // Die Art des Dokuments bleibt waehlbar — der Kapitelsatz „Beginne mit der Art des Dokuments"
    // stimmt also auch hier; nur weiter kommt man ohne validiertes Wissen nicht.
    expect(text(), "/output: die Art des Dokuments ist im Leerzustand verschwunden").toContain(
      wert("out.kindTitle"),
    );
  });
});

// ================================================================================================
// GF3 · /graph — „zeichnet die einzelnen Wissensobjekte und ihre Verbindungen als Netz …"
// ================================================================================================
describe("JOB 3795 GF3 · /graph — was das Kapitel verspricht, tut die Seite", () => {
  /** Die Knotengruppen: jedes `<g>` im SVG, das einen Kreis traegt. */
  function knotenGruppen(): SVGGElement[] {
    return [...container.querySelectorAll("svg g")].filter((g) =>
      g.querySelector(":scope > circle"),
    ) as SVGGElement[];
  }

  function gruppeVon(titel: string): SVGGElement {
    const g = knotenGruppen().find((k) => k.querySelector(":scope > title")?.textContent === titel);
    if (!g) {
      throw new Error(`/graph: kein Knoten „${titel}“ gezeichnet`);
    }
    return g;
  }

  async function mitBestand(kos = KOS, knoten = KNOTEN): Promise<void> {
    d.setze({ kos, knoten, kanten: KANTEN });
    await montiere(GraphView, "/graph", true);
  }

  /**
   * DER UNABHAENGIGE SOLLWERT — Korrekturpflicht 1 aus BEN 3795 R1, woertlich: „GF3b/GF3c vom
   * produktiven `koDetailPath` als Sollwertgeber entkoppeln. Die gemessene Ziel-ID muss der
   * angeklickten beziehungsweise per Enter aktivierten Knoten-ID entsprechen."
   *
   * WARUM DER ALTE VERGLEICH NICHTS BEWIES: er stellte die angekommene Adresse gegen
   * `koDetailPath(<id>)` — also gegen DIESELBE Produktfunktion, aus der die Seite ihr Ziel baut.
   * BEN hat das gemessen: leitet `lib/graphNav.ts:8` JEDEN Knoten auf `/wissen/falsches-objekt`
   * um, bewegen sich beide Seiten des Vergleichs gemeinsam und die Faelle bleiben gruen — jeder
   * Graphknoten fuehrte dann zum falschen Wissensobjekt, ohne dass etwas rot wird.
   *
   * DER SOLLWERT KOMMT DESHALB AUS DEM PRUEFSTAND, nicht aus dem Produkt: `KNOTEN` ist die Liste,
   * die `d.graphAbruf` als `GET /api/graph` ausgibt; die Kennung dort ist die Identitaet, die der
   * Knoten TRAEGT. Kein Produktcode ist an dieser Zeile beteiligt.
   */
  function kennungImBestand(titel: string): string {
    const k = KNOTEN.find((x) => x.title === titel);
    if (!k) {
      throw new Error(`/graph: „${titel}“ liegt gar nicht im Bestand dieses Laufs`);
    }
    return k.id;
  }

  /**
   * Die Kennung, bei der die Seite WIRKLICH gelandet ist: der `:id` der Detailroute `/wissen/:id`,
   * abgelesen an der Sonde. `null` heisst: die Detailroute wurde nicht erreicht.
   */
  function angekommen(): string | null {
    const s = marke("sonde");
    return s === null ? null : (s.textContent ?? "");
  }

  it("GF3a: gezeichnet werden die einzelnen Wissensobjekte UND ihre Verbindungen", async () => {
    behauptung("/graph", "graph", "die einzelnen Wissensobjekte und ihre Verbindungen");
    await mitBestand();

    const gruppen = knotenGruppen();
    expect(gruppen.length, "/graph: die Zahl der gezeichneten Knoten passt nicht zum Bestand").toBe(
      KNOTEN.length,
    );
    expect(
      gruppen.map((g) => g.querySelector(":scope > title")?.textContent).sort(),
      "/graph: gezeichnet sind nicht die einzelnen Wissensobjekte",
    ).toEqual([...KNOTEN.map((k) => k.title)].sort());
    // Die Verbindungen: je Kante eine Linie, die ihr Schlagwort traegt.
    const kantenLinien = [...container.querySelectorAll("svg line")].filter((l) =>
      l.querySelector("title"),
    );
    expect(kantenLinien.length, "/graph: die Verbindungen sind nicht gezeichnet").toBe(
      KANTEN.length,
    );
    expect(
      kantenLinien.map((l) => l.querySelector("title")?.textContent).sort(),
      "/graph: die gezeichneten Verbindungen sind andere als die des Bestands",
    ).toEqual([...KANTEN.map((k) => k.via)].sort());
    expect(text(), "/graph: die Seite nennt Knoten und Kanten nicht").toContain(
      i18n.t("s2.graphCount", { nodes: KNOTEN.length, edges: KANTEN.length }),
    );
  });

  it("GF3b: ein Klick auf einen Knoten fuehrt zu dem Wissensobjekt dahinter — die Ziel-Adresse gemessen", async () => {
    behauptung("/graph", "graph", "Ein Klick auf einen Knoten führt zu dem Wissensobjekt dahinter");
    await mitBestand();
    // Der Sollwert steht VOR der Bedienhandlung fest und stammt aus dem Pruefstand, nicht aus dem
    // Produkt (siehe `kennungImBestand`) — sonst prueft der Fall das Produkt gegen sich selbst.
    const soll = kennungImBestand(TITEL_B);
    const fremde = KNOTEN.filter((k) => k.id !== soll).map((k) => k.id);
    const g = gruppeVon(TITEL_B);
    await act(async () => {
      g.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    const ziel = angekommen();
    expect(
      ziel,
      `/graph: der Klick auf den Knoten „${TITEL_B}“ hat die Detailroute /wissen/:id ueberhaupt nicht erreicht`,
    ).not.toBeNull();
    expect(
      ziel,
      `/graph: der Klick auf den Knoten „${TITEL_B}“ fuehrt NICHT zu dem Wissensobjekt dahinter — im Bestand dieses Laufs traegt „${TITEL_B}“ die Kennung „${soll}“, angekommen ist „${ziel}“`,
    ).toBe(soll);
    expect(
      fremde,
      `/graph: der Klick auf „${TITEL_B}“ ist bei einem FREMDEN Wissensobjekt gelandet („${ziel}“ gehoert einem anderen Knoten)`,
    ).not.toContain(ziel);
  });

  it("GF3c: mit der Tastatur ist JEDER Knoten einzeln erreichbar — mit echten Tastenereignissen", async () => {
    behauptung("/graph", "graph", "mit der Tastatur springst du von Knoten zu Knoten");
    // WAS HIER GEMESSEN WIRD und was nicht: die Wanderung von Knoten zu Knoten selbst ist die
    // Tabulator-Reihenfolge des BROWSERS; jsdom fuehrt sie nicht aus (ein echtes `keydown` mit
    // „Tab" bewegt dort nichts). Das Produkt steuert dazu zwei Dinge bei, und nur die sind hier
    // messbar: es stellt jeden Knoten in die Reihenfolge (`tabIndex`), und es beantwortet auf
    // JEDEM Knoten ein echtes Tastenereignis mit dem Sprung zu SEINEM Objekt.
    await mitBestand();
    for (const g of knotenGruppen()) {
      expect(
        g.getAttribute("tabindex"),
        `/graph: der Knoten „${g.querySelector(":scope > title")?.textContent}“ liegt nicht in der Tastatur-Reihenfolge`,
      ).toBe("0");
    }
    // Auch hier ist der Sollwert die Kennung AUS DEM PRUEFSTAND (`k.id` aus `KNOTEN`, dem Stand,
    // den `GET /api/graph` in diesem Lauf ausgibt) — nicht der Pfad, den das Produkt selbst baut.
    const erreicht: (string | null)[] = [];
    for (const k of KNOTEN) {
      await mitBestand();
      const g = gruppeVon(k.title);
      await act(async () => {
        g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await flush();
      });
      const ziel = angekommen();
      erreicht.push(ziel);
      expect(
        ziel,
        `/graph: die Tastatur auf dem Knoten „${k.title}“ hat die Detailroute /wissen/:id ueberhaupt nicht erreicht`,
      ).not.toBeNull();
      expect(
        ziel,
        `/graph: die Tastatur fuehrt vom Knoten „${k.title}“ NICHT zu seinem Objekt — im Bestand dieses Laufs traegt „${k.title}“ die Kennung „${k.id}“, angekommen ist „${ziel}“`,
      ).toBe(k.id);
    }
    // Und keine zwei Knoten enden beim selben Objekt: eine Fehlleitung, die ALLE Knoten auf
    // dasselbe Ziel umbiegt, faellt hier zusaetzlich als Ganzes auf.
    expect(
      new Set(erreicht).size,
      `/graph: verschiedene Knoten fuehren zum SELBEN Wissensobjekt — erreicht wurde ${JSON.stringify(erreicht)}`,
    ).toBe(KNOTEN.length);
  });

  it("GF3d · NACHFUEHR-PIN: Klick UND Tastatur fuehren nur zu Objekten, die im Bestand bekannt sind", async () => {
    // GEMESSEN, nicht vermutet: `isNavigableNode` (`lib/graphNav.ts:12-14`) macht einen Knoten nur
    // dann zum Link, wenn sein Objekt im Bestand liegt. `help.graph.body` verspricht beides ohne
    // jede Bedingung — die Seitenhilfe DERSELBEN Seite (`seitenhilfe.graph.text`) nennt sie.
    await mitBestand(
      KOS.filter((k) => k.id !== "ko-c"),
      KNOTEN,
    );
    const fremd = gruppeVon(TITEL_C);
    expect(
      fremd.getAttribute("role"),
      "/graph: der Knoten ohne Objekt im Bestand ist jetzt ein Link. Jetzt GF3d loeschen und die Bedingung am Verhalten neu belegen.",
    ).toBeNull();
    expect(
      fremd.getAttribute("tabindex"),
      "/graph: der Knoten ohne Objekt liegt jetzt in der Tastatur-Reihenfolge. Jetzt GF3d loeschen.",
    ).toBeNull();
    await act(async () => {
      fremd.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      fremd.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await flush();
    });
    expect(
      marke("sonde"),
      "/graph: Klick oder Taste fuehren jetzt AUCH zu einem unbekannten Objekt. Jetzt GF3b/GF3c auf die neue Lage stellen und diesen Pin loeschen.",
    ).toBeNull();
    // Und der Satz nennt die Bedingung bis heute nicht.
    const t = kapitel("graph").toLowerCase();
    for (const wort of ["bestand", "bekannt"]) {
      expect(
        t,
        `/graph: der Kapitelsatz nennt jetzt die Bedingung („${wort}“). Jetzt GF3d durch einen Fall ersetzen, der sie am Verhalten belegt, und diesen Pin loeschen.`,
      ).not.toContain(wort);
    }
  });

  it("GF3e · L4: der Graph hat nur EINE Darstellung — auf schmalem Fenster dieselbe wie auf breitem", async () => {
    // Genau daran ist die Themenkarte in JOB 3741 R1 gescheitert: sie gibt es unter 900 px gar
    // nicht (`pages/Wissensnetz.tsx`, `LESEN_UNTER`). Der Graph fragt die Fensterbreite NICHT ab;
    // gemessen wird das an der gezeichneten Flaeche und nicht am Quelltext.
    setzeBreite(false);
    await mitBestand();
    const breit = knotenGruppen().map((g) => g.querySelector(":scope > title")?.textContent);
    const breitLinien = container.querySelectorAll("svg line").length;
    setzeBreite(true);
    await mitBestand();
    const schmal = knotenGruppen().map((g) => g.querySelector(":scope > title")?.textContent);
    expect(container.querySelector("svg"), "/graph: auf schmal fehlt die Zeichnung").not.toBeNull();
    expect(schmal, "/graph: auf schmal werden andere Knoten gezeichnet").toEqual(breit);
    expect(
      container.querySelectorAll("svg line").length,
      "/graph: auf schmal werden andere Verbindungen gezeichnet",
    ).toBe(breitLinien);
    expect(
      knotenGruppen().filter((g) => g.getAttribute("role") === "link").length,
      "/graph: auf schmal fuehrt der Klick nicht mehr zum Objekt",
    ).toBe(KNOTEN.length);
  });

  it("GF3f · §9: im erfolgreich LEEREN Bestand gibt es kein Netz — „fang bei einem Objekt an“ trifft dann nicht zu", async () => {
    behauptung("/graph", "graph", "folge seinen Linien");
    d.setze({ kos: KOS, knoten: [], kanten: [] });
    await montiere(GraphView, "/graph", true);
    expect(text(), "/graph: der Leerzustand sagt nichts").toContain(wert("s2.graphEmpty"));
    expect(container.querySelector("svg"), "/graph: im Leerzustand wird gezeichnet").toBeNull();
  });
});
