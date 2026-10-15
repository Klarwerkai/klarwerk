// @vitest-environment jsdom
// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — DIE KARTE GEMOUNTET (fetch an der Netzgrenze).
// ================================================================================================
//
//   K1 · LWE-01  Die Kapital-Sicht kennzeichnet die Beispielrechnung als geschätzt und zeigt die
//                realen Werte getrennt davon; ohne Stand gibt es dort keinen Geldwert.
//   K2 · LWE-02  Eingeben, Fehler je Feld sehen, korrigieren, speichern; danach zeigt die Karte den
//                neu gelesenen Stand samt Rechnung. Das Formular startet LEER, nicht mit Beispielen.
//   K3 · LWE-06  Unbekannter Schreibausgang: ehrlich benannt, Eingabe bleibt, „Erneut senden“
//                schickt DIESELBE Anfragekennung.
//   K4 · LWE-06  Paralleler Stand (409): Eingabe bleibt im Formular, aktueller Stand wird gezeigt;
//                überschrieben wird nur auf ausdrücklichen Klick und dann auf dem aktuellen Stand.
//   K5 · LWE-03  Ohne Schreibrecht: nur lesen, kein Eingabeweg.
//   K6 · LWE-06  Verzögerte Antwort: Eingaben, Abbrechen und Bereichswahl sind gesperrt; die späte
//                Antwort verwirft keinen neueren Entwurf (Ben, Nacharbeit 3).
//   K7 · LWE-06  Abbrechen nach unbekanntem Ausgang: der offene Ausgang bleibt in der Karte benannt.
// Nicht gemessen: echtes Browserlayout — dafür tests-smoke/lagebild-werte-browser.spec.ts.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type {
  LagebildBereich,
  LagebildWerte,
  ManagementSnapshot,
} from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { LagebildWerteKarte } from "../../apps/web/src/components/LagebildWerte";
import i18n from "../../apps/web/src/i18n";
import { Capital } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FAKTEN = { validatedKos: 10, totalKos: 12, avgTrust: 80, demoKos: 0 };

function gespeichert(version: number, hourlyRate: number, vonWem = "u-ich"): LagebildWerte {
  return {
    bereich: "gesamt",
    zeitraumVon: "2025-07-01",
    zeitraumBis: "2025-09-30",
    werte: {
      hourlyRate: { wert: hourlyRate, herkunft: "eigene_eingabe", beleg: null },
      hoursSavedPerValidatedKo: {
        wert: 1.5,
        herkunft: "gemessen",
        beleg: "Zeiterfassung Q3 (erfunden)",
      },
      reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
    },
    version,
    anfrageId: `anfrage-${version}-xxxx`,
    geaendertAm: "2025-10-01T08:00:00.000Z",
    geaendertVon: vonWem,
  };
}

interface Buehne {
  bereich: LagebildBereich;
  /**
   * Antwort je PUT der Reihe nach; `"netz"` = Verbindungsabbruch (fetch wirft); `verzoegert` = die
   * Antwort kommt erst, wenn der Test das Versprechen einlöst (Nacharbeit 3, späte Antwort).
   */
  antworten: Array<
    | "netz"
    | { status: number; body: unknown }
    | { verzoegert: Promise<{ status: number; body: unknown }> }
  >;
  puts: Array<Record<string, unknown>>;
}

let buehne: Buehne;

function antwort(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const SNAPSHOT: ManagementSnapshot = {
  generatedAt: "2026-10-13T08:00:00.000Z",
  overview: {
    totalKos: 12,
    validated: 10,
    open: 2,
    openGaps: 0,
    openConflicts: 0,
    avgTrust: 80,
    healthScore: 60,
    healthBand: "mittel",
    demoKos: 0,
  },
  capital: { score: 60, band: "mittel", parts: [] },
  valuationFacts: { validatedKos: 10, totalKos: 12, avgTrust: 80 },
  statement: {
    assets: 10,
    riskItems: 0,
    riskBreakdown: { singleSourceCategories: 0, stale: 0, openGaps: 0, openConflicts: 0 },
    net: 10,
  },
  maturity: { stage: 3, stageKey: "validieren", progressPct: 60 },
  priorities: [],
  recommendations: [],
  house: [],
  houseFlow: {
    imported: 0,
    importedValidated: 0,
    inHouse: 12,
    secured: 10,
    floors: 0,
    fragileFloors: 0,
    outputReady: 10,
  },
  pilot: [{ days: 30, created: 1, validated: 1 }],
};

function stelleFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const pfad = String(url);
      const methode = init?.method ?? "GET";
      if (pfad.includes("/api/management/lagebild-werte") && methode === "PUT") {
        buehne.puts.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        const eintragRoh = buehne.antworten.shift() ?? { status: 500, body: {} };
        if (eintragRoh === "netz") {
          throw new TypeError("Failed to fetch");
        }
        const naechste = "verzoegert" in eintragRoh ? await eintragRoh.verzoegert : eintragRoh;
        if (naechste.status === 200) {
          const eintrag = (naechste.body as { eintrag: LagebildWerte }).eintrag;
          buehne.bereich = { ...buehne.bereich, werte: eintrag, vonMir: true };
        }
        return antwort(naechste.status, naechste.body);
      }
      if (pfad.includes("/api/management/lagebild-werte")) {
        return antwort(200, { bereiche: [buehne.bereich] });
      }
      if (pfad.includes("/api/management/snapshot")) {
        return antwort(200, SNAPSHOT);
      }
      return antwort(500, {});
    }),
  );
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  await i18n.changeLanguage("de");
});

async function mounten(inhalt: ReturnType<typeof createElement>, route = "/kapital") {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: [route] }, inhalt),
        ),
      ),
    );
  });
  // Mount und nachgeladene Karten jeweils committen, bevor deren Queries verarbeitet werden.
  await vi.waitFor(async () => {
    await act(async () => {
      await durchlaufen();
    });
    expect(container.querySelector('[data-testid="lagebild-ergebnis"]')).not.toBeNull();
  });
  return container;
}

function el<T extends Element = HTMLElement>(container: HTMLElement, testid: string): T {
  const e = container.querySelector(`[data-testid="${testid}"]`);
  if (!e) {
    throw new Error(`[data-testid="${testid}"] fehlt`);
  }
  return e as T;
}

/**
 * React 18 leert Effekte und Zustandsänderungen eines `act` erst an dessen Ende. Abfragen, die erst
 * nach dem Commit starten (Abo im Effekt, Neuladen nach dem Speichern), brauchen deshalb eine
 * weitere Runde — dieselbe Lehre wie `tests/analytics/kapital-pruefaufgaben-mounted.test.tsx`.
 */
async function nachlaufen(): Promise<void> {
  for (let runde = 0; runde < 3; runde++) {
    await act(async () => {
      await durchlaufen();
    });
  }
}

async function klick(container: HTMLElement, testid: string): Promise<void> {
  await act(async () => {
    el(container, testid).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await durchlaufen();
  });
  await nachlaufen();
}

async function tippe(container: HTMLElement, testid: string, wert: string): Promise<void> {
  const feld = el<HTMLInputElement | HTMLSelectElement>(container, testid);
  const proto =
    feld instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(feld, wert);
    feld.dispatchEvent(
      new Event(feld instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
    );
    await durchlaufen();
  });
}

async function speichern(container: HTMLElement): Promise<void> {
  await act(async () => {
    el<HTMLFormElement>(container, "lagebild-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await durchlaufen();
  });
  await nachlaufen();
}

async function fuelleGueltig(container: HTMLElement): Promise<void> {
  await tippe(container, "lagebild-von", "2025-07-01");
  await tippe(container, "lagebild-bis", "2025-09-30");
  await tippe(container, "lagebild-eingabe-hourlyRate", "72,5");
  await tippe(container, "lagebild-eingabe-hoursSavedPerValidatedKo", "1,5");
  await tippe(container, "lagebild-herkunft-hoursSavedPerValidatedKo", "gemessen");
  await tippe(container, "lagebild-beleg-hoursSavedPerValidatedKo", "Zeiterfassung Q3 (erfunden)");
  await tippe(container, "lagebild-eingabe-reuseFactor", "4");
}

function neueBuehne(over: Partial<LagebildBereich> = {}): void {
  buehne = {
    bereich: {
      bereich: "gesamt",
      name: null,
      darfSchreiben: true,
      werte: null,
      vonMir: false,
      fakten: FAKTEN,
      ...over,
    },
    antworten: [],
    puts: [],
  };
}

describe("Lagebild-Werte · Karte", () => {
  it("K1 · Kapital-Sicht: Beispielrechnung als geschätzt gekennzeichnet, reale Werte getrennt", async () => {
    neueBuehne();
    stelleFetch();
    const c = await mounten(createElement(Capital));
    const beispiel = el(c, "kapital-beispielrechnung");
    expect(el(c, "kapital-beispiel-kennzeichnung").textContent).toBe(
      i18n.t("lagebildwerte.beispiel.kennzeichnung"),
    );
    const karte = el(c, "lagebild-werte");
    // Getrennt: die Karte der realen Werte liegt NICHT im Beispielkasten.
    expect(beispiel.contains(karte)).toBe(false);
    expect(el(c, "lagebild-leer").textContent).toBe(i18n.t("lagebildwerte.leer"));
    expect(el(c, "lagebild-ergebnis").getAttribute("data-zustand")).toBe("nicht_berechenbar");
    expect(c.querySelector('[data-testid="lagebild-ergebnis-eur"]')).toBeNull();
    expect(el(c, "lagebild-grund").getAttribute("data-grund")).toBe("keine_werte");
  });

  it("K2 · eingeben, Fehler sehen, korrigieren, speichern — danach der gelesene Stand samt Rechnung", async () => {
    neueBuehne();
    stelleFetch();
    const c = await mounten(createElement(LagebildWerteKarte));
    await klick(c, "lagebild-bearbeiten");
    // Leer — keine Beispielwerte als Eingabe.
    for (const feld of ["hourlyRate", "hoursSavedPerValidatedKo", "reuseFactor"]) {
      expect(el<HTMLInputElement>(c, `lagebild-eingabe-${feld}`).value).toBe("");
    }
    // Clientseitig: Text ist keine Zahl — nichts wird gesendet.
    await tippe(c, "lagebild-eingabe-hourlyRate", "siebzig");
    await speichern(c);
    expect(buehne.puts).toHaveLength(0);
    expect(el(c, "lagebild-fehler").textContent).toContain(
      "Stundensatz: bitte eine Zahl eingeben.",
    );

    // Serverseitig: der Server erklärt den fehlenden Beleg.
    await fuelleGueltig(c);
    await tippe(c, "lagebild-beleg-hoursSavedPerValidatedKo", "");
    buehne.antworten.push({
      status: 400,
      body: {
        error: "INVALID_LAGEBILD_WERTE",
        message: "x",
        fehler: [
          {
            feld: "hoursSavedPerValidatedKo",
            meldung:
              "Gesparte Stunden je validiertem Objekt: für einen gemessenen Wert bitte den Beleg nennen (wo die Messung steht).",
          },
        ],
      },
    });
    await speichern(c);
    expect(el(c, "lagebild-fehler").textContent).toContain("bitte den Beleg nennen");
    expect(el<HTMLInputElement>(c, "lagebild-eingabe-hourlyRate").value).toBe("72,5");

    await tippe(c, "lagebild-beleg-hoursSavedPerValidatedKo", "Zeiterfassung Q3 (erfunden)");
    buehne.antworten.push({
      status: 200,
      body: { eintrag: gespeichert(1, 72.5), wiederholt: false },
    });
    await speichern(c);
    const gesendet = buehne.puts.at(-1);
    expect(gesendet).toMatchObject({
      zeitraumVon: "2025-07-01",
      zeitraumBis: "2025-09-30",
      basisVersion: 0,
      werte: {
        hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
        hoursSavedPerValidatedKo: {
          wert: 1.5,
          herkunft: "gemessen",
          beleg: "Zeiterfassung Q3 (erfunden)",
        },
        reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
      },
    });
    expect(el(c, "lagebild-meldung").textContent).toBe(
      i18n.t("lagebildwerte.form.gespeichert", { version: 1 }),
    );
    expect(c.querySelector('[data-testid="lagebild-form"]')).toBeNull();
    expect(el(c, "lagebild-anzeige").getAttribute("data-version")).toBe("1");
    const zeile = c.querySelector(
      '[data-testid="lagebild-zeile"][data-feld="hoursSavedPerValidatedKo"]',
    );
    expect(zeile?.getAttribute("data-herkunft")).toBe("gemessen");
    expect(zeile?.textContent).toContain("Zeiterfassung Q3 (erfunden)");
    // 10 × (72,5 × 1,5 × 4) × 0,8 = 3480 — dieselbe Formel wie die Beispielrechnung.
    expect(el(c, "lagebild-ergebnis-eur").textContent).toBe("3.480 €");
    expect(el(c, "lagebild-art").getAttribute("data-art")).toBe("eigene_annahme");
  });

  it("K3 · unbekannter Schreibausgang: benannt, Eingabe bleibt, „Erneut senden“ mit derselben Kennung", async () => {
    neueBuehne();
    stelleFetch();
    const c = await mounten(createElement(LagebildWerteKarte));
    await klick(c, "lagebild-bearbeiten");
    await fuelleGueltig(c);
    buehne.antworten.push("netz");
    await speichern(c);
    expect(el(c, "lagebild-unbekannt").textContent).toContain(
      i18n.t("lagebildwerte.form.unbekannt"),
    );
    expect(el<HTMLInputElement>(c, "lagebild-eingabe-hourlyRate").value).toBe("72,5");

    buehne.antworten.push({
      status: 200,
      body: { eintrag: gespeichert(1, 72.5), wiederholt: true },
    });
    await klick(c, "lagebild-erneut");
    expect(buehne.puts).toHaveLength(2);
    expect(buehne.puts[1]?.anfrageId).toBe(buehne.puts[0]?.anfrageId);
    expect(buehne.puts[1]?.basisVersion).toBe(0);
    expect(el(c, "lagebild-meldung").textContent).toBe(
      i18n.t("lagebildwerte.form.wiederholt", { version: 1 }),
    );
  });

  it("K4 · paralleler Stand: Eingabe bleibt, aktueller Stand sichtbar, Überschreiben nur bewusst", async () => {
    neueBuehne({ werte: gespeichert(1, 60), vonMir: true });
    stelleFetch();
    const c = await mounten(createElement(LagebildWerteKarte));
    await klick(c, "lagebild-bearbeiten");
    expect(el<HTMLInputElement>(c, "lagebild-eingabe-hourlyRate").value).toBe("60");
    await tippe(c, "lagebild-eingabe-hourlyRate", "75");
    buehne.antworten.push({
      status: 409,
      body: {
        error: "LAGEBILD_KONFLIKT",
        message: "x",
        aktuell: gespeichert(2, 90, "u-andere"),
        aktuellVonMir: false,
      },
    });
    await speichern(c);
    const konflikt = el(c, "lagebild-konflikt");
    expect(konflikt.textContent).toContain(i18n.t("lagebildwerte.wer.andere"));
    expect(
      konflikt.querySelector('[data-testid="lagebild-anzeige"]')?.getAttribute("data-version"),
    ).toBe("2");
    // Die eigene Eingabe ist nicht verloren und nicht still ersetzt.
    expect(el<HTMLInputElement>(c, "lagebild-eingabe-hourlyRate").value).toBe("75");
    expect(buehne.puts[0]?.basisVersion).toBe(1);

    buehne.antworten.push({
      status: 200,
      body: { eintrag: gespeichert(3, 75), wiederholt: false },
    });
    await klick(c, "lagebild-ueberschreiben");
    expect(buehne.puts[1]?.basisVersion).toBe(2);
    expect(buehne.puts[1]?.anfrageId).not.toBe(buehne.puts[0]?.anfrageId);
    expect(el(c, "lagebild-meldung").textContent).toBe(
      i18n.t("lagebildwerte.form.gespeichert", { version: 3 }),
    );
  });

  // Ben (Nacharbeit 3, LWE-06): eine späte Antwort darf keine inzwischen getippte Korrektur
  // verwerfen, und der laufende Ausgang darf nicht durch Abbrechen oder Bereichswechsel verschwinden.
  it("K6 · verzögerte Antwort: während des Schreibens gesperrt, danach genau der abgesendete Stand", async () => {
    neueBuehne();
    stelleFetch();
    const c = await mounten(createElement(LagebildWerteKarte));
    await klick(c, "lagebild-bearbeiten");
    await fuelleGueltig(c);
    let einloesen: (a: { status: number; body: unknown }) => void = () => {};
    buehne.antworten.push({
      verzoegert: new Promise((fertig) => {
        einloesen = fertig;
      }),
    });
    await speichern(c);

    // Der Schreibvorgang läuft: sichtbar benannt, Eingaben, Abbrechen und Bereichswahl gesperrt.
    expect(el(c, "lagebild-form").getAttribute("data-laeuft")).toBe("ja");
    expect(el(c, "lagebild-laeuft").textContent).toBe(i18n.t("lagebildwerte.form.laeuft"));
    for (const testid of [
      "lagebild-von",
      "lagebild-bis",
      "lagebild-eingabe-hourlyRate",
      "lagebild-herkunft-hoursSavedPerValidatedKo",
      "lagebild-beleg-hoursSavedPerValidatedKo",
      "lagebild-abbrechen",
      "lagebild-speichern",
      "lagebild-bereich-wahl",
    ]) {
      expect(
        (el(c, testid) as HTMLInputElement | HTMLButtonElement | HTMLSelectElement).disabled,
        `${testid} ist während des Schreibens bedienbar`,
      ).toBe(true);
    }
    // Ein Tippversuch und ein Abbruchversuch ändern nichts: kein neuer Entwurf, das Formular bleibt.
    await tippe(c, "lagebild-eingabe-hourlyRate", "99");
    expect(el<HTMLInputElement>(c, "lagebild-eingabe-hourlyRate").value).toBe("72,5");
    await klick(c, "lagebild-abbrechen");
    expect(c.querySelector('[data-testid="lagebild-form"]')).not.toBeNull();
    expect(buehne.puts).toHaveLength(1);

    // Die späte Antwort kommt: gespeichert ist genau der abgesendete Stand, und er wird angezeigt.
    await act(async () => {
      einloesen({ status: 200, body: { eintrag: gespeichert(1, 72.5), wiederholt: false } });
      await durchlaufen();
    });
    await nachlaufen();
    expect(buehne.puts[0]?.werte).toMatchObject({ hourlyRate: { wert: 72.5 } });
    expect(c.querySelector('[data-testid="lagebild-form"]')).toBeNull();
    expect(el(c, "lagebild-meldung").textContent).toBe(
      i18n.t("lagebildwerte.form.gespeichert", { version: 1 }),
    );
    expect(
      c.querySelector('[data-testid="lagebild-zeile"][data-feld="hourlyRate"]')?.textContent,
    ).toContain("72,5");
    expect((el(c, "lagebild-bereich-wahl") as HTMLSelectElement).disabled).toBe(false);
  });

  it("K7 · Abbrechen nach unbekanntem Ausgang: der offene Ausgang bleibt benannt", async () => {
    neueBuehne();
    stelleFetch();
    const c = await mounten(createElement(LagebildWerteKarte));
    await klick(c, "lagebild-bearbeiten");
    await fuelleGueltig(c);
    buehne.antworten.push("netz");
    await speichern(c);
    expect(el(c, "lagebild-unbekannt")).toBeTruthy();
    await klick(c, "lagebild-abbrechen");
    expect(c.querySelector('[data-testid="lagebild-form"]')).toBeNull();
    expect(el(c, "lagebild-meldung").textContent).toBe(
      i18n.t("lagebildwerte.form.abbruchUnbekannt"),
    );
  });

  it("K5 · ohne Schreibrecht: lesen ja, Eingabeweg nein", async () => {
    neueBuehne({ darfSchreiben: false, werte: gespeichert(1, 60) });
    stelleFetch();
    const c = await mounten(createElement(LagebildWerteKarte));
    expect(el(c, "lagebild-anzeige")).toBeTruthy();
    expect(el(c, "lagebild-nur-lesen").textContent).toBe(i18n.t("lagebildwerte.nurLesen.gesamt"));
    expect(c.querySelector('[data-testid="lagebild-bearbeiten"]')).toBeNull();
  });
});
