// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (Pedi 28.09.2026, Ergänzung 3) · ÜBERSICHT UND DETAIL DER ARBEITSANLEITUNGEN.
// ================================================================================================
//
// Geprüft wird aus den Kriterien der Ergänzung, nicht aus dem Code:
//   K1 · Übersicht und Detailansicht zeigen denselben tatsächlichen Status derselben Fassung.
//   K2 · „Vorgelegt" ist sichtbar von „freigegeben" unterschieden.
//   K3 · Bei einer dokumentierten Entscheidung sind Fassung und Zeitpunkt erkennbar; was nicht
//        festgehalten ist (die prüfende Person), wird als nicht festgehalten benannt, nie erfunden.
//   K4 · Der nächste Schritt richtet sich nach den Rechten; eine zweite Person wird nicht verlangt.
//
// `fetch` ist adressabhängig festgelegt; es gibt kein Netz, keinen Server und keinen Browser.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";

// `antworten` zählt beantwortete Sitzungsabfragen: bis dahin gilt in `RoleContext` die Vorschau-
// Rolle („experte"), nicht die der Sitzung.
const sitzung = vi.hoisted(() => ({ rolle: "experte" as string, antworten: 0 }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => {
      sitzung.antworten += 1;
      return { id: "u1", name: "Pia", email: "p@x.de", role: sitzung.rolle };
    }),
    logout: vi.fn(async () => ({})),
  },
}));

import type { AnweisungListeneintrag } from "../../apps/web/src/api/endpoints";
import type { AnweisungLesestand, AnweisungStand } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import {
  GesamtanweisungBereich,
  LISTE_MARKE,
} from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungBereich";
import { SEITE_MARKE } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungSeite";
import {
  type Freigabeeingabe,
  freigabeanzeige,
} from "../../apps/web/src/components/gesamtanweisung/zustand";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GEAENDERT = "2026-09-28T10:30:00.000Z";

function text(schluessel: string, werte?: Record<string, unknown>): string {
  return i18n.t(schluessel, { lng: "de", ...werte });
}

// ================================================================================================
// TEIL A · DIE ABLEITUNG — rein, je Stand und Recht
// ================================================================================================

const BASIS: Freigabeeingabe = {
  stand: "entwurf",
  version: 4,
  geaendertAm: GEAENDERT,
  abschnitte: 2,
  unvollstaendig: false,
};
const NUR_LESEN = { darfVorlegen: false, darfEntscheiden: false };
const ERFASSEN = { darfVorlegen: true, darfEntscheiden: false };
const PRUEFEN = { darfVorlegen: true, darfEntscheiden: true };

describe("A · freigabeanzeige: Bedeutung, Prüfangaben und nächster Schritt", () => {
  it("K4 · der nächste Schritt folgt Stand und Rechten", () => {
    const schritt = (eingabe: Partial<Freigabeeingabe>, rechte: typeof PRUEFEN) =>
      freigabeanzeige({ ...BASIS, ...eingabe }, rechte).naechsterSchritt;
    expect(schritt({}, ERFASSEN)).toBe("fe001.status.schritt.vorlegen");
    expect(schritt({}, NUR_LESEN)).toBe("fe001.status.schritt.nurLesen");
    expect(schritt({ abschnitte: 0 }, ERFASSEN)).toBe("fe001.status.schritt.abschnitteFehlen");
    expect(schritt({ unvollstaendig: true }, ERFASSEN)).toBe(
      "fe001.status.schritt.unvollstaendigVorlegen",
    );
    expect(schritt({ stand: "abgelehnt" }, ERFASSEN)).toBe("fe001.status.schritt.ueberarbeiten");
    expect(schritt({ stand: "abgelehnt" }, NUR_LESEN)).toBe("fe001.status.schritt.nurLesen");
    expect(schritt({ stand: "vorgelegt" }, ERFASSEN)).toBe("fe001.status.schritt.warten");
    expect(schritt({ stand: "vorgelegt" }, NUR_LESEN)).toBe("fe001.status.schritt.warten");
    // Wer selbst prüfen darf, entscheidet selbst — auch über eine eigene Vorlage. Es gibt keine
    // Kontoregel, die eine zweite Person verlangt; also wird keine vorausgesetzt.
    expect(schritt({ stand: "vorgelegt" }, PRUEFEN)).toBe("fe001.status.schritt.entscheiden");
    expect(schritt({ stand: "vorgelegt", unvollstaendig: true }, PRUEFEN)).toBe(
      "fe001.status.schritt.unvollstaendigEntscheiden",
    );
    for (const rechte of [NUR_LESEN, ERFASSEN, PRUEFEN]) {
      expect(schritt({ stand: "entschieden" }, rechte)).toBe("fe001.status.schritt.gilt");
    }
  });

  it("K3 · Prüfangaben nur bei einer Entscheidung; Zeit nur, wo sie belegt ist", () => {
    const pruefung = (stand: AnweisungStand) =>
      freigabeanzeige({ ...BASIS, stand }, PRUEFEN).pruefung;
    expect(pruefung("entwurf")).toBeNull();
    expect(pruefung("vorgelegt")).toBeNull();
    // Freigegeben ist endgültig: der letzte Schreibzeitpunkt IST die Freigabe.
    expect(pruefung("entschieden")).toEqual({
      schluessel: "fe001.status.pruefung.freigegeben",
      am: GEAENDERT,
    });
    // Nach einer Ablehnung darf weiter geändert werden — der Zeitpunkt ist dann nicht belegt.
    expect(pruefung("abgelehnt")).toEqual({
      schluessel: "fe001.status.pruefung.abgelehnt",
      am: null,
    });
  });

  it("K2 · jede Bedeutung sagt ausdrücklich, ob freigegeben ist", () => {
    const bedeutung = (stand: AnweisungStand) =>
      text(freigabeanzeige({ ...BASIS, stand }, PRUEFEN).bedeutung);
    expect(bedeutung("entwurf")).toContain("nicht freigegeben");
    expect(bedeutung("vorgelegt")).toContain("noch nicht freigegeben");
    expect(bedeutung("abgelehnt")).toContain("nicht freigegeben");
    expect(bedeutung("entschieden")).toMatch(/^Freigegeben:/);
    expect(bedeutung("entschieden")).not.toContain("nicht freigegeben");
    // Die vier Standwörter sind verschieden, und das freigegebene heißt auch so.
    const woerter = (["entwurf", "vorgelegt", "entschieden", "abgelehnt"] as const).map((s) =>
      text(`ga.stand.${s}`),
    );
    expect(new Set(woerter).size).toBe(4);
    expect(text("ga.stand.entschieden")).toBe("Freigegeben");
    expect(text("ga.stand.vorgelegt")).not.toBe(text("ga.stand.entschieden"));
  });

  it("jeder Schlüssel ist in DE, EN und NL übersetzt", () => {
    const schluessel = new Set<string>();
    for (const stand of ["entwurf", "vorgelegt", "entschieden", "abgelehnt"] as const) {
      for (const rechte of [NUR_LESEN, ERFASSEN, PRUEFEN]) {
        for (const abweichung of [{}, { abschnitte: 0 }, { unvollstaendig: true }]) {
          const a = freigabeanzeige({ ...BASIS, ...abweichung, stand }, rechte);
          schluessel.add(a.wort);
          schluessel.add(a.bedeutung);
          schluessel.add(a.naechsterSchritt);
          if (a.pruefung) {
            schluessel.add(a.pruefung.schluessel);
          }
        }
      }
    }
    schluessel.add("fe001.status.fassung");
    schluessel.add("fe001.status.naechsterSchritt");
    for (const sprache of ["de", "en", "nl"]) {
      for (const s of schluessel) {
        // Direkt aus dem Sprachbestand — ohne Rückfall auf eine andere Sprache.
        const wert = i18n.getResource(sprache, "translation", s);
        expect(typeof wert === "string" && wert.length > 0, `${sprache}: ${s} fehlt`).toBe(true);
      }
    }
  });
});

// ================================================================================================
// TEIL B · DIE MONTIERTE FLÄCHE — Übersicht und Detail derselben Anleitung
// ================================================================================================

let container: HTMLDivElement;
let root: Root;
let echtesFetch: typeof globalThis.fetch;

function lesestand(stand: AnweisungStand, version: number, neuere = false): AnweisungLesestand {
  return {
    id: "a-1",
    titel: "Start im Homeoffice",
    zweck: "Einarbeitung",
    geltungsbereich: "Alle Teams",
    voraussetzungen: "",
    stand,
    version,
    urheber: "u-pia",
    erstelltAm: "2026-09-26T08:00:00.000Z",
    geaendertAm: GEAENDERT,
    bausteine: [
      {
        id: "b-1",
        position: 0,
        koId: "ko-a",
        koVersion: 1,
        nachweisHash: null,
        voraussetzung: null,
        herkunft: {
          titel: "Arbeitsplatz einrichten",
          autor: "u-pia",
          fassungAm: "2026-09-25T08:00:00.000Z",
          status: "validated",
        },
        rumpfHtml: "<p>Dockingstation anschließen.</p>",
        // `neuere`: die Quelle hat inzwischen Fassung 2 — die Fläche bietet die Übernahme an.
        aktuelleKoVersion: neuere ? 2 : 1,
        aktualisierungsvorschlag: neuere ? { aufVersion: 2 } : null,
        inhalt: { tabellenUeberschriften: [], abbildungen: [], geltung: null },
      },
    ],
    unvollstaendig: false,
    verborgeneBausteine: 0,
    pruefanbindung: "nicht_angebunden",
  };
}

function listeneintrag(stand: AnweisungStand, version: number): AnweisungListeneintrag {
  return {
    id: "a-1",
    titel: "Start im Homeoffice",
    stand,
    version,
    urheber: "u-pia",
    erstelltAm: "2026-09-26T08:00:00.000Z",
    geaendertAm: GEAENDERT,
    sichtbareBausteine: 1,
    verborgeneBausteine: 0,
    unvollstaendig: false,
  };
}

/** Jede Schreibanfrage (POST/PUT/PATCH/DELETE) dieses Falls — Methode und Adresse. */
let schreibanfragen: string[] = [];

function serviere(stand: AnweisungStand, version: number, neuere = false): void {
  globalThis.fetch = (async (eingabe: unknown, init?: { method?: string }) => {
    const adresse = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode !== "GET") {
      schreibanfragen.push(`${methode} ${adresse}`);
    }
    const antwort = (status: number, rumpf: unknown) =>
      ({
        status,
        ok: status >= 200 && status < 300,
        statusText: String(status),
        text: async () => JSON.stringify(rumpf),
      }) as unknown as Response;
    if (adresse === "/api/gesamtanweisungen") {
      return antwort(200, { eintraege: [listeneintrag(stand, version)] });
    }
    if (adresse === "/api/gesamtanweisungen/a-1" && methode === "GET") {
      return antwort(200, lesestand(stand, version, neuere));
    }
    if (adresse === "/api/gesamtanweisungen/a-1/staende") {
      return antwort(200, { staende: [version] });
    }
    if (adresse === "/api/directory") {
      return antwort(200, [{ id: "u-pia", name: "Pia Beispiel" }]);
    }
    return antwort(404, { error: "NOT_FOUND", message: adresse });
  }) as typeof globalThis.fetch;
}

beforeEach(() => {
  echtesFetch = globalThis.fetch;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = echtesFetch;
  sitzung.rolle = "experte";
  schreibanfragen = [];
});

async function zeige(pfad: string): Promise<void> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [pfad] },
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
                Routes,
                null,
                createElement(Route, {
                  path: "/gesamtanweisungen",
                  element: createElement(GesamtanweisungBereich),
                }),
                createElement(Route, {
                  path: "/gesamtanweisungen/:id",
                  element: createElement(GesamtanweisungBereich),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 200 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  expect(bedingung(), `Die Fläche hat nie erreicht: ${was}`).toBe(true);
}

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);

/** Der sichtbare Statusblock einer Ansicht, Teil für Teil. */
function statusblock(stamm: string): Record<string, string | null> {
  const teil = (name: string) => marke(`${stamm}-${name}`)?.textContent ?? null;
  return {
    stand: teil("stand"),
    fassung: teil("fassung"),
    bedeutung: teil("bedeutung"),
    pruefung: teil("pruefung"),
    schritt: teil("schritt"),
  };
}

async function beideAnsichten(
  stand: AnweisungStand,
  version: number,
  rolle: string,
  erwarteterSchritt: string,
  neuere = false,
): Promise<{ liste: Record<string, string | null>; detail: Record<string, string | null> }> {
  sitzung.rolle = rolle;
  serviere(stand, version, neuere);
  const schritt = `${text("fe001.status.naechsterSchritt")} ${text(erwarteterSchritt)}`;

  await zeige("/gesamtanweisungen");
  await warteBis(
    () => marke(`${LISTE_MARKE}-schritt`)?.textContent === schritt,
    `Übersicht: ${stand} als ${rolle}`,
  );
  const liste = statusblock(LISTE_MARKE);

  await act(async () => {
    root.unmount();
  });
  root = createRoot(container);
  const antwortenVorher = sitzung.antworten;
  await zeige("/gesamtanweisungen/a-1");
  // Erst wenn die Sitzung dieser Montage beantwortet ist, gilt ihre Rolle. Der Schritt allein
  // trennt das nicht immer — „gilt" (entschieden) lautet für jede Rolle gleich, und das Warten
  // endete sonst noch unter der Vorschau-Rolle.
  await warteBis(() => sitzung.antworten > antwortenVorher, `Sitzung als ${rolle} beantwortet`);
  // Die Antwort erreicht den Baum über die gebündelte Benachrichtigung von react-query (eigener
  // Zeitgeber) — einige Takte durchlaufen lassen, bevor gelesen wird.
  for (let takt = 0; takt < 3; takt += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  await warteBis(
    () => marke(`${SEITE_MARKE}-schritt`)?.textContent === schritt,
    `Detail: ${stand} als ${rolle}`,
  );
  const detail = statusblock(SEITE_MARKE);
  return { liste, detail };
}

describe("B · Übersicht und Detail zeigen denselben Status derselben Fassung", () => {
  const FAELLE: ReadonlyArray<[AnweisungStand, string, string]> = [
    ["entwurf", "experte", "fe001.status.schritt.vorlegen"],
    ["entwurf", "viewer", "fe001.status.schritt.nurLesen"],
    ["vorgelegt", "experte", "fe001.status.schritt.warten"],
    ["vorgelegt", "controller", "fe001.status.schritt.entscheiden"],
    ["entschieden", "controller", "fe001.status.schritt.gilt"],
    ["abgelehnt", "experte", "fe001.status.schritt.ueberarbeiten"],
  ];

  for (const [stand, rolle, schritt] of FAELLE) {
    it(`K1/K4 · ${stand} als ${rolle}: identischer Statusblock in beiden Ansichten`, async () => {
      const { liste, detail } = await beideAnsichten(stand, 7, rolle, schritt);
      expect(detail).toEqual(liste);
      expect(liste.stand).toContain(text(`ga.stand.${stand}`));
      expect(liste.fassung).toBe(text("fe001.status.fassung", { nummer: 7 }));
      expect(liste.bedeutung).toBe(text(`fe001.status.bedeutung.${stand}`));
    });
  }

  it("K2 · vorgelegt: sichtbar „noch nicht freigegeben“, nie das Freigabewort", async () => {
    const { liste, detail } = await beideAnsichten(
      "vorgelegt",
      3,
      "experte",
      "fe001.status.schritt.warten",
    );
    for (const block of [liste, detail]) {
      expect(block.stand).toContain("Vorgelegt");
      expect(block.stand).not.toContain("Freigegeben");
      expect(block.bedeutung).toContain("noch nicht freigegeben");
      expect(block.pruefung).toBeNull();
    }
  });

  it("K3 · freigegeben: Fassung und Zeitpunkt erkennbar, die prüfende Person als nicht festgehalten", async () => {
    const { liste, detail } = await beideAnsichten(
      "entschieden",
      5,
      "experte",
      "fe001.status.schritt.gilt",
    );
    const zeit = formatKoTimestamp(GEAENDERT, "de") as string;
    for (const block of [liste, detail]) {
      expect(block.stand).toContain("Freigegeben");
      expect(block.pruefung).toBe(text("fe001.status.pruefung.freigegeben", { nummer: 5, zeit }));
      expect(block.pruefung).toContain("Stand 5");
      expect(block.pruefung).toContain(zeit);
      expect(block.pruefung).toContain("nicht festgehalten");
      // Kein Name wird als prüfende Person ausgegeben — auch nicht der Urheber aus dem Verzeichnis.
      expect(block.pruefung).not.toContain("Pia");
    }
  });

  it("K3 · abgelehnt: weder Zeitpunkt noch Person werden behauptet", async () => {
    const { liste, detail } = await beideAnsichten(
      "abgelehnt",
      6,
      "experte",
      "fe001.status.schritt.ueberarbeiten",
    );
    const zeit = formatKoTimestamp(GEAENDERT, "de") as string;
    for (const block of [liste, detail]) {
      expect(block.pruefung).toBe(text("fe001.status.pruefung.abgelehnt"));
      expect(block.pruefung).not.toContain(zeit);
      expect(block.pruefung).not.toContain("Pia");
    }
  });

  it("K4 · Gegenprobe: der Prüfer sieht im Detail die Entscheidungsknöpfe, der Experte nicht", async () => {
    await beideAnsichten("vorgelegt", 3, "controller", "fe001.status.schritt.entscheiden");
    expect(marke("ga-entscheidung-annehmen")).not.toBeNull();
    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await beideAnsichten("vorgelegt", 3, "experte", "fe001.status.schritt.warten");
    expect(marke("ga-entscheidung-annehmen")).toBeNull();
  });
});

// ================================================================================================
// TEIL C · BEN R1, BEN-01 — die ANGEBOTENE Handlung entspricht dem Recht, nicht nur der Text
// ================================================================================================
//
// Befund: Ein Viewer (kein `ko.create`) las „Du kannst die Anleitung lesen …" und bekam trotzdem
// einen aktiven „Vorlegen"-Knopf. Jeder Schreibweg dieser Fläche verlangt am Server `ko.create`
// (`services/app/src/routes/gesamtanweisung-routes.ts`). Gegenproben: Experte (darf vorlegen,
// nicht entscheiden) und Controller (darf beides).

const knopf = (id: string) => marke(id) as HTMLButtonElement | null;

describe("C · BEN-01: Vorlegen und Ändern nur, wer es darf", () => {
  for (const stand of ["entwurf", "abgelehnt"] as const) {
    it(`Viewer, ${stand}: kein Vorlegen-Knopf, Ändern gesperrt mit Grund`, async () => {
      await beideAnsichten(stand, 7, "viewer", "fe001.status.schritt.nurLesen");
      expect(marke("ga-entscheidung-vorlegen"), "Vorlegen darf nicht angeboten werden").toBeNull();
      expect(marke("ga-entscheidung-annehmen")).toBeNull();
      expect(knopf("ga-kopf-speichern")?.disabled).toBe(true);
      expect(marke("ga-kopf-sperre")?.textContent).toBe(text("fe001.sperre.keinErfassungsrecht"));
      expect(knopf("ga-aufnahme-knopf")?.disabled).toBe(true);
      expect(marke("ga-entscheidung-erklaerung")?.textContent ?? "").not.toContain(
        "erneut vorlegen",
      );
    });

    it(`Experte, ${stand}: Vorlegen angeboten und aktiv, Ändern nicht aus Rechtegründen gesperrt`, async () => {
      const schritt =
        stand === "entwurf"
          ? "fe001.status.schritt.vorlegen"
          : "fe001.status.schritt.ueberarbeiten";
      await beideAnsichten(stand, 7, "experte", schritt);
      expect(knopf("ga-entscheidung-vorlegen")?.disabled).toBe(false);
      expect(marke("ga-kopf-sperre")?.textContent ?? "").not.toBe(
        text("fe001.sperre.keinErfassungsrecht"),
      );
    });
  }

  it("Controller, entwurf: Vorlegen angeboten und aktiv", async () => {
    await beideAnsichten("entwurf", 7, "controller", "fe001.status.schritt.vorlegen");
    expect(knopf("ga-entscheidung-vorlegen")?.disabled).toBe(false);
  });
});

// ================================================================================================
// TEIL D · BEN nacharbeit-9 — die Übernahme einer neueren Quellfassung folgt demselben Recht
// ================================================================================================
//
// Befund: der Knopf „Fassung N übernehmen" prüfte nur Lese-/Schreiblage, Fassung und laufende
// Anfrage — ein Viewer bekam ihn aktiv, obwohl der Server dafür `ko.create` verlangt
// (`gesamtanweisung-routes.ts`). Die Übernahme aus einer ENTSCHIEDENEN Anleitung bleibt für
// Berechtigte bewusst möglich (danach wieder Entwurf) — die Standsperre gilt ihr nicht.
// GEGENPROBE: in `GesamtanweisungSeite.tsx` die Rechtesperre an `aenderung.gesperrt` wieder
// entfernen → die Viewer-Fälle werden rot (Knopf aktiv, Klick schreibt).

const uebernahmen = (): string[] => schreibanfragen.filter((a) => a.endsWith("/uebernehmen"));

const uebernahmeKnopf = (): HTMLButtonElement | null =>
  ([...container.querySelectorAll("button")].find(
    (b) => b.textContent === text("quellen.uebernehmen", { version: 2 }),
  ) ?? null) as HTMLButtonElement | null;

describe("D · Übernahme einer neueren Quellfassung nur, wer schreiben darf", () => {
  for (const stand of ["entwurf", "entschieden"] as const) {
    const schritt = (rolle: string) =>
      stand === "entschieden"
        ? "fe001.status.schritt.gilt"
        : rolle === "viewer"
          ? "fe001.status.schritt.nurLesen"
          : "fe001.status.schritt.vorlegen";

    it(`Viewer, ${stand}: die Änderung ist sichtbar, die Übernahme nicht ausführbar`, async () => {
      await beideAnsichten(stand, 7, "viewer", schritt("viewer"), true);
      await warteBis(() => uebernahmeKnopf() !== null, "Übernahmeknopf gezeichnet");
      expect(marke("ga-lesestand-aenderung")).not.toBeNull();
      expect(uebernahmeKnopf()?.disabled, "Viewer darf nicht übernehmen").toBe(true);
      await act(async () => {
        uebernahmeKnopf()?.click();
      });
      expect(uebernahmen()).toEqual([]);
    });

    it(`Experte, ${stand}: die Übernahme ist aktiv und schreibt genau diesen Abschnitt`, async () => {
      await beideAnsichten(stand, 7, "experte", schritt("experte"), true);
      await warteBis(() => uebernahmeKnopf() !== null, "Übernahmeknopf gezeichnet");
      expect(uebernahmeKnopf()?.disabled).toBe(false);
      await act(async () => {
        uebernahmeKnopf()?.click();
      });
      await warteBis(() => uebernahmen().length > 0, "Übernahme angefragt");
      expect(uebernahmen()).toEqual(["POST /api/gesamtanweisungen/a-1/bausteine/b-1/uebernehmen"]);
    });
  }
});
