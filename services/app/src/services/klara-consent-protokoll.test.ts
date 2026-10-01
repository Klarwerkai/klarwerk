import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../../audit";
import { InMemoryKlaraSessionRepo } from "../../../reasoner";
import {
  KLARA_CONSENT_AUDIT_ENDED,
  KLARA_CONSENT_AUDIT_GRANTED,
  KLARA_SESSION_ABSOLUTE_MS,
  type KlaraEinwilligungsProtokoll,
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "./klara-session-service";

// ================================================================================================
// R-0609 — WER, WANN, WELCHER ANBIETER, WELCHES DOKUMENT, WELCHE DATENKLASSEN, BIS WANN, WIDERRUF
// ================================================================================================
//
// Anforderung: „Wer wann welchem Anbieter für welches Dokument die Nutzung erlaubt hat, wird mit
// Zeitpunkt, Ablauf und Widerruf protokolliert — einschliesslich der erlaubten Datenklassen. Ohne
// diesen Nachweis liesse sich später nicht belegen, dass eine Freigabe überhaupt vorlag."
//
// Die Fälle messen den Nachweis im append-only Prüfprotokoll, nicht die Zustimmungszeile — die wird
// fortgeschrieben und aufgeräumt und ist deshalb kein Beleg.

const T0 = Date.parse("2026-10-01T09:00:00.000Z");

function aufbau(protokoll?: KlaraEinwilligungsProtokoll) {
  let jetzt = T0;
  let zaehler = 0;
  let quelle: KlaraPolicyQuelle = {
    choice: "cloud",
    source: "default",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "Cloud-Anbieter",
    modelLabel: "cloud-modell",
    localProviderLabel: "Lokaler Anbieter",
    zentralFreigegeben: true,
  };
  const audit = new AuditService({ repo: new InMemoryAuditRepo(), now: () => jetzt });
  const repo = new InMemoryKlaraSessionRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => jetzt,
    newId: () => `id-${++zaehler}`,
    protokoll: protokoll ?? audit,
  });
  return {
    dienst,
    repo,
    audit,
    vorspulen: (ms: number) => {
      jetzt += ms;
    },
    umkonfigurieren: (next: Partial<KlaraPolicyQuelle>) => {
      quelle = { ...quelle, ...next };
    },
  };
}

async function sitzung(dienst: KlaraSessionService) {
  const s = await dienst.createSession("anna", "instanz-1", {
    kind: "saved",
    hostDocumentId: "word-doc-1",
  });
  return {
    sicht: s,
    bindung: {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: s.documentContextId,
    },
  };
}

describe("R-0609 · die Erteilung steht mit allen Bindungen im Prüfprotokoll", () => {
  it("wer, Dokument, Anbieter, Modell, Datenklassen, Richtlinie, Zeitpunkt und Ablauf", async () => {
    const { dienst, repo, audit } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    const consent = await repo.findConsent(sicht.sessionId);
    expect(consent?.status).toBe("granted");
    const eintraege = await audit.list({ action: KLARA_CONSENT_AUDIT_GRANTED });
    expect(eintraege).toHaveLength(1);
    const [eintrag] = eintraege;
    expect(eintrag?.actor).toBe("anna");
    expect(eintrag?.target).toBe(`klara-consent:${consent?.consentId}`);
    expect(eintrag?.payload).toMatchObject({
      consentId: consent?.consentId,
      sessionId: sicht.sessionId,
      documentContextId: sicht.documentContextId,
      providerClass: "external",
      providerReference: "Cloud-Anbieter",
      modelReference: consent?.modelReference,
      allowedPayloadClasses: [...(consent?.allowedPayloadClasses ?? [])],
      policyVersion: consent?.policyVersion,
      grantedAt: new Date(T0).toISOString(),
      expiresAt: consent?.expiresAt,
    });
    // Die Datenklassen sind nicht leer — eine leere Liste wäre kein Nachweis.
    expect((eintrag?.payload.allowedPayloadClasses as string[]).length).toBeGreaterThan(0);
    // Die Kette bleibt prüfbar.
    expect(await audit.verify()).toBe(true);
  });

  it("ohne Zustimmung (Anfrage, Status) entsteht KEIN Eintrag", async () => {
    const { dienst, audit } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.getSession(sicht.sessionId, bindung);
    const freigabe = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(freigabe.erlaubt).toBe(false);
    expect(await audit.list()).toHaveLength(0);
  });
});

describe("R-0609 · jedes Ende einer wirksamen Zustimmung steht im Prüfprotokoll", () => {
  it("Widerruf: Zeitpunkt und Art", async () => {
    const { dienst, audit, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(60_000);
    await dienst.revokeConsent(sicht.sessionId, bindung);

    const enden = await audit.list({ action: KLARA_CONSENT_AUDIT_ENDED });
    expect(enden).toHaveLength(1);
    expect(enden[0]?.payload).toMatchObject({
      status: "revoked",
      endedAt: new Date(T0 + 60_000).toISOString(),
      documentContextId: sicht.documentContextId,
      providerReference: "Cloud-Anbieter",
    });
    // Ein zweiter Widerruf beendet nichts mehr — kein erfundenes zweites Ende.
    await dienst.revokeConsent(sicht.sessionId, bindung);
    expect(await audit.list({ action: KLARA_CONSENT_AUDIT_ENDED })).toHaveLength(1);
  });

  it("Ablauf der Sitzung: als `expired` protokolliert", async () => {
    const { dienst, audit, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(KLARA_SESSION_ABSOLUTE_MS + 1);
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toThrow();
    const enden = await audit.list({ action: KLARA_CONSENT_AUDIT_ENDED });
    expect(enden.map((e) => e.payload.status)).toEqual(["expired"]);
  });

  it("Richtlinienwechsel entwertet — und das Ende steht im Protokoll", async () => {
    const { dienst, audit, umkonfigurieren } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    umkonfigurieren({ zentralFreigegeben: false });
    const freigabe = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(freigabe.erlaubt).toBe(false);
    const enden = await audit.list({ action: KLARA_CONSENT_AUDIT_ENDED });
    expect(enden.map((e) => e.payload.status)).toEqual(["invalidated"]);
  });

  it("Sitzung schliessen und Dokument umbinden beenden die Zustimmung protokolliert", async () => {
    const { dienst, audit } = aufbau();
    const a = await sitzung(dienst);
    await dienst.grantConsent(a.sicht.sessionId, a.bindung);
    await dienst.closeSession(a.sicht.sessionId, a.bindung);

    const b = await sitzung(dienst);
    await dienst.grantConsent(b.sicht.sessionId, b.bindung);
    await dienst.rebindDocumentContext(b.sicht.sessionId, b.bindung, {
      kind: "saved",
      hostDocumentId: "word-doc-2",
    });

    const enden = await audit.list({ action: KLARA_CONSENT_AUDIT_ENDED });
    expect(enden.map((e) => [e.payload.sessionId, e.payload.status])).toEqual([
      [a.sicht.sessionId, "invalidated"],
      [b.sicht.sessionId, "invalidated"],
    ]);
  });

  it("ein zweiter Grant beendet den ersten — Ende vor neuer Erteilung", async () => {
    const { dienst, audit } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const alle = await audit.list();
    expect(alle.map((e) => e.action)).toEqual([
      KLARA_CONSENT_AUDIT_GRANTED,
      KLARA_CONSENT_AUDIT_ENDED,
      KLARA_CONSENT_AUDIT_GRANTED,
    ]);
    expect(alle[1]?.payload.consentId).toBe(alle[0]?.payload.consentId);
  });
});

describe("R-0609 · keine wirksame Zustimmung ohne Nachweis (fail-closed)", () => {
  it("scheitert der Protokolleintrag, scheitert die Erteilung und die Tür bleibt zu", async () => {
    const kaputt: KlaraEinwilligungsProtokoll = {
      record: () => Promise.reject(new Error("Protokoll nicht erreichbar")),
    };
    const { dienst, repo } = aufbau(kaputt);
    const { sicht, bindung } = await sitzung(dienst);
    await expect(dienst.grantConsent(sicht.sessionId, bindung)).rejects.toThrow(
      "Protokoll nicht erreichbar",
    );
    expect((await repo.findConsent(sicht.sessionId))?.status).not.toBe("granted");
    const freigabe = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(freigabe.erlaubt).toBe(false);
  });
});
