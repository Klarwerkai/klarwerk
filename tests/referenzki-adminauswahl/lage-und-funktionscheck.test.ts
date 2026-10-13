// ================================================================================================
// produkt:20261009:referenzki-adminauswahl (REF-03) — LAGE JE OPTION, ZUSTAND UND FUNKTIONSCHECK
// AM ECHTEN REASONER.
// ================================================================================================
//
// Ersetzt sind nur die Modelle: fiktive Doppelgänger mit fiktiven Modellbezeichnern, ohne Netz.
// Kettenbau, Freigaben, Abschaltung, Laufbuch und Laufprotokoll sind der Bestand.
//
//   L1 (K1/K2)  · je registriertem Zugang Anbieter, Modell, intern/öffentlich, erlaubt mit Vorrang
//   L2 (K5)     · öffentliche Optionen ohne Freigabe sind gesperrt; die interne nicht
//   L3 (K2)     · nicht eingerichtet, nicht erreichbar, KI abgeschaltet — je ein benannter Grund
//   L4 (K4)     · gleiches Modell wie die Antwort-KI wird erkannt, je nach heutiger Zuordnung
//   Z1 (K2)     · genau ein Zustand; „konfiguriert" ist kein Nachweis; ein Check gilt nur für sein Modell
//   F1 (K7)     · Funktionscheck: fiktiver Stoff, ein Aufruf, erfolgreich bei richtigem Urteil
//   F2 (K7)     · falsches Urteil, ungültige Ausgabe, Zeitlimit — fehlgeschlagen, nie still bestätigt
//   F3 (K5/K7)  · der Prüfer GENAU einer Option: mit denselben Sperren; ein Lauf `referenz` im Protokoll
import { describe, expect, it } from "vitest";
import { referenzOptionZustand } from "../../services/app/src/routes/reasoner-routes";
import {
  REFERENZ_PRUEF_RICHTLINIE,
  type ReferenzFunktionscheckErgebnis,
  referenzFunktionscheck,
} from "../../services/ask";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import {
  type AnswerResult,
  DeterministicProvider,
  InMemoryReasonerPolicyRepo,
  Reasoner,
  type ReasonerProvider,
  type ReferenzPruefer,
} from "../../services/reasoner";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

/** Die richtige Antwort auf den fiktiven Prüfstoff: t1 belegt, t2 widersprochen. */
function urteil(user: string, falsch = false): string {
  const daten = JSON.parse(user.slice(user.indexOf("\n") + 1)) as {
    posten: { teilId: string; fundstellen: { fundstelleId: string }[] }[];
  };
  return JSON.stringify({
    richtlinie: REFERENZ_PRUEF_RICHTLINIE,
    ergebnisse: daten.posten.map((p) => ({
      teilId: p.teilId,
      zustand: falsch || p.teilId === "fc.t1" ? "belegt" : "widersprochen",
      fundstelleId: p.fundstellen[0]?.fundstelleId ?? null,
      begruendung: "Fiktive Begründung zum fiktiven Prüfstoff.",
    })),
  });
}

/** Ein fiktives Modell, das antworten und prüfen kann — es merkt sich, was es zu prüfen bekam. */
function modell(name: string, bezeichner: string, erreichbar = true) {
  const basis = new DeterministicProvider();
  const gesehen: string[] = [];
  const provider = Object.assign(Object.create(basis) as ReasonerProvider, {
    name,
    isAvailable: () => erreichbar,
    modelName: () => bezeichner,
    answer: async (): Promise<AnswerResult> => ({
      ...(await basis.answer("Frage", [])),
      answered: true,
      answer: "Fiktive Antwort.",
      demo: false,
    }),
    pruefeQuellenbeleg: async (_system: string, user: string) => {
      gesehen.push(user);
      return urteil(user);
    },
  });
  return { provider, gesehen };
}

function aufbau(optionen: { lokal?: boolean; anthropicErreichbar?: boolean } = {}) {
  const openai = modell("cloud:openai:gpt-fiktiv", "gpt-fiktiv-1");
  const anthropic = modell(
    "anthropic:claude-fiktiv",
    "claude-fiktiv-2",
    optionen.anthropicErreichbar ?? true,
  );
  const lokal = modell("local:lokal-fiktiv", "lokal-fiktiv-3");
  const runs = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(
    undefined,
    undefined,
    runs,
    undefined,
    optionen.lokal === false ? undefined : lokal.provider,
    new InMemoryReasonerPolicyRepo(),
    { anbieter: { openai: openai.provider, anthropic: anthropic.provider } },
  );
  return { reasoner, runs, openai, anthropic, lokal };
}

const option = (r: Reasoner, wahl: string) =>
  r.referenzLage().optionen.find((o) => o.wahl === wahl);

describe("REF-03 · Lage je Option", () => {
  it("L1 · Anbieter, Modell, intern/öffentlich, erlaubt mit Vorrang — aus der Providerverwaltung", async () => {
    const { reasoner } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, referenzpruefung: ["anthropic", "local"] }),
    );
    const lage = reasoner.referenzLage();
    expect(lage.optionen.map((o) => o.wahl)).toEqual(["openai", "anthropic", "local"]);
    expect(option(reasoner, "anthropic")).toEqual({
      wahl: "anthropic",
      art: "oeffentlich",
      anbieter: "anthropic:claude-fiktiv",
      modell: "claude-fiktiv-2",
      eingerichtet: true,
      erlaubt: true,
      rang: 1,
      sperre: null,
      gleichWieAntwortmodell: false,
    });
    expect(option(reasoner, "local")).toMatchObject({
      art: "intern",
      modell: "lokal-fiktiv-3",
      erlaubt: true,
      rang: 2,
      sperre: null,
    });
    expect(option(reasoner, "openai")).toMatchObject({ erlaubt: false, rang: null });
    expect(lage.antwortmodell).toEqual({
      anbieter: "cloud:openai:gpt-fiktiv",
      modell: "gpt-fiktiv-1",
    });
    expect(lage.freigabe).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: false });
    // Keine Schlüssel, kein Geheimnis: nur Clientname und Modellbezeichner.
    expect(JSON.stringify(lage)).not.toMatch(/key|schluessel|token/i);
  });

  it("L2 · ohne Freigabe für externe Verarbeitung: öffentliche Optionen gesperrt, interne nicht", async () => {
    const { reasoner } = aufbau();
    await reasoner.setTaskConfig({
      global: "local",
      perTask: {},
      referenzpruefung: ["openai", "anthropic", "local"],
    });
    expect(option(reasoner, "openai")?.sperre).toBe("keine_freigabe_externe_verarbeitung");
    expect(option(reasoner, "anthropic")?.sperre).toBe("keine_freigabe_externe_verarbeitung");
    expect(option(reasoner, "local")?.sperre).toBeNull();
    expect(reasoner.referenzLage().freigabe.oeffentlicheKi).toBe(false);
    // Dieselbe Regel im Betrieb: ohne Freigabe kein öffentlicher Prüfer.
    expect(reasoner.referenzFunktionsPruefer("anthropic")).toEqual({ grund: "nicht_freigegeben" });
  });

  it("L3 · nicht eingerichtet, nicht erreichbar, KI abgeschaltet", async () => {
    const ohneLokal = aufbau({ lokal: false, anthropicErreichbar: false });
    await ohneLokal.reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: {}, referenzpruefung: ["anthropic", "local"] }),
    );
    expect(option(ohneLokal.reasoner, "local")).toMatchObject({
      eingerichtet: false,
      anbieter: null,
      modell: null,
      sperre: null,
    });
    expect(option(ohneLokal.reasoner, "anthropic")).toMatchObject({
      eingerichtet: true,
      sperre: "nicht_erreichbar",
    });

    const { reasoner } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "deterministic", perTask: {}, referenzpruefung: ["local"] }),
    );
    expect(reasoner.kiAbschaltung().abgeschaltet).toBe(true);
    expect(option(reasoner, "local")?.sperre).toBe("ki_abgeschaltet");
    expect(reasoner.referenzFunktionsPruefer("local")).toEqual({ grund: "nicht_freigegeben" });
  });

  it("L4 · gleiches Modell wie die heutige Antwort-KI — folgt der Zuordnung der Antwort", async () => {
    const { reasoner } = aufbau();
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: {}, referenzpruefung: ["anthropic"] }),
    );
    expect(option(reasoner, "anthropic")?.gleichWieAntwortmodell).toBe(true);
    expect(option(reasoner, "openai")?.gleichWieAntwortmodell).toBe(false);
    // Und es wird erzwungen: für eine Antwort dieses Modells gibt es keinen Prüfer.
    const rolle = {
      anbieter: "anthropic:claude-fiktiv",
      modell: "claude-fiktiv-2",
      stufe: "cloud" as const,
    };
    expect(reasoner.referenzPruefer(rolle, false)).toEqual({ grund: "nicht_unabhaengig" });

    // Die Antwortaufgabe je Aufgabe umgestellt: jetzt ist OpenAI die Antwort-KI.
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: { answer: "openai" } }),
    );
    expect(option(reasoner, "anthropic")?.gleichWieAntwortmodell).toBe(false);
    expect(option(reasoner, "openai")?.gleichWieAntwortmodell).toBe(true);
  });
});

describe("REF-03 · genau ein Zustand je Option", () => {
  const basis = { eingerichtet: true, erlaubt: true, sperre: null, modell: "m-1" } as const;
  it("Z1 · nicht eingerichtet › ausgeschaltet › nicht verfügbar › letzte Prüfung › konfiguriert", () => {
    expect(referenzOptionZustand({ ...basis, eingerichtet: false }, null)).toBe(
      "nicht_eingerichtet",
    );
    expect(referenzOptionZustand({ ...basis, erlaubt: false }, null)).toBe("ausgeschaltet");
    expect(referenzOptionZustand({ ...basis, sperre: "nicht_erreichbar" }, null)).toBe(
      "nicht_verfuegbar",
    );
    expect(referenzOptionZustand(basis, null)).toBe("konfiguriert");
    expect(referenzOptionZustand(basis, { modell: "m-1", ergebnis: "erfolgreich" })).toBe(
      "letzte_pruefung_erfolgreich",
    );
    expect(referenzOptionZustand(basis, { modell: "m-1", ergebnis: "fehlgeschlagen" })).toBe(
      "letzte_pruefung_fehlgeschlagen",
    );
    // Ein Check mit einem ANDEREN Modell belegt das heutige nicht: zurück auf „konfiguriert".
    expect(referenzOptionZustand(basis, { modell: "m-alt", ergebnis: "erfolgreich" })).toBe(
      "konfiguriert",
    );
    // Eine Sperre schlägt jedes frühere Ergebnis.
    expect(
      referenzOptionZustand(
        { ...basis, sperre: "keine_freigabe_externe_verarbeitung" },
        { modell: "m-1", ergebnis: "erfolgreich" },
      ),
    ).toBe("nicht_verfuegbar");
  });
});

function doppelgaenger(antwort: (user: string) => Promise<string>): {
  p: ReferenzPruefer;
  aufrufe: () => number;
  stoff: () => string[];
} {
  let aufrufe = 0;
  const stoff: string[] = [];
  const p: ReferenzPruefer = {
    rolle: { anbieter: "anthropic:pruef-fiktiv", modell: "pruef-fiktiv-7", stufe: "cloud" },
    extern: true,
    pruefe: async (system, user, vertraulich) => {
      aufrufe += 1;
      stoff.push(system, user, String(vertraulich));
      return { text: await antwort(user), dauerMs: 7, verbrauch: { eingabe: 300, ausgabe: 40 } };
    },
  };
  return { p, aufrufe: () => aufrufe, stoff: () => stoff };
}

describe("REF-03 · Funktionscheck", () => {
  it("F1 · fiktiver Stoff, genau ein Aufruf, erfolgreich bei richtigem Urteil — mit Zeit, Modell, Verbrauch", async () => {
    const d = doppelgaenger(async (user) => urteil(user));
    const e: ReferenzFunktionscheckErgebnis = await referenzFunktionscheck(d.p, {
      jetzt: () => Date.parse("2026-10-12T08:00:00.000Z"),
    });
    expect(e).toMatchObject({
      zeit: "2026-10-12T08:00:00.000Z",
      richtlinie: REFERENZ_PRUEF_RICHTLINIE,
      ergebnis: "erfolgreich",
      grund: null,
      modellaufruf: true,
      verbrauch: { eingabe: 300, ausgabe: 40 },
      pruefer: { modell: "pruef-fiktiv-7" },
    });
    expect(d.aufrufe()).toBe(1);
    const [system, user, vertraulich] = d.stoff();
    expect(system).toContain(REFERENZ_PRUEF_RICHTLINIE);
    expect(user).toContain("fiktiv");
    expect(user).toContain("Musterwerk Nordhafen");
    expect(vertraulich).toBe("false");
  });

  it("F2 · falsches Urteil, ungültige Ausgabe, Zeitlimit: fehlgeschlagen, kein zweiter Versuch", async () => {
    const falsch = doppelgaenger(async (user) => urteil(user, true));
    expect(await referenzFunktionscheck(falsch.p)).toMatchObject({
      ergebnis: "fehlgeschlagen",
      grund: "falsches_urteil",
      modellaufruf: true,
    });
    const ungueltig = doppelgaenger(async () => "alles belegt, versprochen");
    expect(await referenzFunktionscheck(ungueltig.p)).toMatchObject({
      ergebnis: "fehlgeschlagen",
      grund: "ungueltige_pruefausgabe",
    });
    const haengt = doppelgaenger(() => new Promise<string>(() => undefined));
    const zeit = await referenzFunktionscheck(haengt.p, { zeitlimitMs: 20 });
    expect(zeit).toMatchObject({ ergebnis: "fehlgeschlagen", grund: "zeitlimit", verbrauch: null });
    expect(haengt.aufrufe()).toBe(1);
  });

  it("F3 · Prüfer genau einer Option über den Reasoner: ein Lauf `referenz` mit Modell im Protokoll", async () => {
    const { reasoner, runs, anthropic, openai } = aufbau();
    // Die Option muss nicht erlaubt sein — geprüft wird, ob sie einsatzfähig wäre.
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    const wahl = reasoner.referenzFunktionsPruefer("anthropic");
    expect("pruefer" in wahl && wahl.pruefer.rolle.modell).toBe("claude-fiktiv-2");
    if (!("pruefer" in wahl)) {
      return;
    }
    const e = await referenzFunktionscheck(wahl.pruefer);
    expect(e).toMatchObject({ ergebnis: "erfolgreich", pruefer: { modell: "claude-fiktiv-2" } });
    expect(anthropic.gesehen).toHaveLength(1);
    expect(openai.gesehen).toHaveLength(0);
    const laeufe = (await runs.recent(10)).filter((r) => r.task === "referenz");
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]).toMatchObject({ status: "success" });
  });
});
