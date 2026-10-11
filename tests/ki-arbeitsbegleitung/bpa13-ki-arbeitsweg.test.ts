// ================================================================================================
// BPA-13 · Mit Codex, Claude, ChatGPT und anderen KIs im richtigen Kontext arbeiten
// (produkt:20261011:assistenz-ki-arbeitsbegleitung · Kriterien K1–K10 = BPA-13-AC01…AC10)
// ================================================================================================
//
// Nur synthetische Daten (Szenario BPA-S14: zwei Projekte, erlaubter Anbieter, gesperrte
// Dokumentpassage). Kein Modellaufruf, kein Netz. Die Anbieterauflösung kommt aus dem ECHTEN
// `resolveKlaraPolicy` — sie wird nicht nachgebaut.
//
// GRENZE: Diese Datei belegt Kernlogik. Ein realer Adapterlauf mit Anbieterverbrauch (AC10,
// zweiter Teil) ist hier ausdrücklich NICHT belegt; `klassifiziereBeleg` stellt nur sicher, dass
// nichts anderes als realer Lauf gewertet wird.
import { describe, expect, it } from "vitest";
import {
  type KiAdapter,
  type KiArbeitsbereich,
  type KiErgebnis,
  type KiFreigabelage,
  type KiQuelle,
  baueKontextpaket,
  klassifiziereBeleg,
  nimmAntwortAn,
  nimmJobWiederAuf,
  pruefeAnbieterweg,
  pruefeCodexErgebnis,
  quelleDarfHinaus,
  starteOderFindeJob,
  stoppeJob,
  unterbrecheJob,
  vergleicheKiErgebnisse,
  vermerkeFehler,
  vermerkeSendung,
  weiseFaehigkeitenAus,
} from "../../services/app/src/ki-arbeitsbegleitung";
import { type KlaraResolution, resolveKlaraPolicy } from "../../services/reasoner";

const JETZT = Date.parse("2026-10-11T13:00:00.000Z");

const BEREICH: KiArbeitsbereich = {
  mandantId: "m-synth",
  nutzerId: "u-anna",
  sitzungId: "s-1",
  host: "word-web",
  arbeitsbereichId: "ab-anna-team",
  projektId: "p-alpha",
  dokumentId: "d-angebot",
  dokumentFassung: "f3",
};

const LAGE: KiFreigabelage = {
  keineKi: false,
  oeffentlicheKiFreigegeben: true,
  vertraulichFreigegeben: false,
  erlaubteAnbieter: ["Claude", "ChatGPT"],
};

function quelle(teil: Partial<KiQuelle> & Pick<KiQuelle, "quelleId">): KiQuelle {
  return {
    mandantId: "m-synth",
    arbeitsbereichId: "ab-anna-team",
    projektId: "p-alpha",
    titel: `Titel ${teil.quelleId}`,
    fassung: "v1",
    lesbar: true,
    schutzstufe: "intern",
    dokumentfreigabe: "erteilt",
    abschnitte: [{ abschnittId: "a1", text: `Inhalt ${teil.quelleId}` }],
    ...teil,
  };
}

const QUELLEN: readonly KiQuelle[] = [
  quelle({
    quelleId: "q-preis",
    fassung: "v7",
    abschnitte: [
      { abschnittId: "a1", text: "Listenpreis 120 EUR je Lizenz." },
      { abschnittId: "a2", text: "Interne Marge 42 %.", gesperrt: true },
    ],
  }),
  quelle({ quelleId: "q-beta", projektId: "p-beta", titel: "Beta-Plan" }),
  quelle({
    quelleId: "q-privat",
    arbeitsbereichId: "ab-anna-privat",
    titel: "Privates Tagebuch",
    abschnitte: [{ abschnittId: "a1", text: "PRIVATER INHALT" }],
  }),
  quelle({
    quelleId: "q-geheim",
    lesbar: false,
    titel: "Geheime Übernahme",
    abschnitte: [{ abschnittId: "a1", text: "GEHEIMER INHALT" }],
  }),
  quelle({
    quelleId: "q-fremdmandant",
    mandantId: "m-anders",
    titel: "Fremder Mandant",
    abschnitte: [{ abschnittId: "a1", text: "FREMDER INHALT" }],
  }),
];

function paket(quellen: readonly KiQuelle[] = QUELLEN) {
  const r = baueKontextpaket(
    {
      ziel: "Fasse die Preisbedingungen für das Angebot zusammen",
      ergebnisformat: "stichpunkte",
      offenePunkte: ["Gilt der Preis auch für Bestandskunden?"],
    },
    BEREICH,
    quellen,
    LAGE,
    JETZT,
  );
  if (!r.ok) throw new Error(`Paket erwartet, Sperre ${r.sperre}`);
  return r.paket;
}

/** Echte Klara-Auflösung — externer Weg, Cloud-Anbieter `Claude`, mit/ohne Zustimmung. */
function aufloesung(externalConsentGranted: boolean, providerLabel = "Claude"): KlaraResolution {
  return resolveKlaraPolicy({
    choice: "cloud",
    source: "db",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel,
    modelLabel: "synthetisches-modell",
    externalConsentGranted,
    zentralFreigegeben: true,
    now: JETZT,
    resolutionId: "res-1",
  });
}

const API_ADAPTER: KiAdapter = {
  faehigkeit: "api",
  anbieter: "Claude",
  version: "adapter-1.0",
  geprueftAm: "2026-10-11T12:00:00.000Z",
};

describe("K1 · natürlicher Auftrag → verständlicher, gebundener Prompt", () => {
  it("enthält Ziel, Projekt, Dokumentfassung, Quellenstand und Ergebnisformat", () => {
    const p = paket();
    expect(p.prompt).toContain("Aufgabe: Fasse die Preisbedingungen für das Angebot zusammen");
    expect(p.prompt).toContain("Projekt: p-alpha · Dokument d-angebot (Fassung f3)");
    expect(p.prompt).toContain("[Quelle q-preis · Fassung v7]");
    expect(p.prompt).toContain("Listenpreis 120 EUR je Lizenz.");
    expect(p.prompt).toContain("Gewünschtes Ergebnis: kurze Stichpunkte.");
    expect(p.prompt).toContain("- Gilt der Preis auch für Bestandskunden?");
    expect(p.quellenstand).toEqual([{ quelleId: "q-preis", fassung: "v7", abschnittIds: ["a1"] }]);
    expect(p.bindung).toEqual(BEREICH);
  });

  it("lässt privaten anderen Bereich, Unlesbares und fremden Mandanten spurlos draußen", () => {
    const p = paket();
    const alles = JSON.stringify(p);
    for (const verboten of [
      "PRIVATER INHALT",
      "Privates Tagebuch",
      "q-privat",
      "GEHEIMER INHALT",
      "Geheime Übernahme",
      "q-geheim",
      "FREMDER INHALT",
      "q-fremdmandant",
    ]) {
      expect(alles).not.toContain(verboten);
    }
    // Das andere Projekt desselben Bereichs ist für den Nutzer sichtbar — mit Grund, ohne Inhalt.
    expect(p.ausgelassen).toContainEqual({
      quelleId: "q-beta",
      titel: "Beta-Plan",
      grund: "anderes_projekt",
    });
    expect(p.prompt).not.toContain("Inhalt q-beta");
  });

  it("ist bei gleichem Stand stabil und ändert sich mit der Quellfassung", () => {
    expect(paket().paketId).toBe(paket().paketId);
    const neu = paket(QUELLEN.map((q) => (q.quelleId === "q-preis" ? { ...q, fassung: "v8" } : q)));
    expect(neu.paketId).not.toBe(paket().paketId);
  });

  it("lehnt ein unzulässiges Ergebnisformat und einen leeren Auftrag verständlich ab", () => {
    const format = baueKontextpaket(
      { ziel: "x", ergebnisformat: "shellskript" },
      BEREICH,
      QUELLEN,
      LAGE,
      JETZT,
    );
    expect(format).toMatchObject({ ok: false, sperre: "ergebnisformat_unzulaessig" });
    const leer = baueKontextpaket(
      { ziel: "  ", ergebnisformat: "fliesstext" },
      BEREICH,
      QUELLEN,
      LAGE,
      JETZT,
    );
    expect(leer).toMatchObject({ ok: false, sperre: "ziel_fehlt" });
  });
});

describe("K2 · gewählter = tatsächlicher Anbieter — oder sichtbare Sperre", () => {
  it("API-Weg läuft nur mit genau dem gewählten Anbieter", () => {
    const weg = pruefeAnbieterweg({
      gewaehlterAnbieter: "Claude",
      faehigkeit: "api",
      lage: LAGE,
      adapter: [API_ADAPTER],
      resolution: aufloesung(true),
    });
    expect(weg).toEqual({
      erlaubt: true,
      faehigkeit: "api",
      anbieter: "Claude",
      modell: "synthetisches-modell",
    });
  });

  it("weicht die Bindung ab, wird gesperrt statt still gewechselt", () => {
    const weg = pruefeAnbieterweg({
      gewaehlterAnbieter: "Claude",
      faehigkeit: "api",
      lage: LAGE,
      adapter: [API_ADAPTER],
      resolution: aufloesung(true, "ChatGPT"),
    });
    expect(weg.erlaubt).toBe(false);
    if (weg.erlaubt) return;
    expect(weg.sperre).toBe("anbieter_abweichend");
    expect(weg.text).toContain("Gewählt ist Claude, eingerichtet ist ChatGPT");
    expect(weg.text).toContain("nicht still");
  });

  it("ohne Zustimmung ist die Ausführung gesperrt und nennt den Grund", () => {
    const weg = pruefeAnbieterweg({
      gewaehlterAnbieter: "Claude",
      faehigkeit: "api",
      lage: LAGE,
      adapter: [API_ADAPTER],
      resolution: aufloesung(false),
    });
    expect(weg).toMatchObject({ erlaubt: false, sperre: "ausfuehrung_gesperrt" });
    if (!weg.erlaubt) expect(weg.text).toContain("external_consent_missing");
  });

  it("nicht freigegebener Anbieter und fehlende P04-Grundfreigabe sperren konkret", () => {
    expect(
      pruefeAnbieterweg({
        gewaehlterAnbieter: "Gemini",
        faehigkeit: "prompt_manuell",
        lage: LAGE,
        adapter: [],
      }),
    ).toMatchObject({ erlaubt: false, sperre: "anbieter_nicht_erlaubt" });
    expect(
      pruefeAnbieterweg({
        gewaehlterAnbieter: "Claude",
        faehigkeit: "prompt_manuell",
        lage: { ...LAGE, oeffentlicheKiFreigegeben: false },
        adapter: [],
      }),
    ).toMatchObject({ erlaubt: false, sperre: "oeffentliche_ki_nicht_freigegeben" });
  });
});

describe("K3 · Dokumentfreigabe und Schutzstufe zugleich; P04 öffnet nichts Geschlossenes", () => {
  it("braucht beides: Schutzstufe UND Dokumentfreigabe", () => {
    const lage = { vertraulichFreigegeben: false };
    expect(quelleDarfHinaus({ schutzstufe: "intern", dokumentfreigabe: "erteilt" }, lage)).toEqual({
      erlaubt: true,
    });
    expect(quelleDarfHinaus({ schutzstufe: "intern", dokumentfreigabe: "fehlt" }, lage)).toEqual({
      erlaubt: false,
      grund: "dokumentfreigabe_fehlt",
    });
    expect(
      quelleDarfHinaus({ schutzstufe: "vertraulich", dokumentfreigabe: "erteilt" }, lage),
    ).toEqual({ erlaubt: false, grund: "vertraulich" });
    expect(
      quelleDarfHinaus(
        { schutzstufe: "unbekannt", dokumentfreigabe: "erteilt" },
        { vertraulichFreigegeben: true },
      ),
    ).toEqual({ erlaubt: false, grund: "schutzstufe_unbekannt" });
  });

  it("ein historisch geschlossener Weg bleibt zu — auch mit P04 und Vertraulich-Freigabe", () => {
    const voll = { ...LAGE, vertraulichFreigegeben: true };
    expect(
      quelleDarfHinaus({ schutzstufe: "oeffentlich", dokumentfreigabe: "geschlossen" }, voll),
    ).toEqual({ erlaubt: false, grund: "dokumentfreigabe_geschlossen" });
    const p = baueKontextpaket(
      { ziel: "Zusammenfassen", ergebnisformat: "fliesstext" },
      BEREICH,
      [
        quelle({
          quelleId: "q-zu",
          dokumentfreigabe: "geschlossen",
          abschnitte: [{ abschnittId: "a1", text: "ALTER GESCHLOSSENER TEXT" }],
        }),
      ],
      voll,
      JETZT,
    );
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.paket.prompt).not.toContain("ALTER GESCHLOSSENER TEXT");
    expect(p.paket.ausgelassen).toContainEqual({
      quelleId: "q-zu",
      titel: "Titel q-zu",
      grund: "dokumentfreigabe_geschlossen",
    });
  });

  it("entfernt die gesperrte Passage und behält den freigegebenen Rest", () => {
    const p = paket();
    expect(p.prompt).not.toContain("Interne Marge");
    expect(p.ausgelassen).toContainEqual({
      quelleId: "q-preis",
      titel: "Titel q-preis",
      grund: "passage_gesperrt",
      abschnittId: "a2",
    });
  });
});

describe("K4 · Keine KI sperrt automatische UND manuelle Übermittlung samt Folgeschritten", () => {
  const keineKi = { ...LAGE, keineKi: true };

  it("sperrt alle vier Fähigkeiten", () => {
    const alle = ["prompt_manuell", "api", "browser_begleitung", "codex_auftrag"] as const;
    for (const faehigkeit of alle) {
      const weg = pruefeAnbieterweg({
        gewaehlterAnbieter: "Claude",
        faehigkeit,
        lage: keineKi,
        adapter: [API_ADAPTER],
        resolution: aufloesung(true),
      });
      expect(weg).toMatchObject({ erlaubt: false, sperre: "keine_ki" });
    }
  });

  it("eine Wiederaufnahme nach Umstellung auf Keine KI sendet nichts", () => {
    const erlaubt = pruefeAnbieterweg({
      gewaehlterAnbieter: "Claude",
      faehigkeit: "prompt_manuell",
      lage: LAGE,
      adapter: [],
    });
    if (!erlaubt.erlaubt) throw new Error("Weg erwartet");
    const { job } = starteOderFindeJob([], paket(), erlaubt);
    const unterbrochen = unterbrecheJob(job);
    const jetztGesperrt = pruefeAnbieterweg({
      gewaehlterAnbieter: "Claude",
      faehigkeit: "prompt_manuell",
      lage: keineKi,
      adapter: [],
    });
    const w = nimmJobWiederAuf(unterbrochen, jetztGesperrt, { erneutSendenBestaetigt: true });
    expect(w.senden).toBe(false);
    expect(w.job.sendungen).toBe(0);
    expect(w.text).toContain("Keine KI");
  });
});

describe("K5 · Fähigkeiten ehrlich ausgewiesen; MCP-Status ist keine Chatsteuerung", () => {
  it("ohne Adapter: nur manuelle Übergabe verfügbar, auch wenn MCP aktiv ist", () => {
    const u = weiseFaehigkeitenAus([], true);
    expect(u.faehigkeiten.map((f) => [f.faehigkeit, f.status])).toEqual([
      ["prompt_manuell", "verfuegbar"],
      ["api", "nicht_eingerichtet"],
      ["browser_begleitung", "nicht_eingerichtet"],
      ["codex_auftrag", "nicht_eingerichtet"],
    ]);
    expect(u.fremdeChatsteuerung).toBe("nicht_vorhanden");
    expect(u.mcpText).toContain("nicht, dass Klara fremde Chats lesen oder steuern kann");
  });

  it("Stub zählt als Simulation, geprüfter Adapter als verbunden — und der Weg folgt dem", () => {
    const stub: KiAdapter = {
      faehigkeit: "codex_auftrag",
      anbieter: "Codex",
      version: "stub",
      simulation: true,
    };
    const u = weiseFaehigkeitenAus([API_ADAPTER, stub], false);
    const status = (f: string) => u.faehigkeiten.find((x) => x.faehigkeit === f);
    expect(status("api")).toMatchObject({
      status: "verbunden",
      anbieter: "Claude",
      version: "adapter-1.0",
    });
    expect(status("codex_auftrag")?.status).toBe("nur_simulation");
    expect(
      pruefeAnbieterweg({
        gewaehlterAnbieter: "Codex",
        faehigkeit: "codex_auftrag",
        lage: { ...LAGE, erlaubteAnbieter: ["Claude", "Codex"] },
        adapter: [stub],
      }),
    ).toMatchObject({ erlaubt: false, sperre: "faehigkeit_nicht_verbunden" });
  });
});

describe("K6 · Programmierauftrag bleibt im synthetischen Arbeitsbereich", () => {
  const auftrag = { paketId: "kp_x", wurzel: "/synthetisch/ws", erlaubtePfade: ["src", "tests"] };

  it("nimmt nur erlaubte Dateien an; fremder Ordner, Löschen, Betriebsaktionen nicht", () => {
    const r = pruefeCodexErgebnis(
      auftrag,
      [
        { pfad: "src/preis.ts", art: "anlegen" },
        { pfad: "tests/preis.test.ts", art: "aendern" },
        { pfad: "../anderes-projekt/geheim.ts", art: "aendern" },
        { pfad: "/synthetisch/anderes/x.ts", art: "anlegen" },
        { pfad: "src/../../fremd/y.ts", art: "anlegen" },
        { pfad: "srcx/trick.ts", art: "anlegen" },
        { pfad: "docs/readme.md", art: "aendern" },
        { pfad: "src/alt.ts", art: "loeschen" },
      ],
      ["deploy", "shell", "npm install"],
    );
    expect(r.angenommen).toEqual([
      { pfad: "src/preis.ts", art: "anlegen" },
      { pfad: "tests/preis.test.ts", art: "aendern" },
    ]);
    expect(r.abgelehnt).toEqual([
      { pfad: "../anderes-projekt/geheim.ts", grund: "ausserhalb_arbeitsbereich" },
      { pfad: "/synthetisch/anderes/x.ts", grund: "ausserhalb_arbeitsbereich" },
      { pfad: "src/../../fremd/y.ts", grund: "ausserhalb_arbeitsbereich" },
      { pfad: "srcx/trick.ts", grund: "pfad_nicht_erlaubt" },
      { pfad: "docs/readme.md", grund: "pfad_nicht_erlaubt" },
      { pfad: "src/alt.ts", grund: "loeschen_nicht_erlaubt" },
    ]);
    expect(r.abgelehnteAktionen).toEqual(["deploy", "shell", "npm install"]);
  });
});

describe("K7 · späte oder fremde Antwort behält ihren Ursprung", () => {
  const weg = { erlaubt: true, faehigkeit: "api", anbieter: "Claude", modell: "m" } as const;

  function gesendeterJob() {
    const { job } = starteOderFindeJob([], paket(), weg);
    return vermerkeSendung(job).job;
  }

  it("nach Dokumentwechsel: Bezug bleibt beim Ursprung, neues Dokument bleibt unberührt", () => {
    const job = gesendeterJob();
    const a = nimmAntwortAn(
      [job],
      { jobId: job.jobId, sitzungId: "s-1", anbieter: "Claude", inhalt: "Ergebnis" },
      { dokumentId: "d-anderes", dokumentFassung: "f1" },
    );
    expect(a).toMatchObject({ angenommen: true, anwendbar: false, paketId: job.paketId });
    if (!a.angenommen) return;
    expect(a.bezug.dokumentId).toBe("d-angebot");
    expect(a.hinweis).toContain("anderen Dokument");
  });

  it("nach Fassungswechsel desselben Dokuments: nicht still übernehmen", () => {
    const job = gesendeterJob();
    const a = nimmAntwortAn(
      [job],
      { jobId: job.jobId, sitzungId: "s-1", anbieter: "Claude", inhalt: "Ergebnis" },
      { dokumentId: "d-angebot", dokumentFassung: "f4" },
    );
    expect(a).toMatchObject({ angenommen: true, anwendbar: false });
    if (a.angenommen) expect(a.hinweis).toContain("geändert");
  });

  it("Antwort mit fremdem Ziel, aus anderer Sitzung oder von anderem Anbieter", () => {
    const job = gesendeterJob();
    const aktuell = { dokumentId: "d-angebot", dokumentFassung: "f3" };
    expect(
      nimmAntwortAn(
        [job],
        {
          jobId: job.jobId,
          sitzungId: "s-1",
          anbieter: "Claude",
          inhalt: "x",
          zielDokumentId: "d-fremd",
        },
        aktuell,
      ),
    ).toMatchObject({ angenommen: true, anwendbar: false });
    const antwort = (sitzungId: string, anbieter: string) =>
      nimmAntwortAn([job], { jobId: job.jobId, sitzungId, anbieter, inhalt: "x" }, aktuell);
    expect(antwort("s-2", "Claude")).toEqual({ angenommen: false, grund: "sitzung_abweichend" });
    expect(antwort("s-1", "ChatGPT")).toEqual({ angenommen: false, grund: "anbieter_abweichend" });
    expect(antwort("s-1", "Claude")).toMatchObject({
      angenommen: true,
      anwendbar: true,
      hinweis: null,
    });
  });
});

describe("K8 · Unterbrechung und Wiederaufnahme ohne Doppeljob oder Zweitverbrauch", () => {
  const weg = { erlaubt: true, faehigkeit: "api", anbieter: "Claude", modell: "m" } as const;

  it("derselbe Auftrag ergibt denselben Job; zweites Senden wird verweigert", () => {
    const p = paket();
    const erst = starteOderFindeJob([], p, weg, ["Bestandskunden?"]);
    const zweit = starteOderFindeJob([erst.job], p, weg);
    expect(erst.neu).toBe(true);
    expect(zweit).toEqual({ job: erst.job, neu: false });
    const s1 = vermerkeSendung(erst.job);
    const s2 = vermerkeSendung(s1.job);
    expect([s1.senden, s2.senden, s2.job.sendungen]).toEqual([true, false, 1]);
  });

  it("Wiederaufnahme erhält Ziel, Teilstand und offene Punkte und sendet nicht erneut", () => {
    const { job } = starteOderFindeJob([], paket(), weg, ["Bestandskunden?"]);
    const gesendet = vermerkeSendung(job).job;
    const pause = unterbrecheJob(gesendet, "Teil 1 fertig");
    const w = nimmJobWiederAuf(pause, weg);
    expect(w.senden).toBe(false);
    expect(w.job).toMatchObject({
      jobId: job.jobId,
      paketId: job.paketId,
      sendungen: 1,
      teilergebnis: "Teil 1 fertig",
      offenePunkte: ["Bestandskunden?"],
    });
    expect(w.text).toContain("ausdrücklichen Wunsch");
  });

  it("Providerfehler: erneut senden nur mit Bestätigung; nie still an anderen Anbieter", () => {
    const { job } = starteOderFindeJob([], paket(), weg);
    const fehler = vermerkeFehler(vermerkeSendung(job).job, "HTTP 529 überlastet");
    expect(nimmJobWiederAuf(fehler, weg).senden).toBe(false);
    const anders = { ...weg, anbieter: "ChatGPT" } as const;
    expect(nimmJobWiederAuf(fehler, anders, { erneutSendenBestaetigt: true }).senden).toBe(false);
    const bestaetigt = nimmJobWiederAuf(fehler, weg, { erneutSendenBestaetigt: true });
    expect([bestaetigt.senden, bestaetigt.job.sendungen]).toEqual([true, 2]);
  });

  it("ein nie gesendeter unterbrochener Job wird genau einmal gesendet", () => {
    const { job } = starteOderFindeJob([], paket(), weg);
    const w = nimmJobWiederAuf(unterbrecheJob(job), weg);
    expect([w.senden, w.job.sendungen, w.job.status]).toEqual([true, 1, "gesendet"]);
  });
});

describe("K9 · zwei KI-Ergebnisse gegen Originalquellen vergleichen", () => {
  it("Übereinstimmung allein ist keine Quellenbestätigung; Unterschiede werden benannt", () => {
    const p = paket();
    const a: KiErgebnis = {
      jobId: "kj_a",
      anbieter: "Claude",
      modell: "m-a",
      antwortFassung: "r1",
      aussagen: [
        { thema: "Listenpreis", wert: "120 EUR", quellen: ["q-preis"] },
        { thema: "Rabatt", wert: "10 %", quellen: ["q-erfunden"] },
        { thema: "Laufzeit", wert: "12 Monate", quellen: [] },
      ],
    };
    const b: KiErgebnis = {
      jobId: "kj_b",
      anbieter: "ChatGPT",
      modell: "m-b",
      antwortFassung: "r1",
      aussagen: [
        { thema: "Listenpreis", wert: "120 eur", quellen: [] },
        { thema: "Rabatt", wert: "10 %", quellen: [] },
        { thema: "Laufzeit", wert: "24 Monate", quellen: [] },
        { thema: "Support", wert: "inklusive", quellen: [] },
      ],
    };
    const v = vergleicheKiErgebnisse(p, a, b);
    const nach = Object.fromEntries(v.map((z) => [z.thema, z]));
    expect(nach.listenpreis).toMatchObject({
      status: "quelle_belegt",
      belegteQuellen: ["q-preis"],
    });
    expect(nach.rabatt).toMatchObject({
      status: "nur_uebereinstimmung",
      belegteQuellen: [],
      unbekannteQuellen: ["q-erfunden"],
    });
    expect(nach.rabatt?.text).toContain("Übereinstimmung ist keine Bestätigung");
    expect(nach.laufzeit).toMatchObject({
      status: "unterschied",
      werte: ["12 Monate", "24 Monate"],
    });
    expect(nach.support?.status).toBe("nur_einseitig");
  });
});

describe("K10 · realer Adapterlauf getrennt von Entwurf, Übergabe und Simulation", () => {
  it("stuft nur mit verbundenem Adapter, Anbieterkennung und Verbrauch als real ein", () => {
    expect(klassifiziereBeleg({ faehigkeit: "prompt_manuell" }).klasse).toBe("promptentwurf");
    expect(
      klassifiziereBeleg({ faehigkeit: "prompt_manuell", manuellesErgebnis: true }),
    ).toMatchObject({ klasse: "manuelle_uebergabe", verbrauch: "nicht_erfasst" });
    expect(
      klassifiziereBeleg({
        faehigkeit: "api",
        adapter: { ...API_ADAPTER, simulation: true },
        anbieterAnfrageId: "req-1",
        verbrauch: { einheit: "token", menge: 10 },
      }).klasse,
    ).toBe("simulation");
    const ohneVerbrauch = klassifiziereBeleg({
      faehigkeit: "api",
      adapter: API_ADAPTER,
      anbieterAnfrageId: "req-1",
    });
    expect(ohneVerbrauch.klasse).toBe("simulation");
    expect(
      klassifiziereBeleg({
        faehigkeit: "api",
        adapter: API_ADAPTER,
        anbieterAnfrageId: "req-1",
        verbrauch: { einheit: "token", menge: 812 },
      }),
    ).toMatchObject({ klasse: "realer_adapterlauf", verbrauch: { einheit: "token", menge: 812 } });
  });

  it("Stopp behauptet keine Rückholung gesendeter Daten oder Verbräuche", () => {
    const weg = { erlaubt: true, faehigkeit: "api", anbieter: "Claude", modell: "m" } as const;
    const { job } = starteOderFindeJob([], paket(), weg);
    expect(stoppeJob(job).text).toContain("nichts an einen Anbieter gesendet");
    expect(stoppeJob(vermerkeSendung(job).job).text).toContain("nicht zurückholen");
  });
});
