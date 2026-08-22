import { describe, expect, it } from "vitest";
import {
  type KlaraDocumentDescriptor,
  type KlaraPolicyQuelle,
  KlaraSessionService,
  pruefeConsentDeckung,
} from "../../services/app/src/services/klara-session-service";
import { InMemoryKlaraSessionRepo, type KlaraConsent } from "../../services/reasoner";

// ================================================================================================
// JOB 1943 · D11 · KA5 — DIE ZEHNTE BINDUNG: `addinInstanceId`
// ================================================================================================
//
// WAS VORHER GALT. `pruefeConsentDeckung` fuehrte neun Bindungen. `addinInstanceId` war keine
// davon (JOB 1943 D9, gemessen). Dieselbe Zustimmung deckte damit auch eine FREMDE Add-in-Instanz
// derselben Sitzung: geschuetzt war die Instanz ausschliesslich in `laden`
// (`klara-session-service.ts:919`) — also nur solange, wie dieser Weg davorsteht. Jeder kuenftige
// Weg, der eine Zustimmung ohne `laden` bewertet, haette die zu breite Deckung geerbt.
//
// WAS JETZT GILT. Die Zustimmung traegt selbst, wofuer sie erteilt wurde. Der Fall
// „fremde Instanz" unten hat vor diesem Bau `gedeckt: true` geliefert und liefert jetzt
// `gedeckt: false` mit AUSSCHLIESSLICH `["addinInstanceId"]`.
//
// DIE ZWEITE HAELFTE, die man leicht vergisst: Altbestand. Eine Zustimmung, die vor dieser
// Aenderung erteilt wurde, traegt `addinInstanceId: null`. Sie wird NICHT still gedeckt, sondern
// fail-closed als `bindung_unvollstaendig` abgewiesen — dieselbe Wahl, die der Bestand fuer
// `providerReference` schon einmal getroffen hat (`klara-policy-store.ts:91-96`). Der vorletzte
// Fall haelt das fest; ohne ihn koennte man die Vorpruefung entfernen, ohne dass ein Test es merkt.

const T0 = Date.parse("2026-08-02T09:00:00.000Z");

const GESPEICHERT: KlaraDocumentDescriptor = {
  kind: "saved",
  hostDocumentId: "word-doc-1",
};

/** Eine Instanz, auf der die effektive Answer-Bindung extern ist — sonst gibt es keine Zustimmung. */
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

/** Ein echter, vom Dienst erzeugter Deckungsfall — keine handgeschriebene Zustimmung. */
async function gedeckterFall() {
  const { dienst, repo } = externAufbau();
  const start = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
  const gewaehrt = await dienst.grantConsent(start.sessionId, {
    actorId: "anna",
    addinInstanceId: "instanz-1",
    documentContextId: start.documentContextId,
  });
  const consent = await repo.findConsent(start.sessionId);
  const session = await repo.findSession(start.sessionId);
  if (!consent || !session) {
    throw new Error("Aufbau unvollstaendig: Zustimmung oder Sitzung fehlt");
  }
  return { consent, session, resolution: gewaehrt.resolution };
}

describe("JOB 1943 · D11 · KA5: `addinInstanceId` ist die zehnte Bindung", () => {
  // ----------------------------------------------------------------------------------------------
  // GEGENKONTROLLE — ohne sie waere „bindet richtig" von „weist alles ab" nicht unterscheidbar.
  // ----------------------------------------------------------------------------------------------
  it("die ungestoerte Zustimmung deckt weiterhin", async () => {
    const { consent, session, resolution } = await gedeckterFall();

    expect(pruefeConsentDeckung(consent, session, resolution, T0).gedeckt).toBe(true);
  });

  it("der Schreibweg setzt die Instanz — sonst traege die Bindung ins Leere", async () => {
    const { consent, session } = await gedeckterFall();

    // Ohne diese Zeile koennte der Consent-Bau das Feld weglassen und alles waere trotzdem gruen:
    // `null` gegen `null` faellt in der Vorpruefung auf, aber ein stiller Vorgabewert nicht.
    expect(consent.addinInstanceId).toBe("instanz-1");
    expect(consent.addinInstanceId).toBe(session.addinInstanceId);
  });

  // ----------------------------------------------------------------------------------------------
  // DER UMSCHLAG — genau dieser Fall lieferte vor dem Bau `gedeckt: true`.
  // ----------------------------------------------------------------------------------------------
  it("eine fremde Add-in-Instanz wird NICHT mehr gedeckt", async () => {
    const { consent, session, resolution } = await gedeckterFall();

    // Alles bleibt, wie es war — nur die Sitzung laeuft auf einer anderen Add-in-Instanz.
    const fremdeInstanz = { ...session, addinInstanceId: "instanz-2-fremd" };

    const deckung = pruefeConsentDeckung(consent, fremdeInstanz, resolution, T0);

    expect(deckung.gedeckt).toBe(false);
    // AUSSCHLIESSLICH die Instanz — kein Sammelname, keine zweite Abweichung. Meldete die Pruefung
    // hier mehr, waere die neue Bindung an eine andere gekoppelt statt eigenstaendig.
    expect(!deckung.gedeckt && deckung.abweichungen).toEqual(["addinInstanceId"]);
    expect(!deckung.gedeckt && deckung.grund).toBe("bindung_abweichend");
  });

  it("die andere Richtung ebenso: weicht die ZUSTIMMUNG ab, wird sie genauso gemeldet", async () => {
    const { consent, session, resolution } = await gedeckterFall();

    // Spiegelbild des vorigen Falls. Kaeme der Sollwert in Wahrheit aus der Zustimmung, verschoebe
    // er sich mit der Stoerung mit und es entstuende nie eine Abweichung.
    const gestoert: KlaraConsent = { ...consent, addinInstanceId: "instanz-3-fremd" };

    const deckung = pruefeConsentDeckung(gestoert, session, resolution, T0);

    expect(deckung.gedeckt).toBe(false);
    expect(!deckung.gedeckt && deckung.abweichungen).toEqual(["addinInstanceId"]);
  });

  // ----------------------------------------------------------------------------------------------
  // ALTBESTAND — fail-closed, nie still gedeckt.
  // ----------------------------------------------------------------------------------------------
  it("eine Zustimmung ohne Instanzkennung ist `bindung_unvollstaendig`, nicht `bindung_abweichend`", async () => {
    const { consent, session, resolution } = await gedeckterFall();

    // So sieht eine Zeile aus, die vor dieser Aenderung erteilt wurde: die Spalte ist NULL.
    const altbestand: KlaraConsent = { ...consent, addinInstanceId: null };

    const deckung = pruefeConsentDeckung(altbestand, session, resolution, T0);

    expect(deckung.gedeckt).toBe(false);
    expect(!deckung.gedeckt && deckung.grund).toBe("bindung_unvollstaendig");
    expect(!deckung.gedeckt && deckung.abweichungen).toEqual(["addinInstanceId"]);
  });

  it("die aeltere Unvollstaendigkeit behaelt Vorrang — providerReference wird zuerst gemeldet", async () => {
    const { consent, session, resolution } = await gedeckterFall();

    // Beide Bindungen fehlen. Die Reihenfolge der Vorpruefungen ist eine gesetzte Zusicherung
    // (`bindung-vergleicht-nicht-sich-selbst.test.ts` erwartet fuer diesen Fall
    // `["providerReference"]`); die neue Pruefung steht bewusst DAHINTER und verdeckt sie nicht.
    const beides: KlaraConsent = { ...consent, providerReference: null, addinInstanceId: null };

    const deckung = pruefeConsentDeckung(beides, session, resolution, T0);

    expect(!deckung.gedeckt && deckung.abweichungen).toEqual(["providerReference"]);
  });
});
