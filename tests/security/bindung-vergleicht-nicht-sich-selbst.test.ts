import { describe, expect, it } from "vitest";
import {
  type KlaraDocumentDescriptor,
  type KlaraPolicyQuelle,
  KlaraSessionService,
  pruefeConsentDeckung,
} from "../../services/app/src/services/klara-session-service";
import {
  InMemoryKlaraSessionRepo,
  type KlaraConsent,
  type KlaraResolution,
  type KlaraSession,
} from "../../services/reasoner";

// ================================================================================================
// JOB 785 · D2 · N6 — KEINE DER NEUN BINDUNGEN VERGLEICHT EINEN WERT MIT SICH SELBST
// ================================================================================================
//
// GEGENSTAND (BEN-PRUEFUNG-JOB-785-D1, Negativfall N6; Vorrueckgabe §3 A-1, Befund BEN-35/1):
// Die Deckungspruefung `pruefeConsentDeckung` fuehrt neun einzeln benannte Bindungen aus
// KW-S4-23 §1. Eine davon — `effectivePayloadClasses` — verglich die Zustimmung eine Zeit lang
// gegen eine hart codierte Klasse des Sitzungsdienstes statt gegen die tatsaechlich verwendete
// Aufloesung. Der Vergleich lief damit gegen sich selbst: er konnte nie abweichen. Acht Bindungen
// pruefen, die neunte war Dekoration — und der Plan wies trotzdem „alle neun" als geprueft aus.
//
// WARUM DIESER WAECHTER UND NICHT DER BESTEHENDE FALL: `klara-session-service.test.ts:1513`
// deckt genau EINE Bindung (`effectivePayloadClasses`) gegen genau EINE Stoerrichtung ab. Der
// Fehlertyp ist aber nicht an dieses Feld gebunden — er kann jede der neun treffen, sobald jemand
// eine Sollseite versehentlich aus der Zustimmung statt aus Aufloesung oder Sitzung zieht. Dieser
// Waechter prueft deshalb ALLE NEUN, und jede aus BEIDEN Richtungen.
//
// DIE MECHANIK, auf der die Beweiskraft beruht:
//   · Stoerung der CONSENT-Seite bei unveraenderter Gegenseite → die Abweichung MUSS auftauchen.
//     Kaeme die Sollseite in Wahrheit aus dem Consent, verschoebe sie sich mit — keine Abweichung,
//     Test rot. Genau das ist der historische Fehler.
//   · Stoerung der GEGENSEITE (Aufloesung beziehungsweise Sitzung) bei unveraendertem Consent →
//     dieselbe Pflicht in der anderen Richtung. Kaeme die Istseite aus der Aufloesung, verschoebe
//     sie sich mit — ebenfalls rot.
//   · Erwartet wird jeweils GENAU das eine Feld, nicht „enthaelt". Ein Sammelname oder eine
//     gezaehlte Abweichung faellt damit auf; KW-S4-23 verlangt die namentliche Meldung.
//
// AUSDRUECKLICH NICHT GEGENSTAND: N1 (`tor-hat-keinen-vorbeiweg`). Das Urteil bindet dafuer zuerst
// die Festlegung eines technischen Chokepoints und laesst bis dahin ausschliesslich diesen
// Waechter als baubereit zu.

const T0 = Date.parse("2026-08-02T09:00:00.000Z");

const GESPEICHERT: KlaraDocumentDescriptor = {
  kind: "saved",
  hostDocumentId: "word-doc-1",
};

/** Eine Instanz, auf der die effektive Answer-Bindung wirklich extern ist — sonst gibt es keine Zustimmung. */
function externAufbau() {
  const quelle: KlaraPolicyQuelle = {
    choice: "cloud",
    source: "default",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "Cloud-Anbieter",
    modelLabel: "cloud-modell",
    localProviderLabel: "Lokaler Anbieter",
  };
  const repo = new InMemoryKlaraSessionRepo();
  let zaehler = 0;
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => T0,
    newId: () => `id-${++zaehler}`,
  });
  return { dienst, repo };
}

/**
 * Ein echter, vom Dienst erzeugter Deckungsfall: Sitzung, erteilte Zustimmung und die Aufloesung,
 * gegen die sie erteilt wurde. Bewusst keine handgeschriebenen Fixtures — eine erfundene
 * Zustimmung koennte eine Bindung tragen, die der Dienst so nie schreibt.
 */
async function gedeckterFall(): Promise<{
  consent: KlaraConsent;
  session: KlaraSession;
  resolution: KlaraResolution;
}> {
  const { dienst, repo } = externAufbau();
  const start = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
  const bindung = {
    actorId: "anna",
    addinInstanceId: "instanz-1",
    documentContextId: start.documentContextId,
  };
  const gewaehrt = await dienst.grantConsent(start.sessionId, bindung);
  const consent = await repo.findConsent(gewaehrt.sessionId);
  const session = await repo.findSession(gewaehrt.sessionId);
  if (!consent || !session) {
    throw new Error("Aufbau unvollstaendig: Zustimmung oder Sitzung fehlt");
  }
  return { consent, session, resolution: gewaehrt.resolution };
}

/** Die Gegenseite einer Bindung — die Quelle, aus der der SOLLWERT stammen muss. */
type Gegenseite =
  | { readonly art: "resolution"; readonly patch: Partial<KlaraResolution> }
  | { readonly art: "session"; readonly patch: Partial<KlaraSession> };

interface Bindungsfall {
  /** Der Name, den die Pruefung bei Abweichung melden MUSS. */
  readonly feld: string;
  /** Stoerung ausschliesslich auf der Zustimmungsseite. */
  readonly consentSeite: Partial<KlaraConsent>;
  /** Stoerung ausschliesslich auf der Gegenseite. */
  readonly gegenSeite: Gegenseite;
}

// Die neun Bindungen aus KW-S4-23 §1, in der Reihenfolge des Produktcodes. Jede Stoerung setzt
// einen Wert, der sich vom Bestand garantiert unterscheidet — und je Richtung einen ANDEREN, damit
// die beiden Stoerungen nicht versehentlich zusammenfallen und die Abweichung aufheben.
const BINDUNGEN: readonly Bindungsfall[] = [
  {
    feld: "resolutionId",
    consentSeite: { resolutionId: "abweichend-resolution-consent" },
    gegenSeite: { art: "resolution", patch: { resolutionId: "abweichend-resolution-gegen" } },
  },
  {
    feld: "policyVersion",
    consentSeite: { policyVersion: "abweichend-policy-consent" },
    gegenSeite: { art: "resolution", patch: { policyVersion: "abweichend-policy-gegen" } },
  },
  {
    feld: "configurationVersion",
    consentSeite: { configurationVersion: "abweichend-config-consent" },
    gegenSeite: { art: "resolution", patch: { configurationVersion: "abweichend-config-gegen" } },
  },
  {
    // Die Zustimmung traegt den Anbieter in `providerReference`, die Aufloesung in `provider`.
    // Ein `null` waere hier KEINE Stoerung dieser Bindung, sondern der eigene Grund
    // `bindung_unvollstaendig` — deshalb ein abweichender Anbietername.
    feld: "provider",
    consentSeite: { providerReference: "abweichend-anbieter-consent" },
    gegenSeite: { art: "resolution", patch: { provider: "abweichend-anbieter-gegen" } },
  },
  {
    feld: "model",
    consentSeite: { modelReference: "abweichend-modell-consent" },
    gegenSeite: { art: "resolution", patch: { model: "abweichend-modell-gegen" } },
  },
  {
    // Die Klasse der Zustimmung steht gegen den EFFEKTIVEN Modus der Aufloesung. `internal` ist
    // ein echter Modus des Bestands und weicht von `external` ab.
    feld: "providerClass",
    consentSeite: { providerClass: "abweichend-klasse-consent" },
    gegenSeite: { art: "resolution", patch: { effectiveMode: "internal" } },
  },
  {
    // Die beiden Kontextbindungen stehen gegen die SITZUNG, nicht gegen die Aufloesung.
    feld: "documentContextId",
    consentSeite: { documentContextId: "abweichend-dokument-consent" },
    gegenSeite: { art: "session", patch: { documentContextId: "abweichend-dokument-gegen" } },
  },
  {
    feld: "sessionId",
    consentSeite: { sessionId: "abweichend-sitzung-consent" },
    gegenSeite: { art: "session", patch: { sessionId: "abweichend-sitzung-gegen" } },
  },
  {
    // Der historische Fall BEN-35/1 — hier stand die Sollseite einmal als Konstante im Dienst.
    feld: "effectivePayloadClasses",
    consentSeite: { allowedPayloadClasses: ["abweichende-klasse-consent"] },
    gegenSeite: {
      art: "resolution",
      patch: { effectivePayloadClasses: ["abweichende-klasse-gegen"] },
    },
  },
];

function mitGegenseite(
  basis: { session: KlaraSession; resolution: KlaraResolution },
  gegenSeite: Gegenseite,
): { session: KlaraSession; resolution: KlaraResolution } {
  return gegenSeite.art === "resolution"
    ? { session: basis.session, resolution: { ...basis.resolution, ...gegenSeite.patch } }
    : { session: { ...basis.session, ...gegenSeite.patch }, resolution: basis.resolution };
}

/** Die Abweichungsnamen einer Pruefung — oder ein sprechender Ersatz, wenn sie gar nicht abweist. */
function abweichungenVon(deckung: ReturnType<typeof pruefeConsentDeckung>): readonly string[] {
  return deckung.gedeckt ? ["<GEDECKT — keine Abweichung gemeldet>"] : deckung.abweichungen;
}

describe("JOB 785 · N6: keine der neun Bindungen vergleicht einen Wert mit sich selbst", () => {
  // ----------------------------------------------------------------------------------------------
  // GEGENKONTROLLE — ohne sie waere „lehnt alles ab" von „bindet richtig" nicht unterscheidbar.
  // ----------------------------------------------------------------------------------------------
  it("der ungestoerte Fall ist gedeckt", async () => {
    const { consent, session, resolution } = await gedeckterFall();
    const deckung = pruefeConsentDeckung(consent, session, resolution, T0);
    expect(deckung.gedeckt).toBe(true);
  });

  it("die Pruefung fuehrt genau neun benannte Bindungen", () => {
    expect(BINDUNGEN.map((b) => b.feld)).toEqual([
      "resolutionId",
      "policyVersion",
      "configurationVersion",
      "provider",
      "model",
      "providerClass",
      "documentContextId",
      "sessionId",
      "effectivePayloadClasses",
    ]);
    expect(new Set(BINDUNGEN.map((b) => b.feld)).size).toBe(9);
  });

  // ----------------------------------------------------------------------------------------------
  // RICHTUNG 1 — die Zustimmung weicht ab, Aufloesung und Sitzung bleiben unveraendert.
  // ----------------------------------------------------------------------------------------------
  //
  // Das ist die Richtung, in der ein Selbstvergleich auffliegt: zieht die Sollseite ihren Wert in
  // Wahrheit aus der Zustimmung, wandert sie mit der Stoerung mit und es entsteht nie eine
  // Abweichung.
  for (const fall of BINDUNGEN) {
    it(`${fall.feld}: eine abweichende ZUSTIMMUNG wird genau als \`${fall.feld}\` gemeldet`, async () => {
      const { consent, session, resolution } = await gedeckterFall();
      const gestoert: KlaraConsent = { ...consent, ...fall.consentSeite };

      const deckung = pruefeConsentDeckung(gestoert, session, resolution, T0);

      expect(deckung.gedeckt).toBe(false);
      expect(abweichungenVon(deckung)).toEqual([fall.feld]);
      expect(!deckung.gedeckt && deckung.grund).toBe("bindung_abweichend");
    });
  }

  // ----------------------------------------------------------------------------------------------
  // RICHTUNG 2 — Aufloesung beziehungsweise Sitzung weichen ab, die Zustimmung bleibt unveraendert.
  // ----------------------------------------------------------------------------------------------
  //
  // Dieselbe Pflicht rueckwaerts: zieht die ISTSEITE ihren Wert in Wahrheit aus der Aufloesung,
  // wandert sie mit und die Abweichung verschwindet ebenfalls.
  for (const fall of BINDUNGEN) {
    it(`${fall.feld}: eine abweichende ${fall.gegenSeite.art === "session" ? "SITZUNG" : "AUFLOESUNG"} wird genau als \`${fall.feld}\` gemeldet`, async () => {
      const basis = await gedeckterFall();
      const { session, resolution } = mitGegenseite(basis, fall.gegenSeite);

      const deckung = pruefeConsentDeckung(basis.consent, session, resolution, T0);

      expect(deckung.gedeckt).toBe(false);
      expect(abweichungenVon(deckung)).toEqual([fall.feld]);
      expect(!deckung.gedeckt && deckung.grund).toBe("bindung_abweichend");
    });
  }

  // ----------------------------------------------------------------------------------------------
  // VOLLSTAENDIGKEIT — alle neun gleichzeitig gestoert muessen alle neun Namen ergeben.
  // ----------------------------------------------------------------------------------------------
  //
  // Dieser Fall faengt, was die Einzelfaelle nicht faengt: eine ENTFERNTE Bindung. Wer eine Zeile
  // aus der Liste nimmt, laesst genau einen der Einzelfaelle scheitern — wer sie durch eine
  // Sammelbedingung ersetzt, faellt hier auf, weil dann weniger als neun Namen zurueckkommen.
  it("alle neun Bindungen gleichzeitig gestoert ⇒ alle neun Namen, keiner fehlt", async () => {
    const { consent, session, resolution } = await gedeckterFall();
    let gestoerterConsent: KlaraConsent = consent;
    for (const fall of BINDUNGEN) {
      gestoerterConsent = { ...gestoerterConsent, ...fall.consentSeite };
    }

    const deckung = pruefeConsentDeckung(gestoerterConsent, session, resolution, T0);

    expect(deckung.gedeckt).toBe(false);
    expect([...abweichungenVon(deckung)].sort()).toEqual([...BINDUNGEN.map((b) => b.feld)].sort());
  });

  // ----------------------------------------------------------------------------------------------
  // ABGRENZUNG — `bindung_abweichend` ist nicht der einzige Sperrgrund, und die Gruende dominieren
  // einander in einer festen Reihenfolge. Ohne diese Abgrenzung koennte ein Waechter gruen bleiben,
  // der jede Stoerung in denselben Sammelgrund kippt.
  // ----------------------------------------------------------------------------------------------
  it("eine fehlende Anbieterreferenz ist `bindung_unvollstaendig`, nicht `bindung_abweichend`", async () => {
    const { consent, session, resolution } = await gedeckterFall();
    const altbestand: KlaraConsent = { ...consent, providerReference: null };

    const deckung = pruefeConsentDeckung(altbestand, session, resolution, T0);

    expect(deckung.gedeckt).toBe(false);
    expect(!deckung.gedeckt && deckung.grund).toBe("bindung_unvollstaendig");
    expect(abweichungenVon(deckung)).toEqual(["providerReference"]);
  });
});
