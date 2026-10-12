// @vitest-environment jsdom
// ================================================================================================
// KLARA 14 (produkt:20261008:klara-qualitaet) — WIDERSPRÜCHE, LÜCKEN UND VERBESSERUNGEN ERKLÄREN,
// GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Die echte App im selben Prozess (`appAufbauen`, Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts`): echte Wissensobjekte mit und ohne Quelle, echte Konflikt- und Überschneidungseinträge über die
// Dienste (`services.conflicts.createAuto`, `services.overlaps.createAuto` — derselbe Weg, den die
// Prüfung beim Einreichen nimmt), echte Rechte- und Redaktionsstufen der Lesewege.
//
// ATTRAPPEN, ausdrücklich: keine. Ein Modell wird nicht gefragt — die Erklärung kommt aus den
// gespeicherten Befunden. Fälle Q5 benutzt gelesene Server-Objekte mit gezielt gesetzten Feldern
// (Frische, entfernte Quelle, Redaktion), weil diese Zustände sonst nur über Zeit bzw. eine zweite
// Rolle entstehen; was der Server dabei filtert, prüfen die Wächter der Lesewege selbst.
//
//   Q1 · K1/K4     Konflikt aus dem echten Leseweg: Quelle beider Seiten, Erklärung, Beweislage
//                  („keine Grundlage“, „nur eine Seite belegt“, „widersprüchliche Quellen“),
//                  Unsicherheit der Erkennung; fehlende Quelle als eigene fehlende Angabe.
//   Q2 · K1/K2     Duplikat: Beziehung, Zitate, Empfehlung als Arbeitsweg — kein Auftrag, keine
//                  Wirkung.
//   Q3 · K2        Erklären liest nur: am Draht ausschliesslich GET, am Server nichts verändert.
//   Q4 · K4        Sprache und Assistenzprofil ändern den Wortlaut, nie das Urteil.
//   Q5 · K1/K4     Quellenalter (Frische, entfernte Quelle) und Rechte (zurückgehalten, verdeckt).
//   Q6 · K1–K3     In der echten Klara auf dem Beitrag: Befund mit Quelle und Erklärung;
//                  „Als Auftrag vorbereiten“ ändert nichts; erst „Senden“ eskaliert über den Ausführungsweg von
//                  Klara 05 — am Server nachgelesen. Bedienhilfe direkt in Klara.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { Conflict, EigenerBefund, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { setzeAssistenzProfil } from "../../apps/web/src/components/klara-vorschau/profil";
import {
  type Befund,
  type QualitaetsDaten,
  type Qualitaetslage,
  befundeAus,
  ladeQualitaet,
} from "../../apps/web/src/components/klara-vorschau/qualitaet";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { type AppServices, buildServices } from "../../services/app/src/build-app";
import { alle, bis, klick, medienStub, q, ruhe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// Vorrichtung.
// ------------------------------------------------------------------------------------------------
let draht: Draht;
let aufbau: Aufbau | null = null;
let dienste: AppServices | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let drahtFetch: typeof globalThis.fetch;
/** Jede schreibende Anfrage des Browsers an die eigene App: „METHODE /api/…“. */
let schreibend: string[] = [];

beforeAll(() => {
  draht = drahtAufbauen();
  drahtFetch = globalThis.fetch;
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterAll(() => {
  draht.abbauen();
});

function netzMitProtokoll(): void {
  const neu = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode !== "GET" && url.startsWith("/api/")) {
      schreibend.push(`${methode} ${url}`);
    }
    return drahtFetch(eingabe as RequestInfo, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = neu;
  window.fetch = neu;
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  vergiss();
  setzeKlaraVorschauAktiv(true);
  setzeAssistenzProfil(null);
  medienStub();
  schreibend = [];
  netzMitProtokoll();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = drahtFetch;
  window.fetch = drahtFetch;
  vergiss();
  setzeKlaraVorschauAktiv(false);
  setzeAssistenzProfil(null);
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  dienste = null;
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
});

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

/** Die echte App — und ihre Dienste, damit Befunde über den Weg der Prüfung entstehen. */
async function app(): Promise<{ a: Aufbau; s: AppServices }> {
  const a = await appAufbauen(false, () => {
    dienste = buildServices();
    return dienste;
  });
  aufbau = a;
  draht.setzeApp(a.app);
  if (!dienste) {
    throw new Error("Dienste fehlen");
  }
  return { a, s: dienste };
}

function alsKonto(k: Konto): void {
  draht.setzeCookie(`kw_session=${k.token}`);
}

async function konfliktStatus(a: Aufbau, id: string): Promise<string> {
  const r = await a.app.inject({
    method: "GET",
    url: `/api/conflicts/${id}`,
    headers: a.admin.kopf,
  });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { status: string }).status;
}

async function koVersion(a: Aufbau, id: string): Promise<number> {
  const r = await a.app.inject({ method: "GET", url: `/api/kos/${id}`, headers: a.admin.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { version: number }).version;
}

const de = () => i18n.getFixedT("de");

/**
 * Der Befund mit genau dieser Kennung (`konflikt:<id>`, `duplikat:<id>`, …) oder — bei Befunden,
 * die es je Objekt nur einmal gibt — der Art. Über die Kennung, weil die Freigabe gleichlautender
 * Beiträge eigene Befunde erzeugen darf; gemessen wird genau der hier angelegte.
 */
function befund(lage: Qualitaetslage, wer: string): Befund {
  const b = lage.befunde.find((x) => x.schluessel === wer || x.art === wer);
  if (!b) {
    const da = lage.befunde.map((x) => x.schluessel);
    throw new Error(`kein Befund „${wer}“ in ${JSON.stringify(da)}`);
  }
  return b;
}

/** Das URTEIL eines Befunds — ohne Wortlaut: Art, Grundlage, Quellen, Wege. */
function urteil(lage: Qualitaetslage) {
  return lage.befunde.map((b) => ({
    art: b.art,
    grundlage: b.grundlage,
    quellen: b.quellen.map((x) => [x.koId, x.eigenes, x.belegt]),
    wege: b.vorschlaege.map((v) => (v.art === "arbeitsweg" ? `weg:${v.pfad}` : v.art)),
  }));
}

const ERKANNT = {
  trigger: "validation" as const,
  method: "model" as const,
  confidence: 0.82,
  rationale: "Beide Beiträge nennen für denselben Flansch ein anderes Anzugsmoment.",
  quotes: { a: "Flansch F7 mit 40 Nm anziehen.", b: "Flansch F7 mit 55 Nm anziehen." },
};

// ================================================================================================
describe("Q1 · K1/K4 — ein Konflikt mit Quelle, Erklärung und kenntlich gemachter Grundlage", () => {
  it("nur eine Seite belegt: Quelle beider Seiten, Beweislage, Unsicherheit, Eskalationssatz", async () => {
    const { a, s } = await app();
    const belegt = await eintragMitOriginal(a.app, a.admin, {
      titel: "Flansch F7 mit 40 Nm",
      kernaussage: "Flansch F7 mit 40 Nm anziehen.",
    });
    const unbelegt = await eintragMitOriginal(a.app, a.admin, {
      titel: "Flansch F7 mit 55 Nm",
      kernaussage: "Flansch F7 mit 55 Nm anziehen.",
      ohneQuelle: true,
    });
    const k = await s.conflicts.createAuto(
      {
        koA: belegt.koId,
        koB: unbelegt.koId,
        type: "truth",
        description: "Anzugsmoment Flansch F7 widersprüchlich",
      },
      ERKANNT,
    );
    alsKonto(a.admin);

    const lage = befundeAus(await ladeQualitaet(belegt.koId, true), de(), "de");
    const b = befund(lage, `konflikt:${k.id}`);
    expect(b.titel).toBe("Widerspruch zu „Flansch F7 mit 55 Nm“");
    // Erklärung: Art, Beschreibung, Begründung der Prüfung, Beweislage — aus den Befunddaten.
    expect(b.erklaerung).toContain("Konfliktart Wahrheit: Anzugsmoment Flansch F7 widersprüchlich");
    expect(b.erklaerung.join(" ")).toContain("anderes Anzugsmoment");
    expect(b.erklaerung.join(" ")).toContain(
      "Nur eine der beiden Aussagen ist mit einer Quelle belegt",
    );
    // Quelle: dieser Beitrag (belegt, eigenes Zitat) und die Gegenseite (unbelegt, ihr Zitat).
    expect(b.quellen).toEqual([
      {
        koId: belegt.koId,
        titel: "Flansch F7 mit 40 Nm",
        pfad: `/wissen/${belegt.koId}`,
        eigenes: true,
        belegt: true,
        zitat: "Flansch F7 mit 40 Nm anziehen.",
      },
      {
        koId: unbelegt.koId,
        titel: "Flansch F7 mit 55 Nm",
        pfad: `/wissen/${unbelegt.koId}`,
        eigenes: false,
        belegt: false,
        zitat: "Flansch F7 mit 55 Nm anziehen.",
      },
    ]);
    expect(b.grundlage).toBe("einseitig");
    expect(b.unsicherheit).toContain("Sicherheit 82 %");
    expect(b.unsicherheit).toContain("kein bewiesener Befund");
    // Vorschlag: die vorhandene Fachregel „eskalieren“ — als Satz für Klara 05 und als Arbeitsweg.
    expect(b.vorschlaege).toEqual([
      expect.objectContaining({
        art: "auftrag",
        satz: "Eskaliere die Aufgabe „Anzugsmoment Flansch F7 widersprüchlich“",
      }),
      expect.objectContaining({ art: "arbeitsweg", pfad: `/konflikte?fall=${k.id}` }),
    ]);
    // Am belegten Beitrag fehlt keine Quelle — keine erfundene fehlende Angabe dazu.
    expect(lage.befunde.filter((x) => x.schluessel.startsWith("fehlend:quelle:"))).toEqual([]);

    // Von der Gegenseite aus: dieselbe Beweislage, dazu die fehlende Quelle als eigener Befund.
    const dort = befundeAus(await ladeQualitaet(unbelegt.koId, true), de(), "de");
    expect(befund(dort, `konflikt:${k.id}`).grundlage).toBe("einseitig");
    const fehlt = dort.befunde.find((x) => x.schluessel === `fehlend:quelle:${unbelegt.koId}`);
    if (!fehlt) {
      const titel = dort.befunde.map((x) => x.titel);
      throw new Error(`keine fehlende Quelle in ${JSON.stringify(titel)}`);
    }
    expect(fehlt.titel).toBe("Fehlende Angabe: keine Quelle hinterlegt");
    expect(fehlt.grundlage).toBe("keine");
    expect(fehlt.unsicherheit).toContain("Klara stellt keine Pflicht auf");
    expect(fehlt.vorschlaege).toEqual([
      expect.objectContaining({ art: "arbeitsweg", pfad: `/wissen/${unbelegt.koId}` }),
    ]);
  });

  it("keine Seite belegt → „keine Grundlage“; beide belegt → „widersprüchliche Quellen“", async () => {
    const { a, s } = await app();
    const x = await eintragMitOriginal(a.app, a.admin, {
      titel: "Ölwechsel 500 h",
      ohneQuelle: true,
    });
    const y = await eintragMitOriginal(a.app, a.admin, {
      titel: "Ölwechsel 750 h",
      ohneQuelle: true,
    });
    const kx = await s.conflicts.create({
      koA: x.koId,
      koB: y.koId,
      type: "temporal",
      description: "Intervall",
    });
    const p = await eintragMitOriginal(a.app, a.admin, { titel: "Prüfdruck 6 bar" });
    const r = await eintragMitOriginal(a.app, a.admin, {
      titel: "Prüfdruck 8 bar",
      quelle: { label: "Herstellerblatt P-8", excerpt: "Prüfdruck 8 bar." },
    });
    const kp = await s.conflicts.createAuto(
      { koA: p.koId, koB: r.koId, type: "truth", description: "Prüfdruck widersprüchlich" },
      { trigger: "validation", method: "deterministic" },
    );
    alsKonto(a.admin);

    const lageX = befundeAus(await ladeQualitaet(x.koId, true), de(), "de");
    const ohne = befund(lageX, `konflikt:${kx.id}`);
    expect(ohne.grundlage).toBe("keine");
    expect(ohne.erklaerung.join(" ")).toContain(
      "Keine der beiden Aussagen ist mit einer Quelle belegt",
    );
    // Manuell gemeldet: so steht die Unsicherheit da — kein erfundener Prozentwert.
    expect(ohne.unsicherheit).toBe("Von einer Person gemeldet – noch nicht fachlich entschieden.");

    const lageP = befundeAus(await ladeQualitaet(p.koId, true), de(), "de");
    const beide = befund(lageP, `konflikt:${kp.id}`);
    expect(beide.grundlage).toBe("widerspruechlich");
    expect(beide.quellen.map((x2) => x2.belegt)).toEqual([true, true]);
    expect(beide.unsicherheit).toBe("Durch Textabgleich erkannt – kein bewiesener Befund.");
  });
});

// ================================================================================================
describe("Q2 · K1/K2 — ein Duplikat: Beziehung, Zitate und Empfehlung als Arbeitsweg", () => {
  it("erklärt die Überschneidung und schlägt den Vergleich vor — ohne Auftrag, ohne Wirkung", async () => {
    const { a, s } = await app();
    const eins = await eintragMitOriginal(a.app, a.admin, { titel: "Filterwechsel Linie 2" });
    const zwei = await eintragMitOriginal(a.app, a.admin, { titel: "Filter tauschen Linie 2" });
    const o = await s.overlaps.createAuto(
      {
        koA: eins.koId,
        koB: zwei.koId,
        relation: "teilweise",
        aspects: [
          {
            beschreibung: "Beide verlangen den Filterwechsel alle 200 Stunden.",
            zitatA: "Filter alle 200 h wechseln.",
            zitatB: "Filter nach 200 Betriebsstunden tauschen.",
          },
        ],
        eigenanteilA: "Nennt das Drehmoment der Deckelschrauben.",
        eigenanteilB: "",
        recommendation: "verwandt_verlinken",
      },
      { trigger: "background", method: "deterministic", lexicalScore: 0.61 },
    );
    alsKonto(a.admin);

    const lage = befundeAus(await ladeQualitaet(zwei.koId, true), de(), "de");
    const b = befund(lage, `duplikat:${o.id}`);
    expect(b.titel).toBe("Überschneidung mit „Filterwechsel Linie 2“");
    expect(b.erklaerung).toEqual([
      "Art der Überschneidung: Teilweise Überschneidung",
      "Gemeinsam: Beide verlangen den Filterwechsel alle 200 Stunden.",
      "Nur im anderen Beitrag: Nennt das Drehmoment der Deckelschrauben.",
    ]);
    // Die Zitate gehören zur jeweils richtigen Seite.
    expect(b.quellen.map((x) => [x.eigenes, x.zitat])).toEqual([
      [true, "Filter nach 200 Betriebsstunden tauschen."],
      [false, "Filter alle 200 h wechseln."],
    ]);
    expect(b.grundlage).toBe("belegt");
    expect(b.unsicherheit).toBe(
      "61 % Textdeckung — Wort-/Text-Ähnlichkeit — kein bewiesenes Duplikat",
    );
    // Kuratorisch: kein Auftragssatz, nur der vorhandene Vergleich und der Hinweis.
    expect(b.vorschlaege.map((v) => v.art)).toEqual(["arbeitsweg", "hinweis"]);
    expect(b.vorschlaege[0]).toMatchObject({
      text: "Empfehlung: Als verwandt verlinken",
      pfad: `/duplikate/${o.id}/vergleich`,
    });
  });
});

// ================================================================================================
describe("Q3 · K2 — Erklären liest nur", () => {
  it("am Draht ausschliesslich GET; Konflikt, Beiträge und Klara-Aufträge bleiben unverändert", async () => {
    const { a, s } = await app();
    const eins = await eintragMitOriginal(a.app, a.admin, { titel: "Kühlmittel 30 %" });
    const zwei = await eintragMitOriginal(a.app, a.admin, { titel: "Kühlmittel 40 %" });
    const k = await s.conflicts.createAuto(
      { koA: eins.koId, koB: zwei.koId, type: "truth", description: "Kühlmittelanteil" },
      ERKANNT,
    );
    const vorher = { a: await koVersion(a, eins.koId), b: await koVersion(a, zwei.koId) };
    alsKonto(a.admin);
    draht.aufrufe.length = 0;

    befundeAus(await ladeQualitaet(eins.koId, true), de(), "de");

    expect(draht.aufrufe.length).toBeGreaterThan(0);
    expect(draht.aufrufe.filter((x) => x.methode !== "GET")).toEqual([]);
    expect(await konfliktStatus(a, k.id)).toBe("offen");
    expect(await koVersion(a, eins.koId)).toBe(vorher.a);
    expect(await koVersion(a, zwei.koId)).toBe(vorher.b);
  });
});

// ================================================================================================
describe("Q4 · K4 — Sprache und persönliches Profil ändern den Wortlaut, nie das Urteil", () => {
  it("dieselben Befunde, dieselbe Grundlage, dieselben Wege in DE und EN, mit und ohne Profil", async () => {
    const { a, s } = await app();
    const eins = await eintragMitOriginal(a.app, a.admin, { titel: "Schmierung täglich" });
    const zwei = await eintragMitOriginal(a.app, a.admin, {
      titel: "Schmierung wöchentlich",
      ohneQuelle: true,
    });
    const k = await s.conflicts.createAuto(
      { koA: eins.koId, koB: zwei.koId, type: "truth", description: "Schmierintervall" },
      ERKANNT,
    );
    alsKonto(a.admin);
    const daten = await ladeQualitaet(zwei.koId, true);

    const deutsch = befundeAus(daten, i18n.getFixedT("de"), "de");
    const englisch = befundeAus(daten, i18n.getFixedT("en"), "en");
    setzeAssistenzProfil({ name: "Hugo", avatarUrl: null });
    const mitProfil = befundeAus(daten, i18n.getFixedT("de"), "de");

    expect(urteil(englisch)).toEqual(urteil(deutsch));
    expect(urteil(mitProfil)).toEqual(urteil(deutsch));
    const kb = befund(englisch, `konflikt:${k.id}`);
    expect(kb.titel).toBe("Contradiction with “Schmierung täglich”");
    expect(kb.grundlage).toBe("einseitig");
    // Auch der Auftragssatz ist in EN derselbe Schritt am selben Ziel.
    expect(kb.vorschlaege[0]).toMatchObject({
      art: "auftrag",
      satz: "Escalate the task “Schmierintervall”",
    });
  });
});

// ================================================================================================
describe("Q5 · K1/K4 — Quellenalter und Rechte", () => {
  async function gelesen(): Promise<{ ko: KnowledgeObject; andere: KnowledgeObject }> {
    const { a } = await app();
    const eins = await eintragMitOriginal(a.app, a.admin, { titel: "Kalibrierung Waage W3" });
    const zwei = await eintragMitOriginal(a.app, a.admin, { titel: "Kalibrierung Waage W4" });
    alsKonto(a.admin);
    const d1 = await ladeQualitaet(eins.koId, true);
    const d2 = await ladeQualitaet(zwei.koId, true);
    return { ko: d1.ko, andere: d2.ko };
  }

  function daten(ko: KnowledgeObject, teil: Partial<QualitaetsDaten> = {}): QualitaetsDaten {
    return {
      ko,
      konflikte: [],
      ueberschneidungen: [],
      signale: [],
      gegenseiten: {},
      darfBearbeiten: false,
      ...teil,
    };
  }

  it("veraltete Frische und eine am Ursprung entfernte Quelle: Stufe, Daten, Weg, keine Bestätigung durch Klara", async () => {
    const { ko } = await gelesen();
    const quelle = ko.sources?.[0];
    if (!quelle) {
      throw new Error("der Aufbau trägt keine Quelle");
    }
    const entfernt = { ...quelle, sourceRemovedAt: "2026-02-01T10:00:00.000Z" };
    const alt: KnowledgeObject = {
      ...ko,
      frische: {
        stufe: "veraltet",
        halbwertszeitTage: 180,
        halbwertszeitHerkunft: "vorgabe",
        halbwertszeitBeobachtungen: 0,
        bezugAm: "2025-01-15T08:00:00.000Z",
        letztesSignal: null,
        haltbarBis: "2025-07-14T08:00:00.000Z",
        erinnerungAb: null,
        erinnern: true,
        verantwortlich: "Ada",
        verantwortlichArt: "owner",
        gesichert: true,
        aktuellerStand: true,
        schutz: "intern",
        betriebsmodell: "freigegebene_ki",
        inDokumente: true,
        naechsterSchritt: "erneut_bestaetigen",
        ungeprueft: {},
      },
      sources: [entfernt],
    };
    const bezug = new Date("2025-01-15T08:00:00.000Z").toLocaleDateString("de");
    const haltbar = new Date("2025-07-14T08:00:00.000Z").toLocaleDateString("de");
    const b = befund(befundeAus(daten(alt), de(), "de"), "quellenalter");
    expect(b.titel).toBe("Quellenalter: veraltet");
    expect(b.erklaerung).toContain(`Zuletzt fachlich bestätigt bzw. Bezug am ${bezug}.`);
    expect(b.erklaerung).toContain(`Fachlich bestätigt bis ${haltbar}.`);
    expect(b.erklaerung.join(" ")).toContain("wurde am Ursprung am");
    expect(b.unsicherheit).toContain("Vorgabe der Wissensart");
    expect(b.vorschlaege).toEqual([
      { art: "arbeitsweg", text: "Erneut bestätigen", pfad: `/wissen/${ko.id}` },
      expect.objectContaining({
        art: "hinweis",
        text: expect.stringContaining("Klara bestätigt nichts"),
      }),
      expect.objectContaining({ art: "hinweis", text: expect.stringContaining("ersetzen") }),
    ]);
  });

  it("zurückgehaltener Konflikt und verdeckte Gegenseite: Befund benannt, Inhalt nicht", async () => {
    const { ko, andere } = await gelesen();
    const zurueck: Conflict = {
      id: "konflikt-zurueck",
      koA: ko.id,
      koB: andere.id,
      type: "truth",
      description: "",
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      redacted: true,
    };
    const signal: EigenerBefund = {
      koId: ko.id,
      dublette: true,
      konflikt: true,
      deckung: { geprueft: null, bestand: null, lage: "ohne_protokoll" },
    };
    // Die Gegenseite ist für diese Person nicht lesbar (`null`): kein Titel, kein Weg.
    const lage = befundeAus(
      daten(ko, { konflikte: [zurueck], signale: [signal], gegenseiten: { [andere.id]: null } }),
      de(),
      "de",
    );
    const k = befund(lage, "konflikt");
    expect(k.grundlage).toBe("zurueckgehalten");
    expect(k.titel).toBe("Widerspruch zu „einen nicht lesbaren Beitrag“");
    expect(k.erklaerung.join(" ")).toContain("für dich zurückgehalten");
    expect(k.quellen.map((x) => x.koId)).toEqual([ko.id]);
    // Konflikt sichtbar (wenn auch zurückgehalten) → nur die Dublette ist verdeckt.
    const verdeckt = lage.befunde.filter((x) => x.art === "verdeckt");
    expect(verdeckt.map((x) => x.titel)).toEqual([
      "Offene Überschneidung mit einem für dich verdeckten Beitrag",
    ]);
    expect(verdeckt[0]?.grundlage).toBe("zurueckgehalten");
    expect(JSON.stringify(verdeckt)).not.toContain(andere.title);
    // Ein nicht antwortender Leseweg wird benannt, nicht als „nichts gefunden“ ausgegeben.
    const ohneKonflikte = befundeAus(daten(ko, { konflikte: null }), de(), "de");
    expect(ohneKonflikte.nichtGelesen).toEqual(["konflikte"]);
  });
});

// ================================================================================================
// Q6 — die echte Klara auf dem echten Beitrag.
// ================================================================================================
async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const inhalt = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(
      Routes,
      null,
      createElement(Route, { path: "/wissen/:id", element: createElement(KnowledgeDetail) }),
      createElement(Route, {
        path: "/konflikte",
        element: createElement("div", { "data-testid": "seite-konflikte" }),
      }),
    ),
  );
  await act(async () => {
    r.render(
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
                  MemoryRouter,
                  { initialEntries: [pfad] },
                  createElement(AppShell, null, inhalt),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(q(document, "klara-figur")), 200);
}

async function klaraOeffnen(pfad: string): Promise<void> {
  await montiere(pfad);
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => q(document, "klara-echt-hinweis")?.dataset.laden === "bereit", 200);
}

const text = (wurzel: ParentNode | null | undefined, id: string): string =>
  (wurzel ? q(wurzel, id)?.textContent : "") ?? "";

describe("Q6 · K1–K3 — in der echten Klara: erklären, vorbereiten, erst „Senden“ wirkt", () => {
  it("Befund mit Quelle und Erklärung; Vorbereiten ändert nichts; Senden eskaliert am Server", async () => {
    const { a, s } = await app();
    const hier = await eintragMitOriginal(a.app, a.admin, {
      titel: "Spannung Antriebsriemen 300 N",
      kernaussage: "Antriebsriemen mit 300 N spannen.",
    });
    const dort = await eintragMitOriginal(a.app, a.admin, {
      titel: "Spannung Antriebsriemen 450 N",
      kernaussage: "Antriebsriemen mit 450 N spannen.",
      ohneQuelle: true,
    });
    const k = await s.conflicts.createAuto(
      {
        koA: hier.koId,
        koB: dort.koId,
        type: "truth",
        description: "Riemenspannung widersprüchlich",
      },
      ERKANNT,
    );
    alsKonto(a.admin);
    await klaraOeffnen(`/wissen/${hier.koId}`);

    // Bedienhilfe zu dieser Fähigkeit — direkt in Klara.
    expect(text(document, "klara-bedienhilfe-qualitaet")).toContain("Befunde erklären");

    await bis(() => Boolean(q(document, "klara-qualitaet")), 200);
    const vorher = schreibend.length;
    await klick(q(document, "klara-qualitaet-pruefen"));
    await bis(() => q(document, "klara-qualitaet")?.dataset.stand === "fertig", 200);

    // K1: der Befund mit Quelle und nachvollziehbarer Erklärung.
    const kennung = `konflikt:${k.id}`;
    const karte = alle(document, "klara-befund").find((x) => x.dataset.schluessel === kennung);
    expect(karte, q(document, "klara-qualitaet")?.textContent ?? "").toBeTruthy();
    const kk = karte as HTMLElement;
    expect(text(kk, "klara-befund-titel")).toBe("Widerspruch zu „Spannung Antriebsriemen 450 N“");
    expect(text(kk, "klara-befund-erklaerung")).toContain("Riemenspannung widersprüchlich");
    const quellen = alle(kk, "klara-befund-quelle");
    expect(quellen.map((x) => [x.dataset.ko, x.dataset.belegt])).toEqual([
      [hier.koId, "ja"],
      [dort.koId, "nein"],
    ]);
    expect(quellen[1]?.querySelector("a")?.getAttribute("href")).toBe(`/wissen/${dort.koId}`);
    // K4: die Beweislage steht da.
    expect(kk.dataset.grundlage).toBe("einseitig");
    expect(text(kk, "klara-befund-grundlage")).toContain(
      "nur eine Seite ist mit einer Quelle belegt",
    );
    expect(text(kk, "klara-befund-unsicherheit")).toContain("kein bewiesener Befund");
    expect(q(kk, "klara-befund-arbeitsweg")?.getAttribute("href")).toBe(`/konflikte?fall=${k.id}`);
    expect(text(document, "klara-qualitaet-unveraendert")).toContain("nichts geändert");

    // K2: Vorbereiten legt nur den Satz ins Eingabefeld — keine Schreibanfrage, nichts verändert.
    await klick(q(kk, "klara-befund-vorbereiten"));
    const satz = "Eskaliere die Aufgabe „Riemenspannung widersprüchlich“";
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value).toBe(satz);
    expect(q(document, "klara-eingabe-auftrag")).not.toBeNull();
    expect(schreibend.slice(vorher)).toEqual([]);
    expect(await konfliktStatus(a, k.id)).toBe("offen");
    expect(q(document, "klara-ausfuehrung")).toBeNull();

    // K3: erst „Senden“ — derselbe Ausführungsweg wie ein getippter Auftrag (Klara 05).
    await klick(q(document, "klara-senden"));
    await bis(() => q(document, "klara-ausfuehrung")?.dataset.phase === "fertig", 400);
    const auftrag = q(document, "klara-ausfuehrung");
    expect(auftrag?.dataset.phase, auftrag?.textContent ?? "").toBe("fertig");
    expect(auftrag?.dataset.quelle).toBe("getippt");
    expect(await konfliktStatus(a, k.id)).toBe("eskaliert");
    // Der Browser schrieb nicht selbst an den Konflikt — die Wirkung kam über die Ausführung.
    expect(schreibend.filter((x) => x.includes("/api/conflicts"))).toEqual([]);

    // Neu gelesen: der nächste Schritt folgt der Fachregel — kein zweiter Eskalationssatz.
    await klick(q(document, "klara-qualitaet-pruefen"));
    await bis(() => q(document, "klara-qualitaet")?.dataset.stand === "fertig", 200);
    const danach = alle(document, "klara-befund").find((x) => x.dataset.schluessel === kennung);
    expect(danach, "der eskalierte Konflikt bleibt offen und erklärt").toBeTruthy();
    expect(danach ? q(danach, "klara-befund-vorbereiten") : null).toBeNull();
  });
});
