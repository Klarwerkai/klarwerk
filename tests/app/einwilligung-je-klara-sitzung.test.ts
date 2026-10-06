// ================================================================================================
// AUFTRAG gesamt-ki-einwilligung:bindung · R-0590 — DIE ZUSTIMMUNG GILT FÜR GENAU EINE SITZUNG.
// ================================================================================================
//
// Originalpunkt: „Die Zustimmung zur Nutzung externer KI gilt fuer genau eine, technisch klar
// begrenzte Klara-Sitzung; danach wird erneut gefragt."
//
// Der Bestand bindet die Zustimmung an `sessionId` (`pruefeConsentDeckung`) und entwertet sie bei
// Schliessen und Ablauf (`klara-session-service.test.ts`, ROT-3). Was bis hierher NIRGENDS gemessen
// war, ist die zweite Satzhälfte: dass die NÄCHSTE Sitzung — gleicher Mensch, gleiche Add-in-Instanz,
// gleiches gespeichertes Dokument, also dieselbe `documentContextId` — die alte Zustimmung NICHT erbt,
// sondern wieder fragt. Gleiches Dokument ist der scharfe Fall: über das Dokument allein wäre die
// Zustimmung übertragbar, über die Sitzung nicht.
//
// „Erneut gefragt" heisst im Vertrag: `external_consent_missing` mit benanntem Empfänger
// (`externalConsentProvider`) — das Panel bietet dann die Zustimmung wieder an — und das finale Tor
// sperrt mit `CONSENT_RECONFIRMATION_REQUIRED`, Deckungsgrund `kein_consent`.
import { describe, expect, it } from "vitest";
import {
  KLARA_SESSION_INACTIVITY_MS,
  type KlaraBindung,
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "../../services/app/src/services/klara-session-service";
import { InMemoryKlaraSessionRepo } from "../../services/reasoner";

const T0 = Date.parse("2026-10-06T09:00:00.000Z");
const DOKUMENT = { kind: "saved", hostDocumentId: "word-doc-r0590" } as const;

function aufbau() {
  let jetzt = T0;
  let zaehler = 0;
  const quelle: KlaraPolicyQuelle = {
    choice: "cloud",
    source: "default",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "Cloud-Anbieter",
    modelLabel: "cloud-modell",
    zentralFreigegeben: true,
  };
  const dienst = new KlaraSessionService({
    repo: new InMemoryKlaraSessionRepo(),
    policy: () => quelle,
    now: () => jetzt,
    newId: () => `id-${++zaehler}`,
  });
  const oeffnen = async () => {
    const sicht = await dienst.createSession("anna", "instanz-1", DOKUMENT);
    const bindung: KlaraBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: sicht.documentContextId,
    };
    return { sicht, bindung };
  };
  return {
    dienst,
    oeffnen,
    vorspulen: (ms: number) => {
      jetzt += ms;
    },
  };
}

/** Die neue Sitzung fragt wieder: kein Consent, Zustimmung anbietbar, Tor zu. */
async function fragtErneut(dienst: KlaraSessionService, sessionId: string, bindung: KlaraBindung) {
  const sicht = await dienst.getSession(sessionId, bindung);
  expect(sicht.consentState).toBe("none");
  expect(sicht.resolution.externalConsentGranted).toBe(false);
  expect(sicht.resolution.blockedReason).toBe("external_consent_missing");
  // Der Empfänger ist benannt — die Frage wird wirklich wieder gestellt, nicht bloss gesperrt.
  expect(sicht.resolution.externalConsentProvider).toBe("Cloud-Anbieter");
  const tor = await dienst.pruefeExterneAusfuehrung(sessionId, bindung);
  expect(tor.erlaubt).toBe(false);
  if (tor.erlaubt === false) {
    expect(tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
    expect(tor.deckung.gedeckt === false && tor.deckung.grund).toBe("kein_consent");
  }
}

describe("R-0590 · die Zustimmung gilt für genau eine Klara-Sitzung", () => {
  it("KALIBRIERUNG: in der Sitzung, in der zugestimmt wurde, gibt das Tor frei", async () => {
    const { dienst, oeffnen } = aufbau();
    const a = await oeffnen();
    await dienst.grantConsent(a.sicht.sessionId, a.bindung);
    const tor = await dienst.pruefeExterneAusfuehrung(a.sicht.sessionId, a.bindung);
    expect(tor.erlaubt).toBe(true);
  });

  it("nach dem Schliessen fragt die nächste Sitzung für DASSELBE Dokument erneut", async () => {
    const { dienst, oeffnen } = aufbau();
    const a = await oeffnen();
    await dienst.grantConsent(a.sicht.sessionId, a.bindung);
    await dienst.closeSession(a.sicht.sessionId, a.bindung);

    const b = await oeffnen();
    expect(b.sicht.sessionId).not.toBe(a.sicht.sessionId);
    // Dasselbe gespeicherte Dokument ergibt dieselbe Kennung — geerbt wird trotzdem nichts.
    expect(b.sicht.documentContextId).toBe(a.sicht.documentContextId);
    await fragtErneut(dienst, b.sicht.sessionId, b.bindung);
    // Die alte Sitzung trägt nichts mehr.
    const alteSitzung = dienst.pruefeExterneAusfuehrung(a.sicht.sessionId, a.bindung);
    await expect(alteSitzung).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("nach Ablauf (Inaktivität) fragt die nächste Sitzung für DASSELBE Dokument erneut", async () => {
    const { dienst, oeffnen, vorspulen } = aufbau();
    const a = await oeffnen();
    await dienst.grantConsent(a.sicht.sessionId, a.bindung);
    vorspulen(KLARA_SESSION_INACTIVITY_MS + 1);
    const alteSitzung = dienst.pruefeExterneAusfuehrung(a.sicht.sessionId, a.bindung);
    await expect(alteSitzung).rejects.toMatchObject({ code: "CONFLICT" });

    const b = await oeffnen();
    await fragtErneut(dienst, b.sicht.sessionId, b.bindung);
  });

  it("eine GLEICHZEITIG offene zweite Sitzung für dasselbe Dokument ist nicht mitgedeckt", async () => {
    const { dienst, oeffnen } = aufbau();
    const a = await oeffnen();
    const b = await oeffnen();
    await dienst.grantConsent(a.sicht.sessionId, a.bindung);

    await fragtErneut(dienst, b.sicht.sessionId, b.bindung);
    // Gegenprobe: die zustimmende Sitzung selbst bleibt frei.
    const eigene = await dienst.pruefeExterneAusfuehrung(a.sicht.sessionId, a.bindung);
    expect(eigene.erlaubt).toBe(true);
  });
});
