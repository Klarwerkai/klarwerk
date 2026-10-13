// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04) — PRÜFPROTOKOLL, NEUE BINDUNG, AUSFALL UND
// ALLE ANTWORTWEGE.
// ================================================================================================
//
// Gemessen am ECHTEN `ReferenzPruefdienst` (REF-01-Bindung, technische Auflösung, Auswertung) und
// an der ECHTEN App über `app.inject` (In-Memory-Aufbau, fiktiver Bestand, reine Testkennwörter
// ohne Verbindung nach außen). Ersetzt ist nur die Prüferwahl — ein Doppelgänger statt eines
// Modells. Das ist keine Modellbeobachtung (dafür: `tests-smoke/referenzki-antwortstatus-modell
// .spec.ts`).
//
//   P1 (K6) · das versionierte Prüfprotokoll bindet Antwort-/Aussagekennung, Quellenfassung,
//             Belegverweis, Ergebnis, Begründung (als Fingerabdruck), beide Modelle, Richtlinie und
//             Zeitpunkt — ohne Antwort-, Auszugs- oder Begründungstext
//   P2 (K7) · neue Antwort, Quellenänderung, Modellwechsel und Rechteentzug erben keine
//             Bestätigung; historische Protokolleinträge bleiben auf ihren Stand bezogen
//   P3 (K8) · Zeitlimit: benannter Grund, kein Urteil; „erneut" nimmt die DANN erlaubte
//             Konfiguration und schreibt einen neuen gebundenen Lauf
//   W1 (K1) · `POST /api/reasoner` (task `ask`) ruft denselben Prüfdienst
//   W2 (K1) · die beiden Antworten einer Zweitmeinung werden je für sich geprüft
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { REFERENZ_PROTOKOLL_FASSUNG, REFERENZ_PRUEF_RICHTLINIE } from "../../services/ask";
import type { ReferenzPruefer } from "../../services/reasoner";
import { PRUEF_FAELLE, type PruefFall, belegDes } from "../referenzki-pruefdienst/faelle";
import {
  ANTWORT_ROLLE,
  PRUEF_ROLLE,
  PRUEF_ROLLE_NEU,
  alle,
  bestand,
  dienstMit,
  doppelgaenger,
  nieFertig,
} from "./hilfen";

function fall(kennung: PruefFall["kennung"]): PruefFall {
  const f = PRUEF_FAELLE.find((x) => x.kennung === kennung);
  if (!f) {
    throw new Error(kennung);
  }
  return f;
}

const BEGRUENDUNG = "Die Fundstelle nennt genau diesen Höchstdruck.";

describe("REF-04 · K6 — das versionierte Prüfprotokoll", () => {
  it("P1 · bindet Kennungen, Fassungen, Verweise, Ergebnis, Modelle, Richtlinie und Zeitpunkt — ohne Text", async () => {
    const p = doppelgaenger(alle("belegt", BEGRUENDUNG));
    const { dienst, protokoll } = dienstMit({ jetzt: p });
    const f = fall("korrekter_beleg");
    const b = bestand(f.quellen);
    const beleg = belegDes(f);
    const e = await dienst.pruefe({
      beleg,
      antwortRolle: ANTWORT_ROLLE,
      akteur: "nutzer-fiktiv-1",
      leser: b.leser,
      darfSehen: () => true,
      antwortId: "antwort-fiktiv-1",
      antwortweg: "frage",
    });
    await Promise.resolve();
    expect(e.status).toBe("geprueft");
    expect(protokoll).toHaveLength(1);
    const eintrag = protokoll[0];
    expect(eintrag).toMatchObject({
      protokoll: REFERENZ_PROTOKOLL_FASSUNG,
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      pruefId: e.pruefId,
      status: "geprueft",
      antwortId: "antwort-fiktiv-1",
      antwortweg: "frage",
      antwort: ANTWORT_ROLLE,
      pruefer: PRUEF_ROLLE,
      antwortFingerabdruck: beleg.antwortFingerabdruck,
      belegFingerabdruck: beleg.belegFingerabdruck,
      ergebnisFingerabdruck: e.bindung.ergebnisFingerabdruck,
      quellen: [{ koId: "ko-fiktiv-pumpe", koVersion: 2 }],
      aussagenGekuerzt: false,
    });
    expect(Number.isNaN(Date.parse(eintrag?.zeitpunkt ?? ""))).toBe(false);
    // Je Aussage: Kennung, Ergebnis, Belegverweis (Objekt, Fassung, Bereich) und die Begründung
    // als Fingerabdruck — die Begründung selbst steht nur an der Antwort.
    const aussage = eintrag?.aussagen[0];
    expect(aussage?.aussageId).toBe(beleg.aussagen[0]?.aussageId);
    expect(aussage?.zustand).toBe("belegt");
    expect(aussage?.grund).toBeNull();
    expect(aussage?.fundstellen[0]).toMatchObject({ koId: "ko-fiktiv-pumpe", koVersion: 2 });
    expect(typeof aussage?.fundstellen[0]?.start).toBe("number");
    expect(aussage?.begruendungFingerabdruck).toMatch(/^sha256:[0-9a-f]{64}$/);
    const roh = JSON.stringify(protokoll);
    expect(roh).not.toContain("Pumpe");
    expect(roh).not.toContain(BEGRUENDUNG);
  });
});

describe("REF-04 · K7 — keine geerbte Bestätigung", () => {
  it("P2 · neue Antwort, Quellenänderung, Modellwechsel und Rechteentzug laufen neu oder bleiben ohne Urteil", async () => {
    const p = doppelgaenger(alle("belegt"));
    const wahl = { jetzt: p as { pruefer: ReferenzPruefer } };
    const { dienst, protokoll } = dienstMit(wahl);
    const f = fall("korrekter_beleg");
    const b = bestand(f.quellen);
    const eingabe = (beleg = belegDes(f)) => ({
      beleg,
      antwortRolle: ANTWORT_ROLLE,
      akteur: "nutzer-fiktiv-1",
      leser: b.leser,
      darfSehen: () => true,
    });

    const erst = await dienst.pruefe(eingabe());
    expect(erst.ausCache).toBe(false);
    expect(p.zaehler.aufrufe).toBe(1);
    // Kontrolle: dieselbe Antwort, derselbe Stand, dasselbe Modell — der Beleg gilt.
    const gleich = await dienst.pruefe(eingabe());
    expect(gleich.ausCache).toBe(true);
    expect(p.zaehler.aufrufe).toBe(1);

    // Neue Antwort (andere Antwortfassung mit derselben Aussage und Quelle): eigener Lauf, eigene
    // Bindung — der Antwortfingerabdruck geht in Paket und Cacheschlüssel ein.
    const neu = await dienst.pruefe(
      eingabe({ ...belegDes(f), antwortFingerabdruck: `sha256:${"a".repeat(64)}` }),
    );
    expect(neu.ausCache).toBe(false);
    expect(neu.bindung.antwortFingerabdruck).not.toBe(erst.bindung.antwortFingerabdruck);
    expect(p.zaehler.aufrufe).toBe(2);

    // Quellenänderung: dieselbe Antwort, aber die Quelle hat eine neue Fassung — neuer Lauf, und
    // der Hinweis auf die neuere Fassung steht getrennt da.
    b.revidiere("ko-fiktiv-pumpe", "Die Pumpe P7 fördert mit höchstens 4 bar.");
    const geaendert = await dienst.pruefe(eingabe());
    expect(geaendert.ausCache).toBe(false);
    expect(geaendert.hinweise.map((h) => h.art)).toContain("neuere_fassung");
    expect(p.zaehler.aufrufe).toBe(3);

    // Modellwechsel: ein anderes Prüfmodell übernimmt keinen Beleg des alten.
    const q = doppelgaenger(alle("belegt"), PRUEF_ROLLE_NEU);
    wahl.jetzt = q;
    const gewechselt = await dienst.pruefe(eingabe());
    expect(gewechselt.ausCache).toBe(false);
    expect(q.zaehler.aufrufe).toBe(1);

    // Rechteentzug: die Fundstelle ist nicht mehr zugänglich — kein Beleg, kein Cache, kein Aufruf.
    const vorher = q.zaehler.aufrufe;
    const entzogen = await dienst.pruefe({ ...eingabe(), darfSehen: () => false });
    expect(entzogen.status).toBe("nicht_pruefbar");
    expect(entzogen.ausCache).toBe(false);
    expect(entzogen.aussagen.every((a) => a.zustand === "nicht_pruefbar")).toBe(true);
    expect(entzogen.aussagen.flatMap((a) => a.fundstellen)).toEqual([]);
    expect(q.zaehler.aufrufe).toBe(vorher);

    // Historische Einträge bleiben auf ihren Stand bezogen: der erste nennt Fassung 2 und das
    // alte Prüfmodell, auch nachdem Quelle und Modell gewechselt haben.
    await Promise.resolve();
    expect(protokoll[0]?.quellen).toEqual([{ koId: "ko-fiktiv-pumpe", koVersion: 2 }]);
    expect(protokoll[0]?.pruefer?.modell).toBe("pruef-modell-b");
    expect(protokoll.at(-1)?.status).toBe("nicht_pruefbar");
  });
});

describe("REF-04 · K8 — Ausfall mit Grund, erneute Prüfung mit aktueller Konfiguration", () => {
  it("P3 · Zeitlimit ergibt keinen Beleg; „erneut“ nimmt den DANN erlaubten Prüfer und läuft neu gebunden", async () => {
    const haengt = doppelgaenger(nieFertig);
    const wahl = { jetzt: haengt as { pruefer: ReferenzPruefer } };
    const { dienst, protokoll } = dienstMit(wahl);
    const f = fall("korrekter_beleg");
    const b = bestand(f.quellen);
    const erst = await dienst.pruefe({
      beleg: belegDes(f),
      antwortRolle: ANTWORT_ROLLE,
      akteur: "nutzer-fiktiv-1",
      leser: b.leser,
      darfSehen: () => true,
    });
    expect(erst.status).toBe("nicht_pruefbar");
    expect(erst.grund).toBe("zeitlimit");
    expect(erst.aussagen.every((a) => a.zustand === "nicht_pruefbar")).toBe(true);

    // Die Verwaltung stellt inzwischen ein anderes, funktionierendes Prüfmodell ein.
    const neu = doppelgaenger(alle("belegt"), PRUEF_ROLLE_NEU);
    wahl.jetzt = neu;
    const ausgang = await dienst.erneut(erst.pruefId, "nutzer-fiktiv-1", {
      leser: b.leser,
      darfSehen: () => true,
    });
    expect("ergebnis" in ausgang).toBe(true);
    const zweit = "ergebnis" in ausgang ? ausgang.ergebnis : null;
    expect(zweit?.status).toBe("geprueft");
    expect(zweit?.versuch).toEqual({ nummer: 2, hoechstens: 2 });
    expect(zweit?.rollen.pruefer?.modell).toBe("pruef-modell-c");
    expect(zweit?.bindung.ergebnisFingerabdruck).not.toBe(erst.bindung.ergebnisFingerabdruck);
    expect(neu.zaehler.aufrufe).toBe(1);
    await Promise.resolve();
    const laeufe = protokoll.map((e) => [e.versuch, e.status, e.grund ?? null, e.pruefer?.modell]);
    expect(laeufe).toEqual([
      [1, "nicht_pruefbar", "zeitlimit", "pruef-modell-b"],
      [2, "geprueft", null, "pruef-modell-c"],
    ]);
  });
});

// ------------------------------------------------------------------------------------------------
// Die Antwortwege über die echte App.
// ------------------------------------------------------------------------------------------------

const VENTIL = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.";
const FRAGE = "Welche Höchsttemperatur gilt am Ventil F3?";

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin Fiktiv", email: "ref04@fiktiv.example", password: "testwert-ref04-1" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ref04@fiktiv.example", password: "testwert-ref04-1" },
  });
  const admin = { authorization: `Bearer ${login.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      type: "best_practice",
      category: "Ref04",
      neededValidations: 1,
      confidentiality: "intern",
      title: "Ventil F3 Höchsttemperatur",
      statement: VENTIL,
    },
  });
  expect(ko.statusCode, ko.body).toBe(201);
  await app.inject({
    method: "PUT",
    url: `/api/kos/${ko.json().id}`,
    headers: admin,
    payload: { action: "rate", verdict: "up" },
  });
  const p = doppelgaenger(alle("belegt", "Die Fundstelle nennt genau diesen Grenzwert."));
  vi.spyOn(services.reasoner, "referenzPruefer").mockImplementation(() => ({
    pruefer: p.pruefer,
  }));
  vi.spyOn(services.reasoner, "externeVerarbeitungErlaubt").mockReturnValue(true);
  return { services, app, admin, koId: ko.json().id as string, zaehler: p.zaehler };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("REF-04 · K1 — jeder wissensbezogene Antwortweg ruft denselben Prüfdienst", () => {
  it("W1 · POST /api/reasoner (task ask) trägt die Referenzprüfung GENAU dieser Antwort", async () => {
    const { app, services, admin, koId, zaehler } = await aufbau();
    const antwort = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: admin,
      payload: { task: "ask", text: FRAGE },
    });
    expect(antwort.statusCode, antwort.body.slice(0, 300)).toBe(200);
    const body = antwort.json();
    expect(body.result.answered).toBe(true);
    const ref = body.referenzpruefung;
    expect(ref.richtlinie).toBe(REFERENZ_PRUEF_RICHTLINIE);
    expect(ref.status).toBe("geprueft");
    expect(ref.bindung.antwortFingerabdruck).toBe(body.aussagen.antwortFingerabdruck);
    const quellen = (ref.aussagen as { fundstellen: { koId: string }[] }[]).flatMap((a) =>
      a.fundstellen.map((f) => f.koId),
    );
    expect(quellen).toContain(koId);
    // Der Fragende sieht kein Prüfmodell.
    expect(antwort.body).not.toContain("pruef-modell-b");
    expect(zaehler.aufrufe).toBe(1);
    await new Promise((r) => setTimeout(r, 0));
    const eintraege = await services.audit.list({ action: "ask.referenzpruefung" });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.payload).toMatchObject({
      protokoll: REFERENZ_PROTOKOLL_FASSUNG,
      antwortweg: "reasoner",
      prueferModell: "pruef-modell-b",
      status: "geprueft",
    });
    expect(JSON.stringify(eintraege[0])).not.toContain("80 °C");
  });

  it("W2 · die beiden Antworten einer Zweitmeinung werden je mit eigener Bindung geprüft", async () => {
    const { app, services, admin, koId } = await aufbau();
    const zweiteText = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C laut Anlage. [1]";
    vi.spyOn(services.reasoner, "answerMitZweitmeinung").mockResolvedValue({
      erste: {
        answered: true,
        answer: `${VENTIL} [1]`,
        knowledgeClass: "regel",
        trust: 50,
        sources: [koId],
        citedSources: [koId],
        steps: [],
        demo: false,
      },
      zweitmeinung: {
        status: "verglichen",
        ersteStufe: "local",
        zweiteStufe: "cloud",
        erste: {
          answered: true,
          answer: `${VENTIL} [1]`,
          sources: [koId],
          citedSources: [koId],
          demo: false,
        },
        zweite: {
          answered: true,
          answer: zweiteText,
          sources: [koId],
          citedSources: [koId],
          demo: false,
        },
        abweichend: false,
        abweichungen: [],
      },
    } as never);
    const antwort = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: FRAGE, zweitmeinung: true },
    });
    expect(antwort.statusCode, antwort.body.slice(0, 300)).toBe(200);
    const body = antwort.json();
    expect(body.zweitmeinung.status).toBe("verglichen");
    const z = body.referenzpruefungZweitmeinung;
    expect(z.erste.status).toBe("geprueft");
    expect(z.zweite.status).toBe("geprueft");
    // Jede Seite ist an IHREN Text gebunden — nicht an den der Hauptantwort.
    expect(z.erste.bindung.antwortFingerabdruck).toBe(
      body.zweitmeinungAussagen.erste.antwortFingerabdruck,
    );
    expect(z.zweite.bindung.antwortFingerabdruck).toBe(
      body.zweitmeinungAussagen.zweite.antwortFingerabdruck,
    );
    expect(z.zweite.bindung.antwortFingerabdruck).not.toBe(z.erste.bindung.antwortFingerabdruck);
    await new Promise((r) => setTimeout(r, 0));
    const wege = (await services.audit.list({ action: "ask.referenzpruefung" }))
      .map((e) => e.payload.antwortweg)
      .sort();
    expect(wege).toEqual(["frage", "zweitmeinung_erste", "zweitmeinung_zweite"]);
  });
});
