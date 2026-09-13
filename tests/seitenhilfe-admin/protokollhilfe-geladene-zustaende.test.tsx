// @vitest-environment jsdom
// ================================================================================================
// JOB 3670 · RUNDE 2 — DIE HILFE ERKLÄRT DIE ZUSTÄNDE, DIE DIE KARTE WIRKLICH ZEICHNET.
// ================================================================================================
//
// DIE KORREKTURPFLICHT, AUS DER DIESE DATEI ENTSTANDEN IST (Prüfer BEN, Runde 1, ROT):
// Die Prüfprotokollhilfe behauptete, eine Kennung ohne Namen bedeute, „das Verzeichnis konnte nicht
// gelesen werden", und die Karte behaupte dann „nichts über das Konto". Beides war falsch. BEN hat
// es an einer montierten Gegenprobe gemessen: „Verzeichnis erfolgreich geladen; betroffene Zeile =
// Konto nicht mehr vorhandengeloescht-konto".
//
// WARUM DER WÄCHTER DER RUNDE 1 DAS NICHT GEFANGEN HAT — und das ist die eigentliche Lehre:
// sein Endpunkt-Mock beantwortet GRUNDSÄTZLICH keine Abfrage (`vier-adminflaechen-…:45`, jedes
// Versprechen bleibt offen). Jede Karte stand damit ewig in „lädt". Eine Hilfe über Zustände, die
// erst mit GELADENEN Daten entstehen, war dort baulich nicht prüfbar — 91 grüne Fälle, und der
// Satz, um den es ging, war von keinem einzigen berührt.
//
// DIESE DATEI DREHT GENAU DAS UM: sie ANTWORTET. Ein umschaltbarer Endpunkt-Mock stellt die drei
// Verzeichnislagen her, die `lib/auditEventDetail.ts` unterscheidet, und dazu den vierten Fall, in
// dem gar nicht nachgeschlagen wird:
//
//   frisch geladen, Kennung fehlt  → `audit.detail.accountGone`     „Konto nicht mehr vorhanden"
//   Abruf gescheitert              → `audit.detail.nameUnavailable` „Name nicht abrufbar"
//   Abruf läuft noch               → `audit.detail.nameLoading`     „Name wird geladen"
//   Ziel ist gar kein Konto        → (kein Hinweis)                 nur die Kennung
//
// ABGELEITET, NICHT ABGESCHRIEBEN. Der entscheidende Fall liest den Hinweis, den die Karte
// TATSÄCHLICH neben die Kennung zeichnet, zieht die Kennung ab — und verlangt genau den Rest im
// Hilfetext, in allen drei Sprachen. Stünde hier stattdessen eine Liste erwarteter Wörter, wäre sie
// dieselbe Sorte Behauptung, die in Runde 1 falsch war. So kann der Text der Karte nicht mehr
// davonlaufen: kommt morgen eine fünfte Ursache dazu, verlangt dieser Fall sie automatisch.
//
// ================================================================================================
// JOB 3853 · G5 — DER ALTE BESTAND, WÄHREND DIE AUFFRISCHUNG LÄUFT ODER GESCHEITERT IST.
// ================================================================================================
//
// DIE BESTELLUNG (Prüfer BEN, GRÜN-Urteil zu JOB 3670 Runde 2, `archiv/3670/runde-2/ben.md:28`,
// Prüfpunkt 6): „Der neue Hilfewächter misst laufende und gescheiterte Auffrischungen mit
// vorhandenem Cache nicht separat. Ergänzungsvorschlag: fehlende Kennung im alten Bestand,
// Auffrischung zunächst offen beziehungsweise fehlgeschlagen, jeweils Anzeige und Hilfe gemeinsam
// prüfen (`auditEventDetail.ts:180`)."
//
// DER UNTERSCHIED ZU G2 — und er ist der ganze Punkt. Dort ist NIE ein Bestand da (`hatDaten ===
// false`): der Erstabruf hängt oder scheitert, und deshalb trägt auch die AKTEURZEILE nur eine
// Kennung. Hier ist der Bestand da (`hatDaten === true`), die Akteurzeile trägt „Pia Admin" — und
// trotzdem darf neben der fehlenden Kennung keine Kontolöschung stehen, weil die aktuelle Antwort
// noch unterwegs (`laeuftNach`) oder gescheitert/ruhend (`veraltet`) ist. Steht in der Akteurzeile
// kein Name, misst der Fall in Wahrheit G2 und ist still grün aus dem falschen Grund; deshalb
// prüft JEDER Fall dieser Gruppe den sichtbaren Bestand mit.
//
// DER UNTERSCHIED ZUM MODULTEST `apps/web/src/lib/auditEventDetail.test.ts:126,146`: dort werden
// dieselben zwei Stände geprüft, aber an der REINEN FUNKTION — mit einer von Hand gebauten
// `VerzeichnisLage`. Ob die Fläche diese Lage überhaupt jemals herstellt, sagt das nicht. Hier
// läuft die Kette vollständig: `useDirectory` → `abfragelage`/`wertBefund` (`zeilenWert.ts:60-101`)
// → die EINE Zeile `AdminSicherheitDetails.tsx:152`, die den Stand entscheidet → `kontoZeile` →
// gezeichnete `<dd>`-Zeile. Genau diese Zeile war von keinem Test unter `tests/` berührt: nagelt
// man sie auf `"frisch"`, bleiben die 18 Fälle von JOB 3670 und der Modultest grün, und nur diese
// Gruppe wird rot.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

/**
 * Der UMSCHALTBARE Endpunkt-Mock — der ganze Unterschied zur Datei nebenan.
 *
 * `ANTWORTEN` bildet den gepunkteten Zugriffspfad (`audit.list`, `directory.list`, `users.list`)
 * auf das ab, was der Aufruf tun soll. Der Proxy sammelt diesen Pfad beim Durchgreifen ein, damit
 * kein Endpunkt hier aufgezählt werden muss:
 *
 *   ein Wert       → das Versprechen erfüllt sich damit  (geladen)
 *   ein `Error`    → das Versprechen scheitert            (nicht abrufbar)
 *   nichts gesetzt → das Versprechen löst NIE auf         (lädt, wie im Wächter nebenan)
 *
 * `vi.hoisted`, weil `vi.mock` nach oben gezogen wird und die Fabrik sonst in die Zeitschranke des
 * `const` liefe.
 */
const { ANTWORTEN } = vi.hoisted(() => ({ ANTWORTEN: {} as Record<string, unknown> }));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (pfad: string): unknown =>
    new Proxy(
      vi.fn(() => {
        const eintrag = ANTWORTEN[pfad];
        if (eintrag === undefined) {
          return new Promise(() => {});
        }
        return eintrag instanceof Error ? Promise.reject(eintrag) : Promise.resolve(eintrag);
      }),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make(pfad === "" ? String(prop) : `${pfad}.${String(prop)}`);
        },
      },
    );
  return { endpoints: make("") };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
(globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
  ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

// ------------------------------------------------------------------------------------------------
// DIE DATEN. Zwei Konten im Verzeichnis, EINES ausdrücklich nicht — das gelöschte.
// ------------------------------------------------------------------------------------------------
const ADMIN_ID = "u1";
const GELOESCHT_ID = "geloescht-konto";
const KO_ID = "ko-4711";

/**
 * Das Verzeichnis, wie `GET /api/directory` es liefert: NUR Kennung und Anzeigename. Das gelöschte
 * Konto steht nicht darin — und die Antwort ist trotzdem erfolgreich. Genau diese Kombination hat
 * der alte Hilfetext geleugnet.
 */
const VERZEICHNIS = [
  { id: ADMIN_ID, name: "Pia Admin" },
  { id: "u2", name: "Ben Controller" },
];

/**
 * Zwei Protokolleinträge, die zusammen drei der vier Zeilenformen erzeugen.
 *
 * `payload` ist BEWUSST leer: `auditEventDetail` liest zuerst den im Eintrag GESPEICHERTEN Namen
 * (`actorName`/`targetName`, `auditEventDetail.ts:160-163`). Stünde er da, gewänne er jedes
 * Verzeichnis — und dieser Prüfstand hätte den Nachschlagweg nie betreten.
 */
const PROTOKOLL = [
  {
    // `user.approve` steht in `KONTO_ZIEL_AKTIONEN` (`auditEventDetail.ts:116-131`): sein Ziel wird
    // als Konto gelesen. Der Akteur ist im Verzeichnis, das Ziel nicht.
    seq: 1,
    at: "2026-09-12T08:00:00.000Z",
    actor: ADMIN_ID,
    action: "user.approve",
    target: GELOESCHT_ID,
    payload: {},
    prevHash: "",
    hash: "h1",
  },
  {
    // `ko.created` steht NICHT in der Liste: sein Ziel ist ein Wissensobjekt. Die Zeile heisst
    // deshalb „Betroffenes Objekt" und trägt die Kennung OHNE jeden Hinweis (`objektZeile`).
    seq: 2,
    at: "2026-09-12T08:05:00.000Z",
    actor: ADMIN_ID,
    action: "ko.created",
    target: KO_ID,
    payload: {},
    prevHash: "h1",
    hash: "h2",
  },
];

const NUTZER = [
  {
    id: ADMIN_ID,
    name: "Pia Admin",
    email: "pia@klarwerk.test",
    role: "admin" as const,
    approved: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
/**
 * JOB 3853 — DIE EINZIGE ERWEITERUNG DER VORRICHTUNG, KEIN ZWEITER AUFBAU.
 *
 * G5 braucht einen Bestand UND danach eine zweite Abfrage desselben Schlüssels; dafür muss der
 * QueryClient DIESER Montage erreichbar sein. Deshalb legt `mount()` den in ihr erzeugten Client
 * hier ab (kein zweiter `QueryClientProvider`, keine zweite Providerkette), und `afterEach` setzt
 * ihn zurück, damit kein Fall den Client des vorigen auffrischt.
 */
let queryClient: QueryClient | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  // JOB 3853: derselbe eine Client wie bisher — nur zusätzlich gemerkt, damit G5 eine Auffrischung
  // desselben Schlüssels auslösen kann (`verzeichnisAuffrischen`).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient = client;
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [url] },
                  createElement(AppShell, null, createElement(Admin)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

/**
 * JOB 3853: eine Auffrischung des Schlüssels `["directory"]` anstoßen — der Schritt, der die zwei
 * Lagen mit sichtbarem Bestand überhaupt erst herstellt (`hooks.ts:205`).
 *
 * Das Versprechen wird ABSICHTLICH nicht abgewartet: in der Lage `laeuftNach` löst die Antwort nie
 * auf (Mockregel oben), ein `await` bliebe dort für immer stehen. Gemessen wird deshalb der
 * Zwischenzustand nach dem Durchlauf der Warteschlange.
 */
async function verzeichnisAuffrischen(): Promise<void> {
  const client = queryClient;
  if (client === null) {
    throw new Error(
      "die Vorrichtung kann keine Auffrischung auslösen: mount() hat keinen QueryClient hinterlegt",
    );
  }
  await act(async () => {
    void client.refetchQueries({ queryKey: ["directory"] }).catch(() => {});
    await flush();
  });
}

/**
 * JOB 3853: den echten Online-Zustand schalten — dieselbe Quelle, die `useIstOnline`
 * (`zeilenWert.ts:141-151`) beobachtet. INNERHALB von `act`, sonst meldet React eine unerwartete
 * Zustandsänderung (LEHREN JOB 3044 R4).
 */
async function netzSchalten(an: boolean): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(an);
    await flush();
  });
}

async function click(el: Element | null | undefined, was: string): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element zum Klicken fehlt: ${was}`);
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

async function seitenhilfeOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'), "Zahnrad");
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'), "Seitenhilfe");
}

const gestrafft = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

function listentext(): string {
  return gestrafft(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent);
}

/** Der Wert EINER Sprache aus ihrer eigenen Ressource — ohne Rückfall auf „de". */
function sprachressource(sprache: string, key: string): string {
  const bundle = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  const wert = bundle?.[key];
  return typeof wert === "string" ? wert : "";
}

/** Die Detailzeile eines Protokolleintrags: `<dd>` zu einer Beschriftung innerhalb eines Eintrags. */
function zeile(seq: number, labelKey: string): HTMLElement | null {
  const eintrag = container.querySelector(`[data-audit-eintrag="${seq}"]`);
  const dd = eintrag?.querySelector(`[data-audit-zeile="${labelKey}"]`);
  return dd instanceof HTMLElement ? dd : null;
}

/**
 * DER ABLEITUNGSSCHRITT, auf dem diese Datei ruht.
 *
 * Die Zeile trägt bei `kind: "id"` zwei Teile: den Hinweis und die Kennung (`DetailWert`,
 * `AdminSicherheitDetails.tsx`). Was übrig bleibt, wenn man die Kennung abzieht, IST der Hinweis —
 * in der Sprache, in der die Oberfläche gerade steht. Diese Zeichenkette wird nicht mit einer
 * Erwartung verglichen, sondern im Hilfetext GESUCHT.
 */
function hinweisNeben(seq: number, labelKey: string, id: string): string {
  const dd = zeile(seq, labelKey);
  if (dd === null) {
    throw new Error(`Zeile fehlt: Eintrag ${seq}, ${labelKey}`);
  }
  const roh = gestrafft(dd.textContent);
  if (!roh.includes(id)) {
    throw new Error(`Zeile ${labelKey} trägt die Kennung „${id}" gar nicht: „${roh}"`);
  }
  return roh.replace(id, "").trim();
}

beforeEach(async () => {
  for (const k of Object.keys(ANTWORTEN)) {
    delete ANTWORTEN[k];
  }
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
    container.remove();
    root = null;
  }
  queryClient = null;
  vi.clearAllMocks();
});

const PROTOKOLL_URL = "/admin?bereich=sicherheit&detail=protokoll";

// ------------------------------------------------------------------------------------------------
// G0 — KALIBRIERUNG: der neue Mock ANTWORTET wirklich.
// ------------------------------------------------------------------------------------------------
// Ohne diesen Fall wäre jede Aussage darunter wertlos: antwortete der Mock nicht, stünde die Karte
// in „lädt", es gäbe keine Zeilen, und die abgeleiteten Fälle liefen ins Leere statt rot zu werden.
describe("JOB 3670 R2 · G0 · die Karte hat wirklich geladene Daten vor sich", () => {
  it("das Prüfprotokoll zeichnet beide Einträge mit ihren beschrifteten Zeilen", async () => {
    ANTWORTEN["audit.list"] = PROTOKOLL;
    ANTWORTEN["directory.list"] = VERZEICHNIS;
    await mount(PROTOKOLL_URL);

    expect(
      container.querySelector('[data-testid="detail-pruefprotokoll"]'),
      "die Prüfprotokollkarte steht gar nicht da",
    ).not.toBeNull();
    for (const e of PROTOKOLL) {
      expect(
        container.querySelector(`[data-audit-eintrag="${e.seq}"]`),
        `Eintrag ${e.seq} fehlt — der Mock hat nicht geantwortet, die Karte steht in „lädt"`,
      ).not.toBeNull();
    }
    // Der Akteur steht im Verzeichnis: hier gewinnt der NAME, und es gibt keinen Hinweis.
    expect(
      gestrafft(zeile(1, "audit.detail.actor")?.textContent),
      "der Name des Akteurs wurde nicht aus dem Verzeichnis aufgelöst",
    ).toContain("Pia Admin");
  });
});

// ------------------------------------------------------------------------------------------------
// G1 — DER FALL, DEN DIE HILFE GELEUGNET HAT: geladenes Verzeichnis, Kennung fehlt darin.
// ------------------------------------------------------------------------------------------------
// BENs Messung im Wortlaut: „Verzeichnis erfolgreich geladen; betroffene Zeile = Konto nicht mehr
// vorhandengeloescht-konto". Die Karte trifft hier sehr wohl eine Aussage ÜBER das Konto — und der
// alte Hilfetext sagte, sie tue das nicht und das Verzeichnis sei nicht lesbar gewesen.
describe("JOB 3670 R2 · G1 · „Konto nicht mehr vorhanden“ ist eine Aussage, und die Hilfe sagt das", () => {
  it("die Karte zeigt den Hinweis bei ERFOLGREICH geladenem Verzeichnis", async () => {
    ANTWORTEN["audit.list"] = PROTOKOLL;
    ANTWORTEN["directory.list"] = VERZEICHNIS;
    await mount(PROTOKOLL_URL);

    // Der Beweis, dass das Verzeichnis wirklich gelesen wurde: eine andere Zeile desselben
    // Eintrags trägt einen daraus aufgelösten Namen. Ein gescheiterter Abruf könnte das nicht.
    expect(
      gestrafft(zeile(1, "audit.detail.actor")?.textContent),
      "das Verzeichnis wurde gar nicht erfolgreich gelesen — G1 misst dann den falschen Zustand",
    ).toContain("Pia Admin");

    const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
    expect(
      hinweis,
      `die betroffene Zeile trägt bei geladenem Verzeichnis nicht die starke Aussage (gelesen: „${hinweis}")`,
    ).toBe(i18n.t("audit.detail.accountGone"));
  });

  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: der Hilfetext nennt genau diesen Hinweis — abgeleitet aus der Karte`, async () => {
      await i18n.changeLanguage(sprache);
      ANTWORTEN["audit.list"] = PROTOKOLL;
      ANTWORTEN["directory.list"] = VERZEICHNIS;
      await mount(PROTOKOLL_URL);

      // 1. Was die Karte JETZT neben die Kennung schreibt — nicht, was hier jemand erwartet hat.
      const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
      expect(hinweis.length, `${sprache}: kein Hinweis neben der Kennung`).toBeGreaterThan(0);

      // 2. Genau dieser Satzteil muss in der Hilfe DIESER Sprache stehen — aus ihrer eigenen
      //    Ressource gelesen, damit ein fehlender Schlüssel nicht über den deutschen Rückfall
      //    still grün wird.
      const hilfe = sprachressource(sprache, "seitenhilfe.admin.protokoll.text");
      expect(
        hilfe.length,
        `${sprache}: die Prüfprotokollhilfe fehlt in dieser Ressource`,
      ).toBeGreaterThan(0);
      expect(
        hilfe,
        `${sprache}: die Karte zeigt „${hinweis}", die Hilfe erklärt diesen Zustand nicht — genau der Befund, mit dem Runde 1 rot wurde`,
      ).toContain(hinweis);

      // 3. Und sie steht auch wirklich im Zahnrad, nicht nur in der Ressource.
      await seitenhilfeOeffnen();
      expect(listentext(), `${sprache}: die Hilfe steht nicht in der Seitenhilfe-Liste`).toContain(
        hilfe,
      );
    });
  }
});

// ------------------------------------------------------------------------------------------------
// G2 — DIE ZWEI SCHWACHEN LAGEN: sie sagen nichts über das Konto, sondern über den Abruf.
// ------------------------------------------------------------------------------------------------
// Beide sehen auf der Fläche fast gleich aus wie G1 — eine Kennung ohne Namen. Sie bedeuten aber
// das Gegenteil. Das ist BENs Promptverbesserung, hier als Prüfstand: „Prüfe jede
// Ursachenerklärung gegen mindestens zwei unterschiedliche Zustände mit ähnlicher Anzeige."
describe("JOB 3670 R2 · G2 · die schwachen Lagen stehen ebenfalls im Hilfetext", () => {
  const LAGEN = [
    {
      key: "nichtAbrufbar",
      // Der Abruf scheitert → `VerzeichnisLage.art = "nichtAbrufbar"` → `nameUnavailable`.
      stelle: (): void => {
        ANTWORTEN["directory.list"] = new Error("BEN: Verzeichnis nicht abrufbar");
      },
      erwartetKey: "audit.detail.nameUnavailable",
    },
    {
      key: "laedt",
      // Nichts gesetzt → das Versprechen löst nie auf → `art = "laedt"` → `nameLoading`.
      stelle: (): void => {},
      erwartetKey: "audit.detail.nameLoading",
    },
  ] as const;

  for (const lage of LAGEN) {
    it(`${lage.key} · die Karte zeigt den schwachen Hinweis, nicht die starke Aussage`, async () => {
      ANTWORTEN["audit.list"] = PROTOKOLL;
      lage.stelle();
      await mount(PROTOKOLL_URL);

      const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
      expect(hinweis, `${lage.key}: falscher Hinweis neben der Kennung`).toBe(
        i18n.t(lage.erwartetKey),
      );
      // Das Entscheidende: die starke Aussage fällt hier NICHT. Ohne diesen Satz wäre der Fall
      // auch dann grün, wenn die Karte in jeder Lage „Konto nicht mehr vorhanden" schriebe.
      expect(
        hinweis,
        `${lage.key}: die Karte behauptet eine Kontolöschung, obwohl das Verzeichnis gar nicht belastbar ist`,
      ).not.toBe(i18n.t("audit.detail.accountGone"));
    });

    for (const sprache of ["de", "en", "nl"] as const) {
      it(`${lage.key} · ${sprache}: der Hilfetext nennt auch diesen Hinweis`, async () => {
        await i18n.changeLanguage(sprache);
        ANTWORTEN["audit.list"] = PROTOKOLL;
        lage.stelle();
        await mount(PROTOKOLL_URL);

        const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
        const hilfe = sprachressource(sprache, "seitenhilfe.admin.protokoll.text");
        expect(
          hilfe,
          `${lage.key}/${sprache}: die Karte zeigt „${hinweis}", die Hilfe erklärt diesen Zustand nicht`,
        ).toContain(hinweis);
      });
    }
  }
});

// ------------------------------------------------------------------------------------------------
// G3 — DER VIERTE FALL: ein Ziel, das gar kein Konto ist. NUR hier behauptet die Karte nichts.
// ------------------------------------------------------------------------------------------------
// Der alte Hilfetext hat diesen Satz („die Karte behauptet nichts über das Konto") auf ALLE
// Kennungen ohne Namen angewandt. Er gilt aber genau hier — und hier trägt die Zeile deshalb auch
// gar keinen Hinweis, sondern nur die Kennung.
describe("JOB 3670 R2 · G3 · beim betroffenen Objekt steht die Kennung ohne jeden Zusatz", () => {
  it("die Objektzeile trägt keinen Hinweis — auch nicht bei frischem Verzeichnis", async () => {
    ANTWORTEN["audit.list"] = PROTOKOLL;
    ANTWORTEN["directory.list"] = VERZEICHNIS;
    await mount(PROTOKOLL_URL);

    // Die Zeile heisst anders als bei einem Konto: `objektZeile` vergibt `targetObject`.
    expect(
      zeile(2, "audit.detail.target"),
      "das Wissensobjekt wurde als KONTO gelesen — dann behauptete die Karte eine Kontolöschung über ein Wissensobjekt",
    ).toBeNull();
    const rest = hinweisNeben(2, "audit.detail.targetObject", KO_ID);
    expect(
      rest,
      `neben der Objektkennung steht ein Zusatz („${rest}") — hier wird gar nichts nachgeschlagen, es darf auch nichts dastehen`,
    ).toBe("");
  });

  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: der Hilfetext nennt den Objektfall beim Namen`, async () => {
      // Das Wort, unter dem die Zeile auf der Fläche steht — aus der Beschriftung des Produkts
      // abgeleitet („Betroffenes Objekt" / „Affected object" / „Betrokken object"), nicht
      // abgeschrieben. Der Hilfetext muss es führen, sonst ist der vierte Fall wieder unbenannt.
      const label = sprachressource(sprache, "audit.detail.targetObject");
      const objektwort = label.split(/\s+/).pop() ?? "";
      expect(objektwort.length, `${sprache}: die Beschriftung ist leer`).toBeGreaterThan(2);
      const hilfe = sprachressource(sprache, "seitenhilfe.admin.protokoll.text");
      expect(
        hilfe,
        `${sprache}: die Hilfe nennt „${objektwort}" nicht — dann bleibt offen, wann die Karte wirklich nichts behauptet`,
      ).toContain(objektwort);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// G4 — DIE ZWEITE PRÜFLÜCKE DES PRÜFERS: der GELADENE Zweig der Kontokarte.
// ------------------------------------------------------------------------------------------------
// BEN, Prüflücke 6: „Außerdem den geladenen Nutzerzweig testen: Seine separate Anmeldung in
// `AdminKontenDetails.tsx` wird durch den dauerhaft ladenden Mock nicht erreicht." Stimmt — der
// Wächter nebenan hat immer nur den „Konto nicht gefunden"-Zweig gesehen. Die Anmeldung steht in
// BEIDEN Zweigen; bewiesen war bisher nur einer.
describe("JOB 3670 R2 · G4 · die Kontohilfe steht auch im geladenen Zweig", () => {
  it("mit vorhandenem Konto rendert der Bedienzweig — und die Seitenhilfe ist da", async () => {
    ANTWORTEN["users.list"] = NUTZER;
    await mount(`/admin?bereich=konten&detail=nutzer:${ADMIN_ID}`);

    // Beleg, dass wirklich der GELADENE Zweig steht und nicht der „gibt es nicht mehr"-Zweig:
    // die Karte trägt den Namen des Kontos als Titel und zeigt seine E-Mail.
    const karte = container.querySelector('[data-testid="detail-nutzer"]');
    expect(karte, "die Kontokarte fehlt").not.toBeNull();
    const kartentext = gestrafft(karte?.textContent);
    expect(
      kartentext,
      "der geladene Zweig steht nicht — der Mock hat die Nutzerliste nicht beantwortet",
    ).toContain("pia@klarwerk.test");
    expect(kartentext, "die Karte steht im Zweig „Konto gibt es nicht mehr“").not.toContain(
      i18n.t("einst.konten.nutzerWeg"),
    );

    await seitenhilfeOeffnen();
    expect(listentext(), "im geladenen Zweig der Kontokarte fehlt die Seitenhilfe").toContain(
      i18n.t("seitenhilfe.admin.nutzer.text"),
    );
  });
});

// ------------------------------------------------------------------------------------------------
// G5 — DER ALTE BESTAND MIT LAUFENDER ODER GESCHEITERTER AUFFRISCHUNG (JOB 3853).
// ------------------------------------------------------------------------------------------------
// BENs Prüflücke 6 zu JOB 3670 R2, im Dateikopf im Wortlaut. Die Fälle unten stellen die zwei
// Stände her, die `AdminSicherheitDetails.tsx:152` aus der Query-Lage ableitet — mit sichtbarem
// Bestand, was sie von G2 trennt.

/** Der Name, den die Akteurzeile aus dem BESTAND trägt — der Beweis, dass ein Bestand da ist. */
const BESTANDSNAME = "Pia Admin";

/** Mit beantwortetem Protokoll UND Verzeichnis montieren; ohne sichtbaren Bestand ist Schluss. */
async function mitBestandMontieren(): Promise<void> {
  ANTWORTEN["audit.list"] = PROTOKOLL;
  ANTWORTEN["directory.list"] = VERZEICHNIS;
  await mount(PROTOKOLL_URL);
  expect(
    gestrafft(zeile(1, "audit.detail.actor")?.textContent),
    "kein Bestand sichtbar: die Akteurzeile trägt keinen Namen — dann steht die Karte in G2 und dieser Fall misst den falschen Zustand",
  ).toContain(BESTANDSNAME);
}

describe("JOB 3853 · G5 · Bestand sichtbar, Auffrischung unterwegs oder kaputt", () => {
  // KALIBRIERUNG. Ohne sie wäre jeder Fall darunter wertlos: könnte die Vorrichtung gar keine
  // Auffrischung auslösen, stünde die Karte weiter in „frisch" (oder in „lädt"), und die zwei
  // Lagen wären nie hergestellt worden.
  it("Kalibrierung · der Bestand steht, die Auffrischung läuft durch, die starke Aussage fällt", async () => {
    await mitBestandMontieren();
    await verzeichnisAuffrischen();

    expect(
      gestrafft(zeile(1, "audit.detail.actor")?.textContent),
      "nach der Auffrischung ist der Bestand verschwunden — ein alter Bestand wird nie geleert (REGELN §7)",
    ).toContain(BESTANDSNAME);
    const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
    expect(
      hinweis,
      `nach einer ERFOLGREICH abgeschlossenen Auffrischung ist das Fehlen belegt, die Karte sagt aber „${hinweis}" — dann hängt die Auffrischung, und G5 misst unten nur Zufall`,
    ).toBe(i18n.t("audit.detail.accountGone"));
  });

  const LAGEN = [
    {
      key: "laeuftNach",
      // Kein Eintrag mehr → das Versprechen der Auffrischung löst NIE auf (Mockregel oben:
      // `eintrag === undefined`) → `isFetching` bleibt wahr, der Bestand bleibt sichtbar →
      // `stand: "laeuftNach"`. Zugewiesen statt gelöscht, weil `delete` hier gelintet ist
      // (`lint/performance/noDelete`); der Mock prüft ohnehin auf `undefined`.
      stelle: (): void => {
        ANTWORTEN["directory.list"] = undefined;
      },
      erwartetKey: "audit.detail.nameLoading",
      warum: "die noch laufende Antwort kann genau diese Kennung mitbringen",
    },
    {
      key: "veraltet",
      // Die Auffrischung scheitert (`retry: false` steht in `mount()`) → `isError` mit vorhandenen
      // Daten → `nichtAktualisiert` → `stand: "veraltet"`.
      stelle: (): void => {
        ANTWORTEN["directory.list"] = new Error("BEN: Auffrischung gescheitert");
      },
      erwartetKey: "audit.detail.nameUnavailable",
      warum: "der Bestand ist nicht aktuell — das Konto ist damit unbekannt, nicht abwesend",
    },
  ] as const;

  for (const lage of LAGEN) {
    it(`${lage.key} · der schwache Hinweis steht da, obwohl ein Bestand sichtbar ist`, async () => {
      await mitBestandMontieren();
      lage.stelle();
      await verzeichnisAuffrischen();

      const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
      expect(hinweis, `${lage.key}: falscher Hinweis neben der Kennung`).toBe(
        i18n.t(lage.erwartetKey),
      );
      expect(
        hinweis,
        `${lage.key}: die Karte behauptet eine Kontolöschung, obwohl ${lage.warum}`,
      ).not.toBe(i18n.t("audit.detail.accountGone"));
      // Der Trennnachweis zu G2: dort trägt auch die Akteurzeile nur eine Kennung.
      expect(
        gestrafft(zeile(1, "audit.detail.actor")?.textContent),
        `${lage.key}: die Akteurzeile trägt keinen Namen — es gibt gar keinen Bestand, dieser Fall misst dann dieselbe Lage wie G2`,
      ).toContain(BESTANDSNAME);
    });

    for (const sprache of ["de", "en", "nl"] as const) {
      it(`${lage.key} · ${sprache}: der Hilfetext nennt diesen Hinweis — abgeleitet aus der Karte`, async () => {
        await i18n.changeLanguage(sprache);
        await mitBestandMontieren();
        lage.stelle();
        await verzeichnisAuffrischen();

        const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
        expect(
          gestrafft(zeile(1, "audit.detail.actor")?.textContent),
          `${lage.key}/${sprache}: ohne sichtbaren Bestand ist der abgelesene Hinweis der von G2`,
        ).toContain(BESTANDSNAME);
        const hilfe = sprachressource(sprache, "seitenhilfe.admin.protokoll.text");
        expect(
          hilfe.length,
          `${lage.key}/${sprache}: die Prüfprotokollhilfe fehlt in dieser Ressource`,
        ).toBeGreaterThan(0);
        expect(
          hilfe,
          `${lage.key}/${sprache}: die Karte zeigt „${hinweis}", die Hilfe erklärt diesen Zustand nicht`,
        ).toContain(hinweis);
      });
    }
  }

  // DIE DRITTE URSACHE DESSELBEN STANDES: kein Fehler, kein Abruf — nur kein Netz.
  // `zeilenWert.ts:64` macht `pausiert` schon aus `!online` wahr, `:94` führt das ebenfalls auf
  // `nichtAktualisiert`. Ohne diesen Fall wäre die halbe Ursachenmenge von `veraltet` ungemessen.
  it("offline mit Bestand · derselbe Stand ohne gescheiterten Abruf", async () => {
    await mitBestandMontieren();
    try {
      await netzSchalten(false);

      const hinweis = hinweisNeben(1, "audit.detail.target", GELOESCHT_ID);
      expect(hinweis, "offline: falscher Hinweis neben der Kennung").toBe(
        i18n.t("audit.detail.nameUnavailable"),
      );
      expect(
        hinweis,
        "offline: die Karte behauptet eine Kontolöschung, obwohl seit dem Verbindungsabbruch nichts mehr nachgeholt wurde",
      ).not.toBe(i18n.t("audit.detail.accountGone"));
      expect(
        gestrafft(zeile(1, "audit.detail.actor")?.textContent),
        "offline: der Bestand wurde geleert — er bleibt sichtbar (REGELN §7)",
      ).toContain(BESTANDSNAME);
    } finally {
      // Der globale `onlineManager` überlebt den Fall: ohne Rücknahme liefe jeder folgende Fall
      // dieser Datei offline.
      await netzSchalten(true);
    }
  });
});
