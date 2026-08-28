// @vitest-environment jsdom
// ================================================================================================
// JOB 2600 · D8 — DIE KETTE BIS ZUM CLIENTABRUF.
// ================================================================================================
//
// BENs Auflage zu D7, woertlich:
//   „Die lokale Service-/Renderer-Korrektur trifft fachlich den falschen Null-Kanten-Text, aber die
//    behauptete sichtbare Wirkung ist OHNE DURCHGAENGIGEN TEST ueber Handler, Wiretyp und echten
//    Clientabruf nicht belegt."
//
// ------------------------------------------------------------------------------------------------
// WARUM ES DIESE DATEI GIBT, OBWOHL SCHON VIER TESTS DENSELBEN FALL PRUEFEN
// ------------------------------------------------------------------------------------------------
// In D7 war jedes Glied einzeln gruen:
//
//   N1..N5   `themenkarte-nullkanten-mounted.test.tsx`   Rechnung + Renderer
//   R4       `tests/wissensnetz/themenkarte-route.test.ts`   der Wert an der echten Route
//
// Und trotzdem war die Wirkung unbelegt. Der Grund steht in BENs Urteil (:10): „ein fallengelassenes,
// falsch gemapptes oder VOM CLIENT NICHT VERWENDETES Wirefeld koennte im echten Produkt weiterhin
// den alten Text zeigen, OHNE DASS N1 BIS N5 ODER R4 ROT WUERDEN."
//
// Das ist keine Spitzfindigkeit, sondern heute die dritte Wiederholung derselben Lehre — bei der
// Antwortkarte hiess es „das verbindende Client-Wireglied", beim Titelvorschlag „die verlangte
// Wirkung im Titelfeld nicht belegt". **Wenn drei Teile einzeln gruen sind und die Kette trotzdem
// nicht schliesst, hat niemand die Naht gemessen.**
//
// ------------------------------------------------------------------------------------------------
// DER ENTWURF: DIE NAHT LIEGT EINE EBENE TIEFER ALS BISHER
// ------------------------------------------------------------------------------------------------
// Alle bisherigen gemounteten Themenkarten-Tests mocken `endpoints.wissensnetz.luecken` und
// uebergeben eine Karte, die sie SELBST mit `themenkarte()` gerechnet haben. Damit ueberspringen
// sie genau die Strecke, um die es geht.
//
// Diese Datei mockt stattdessen **`globalThis.fetch`** und legt ihn auf den echten Handler. Dadurch
// laeuft alles dazwischen unveraendert mit:
//
//     app.inject (ECHTER Handler, echte Rechte-Naht, echte Persistenz)
//       →  JSON-Antwort ueber die Leitung
//       →  apiFetch          `client.ts:31` res.text() + JSON.parse,  `:42` return data as T
//       →  endpoints         `endpoints.ts:602` api.get<Sichtmetrik>("/wissensnetz/luecken")
//       →  useQuery          `hooks.ts:152` ohne `select`, ohne Transformation
//       →  die Seite         `Wissensnetz.tsx:286` const karte = metrik.themenkarte
//       →  die Legende       `Wissensnetz.tsx:228-238` die zwei Zweige
//
// **KEIN `import { themenkarte }` in dieser Datei.** Das ist die Zusage dieses Tests, und sie ist
// beim Lesen pruefbar: Steht der Import da, ist der Test wertlos — dann rechnet er den Fall selbst
// aus, statt ihn durch die Kette zu holen. `K3` haelt das ausdruecklich fest.
//
// ------------------------------------------------------------------------------------------------
// DER BESTAND — er entsteht ueber die ECHTE Route, nicht als Attrappe
// ------------------------------------------------------------------------------------------------
// Gebraucht wird BENs N2-Lage: ein Thema ueber der Ubiquitaetsschwelle, und ein FREIGEGEBENES
// Objekt, das dieses Thema mit einem zweiten teilt.
//
//   sechs sichtbare Objekte, `aktenplan` an fuenf davon  → 5/6 = 83 %
//   `UBIQUITY_MAX_SHARE` = 0.5 (strikt groesser), `UBIQUITY_MIN_COUNT` = 5 → beide erfuellt
//   das erste Objekt wird freigegeben und traegt `aktenplan` UND `vertragsrecht`
//
// Die Freigabe entsteht ueber `neededValidations: 1` plus eine `rate`-Aktion — derselbe Weg wie in
// `tests/wissensnetz/themenkarte-route.test.ts`. Ohne sie waere kein Objekt freigegeben, es gaebe
// keinen gemeinsamen Traeger, und der Fall waere ein anderer.
//
// ACHTUNG BEI SPAETEREN AENDERUNGEN: Der Anteil rechnet gegen die Zahl der SICHTBAREN Objekte
// (`themenkarte.ts`, Schritt 3, Nenner = `sichtbare.length`). Ein siebtes Objekt verschiebt 5/6 auf
// 5/7; bei 5/10 faellt der Bestand auf 50 % und ist NICHT mehr ubiquitaer. **Die Objektzahl ist
// Teil des Prueffalls, nicht Beiwerk.**
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Wissensnetz } from "../../apps/web/src/pages/Wissensnetz";
import { buildApp, buildServices } from "../../services/app/src/build-app";
// KEIN Import von `themenkarte()`. Das ist der Punkt dieser Datei — `K3` prueft es nach.

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ZUGANG = { name: "Admin", email: "kette@x.de", password: "secret123" };

interface KoWunsch {
  readonly titel: string;
  readonly tags: readonly string[];
}

/** BENs N2-Bestand: `aktenplan` an fuenf von sechs, das erste Objekt traegt zwei Themen. */
const N2_BESTAND: readonly KoWunsch[] = [
  { titel: "Aktenplan und Vertrag", tags: ["aktenplan", "vertragsrecht"] }, // der gemeinsame Traeger
  { titel: "Aktenplan pflegen", tags: ["aktenplan"] },
  { titel: "Aktenplan pruefen", tags: ["aktenplan"] },
  { titel: "Aktenplan ablegen", tags: ["aktenplan"] },
  { titel: "Aktenplan sichten", tags: ["aktenplan"] },
  { titel: "Datenschutz klaeren", tags: ["datenschutz"] },
];

/** Ein Bestand OHNE gemeinsamen Traeger — die Gegenprobe fuer `K2`. */
const OHNE_TRAEGER: readonly KoWunsch[] = [
  { titel: "Vertragsrecht klaeren", tags: ["vertragsrecht"] },
  { titel: "Datenschutz klaeren", tags: ["datenschutz"] },
  { titel: "Archivierung ordnen", tags: ["archivierung"] },
  { titel: "Aufbewahrung pruefen", tags: ["aufbewahrung"] },
];

type App = ReturnType<typeof buildApp>;

/**
 * Legt den Bestand ueber die ECHTE Route an: registrieren, anmelden, Objekte anlegen, das erste
 * freigeben. `freigeben` steuert, ob ueberhaupt ein Objekt validiert wird.
 */
async function bestueckteApp(
  wunsch: readonly KoWunsch[],
  freigeben: boolean,
): Promise<{ app: App; headers: Record<string, string> }> {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  const ids: string[] = [];
  for (const k of wunsch) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: k.titel,
        statement: `${k.titel} — Kurzfassung fuer den Pruefstand.`,
        type: "best_practice",
        category: "Verwaltung",
        tags: [...k.tags],
        // Eine Zustimmung reicht zur Freigabe — sonst braeuchte der Fall einen zweiten Anmeldenamen.
        neededValidations: 1,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    ids.push(res.json().id as string);
  }

  if (freigeben) {
    // NUR das erste Objekt. Waeren alle frei, entstuenden weitere Paare und der Fall waere nicht
    // mehr der von BEN beschriebene.
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${ids[0]}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode, rate.body).toBe(200);
  }
  return { app, headers };
}

/**
 * DER KERN: `globalThis.fetch` zeigt auf den echten Handler.
 *
 * Damit laeuft `apiFetch` UNVERAENDERT — mit `res.text()`, `JSON.parse` und `return data as T`.
 * Genau die Strecke, die in D7 unbelegt war. Der Client weiss nichts davon; fuer ihn ist es ein
 * gewoehnlicher Abruf gegen `/api/wissensnetz/luecken`.
 */
function fetchAufHandler(app: App, headers: Record<string, string>): void {
  vi.stubGlobal("fetch", async (eingabe: unknown, init?: RequestInit): Promise<Response> => {
    const roh = typeof eingabe === "string" ? eingabe : String(eingabe);
    const pfad = roh.startsWith("http") ? new URL(roh).pathname : roh;
    const res = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: pfad,
      headers,
    });
    return new Response(res.body, {
      status: res.statusCode,
      headers: { "content-type": "application/json" },
    });
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Mountet die Seite. Es wird NICHTS uebergeben — die Seite holt ihre Daten selbst. */
async function mounteSeite(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/wissensnetz"] },
          createElement(Wissensnetz),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const kanten = (): Element[] => [...container.querySelectorAll('[data-testid="themenkante"]')];
const strichelung = (thema: string): string | null =>
  container.querySelector(`[data-thema="${thema}"] circle`)?.getAttribute("stroke-dasharray") ??
  null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("JOB 2600 D8 · die Kette bis zum Clientabruf", () => {
  it("K1 · der unterdrueckte Zusammenhang kommt ueber Handler, Wire und echten Abruf ins Bild", async () => {
    // ── DER TEST, AN DEM DAS URTEIL HAENGT ────────────────────────────────────────────────────
    // Von hier bis zur letzten Zusicherung wird NICHTS gerechnet, was die Seite nicht selbst holt.
    const { app, headers } = await bestueckteApp(N2_BESTAND, true);
    fetchAufHandler(app, headers);
    await mounteSeite();

    // (a) Die Karte ist ueberhaupt angekommen — sonst prueft alles Weitere einen leeren Baum.
    expect(marke("themenkarte"), "die Karte kam nicht durch die Kette").not.toBeNull();

    // (b) DIE WIRKUNG: keine einzige gezeichnete Kante.
    expect(kanten(), "der Ubiquitaetsfilter verhindert die Linie").toHaveLength(0);

    // (c) DIE URSACHE ist im Bild sichtbar: das ubiquitaere Thema ist gestrichelt.
    expect(strichelung("aktenplan"), "5 von 6 → ueber der Schwelle, also gestrichelt").toBe("4 3");

    // (d) DER KERN DER AUFLAGE — und der Grund, warum diese Datei existiert:
    //     Der alte Satz behauptete, kein freigegebenes Objekt teile zwei Themen. Hier teilt eines
    //     `aktenplan` und `vertragsrecht`. Er waere eine Luege und darf nicht erscheinen.
    expect(
      marke("legende-keine-kanten"),
      "hier teilt ein freigegebenes Objekt zwei Themen — der alte Satz waere falsch",
    ).toBeNull();

    const wahr = marke("legende-kanten-unterdrueckt");
    expect(wahr, "der wahre Satz muss durch die ganze Kette gekommen sein").not.toBeNull();
    expect(wahr?.textContent).toContain("verbindet hier zwei Themen");
    expect(wahr?.textContent).toContain("Mehrheit des sichtbaren Bestands");
  });

  it("K2 · GEGENPROBE ueber dieselbe Kette: ohne gemeinsamen Traeger steht der ANDERE Satz", async () => {
    // Ohne diesen Fall wuerde `K1` auch dann gruen, wenn die Seite den Unterdrueckungssatz
    // IMMER zeigte. Erst beide zusammen belegen, dass die Kette den Zustand UNTERSCHEIDET.
    const { app, headers } = await bestueckteApp(OHNE_TRAEGER, true);
    fetchAufHandler(app, headers);
    await mounteSeite();

    expect(marke("themenkarte")).not.toBeNull();
    expect(kanten()).toHaveLength(0);
    expect(strichelung("vertragsrecht"), "kein Thema ist hier ubiquitaer").toBeNull();

    expect(marke("legende-kanten-unterdrueckt"), "es gibt nichts zu unterdruecken").toBeNull();
    expect(marke("legende-keine-kanten"), "hier ist der alte Satz der wahre").not.toBeNull();
  });

  it("K3 · dieser Test rechnet den Fall NICHT selbst — kein Direktimport von `themenkarte()`", async () => {
    // Die Zusage dieser Datei, als Zusicherung statt als Versprechen im Kommentar. Wer den Import
    // spaeter einbaut, um einen Fall „schneller" zu bauen, macht die Kette wieder unbelegt — und
    // faellt hier auf.
    //
    // `node:fs` kommt DYNAMISCH herein, nicht als Kopfimport: `./tools/format` sortiert Kopfimporte
    // und hat `node:fs` beim ersten Lauf ueber die `@vitest-environment`-Zeile gehoben. Die Pragma
    // muss die erste Zeile bleiben, sonst laeuft diese Datei ohne jsdom — und dann gibt es kein
    // `document`, an dem K1 und K2 messen koennten.
    const { readFileSync } = await import("node:fs");
    const eigenerQuelltext = readFileSync(new URL(import.meta.url), "utf8");
    const importzeilen = eigenerQuelltext
      .split("\n")
      .filter((z) => /^\s*import\b/.test(z) || /^\s*}\s*from\s+"/.test(z));
    expect(
      importzeilen.filter((z) => /themenkarte/.test(z)),
      "diese Datei darf die Rechnung nicht importieren — sie holt den Fall durch die Kette",
    ).toEqual([]);
  });
});
