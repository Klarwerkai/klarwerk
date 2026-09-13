// @vitest-environment jsdom
// ================================================================================================
// JOB 3796 — DIE DREI LESEKAPITEL SIND AM VERHALTEN IHRER EIGENEN SEITE BELEGT.
// ================================================================================================
//
// DIE BESTELLUNG steht woertlich in `archiv/3741/runde-4/RUECKGABE.md:94`: die Kapitel `/extern`,
// `/analytics` und `/hilfe` trugen „Zuordnungs-, Uebersetzungs-, DOM- und Suchbeleg, aber KEINEN
// gemounteten Verhaltensbeleg ihrer jeweiligen Seite". Genau den liefert diese Datei.
//
// WARUM DAS KEIN FORMALISMUS IST: dieselbe Pruefung hat in JOB 3741 Runde 1 DREI von drei
// untersuchten Texten als falsch entlarvt (Themenkarte, Profil, Import — nachzulesen im Kopf von
// `die-texte-stimmen-mit-der-seite.test.tsx:9-17`). Fuer diese drei Seiten ist sie nie gelaufen.
//
// DER KERN sind die drei EHRLICHKEITSZUSAGEN, denn genau dort schweigt ein Produkt gern, statt zu
// antworten:
//   · `/extern`   „ist die externe Suche abgeschaltet oder nicht erreichbar, sagt die Seite das
//                  offen, statt eine leere Liste zu zeigen"  → E1c
//   · `/hilfe`    „Gibt es dazu nichts, sagt die Seite das offen, statt ein unpassendes Kapitel zu
//                  zeigen"                                    → H3c-LEER
//   · `/analytics` „bündelt die Auswertung … und daneben das Protokoll"  → A2a (kein Reiterwechsel)
//
// WAS HIER NICHT PASSIERT (Auftrag §10): kein Text wird geaendert. `i18n.ts` ist heiss, und ein
// falscher Satz wird gemeldet, nicht repariert.
//
// ------------------------------------------------------------------------------------------------
// DIE BAUFORM, UND WARUM SIE SICH VON BEIDEN NACHBARN UNTERSCHEIDET
// ------------------------------------------------------------------------------------------------
// `jeder-menuepunkt-hat-einen-erklaersatz.test.ts` ist DOM-frei und misst die Zuordnung.
// `zahnrad-zeigt-den-erklaersatz.test.tsx` montiert das KOPFBAND und misst die Anzeige.
// Diese Datei montiert die SEITE und misst, ob der Satz STIMMT. Wortlaut gegen denselben
// hinterlegten Wortlaut zu pruefen bewiese gar nichts (BEN, Substanzurteil 2 in 3741) — deshalb
// steht je Behauptung das gemessene Verhalten der gezeichneten Seite neben dem Satz, der es
// beschreibt, und die Beschriftungen kommen aus `i18n.ts` statt aus diesem Test.
//
// DIE ENDPUNKTGRENZE IST DIE EINZIGE ATTRAPPE — und sie ist hier zusaetzlich ein PROTOKOLL: jeder
// Aufruf wird mit seinem Pfad mitgeschrieben. Nur so ist „ohne vorher ein Wissensobjekt oeffnen zu
// muessen" (E1a) eine Messung und keine Behauptung: die Seite ruft NUR `external.search`, nichts
// unter `ko.`.
//
// EINZELBEISSEND, NICHT ALS MENGE (Lehre JOB 3587 R4): jede der neun Behauptungen hat ihren eigenen
// Fall, und jede Schleife nennt in ihrer Fehlermeldung Route UND Behauptung. Eine Mengenpruefung
// „so viele Kapitel wie HELP_TOPICS" wuerde eine Einzelentfernung nicht bemerken; H3a fragt deshalb
// jedes Kapitel EINZELN unter seiner Kennung ab — und zwar aus BEIDEN Quellen der Seite, siehe den
// Block ueber `alleKapitel()` weiter unten (Korrekturpflicht 1 aus Runde 1).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// Die Endpunktgrenze: ein aufzeichnender Stellvertreter.
// ------------------------------------------------------------------------------------------------
// Jeder Zugriff baut einen Pfad (`external.search`, `audit.list`, `ko.list` …), jeder AUFRUF
// schreibt Pfad und Argumente mit. Ohne hinterlegte Antwort antwortet ein Knoten mit `[]` — er
// antwortet also, statt die Seite an der ersten unbekannten Ecke abstuerzen zu lassen (dieselbe
// Erwaegung wie beim Rueckfall in `die-texte-stimmen-mit-der-seite.test.tsx:99-112`).
const d = vi.hoisted(() => {
  const aufrufe: { pfad: string; args: unknown[] }[] = [];
  const antworten = new Map<string, (...args: unknown[]) => unknown>();
  return {
    aufrufe,
    antworten,
    setzeAntwort: (pfad: string, fn: (...args: unknown[]) => unknown): void => {
      antworten.set(pfad, fn);
    },
    zuruecksetzen: (): void => {
      aufrufe.length = 0;
      antworten.clear();
    },
    pfade: (): string[] => aufrufe.map((a) => a.pfad),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const knoten = (pfad: string): unknown =>
    new Proxy(
      (...args: unknown[]): unknown => {
        d.aufrufe.push({ pfad, args });
        const fn = d.antworten.get(pfad);
        return fn ? fn(...args) : Promise.resolve([]);
      },
      {
        get(ziel, name, empfaenger): unknown {
          if (typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          // `then` MUSS `undefined` bleiben: ein Knoten, der ein `then` traegt, gilt als Promise
          // und wuerde beim `await` eines Aufrufers still verschluckt.
          if (name === "then" || name === "catch" || name === "finally") {
            return undefined;
          }
          return knoten(pfad === "" ? name : `${pfad}.${name}`);
        },
      },
    );
  return { endpoints: knoten("") };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import type { AuditEntry, ExternalResult } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { ANALYTICS_AUDIT_ANCHOR } from "../../apps/web/src/lib/analyticsSections";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { ISO_HELP_TOPICS, helpAbsaetze } from "../../apps/web/src/lib/helpTopics.iso";
import { Analytics } from "../../apps/web/src/pages/Analytics";
import { ExternalKnowledge } from "../../apps/web/src/pages/ExternalKnowledge";
import { Help } from "../../apps/web/src/pages/Help";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der persistierte Stufe-2-Umschalter (`lib/stufe2Storage.ts:7`) — Lieferung 4. */
const STUFE2_KEY = "kw.stufe2.v1";

/** Der hinterlegte deutsche Text — aus dem Bestand gelesen, nicht in diesem Test abgeschrieben. */
function de(key: string): string {
  return String(i18n.getResource("de", "translation", key) ?? "");
}

// ------------------------------------------------------------------------------------------------
// matchMedia — die Attrappe fuer die Fensterbreite, hier vor allem als ZAEHLER (Lieferung 4).
// ------------------------------------------------------------------------------------------------
// `Wissensnetz.tsx` hat mit `LESEN_UNTER` eine echte Breitenweiche; genau daran ist die Themenkarte
// in JOB 3741 R1 gescheitert. Fuer diese drei Seiten wird deshalb nicht geraten, sondern gezaehlt:
// eine Seite ohne einen einzigen `matchMedia`-Aufruf hat keine zweite Darstellung, die sie
// verstecken koennte. Der Stellvertreter meldet zusaetzlich auf JEDE Abfrage „trifft zu" — eine
// vorhandene Weiche schluege also in ihren schmalen Zweig um und faellt auf.
let medienabfragen: string[] = [];
function setzeMatchMedia(trifftZu: boolean): void {
  medienabfragen = [];
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => {
    medienabfragen.push(abfrage);
    return {
      matches: trifftZu,
      media: abfrage,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  };
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

/**
 * Die ECHTE Seite, ohne `RoleProvider` und ohne `AuthProvider` — und das ist Absicht (Lieferung 4):
 * verlangte irgendein Nachkomme dieser drei Seiten die Rolle, wuerfe `useRole` hier
 * („useRole muss innerhalb von <RoleProvider> verwendet werden.", `app/RoleContext.tsx:66`) und der
 * Fall faellt rot auf. Ein Rollenzweig auf der Flaeche kann sich also nicht stumm einschleichen.
 */
async function montiere(kind: ReturnType<typeof createElement>, pfad: string): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [pfad] }, kind),
      ),
    );
    await flush();
  });
  await act(flush);
  steht = true;
}

/** Der gezeichnete Text der ganzen Seite, normalisiert — so, wie ein Mensch ihn liest. */
function sichtbar(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
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

/**
 * Echtes Tippen in ein KONTROLLIERTES Feld. React merkt sich den zuletzt gesetzten Wert am
 * DOM-Knoten; wer nur `el.value = …` schreibt, loest deshalb kein `onChange` aus und misst nichts.
 * Der Umweg ueber den Prototyp-Setter ist der vorgesehene Weg daran vorbei.
 */
async function tippe(el: Element | null | undefined, wert: string): Promise<void> {
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Eingabefeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) {
    throw new Error("kein value-Setter am HTMLInputElement — der Fall misst nichts");
  }
  await act(async () => {
    setter.call(el, wert);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Eine echte Auswahl in einem `<select>` — dasselbe Ereignis, das auch ein Mensch ausloest. */
async function waehle(el: Element | null | undefined, wert: string): Promise<void> {
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error("Auswahlfeld fehlt");
  }
  if (![...el.options].some((o) => o.value === wert)) {
    throw new Error(`die Auswahl bietet „${wert}“ gar nicht an — der Fall misst nichts`);
  }
  await act(async () => {
    el.value = wert;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.zuruecksetzen();
  setzeMatchMedia(true);
  window.localStorage.removeItem(STUFE2_KEY);
});

afterEach(() => {
  abbauen();
  window.localStorage.removeItem(STUFE2_KEY);
  vi.clearAllMocks();
});

// ================================================================================================
// E · /extern — „EXTERNES WISSEN" (`help.extern.body`, i18n.ts:5031)
// ================================================================================================
//
// Der Satz, gelesen am aktuellen Stand (Lieferung 0):
//   „Hier durchsuchst du Quellen außerhalb von Klarwerk, ohne vorher ein Wissensobjekt öffnen zu
//    müssen. Du gibst einen Suchbegriff ein und bekommst die Treffer mit ihrer Adresse zurück; ist
//    die externe Suche abgeschaltet oder nicht erreichbar, sagt die Seite das offen, statt eine
//    leere Liste zu zeigen. Gefundenes wandert nicht von selbst in den Bestand — was du brauchst,
//    erfasst du anschließend als eigenes Wissensobjekt."
const TREFFER: ExternalResult[] = [
  {
    title: "Ventilwartung nach Werksnorm",
    url: "https://beispiel.test/ventil-wartung",
    snippet: "Auszug zur Wartung.",
    provider: "probe",
  },
  {
    title: "Dichtungswechsel im Feld",
    url: "https://beispiel.test/dichtung-feld",
    snippet: "",
    provider: "probe",
  },
];

/** Sucht wirklich: Feld fuellen, Knopf druecken, Antwort abwarten. */
async function sucheAusfuehren(begriff: string): Promise<void> {
  const feld = container.querySelector("form input");
  await tippe(feld, begriff);
  const knopf = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === de("ext.search"),
  );
  expect(knopf, `/extern: kein Knopf „${de("ext.search")}“ auf der Seite`).toBeDefined();
  expect(
    knopf?.disabled,
    "/extern: der Suchknopf bleibt gesperrt, obwohl ein Suchbegriff eingegeben ist",
  ).toBe(false);
  await klicke(knopf);
}

async function externMontieren(): Promise<void> {
  await montiere(createElement(ExternalKnowledge), "/extern");
}

describe("JOB 3796 E · /extern — der Erklärsatz gegen das Verhalten von `ExternalKnowledge`", () => {
  it("E1a: /extern ist FÜR SICH ALLEIN bedienbar — die Suche läuft ohne vorher geöffnetes Wissensobjekt", async () => {
    // Die Seite wird OHNE Objektkontext montiert: keine Kennung in der Adresse, kein Elternteil,
    // das ein Wissensobjekt geladen haette. Gemessen wird nicht nur, DASS Treffer kommen, sondern
    // auch, WAS die Seite dafuer gebraucht hat — das Aufrufprotokoll ist der eigentliche Beleg.
    d.setzeAntwort("external.search", async () => TREFFER);
    await externMontieren();
    expect(
      container.querySelector('[data-testid="page-extern"]'),
      "/extern: die Seite zeichnet nicht einmal ihren Kopf",
    ).not.toBeNull();

    await sucheAusfuehren("ventil");

    const gesucht = d.aufrufe.filter((a) => a.pfad === "external.search");
    expect(gesucht.length, "/extern: die Suche hat den Server gar nicht erreicht").toBe(1);
    expect(
      gesucht[0]?.args,
      "/extern: die Suche reicht mehr als den Suchbegriff weiter — dann hinge sie an einem Kontext",
    ).toEqual(["ventil"]);
    // DER KERN DER BEHAUPTUNG: kein einziger Abruf unter `ko.` — die Seite oeffnet also kein
    // Wissensobjekt, weder vorher noch nebenbei.
    expect(
      d.pfade().filter((p) => p.startsWith("ko.")),
      "/extern: die Seite ruft Wissensobjekte ab — „ohne vorher ein Wissensobjekt öffnen zu müssen“ wäre dann falsch",
    ).toEqual([]);
    expect(
      new Set(d.pfade()),
      "/extern: die Seite braucht mehr als die externe Suche, um zu antworten",
    ).toEqual(new Set(["external.search"]));
    // Und die Treffer stehen wirklich da — sonst maesse der Fall eine Seite, die nichts zeigt.
    for (const treffer of TREFFER) {
      expect(sichtbar(), `/extern: der Treffer „${treffer.title}“ fehlt auf der Fläche`).toContain(
        treffer.title,
      );
    }
  });

  it("E1b: jeder Treffer trägt SEINE ADRESSE, nicht nur einen Titel", async () => {
    d.setzeAntwort("external.search", async () => TREFFER);
    await externMontieren();
    await sucheAusfuehren("ventil");

    for (const treffer of TREFFER) {
      const zeile = [...container.querySelectorAll("li")].find((li) =>
        (li.textContent ?? "").includes(treffer.title),
      );
      expect(zeile, `/extern: zum Treffer „${treffer.title}“ gibt es keine Zeile`).toBeDefined();
      // Die Adresse steht SICHTBAR in der Zeile (`ExternalUrlText` zeichnet `{url}` als Text) …
      expect(
        (zeile?.textContent ?? "").replace(/\s+/g, " "),
        `/extern: der Treffer „${treffer.title}“ nennt seine Adresse nicht — „mit ihrer Adresse zurück“ wäre dann falsch`,
      ).toContain(treffer.url);
      // … und sie ist auch das ZIEL des Links, nicht bloss Zierrat.
      const verweis = zeile?.querySelector("a");
      expect(
        verweis?.getAttribute("href"),
        `/extern: der Treffer „${treffer.title}“ verlinkt nicht auf seine eigene Adresse`,
      ).toBe(treffer.url);
    }
  });

  // ==============================================================================================
  // E1c · DIE EHRLICHKEITSZUSAGE — DREI ZUSTÄNDE, DREI VERSCHIEDENE SÄTZE.
  // ==============================================================================================
  //
  // §9 des Auftrags ist hier scharf: „abgeschaltet", „nicht erreichbar" und „erfolgreich, aber
  // nichts gefunden" sind DREI Zustaende. Ein gemeinsamer Text fuer „konnte nicht suchen" und
  // „nichts gefunden" waere eine negative Aussage ohne frische Datengrundlage. Jeder Zustand wird
  // deshalb EINZELN hergestellt und EINZELN gemessen, und E1c-4 stellt die Saetze nebeneinander.
  it("E1c-1: ABGESCHALTET (501 EXTERNAL_SEARCH_DISABLED) — die Seite benennt es und zeigt KEINE leere Liste", async () => {
    // Der Zustand wird so hergestellt, wie der Server ihn wirklich liefert:
    // `services/app/src/routes/external-routes.ts:79` sendet 501 mit `EXTERNAL_SEARCH_DISABLED`.
    d.setzeAntwort("external.search", async () => {
      throw new ApiError(501, "EXTERNAL_SEARCH_DISABLED", "Externe Suche ist nicht aktiv.");
    });
    await externMontieren();
    await sucheAusfuehren("ventil");

    const text = sichtbar();
    expect(
      text,
      "/extern abgeschaltet: der benennende Satz `extpage.disabled` fehlt — die Zusage „sagt die Seite das offen“ wäre falsch",
    ).toContain(de("extpage.disabled"));
    expect(
      text,
      "/extern abgeschaltet: dort steht „Keine Treffer“ — abgeschaltet und nichts gefunden wären dann nicht unterscheidbar",
    ).not.toContain(de("extpage.noResults"));
    expect(
      container.querySelectorAll("li").length,
      "/extern abgeschaltet: es steht eine Trefferliste da",
    ).toBe(0);
  });

  it("E1c-2: NICHT ERREICHBAR (Serverfehler 502) — die Seite nennt den Grund und zeigt KEINE leere Liste", async () => {
    const meldung = "Der externe Anbieter antwortet nicht.";
    d.setzeAntwort("external.search", async () => {
      throw new ApiError(502, "UPSTREAM_UNAVAILABLE", meldung);
    });
    await externMontieren();
    await sucheAusfuehren("ventil");

    const text = sichtbar();
    expect(
      text,
      "/extern nicht erreichbar: die Fehlermeldung des Servers steht nicht auf der Seite",
    ).toContain(meldung);
    expect(
      text,
      "/extern nicht erreichbar: dort steht „Keine Treffer“ — „konnte nicht suchen“ wäre als „nichts gefunden“ getarnt",
    ).not.toContain(de("extpage.noResults"));
    expect(
      text,
      "/extern nicht erreichbar: dort steht der Abschalt-Satz — nicht erreichbar und abgeschaltet wären verwechselt",
    ).not.toContain(de("extpage.disabled"));
    expect(
      container.querySelectorAll("li").length,
      "/extern nicht erreichbar: es steht eine Trefferliste da",
    ).toBe(0);
  });

  it("E1c-3: NICHT ERREICHBAR OHNE SERVERANTWORT (Netzabbruch) — auch dann steht ein Satz da, keine leere Liste", async () => {
    // Der zweite Weg in „nicht erreichbar": die Anfrage kommt gar nicht bis zu einer Antwort.
    // `api/client.ts` wirft dann KEINEN `ApiError`, sondern den rohen Netzfehler durch.
    //
    // NACHGEZOGEN IN JOB 3802 — die ABSICHT dieses Falls ist unverändert („auch dann steht ein Satz
    // da, keine leere Liste"), nur die gemessene Zeichenkette war überholt: bis JOB 3802 stand hier
    // der Browser-Innentext („Failed to fetch"; Safari „Load failed", Firefox „NetworkError when
    // attempting to fetch resource") — drei fremde Zeichenketten für dieselbe Lage, keine davon ein
    // Satz für einen Menschen. Seitdem ordnet `lib/externalKnowledge.ts` den Wurf ein
    // (`klassifiziereSuchfehler` → Sichtvariante `unreachable`) und die Seite setzt den
    // HAUSKATALOGSATZ `ext.unavailable` in der Sprache des Nutzers. Geprüft wird deshalb der
    // Katalogschlüssel, nicht ein hier abgeschriebener deutscher Satz — und zusätzlich, dass der
    // Browser-Innentext NICHT mehr dasteht.
    d.setzeAntwort("external.search", async () => {
      throw new TypeError("Failed to fetch");
    });
    await externMontieren();
    await sucheAusfuehren("ventil");

    const text = sichtbar();
    expect(text, "/extern Netzabbruch: die Seite schweigt — weder Meldung noch Hinweis").toContain(
      de("ext.unavailable"),
    );
    expect(
      text,
      "/extern Netzabbruch: dort steht der Browser-Innentext — kein Satz für einen Menschen (JOB 3802)",
    ).not.toContain("Failed to fetch");
    expect(
      text,
      "/extern Netzabbruch: dort steht „Keine Treffer“ statt eines Fehlerhinweises",
    ).not.toContain(de("extpage.noResults"));
    expect(
      container.querySelectorAll("li").length,
      "/extern Netzabbruch: es steht eine Trefferliste da",
    ).toBe(0);
  });

  it("E1c-4: ERFOLGREICH, ABER NICHTS GEFUNDEN — eigener Satz; alle vier Zustände sind unterscheidbar", async () => {
    d.setzeAntwort("external.search", async () => []);
    await externMontieren();

    // VOR der Suche steht die Ruhemeldung — der Leersatz darf nicht ohne Suche erscheinen (§9).
    expect(
      sichtbar(),
      "/extern: vor jeder Suche steht schon „Keine Treffer“ — eine Aussage ohne Datengrundlage",
    ).not.toContain(de("extpage.noResults"));
    expect(sichtbar(), "/extern: die Ruhemeldung `extpage.idle` fehlt").toContain(
      de("extpage.idle"),
    );

    await sucheAusfuehren("ventil");
    const text = sichtbar();
    expect(
      text,
      "/extern leer: nach erfolgloser Suche fehlt der Satz `extpage.noResults`",
    ).toContain(de("extpage.noResults"));
    expect(
      text,
      "/extern leer: dort steht der Abschalt-Satz — „nichts gefunden“ wäre als „abgeschaltet“ getarnt",
    ).not.toContain(de("extpage.disabled"));

    // Die drei hinterlegten Saetze muessen ueberhaupt verschieden sein, sonst koennte keine der
    // drei Messungen oben je etwas unterscheiden.
    const saetze = [de("extpage.disabled"), de("extpage.noResults"), de("extpage.idle")];
    expect(
      new Set(saetze).size,
      "/extern: zwei der drei Zustandssätze sind wortgleich — die Seite könnte sie nicht unterscheiden",
    ).toBe(3);
  });

  it("E4: /extern hat KEINE zweite Darstellung — keine Breitenweiche, kein Stufe-2-Schalter", async () => {
    d.setzeAntwort("external.search", async () => TREFFER);
    setzeMatchMedia(true);
    await externMontieren();
    await sucheAusfuehren("ventil");
    const mitSchalterAus = sichtbar();
    expect(
      medienabfragen,
      "/extern: die Seite fragt die Fensterbreite ab — dann gäbe es eine zweite Darstellung, die der Kapiteltext nicht nennt",
    ).toEqual([]);

    window.localStorage.setItem(STUFE2_KEY, "1");
    d.zuruecksetzen();
    d.setzeAntwort("external.search", async () => TREFFER);
    await externMontieren();
    await sucheAusfuehren("ventil");
    expect(
      sichtbar(),
      "/extern: der Stufe-2-Schalter verändert die Seite — der Kapiteltext gälte dann nur in einer Stellung",
    ).toBe(mitSchalterAus);
  });
});

// ================================================================================================
// A · /analytics — „ANALYTICS & AUDIT" (`help.analytics.body`, i18n.ts:5040)
// ================================================================================================
//
// Der Satz, gelesen am aktuellen Stand (Lieferung 0):
//   „Diese Seite bündelt die Auswertung über den gesamten Bestand und daneben das Protokoll der
//    Vorgänge: Kennzahlen zu Validierung, Vertrauen, Lücken und Auslastung auf der einen Seite, die
//    nachvollziehbare Liste dessen, was geschehen ist, auf der anderen. Du kannst das Protokoll
//    nach Art des Vorgangs und nach handelnder Person filtern, um einer einzelnen Frage
//    nachzugehen. Such dir eine Kennzahl aus und geh ihrer Herkunft im Protokoll nach."
const AKTEUR_A = "pia@probe.test";
const AKTEUR_B = "tom@probe.test";
const VORGANG_A = "ko.erstellt";
const VORGANG_B = "ko.validiert";

/** Vier Protokollzeilen, ueber Akteur und Vorgang ueber Kreuz gelegt — so trennt jeder Filter anders. */
const PROTOKOLL: AuditEntry[] = [
  {
    seq: 1,
    at: "2026-09-12T08:00:00.000Z",
    actor: AKTEUR_A,
    action: VORGANG_A,
    target: "probeziel-alpha",
    payload: {},
    prevHash: "",
    hash: "h1",
  },
  {
    seq: 2,
    at: "2026-09-12T08:01:00.000Z",
    actor: AKTEUR_B,
    action: VORGANG_A,
    target: "probeziel-beta",
    payload: {},
    prevHash: "h1",
    hash: "h2",
  },
  {
    seq: 3,
    at: "2026-09-12T08:02:00.000Z",
    actor: AKTEUR_A,
    action: VORGANG_B,
    target: "probeziel-gamma",
    payload: {},
    prevHash: "h2",
    hash: "h3",
  },
  {
    seq: 4,
    at: "2026-09-12T08:03:00.000Z",
    actor: AKTEUR_B,
    action: VORGANG_B,
    target: "probeziel-delta",
    payload: {},
    prevHash: "h3",
    hash: "h4",
  },
];

const UEBERSICHT = {
  total: 4,
  byStatus: { offen: 1, validiert: 3 },
  byType: { regel: 2, erfahrung: 2 },
  byCategory: { technik: 4 },
};
const LEERE_UEBERSICHT = { total: 0, byStatus: {}, byType: {}, byCategory: {} };
const WIRKUNG = {
  validatedTotal: 3,
  validatedByWeek: { "2026-W37": 3 },
  askTotal: 5,
  answeredWithoutGap: 4,
  answerRate: 0.8,
};
const LEERE_WIRKUNG = {
  validatedTotal: 0,
  validatedByWeek: {},
  askTotal: 0,
  answeredWithoutGap: 0,
  answerRate: 0,
};

/** Die vier Kennzahl-Beschriftungen, die der Kapiteltext ausdruecklich zusagt. */
const KENNZAHL_SCHLUESSEL = [
  "ana.validationRate", // „Validierung"
  "ana.avgTrust", // „Vertrauen"
  "ana.exec.rescued", // „Lücken"
  "ana.openTasks", // „Auslastung"
] as const;

async function analyticsMontieren(leer = false): Promise<void> {
  d.setzeAntwort("analytics.overview", async () => (leer ? LEERE_UEBERSICHT : UEBERSICHT));
  d.setzeAntwort("analytics.impact", async () => (leer ? LEERE_WIRKUNG : WIRKUNG));
  d.setzeAntwort("audit.list", async () => (leer ? [] : PROTOKOLL));
  d.setzeAntwort("aiCheck.coverageSummary", async () => ({
    total: 0,
    incomplete: 0,
    unchecked: 0,
    noCoverage: 0,
  }));
  await montiere(createElement(Analytics), "/analytics");
}

/** Der Abschnitt des Protokolls — derselbe Anker, den auch der Deep-Link benutzt. */
function protokollbereich(): Element {
  const bereich = container.querySelector(`#${ANALYTICS_AUDIT_ANCHOR}`);
  if (!bereich) {
    throw new Error("/analytics: der Protokoll-Abschnitt fehlt auf der Seite");
  }
  return bereich;
}

/**
 * Die Protokollzeilen, WIE SIE GEZEICHNET SIND — in Zeichenreihenfolge.
 *
 * Gemessen wird am `target`, und zwar aus gutem Grund: Akteure und Vorgangsarten stehen auch in den
 * beiden Auswahlfeldern des Filters, die Ziele NICHT. Ein Ableser ueber Akteure wuerde also die
 * Auswahlliste mitzaehlen und waere nach jedem Filtern gleich gruen.
 */
function gezeichneteVorgaenge(): string[] {
  const text = (protokollbereich().textContent ?? "").replace(/\s+/g, " ");
  return PROTOKOLL.map((e) => ({ ziel: e.target, pos: text.indexOf(e.target) }))
    .filter((e) => e.pos >= 0)
    .sort((a, b) => a.pos - b.pos)
    .map((e) => e.ziel);
}

function filterfeld(schluessel: string): Element | null {
  return container.querySelector(`select[aria-label="${de(schluessel)}"]`);
}

describe("JOB 3796 A · /analytics — der Erklärsatz gegen das Verhalten von `Analytics`", () => {
  it("A2a: Kennzahlen UND Protokoll stehen GLEICHZEITIG da — ohne einen einzigen Klick, ohne Reiterwechsel", async () => {
    await analyticsMontieren();

    // EINE Ablesung, ohne jede Bedienung: was jetzt nicht dasteht, steht nicht „daneben".
    const text = sichtbar();
    for (const key of KENNZAHL_SCHLUESSEL) {
      expect(
        text,
        `/analytics: die zugesagte Kennzahl „${de(key)}“ (${key}) fehlt auf der Seite`,
      ).toContain(de(key));
    }
    expect(text, "/analytics: der Abschnitt des Protokolls fehlt").toContain(de("ana.audit"));
    for (const eintrag of PROTOKOLL) {
      expect(
        text,
        `/analytics: der Protokolleintrag „${eintrag.target}“ steht nicht da — Kennzahlen und Protokoll wären dann nicht gleichzeitig zu sehen`,
      ).toContain(eintrag.target);
    }
    // „daneben", nicht „danach": nichts ist zugeklappt, nichts ist ein Reiter.
    expect(
      container.querySelectorAll('[role="tab"], [role="tablist"]').length,
      "/analytics: die Seite trägt Reiter — dann wäre „daneben“ ein Reiterwechsel",
    ).toBe(0);
    expect(
      protokollbereich().closest("details"),
      "/analytics: das Protokoll liegt in einem zugeklappten Bereich — dann steht es nicht daneben",
    ).toBeNull();
    // Und beide Blöcke sind wirklich ZWEI Bereiche derselben Seite, nicht zweimal derselbe.
    expect(
      (protokollbereich().textContent ?? "").includes(de("ana.exec.title")),
      "/analytics: der Kennzahlenblock liegt INNERHALB des Protokollbereichs — die Messung träfe dann nur einen Bereich",
    ).toBe(false);
  });

  it("A2a-LEER: der erfolgreich LEERE Bestand bleibt ein Zustand — Kennzahlen stehen mit 0 da, das Protokoll sagt, dass es leer ist", async () => {
    // Lehre JOB 3762 R1, Korrekturpflicht 1: ein Leerzustand ist ein Zustand, kein Nichts. Der
    // Kapiteltext verspricht „bündelt die Auswertung … und daneben das Protokoll" — auch auf einer
    // frischen Instanz, sonst gälte er nur für volle Bestände.
    await analyticsMontieren(true);
    const text = sichtbar();
    for (const key of KENNZAHL_SCHLUESSEL) {
      expect(
        text,
        `/analytics leer: die Kennzahl „${de(key)}“ (${key}) verschwindet auf dem leeren Bestand`,
      ).toContain(de(key));
    }
    expect(
      text,
      "/analytics leer: das Protokoll sagt nicht, dass es leer ist — ein stummer Leerzustand",
    ).toContain(de("ana.auditEmpty"));
    expect(
      gezeichneteVorgaenge(),
      "/analytics leer: es stehen Protokollzeilen da, obwohl der Abruf leer war",
    ).toEqual([]);
  });

  it("A2b: das Protokoll lässt sich nach ART DES VORGANGS filtern — vorher und nachher am selben gezeichneten DOM", async () => {
    await analyticsMontieren();
    const feld = filterfeld("ana.filterAction");
    expect(feld, `/analytics: kein Auswahlfeld „${de("ana.filterAction")}“`).not.toBeNull();

    // VORHER — aus der Seite abgelesen, nicht in diesem Test ausgeschrieben (Lehre 3741 R3).
    const vorher = gezeichneteVorgaenge();
    expect(vorher, "/analytics: die Seite zeichnet die vier Vorgänge nicht").toEqual([
      "probeziel-delta",
      "probeziel-gamma",
      "probeziel-beta",
      "probeziel-alpha",
    ]);

    // DIE BEDIENHANDLUNG.
    await waehle(feld, VORGANG_A);

    // NACHHER — wieder von derselben Fläche.
    const nachher = gezeichneteVorgaenge();
    expect(
      nachher,
      `/analytics: nach dem Filter auf „${VORGANG_A}“ stehen nicht genau dessen Vorgänge da — „nach Art des Vorgangs filtern“ wäre falsch`,
    ).toEqual(["probeziel-beta", "probeziel-alpha"]);
    expect(
      nachher.length,
      "/analytics: der Filter auf die Vorgangsart hat gar nichts bewegt",
    ).toBeLessThan(vorher.length);
    expect(
      (protokollbereich().textContent ?? "").replace(/\s+/g, " "),
      "/analytics: der Zähler nennt nicht, wie viele von wie vielen übrig sind",
    ).toContain(i18n.t("ana.auditCount", { shown: 2, total: 4 }));
  });

  it("A2c: das Protokoll lässt sich nach HANDELNDER PERSON filtern — und das trennt anders als die Vorgangsart", async () => {
    await analyticsMontieren();
    const feld = filterfeld("ana.filterActor");
    expect(feld, `/analytics: kein Auswahlfeld „${de("ana.filterActor")}“`).not.toBeNull();

    const vorher = gezeichneteVorgaenge();
    expect(vorher.length, "/analytics: die Seite zeichnet die vier Vorgänge nicht").toBe(4);

    await waehle(feld, AKTEUR_A);

    const nachher = gezeichneteVorgaenge();
    // Diese Erwartung kann die Vorgangsart-Messung aus A2b NICHT zufällig miterfüllen: der Schnitt
    // nach Person liegt quer zu ihr (alpha+gamma statt alpha+beta).
    expect(
      nachher,
      `/analytics: nach dem Filter auf „${AKTEUR_A}“ stehen nicht genau deren Vorgänge da — „nach handelnder Person filtern“ wäre falsch`,
    ).toEqual(["probeziel-gamma", "probeziel-alpha"]);
    expect(
      (protokollbereich().textContent ?? "").replace(/\s+/g, " "),
      "/analytics: der Zähler nennt nicht, wie viele von wie vielen übrig sind",
    ).toContain(i18n.t("ana.auditCount", { shown: 2, total: 4 }));
  });

  it("A4: /analytics hat KEINE zweite Darstellung — keine Breitenweiche, kein Stufe-2-Schalter", async () => {
    setzeMatchMedia(true);
    await analyticsMontieren();
    const mitSchalterAus = sichtbar();
    expect(
      medienabfragen,
      "/analytics: die Seite fragt die Fensterbreite ab — dann gäbe es eine zweite Darstellung, die der Kapiteltext nicht nennt",
    ).toEqual([]);

    window.localStorage.setItem(STUFE2_KEY, "1");
    d.zuruecksetzen();
    await analyticsMontieren();
    expect(
      sichtbar(),
      "/analytics: der Stufe-2-Schalter verändert die Seite — der Kapiteltext gälte dann nur in einer Stellung",
    ).toBe(mitSchalterAus);
  });
});

// ================================================================================================
// H · /hilfe — „HILFE" (`help.hilfe.body`, i18n.ts:5057)
// ================================================================================================
//
// Der Satz, gelesen am aktuellen Stand (Lieferung 0):
//   „Auf dieser Seite stehen alle Hilfekapitel beieinander, mit einem Suchfeld darüber; jedes
//    Kapitel trägt einen Link auf die Seite, um die es geht. Gesucht wird in Titel, Text und
//    Schlagwörtern der Kapitel — tipp also ruhig das Wort ein, mit dem du dein Problem beschreiben
//    würdest. Gibt es dazu nichts, sagt die Seite das offen, statt ein unpassendes Kapitel zu
//    zeigen."
//
// HIER IST DIE KETTE BESONDERS ENG (Prüfpunkt 3 des Auftrags): die Seite zeigt dieselbe
// Kapitelliste an, aus der ihr eigener Erklärsatz stammt. H3a darf deshalb keine Selbstbestätigung
// werden — die SOLLMENGE kommt aus `HELP_TOPICS` (und `ISO_HELP_TOPICS`, die `Help.tsx:66` in
// denselben Suchraum legt), gemessen wird die GEZEICHNETE Liste.
//
// „JEDES KAPITEL" IST DIE GANZE GEZEICHNETE MENGE (Korrekturpflicht 1, BEN in Runde 1). Runde 1 las
// die Sollmenge fuer den LINK nur aus `HELP_TOPICS` — die vier ISO-Kapitel aus `helpTopics.iso.ts`
// standen gezeichnet auf der Seite, ihr Routenziel aber ungeprueft: BEN hat in `Help.tsx:226-233`
// alle ISO-Links auf `/hilfe` umgebogen und H3b blieb gruen. Es gibt deshalb ab jetzt GENAU EINE
// Erhebung der Kapitel — `alleKapitel()` —, sie traegt `to` mit, und H3a wie H3b laufen darueber.
// Eine Schleife ueber nur eine der beiden Quellen ist in dieser Datei ein Befund, keine Abkuerzung.
interface Kapitel {
  id: string;
  /** Woher das Kapitel kommt — steht in jeder Fehlermeldung, damit die Luecke benennbar bleibt. */
  quelle: "HELP_TOPICS" | "ISO_HELP_TOPICS";
  title: string;
  body: string;
  tags: readonly string[];
  /** Das Routenziel des Kapitels — die Sollseite seines Handlungslinks (`Help.tsx:228`). */
  to: string;
}

/**
 * Alle Kapitel der Seite in Deutsch — beide Quellen, wie `Help.tsx:55-74` sie zusammenlegt.
 *
 * Das ist zugleich der Suchraum (H3c) und die Sollmenge fuer Bestand (H3a) und Link (H3b): die
 * Seite zeichnet beide Listen durch denselben Zweig, also darf es hier auch nur eine Rechnung geben.
 */
function alleKapitel(): Kapitel[] {
  return [
    ...HELP_TOPICS.map(
      (t): Kapitel => ({
        id: t.id,
        quelle: "HELP_TOPICS",
        title: de(t.titleKey),
        body: de(t.bodyKey),
        tags: t.tags,
        to: t.to,
      }),
    ),
    ...ISO_HELP_TOPICS.map(
      (t): Kapitel => ({
        id: t.id,
        quelle: "ISO_HELP_TOPICS",
        title: t.title.de,
        body: t.body.de,
        tags: t.tags,
        to: t.to,
      }),
    ),
  ];
}

/** Der Suchraum ist dieselbe Menge — nur unter dem Namen, unter dem H3c sie liest. */
const suchraum = alleKapitel;

/** Derselbe Heuhaufen, den `filterHelpTopics` (`helpTopics.ts:327`) durchsucht. */
function heuhaufen(e: Kapitel): string {
  return `${e.title} ${e.body} ${e.tags.join(" ")}`.toLowerCase();
}

function feldtext(e: Kapitel, feld: "title" | "body" | "tags"): string {
  return (feld === "tags" ? e.tags.join(" ") : e[feld]).toLowerCase();
}

/**
 * Ein Wort, das im ganzen Suchraum AUSSCHLIESSLICH im genannten Feld EINES Kapitels vorkommt.
 *
 * Damit wird die Behauptung „gesucht wird in Titel, Text UND Schlagwörtern" einzeln beweisbar:
 * findet die Seite dieses Kapitel, kann sie es nur über dieses eine Feld gefunden haben. Die
 * Sonde wird ERHOBEN und nicht abgetippt — sie zieht mit, wenn ein Text sich ändert.
 */
function sondeFuer(feld: "title" | "body" | "tags"): { wort: string; id: string } {
  const raum = suchraum();
  const andere = (["title", "body", "tags"] as const).filter((f) => f !== feld);
  for (const kapitel of raum) {
    const woerter = new Set(feldtext(kapitel, feld).match(/[\p{L}\p{N}]{5,}/gu) ?? []);
    for (const wort of woerter) {
      if (andere.some((f) => feldtext(kapitel, f).includes(wort))) {
        continue;
      }
      const treffer = raum.filter((k) => heuhaufen(k).includes(wort));
      if (treffer.length === 1 && treffer[0]?.id === kapitel.id) {
        return { wort, id: kapitel.id };
      }
    }
  }
  throw new Error(
    `kein Wort, das ausschliesslich im Feld „${feld}" eines einzigen Kapitels vorkommt — der Fall misst nichts`,
  );
}

/** Die gezeichneten Kapitel, in Zeichenreihenfolge (`Help.tsx:256/262`, `data-hilfe-thema`). */
function gezeichneteKapitel(): string[] {
  return [...container.querySelectorAll("[data-hilfe-thema]")].map(
    (e) => e.getAttribute("data-hilfe-thema") ?? "",
  );
}

async function hilfeMontieren(): Promise<void> {
  await montiere(createElement(Help), "/hilfe");
}

async function hilfeSuchen(wort: string): Promise<void> {
  await tippe(container.querySelector('[data-testid="hilfe-suche"]'), wort);
}

describe("JOB 3796 H · /hilfe — der Erklärsatz gegen das Verhalten von `Help`", () => {
  it("H3a: ALLE Kapitel stehen beieinander — die Sollmenge kommt aus beiden Quellen, gemessen wird die gezeichnete Liste", async () => {
    const soll = alleKapitel();
    // Die Erhebung muss BEIDE Quellen wirklich enthalten, sonst prüft die Schleife unten weniger,
    // als ihr Name sagt — genau die Lücke der Runde 1 (BEN, Korrekturpflicht 1).
    expect(
      soll.filter((k) => k.quelle === "ISO_HELP_TOPICS").length,
      "die Sollmenge trägt keine ISO-Kapitel — dann misst H3a/H3b nur die halbe Seite",
    ).toBe(ISO_HELP_TOPICS.length);
    await hilfeMontieren();
    const gezeichnet = gezeichneteKapitel();

    // EINZELBEISSEND (Lehre JOB 3587 R4): fällt EIN Kapitel weg, nennt die Meldung seine Kennung —
    // und ab dieser Runde auch fuer die ISO-Kapitel, die Runde 1 nur als Menge gezaehlt hat.
    for (const kapitel of soll) {
      expect(
        gezeichnet,
        `/hilfe: das Kapitel „${kapitel.id}“ (${kapitel.quelle}) steht NICHT auf der Seite — „alle Hilfekapitel beieinander“ wäre damit falsch`,
      ).toContain(kapitel.id);
    }
    // Die Gegenrichtung: kein Kapitel, das es in keiner der beiden Quellen gibt.
    expect(
      [...gezeichnet].sort(),
      "/hilfe: die gezeichnete Liste ist nicht genau „HELP_TOPICS und die ISO-Kapitel“",
    ).toEqual(soll.map((k) => k.id).sort());
    // Und die Karten tragen wirklich den AUFGELÖSTEN Text, nicht den i18n-Schlüssel oder nichts —
    // sonst stünde eine Liste leerer Kacheln da und der Fall wäre trotzdem grün.
    for (const kapitel of soll) {
      const karte = container.querySelector(`[data-hilfe-thema="${kapitel.id}"]`);
      const text = (karte?.textContent ?? "").replace(/\s+/g, " ");
      expect(
        text,
        `/hilfe: das Kapitel „${kapitel.id}“ (${kapitel.quelle}) zeigt seinen Titel nicht`,
      ).toContain(kapitel.title);
      for (const absatz of helpAbsaetze(kapitel.body)) {
        expect(
          text,
          `/hilfe: das Kapitel „${kapitel.id}“ (${kapitel.quelle}) zeigt seinen Text nicht`,
        ).toContain(absatz.replace(/\s+/g, " "));
      }
    }
    // Das Suchfeld steht wirklich DARÜBER — sonst wäre „mit einem Suchfeld darüber" falsch.
    const suche = container.querySelector('[data-testid="hilfe-suche"]');
    const erstesKapitel = container.querySelector("[data-hilfe-thema]");
    expect(suche, "/hilfe: es gibt gar kein Suchfeld").not.toBeNull();
    expect(erstesKapitel, "/hilfe: es steht kein einziges Kapitel da").not.toBeNull();
    if (!suche || !erstesKapitel) {
      return;
    }
    expect(
      suche.compareDocumentPosition(erstesKapitel) & Node.DOCUMENT_POSITION_FOLLOWING,
      "/hilfe: das Suchfeld steht nicht vor den Kapiteln",
    ).toBeGreaterThan(0);
  });

  it("H3b: JEDES gezeichnete Kapitel — auch die ISO-Kapitel — trägt einen Link auf SEINE Seite", async () => {
    await hilfeMontieren();
    // Die Menge ist `HELP_TOPICS ∪ ISO_HELP_TOPICS`: beide Quellen zeichnen denselben Link
    // (`Help.tsx:226-233`), also muessen beide auch geprueft werden. Runde 1 liess die vier
    // ISO-Kapitel aus — BEN hat ihre Ziele auf `/hilfe` umgebogen und dieser Fall blieb gruen.
    for (const kapitel of alleKapitel()) {
      const verweis = container.querySelector(`[data-testid="hilfe-route-${kapitel.id}"]`);
      expect(
        verweis,
        `/hilfe: das Kapitel „${kapitel.id}“ (${kapitel.quelle}) trägt keinen Link auf seine Seite`,
      ).not.toBeNull();
      const ziel = verweis?.getAttribute("href");
      expect(
        ziel,
        `/hilfe: der Link des Kapitels „${kapitel.id}“ (${kapitel.quelle}) führt auf „${ziel}“ statt auf sein Ziel „${kapitel.to}“ — „ein Link auf die Seite, um die es geht“ wäre falsch`,
      ).toBe(kapitel.to);
      expect(
        (verweis?.textContent ?? "").trim(),
        `/hilfe: der Link des Kapitels „${kapitel.id}“ (${kapitel.quelle}) trägt nicht die echte Beschriftung`,
      ).toContain(de("help.openRoute"));
    }
  });

  it("H3c-TITEL: ein Wort, das es NUR im Titel eines Kapitels gibt, findet genau dieses Kapitel", async () => {
    const sonde = sondeFuer("title");
    await hilfeMontieren();
    await hilfeSuchen(sonde.wort);
    expect(
      gezeichneteKapitel(),
      `/hilfe: die Suche nach „${sonde.wort}“ (steht nur im Titel von „${sonde.id}“) findet nicht genau dieses Kapitel — „gesucht wird in Titel …“ wäre falsch`,
    ).toEqual([sonde.id]);
  });

  it("H3c-TEXT: ein Wort, das es NUR im Text eines Kapitels gibt, findet genau dieses Kapitel", async () => {
    const sonde = sondeFuer("body");
    await hilfeMontieren();
    await hilfeSuchen(sonde.wort);
    expect(
      gezeichneteKapitel(),
      `/hilfe: die Suche nach „${sonde.wort}“ (steht nur im Text von „${sonde.id}“) findet nicht genau dieses Kapitel — „… Text …“ wäre falsch`,
    ).toEqual([sonde.id]);
  });

  it("H3c-SCHLAGWORT: ein Wort, das es NUR in den Schlagwörtern eines Kapitels gibt, findet genau dieses Kapitel", async () => {
    const sonde = sondeFuer("tags");
    await hilfeMontieren();
    await hilfeSuchen(sonde.wort);
    expect(
      gezeichneteKapitel(),
      `/hilfe: die Suche nach „${sonde.wort}“ (steht nur in den Schlagwörtern von „${sonde.id}“) findet nicht genau dieses Kapitel — „… und Schlagwörtern“ wäre falsch`,
    ).toEqual([sonde.id]);
  });

  it("H3c-LEER: zu einem Wort, das es nirgends gibt, sagt die Seite das OFFEN — und zeigt kein unpassendes Kapitel", async () => {
    const nirgends = "zqxwvunauffindbar";
    expect(
      suchraum().filter((k) => heuhaufen(k).includes(nirgends)),
      "die Sonde kommt doch irgendwo vor — der Fall misst nichts",
    ).toEqual([]);
    await hilfeMontieren();

    // §9: der Leersatz darf nur NACH einer wirklich durchgeführten Suche erscheinen.
    expect(
      sichtbar(),
      "/hilfe: der Leersatz steht schon vor jeder Suche da — eine Aussage ohne Suchvorgang",
    ).not.toContain(de("help.noResults"));

    await hilfeSuchen(nirgends);
    expect(
      sichtbar(),
      "/hilfe: nach erfolgloser Suche fehlt der benennende Satz — die Zusage „sagt die Seite das offen“ wäre falsch",
    ).toContain(de("help.noResults"));
    expect(
      gezeichneteKapitel(),
      "/hilfe: zu einem Wort ohne Treffer steht trotzdem ein Kapitel da — genau das schliesst der Satz aus",
    ).toEqual([]);

    // Und der Leersatz geht wieder weg, sobald es etwas zu zeigen gibt — er ist an die Suche
    // gebunden und nicht an einen einmal erreichten Zustand.
    await hilfeSuchen("");
    expect(
      sichtbar(),
      "/hilfe: der Leersatz bleibt stehen, obwohl wieder Kapitel da sind",
    ).not.toContain(de("help.noResults"));
    expect(
      gezeichneteKapitel().length,
      "/hilfe: nach dem Leeren des Suchfelds kommen die Kapitel nicht zurück",
    ).toBe(alleKapitel().length);
  });

  it("H4: /hilfe hat KEINE zweite Darstellung — keine Breitenweiche, kein Stufe-2-Schalter", async () => {
    setzeMatchMedia(true);
    await hilfeMontieren();
    const mitSchalterAus = sichtbar();
    expect(
      medienabfragen,
      "/hilfe: die Seite fragt die Fensterbreite ab — dann gäbe es eine zweite Darstellung, die der Kapiteltext nicht nennt",
    ).toEqual([]);

    window.localStorage.setItem(STUFE2_KEY, "1");
    d.zuruecksetzen();
    await hilfeMontieren();
    expect(
      sichtbar(),
      "/hilfe: der Stufe-2-Schalter verändert die Seite — der Kapiteltext gälte dann nur in einer Stellung",
    ).toBe(mitSchalterAus);
  });
});
