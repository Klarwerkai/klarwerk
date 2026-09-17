// @vitest-environment jsdom
// ================================================================================================
// JOB 4293 · S — § 9 AN DER ECHTEN PRÜFKARTE: WIE FRISCH IST DAS, WAS ICH DA ANNEHME?
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI ERZWUNGEN HAT (Ben, Runde 1, wörtlich): „frischer Kandidat bedienbar;
// offline, Auffrischung paused; disabled=false". Der Volltext-Rundlauf war grün — und trotzdem
// konnte ein Mensch ohne Netz einen Stand von vorhin in den Bestand übernehmen, ohne dass die Karte
// ein Wort dazu sagte. Der Rundlauf kann das nicht sehen: er fährt genau EINEN Zustand, den
// gesunden.
//
// DIE STRECKE IST DER GEGENSTAND, nicht ein Standbild — dieselbe Doktrin wie in
// `tests/import-lauf-kennung/laufakte-offline-pausiert.test.tsx`: frisch gelesen → Auffrischung
// läuft → offline angehalten → Auffrischung gescheitert → erfolgreiche Wiederaufnahme. Der
// Vorbehalt muss KOMMEN und wieder GEHEN. Ein Vorbehalt, der klebt, wäre die andere Halbheit.
//
// KEIN DOPPELGÄNGER DES HAKENS. Es laufen der echte `useImportCandidates`, der echte
// `QueryClient`, der echte `onlineManager` und die echte Seite `ImportReview`; die Antworten kommen
// aus der ECHTEN App über `app.inject` (`tests/library/job2703-bruecke.ts`). Ersetzt ist allein die
// Leitung dorthin — und zwar sichtbar, an genau einer Stelle (`stoerung`). Nur so misst dieser Fall
// die Zustände, die react-query wirklich herstellt, und nicht die, die ein Testschreiber sich dafür
// ausgedacht hat (Lehre JOB 3357).
//
// WAS HIER AUSDRÜCKLICH NICHT GEMESSEN WIRD: der Volltext-Rundlauf. Er steht in
// `rundlauf-am-echten-socket.test.ts` und `rundlauf-pg.integration.test.ts` und wird hier nicht
// wiederholt. Diese Datei prüft NUR, was die Karte über ihren eigenen Stand sagt und ob „Annehmen"
// daran hängt — dass der Volltext dabei stehen BLEIBT, gehört dazu (REGELN § 7: eine gescheiterte
// Auffrischung leert nichts).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
// Die Frischefrist des Produkts steht an EINER Stelle (`lib/loadingState.ts`) und wird in
// `main.tsx:44` zum `staleTime` der Abfragen. Dieser Prüfstand liest sie von dort.
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";
import { JOB, KERNAUSSAGE, VOLLTEXT_MARKE, volltextHtml } from "./weg";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die Sollwerte kommen aus DEM Katalog des Hauses, nicht aus einer hier eingetippten Abschrift. */
const T = i18n.getFixedT("de");
const TITEL = `${JOB} · Stand der Prüfkarte`;
const SCHLUESSEL = ["import-candidates"];

// ------------------------------------------------------------------------------------------------
// DIE LEITUNG — und die drei Störungen, die auf ihr möglich sind
// ------------------------------------------------------------------------------------------------
//
// Sie sitzt VOR der echten App und betrifft ausschliesslich das LESEN der Warteschlange
// (`GET /api/library/import/candidates`). Alles andere — Anmeldung, Einreihen, Entscheiden — geht
// unverändert durch. Ausserhalb eines Falls ist sie aus (`stoerung = "keine"`).
type Stoerung = "keine" | "haelt" | "fehler";

let stoerung: Stoerung = "keine";
/** Wird aufgerufen, wenn eine gehaltene Leseanfrage weiterlaufen darf. */
let freigeben: (() => void) | null = null;
/**
 * Wie viele Leseanfragen der Warteschlange sind losgelaufen, und wie viele davon kamen ERFOLGREICH
 * zurück? Zwei Zahlen, nicht eine — „es hat einer versucht" und „einer ist angekommen" sind der
 * ganze Unterschied dieses Auftrags (§ 9, Runde 4). Sie werden AN DER LEITUNG gezählt, unabhängig
 * von dem, was react-query über sich selbst sagt.
 */
let leseversuche = 0;
let lesungenErfolgreich = 0;

let b: Bruecke;
let qc: QueryClient;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Ein paar Takte laufen lassen — Abfragen, Auflösungen, Neuzeichnungen. */
async function durchatmen(takte = 10): Promise<void> {
  for (let i = 0; i < takte; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

function istWarteschlangenLesung(eingabe: unknown, init?: RequestInit): boolean {
  const url = String(eingabe);
  const methode = (init?.method ?? "GET").toUpperCase();
  return methode === "GET" && url.includes("/api/library/import/candidates");
}

/** Die Störstelle einbauen. Sie liegt über der Brücke, damit die echte App darunter bleibt. */
function leitungMitStoerung(): () => void {
  const echt = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    if (istWarteschlangenLesung(eingabe, init)) {
      leseversuche += 1;
      if (stoerung === "fehler") {
        // Eine ECHTE Fehlerantwort, keine geworfene Ausnahme: so kommt sie auch vom Server, und so
        // läuft sie durch denselben Weg in `api/client.ts` wie ein 503 aus dem Betrieb.
        return {
          ok: false,
          status: 503,
          statusText: "503",
          headers: { get: () => "application/json" },
          text: async () => JSON.stringify({ error: "Dienst nicht verfügbar" }),
          json: async () => ({ error: "Dienst nicht verfügbar" }),
        };
      }
      if (stoerung === "haelt") {
        await new Promise<void>((r) => {
          freigeben = r;
        });
      }
    }
    const antwort = await echt(eingabe as string, init);
    if (istWarteschlangenLesung(eingabe, init) && antwort.ok) {
      lesungenErfolgreich += 1;
    }
    return antwort;
  }) as unknown as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = echt;
  };
}

let leitungAbbauen: (() => void) | null = null;

async function einreihen(): Promise<void> {
  const res = await b.a.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: b.kopf,
    payload: {
      items: [
        {
          title: TITEL,
          statement: KERNAUSSAGE,
          type: "technik",
          category: "Wartung",
          bodyHtml: volltextHtml(),
        },
      ],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
}

/**
 * Die Seite einhängen.
 *
 * `denselbenSpeicher` behält den QueryClient der vorigen Einhängung — das ist der Unterschied
 * zwischen „neue Seite" und „ich war kurz woanders und komme zurück". Runde 5 braucht ihn: BENs
 * zweite Gegenprobe trennt das Netz, WÄHREND die Import-Seite abgebaut ist, und kehrt mit
 * demselben Zwischenspeicher zurück.
 */
async function mounten(denselbenSpeicher = false): Promise<HTMLElement> {
  // DIE PRODUKTIVE FRISCHEFRIST, nicht eine bequeme (BENs Befund zu Runde 3): `main.tsx:44` setzt
  // `staleTime: ZAEHLER_FRISCHE_MS`. Ohne sie gilt jede Antwort sofort als veraltet, react-query
  // holt beim Wiederverbinden von selbst neu — und der Fall, um den es hier geht (Netz weg, Netz
  // wieder da, KEINE neue Lesung), kann gar nicht entstehen. Der Wert wird aus derselben einen
  // Quelle gelesen wie im Produkt; eine hier eingetippte Zahl wäre die zweite Wahrheit.
  // `retry: false` bleibt: das Produkt setzt 1, und ein Wiederholversuch würde hier nur die
  // Wartezeiten verlängern, ohne die Lage zu ändern (die Störung liegt fest, bis der Fall sie löst).
  if (!denselbenSpeicher) {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: ZAEHLER_FRISCHE_MS } },
    });
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
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
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/import"] },
                    createElement(ImportReview),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await durchatmen();
  // Die Prüfliste steht standardmässig ZU (`components/ImportHistory.tsx:22`). jsdom setzt das
  // `open` eines `<details>` beim Klick auf das `<summary>` nicht selbst — es wird deshalb gesetzt
  // wie ein Mensch es aufklappt. Das ist ein DOM-Zustand, kein Produktgriff.
  const verlauf = container.querySelector<HTMLDetailsElement>("#import-review-queue");
  expect(
    verlauf,
    `${JOB}: die Prüfliste (#import-review-queue) fehlt auf der Seite.`,
  ).not.toBeNull();
  await act(async () => {
    (verlauf as HTMLDetailsElement).open = true;
    await flush();
  });
  return container;
}

/**
 * Den Volltext aufklappen — wie ein Prüfer, der vor dem Annehmen lesen will, was er annimmt.
 *
 * Es ist der ECHTE Knopf der Karte (`imp-volltext-schalter`): der Kasten darunter wird erst
 * gerendert, wenn er offen ist (`ImportVolltextAufklapper`, `offen ? … : null`). Ohne diesen Griff
 * prüfte „der Volltext ist noch da" bloss, dass ein Knopf dasteht.
 */
async function volltextOeffnen(wurzel: HTMLElement): Promise<void> {
  const schalter = wurzel.querySelector<HTMLButtonElement>('[data-testid="imp-volltext-schalter"]');
  expect(schalter, `${JOB}: der Volltext-Aufklapper fehlt auf der Prüfkarte.`).not.toBeNull();
  await act(async () => {
    (schalter as HTMLButtonElement).click();
    await flush();
  });
}

// ------------------------------------------------------------------------------------------------
// DAS ABLESEN — was ein Mensch auf der Karte sieht
// ------------------------------------------------------------------------------------------------

/**
 * SICHTBAR HEISST MESSBAR SICHTBAR (Lehre JOB 3179 · UX-24): geprüft wird der Knoten SAMT seinen
 * Vorfahren. Ein `hidden`, ein `aria-hidden` oder eine Wegsperr-Klasse auf irgendeiner Ebene macht
 * ihn unsichtbar — und ein zugeklapptes `<details>` ebenso.
 */
function sichtbar(el: Element | null): boolean {
  if (el === null) {
    return false;
  }
  for (let k: Element | null = el; k !== null; k = k.parentElement) {
    if (k instanceof HTMLDetailsElement && !k.open) {
      return false;
    }
    const klassen = typeof k.className === "string" ? k.className : "";
    if (
      k.hasAttribute("hidden") ||
      k.getAttribute("aria-hidden") === "true" ||
      /\bsr-only\b|\bhidden\b|\binvisible\b|\bopacity-0\b/.test(klassen)
    ) {
      return false;
    }
  }
  return true;
}

interface Kartenbild {
  /** Der Wortlaut der Kennzeichnung, oder `null`, wenn keine dasteht. */
  standSatz: string | null;
  /** Die Lage, die die Karte selbst nennt (`data-lage`) — ihre eigene Auskunft, nicht meine. */
  standLage: string | null;
  /** Steht die Kennzeichnung wirklich sichtbar da? */
  standSichtbar: boolean;
  /** Ist „Annehmen" gesperrt? `null` = der Knopf steht gar nicht da. */
  annehmenGesperrt: boolean | null;
  /** Trägt die Karte den Volltext noch? */
  volltextDa: boolean;
  /** Steht der Titel des Kandidaten noch auf der Seite? */
  karteDa: boolean;
  /** Der Zustand der Abfrage, unabhängig am QueryClient gelesen. */
  fetchStatus: string | undefined;
  status: string | undefined;
  /** Wann die Daten zuletzt aus einer ANTWORT kamen (0 = nie) — der harte Frischebeleg. */
  dataUpdatedAt: number | undefined;
  /** Losgelaufene und erfolgreich zurückgekommene Leseanfragen, an der Leitung gezählt. */
  leseversuche: number;
  lesungenErfolgreich: number;
}

function lies(wurzel: HTMLElement): Kartenbild {
  const stand = wurzel.querySelector('[data-testid="imp-stand"]');
  const annehmen = wurzel.querySelector<HTMLButtonElement>('[data-testid="imp-annehmen"]');
  const zustand = qc.getQueryState(SCHLUESSEL);
  const text = (wurzel.textContent ?? "").replace(/\s+/g, " ");
  return {
    standSatz: stand === null ? null : (stand.textContent ?? "").replace(/\s+/g, " ").trim(),
    standLage: stand === null ? null : stand.getAttribute("data-lage"),
    standSichtbar: sichtbar(stand),
    annehmenGesperrt: annehmen === null ? null : annehmen.disabled,
    volltextDa: text.includes(VOLLTEXT_MARKE),
    karteDa: text.includes(TITEL),
    fetchStatus: zustand?.fetchStatus,
    status: zustand?.status,
    dataUpdatedAt: zustand?.dataUpdatedAt,
    leseversuche,
    lesungenErfolgreich,
  };
}

/** Eine Auffrischung ANSTOSSEN — genau das, was jede Übernahme und jeder Seitenbesuch auch tut. */
async function auffrischen(): Promise<void> {
  await act(async () => {
    void qc.invalidateQueries({ queryKey: SCHLUESSEL });
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  stoerung = "keine";
  freigeben = null;
  leseversuche = 0;
  lesungenErfolgreich = 0;
  b = await bruecke();
  leitungAbbauen = leitungMitStoerung();
});

afterEach(async () => {
  freigeben?.();
  if (root) {
    await act(async () => root?.unmount());
    container.remove();
    root = null;
  }
  onlineManager.setOnline(true);
  qc?.clear();
  leitungAbbauen?.();
  b.abbauen();
  stoerung = "keine";
});

describe(`${JOB} · S · § 9 — der Stand der Prüfkarte und die Sperre von „Annehmen"`, () => {
  it("S1 · die ganze Kette: frisch → Auffrischung läuft → offline angehalten → gescheitert → Wiederaufnahme", async () => {
    await einreihen();
    const wurzel = await mounten();
    await volltextOeffnen(wurzel);

    // ── 1 · FRISCH GELESEN ────────────────────────────────────────────────────────────────────
    // Der Ausgangspunkt, und er ist selbst eine Zusage: ohne Störung steht KEIN Vorbehalt da und
    // der Knopf ist frei. Ohne diesen Punkt bewiesen die vier folgenden nur, dass irgendetwas sperrt.
    const frisch = lies(wurzel);
    expect(frisch.karteDa, `${JOB}: S1/1 · die Prüfkarte „${TITEL}" fehlt.`).toBe(true);
    expect(
      frisch.fetchStatus,
      `${JOB}: S1/1 · die Abfrage ruht nicht — kein frischer Ausgang.`,
    ).toBe("idle");
    expect(frisch.status, `${JOB}: S1/1 · die Abfrage war nicht erfolgreich.`).toBe("success");
    expect(frisch.volltextDa, `${JOB}: S1/1 · der Volltext steht nicht auf der Karte.`).toBe(true);
    expect(frisch.standSatz, `${JOB}: S1/1 · auf frischem Stand steht ein Vorbehalt.`).toBeNull();
    expect(
      frisch.annehmenGesperrt,
      `${JOB}: S1/1 · „Annehmen" ist auf frisch gelesenem Stand gesperrt.`,
    ).toBe(false);

    // ── 2 · DIE AUFFRISCHUNG LÄUFT ────────────────────────────────────────────────────────────
    // Die Leseanfrage wird gehalten. Der Stand von vorhin bleibt stehen — aber er steht jetzt
    // ausdrücklich für vorhin und nicht für JETZT, und genau deshalb wird nicht angenommen.
    stoerung = "haelt";
    await auffrischen();
    await durchatmen(3);
    const laeuft = lies(wurzel);
    expect(laeuft.fetchStatus, `${JOB}: S1/2 · es läuft gar keine Auffrischung.`).toBe("fetching");
    expect(
      laeuft.karteDa,
      `${JOB}: S1/2 · die Karte ist während der Auffrischung verschwunden.`,
    ).toBe(true);
    expect(laeuft.volltextDa, `${JOB}: S1/2 · der Volltext ist während der Auffrischung weg.`).toBe(
      true,
    );
    expect(
      laeuft.standLage,
      `${JOB}: S1/2 · die Karte nennt die laufende Auffrischung nicht.`,
    ).toBe("auffrischung_laeuft");
    expect(laeuft.standSatz, `${JOB}: S1/2 · nicht der Satz des Katalogs.`).toBe(
      T("imp.stand.auffrischungLaeuft"),
    );
    expect(laeuft.standSichtbar, `${JOB}: S1/2 · der Satz steht nicht sichtbar da.`).toBe(true);
    expect(
      laeuft.annehmenGesperrt,
      `${JOB}: S1/2 · „Annehmen" ist frei, während die Auffrischung noch läuft.`,
    ).toBe(true);

    // Die gehaltene Anfrage darf durch: die Lage muss sich von selbst wieder erholen.
    stoerung = "keine";
    await act(async () => {
      freigeben?.();
      await flush();
    });
    await durchatmen();
    expect(
      lies(wurzel).annehmenGesperrt,
      `${JOB}: S1/2 · nach der durchgelaufenen Auffrischung bleibt „Annehmen" gesperrt — der Vorbehalt klebt.`,
    ).toBe(false);

    // ── 3 · OHNE NETZ ANGEHALTEN (Bens Fall, wörtlich) ────────────────────────────────────────
    await act(async () => {
      onlineManager.setOnline(false);
      await flush();
    });
    await auffrischen();
    await durchatmen(3);
    const pausiert = lies(wurzel);
    expect(
      pausiert.fetchStatus,
      `${JOB}: S1/3 · die Auffrischung ist nicht angehalten — der Fall misst etwas anderes.`,
    ).toBe("paused");
    expect(pausiert.karteDa, `${JOB}: S1/3 · offline ist die Karte verschwunden.`).toBe(true);
    expect(pausiert.volltextDa, `${JOB}: S1/3 · offline ist der Volltext weg.`).toBe(true);
    expect(pausiert.standLage, `${JOB}: S1/3 · die Karte nennt den angehaltenen Abruf nicht.`).toBe(
      "pausiert",
    );
    expect(pausiert.standSatz, `${JOB}: S1/3 · nicht der Satz des Katalogs.`).toBe(
      T("imp.stand.pausiert"),
    );
    expect(pausiert.standSichtbar, `${JOB}: S1/3 · der Satz steht nicht sichtbar da.`).toBe(true);
    expect(
      pausiert.annehmenGesperrt,
      `${JOB}: S1/3 · Bens Befund steht wieder: offline lässt sich der gecachte Kandidat annehmen.`,
    ).toBe(true);

    // ── 4 · DIE AUFFRISCHUNG IST GESCHEITERT ──────────────────────────────────────────────────
    // Netz wieder da, aber der Dienst antwortet 503. Das ist ein ANDERER Sachverhalt als offline:
    // hier hat es einen Versuch gegeben, und er ist gescheitert. Zwei Auskünfte, zwei Sätze.
    stoerung = "fehler";
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    await auffrischen();
    await durchatmen();
    const gescheitert = lies(wurzel);
    expect(
      gescheitert.status,
      `${JOB}: S1/4 · die Abfrage steht nicht auf Fehler — der 503 kam nicht an.`,
    ).toBe("error");
    expect(
      gescheitert.karteDa,
      `${JOB}: S1/4 · die gescheiterte Auffrischung hat die Prüfliste GELEERT (REGELN § 7).`,
    ).toBe(true);
    expect(gescheitert.volltextDa, `${JOB}: S1/4 · der zuletzt gelesene Volltext ist weg.`).toBe(
      true,
    );
    expect(
      gescheitert.standLage,
      `${JOB}: S1/4 · die Karte nennt die gescheiterte Auffrischung nicht.`,
    ).toBe("auffrischung_gescheitert");
    expect(gescheitert.standSatz, `${JOB}: S1/4 · nicht der Satz des Katalogs.`).toBe(
      T("imp.stand.auffrischungGescheitert"),
    );
    expect(gescheitert.standSichtbar, `${JOB}: S1/4 · der Satz steht nicht sichtbar da.`).toBe(
      true,
    );
    expect(
      gescheitert.annehmenGesperrt,
      `${JOB}: S1/4 · nach gescheiterter Auffrischung lässt sich weiter annehmen.`,
    ).toBe(true);

    // ── 5 · DIE ERFOLGREICHE WIEDERAUFNAHME ───────────────────────────────────────────────────
    // Der Vorbehalt muss GEHEN. Ein Vorbehalt, der klebt, macht jeden Stand für immer verdächtig
    // und die Aussage damit wertlos.
    stoerung = "keine";
    await auffrischen();
    await durchatmen();
    const wieder = lies(wurzel);
    expect(wieder.status, `${JOB}: S1/5 · die Wiederaufnahme war nicht erfolgreich.`).toBe(
      "success",
    );
    expect(
      wieder.fetchStatus,
      `${JOB}: S1/5 · die Abfrage ruht nach der Wiederaufnahme nicht.`,
    ).toBe("idle");
    expect(
      wieder.karteDa,
      `${JOB}: S1/5 · die Karte ist nach der Wiederaufnahme nicht zurück.`,
    ).toBe(true);
    expect(
      wieder.volltextDa,
      `${JOB}: S1/5 · der Volltext ist nach der Wiederaufnahme nicht da.`,
    ).toBe(true);
    expect(
      wieder.standSatz,
      `${JOB}: S1/5 · der Vorbehalt klebt am frisch gelesenen Stand.`,
    ).toBeNull();
    expect(
      wieder.annehmenGesperrt,
      `${JOB}: S1/5 · „Annehmen" bleibt nach der erfolgreichen Wiederaufnahme gesperrt.`,
    ).toBe(false);
  }, 120_000);

  it("S3 · NETZ ZURÜCK IST KEIN FRISCHENACHWEIS — erst die erfolgreiche neue Lesung entsperrt", async () => {
    // ════════════════════════════════════════════════════════════════════════════════════════════
    // BENS BEFUND AN RUNDE 3, wörtlich: „Nach kurzer Netzunterbrechung wird ‚Annehmen‘ ohne
    // erfolgreiche neue Lesung freigegeben." Gemessen hatte er: `dataUpdatedAt` vorher/nachher
    // identisch, `fetchStatus: "idle"`, `standSatz: null`, `annehmenGesperrt: false`.
    //
    // WARUM S1 DAS NICHT SAH: dort wird jede Lage über `invalidateQueries` angestossen, und der
    // Prüfstand lief mit `staleTime: 0`. Beim Wiederverbinden holte react-query dann von selbst
    // neu — die Lücke zwischen „Netz ist wieder da" und „ich habe wirklich neu gelesen" konnte gar
    // nicht entstehen. Sie entsteht genau innerhalb der produktiven Frischefrist (30 s,
    // `ZAEHLER_FRISCHE_MS`), und die fährt dieser Prüfstand jetzt (siehe `mounten`).
    //
    // GEZÄHLT WIRD AN DER LEITUNG, nicht an react-querys Selbstauskunft: `leseversuche` und
    // `lesungenErfolgreich`. Ein Zustand, der „frisch" behauptet, ohne dass eine Lesung angekommen
    // ist, fällt damit auf, egal was die Bibliothek über sich selbst sagt.
    // ════════════════════════════════════════════════════════════════════════════════════════════
    await einreihen();
    const wurzel = await mounten();
    await volltextOeffnen(wurzel);

    const vorher = lies(wurzel);
    expect(vorher.status, `${JOB}: S3/1 · der Ausgangsstand kam nicht aus einer Antwort.`).toBe(
      "success",
    );
    expect(
      vorher.lesungenErfolgreich,
      `${JOB}: S3/1 · es ist gar keine Lesung angekommen — der Ausgangspunkt trägt nicht.`,
    ).toBeGreaterThan(0);
    expect(
      vorher.annehmenGesperrt,
      `${JOB}: S3/1 · „Annehmen" ist auf frisch gelesenem Stand gesperrt.`,
    ).toBe(false);

    // ── DIE NETZLÜCKE — OHNE EIN EINZIGES BILD DAZWISCHEN ────────────────────────────────────
    // RUNDE 5, BENS BEFUND AN RUNDE 4: Bis hierher trennte dieser Fall das Netz, liess die Seite
    // EIN BILD lang offline zeichnen und verband dann wieder. Genau dieses Bild brauchte die alte
    // Fassung des Produkts, denn sie schrieb den Merker in einem `useEffect([online])` — ohne
    // Offline-Bild blieb er alt. Ein Prüfstand, der auf das Bild wartet, kann diesen Fehler nicht
    // sehen. Hier fallen Trennung UND Rückkehr deshalb in EINEN `act`-Block: react zeichnet
    // dazwischen nichts, und trotzdem muss die Lücke gemerkt sein.
    // Die Leitung hält ab jetzt jede Leseanfrage fest. Damit ist ausgeschlossen, dass die Sperre
    // in Wahrheit an einer stillen, erfolgreichen Auffrischung hängt.
    stoerung = "haelt";
    await act(async () => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await flush();
    });
    await durchatmen();

    const zurueck = lies(wurzel);
    // Erst der Beleg, DASS dieser Fall wirklich die Lage misst, um die es geht: keine neue Lesung.
    expect(
      zurueck.lesungenErfolgreich,
      `${JOB}: S3/3 · es IST eine Lesung angekommen — dann misst dieser Fall nicht die Netzlücke.`,
    ).toBe(vorher.lesungenErfolgreich);
    expect(
      zurueck.dataUpdatedAt,
      `${JOB}: S3/3 · die Daten sind neu — dann misst dieser Fall nicht die Netzlücke.`,
    ).toBe(vorher.dataUpdatedAt);
    // Und jetzt die Zusage selbst.
    expect(zurueck.karteDa, `${JOB}: S3/3 · die Karte ist nach der Netzlücke verschwunden.`).toBe(
      true,
    );
    expect(zurueck.volltextDa, `${JOB}: S3/3 · der Volltext ist nach der Netzlücke weg.`).toBe(
      true,
    );
    expect(
      zurueck.standLage,
      `${JOB}: S3/3 · die Karte verschweigt die Netzlücke (Netzrückkehr ist kein Frischenachweis).`,
    ).toBe("netzluecke");
    expect(zurueck.standSatz, `${JOB}: S3/3 · nicht der Satz des Katalogs.`).toBe(
      T("imp.stand.netzluecke"),
    );
    expect(zurueck.standSichtbar, `${JOB}: S3/3 · der Satz steht nicht sichtbar da.`).toBe(true);
    expect(
      zurueck.annehmenGesperrt,
      `${JOB}: S3/3 · BENs Befund steht wieder: nach der Netzrückkehr lässt sich der alte Stand annehmen.`,
    ).toBe(true);

    // ── EINE GESCHEITERTE LESUNG ENTSPERRT NICHT. ────────────────────────────────────────────
    stoerung = "fehler";
    await act(async () => {
      freigeben?.();
      await flush();
    });
    await auffrischen();
    await durchatmen();
    const nachFehler = lies(wurzel);
    expect(
      nachFehler.leseversuche,
      `${JOB}: S3/4 · es hat gar keine Leseanfrage stattgefunden.`,
    ).toBeGreaterThan(vorher.leseversuche);
    expect(
      nachFehler.lesungenErfolgreich,
      `${JOB}: S3/4 · die Anfrage kam durch — dann ist es keine gescheiterte Lesung.`,
    ).toBe(vorher.lesungenErfolgreich);
    expect(
      nachFehler.standSatz,
      `${JOB}: S3/4 · nach der gescheiterten Lesung steht kein Vorbehalt mehr da.`,
    ).not.toBeNull();
    expect(
      nachFehler.annehmenGesperrt,
      `${JOB}: S3/4 · eine GESCHEITERTE Lesung hat „Annehmen" freigegeben.`,
    ).toBe(true);

    // ── ERST DIE ERFOLGREICHE NEUE LESUNG ENTSPERRT. ─────────────────────────────────────────
    stoerung = "keine";
    await auffrischen();
    await durchatmen();
    const frisch = lies(wurzel);
    expect(
      frisch.lesungenErfolgreich,
      `${JOB}: S3/5 · es ist keine erfolgreiche Lesung angekommen — der Fall belegt die Freigabe nicht.`,
    ).toBeGreaterThan(vorher.lesungenErfolgreich);
    expect(
      frisch.dataUpdatedAt as number,
      `${JOB}: S3/5 · die Daten stammen weiter aus der Antwort von vor der Netzlücke.`,
    ).toBeGreaterThan(vorher.dataUpdatedAt as number);
    expect(
      frisch.standSatz,
      `${JOB}: S3/5 · der Vorbehalt klebt an einem wirklich frisch gelesenen Stand.`,
    ).toBeNull();
    expect(
      frisch.annehmenGesperrt,
      `${JOB}: S3/5 · „Annehmen" bleibt nach der erfolgreichen neuen Lesung gesperrt.`,
    ).toBe(false);
  }, 120_000);

  it("S4 · die Netzlücke fällt, WÄHREND die Import-Seite abgebaut ist — sie zählt trotzdem", async () => {
    // ════════════════════════════════════════════════════════════════════════════════════════════
    // BENS ZWEITE GEGENPROBE AN RUNDE 4, wörtlich: „Importseite verlassen, Netz unterbrechen und
    // wiederherstellen, mit demselben Query-Cache zurückkehren … Datenzeitstempel unverändert,
    // keine neue erfolgreiche Lesung, Annahme freigegeben."
    //
    // WAS DIESER FALL ÜBER S3 HINAUS PRÜFT: Ein Merker, der an der Komponente hängt — an ihrem
    // Bild ODER an ihrer Einhängung —, ist hier taub: es gibt in der ganzen Lücke weder ein Bild
    // noch eine eingehängte Seite. Nur eine Erfassung am Verbindungsbeobachter selbst, die das
    // Modul überdauert, sieht sie.
    //
    // DER ZWISCHENSPEICHER BLEIBT DERSELBE (`mounten(true)`): genau so kommt ein Mensch zurück,
    // der zwischendurch auf einer anderen Seite war. Mit einem frischen Speicher wäre der Fall
    // sinnlos — dann läge ohnehin eine neue Lesung vor.
    // ════════════════════════════════════════════════════════════════════════════════════════════
    await einreihen();
    const wurzel = await mounten();
    const vorher = lies(wurzel);
    expect(
      vorher.lesungenErfolgreich,
      `${JOB}: S4/1 · es ist gar keine Lesung angekommen — der Ausgangspunkt trägt nicht.`,
    ).toBeGreaterThan(0);
    expect(
      vorher.annehmenGesperrt,
      `${JOB}: S4/1 · „Annehmen" ist auf frisch gelesenem Stand gesperrt.`,
    ).toBe(false);

    // ── DIE SEITE GEHT WEG. ──────────────────────────────────────────────────────────────────
    await act(async () => root?.unmount());
    container.remove();
    root = null;

    // ── UND WÄHRENDDESSEN FÄLLT DAS NETZ AUS UND KOMMT WIEDER. ──────────────────────────────
    // Jede Lesung bleibt ab hier hängen: eine erfolgreiche neue Antwort ist ausgeschlossen.
    stoerung = "haelt";
    await act(async () => {
      onlineManager.setOnline(false);
      await flush();
    });
    await durchatmen(3);
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });

    // ── ZURÜCK AUF DER SEITE, MIT DEMSELBEN ZWISCHENSPEICHER. ───────────────────────────────
    const wieder = await mounten(true);
    await durchatmen();
    const nachher = lies(wieder);
    expect(
      nachher.lesungenErfolgreich,
      `${JOB}: S4/2 · es IST eine Lesung angekommen — dann misst dieser Fall nicht die Lücke.`,
    ).toBe(vorher.lesungenErfolgreich);
    expect(
      nachher.dataUpdatedAt,
      `${JOB}: S4/2 · die Daten sind neu — dann misst dieser Fall nicht die Lücke.`,
    ).toBe(vorher.dataUpdatedAt);
    expect(nachher.karteDa, `${JOB}: S4/2 · die Prüfkarte ist nicht wieder da.`).toBe(true);
    expect(
      nachher.standLage,
      `${JOB}: S4/2 · die Karte verschweigt die Netzlücke, die in ihrer Abwesenheit lag.`,
    ).toBe("netzluecke");
    expect(nachher.standSatz, `${JOB}: S4/2 · nicht der Satz des Katalogs.`).toBe(
      T("imp.stand.netzluecke"),
    );
    expect(nachher.standSichtbar, `${JOB}: S4/2 · der Satz steht nicht sichtbar da.`).toBe(true);
    expect(
      nachher.annehmenGesperrt,
      `${JOB}: S4/2 · BENs zweiter Befund steht wieder: der alte Zwischenspeicher lässt sich annehmen.`,
    ).toBe(true);

    // ── UND AUCH HIER ENTSPERRT ERST DIE ERFOLGREICHE NEUE LESUNG. ─────────────────────────
    stoerung = "keine";
    await auffrischen();
    await durchatmen();
    const frisch = lies(wieder);
    expect(
      frisch.lesungenErfolgreich,
      `${JOB}: S4/3 · es ist keine erfolgreiche Lesung angekommen — die Freigabe hinge an nichts.`,
    ).toBeGreaterThan(vorher.lesungenErfolgreich);
    expect(frisch.standSatz, `${JOB}: S4/3 · der Vorbehalt klebt.`).toBeNull();
    expect(
      frisch.annehmenGesperrt,
      `${JOB}: S4/3 · „Annehmen" bleibt nach der erfolgreichen neuen Lesung gesperrt.`,
    ).toBe(false);
  }, 120_000);

  it("S2 · ohne Netz und ohne je gelesenen Stand sagt die Prüfliste NICHT „keine Beiträge“", async () => {
    // Die andere Flanke derselben Ehrlichkeit: „Keine Beiträge zur Prüfung." ist eine
    // Tatsachenaussage über den Bestand. Ohne eine einzige erfolgreiche Antwort trägt sie nichts —
    // und „Stand von zuletzt" wäre ein Stand, den es nie gab.
    await einreihen();
    onlineManager.setOnline(false);
    const wurzel = await mounten();
    await durchatmen();
    const zustand = wurzel.querySelector('[data-testid="imp-queue-zustand"]');
    expect(
      zustand,
      `${JOB}: S2 · die Prüfliste sagt ohne Netz nichts über ihre Lage.`,
    ).not.toBeNull();
    expect(zustand?.getAttribute("data-lage"), `${JOB}: S2 · falsche Lage.`).toBe("pausiert");
    expect((zustand?.textContent ?? "").trim(), `${JOB}: S2 · nicht der Satz des Katalogs.`).toBe(
      T("imp.stand.pausiertOhneStand"),
    );
    const text = (wurzel.textContent ?? "").replace(/\s+/g, " ");
    expect(
      text,
      `${JOB}: S2 · die Seite behauptet ohne Antwort einen leeren Bestand.`,
    ).not.toContain(T("imp.queueEmpty"));
    expect(
      wurzel.querySelector('[data-testid="imp-annehmen"]'),
      `${JOB}: S2 · es steht ein „Annehmen" da, obwohl nie etwas gelesen wurde.`,
    ).toBeNull();
  }, 120_000);
});
