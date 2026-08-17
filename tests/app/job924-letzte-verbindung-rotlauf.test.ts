// @vitest-environment jsdom
// ================================================================================================
// JOB 924 · D6 — DIE LETZTE VERBINDUNG: EINE GESCHLOSSENE KETTE, VON DER ABLAGE BIS IN DREI SPRACHEN
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI TRAEGT (D5 gemessen, BEN7 bestaetigt): Die Route begruendet ihr festes
// `lastConnectedAt: null` damit, es gebe „im Bestand keinen Ort, der einen erfolgreichen
// Confluence-Kontakt festhaelt". Den Ort gibt es: `ImportRun.completedAt` mit Status `COMPLETED`
// (services/library-analytics/src/types.ts), persistiert und in der Kompositionswurzel gehalten
// (`services.importRuns`). Die Route liest ihn nur nicht.
//
// WARUM DIESE DATEI NICHTS IMPORTIERT, WAS ES NOCH NICHT GIBT — die Lehre aus dem D5-Zwischenfehler:
// Ein Import auf den noch nicht gebauten `ImportAccessService` haette die Datei schon beim Einsammeln
// zerlegt. Dann laeuft KEINE einzige Zusicherung, und der Lauf saehe „rot" aus, ohne fachlich etwas
// gemessen zu haben — ein Harnessfehler, kein Red-first. Diese Datei importiert deshalb
// ausschliesslich Vorhandenes und misst den neuen Dienst auf zwei Wegen, die beide ohne ihn
// einsammelbar sind: durch die ECHTE Route (`app.inject`) und als QUELLTEXT (`readFileSync`).
//
// WARUM EIN ABBRUCHWAECHTER AM ENDE STEHT: Faellt die Datei kuenftig beim Einsammeln oder mitten im
// Lauf aus, meldet ein Parser „keine Fehlschlaege" — schweigend gruen. Der letzte Fall zaehlt
// deshalb die tatsaechlich ausgefuehrten Faelle gegen eine feste Zahl.
//
// DIE FUENF GEGENMUTATIONEN, die diese Datei beissend halten muss (jede bricht die genannten Faelle):
//   M1 Erfolgsprioritaet        — juengster→aeltester in der geteilten Auswahl  → B4, A1
//   M2 Serviceverdrahtung       — Dienst haengt an einer FREMDEN, leeren Ablage → A1, A4, F1
//   M3 Ausschluss Nicht-Erfolge — `PARTIAL` gilt als Erfolg                     → A2, B2
//   M4 Sprachhinweis            — der rueckblickende Vorbehalt faellt weg       → G3
//   M5 Geheimnisgrenze          — der Dienst haengt einen Zugangswert an        → F1, F2
// ------------------------------------------------------------------------------------------------
// EINE AUSDRUECKLICHE, ENGE TYPAUSNAHME — und warum sie hier unvermeidbar ist.
//
// Der Wurzel-Typecheck ist NODE-REIN (`tsconfig.json`: `lib: ["ES2022"]`, kein `jsx`) und nimmt
// `tests/**/*.tsx` bewusst aus; die DOM-Vorrichtung der gemounteten Tests lebt deshalb in `.tsx`
// unter `tsconfig.tests-tsx.json` samt Shim `tests/types/mounted-react.d.ts`.
//
// DIESE Datei muss `.ts` heissen — so und nur so ist ihr Pfad geleast (`tests/app/
// job924-letzte-verbindung-rotlauf.test.ts`). Sie montiert trotzdem die ECHTE Flaeche, weil BEN7s
// Pruefluecken 3 und 5 den DOM verlangen und nicht die Absicht. `tsconfig.json`,
// `tsconfig.tests-tsx.json` und der Shim sind NICHT geleast; ein `.tsx`-Zwilling waere ein zweiter,
// ungeleaster Produktpfad.
//
// Ausgenommen sind deshalb GENAU DREI Einbindungen — die Aufloesung untypisierter bzw. JSX-tragender
// Module. Kein einziger Fall, keine Zusicherung und kein Vergleich haengt an dieser Ausnahme; die
// DOM-Formen darunter sind eigens deklariert statt geliehen.
// ------------------------------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
// @ts-expect-error JOB-924: `react` liegt untypisiert unter apps/web/node_modules (@types daneben);
// der Shim dafuer gilt nur fuer den .tsx-Typecheck. Siehe Begruendung oben.
import { act, createElement } from "../../apps/web/node_modules/react";
// @ts-expect-error JOB-924: dasselbe fuer den Client-Renderer. Siehe Begruendung oben.
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// @ts-expect-error JOB-924: die Flaeche ist `.tsx`; der Wurzel-Check fuehrt `jsx` nicht. Siehe oben.
import { ImportAccessPanel } from "../../apps/web/src/components/ImportAccessPanel";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type ImportRun,
  type ImportRunRepo,
  InMemoryImportRunRepo,
  PgImportRunRepo,
} from "../../services/library-analytics";

// ------------------------------------------------------------------------------------------------
// DIE DOM-FORMEN, SELBST DEKLARIERT. Der Node-reine Check kennt `document` und `HTMLElement` nicht;
// geliehene Typen aus `lib.dom` stehen hier nicht zur Verfuegung. Deklariert wird deshalb genau das,
// was die Faelle anfassen — schmaler als `lib.dom` und damit auch schwerer versehentlich zu weiten.
// ------------------------------------------------------------------------------------------------
interface DomKnoten {
  readonly textContent: string | null;
  readonly innerHTML: string;
  readonly parentElement: DomKnoten | null;
  querySelector(auswahl: string): DomKnoten | null;
  querySelectorAll(auswahl: string): { readonly length: number };
  appendChild(kind: DomKnoten): void;
  remove(): void;
}

interface DomWelt {
  document: { body: DomKnoten; createElement(name: string): DomKnoten };
  Response: new (
    koerper: string,
    init: { status: number; headers: Record<string, string> },
  ) => unknown;
}

const welt = globalThis as unknown as DomWelt;

const WURZEL = join(__dirname, "..", "..");
const ROUTE_QUELLE = join(WURZEL, "services/app/src/routes/import-access-routes.ts");
const DIENST_QUELLE = join(WURZEL, "services/app/src/services/import-access-service.ts");
const WURZEL_QUELLE = join(WURZEL, "services/app/src/build-app.ts");

/**
 * NUR DER AUSFUEHRBARE TEIL EINER QUELLE — Kommentare fallen weg.
 *
 * DIE LEHRE, DIE HIER EINGEBAUT IST (JOB 1061 D7, dort an `tools/check` gemessen): Ein Waechter,
 * der ROHTEXT durchsucht, misst auch Prosa. Beide Richtungen sind falsch. Er wird FALSCH GRUEN,
 * wenn ein Kommentar eine Zusage nur beschreibt; er wird FALSCH ROT, wenn ein Kommentar die
 * abgeloeste Vergangenheit benennt — und genau das ist hier passiert: Die Route erklaert im Kopf,
 * warum ihr fruehes festes `lastConnectedAt: null` ueberholt war. Diese Erklaerung gehoert dorthin;
 * sie ist kein Zeitwert. Gemessen wird deshalb, was AUSGEFUEHRT wird.
 *
 * Zeichenketten und Template-Literale bleiben stehen — ein `//` darin ist kein Kommentaranfang
 * (`https://…`), und ein Bezeichner in einer Zeichenkette waere sehr wohl ein Befund.
 */
function nurCode(quelltext: string): string {
  let heraus = "";
  let i = 0;
  let anfuehrung: string | null = null;
  while (i < quelltext.length) {
    const z = quelltext[i] ?? "";
    const naechstes = quelltext[i + 1] ?? "";
    if (anfuehrung !== null) {
      heraus += z;
      if (z === "\\") {
        heraus += naechstes;
        i += 2;
        continue;
      }
      if (z === anfuehrung) {
        anfuehrung = null;
      }
      i += 1;
      continue;
    }
    if (z === '"' || z === "'" || z === "`") {
      anfuehrung = z;
      heraus += z;
      i += 1;
      continue;
    }
    if (z === "/" && naechstes === "/") {
      while (i < quelltext.length && quelltext[i] !== "\n") {
        i += 1;
      }
      continue;
    }
    if (z === "/" && naechstes === "*") {
      i += 2;
      while (i < quelltext.length && !(quelltext[i] === "*" && quelltext[i + 1] === "/")) {
        i += 1;
      }
      i += 2;
      continue;
    }
    heraus += z;
    i += 1;
  }
  return heraus;
}

/** Fehlt eine Datei, ist das ein FACHLICHER Befund und kein Absturz — fail-closed lesbar. */
function quelle(pfad: string): string {
  try {
    return nurCode(readFileSync(pfad, "utf8"));
  } catch {
    return "DATEI-FEHLT";
  }
}

// ------------------------------------------------------------------------------------------------
// Der Auswahlvertrag wird ueber das Repository-Interface gemessen, nicht ueber einen Import der
// noch nicht existierenden Methode. Fehlt sie, ist das Ergebnis der sprechende Platzhalter
// `VERTRAG-FEHLT` — dann meldet `expect` einen fachlichen AssertionError statt „is not a function".
// ------------------------------------------------------------------------------------------------
const VERTRAG_FEHLT = "VERTRAG-FEHLT";

interface MitAuswahl {
  findLastSuccessAt?: (sourceSystem: string) => Promise<string | null>;
}

async function letzterErfolg(repo: ImportRunRepo, system: string): Promise<string | null> {
  const fn = (repo as unknown as MitAuswahl).findLastSuccessAt;
  if (typeof fn !== "function") {
    return VERTRAG_FEHLT;
  }
  return fn.call(repo, system);
}

// ------------------------------------------------------------------------------------------------
// Kuenstliche Zugangswerte VERSCHIEDENER LAENGE. Sie sind erfunden und stehen nur, damit die
// Negativpruefung ueberhaupt etwas zu suchen hat: ohne gesetzte Variablen koennte kein Wert
// austreten, und der Beleg waere leer.
// ------------------------------------------------------------------------------------------------
const KUENSTLICHE_ZUGAENGE: Record<string, string> = {
  KLARWERK_CONFLUENCE_BASE_URL: "https://zzqx-erfunden.example.invalid/wiki",
  KLARWERK_CONFLUENCE_USER: "kw9@x.de",
  KLARWERK_CONFLUENCE_TOKEN: "TKNzzqx7Qv2Lm8Rd4Ws6Yt1Ub3Ic5Oe9Pa0Nf2Hg4Jk6Ll8Mm",
  KLARWERK_CONFLUENCE_SPACE: "ZZQXRAUM42",
};

const SYSTEM = "confluence";

function lauf(over: Partial<ImportRun> = {}): ImportRun {
  return {
    importId: `lauf-${Math.random().toString(36).slice(2)}`,
    sourceSystem: SYSTEM,
    externalId: null,
    sourceScope: "WISSEN",
    requestedSourceVersion: null,
    status: "COMPLETED",
    sourceRecordId: null,
    startedAt: "2026-07-01T08:00:00.000Z",
    completedAt: "2026-07-01T09:00:00.000Z",
    failureCode: null,
    failureReason: null,
    counters: {
      itemsTotal: 0,
      itemsCreated: 0,
      itemsBound: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
    },
    ...over,
  };
}

/**
 * Der Fake-Pool nach dem Muster aus `tests/ko/g27-welle1-pg-paritaet.test.ts` — netzfrei, ohne
 * PostgreSQL. Er gibt genau die Zeilen zurueck, die der Adapter aus der Ablage bekaeme, und haelt
 * das abgesetzte Statement fest, damit die SQL-Abbildung selbst geprueft werden kann.
 */
function fakePool(rows: Record<string, unknown>[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows, rowCount: rows.length };
  };
  return { pool: { query, connect: async () => ({}) }, calls };
}

/** Dieselben Laeufe, wie sie als JSONB-Projektion aus `import_runs` kaemen. */
function pgZeilen(laeufe: readonly Partial<ImportRun>[]): Record<string, unknown>[] {
  return laeufe.map((l) => {
    const voll = lauf(l);
    return {
      source_system: voll.sourceSystem,
      status: voll.status,
      completed_at: voll.completedAt,
    };
  });
}

// ------------------------------------------------------------------------------------------------
// Ein angemeldeter Admin gegen die echte App. `buildServices()` liefert die In-Memory-Wurzel; die
// zurueckgegebene `importRuns`-Ablage IST die, aus der die Route (nach dem Bau) liest.
// ------------------------------------------------------------------------------------------------
interface Gefahren {
  app: Awaited<ReturnType<typeof buildApp>>;
  token: string;
  importRuns: ImportRunRepo;
  schliessen: () => Promise<void>;
}

async function admin(laeufe: readonly Partial<ImportRun>[] = []): Promise<Gefahren> {
  const services = await buildServices();
  for (const l of laeufe) {
    await services.importRuns.insertIfAbsent(lauf(l));
  }
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@x.de", password: "secret123" },
  });
  const token = (login.json() as { token: string }).token;
  return {
    app,
    token,
    importRuns: services.importRuns,
    schliessen: async () => {
      await app.close();
    },
  };
}

async function zugangsantwort(
  g: Gefahren,
): Promise<{ status: number; roh: string; body: unknown }> {
  const res = await g.app.inject({
    method: "GET",
    url: "/api/import/confluence/zugang",
    headers: { authorization: `Bearer ${g.token}` },
  });
  return { status: res.statusCode, roh: res.body, body: res.json() };
}

const zeitpunkt = (body: unknown): unknown =>
  (body as { lastConnectedAt?: unknown }).lastConnectedAt;

// ------------------------------------------------------------------------------------------------
// DOM-Vorrichtung (Muster aus tests/app/mega67-zugang-flaeche-mounted.test.tsx).
// ------------------------------------------------------------------------------------------------
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin" }),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Montiert die echte Flaeche gegen die echte Antwort der echten Route — der Client dazwischen ist
 * der ECHTE (`apps/web/src/api/endpoints`), nur `fetch` wird in `app.inject` umgelenkt. Damit ist
 * die Kette Ablage → Dienst → Route → Draht → Client → Flaeche in EINEM Fall belegt und nicht in
 * fuenf getrennten Behauptungen.
 */
async function flaeche(
  g: Gefahren,
  sprache: string,
): Promise<{ container: DomKnoten; abbauen: () => void }> {
  vi.stubGlobal("fetch", async (input: unknown, init?: { method?: string }) => {
    const pfad = String(input);
    const res = await g.app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: pfad,
      headers: { authorization: `Bearer ${g.token}` },
    });
    return new welt.Response(res.body, {
      status: res.statusCode,
      headers: { "content-type": "application/json" },
    });
  });
  await i18n.changeLanguage(sprache);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = welt.document.createElement("div");
  welt.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(ImportAccessPanel)));
    await flush();
  });
  await act(flush);
  return {
    container,
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    },
  };
}

// ------------------------------------------------------------------------------------------------
// Abbruchwaechter: die Zahl der Faelle, die WIRKLICH gelaufen sein muessen.
// ------------------------------------------------------------------------------------------------
const ERWARTETE_FAELLE = 42;
let gezaehlt = 0;
const zaehle = (): void => {
  gezaehlt += 1;
};

const UMGEBUNG_VORHER: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of Object.keys(KUENSTLICHE_ZUGAENGE)) {
    UMGEBUNG_VORHER[name] = process.env[name];
  }
});

afterEach(() => {
  for (const [name, vorher] of Object.entries(UMGEBUNG_VORHER)) {
    if (vorher === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = vorher;
    }
  }
  vi.unstubAllGlobals();
});

// ================================================================================================
// A · DIE DREI D5-ROTFAELLE AN DER ECHTEN ROUTE
// ================================================================================================
describe("JOB924 A · die Route liefert den letzten Erfolg", () => {
  it("A1: der juengste gueltige COMPLETED-Lauf bestimmt lastConnectedAt", async () => {
    zaehle();
    const g = await admin([
      { completedAt: "2026-08-01T09:00:00.000Z" },
      { completedAt: "2026-08-10T09:00:00.000Z" },
      { completedAt: "2026-07-20T09:00:00.000Z" },
    ]);
    try {
      const { status, body } = await zugangsantwort(g);
      expect(status).toBe(200);
      expect(zeitpunkt(body)).toBe("2026-08-10T09:00:00.000Z");
    } finally {
      await g.schliessen();
    }
  });

  it("A2: ein spaeterer Misserfolg verdraengt den aelteren Erfolg NICHT", async () => {
    zaehle();
    const g = await admin([
      { completedAt: "2026-08-01T09:00:00.000Z" },
      { status: "PARTIAL", completedAt: "2026-08-12T09:00:00.000Z" },
      { status: "FAILED", completedAt: "2026-08-14T09:00:00.000Z" },
    ]);
    try {
      const { body } = await zugangsantwort(g);
      expect(zeitpunkt(body)).toBe("2026-08-01T09:00:00.000Z");
    } finally {
      await g.schliessen();
    }
  });

  // ACHTUNG, ehrlich benannt: Dieser Fall ist auf der unveraenderten Base AUS DEM FALSCHEN GRUND
  // gruen — die Route sagt dort immer `null`. Er steht hier, damit der Bau ihn nicht auf einen
  // erfundenen Wert dreht (etwa `startedAt`, wenn `completedAt` fehlt).
  it("A3: COMPLETED ohne gueltigen Zeitpunkt bleibt ehrlich null", async () => {
    zaehle();
    const g = await admin([
      { completedAt: null },
      { completedAt: "gestern" },
      { completedAt: "2026-13-45T99:00:00.000Z" },
    ]);
    try {
      const { body } = await zugangsantwort(g);
      expect(zeitpunkt(body)).toBeNull();
    } finally {
      await g.schliessen();
    }
  });

  it("A4: der Wert steht im SERIALISIERTEN Koerper, nicht nur im Objekt", async () => {
    zaehle();
    const g = await admin([{ completedAt: "2026-08-10T09:00:00.000Z" }]);
    try {
      const { roh } = await zugangsantwort(g);
      expect(roh).toContain('"lastConnectedAt":"2026-08-10T09:00:00.000Z"');
    } finally {
      await g.schliessen();
    }
  });

  it("A5: ohne jeden Lauf bleibt es ehrlich null (kein erfundener Zeitpunkt)", async () => {
    zaehle();
    const g = await admin([]);
    try {
      const { status, body } = await zugangsantwort(g);
      expect(status).toBe(200);
      expect(zeitpunkt(body)).toBeNull();
    } finally {
      await g.schliessen();
    }
  });
});

// ================================================================================================
// B · DER AUSWAHLVERTRAG AM REPOSITORY (IN-MEMORY)
// ================================================================================================
describe("JOB924 B · Auswahlvertrag, fail-closed", () => {
  async function repoMit(laeufe: readonly Partial<ImportRun>[]): Promise<ImportRunRepo> {
    const repo = new InMemoryImportRunRepo();
    for (const l of laeufe) {
      await repo.insertIfAbsent(lauf(l));
    }
    return repo;
  }

  it("B1: keine Laeufe → null", async () => {
    zaehle();
    expect(await letzterErfolg(await repoMit([]), SYSTEM)).toBeNull();
  });

  it("B2: nur PARTIAL und FAILED → null (Nicht-Erfolg ist kein Erfolg)", async () => {
    zaehle();
    const repo = await repoMit([
      { status: "PARTIAL", completedAt: "2026-08-12T09:00:00.000Z" },
      { status: "FAILED", completedAt: "2026-08-14T09:00:00.000Z" },
    ]);
    expect(await letzterErfolg(repo, SYSTEM)).toBeNull();
  });

  it("B3: laufende Zustaende zaehlen nicht als Erfolg", async () => {
    zaehle();
    const repo = await repoMit([
      { status: "QUEUED", completedAt: "2026-08-12T09:00:00.000Z" },
      { status: "ANALYZING", completedAt: "2026-08-13T09:00:00.000Z" },
    ]);
    expect(await letzterErfolg(repo, SYSTEM)).toBeNull();
  });

  it("B4: mehrere Erfolge → der juengste, unabhaengig von der Einfuegereihenfolge", async () => {
    zaehle();
    const vorwaerts = await repoMit([
      { completedAt: "2026-08-01T09:00:00.000Z" },
      { completedAt: "2026-08-10T09:00:00.000Z" },
    ]);
    const rueckwaerts = await repoMit([
      { completedAt: "2026-08-10T09:00:00.000Z" },
      { completedAt: "2026-08-01T09:00:00.000Z" },
    ]);
    expect(await letzterErfolg(vorwaerts, SYSTEM)).toBe("2026-08-10T09:00:00.000Z");
    expect(await letzterErfolg(rueckwaerts, SYSTEM)).toBe("2026-08-10T09:00:00.000Z");
  });

  it("B5: unparsebare und leere Zeitpunkte werden verworfen, nicht geraten", async () => {
    zaehle();
    const repo = await repoMit([
      { completedAt: "gestern" },
      { completedAt: "" },
      { completedAt: "2026" },
      { completedAt: "2026-13-45T99:00:00.000Z" },
      { completedAt: null },
    ]);
    expect(await letzterErfolg(repo, SYSTEM)).toBeNull();
  });

  it("B6: ein ungueltiger Zeitpunkt verdeckt einen gueltigen aelteren nicht", async () => {
    zaehle();
    const repo = await repoMit([
      { completedAt: "2026-08-01T09:00:00.000Z" },
      { completedAt: "morgen-irgendwann" },
    ]);
    expect(await letzterErfolg(repo, SYSTEM)).toBe("2026-08-01T09:00:00.000Z");
  });

  it("B7: ein fremdes Quellsystem zaehlt nicht mit", async () => {
    zaehle();
    const repo = await repoMit([
      { sourceSystem: "sharepoint", completedAt: "2026-08-20T09:00:00.000Z" },
      { completedAt: "2026-08-01T09:00:00.000Z" },
    ]);
    expect(await letzterErfolg(repo, SYSTEM)).toBe("2026-08-01T09:00:00.000Z");
    expect(await letzterErfolg(repo, "sharepoint")).toBe("2026-08-20T09:00:00.000Z");
    expect(await letzterErfolg(repo, "gibtesnicht")).toBeNull();
  });

  it("B8: der GESPEICHERTE Text kommt zurueck, nicht eine umformatierte Fassung", async () => {
    zaehle();
    const repo = await repoMit([{ completedAt: "2026-08-10T11:00:00+02:00" }]);
    expect(await letzterErfolg(repo, SYSTEM)).toBe("2026-08-10T11:00:00+02:00");
  });

  it("B9: gleicher Zeitpunkt in zwei Schreibweisen → deterministisch, reihenfolgeunabhaengig", async () => {
    zaehle();
    const a = await repoMit([
      { completedAt: "2026-08-10T09:00:00.000Z" },
      { completedAt: "2026-08-10T11:00:00+02:00" },
    ]);
    const b = await repoMit([
      { completedAt: "2026-08-10T11:00:00+02:00" },
      { completedAt: "2026-08-10T09:00:00.000Z" },
    ]);
    const ausA = await letzterErfolg(a, SYSTEM);
    // Ohne diese Zeile waere der Fall auf der Base gruen, weil BEIDE Seiten `VERTRAG-FEHLT`
    // liefern — ein Vergleich zweier Leerstellen ist keine Zusicherung.
    expect(ausA).not.toBe(VERTRAG_FEHLT);
    expect(ausA).toBe(await letzterErfolg(b, SYSTEM));
  });
});

// ================================================================================================
// C · POSTGRESQL-PARITAET, NETZFREI
// ================================================================================================
//
// WAS DAS BELEGT: dieselbe Auswahlregel auf beiden Adaptern, gemessen an denselben Rohdaten.
// WAS ES NICHT ERSETZT, ausdruecklich: einen echten PostgreSQL-Lauf (Planner, Index,
// Nebenlaeufigkeit). Der gehoert in den Testcontainers-Lauf; Datenbankzugriff ist dieser Bahn
// nicht freigegeben. Dasselbe Zugestaendnis macht der bestehende Adaptertest.
describe("JOB924 C · InMemory und PostgreSQL sagen dasselbe", () => {
  const MATRIX: { name: string; laeufe: Partial<ImportRun>[]; erwartet: string | null }[] = [
    { name: "leer", laeufe: [], erwartet: null },
    {
      name: "nur Nicht-Erfolge",
      laeufe: [
        { status: "PARTIAL", completedAt: "2026-08-12T09:00:00.000Z" },
        { status: "FAILED", completedAt: "2026-08-14T09:00:00.000Z" },
      ],
      erwartet: null,
    },
    {
      name: "juengster von drei Erfolgen",
      laeufe: [
        { completedAt: "2026-08-01T09:00:00.000Z" },
        { completedAt: "2026-08-10T09:00:00.000Z" },
        { completedAt: "2026-07-20T09:00:00.000Z" },
      ],
      erwartet: "2026-08-10T09:00:00.000Z",
    },
    {
      name: "spaeterer Misserfolg verdraengt nicht",
      laeufe: [
        { completedAt: "2026-08-01T09:00:00.000Z" },
        { status: "FAILED", completedAt: "2026-08-14T09:00:00.000Z" },
      ],
      erwartet: "2026-08-01T09:00:00.000Z",
    },
    {
      name: "unparsebar wird verworfen",
      laeufe: [{ completedAt: "gestern" }, { completedAt: "2026-08-01T09:00:00.000Z" }],
      erwartet: "2026-08-01T09:00:00.000Z",
    },
    {
      name: "nur unparsebar → null",
      laeufe: [{ completedAt: "gestern" }, { completedAt: "" }],
      erwartet: null,
    },
  ];

  for (const fall of MATRIX) {
    it(`C1 [${fall.name}]: beide Adapter liefern dasselbe`, async () => {
      zaehle();
      const speicher = new InMemoryImportRunRepo();
      for (const l of fall.laeufe) {
        await speicher.insertIfAbsent(lauf(l));
      }
      const { pool } = fakePool(pgZeilen(fall.laeufe));
      const pg = new PgImportRunRepo(pool as never);
      const ausSpeicher = await letzterErfolg(speicher, SYSTEM);
      const ausPg = await letzterErfolg(pg, SYSTEM);
      expect(ausSpeicher).toBe(fall.erwartet);
      expect(ausPg).toBe(fall.erwartet);
      expect(ausPg).toBe(ausSpeicher);
    });
  }

  it("C2: das Statement liest genau die drei Auswahlfelder und bindet das Quellsystem", async () => {
    zaehle();
    const { pool, calls } = fakePool([]);
    const pg = new PgImportRunRepo(pool as never);
    await letzterErfolg(pg, SYSTEM);
    expect(calls.length).toBe(1);
    const sql = (calls[0]?.sql ?? "").replace(/\s+/g, " ");
    expect(sql).toContain("import_runs");
    expect(sql).toContain("'sourceSystem'");
    expect(sql).toContain("'status'");
    expect(sql).toContain("'completedAt'");
    expect(calls[0]?.params).toEqual([SYSTEM]);
  });

  // WARUM DAS EIN EIGENER FALL IST: Ein `ORDER BY data->>'completedAt' DESC LIMIT 1` sortiert
  // TEXTUELL. `2026-08-10T11:00:00+02:00` ist textuell groesser als `2026-08-10T09:00:00.000Z`,
  // bezeichnet aber denselben Augenblick — und `2026-9-...` waere textuell groesser als
  // `2026-10-...`. Die Ordnung gehoert deshalb in die geteilte Regel, nicht in SQL; sonst sagen die
  // beiden Adapter bei gemischten Schreibweisen Verschiedenes.
  it("C3: die Auswahl ordnet nicht textuell in SQL", async () => {
    zaehle();
    const { pool, calls } = fakePool([]);
    const pg = new PgImportRunRepo(pool as never);
    await letzterErfolg(pg, SYSTEM);
    // Ohne diese Zeile pruefte der Fall auf der Base ein LEERES Statement — ein nicht abgesetztes
    // SQL enthaelt naturgemaess kein ORDER BY.
    expect(calls.length).toBe(1);
    const sql = (calls[0]?.sql ?? "").replace(/\s+/g, " ").toUpperCase();
    expect(sql).not.toContain("ORDER BY");
    expect(sql).not.toContain("LIMIT");
  });
});

// ================================================================================================
// D · SCHICHTUNG — DIE ROUTE KENNT NUR DEN DIENST
// ================================================================================================
describe("JOB924 D · Route → Dienst → Repository", () => {
  // POSITIVKALIBRIERUNG DES MESSGERAETS. Ohne sie waeren D1 und D2 auch dann gruen, wenn `nurCode`
  // versehentlich ALLES wegwuerfe — ein leerer Text enthaelt jeden verbotenen Bezeichner nicht.
  it("D0: nurCode entfernt Kommentare und laesst Code samt Zeichenketten stehen", () => {
    zaehle();
    const probe = [
      "// lastConnectedAt steht nur hier im Kommentar",
      "/* auch importRuns nur als Prosa */",
      'const url = "https://x.example/pfad"; // Ende',
      "const echt = zugang.zugangsstatus();",
    ].join("\n");
    const code = nurCode(probe);
    expect(code).not.toContain("nur hier im Kommentar");
    expect(code).not.toContain("nur als Prosa");
    expect(code).not.toContain("// Ende");
    // Die Zeichenkette bleibt vollstaendig — ihr `//` ist kein Kommentaranfang.
    expect(code).toContain('"https://x.example/pfad"');
    expect(code).toContain("zugang.zugangsstatus()");
  });

  it("D1: die Route greift auf kein Repository und keinen Umgebungsleser mehr zu", () => {
    zaehle();
    const q = quelle(ROUTE_QUELLE);
    expect(q).not.toBe("DATEI-FEHLT");
    expect(q).not.toContain("importRuns");
    expect(q).not.toContain("ImportRunRepo");
    expect(q).not.toContain("confluenceCredentialState");
    expect(q).not.toContain("schalterAn");
  });

  it("D2: die Route traegt keinen eigenen Zeitwert mehr", () => {
    zaehle();
    const q = quelle(ROUTE_QUELLE);
    expect(q).not.toContain("lastConnectedAt");
    expect(q).toContain("ImportAccessService");
  });

  it("D3: die Kompositionswurzel verdrahtet den Dienst mit der Laufablage", () => {
    zaehle();
    const q = quelle(WURZEL_QUELLE);
    expect(q).toContain("ImportAccessService");
    expect(q).toMatch(/importAccessRoutes\(\s*guards\s*,/);
    expect(q).toMatch(/importRuns:\s*services\.importRuns/);
  });

  it("D4: der Dienst existiert und fragt die Ablage genau an EINER Stelle", () => {
    zaehle();
    const q = quelle(DIENST_QUELLE);
    expect(q).not.toBe("DATEI-FEHLT");
    expect(q).toContain("findLastSuccessAt");
    expect((q.match(/findLastSuccessAt\(/g) ?? []).length).toBe(1);
  });
});

// ================================================================================================
// E · RECHTE UND FEHLER
// ================================================================================================
describe("JOB924 E · wer nichts darf, bekommt auch keinen Zeitpunkt", () => {
  it("E1: ohne Anmeldung kein 200 und kein Zeitpunkt", async () => {
    zaehle();
    const g = await admin([{ completedAt: "2026-08-10T09:00:00.000Z" }]);
    try {
      const res = await g.app.inject({
        method: "GET",
        url: "/api/import/confluence/zugang",
      });
      expect(res.statusCode).not.toBe(200);
      expect(res.body).not.toContain("2026-08-10");
    } finally {
      await g.schliessen();
    }
  });

  it("E2: angemeldet ohne users.manage — kein Zeitpunkt im Koerper", async () => {
    zaehle();
    const g = await admin([{ completedAt: "2026-08-10T09:00:00.000Z" }]);
    try {
      await g.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Bea", email: "bea@x.de", password: "secret123" },
      });
      const login = await g.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "bea@x.de", password: "secret123" },
      });
      const antwort = login.json() as { token?: string };
      // Ein Zweitkonto ist nicht automatisch freigeschaltet; existiert kein Token, ist der Zugang
      // schon davor zu. Beide Ausgaenge sind hier zulaessig — NICHT zulaessig ist ein Zeitpunkt.
      const res = await g.app.inject({
        method: "GET",
        url: "/api/import/confluence/zugang",
        ...(antwort.token ? { headers: { authorization: `Bearer ${antwort.token}` } } : {}),
      });
      expect(res.statusCode).not.toBe(200);
      expect(res.body).not.toContain("2026-08-10");
    } finally {
      await g.schliessen();
    }
  });

  it("E3: faellt die Ablage aus, bleibt es ehrlich null — ohne Fehlertext im Koerper", async () => {
    zaehle();
    const g = await admin([{ completedAt: "2026-08-10T09:00:00.000Z" }]);
    try {
      const kaputt = g.importRuns as unknown as MitAuswahl;
      const echt = kaputt.findLastSuccessAt;
      kaputt.findLastSuccessAt = async () => {
        throw new Error(`Ablage kaputt: ${KUENSTLICHE_ZUGAENGE.KLARWERK_CONFLUENCE_TOKEN}`);
      };
      try {
        const { status, roh, body } = await zugangsantwort(g);
        expect(status).toBe(200);
        expect(zeitpunkt(body)).toBeNull();
        expect(roh).not.toContain("Ablage kaputt");
        expect(roh).not.toContain(KUENSTLICHE_ZUGAENGE.KLARWERK_CONFLUENCE_TOKEN);
      } finally {
        if (echt === undefined) {
          delete kaputt.findLastSuccessAt;
        } else {
          kaputt.findLastSuccessAt = echt;
        }
      }
    } finally {
      await g.schliessen();
    }
  });
});

// ================================================================================================
// F · DIE GEHEIMNISGRENZE — KOERPER UND DOM
// ================================================================================================
// EINE ausdrueckliche, enge Grenze: Der Schemapraefix `https://` steht in jeder URL und ist selbst
// kein Geheimnis — er wird vor der Fragmentbildung abgeschnitten. Ohne diese Grenze pruefte der
// Fall die Anwesenheit von „https://" irgendwo im Markup und waere zufaellig rot statt beissend.
// Der VOLLE Wert wird davon unberuehrt geprueft.
function fragmente(wert: string): string[] {
  const kern = wert.replace(/^https?:\/\//, "");
  if (kern.length < 8) {
    return kern.length >= 6 ? [kern] : [];
  }
  const mitte = Math.floor(kern.length / 2);
  return [kern.slice(0, 8), kern.slice(-8), kern.slice(mitte - 4, mitte + 4)].filter(
    (s) => s.length >= 6,
  );
}

describe("JOB924 F · kein Wert, kein Fragment, keine Maske, keine Laenge, kein Feld", () => {
  it("F1: der Antwortkoerper traegt keinen der vier kuenstlichen Werte", async () => {
    zaehle();
    for (const [name, wert] of Object.entries(KUENSTLICHE_ZUGAENGE)) {
      process.env[name] = wert;
    }
    const g = await admin([{ completedAt: "2026-08-10T09:00:00.000Z" }]);
    try {
      const { roh, body } = await zugangsantwort(g);
      // Die Kette muss dabei WIRKLICH tragen — sonst prueft dieser Fall eine leere Antwort.
      expect(zeitpunkt(body)).toBe("2026-08-10T09:00:00.000Z");
      for (const [name, wert] of Object.entries(KUENSTLICHE_ZUGAENGE)) {
        expect(roh, `Wert von ${name} im Koerper`).not.toContain(wert);
        for (const teil of fragmente(wert)) {
          expect(roh, `Fragment ${teil} von ${name} im Koerper`).not.toContain(teil);
        }
        expect(roh, `Laenge von ${name} im Koerper`).not.toContain(`"${name}":${wert.length}`);
      }
      expect(roh).not.toMatch(/[•*·]{3,}/);
    } finally {
      await g.schliessen();
    }
  });

  it("F2: der gerenderte DOM traegt keinen Wert, keine Maske, keine Laenge und kein Eingabefeld", async () => {
    zaehle();
    for (const [name, wert] of Object.entries(KUENSTLICHE_ZUGAENGE)) {
      process.env[name] = wert;
    }
    const g = await admin([{ completedAt: "2026-08-10T09:00:00.000Z" }]);
    const f = await flaeche(g, "de");
    try {
      const html = f.container.innerHTML;
      const text = f.container.textContent ?? "";
      // Die Flaeche muss WIRKLICH etwas anzeigen — sonst pruefte dieser Fall ein leeres DOM, und
      // ein leeres DOM enthaelt trivialerweise kein Geheimnis.
      expect(f.container.querySelector("[data-testid=import-access-lastconnected]")).not.toBeNull();
      expect(f.container.querySelectorAll("[data-testid^=import-access-var-]").length).toBe(4);
      expect(f.container.querySelector("input")).toBeNull();
      expect(f.container.querySelector("form")).toBeNull();
      expect(f.container.querySelector("textarea")).toBeNull();
      expect(text).not.toMatch(/[•*·]{3,}/);
      for (const [name, wert] of Object.entries(KUENSTLICHE_ZUGAENGE)) {
        expect(html, `Wert von ${name} im DOM`).not.toContain(wert);
        for (const teil of fragmente(wert)) {
          expect(html, `Fragment ${teil} von ${name} im DOM`).not.toContain(teil);
        }
        // Die Laenge waere eine Aussage ueber das Geheimnis — geprueft ENG an der Zeile der
        // Variablen, damit die Zahl nicht anderswo zufaellig auftaucht.
        const zeile = f.container.querySelector(`[data-testid="import-access-var-${name}"]`)
          ?.parentElement?.textContent;
        expect(zeile ?? "", `Zeile von ${name}`).not.toContain(String(wert.length));
      }
    } finally {
      f.abbauen();
      await g.schliessen();
    }
  });
});

// ================================================================================================
// G · DIE FLAECHE IN DE, EN UND NL
// ================================================================================================
//
// ZEITZONENREGEL: die im Bestand geltende — `formatKoTimestamp` (apps/web/src/lib/koDates.ts),
// also Datum + Uhrzeit ohne Sekunden in der Zeitzone des Betrachters, lokalisiert nach Sprache.
// Der Test vergleicht gegen DIESELBE Funktion statt gegen eine abgeschriebene Zeichenkette; eine
// abgeschriebene waere nur in der Zeitzone des Schreibenden richtig.
const SPRACHEN = ["de", "en", "nl"] as const;
const WERT_ISO = "2026-08-10T09:00:00.000Z";

/** Woerter, die eine AKTUELLE Erreichbarkeit behaupten wuerden — je Sprache. */
const VERBOTENE_GEGENWART: Record<string, string[]> = {
  de: ["verbunden mit", "ist erreichbar", "Verbindung steht", "online"],
  en: ["is connected", "is reachable", "currently connected", "online"],
  nl: ["is verbonden", "is bereikbaar", "momenteel verbonden", "online"],
};

describe("JOB924 G · Wert und Nullfall in drei Sprachen", () => {
  for (const sprache of SPRACHEN) {
    it(`G1 [${sprache}]: der Wertfall zeigt den Zeitpunkt nach der Bestandsregel`, async () => {
      zaehle();
      const g = await admin([{ completedAt: WERT_ISO }]);
      const f = await flaeche(g, sprache);
      try {
        const knoten = f.container.querySelector("[data-testid=import-access-lastconnected]");
        expect(knoten, `Wertzeile fehlt in ${sprache}`).not.toBeNull();
        const text = knoten?.textContent ?? "";
        const erwartet = formatKoTimestamp(WERT_ISO, sprache);
        expect(erwartet).not.toBeNull();
        expect(text).toContain(erwartet ?? "NIE");
        // Der rohe ISO-Text gehoert nicht in die Flaeche — er waere unlokalisiert und in der
        // falschen Zeitzone.
        expect(text).not.toContain(WERT_ISO);
      } finally {
        f.abbauen();
        await g.schliessen();
      }
    });

    it(`G2 [${sprache}]: der Nullfall sagt es, statt die Zeile wegzulassen`, async () => {
      zaehle();
      const g = await admin([]);
      const f = await flaeche(g, sprache);
      try {
        const knoten = f.container.querySelector("[data-testid=import-access-lastconnected]");
        expect(knoten, `Nullzeile fehlt in ${sprache}`).not.toBeNull();
        const text = (knoten?.textContent ?? "").trim();
        expect(text.length).toBeGreaterThan(10);
        // Der Schluessel selbst waere die Anzeige eines fehlenden Woerterbucheintrags.
        expect(text).not.toContain("imp.access.");
      } finally {
        f.abbauen();
        await g.schliessen();
      }
    });

    it(`G3 [${sprache}]: der Werttext ist rueckblickend und behauptet keine aktuelle Erreichbarkeit`, async () => {
      zaehle();
      const g = await admin([{ completedAt: WERT_ISO }]);
      const f = await flaeche(g, sprache);
      try {
        const text = (
          f.container.querySelector("[data-testid=import-access-lastconnected]")?.textContent ?? ""
        ).toLowerCase();
        expect(text.length).toBeGreaterThan(10);
        for (const wort of VERBOTENE_GEGENWART[sprache] ?? []) {
          expect(text, `„${wort}" behauptet Gegenwart (${sprache})`).not.toContain(
            wort.toLowerCase(),
          );
        }
        // Der Vorbehalt muss DASTEHEN, nicht nur nicht fehlen: der Satz nennt ausdruecklich, dass
        // ueber den JETZIGEN Zustand nichts gesagt ist.
        const vorbehalt: Record<string, string> = {
          de: "jetzt",
          en: "now",
          nl: "nu",
        };
        expect(text, `Vorbehalt fehlt (${sprache})`).toContain(vorbehalt[sprache] ?? "?");
      } finally {
        f.abbauen();
        await g.schliessen();
      }
    });
  }

  it("G4: ein unparsebarer Wert faellt auf den Nullsatz zurueck statt roh zu erscheinen", async () => {
    zaehle();
    const g = await admin([]);
    // Der Weg dorthin fuehrt ueber die Ablage, nicht ueber ein Prop: so misst der Fall dieselbe
    // Kette wie alle anderen.
    const repo = g.importRuns as unknown as MitAuswahl;
    repo.findLastSuccessAt = async () => "voellig-kaputt";
    const f = await flaeche(g, "de");
    try {
      const text =
        f.container.querySelector("[data-testid=import-access-lastconnected]")?.textContent ?? "";
      expect(text).not.toContain("voellig-kaputt");
      expect(text.trim().length).toBeGreaterThan(10);
    } finally {
      f.abbauen();
      await g.schliessen();
    }
  });
});

// ================================================================================================
// Z · ABBRUCHWAECHTER
// ================================================================================================
describe("JOB924 Z · der Lauf war vollstaendig", () => {
  it("Z1: alle Faelle dieser Datei sind wirklich gelaufen", () => {
    // Dieser Fall zaehlt sich selbst NICHT mit — er prueft die anderen.
    expect(gezaehlt).toBe(ERWARTETE_FAELLE);
  });
});
