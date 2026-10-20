// @vitest-environment jsdom
// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender) · DIE SEITE `/kalender-anbindung`, GEMOUNTET.
// ================================================================================================
//
// Die echte Seite (`pages/KalenderAnbindung.tsx`) mit echtem i18n und echtem API-Client; nur das
// Netz ist eine Attrappe, die jeden Ruf samt Rumpf mitschreibt. Belegt wird die BEDIENUNG — nicht
// die Wirkung im Kalender (die misst `kalender-am-server.test.ts` am Server, ein echter
// Microsoft-365-Kalender bleibt offen).
//
//   U1 (P07-Zusatz, K1)  freiwilliger, erneut aufrufbarer Zauberhut mit Zeitzonenwahl; verbindet erst
//                        auf ausdrücklichen Knopf; Konto, Rechte und Feldrichtungen sichtbar.
//   U2 (P07-AC05/AC06)   Entscheidungsdialog: Schließen meldet `dialog_geschlossen` OHNE Umfang;
//                        ohne gewählten Umfang ist keine Wahl möglich; „ganze Serie“ geht mit.
//   U3 (AW17-K04)        Löschen: erst Ziel samt Fassung lesen, dann genau diese Fassung senden.
//   U4 (DE/EN)           dieselbe Seite auf Englisch.
//   U7 (S09, AW17-K01)   ein Eintrag des eigenen Kalenders wird ausgewählt und NUR mit seiner Kennung
//                        eingetragen; Auftrag und Lauf sind vorher sichtbar, die gemeinsame Kennung
//                        des Servers danach; geschützte Einträge stehen nicht zur Wahl.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import i18n from "../../apps/web/src/i18n";
import { KalenderAnbindungSeite } from "../../apps/web/src/pages/KalenderAnbindung";
import { beruhige, klicke, tippe } from "../admin-navigation/vorrichtung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KONTO = {
  kennung: "obj-1",
  anzeige: "Testkalender Klarwerk",
  adresse: "testkalender@klarwerk-test.example",
};
const KALENDER = {
  id: "kal-test",
  name: "Testkalender",
  art: "eigen",
  besitzer: KONTO.adresse,
  rechte: { lesen: true, eigeneSchreiben: true, geteiltBearbeiten: false, einladen: true },
};
const FELDER = {
  titel: { richtung: "klara", konflikt: "nachfragen" },
  zeit: { richtung: "klara", konflikt: "nachfragen" },
  ort: { richtung: "kalender", konflikt: "fuehrend_mit_hinweis" },
  beschreibung: { richtung: "klara", konflikt: "nachfragen" },
  teilnehmer: { richtung: "nur_klara", konflikt: "nachfragen" },
};
const ANBINDUNG = {
  id: "a1",
  anbieter: "microsoft365",
  konto: KONTO,
  kalender: KALENDER,
  umfang: "lesen_schreiben",
  rechte: KALENDER.rechte,
  felder: FELDER,
  privatProjektion: "nur_belegt",
  entfernteAnzeige: "pausieren_bis_entscheidung",
  angelegtAm: "2026-10-15T08:00:00.000Z",
};
const INTERN = {
  auftragId: "auftrag-zertifikat-3",
  ereignisId: "ereignis-1",
  fassung: 1,
  privat: false,
  serienart: "vorkommen",
  abgesagt: false,
  inhalt: {
    titel: "Fiktiv: Zertifikat verlängern",
    beginn: "2026-10-26T09:00",
    ende: "2026-10-26T09:30",
    zeitzone: "Europe/Berlin",
    ort: "",
    beschreibung: "",
    teilnehmer: [],
  },
};
const PAUSIERT = {
  schluessel: "kk-pausiert",
  anbindungId: "a1",
  auftragId: INTERN.auftragId,
  ereignisId: "ereignis-1",
  intern: INTERN,
  externeId: "ext-1",
  anbieterVersion: 'W/"v2"',
  serienart: "vorkommen",
  stand: "pausiert",
  sperrmarke: null,
  entscheidung: { anlass: "extern_geloescht", umfaenge: ["einzeltermin", "serie"], konflikte: [] },
  fehler: null,
  geaendertAm: "2026-10-15T09:00:00.000Z",
};
const LOESCHBAR = {
  ...PAUSIERT,
  schluessel: "kk-loeschbar",
  ereignisId: "ereignis-2",
  stand: "projiziert",
  entscheidung: null,
};

/** S09: die Einträge des eigenen Kalenders — einer mit Auftrag und Lauf, einer mit geschützter Quelle. */
const VORKOMMEN = "erinnerung-1@2026-10-20T09:00";
const EIGENE = [
  {
    id: "eintrag-1",
    titel: "Fiktiv: Zertifikat prüfen (eigener Kalender)",
    ganztaegig: false,
    beginn: "2026-10-20T07:00:00.000Z",
    ende: "2026-10-20T07:15:00.000Z",
    zeitzone: "Europe/Berlin",
    geschuetzt: false,
    auftrag: { taskId: "erinnerung-1", titel: "Fiktiv: Zertifikat prüfen", aufgeloest: true },
    lauf: { runId: VORKOMMEN, status: "geplant" },
  },
  {
    id: "eintrag-geschuetzt",
    titel: null,
    ganztaegig: false,
    beginn: "2026-10-21T07:00:00.000Z",
    ende: "2026-10-21T07:15:00.000Z",
    zeitzone: "Europe/Berlin",
    geschuetzt: true,
    auftrag: null,
    lauf: null,
  },
];
const UEBERNOMMEN = {
  ...LOESCHBAR,
  schluessel: "kk-uebernommen",
  auftragId: "erinnerung-1",
  ereignisId: VORKOMMEN,
};

interface Ruf {
  methode: string;
  pfad: string;
  rumpf: Record<string, unknown> | undefined;
}

let rufe: Ruf[] = [];
let anbindungen: unknown[] = [];
/** Vorbereitete Antworten der Löschtür bzw. der Eintragstür, der Reihe nach (sonst Erfolg). */
let loeschAntworten: { status: number; body: unknown }[] = [];
let eintragAntworten: { status: number; body: unknown }[] = [];
const AUSSTEHEND = {
  ok: false,
  stand: "ausstehend",
  grund: "anbieter_ausgefallen",
  meldung: "Kalender: Der verbundene Kalender hat nicht brauchbar geantwortet.",
  zuordnung: null,
};
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function netz(): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string; body?: unknown }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      const rumpf =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : undefined;
      rufe.push({ methode, pfad, rumpf });
      const antwort = (status: number, body: unknown) => ({
        status,
        ok: status < 400,
        statusText: String(status),
        headers: { get: () => null },
        text: async () => JSON.stringify(body),
      });
      const basis = "/api/me/klara/kalender";
      if (methode === "GET" && pfad === basis) {
        return antwort(200, {
          auswahl: { verbunden: true, konto: KONTO, kalender: [KALENDER] },
          anbindungen,
        });
      }
      if (methode === "POST" && pfad === `${basis}/anbindungen`) {
        anbindungen = [ANBINDUNG];
        return antwort(201, { anbindung: ANBINDUNG });
      }
      if (methode === "GET" && pfad === `${basis}/anbindungen/a1/zuordnungen`) {
        return antwort(200, { zuordnungen: [PAUSIERT, LOESCHBAR] });
      }
      if (methode === "GET" && pfad.startsWith(`${basis}/anbindungen/a1/termine`)) {
        return antwort(200, { ok: true, termine: [] });
      }
      if (methode === "POST" && pfad.endsWith("/entscheidung")) {
        return antwort(200, {
          laufWirkung: "pausiert",
          ergebnis: { ok: true, zuordnung: PAUSIERT, termin: null },
        });
      }
      if (methode === "POST" && pfad.endsWith("/loeschvorschau")) {
        return antwort(200, {
          ok: true,
          umfang: rumpf?.umfang,
          ziel: { ...INTERN.inhalt, id: "serie-1", version: 'W/"master-v7"', serienart: "serie" },
          fassung: 'W/"master-v7"',
        });
      }
      if (methode === "POST" && pfad.endsWith("/loeschen")) {
        const vorbereitet = loeschAntworten.shift();
        if (vorbereitet) {
          return antwort(vorbereitet.status, vorbereitet.body);
        }
        return antwort(200, { ok: true, zuordnung: LOESCHBAR, termin: null });
      }
      if (methode === "GET" && pfad === "/api/me/kalender") {
        return antwort(200, { eintraege: EIGENE });
      }
      if (
        methode === "POST" &&
        pfad === `${basis}/anbindungen/a1/termine` &&
        rumpf?.eigenerEintragId !== undefined
      ) {
        return antwort(200, { ok: true, zuordnung: UEBERNOMMEN, termin: null });
      }
      if (methode === "POST" && pfad === `${basis}/anbindungen/a1/termine`) {
        const vorbereitet = eintragAntworten.shift();
        if (vorbereitet) {
          return antwort(vorbereitet.status, vorbereitet.body);
        }
        return antwort(200, { ok: true, zuordnung: LOESCHBAR, termin: null });
      }
      throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
    },
  });
}

async function oeffne(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const r = root;
  await act(async () => {
    r.render(
      createElement(QueryClientProvider, { client: qc }, createElement(KalenderAnbindungSeite)),
    );
  });
  await beruhige();
}

const finde = (testId: string): HTMLElement | null =>
  document.body.querySelector(`[data-testid="${testId}"]`);

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
}

beforeEach(async () => {
  rufe = [];
  anbindungen = [];
  loeschAntworten = [];
  eintragAntworten = [];
  netz();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  document.body.innerHTML = "";
});

describe("U1 · Zauberhut — freiwillig, erneut aufrufbar, mit Zeitzonenwahl", () => {
  it("verbindet erst auf den ausdrücklichen Knopf; danach ist er erneut aufrufbar", async () => {
    await oeffne();
    expect(finde("kalender-konto")?.textContent).toContain("Testkalender Klarwerk");
    const start = finde("kalender-zauberhut-start");
    expect(start?.textContent).toContain("🎩");
    await klicke(start);
    expect(finde("kalender-zauberhut")).not.toBeNull();
    const zeitzone = finde("kalender-zeitzone") as HTMLSelectElement | null;
    expect(zeitzone).not.toBeNull();
    expect(zeitzone?.options.length ?? 0).toBeGreaterThan(0);
    // Durch alle Schritte — ohne den letzten Knopf wird NICHTS verbunden.
    for (let i = 0; i < 3; i += 1) {
      await klicke(knopfMitText(i18n.t("klarakalender.wizard.weiter")));
    }
    expect(finde("kalender-zusammenfassung")).not.toBeNull();
    expect(rufe.filter((r) => r.methode === "POST")).toEqual([]);
    await klicke(finde("kalender-verbinden"));
    const verbinden = rufe.find((r) => r.pfad.endsWith("/anbindungen"));
    expect(verbinden?.rumpf).toMatchObject({
      kalenderId: "kal-test",
      umfang: "nur_lesen",
      privatProjektion: "nur_belegt",
      felder: { teilnehmer: { richtung: "nur_klara" } },
    });
    await beruhige();
    // Erneut aufrufbar: der Knopf bleibt, jetzt als „erneut“.
    expect(finde("kalender-zauberhut-start")?.textContent).toContain(
      i18n.t("klarakalender.wizard.erneut"),
    );
    // Konto, Rechte und Feldrichtungen der Anbindung sind sichtbar.
    expect(finde("kalender-rechte")?.textContent).toContain(i18n.t("klarakalender.recht.einladen"));
    expect(finde("kalender-feldrichtungen")?.textContent).toContain(
      i18n.t("klarakalender.richtung.kalender"),
    );
  });
});

describe("U2 · P07-AC05/AC06 — Entscheidung: Schließen ist keine Zustimmung, Umfang ausdrücklich", () => {
  it("Schließen meldet dialog_geschlossen ohne Umfang; Wahl erst nach Umfang; Serie geht mit", async () => {
    anbindungen = [ANBINDUNG];
    await oeffne();
    await klicke(finde("kalender-entscheiden"));
    expect(finde("kalender-entscheidung")).not.toBeNull();
    const beenden = finde("kalender-wahl-beenden") as HTMLButtonElement | null;
    expect(beenden?.disabled).toBe(true);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await beruhige();
    const zu = rufe.find((r) => r.pfad.endsWith("/entscheidung"));
    expect(zu?.rumpf).toEqual({ wahl: "dialog_geschlossen" });

    await klicke(finde("kalender-entscheiden"));
    await klicke(finde("kalender-umfang-serie"));
    expect((finde("kalender-wahl-beenden") as HTMLButtonElement | null)?.disabled).toBe(false);
    await klicke(finde("kalender-wahl-beenden"));
    const entschieden = rufe.filter((r) => r.pfad.endsWith("/entscheidung")).at(-1);
    expect(entschieden?.rumpf).toEqual({ wahl: "beenden", umfang: "serie" });
  });
});

describe("U3 · AW17-K04 — Löschen nur mit der gelesenen Fassung", () => {
  it("liest erst Ziel und Fassung, dann sendet es genau diese Fassung", async () => {
    anbindungen = [ANBINDUNG];
    await oeffne();
    await klicke(knopfMitText(i18n.t("klarakalender.loeschen")));
    const bestaetigen = finde("kalender-loesch-bestaetigen") as HTMLButtonElement | null;
    expect(bestaetigen?.disabled).toBe(true);
    const serie = [...document.body.querySelectorAll('input[name="loesch-umfang"]')][1];
    await klicke(serie);
    await klicke(knopfMitText(i18n.t("klarakalender.loeschDialog.lesen")));
    expect(finde("kalender-loesch-fassung")?.textContent).toContain('W/"master-v7"');
    await klicke(finde("kalender-loesch-bestaetigen"));
    const loeschen = rufe.find((r) => r.pfad.endsWith("/loeschen"));
    expect(loeschen?.rumpf).toEqual({ umfang: "serie", fassung: 'W/"master-v7"' });
  });
});

describe("U5 · K3/AW17-K04 · Nacharbeit 4 — 202 mit ok:false ist kein Löscherfolg", () => {
  it("zeigt Stand und Meldung, lässt die Wiederholung mit DERSELBEN Fassung zu", async () => {
    anbindungen = [ANBINDUNG];
    loeschAntworten = [{ status: 202, body: AUSSTEHEND }];
    await oeffne();
    await klicke(knopfMitText(i18n.t("klarakalender.loeschen")));
    const serie = [...document.body.querySelectorAll('input[name="loesch-umfang"]')][1];
    await klicke(serie);
    await klicke(knopfMitText(i18n.t("klarakalender.loeschDialog.lesen")));
    await klicke(finde("kalender-loesch-bestaetigen"));

    // Kein falscher Erfolg: keine Erfolgsmeldung, sondern Stand und Meldung; Knopf bleibt nutzbar.
    expect(finde("kalender-loesch-ok")).toBeNull();
    expect(document.body.textContent).not.toContain(i18n.t("klarakalender.loeschDialog.ok"));
    expect(finde("kalender-loesch-nicht")?.textContent).toContain(
      i18n.t("klarakalender.stand.ausstehend"),
    );
    expect(finde("kalender-loesch-nicht")?.textContent).toContain(AUSSTEHEND.meldung);
    const knopf = finde("kalender-loesch-bestaetigen") as HTMLButtonElement | null;
    expect(knopf?.disabled).toBe(false);

    // Wiederholung: dieselbe gelesene Fassung, erst jetzt Erfolg und endgültige Sperre.
    await klicke(knopf);
    const loeschRufe = rufe.filter((r) => r.pfad.endsWith("/loeschen"));
    expect(loeschRufe.map((r) => r.rumpf)).toEqual([
      { umfang: "serie", fassung: 'W/"master-v7"' },
      { umfang: "serie", fassung: 'W/"master-v7"' },
    ]);
    expect(rufe.filter((r) => r.pfad.endsWith("/loeschvorschau"))).toHaveLength(1);
    expect(finde("kalender-loesch-ok")).not.toBeNull();
    expect((finde("kalender-loesch-bestaetigen") as HTMLButtonElement | null)?.disabled).toBe(true);
  });
});

describe("U6 · AW17-K01 · Nacharbeit 4 — Wiederholung behält die Ereigniskennung", () => {
  async function ausfuellen(titel: string): Promise<void> {
    const form = finde("kalender-eintragen");
    const felder = [...(form?.querySelectorAll("input") ?? [])];
    await tippe(felder[0], titel);
    await tippe(felder[1], "2026-10-26T09:00");
    await tippe(felder[2], "2026-10-26T09:30");
  }

  const ereignisse = (): unknown[] =>
    rufe
      .filter((r) => r.methode === "POST" && r.pfad.endsWith("/anbindungen/a1/termine"))
      .map((r) => (r.rumpf?.termin as { ereignisId?: unknown } | undefined)?.ereignisId);

  it("nach ok:false sendet die Wiederholung dieselbe Kennung; erst „Neuer Termin“ vergibt eine neue", async () => {
    anbindungen = [ANBINDUNG];
    eintragAntworten = [{ status: 202, body: AUSSTEHEND }];
    await oeffne();
    await ausfuellen("Fiktiv: Audit vorbereiten");
    await klicke(finde("kalender-eintragen-senden"));
    expect(document.body.textContent).not.toContain(i18n.t("klarakalender.eintragen.ok"));
    expect(finde("kalender-eintragen-senden")?.textContent).toContain(
      i18n.t("klarakalender.eintragen.wiederholen"),
    );

    await klicke(finde("kalender-eintragen-senden"));
    expect(document.body.textContent).toContain(i18n.t("klarakalender.eintragen.ok"));
    const [erste, zweite] = ereignisse();
    expect(typeof erste).toBe("string");
    expect(zweite).toBe(erste);

    await klicke(finde("kalender-neuer-termin"));
    await ausfuellen("Fiktiv: Zweiter Termin");
    await klicke(finde("kalender-eintragen-senden"));
    const alle = ereignisse();
    expect(alle).toHaveLength(3);
    expect(alle[2]).not.toBe(erste);
  });
});

describe("U7 · S09 — derselbe Auftrag aus dem eigenen Kalender, ohne doppelte Erfassung", () => {
  it("zeigt Auftrag und Lauf, sendet nur die Kennung und zeigt die gemeinsame Kennung", async () => {
    anbindungen = [ANBINDUNG];
    await oeffne();
    const auswahl = finde("kalender-eigener-eintrag") as HTMLSelectElement | null;
    // Geschützte Einträge geben keinen Text her und stehen nicht zur Wahl.
    expect([...(auswahl?.options ?? [])].map((o) => o.value)).toEqual(["eintrag-1"]);
    const auftrag = finde("kalender-eigener-auftrag")?.textContent ?? "";
    expect(auftrag).toContain("Fiktiv: Zertifikat prüfen");
    expect(auftrag).toContain(VORKOMMEN);

    await klicke(finde("kalender-eigener-senden"));
    const termine = rufe.filter(
      (r) => r.methode === "POST" && r.pfad.endsWith("/anbindungen/a1/termine"),
    );
    // Hinaus geht NUR die Kennung des eigenen Eintrags — kein neu erfasster Termin.
    expect(termine.map((r) => r.rumpf)).toEqual([{ eigenerEintragId: "eintrag-1" }]);
    const ok = finde("kalender-eigener-ok")?.textContent ?? "";
    expect(ok).toContain("erinnerung-1");
    expect(ok).toContain(VORKOMMEN);
  });
});

describe("U4 · DE/EN", () => {
  it("dieselbe Seite auf Englisch", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    await oeffne();
    expect(document.body.textContent).toContain("My existing calendar");
    expect(finde("kalender-zauberhut-start")?.textContent).toContain("Set up with the magic hat");
  });
});
