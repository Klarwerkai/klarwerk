// @vitest-environment jsdom
// ================================================================================================
// JOB 4363 · H6-D1b — DER STAND DER BEREITSCHAFTSKARTE BEI VERBINDUNGSUNTERBRECHUNG.
// ================================================================================================
//
// DER BEFUND, den dieser Auftrag schliesst: die Bereitschaftskarte beantwortete JEDE Störung ihrer
// sechs Quellen mit demselben Satz — dem `StaleMarker` „Veraltet – Aktualisierung fehlgeschlagen"
// (`components/LoadState.tsx:30-48`), ohne Zeitangabe. Zwei der drei Lagen hat es dabei nie
// gegeben:
//
//   · OHNE NETZ ruht der Abruf. Es gibt keinen gescheiterten Versuch, den man melden könnte —
//     dieselbe Lehre, die `LoadState.tsx:54-59` (JOB 3808) und `i18n.ts` bei `imp.stand.*`
//     (JOB 4293) bereits ausgeschrieben haben.
//   · NACH DER WIEDERVERBINDUNG innerhalb der produktiven Frischefrist (`ZAEHLER_FRISCHE_MS`,
//     30 s, zugleich die `staleTime` des QueryClient in `main.tsx:44`) holt react-query NICHTS
//     nach: die Antworten gelten noch als frisch. Der Hinweis verschwand trotzdem, weil die Karte
//     ihren Befund ohne Störungsgedächtnis bildete — sichtbar blieben dieselben sechs Zahlen von
//     vorhin, und über ihnen stand nichts mehr. Das ist die voreilige Frischmeldung.
//
// WAS HIER GEMESSEN WIRD, und woran es echt ist: die ECHTE Karte (`BereitschaftDetail`) an einem
// ECHTEN QueryClient mit der PRODUKTIVEN Frischefrist, an einem ECHTEN `onlineManager`-Wechsel.
// Nachgebaut ist nichts ausser den sechs Serverantworten; unterschieden wird zwischen automatischer
// Nachholung und manuellem Wiederholweg ausschliesslich an den TATSÄCHLICHEN Abrufzählern der
// sechs Endpunktfunktionen.
//
// Nur `Date` ist virtuell (wie in `tests/h6-d1-nutzerdetail-stand/frischefrist-nachholung.test.tsx`):
// Abfrage- und React-Benachrichtigungen laufen normal, gewartet wird auf Cache- und DOM-Zustände.
// Die lange Unterbrechung kostet deshalb keine echte Wartezeit, und die Frist bleibt die produktive.
//
// WAS HIER NICHT GEMESSEN WIRD: die gebaute Fläche, echter Fokusring, DE/EN/NL und 320 px — das
// misst `bereitschaftstand-im-echten-browser.test.ts` daneben im echten Chromium.
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: { config: vi.fn() },
    analytics: { overview: vi.fn() },
    validation: { board: vi.fn() },
    uploadLimits: { get: vi.fn() },
    external: { policy: vi.fn() },
    admin: { demoStatus: vi.fn() },
  },
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { StrictMode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { useIstOnline } from "../../apps/web/src/components/einstellungen/zeilenWert";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { BereitschaftDetail } from "../../apps/web/src/pages/AdminSicherheitDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = new Date("2026-09-21T08:00:00Z").getTime();

/**
 * Die sechs tragenden Quellen der Karte — dieselbe Menge und dieselbe Reihenfolge wie
 * `readySources` in `AdminSicherheitDetails.tsx`. Sie sind hier die ABRUFZÄHLER: an ihnen, und nur
 * an ihnen, wird unterschieden, ob wirklich ein Abruf stattgefunden hat (Auftrag K4).
 */
const QUELLEN = [
  endpoints.reasoner.config,
  endpoints.analytics.overview,
  endpoints.validation.board,
  endpoints.uploadLimits.get,
  endpoints.external.policy,
  endpoints.admin.demoStatus,
] as unknown as Mock[];

/** Ein vollständiger, echter Bestand. `validiert` unterscheidet den alten vom neuen Stand. */
function bestand(validiert: number): unknown[] {
  return [
    { cloudConfigured: true, localConfigured: false, taskConfig: { global: "auto", perTask: {} } },
    { total: 3, byStatus: { offen: 1, validiert } },
    [],
    { maxAttachments: 10, maxAttachmentBytes: 20_000_000 },
    { enabled: false, stage: "blocked" },
    { present: false, count: 0 },
  ];
}

function antworteMit(validiert: number): void {
  const werte = bestand(validiert);
  QUELLEN.forEach((q, i) => {
    q.mockResolvedValue(werte[i]);
  });
}

/**
 * Alle sechs Antworten offen halten — und JEDE EINZELN auflösen können.
 *
 * RUNDE 2, BENs Korrekturpflicht 1 und seine Promptverbesserung: „Löse zuerst ausschliesslich die
 * ÄLTESTE Quelle auf; halte andere Antworten zurück beziehungsweise lasse eine scheitern." Solange
 * dieser Prüfstand nur alle sechs GEMEINSAM auflösen konnte, war der Fall, an dem Runde 1
 * gescheitert ist, gar nicht herstellbar.
 */
interface OffeneAntworten {
  /** Genau eine Quelle erfolgreich beantworten. */
  erfuelle: (nr: number, validiert: number) => void;
  /** Genau eine Quelle scheitern lassen. */
  lehneAb: (nr: number) => void;
  /** Alle noch offenen Quellen erfolgreich beantworten. */
  erfuellen: (validiert: number) => void;
  /** Alle noch offenen Quellen scheitern lassen. */
  ablehnen: () => void;
}

/**
 * @param sofort Quellen, die OHNE Umweg über den Prüfstand antworten — ihre Antwort steht schon
 *   bereit, wenn react-query sie abruft. Damit entsteht der Fall aus BENs Runde-3-Gegenprobe:
 *   die älteste Quelle ist fertig, bevor React den Zwischenzustand „wird abgerufen" zeichnen
 *   konnte. Ein bestätigter Stand darf davon nicht abhängen.
 */
function antwortenOffen(sofort: readonly number[] = []): OffeneAntworten {
  const ok: ((w: unknown) => void)[] = [];
  const nein: ((e: Error) => void)[] = [];
  const offen = new Set<number>();
  QUELLEN.forEach((q, i) => {
    if (sofort.includes(i)) {
      q.mockResolvedValueOnce(bestand(2)[i]);
      return;
    }
    offen.add(i);
    q.mockReturnValueOnce(
      new Promise<unknown>((erfuellt, abgelehnt) => {
        ok[i] = erfuellt;
        nein[i] = abgelehnt;
      }),
    );
  });
  const erfuelle = (nr: number, validiert: number): void => {
    ok[nr]?.(bestand(validiert)[nr]);
    offen.delete(nr);
  };
  const lehneAb = (nr: number): void => {
    nein[nr]?.(new Error("JOB 4363: Netzfehler"));
    offen.delete(nr);
  };
  return {
    erfuelle,
    lehneAb,
    erfuellen: (validiert) => {
      for (const nr of [...offen]) {
        erfuelle(nr, validiert);
      }
    },
    ablehnen: () => {
      for (const nr of [...offen]) {
        lehneAb(nr);
      }
    },
  };
}

/**
 * Die SONDE: sie zeigt den Onlinezustand, wie ihn das Produkt selbst liest (`useIstOnline`).
 *
 * Sie steht hier, weil eine gescheiterte Zusicherung sonst nicht sagen könnte, WO es hakt — an der
 * Auskunft der Karte oder schon daran, dass der Verbindungswechsel die Fläche gar nicht erreicht.
 */
function Sonde(): JSX.Element {
  return createElement("i", { "data-sonde": String(useIstOnline()) });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

async function bis(pruefen: () => void): Promise<void> {
  await vi.waitFor(
    async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      pruefen();
    },
    // Ausdrücklich grosszügiger als die Vorgabe (1 s): dieser Prüfstand teilt sich die Maschine
    // mit bis zu vier weiteren Läufen, und ein Wartefenster, das unter Last reisst, meldet einen
    // Produktfehler, wo eine Warteschlange war.
    { timeout: 15_000, interval: 10 },
  );
}

/** Ein paar Bilder weiterdrehen, ohne etwas zu erzwingen — für „es passiert NICHTS"-Zusagen. */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function hinweis(): HTMLElement | null {
  return container.querySelector('[data-einst="bereitschaft-stand"]');
}

function hinweisText(): string {
  return hinweis()?.querySelector("span")?.textContent ?? "(kein Hinweis)";
}

function knopf(): HTMLButtonElement | null {
  return hinweis()?.querySelector("button") ?? null;
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Was die SONDE über den Onlinezustand sagt — die Auskunft des Produkts, nicht die des Managers. */
function sonde(): string {
  return container.querySelector("[data-sonde]")?.getAttribute("data-sonde") ?? "(keine Sonde)";
}

/** Die Summe der ECHTEN Abrufe aller sechs Quellen — der Zähler, an dem K4 hängt. */
function abrufe(): number {
  return QUELLEN.reduce((summe, q) => summe + q.mock.calls.length, 0);
}

function stand(zeit: number): string {
  return new Date(zeit).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Die Lage in einer Zeile — für Fehlermeldungen, die auf den Schuldigen zeigen.
 *
 * Ein „expected A to be B" sagt nicht, WORAN die Karte ihre Auskunft festgemacht hat. Hier stehen
 * die drei Grössen, aus denen sie entsteht: der Onlinezustand, der Abrufstatus jeder Quelle und
 * die Lage, die die Karte selbst an den Hinweis geschrieben hat (`data-lage`).
 */
function lagebefund(): string {
  const zustaende = qc
    .getQueryCache()
    .getAll()
    .map((q) => `${JSON.stringify(q.queryKey)}=${q.state.fetchStatus}/${q.state.status}`)
    .join(" ");
  return `online=${onlineManager.isOnline()} lage=${hinweis()?.getAttribute("data-lage") ?? "(kein Hinweis)"} · ${zustaende}`;
}

/**
 * Der Wert EINER Bereitschaftszeile, an ihrer Beschriftung gefunden.
 *
 * Nicht `container.textContent.includes(…)`: „2" oder „0" kommen auf dieser Karte in jeder
 * Zahlenzeile vor, und eine Zusage „die Zahl steht noch da" wäre damit von vornherein wahr. Der
 * Wert ist das letzte `<span>` der Zeile (`AdminSicherheitDetails.tsx`, die Ampelpille).
 */
function zeilenwert(labelKey: string): string {
  const beschriftung = i18n.t(labelKey);
  const zeile = [...container.querySelectorAll("li")].find((li) =>
    (li.querySelector("span")?.textContent ?? "").trim().startsWith(beschriftung),
  );
  const spans = zeile ? [...zeile.querySelectorAll("span")] : [];
  return (spans[spans.length - 1]?.textContent ?? "(keine Zeile)").trim();
}

/**
 * Der sichtbare Bestand der Karte — die Werte, die bei JEDER Störung stehen bleiben müssen.
 *
 * Geprüft wird je Zeile ihr eigener Wert: „10 Anhänge · 20 MB" und die Zahl der validierten
 * Beiträge sind die Tatsachenaussagen, um die es geht.
 */
function werteMuessenStehen(validiert: number): void {
  expect(zeilenwert("adm.ready.upload")).toBe(i18n.t("adm.ready.upload.val", { n: 10, mb: 20 }));
  expect(zeilenwert("adm.ready.ki")).toBe(i18n.t("adm.ready.ki.partial"));
  expect(zeilenwert("adm.ready.validated")).toBe(i18n.t("adm.ready.count", { n: validiert }));
  // Kein Rückfall in den Lade- oder Fehlerweg, solange Bestand da ist.
  expect(text()).not.toContain(i18n.t("adm.ready.loading"));
  expect(container.querySelector('[data-einst="abfrage-fehler"]')).toBeNull();
}

async function online(wert: boolean): Promise<void> {
  await act(async () => onlineManager.setOnline(wert));
}

async function sprache(wert: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(wert);
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  await i18n.changeLanguage("de");
  onlineManager.setOnline(true);
  for (const q of QUELLEN) {
    q.mockReset();
  }
  antworteMit(2);
  // DIE PRODUKTIVE FRISCHEFRIST, nicht eine gesenkte: `staleTime` ist im Produkt genau
  // `ZAEHLER_FRISCHE_MS` (`main.tsx:44`). `retry: false` ist KEINE Absenkung der Frist, sondern
  // nimmt dem Fehlerfall nur die Wiederholung — sonst verzögerte sie jede Messung, ohne an der
  // Aussage etwas zu ändern.
  qc = new QueryClient({
    defaultOptions: { queries: { staleTime: ZAEHLER_FRISCHE_MS, retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(Sonde, null),
          createElement(BereitschaftDetail, { onZurueck: () => {}, onDemodaten: () => {} }),
        ),
      ),
    );
  });
  // KALIBRIERUNG DES AUSGANGSZUSTANDS: vollständiger, frischer Bestand, und KEIN Hinweis. Ohne sie
  // liesse sich „bleibt sichtbar" auch dann behaupten, wenn nie etwas sichtbar war — und
  // „erscheint" auch dann, wenn der Hinweis Dauerinventar wäre.
  await bis(() => {
    werteMuessenStehen(2);
    expect(abrufe()).toBe(6);
    expect(hinweis()).toBeNull();
  });
});

afterEach(async () => {
  act(() => root.unmount());
  qc.clear();
  container.remove();
  onlineManager.setOnline(true);
  vi.useRealTimers();
  await i18n.changeLanguage("de");
});

// ================================================================================================
// K1 · DIE UNTERBRECHUNG OHNE GESCHEITERTEN ABRUF
// ================================================================================================
describe("JOB 4363 K1 · offline ohne Versuch: der Stand bleibt, der Satz erfindet keinen Fehler", () => {
  it("Werte bleiben sichtbar, der Hinweis nennt Stand und Netzlage — und KEINEN Fehlschlag", async () => {
    await online(false);

    expect(hinweis(), "die Karte trägt gar keinen Hinweis").not.toBeNull();
    expect(hinweisText()).toBe(
      `${i18n.t("einst.wert.stand", { zeit: stand(START) })} · ${i18n.t("adm.ready.stand.offline")}`,
    );
    // Der alte Satz behauptete einen Versuch, den es nie gab. Er darf hier nicht stehen.
    expect(text()).not.toContain(i18n.t("loadstate.stale"));
    werteMuessenStehen(2);
  });

  it("und es ist wirklich kein Abruf hinausgegangen — der Satz wäre sonst belegbar", async () => {
    const vorher = abrufe();

    await online(false);
    await ruhe();

    expect(abrufe(), "ohne Netz wurde trotzdem abgerufen").toBe(vorher);
    // Ohne Netz kann ein Knopf nichts bewirken (JOB 3808) — also steht auch keiner da.
    expect(knopf()).toBeNull();
  });
});

// ================================================================================================
// K2 · DER WIRKLICH GESCHEITERTE ABRUF — und der Weg OHNE Bestand
// ================================================================================================
describe("JOB 4363 K2 · gescheiterte Auffrischung: andere Auskunft als offline, gleiche Werte", () => {
  it("dieselben Werte, der Stand dabei, und der Satz unterscheidet sich vom Offlinefall", async () => {
    const antwort = antwortenOffen();
    // NICHT auf `refetchQueries()` warten: seine Zusage ist „alle Abrufe sind SETTLED", und genau
    // das ist hier absichtlich nicht der Fall — die sechs Antworten bleiben offen. Ein `await`
    // darauf innerhalb von `act()` schlösse die act-Klammer nie wieder.
    await act(async () => {
      void qc.refetchQueries().catch(() => undefined);
    });
    await bis(() => expect(abrufe()).toBe(12));
    await act(async () => antwort.ablehnen());

    await bis(() => {
      expect(hinweisText()).toBe(
        `${i18n.t("einst.wert.stand", { zeit: stand(START) })} · ${i18n.t("loadstate.stale")}`,
      );
    });
    expect(hinweisText()).not.toContain(i18n.t("adm.ready.stand.offline"));
    werteMuessenStehen(2);
    // Hier IST ein Versuch gescheitert — der Weg zurück gehört dazu.
    expect(knopf()?.textContent).toContain(i18n.t("loadstate.error.retry"));
    expect(knopf()?.disabled).toBe(false);
  });

  it("ohne Ausgangsdaten bleibt der bestehende Fehlerweg wirksam — keine erfundenen Nullwerte", async () => {
    // Eine zweite, LEERE Karte: sechs Quellen, die nie geantwortet haben.
    act(() => root.unmount());
    for (const q of QUELLEN) {
      q.mockReset().mockRejectedValue(new Error("JOB 4363: von Anfang an tot"));
    }
    qc.clear();
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(BereitschaftDetail, { onZurueck: () => {}, onDemodaten: () => {} }),
        ),
      );
    });

    await bis(() => {
      expect(container.querySelector('[data-einst="abfrage-fehler"]')).not.toBeNull();
    });
    expect(text()).toContain(i18n.t("einst.wert.nichtAbrufbar"));
    expect(text()).toContain(i18n.t("loadstate.error.retry"));
    // Keine erfundene Bereitschaftsbehauptung: ohne Antwort steht GAR KEINE Zeile da — weder
    // „Keine verbunden" noch eine 0 und auch kein „wird geladen" ohne Ende.
    expect(text()).not.toContain(i18n.t("adm.ready.ki.none"));
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(text()).not.toContain(i18n.t("adm.ready.loading"));
    expect(hinweis(), "ein Standhinweis ohne jeden Stand wäre ein Verweis ins Leere").toBeNull();
  });
});

// ================================================================================================
// K3 · DIE WIEDERVERBINDUNG IST KEIN NEUER ABRUF
// ================================================================================================
describe("JOB 4363 K3 · kurze Unterbrechung: erst die neue Antwort erneuert den Stand", () => {
  /** Offline, dann nach der HALBEN Frist wieder online — react-query holt dabei nichts nach. */
  async function kurzeUnterbrechung(): Promise<void> {
    await online(false);
    expect(hinweisText()).toContain(i18n.t("adm.ready.stand.offline"));
    vi.setSystemTime(START + ZAEHLER_FRISCHE_MS / 2);
    await online(true);
    await ruhe();
    // Erst die Sonde, dann die Karte: so sagt ein Fehlschlag, WO es hakt. Meldet die Sonde `true`
    // und die Karte trotzdem „offline", dann hat die Karte nicht neu gezeichnet — genau der Fund
    // dieser Runde, der `standBeiStoerung` von `useState` auf `useRef` gebracht hat.
    expect(sonde(), "der Verbindungswechsel hat die Fläche gar nicht erreicht").toBe("true");
    expect(
      hinweis()?.getAttribute("data-lage"),
      "die Karte zeichnet nach der Wiederverbindung nicht neu",
    ).toBe("adm.ready.stand.netzluecke");
    expect(abrufe(), "die Wiederverbindung hat von selbst abgerufen").toBe(6);
  }

  it("online, aber nichts nachgeholt: der Hinweis bleibt und sagt genau das", async () => {
    await kurzeUnterbrechung();

    expect(hinweis(), "der Hinweis verschwand allein wegen online=true").not.toBeNull();
    expect(hinweisText(), lagebefund()).toBe(
      `${i18n.t("einst.wert.stand", { zeit: stand(START) })} · ${i18n.t("adm.ready.stand.netzluecke")}`,
    );
    werteMuessenStehen(2);
  });

  it("der Wiederholweg ist da, ruft ALLE sechs Quellen und bleibt während des Abrufs verständlich", async () => {
    await kurzeUnterbrechung();
    const retry = knopf();
    expect(retry, "ohne Knopf gibt es keinen manuellen Weg").not.toBeNull();
    expect(retry?.tagName).toBe("BUTTON");
    expect(retry?.tabIndex).toBe(0);
    expect(retry?.disabled).toBe(false);
    retry?.focus();
    expect(document.activeElement, "der Knopf nimmt den Fokus nicht an").toBe(retry);

    const antwort = antwortenOffen();
    await act(async () => retry?.click());
    await bis(() => expect(abrufe()).toBe(12));

    // Während der Abruf läuft: alter Stand, laufende Aktualisierung, Werte unverändert.
    expect(hinweisText()).toBe(
      [
        i18n.t("einst.wert.stand", { zeit: stand(START) }),
        i18n.t("adm.ready.stand.netzluecke"),
        i18n.t("adm.ready.stand.laeuft"),
      ].join(" · "),
    );
    werteMuessenStehen(2);

    // Erst die erfolgreiche neue Antwort ALLER tragenden Quellen erneuert den Stand.
    const neu = START + ZAEHLER_FRISCHE_MS * 4;
    vi.setSystemTime(neu);
    await act(async () => antwort.erfuellen(9));
    await bis(() => {
      expect(text()).toContain(i18n.t("adm.ready.count", { n: 9 }));
      expect(hinweis(), "nach der neuen Antwort steht der Hinweis noch da").toBeNull();
    });

    // Und die nächste Störung merkt sich den NEUEN Stand, keine klebende alte Episode.
    await online(false);
    expect(hinweisText()).toContain(i18n.t("einst.wert.stand", { zeit: stand(neu) }));
  });

  it("scheitert der Wiederholversuch, bleibt der ALTE Stand stehen — nichts wird erneuert", async () => {
    await kurzeUnterbrechung();
    const antwort = antwortenOffen();
    await act(async () => knopf()?.click());
    await bis(() => expect(abrufe()).toBe(12));
    vi.setSystemTime(START + ZAEHLER_FRISCHE_MS * 4);

    await act(async () => antwort.ablehnen());

    await bis(() => {
      expect(hinweisText()).toBe(
        `${i18n.t("einst.wert.stand", { zeit: stand(START) })} · ${i18n.t("loadstate.stale")}`,
      );
    });
    werteMuessenStehen(2);
    expect(knopf()?.disabled).toBe(false);
  });
});

// ================================================================================================
// K2/K3 · SECHS QUELLEN, SECHS ALTER — BENs KORREKTURPFLICHT 1 AUS RUNDE 1
// ================================================================================================
//
// DER BEFUND, den BEN an Runde 1 gemessen hat: die Karte merkte sich EINE Zahl, den Gruppenstand
// bei Störungsbeginn. Der Gruppenstand ist aber das MINIMUM der sechs Quellen. Antwortet
// ausgerechnet die ÄLTESTE, steigt dieses Minimum auf den Stand der zweitältesten — ohne dass
// eine der anderen fünf etwas Neues geliefert hätte. BENs zwei Messungen:
//
//   · Ausgangsstand 09:58, nur die älteste Quelle antwortet, fünf bleiben `fetching` →
//     sichtbar war „Stand von 09:59 · wird gerade aufgefrischt". Der alte Stand UND der
//     Netzlückensatz waren fort.
//   · Älteste erfolgreich, eine andere gescheitert → „Stand von 09:59 · Veraltet – Aktualisierung
//     fehlgeschlagen", wo 09:58 hätte stehen müssen.
//
// Dieser Abschnitt stellt genau diese Lage her — mit WIRKLICH unterschiedlichen Abrufzeitpunkten,
// nicht mit einem nachgebauten Cache — und hält beide Fälle dauerhaft fest.
describe("JOB 4363 K2/K3 · unterschiedlich alte Quellen: eine Teilantwort erneuert nichts", () => {
  /** Die älteste Quelle ist eine Minute älter als die anderen fünf. */
  const ALT = START;
  const NEU = START + 60_000;
  const SPAET = START + 120_000;
  const SPAETER = START + 180_000;
  const ZULETZT = START + 240_000;

  /** Genau EINE Quelle offen halten — die anderen antworten weiter wie eingestellt. */
  function antwortOffenFuer(nr: number): { erfuelle: (v: number) => void } {
    let ok!: (w: unknown) => void;
    QUELLEN[nr]?.mockReturnValueOnce(
      new Promise<unknown>((erfuellt) => {
        ok = erfuellt;
      }),
    );
    return { erfuelle: (v) => ok(bestand(v)[nr]) };
  }

  /** Die Abrufstände aller Quellen, aufsteigend — der Beleg, dass sie wirklich verschieden sind. */
  function staende(): number[] {
    return qc
      .getQueryCache()
      .getAll()
      .map((q) => q.state.dataUpdatedAt)
      .sort((a, b) => a - b);
  }

  function standtext(zeit: number): string {
    return i18n.t("einst.wert.stand", { zeit: stand(zeit) });
  }

  /**
   * Die TATSÄCHLICHEN Stände der Staffelung — gemessen, nicht angenommen.
   *
   * `vi.waitFor` treibt die virtuelle Uhr in Millisekundenschritten weiter (Wartetakt 10 ms), und
   * `dataUpdatedAt` trägt deshalb nicht exakt die gesetzte Zahl. Auf die Anzeige (HH:MM) wirkt
   * sich das nicht aus, auf eine Zeichengleichheit im Test sehr wohl. Gemessen wird deshalb der
   * echte Wert und geprüft, dass der Abstand wirklich grösser ist als die Frist.
   */
  let gestaffelt = { alt: 0, neu: 0 };

  /**
   * Eine Karte, deren sechs Quellen NICHT gleich alt sind: die erste antwortet um ALT, die
   * übrigen fünf eine Minute später um NEU. Der Gruppenstand ist damit ALT.
   */
  async function mitGestaffeltemBestand(): Promise<void> {
    act(() => root.unmount());
    qc.clear();
    for (const q of QUELLEN) {
      q.mockReset();
    }
    antworteMit(2);
    const erste = antwortenOffen();
    vi.setSystemTime(ALT);
    root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(
            QueryClientProvider,
            { client: qc },
            createElement(Sonde, null),
            createElement(BereitschaftDetail, { onZurueck: () => {}, onDemodaten: () => {} }),
          ),
        ),
      );
    });
    await bis(() => expect(abrufe()).toBe(6));
    await act(async () => erste.erfuelle(0, 2));
    vi.setSystemTime(NEU);
    await act(async () => erste.erfuellen(2));
    // KALIBRIERUNG: vollständiger Bestand, kein Hinweis — und die Alter sind WIRKLICH verschieden.
    await bis(() => {
      werteMuessenStehen(2);
      expect(hinweis()).toBeNull();
    });
    gestaffelt = { alt: staende()[0] ?? 0, neu: staende()[5] ?? 0 };
    expect(
      gestaffelt.neu - gestaffelt.alt,
      "die sechs Quellen sind gar nicht unterschiedlich alt — dann misst dieser Fall nichts",
    ).toBeGreaterThan(ZAEHLER_FRISCHE_MS);
    expect(stand(gestaffelt.alt), "die älteste Quelle steht nicht auf der ALT-Minute").toBe(
      stand(ALT),
    );
    expect(stand(gestaffelt.neu), "die jüngsten Quellen stehen nicht auf der NEU-Minute").toBe(
      stand(NEU),
    );
  }

  it("BEN 1 · nur die ÄLTESTE Quelle antwortet nach — Stand und Netzlückensatz bleiben", async () => {
    await mitGestaffeltemBestand();

    // Die Störung öffnet sich OHNE einen einzigen Abruf: die Verbindung fällt weg.
    await online(false);
    expect(hinweisText(), lagebefund()).toBe(
      `${standtext(gestaffelt.alt)} · ${i18n.t("adm.ready.stand.offline")}`,
    );
    expect(abrufe(), "ohne Netz wurde abgerufen").toBe(6);

    // Wieder online: react-query holt GENAU die abgelaufene älteste Quelle nach (60 s alt, Frist
    // 30 s); die fünf jüngeren sind noch frisch und werden nicht angefasst. Das ist BENs Lage,
    // hergestellt vom Produkt selbst und nicht nachgebaut.
    const nachhol = antwortOffenFuer(0);
    await online(true);
    await bis(() => expect(abrufe()).toBe(7));
    expect(hinweisText(), lagebefund()).toBe(
      [
        standtext(gestaffelt.alt),
        i18n.t("adm.ready.stand.netzluecke"),
        i18n.t("adm.ready.stand.laeuft"),
      ].join(" · "),
    );

    // Und jetzt der Kern: sie antwortet — und ALLEIN das erneuert den Stand NICHT.
    vi.setSystemTime(SPAET);
    await act(async () => nachhol.erfuelle(2));
    await bis(() => expect(qc.isFetching()).toBe(0));

    expect(hinweisText(), `eine einzige Teilantwort hat den Stand erneuert — ${lagebefund()}`).toBe(
      `${standtext(gestaffelt.alt)} · ${i18n.t("adm.ready.stand.netzluecke")}`,
    );
    // Der Gruppenstand IST inzwischen gestiegen — genau daran ist Runde 1 gescheitert.
    expect(staende()[0], "die Vorbedingung fehlt: der Gruppenstand ist gar nicht gestiegen").toBe(
      gestaffelt.neu,
    );
    expect(hinweisText()).not.toContain(stand(gestaffelt.neu));
    werteMuessenStehen(2);
    expect(knopf(), "der manuelle Weg fehlt, obwohl fünf Antworten ausstehen").not.toBeNull();
  });

  it("BEN 2 · fünf gelingen, eine scheitert — der bestätigte Stand von damals bleibt stehen", async () => {
    await mitGestaffeltemBestand();
    await online(false);
    const nachhol = antwortOffenFuer(0);
    await online(true);
    await bis(() => expect(abrufe()).toBe(7));
    vi.setSystemTime(SPAET);
    await act(async () => nachhol.erfuelle(2));
    await bis(() => expect(qc.isFetching()).toBe(0));

    // Wiederholen: alle sechs gehen hinaus, fünf gelingen, die Kennzahlquelle scheitert.
    const runde = antwortenOffen();
    await act(async () => knopf()?.click());
    await bis(() => expect(abrufe()).toBe(13));
    vi.setSystemTime(SPAETER);
    await act(async () => runde.lehneAb(1));
    await act(async () => runde.erfuellen(2));

    await bis(() => {
      expect(hinweisText(), `der Teilfehler hat den Stand erneuert — ${lagebefund()}`).toBe(
        `${standtext(gestaffelt.alt)} · ${i18n.t("loadstate.stale")}`,
      );
    });
    expect(hinweisText()).not.toContain(stand(gestaffelt.neu));
    expect(hinweisText()).not.toContain(stand(SPAETER));
    werteMuessenStehen(2);

    // Erst wenn AUSNAHMSLOS jede Quelle neu geantwortet hat, ist die Episode vorbei.
    vi.setSystemTime(ZULETZT);
    antworteMit(9);
    await act(async () => knopf()?.click());
    await bis(() => {
      expect(zeilenwert("adm.ready.validated")).toBe(i18n.t("adm.ready.count", { n: 9 }));
      expect(hinweis(), "nach der vollständigen Erneuerung steht der Hinweis noch da").toBeNull();
    });
    // Und die nächste Störung merkt sich den NEUEN Stand.
    await online(false);
    expect(hinweisText()).toBe(`${standtext(ZULETZT)} · ${i18n.t("adm.ready.stand.offline")}`);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // BEN 3 · DIE REIHENFOLGE OHNE VORHERIGE OFFLINEPHASE (Korrekturpflicht aus Runde 2)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  //
  // BENs Messung an Runde 2: Stände 10:00 (älteste) und 10:01 (fünf). Auffrischung OHNE vorherige
  // Offlinephase — die älteste antwortet zuerst ERFOLGREICH, erst danach scheitert eine andere.
  // Sichtbar war „Stand von 10:01 · Veraltet – Aktualisierung fehlgeschlagen", richtig ist 10:00.
  //
  // Der Grund lag im Zeitpunkt des Merkens: Runde 2 legte das Gedächtnis erst beim FEHLER an, und
  // da stand die neue Zahl der ältesten Quelle bereits darin. Gemerkt wird jetzt mit dem Beginn
  // der AUFFRISCHUNG. Dieser Fall hält die Reihenfolge dauerhaft fest.
  it("BEN 3 · Teilantwort VOR dem ersten Fehler zieht den bestätigten Stand nicht vor", async () => {
    await mitGestaffeltemBestand();

    // Eine ganz gewöhnliche Auffrischung — keine Unterbrechung, kein Fehler, kein Klick.
    const runde = antwortenOffen();
    await act(async () => {
      void qc.refetchQueries().catch(() => undefined);
    });
    await bis(() => expect(abrufe()).toBe(12));

    // Sie ist KEINE Störung: ruhige Zeile mit dem bestätigten Stand, kein Warnsatz, kein Knopf.
    expect(hinweisText(), lagebefund()).toBe(
      `${standtext(gestaffelt.alt)} · ${i18n.t("adm.ready.stand.laeuft")}`,
    );
    expect(knopf(), "eine störungsfreie Auffrischung bietet einen Wiederholen-Knopf an").toBeNull();

    // Die ÄLTESTE Quelle antwortet zuerst — erfolgreich. Der Gruppenstand steigt damit von der
    // ALT- auf die NEU-Zahl; der BESTÄTIGTE Stand darf das nicht mitmachen.
    vi.setSystemTime(SPAET);
    await act(async () => runde.erfuelle(0, 2));
    await bis(() => expect(staende()[0]).toBe(gestaffelt.neu));
    expect(hinweisText(), lagebefund()).toBe(
      `${standtext(gestaffelt.alt)} · ${i18n.t("adm.ready.stand.laeuft")}`,
    );

    // UND ERST JETZT scheitert eine andere Quelle. Genau hier stand in Runde 2 die falsche Zahl.
    vi.setSystemTime(SPAETER);
    await act(async () => runde.lehneAb(1));
    await bis(() => {
      expect(
        hinweisText(),
        `der Teilerfolg vor dem Fehler hat den Stand vorgezogen — ${lagebefund()}`,
      ).toBe(
        [
          standtext(gestaffelt.alt),
          i18n.t("loadstate.stale"),
          i18n.t("adm.ready.stand.laeuft"),
        ].join(" · "),
      );
    });
    expect(hinweisText()).not.toContain(stand(gestaffelt.neu));
    expect(hinweisText()).not.toContain(stand(SPAET));
    werteMuessenStehen(2);
    expect(knopf(), "jetzt IST es eine Störung — der Ausweg fehlt").not.toBeNull();

    // Und erst die vollständige Erneuerung beendet die Episode.
    vi.setSystemTime(ZULETZT);
    antworteMit(9);
    await act(async () => runde.erfuellen(9));
    await act(async () => knopf()?.click());
    await bis(() => {
      expect(zeilenwert("adm.ready.validated")).toBe(i18n.t("adm.ready.count", { n: 9 }));
      expect(hinweis(), "nach der vollständigen Erneuerung steht der Hinweis noch da").toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // BEN 4 · DIE SCHNELLE TEILANTWORT — OHNE ERZWUNGENEN ZWISCHENRENDER (Runde 3)
  // ══════════════════════════════════════════════════════════════════════════════════════════
  //
  // BENs Gegenprobe an Runde 3: Der Fall BEN 3 darüber wartet nach dem Abrufbeginn mit
  // `bis(() => expect(abrufe()).toBe(12))` — und ERZWINGT damit ein Bild, in dem die Auffrischung
  // läuft und noch keine Antwort da ist. Genau dieses Bild brauchte Runde 3, um sich den Stand zu
  // merken. Nimmt man die Wartezeile weg und lässt die älteste Quelle SOFORT antworten, gab es
  // dieses Bild nie: „Stand von 10:01" statt „Stand von 10:00".
  //
  // Hier antwortet die älteste Quelle deshalb ohne jeden Umweg (`antwortenOffen([0])` legt eine
  // bereits fertige Antwort bereit), und zwischen Abrufbeginn und erster Antwort wird NICHTS
  // abgewartet. Ein bestätigter Stand darf nicht davon abhängen, ob die Oberfläche den
  // Zwischenzustand gezeichnet hat.
  it("BEN 4 · die älteste Quelle antwortet SOFORT — ohne Zwischenbild bleibt der Stand derselbe", async () => {
    await mitGestaffeltemBestand();

    // Kein `bis(...)` zwischen Abrufbeginn und Antwort: die Quelle 0 ist schon fertig, wenn
    // react-query sie ruft. Die anderen fünf bleiben offen.
    const runde = antwortenOffen([0]);
    vi.setSystemTime(SPAET);
    await act(async () => {
      void qc.refetchQueries().catch(() => undefined);
    });

    // Der Gruppenstand IST gestiegen — die Vorbedingung dieses Falls, gemessen statt angenommen.
    await bis(() => expect(staende()[0]).toBe(gestaffelt.neu));

    // Und jetzt der Fehler. Der bestätigte Stand muss der von VORHER sein.
    vi.setSystemTime(SPAETER);
    await act(async () => runde.lehneAb(1));
    await bis(() => {
      expect(
        hinweisText(),
        `die schnelle Teilantwort hat den Stand vorgezogen — ${lagebefund()}`,
      ).toBe(
        [
          standtext(gestaffelt.alt),
          i18n.t("loadstate.stale"),
          i18n.t("adm.ready.stand.laeuft"),
        ].join(" · "),
      );
    });
    expect(hinweisText()).not.toContain(stand(gestaffelt.neu));
    werteMuessenStehen(2);
  });
});

// ================================================================================================
// K4 · KURZ GEGEN LANG, AUTOMATISCH GEGEN MANUELL
// ================================================================================================
describe("JOB 4363 K4 · die Frist entscheidet, welcher Weg überhaupt läuft", () => {
  it("die Frist ist die produktive und ungesenkt: 30 s, dieselbe Zahl wie die staleTime", () => {
    expect(ZAEHLER_FRISCHE_MS).toBe(30_000);
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(ZAEHLER_FRISCHE_MS);
  });

  it("lange Unterbrechung: die Wiederverbindung holt von SELBST nach, ohne einen Klick", async () => {
    await online(false);
    expect(hinweisText()).toContain(i18n.t("adm.ready.stand.offline"));

    vi.setSystemTime(START + ZAEHLER_FRISCHE_MS + 1);
    const antwort = antwortenOffen();
    await online(true);

    await bis(() => expect(abrufe()).toBe(12));
    // Bis die Antwort da ist, bleibt der alte Stand markiert — kein vorschnelles „frisch".
    expect(hinweisText()).toContain(i18n.t("einst.wert.stand", { zeit: stand(START) }));
    expect(hinweisText()).toContain(i18n.t("adm.ready.stand.laeuft"));
    expect(
      knopf(),
      "auch während der Nachholung bleibt der manuelle Weg erreichbar",
    ).not.toBeNull();

    const neu = START + ZAEHLER_FRISCHE_MS * 4;
    vi.setSystemTime(neu);
    await act(async () => antwort.erfuellen(5));
    await bis(() => {
      expect(text()).toContain(i18n.t("adm.ready.count", { n: 5 }));
      expect(hinweis()).toBeNull();
    });
  });

  it("kurze Unterbrechung: KEIN automatischer Abruf — der Unterschied steht im Zähler", async () => {
    await online(false);
    vi.setSystemTime(START + ZAEHLER_FRISCHE_MS / 2);
    await online(true);
    await ruhe();

    expect(abrufe(), "innerhalb der Frist wurde automatisch nachgeholt").toBe(6);
    const vorher = abrufe();
    await act(async () => knopf()?.click());
    await bis(() => expect(abrufe()).toBe(vorher + 6));
  });

  it("kein unaufgeforderter Abrufdienst: ohne Ereignis bleibt der Zähler stehen", async () => {
    const vorher = abrufe();
    vi.setSystemTime(START + ZAEHLER_FRISCHE_MS * 10);
    await ruhe();
    await ruhe();

    expect(abrufe(), "die Karte ruft von sich aus im Takt ab").toBe(vorher);
    expect(hinweis(), "ohne Störung entsteht auch kein Hinweis").toBeNull();
  });
});

// ================================================================================================
// K5-Teilbeleg · DIE DREI SPRACHEN TRAGEN DIE DREI SÄTZE
// ================================================================================================
//
// Der vollständige K5-Nachweis (gebaute Fläche, echter Fokusring, 320 px) steht in
// `bereitschaftstand-im-echten-browser.test.ts`. Hier wird nur das nachgemessen, was diese Bühne
// wirklich zeigen kann: dass jede Sprache einen EIGENEN, nicht leeren und nicht deutschen Satz
// hat — ein durchgereichter Rohschlüssel oder eine deutsche Rückfallzeile fiele sonst niemandem auf.
describe("JOB 4363 K5-Teilbeleg · DE/EN/NL tragen je eigene Sätze", () => {
  for (const lang of ["de", "en", "nl"]) {
    it(`${lang}: der Offlinesatz ist übersetzt und unterscheidet sich vom Fehlersatz`, async () => {
      await sprache(lang);
      await online(false);

      const offline = i18n.t("adm.ready.stand.offline");
      expect(offline).not.toBe("adm.ready.stand.offline");
      expect(offline).not.toContain("{{");
      expect(offline).not.toBe(i18n.t("loadstate.stale"));
      expect(hinweisText()).toContain(offline);
      if (lang !== "de") {
        expect(offline).not.toBe("ohne Netzverbindung nicht aktualisiert");
      }
    });
  }
});
