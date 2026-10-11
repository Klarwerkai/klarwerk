import { describe, expect, it, vi } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../../audit";
import {
  InMemoryKlaraSessionRepo,
  KLARA_RESOLUTION_TTL_MS,
  type KlaraConsent,
  bindeZustimmung,
  cappedModelClient,
  imBindungsrahmen,
  resetModelSemaphoreForTests,
  withModelSlot,
} from "../../../reasoner";
import {
  KLARA_AUFGABE_ANDERER_ANBIETER,
  KLARA_CONSENT_AUDIT_ENDED,
  KLARA_CONSENT_AUDIT_GRANTED,
  KLARA_CONSENT_RECONFIRMATION_REQUIRED,
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
// fortgeschrieben und aufgeräumt und ist deshalb kein Beleg. Runde 2 ergänzt Bens Gegenproben
// B1/B2 (angehaltenes und ausgefallenes Protokoll) und B3 (Anbieter je Aufgabe) am Dienst.

const T0 = Date.parse("2026-10-01T09:00:00.000Z");

/** Ein Repo, dessen nächster Grant das Revisionsrennen verliert (Bens B1, verlorenes CAS). */
class VerlierendesRepo extends InMemoryKlaraSessionRepo {
  verliereNaechstenGrant = false;
  override grantConsent(
    sessionId: string,
    expectedRevision: number,
    consent: KlaraConsent,
  ): Promise<boolean> {
    if (this.verliereNaechstenGrant) {
      this.verliereNaechstenGrant = false;
      return Promise.resolve(false);
    }
    return super.grantConsent(sessionId, expectedRevision, consent);
  }
}

function aufbau(over: Partial<KlaraPolicyQuelle> = {}) {
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
    ...over,
  };
  const audit = new AuditService({ repo: new InMemoryAuditRepo(), now: () => jetzt });
  // Das echte Prüfprotokoll hinter einem Schalter: anhalten (B1) und ausfallen lassen (B1/B2).
  // Bens B12: `endeAusfall` lässt nur Endeinträge scheitern, `nachErteilung` hält NACH einem
  // geschriebenen Erteilungseintrag an (das Fenster vor dem Speichern der Zustimmung).
  const lage = {
    ausfall: false,
    endeAusfall: false,
    halt: null as Promise<void> | null,
    nachErteilung: null as (() => Promise<void>) | null,
  };
  const protokoll: KlaraEinwilligungsProtokoll = {
    async recordOnce(eventId, input) {
      if (lage.halt) {
        await lage.halt;
      }
      if (lage.ausfall || (lage.endeAusfall && input.action === KLARA_CONSENT_AUDIT_ENDED)) {
        throw new Error("Protokoll nicht erreichbar");
      }
      const geschrieben = await audit.recordOnce(eventId, input);
      if (input.action === KLARA_CONSENT_AUDIT_GRANTED && lage.nachErteilung) {
        await lage.nachErteilung();
      }
      return geschrieben;
    },
    exists(filter) {
      return lage.ausfall
        ? Promise.reject(new Error("Protokoll nicht erreichbar"))
        : audit.exists(filter);
    },
    list(filter) {
      return lage.ausfall
        ? Promise.reject(new Error("Protokoll nicht erreichbar"))
        : audit.list(filter);
    },
  };
  const repo = new VerlierendesRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => jetzt,
    newId: () => `id-${++zaehler}`,
    protokoll,
  });
  return {
    dienst,
    repo,
    audit,
    lage,
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

const enden = async (audit: AuditService) =>
  (await audit.list({ action: KLARA_CONSENT_AUDIT_ENDED })).map((e) => e.payload);

describe("Bens B1 · keine wirksame Zustimmung ohne Nachweis", () => {
  it("während das Protokoll schreibt, ist die Zustimmung noch nicht wirksam", async () => {
    const { dienst, repo, audit, lage } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    let freigeben: () => void = () => undefined;
    lage.halt = new Promise<void>((r) => {
      freigeben = r;
    });
    const erteilung = dienst.grantConsent(sicht.sessionId, bindung);
    await new Promise((r) => setTimeout(r, 0));
    // Gegenbeleg Fall 1: hier stand erlaubt=true bei 0 Einträgen.
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(false);
    expect((await repo.findConsent(sicht.sessionId))?.status).not.toBe("granted");
    expect(await audit.list()).toHaveLength(0);
    lage.halt = null;
    freigeben();
    await erteilung;
    expect(await audit.list({ action: KLARA_CONSENT_AUDIT_GRANTED })).toHaveLength(1);
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(true);
  });

  it("Statusabruf, Protokollausfall, abgelehnte Erteilung: keine wirksame Zustimmung bleibt", async () => {
    const { dienst, repo, audit, lage, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    vorspulen(60_000);
    await dienst.getSession(sicht.sessionId, bindung);
    lage.ausfall = true;
    await expect(dienst.grantConsent(sicht.sessionId, bindung)).rejects.toThrow(
      "Protokoll nicht erreichbar",
    );
    lage.ausfall = false;
    vorspulen(60_000);
    // Gegenbeleg Fall 2: hier stand danach consent.status=granted und erlaubt=true.
    const sicht2 = await dienst.getSession(sicht.sessionId, bindung);
    expect(sicht2.resolution.externalConsentGranted).toBe(false);
    expect((await repo.findConsent(sicht.sessionId))?.status).not.toBe("granted");
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(false);
    expect(await audit.list()).toHaveLength(0);
  });

  it('verliert das Speichern nach dem Eintrag das Rennen, sagt das Protokoll „nicht wirksam"', async () => {
    const { dienst, repo, audit } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    repo.verliereNaechstenGrant = true;
    await expect(dienst.grantConsent(sicht.sessionId, bindung)).rejects.toThrow();
    expect((await repo.findConsent(sicht.sessionId))?.status).not.toBe("granted");
    const alle = await audit.list();
    expect(alle.map((e) => e.action)).toEqual([
      KLARA_CONSENT_AUDIT_GRANTED,
      KLARA_CONSENT_AUDIT_ENDED,
    ]);
    expect(alle[1]?.payload.status).toBe("nicht_wirksam");
  });
});

describe("Bens B2 · ein Ende ohne Eintrag wird nachgetragen — mit Art und Zeit aus der Zeile", () => {
  it("Protokollausfall beim Widerruf: wirksam sofort, Eintrag beim Wiederholen nachgetragen", async () => {
    const { dienst, repo, audit, lage, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(60_000);
    lage.ausfall = true;
    await expect(dienst.revokeConsent(sicht.sessionId, bindung)).rejects.toThrow();
    // Sicherheit vor Nachweis: der Widerruf wirkt trotz Ausfall.
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("revoked");
    lage.ausfall = false;
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(false);
    vorspulen(60_000);
    // Gegenbeleg Fall 3: Wiederholung und Statusabruf liessen 0 Endeinträge.
    await dienst.revokeConsent(sicht.sessionId, bindung);
    await dienst.getSession(sicht.sessionId, bindung);
    expect(await enden(audit)).toEqual([
      expect.objectContaining({
        status: "revoked",
        // Der Zeitpunkt des WIDERRUFS, nicht der des Nachtrags.
        endedAt: new Date(T0 + 60_000).toISOString(),
      }),
    ]);
  });

  it("schon der nächste Statusabruf trägt nach", async () => {
    const { dienst, audit, lage } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    lage.ausfall = true;
    await expect(dienst.revokeConsent(sicht.sessionId, bindung)).rejects.toThrow();
    lage.ausfall = false;
    await dienst.getSession(sicht.sessionId, bindung);
    expect((await enden(audit)).map((e) => e.status)).toEqual(["revoked"]);
  });

  it("Protokollausfall beim Ablauf: der Nachtrag steht, auch wenn die Sitzung abgewiesen wird", async () => {
    const { dienst, audit, lage, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(KLARA_SESSION_ABSOLUTE_MS + 1);
    lage.ausfall = true;
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toThrow();
    lage.ausfall = false;
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toThrow();
    expect((await enden(audit)).map((e) => e.status)).toEqual(["expired"]);
  });

  it("Protokollausfall beim Ende der ersten Zustimmung (Zweitgrant): nachgetragen, nie doppelt", async () => {
    const { dienst, audit, lage } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const erste = (await audit.list())[0]?.payload.consentId;
    lage.ausfall = true;
    await expect(dienst.grantConsent(sicht.sessionId, bindung)).rejects.toThrow();
    lage.ausfall = false;
    // Die erste ist beendet, eine zweite gibt es nicht — die Tür ist zu.
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(false);
    await dienst.getSession(sicht.sessionId, bindung);
    await dienst.getSession(sicht.sessionId, bindung);
    expect(await enden(audit)).toEqual([
      expect.objectContaining({ consentId: erste, status: "invalidated" }),
    ]);
  });
});

describe("Bens B3 · die Zustimmung trägt nur Aufgaben am selben Anbieter", () => {
  const karte = { answer: "anthropic", assist: "openai", structure: "anthropic", global: "openai" };

  it("gleicher Anbieter trägt, anderer Anbieter nicht — mit benanntem Grund", async () => {
    const { dienst } = aufbau({ aufgabenAnbieter: karte });
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const pruefe = (aufgabe: "answer" | "structure" | "assist" | "global") =>
      dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung, aufgabe);
    expect((await pruefe("answer")).erlaubt).toBe(true);
    expect((await pruefe("structure")).erlaubt).toBe(true);
    const assist = await pruefe("assist");
    expect(assist.erlaubt).toBe(false);
    expect(assist.erlaubt ? null : assist.grund).toBe(KLARA_AUFGABE_ANDERER_ANBIETER);
    expect((await pruefe("global")).erlaubt).toBe(false);
  });

  it("ohne Karte trägt die Zustimmung ausschliesslich `answer`", async () => {
    const { dienst } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(true);
    expect(
      (await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung, "assist")).erlaubt,
    ).toBe(false);
  });

  it("ein Anbieterwechsel einer anderen Aufgabe entwertet die Zustimmung — protokolliert", async () => {
    const { dienst, audit, umkonfigurieren } = aufbau({
      aufgabenAnbieter: { ...karte, assist: "anthropic" },
    });
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    umkonfigurieren({ aufgabenAnbieter: { ...karte, assist: "openai" } });
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).erlaubt).toBe(false);
    expect((await dienst.getSession(sicht.sessionId, bindung)).consentState).toBe("invalidated");
    expect((await enden(audit)).map((e) => e.status)).toEqual(["invalidated"]);
  });
});

describe("Bens B2 (Runde 2) · das Aufräumen löscht keinen Nachweis", () => {
  const TAGE_32 = 32 * 24 * 60 * 60 * 1000;

  it("Widerruf bei Protokollausfall, danach KEIN Zugriff, dann Aufräumen: der Endeintrag steht", async () => {
    const { dienst, repo, audit, lage, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(60_000);
    lage.ausfall = true;
    await expect(dienst.revokeConsent(sicht.sessionId, bindung)).rejects.toThrow();
    lage.ausfall = false;
    // Bens Gegenbeleg: Uhr 32 Tage vor, KEIN Sitzungszugriff, Aufräumen.
    vorspulen(TAGE_32);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect(await repo.findSession(sicht.sessionId)).toBeUndefined();
    expect(await enden(audit)).toEqual([
      expect.objectContaining({
        status: "revoked",
        // Der ursprüngliche Zeitpunkt des Widerrufs — nicht der des Aufräumens.
        endedAt: new Date(T0 + 60_000).toISOString(),
      }),
    ]);
  });

  it("eine nie berührte, noch `granted` stehende Zustimmung wird als abgelaufen nachgetragen", async () => {
    const { dienst, audit, repo, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const ablauf = (await repo.findConsent(sicht.sessionId))?.expiresAt;
    vorspulen(TAGE_32);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect(await enden(audit)).toEqual([
      expect.objectContaining({ status: "expired", endedAt: ablauf }),
    ]);
  });

  it("ist das Protokoll beim Aufräumen nicht erreichbar, wird NICHTS gelöscht", async () => {
    const { dienst, repo, audit, lage, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    lage.ausfall = true;
    await expect(dienst.revokeConsent(sicht.sessionId, bindung)).rejects.toThrow();
    vorspulen(TAGE_32);
    await expect(dienst.raeumeAbgelaufeneAuf()).rejects.toThrow("Protokoll nicht erreichbar");
    expect(await repo.findSession(sicht.sessionId)).toBeDefined();
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("revoked");
    // Der nächste Lauf holt beides nach.
    lage.ausfall = false;
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect((await enden(audit)).map((e) => e.status)).toEqual(["revoked"]);
  });

  it("ein schon vorhandener Endeintrag wird beim Aufräumen nicht verdoppelt", async () => {
    const { dienst, audit, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    await dienst.revokeConsent(sicht.sessionId, bindung);
    vorspulen(TAGE_32);
    await dienst.raeumeAbgelaufeneAuf();
    expect(await enden(audit)).toHaveLength(1);
  });
});

// ================================================================================================
// Lauf 3 · Bens B12 — DIE NIE WIRKSAME ERTEILUNG VERLIERT IHREN ABSCHLUSS NICHT.
// ================================================================================================
//
// Bens Fehlerkombination: Erteilungseintrag steht, ein Umbinden gewinnt das Revisionsrennen, das
// Speichern der Zustimmung scheitert (CONFLICT), und der Endeintrag `nicht_wirksam` fällt aus. Eine
// Zustimmungszeile, aus der nachgetragen werden könnte, gibt es nicht.

describe("Bens B12 · abgelehnte Erteilung bei Protokollausfall: der Abschluss wird dauerhaft nachgeholt", () => {
  const TAGE_32 = 32 * 24 * 60 * 60 * 1000;

  /** Erteilung, die nach ihrem Eintrag ein echtes Umbinden verliert — Endeintrag fällt aus. */
  async function verloreneErteilung() {
    const a = aufbau();
    const { sicht, bindung } = await sitzung(a.dienst);
    let weiter: () => void = () => undefined;
    let erreicht: () => void = () => undefined;
    const steht = new Promise<void>((r) => {
      erreicht = r;
    });
    a.lage.nachErteilung = () => {
      a.lage.nachErteilung = null;
      erreicht();
      return new Promise<void>((r) => {
        weiter = r;
      });
    };
    a.lage.endeAusfall = true;
    const erteilung = a.dienst.grantConsent(sicht.sessionId, bindung).catch((e) => e);
    await steht;
    const neu = await a.dienst.rebindDocumentContext(sicht.sessionId, bindung, {
      kind: "saved",
      hostDocumentId: "word-doc-neu",
    });
    weiter();
    expect((await erteilung).code).toBe("CONFLICT");
    expect(await a.repo.alleConsents(sicht.sessionId)).toHaveLength(0);
    expect(await enden(a.audit)).toEqual([]);
    a.lage.endeAusfall = false;
    const neueBindung = { ...bindung, documentContextId: neu.documentContextId };
    const [erteilt] = await a.audit.list({ action: KLARA_CONSENT_AUDIT_GRANTED });
    return { ...a, sicht, neueBindung, erteilt };
  }

  it("Status, Tor und Aufräumen nach 32 Tagen: genau ein Endeintrag `nicht_wirksam`", async () => {
    const { dienst, repo, audit, sicht, neueBindung, erteilt, vorspulen } =
      await verloreneErteilung();
    await dienst.getSession(sicht.sessionId, neueBindung);
    expect((await dienst.pruefeExterneAusfuehrung(sicht.sessionId, neueBindung)).erlaubt).toBe(
      false,
    );
    vorspulen(TAGE_32);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect(await repo.findSession(sicht.sessionId)).toBeUndefined();
    expect(await enden(audit)).toEqual([
      expect.objectContaining({
        consentId: erteilt?.payload.consentId,
        sessionId: sicht.sessionId,
        status: "nicht_wirksam",
        // Wirksam war sie zu keinem Zeitpunkt: das Ende ist der Erteilungsversuch selbst.
        endedAt: erteilt?.payload.grantedAt,
        nachgetragenAt: new Date(T0 + TAGE_32).toISOString(),
      }),
    ]);
    // Ein zweiter Lauf erfindet nichts dazu.
    await dienst.raeumeAbgelaufeneAuf();
    expect(await enden(audit)).toHaveLength(1);
    expect(await audit.verify()).toBe(true);
  });

  it("fällt das Protokoll auch beim Aufräumen aus, wird nichts gelöscht — der nächste Lauf holt nach", async () => {
    const { dienst, repo, audit, lage, sicht, vorspulen } = await verloreneErteilung();
    vorspulen(TAGE_32);
    lage.endeAusfall = true;
    await expect(dienst.raeumeAbgelaufeneAuf()).rejects.toThrow("Protokoll nicht erreichbar");
    expect(await repo.findSession(sicht.sessionId)).toBeDefined();
    lage.endeAusfall = false;
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect((await enden(audit)).map((e) => e.status)).toEqual(["nicht_wirksam"]);
  });

  it("GEGENPROBE: eine wirksam gespeicherte Zustimmung wird beim Aufräumen nie `nicht_wirksam`", async () => {
    const { dienst, audit, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    await dienst.revokeConsent(sicht.sessionId, bindung);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(TAGE_32);
    expect(await dienst.raeumeAbgelaufeneAuf()).toBe(1);
    expect((await enden(audit)).map((e) => e.status).sort()).toEqual(["expired", "revoked"]);
  });
});

// ================================================================================================
// Lauf 2 · Bens B5 — EIN ABGESCHLOSSENER WIDERRUF TRÄGT AUCH IN DIE SCHON LAUFENDE PRÜFUNG.
// ================================================================================================

describe("Bens B5 · Widerruf während der Freigabeprüfung", () => {
  it("die Freigabe liefert `giltNoch` — `true` bis zum Widerruf, danach `false`", async () => {
    const { dienst } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const freigabe = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(freigabe.erlaubt).toBe(true);
    const giltNoch = freigabe.erlaubt ? freigabe.giltNoch : () => true;
    expect(giltNoch()).toBe(true);
    await dienst.revokeConsent(sicht.sessionId, bindung);
    expect(giltNoch()).toBe(false);
  });

  it("die Zeile wurde VOR dem Widerruf gelesen, der Widerruf schliesst ab: das Tor sperrt", async () => {
    const { dienst, repo } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    // Halt an der ZWEITEN `findConsent`-Lesung — der des Tors (die erste liest `laden`).
    const echt = repo.findConsent.bind(repo);
    let zaehler = 0;
    let erreicht: () => void = () => undefined;
    let weiter: () => void = () => undefined;
    const amHalt = new Promise<void>((r) => {
      erreicht = r;
    });
    const fortsetzen = new Promise<void>((r) => {
      weiter = r;
    });
    repo.findConsent = async (id: string) => {
      const wert = await echt(id);
      if (++zaehler === 2) {
        erreicht();
        await fortsetzen;
      }
      return wert;
    };
    const laufend = dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    await amHalt;
    await dienst.revokeConsent(sicht.sessionId, bindung);
    weiter();
    const freigabe = await laufend;
    expect(freigabe.erlaubt).toBe(false);
    expect(freigabe.erlaubt ? null : freigabe.grund).toBe(KLARA_CONSENT_RECONFIRMATION_REQUIRED);
  });
});

// ================================================================================================
// Lauf 2 · Bens B6 — DIE FREIGABE ENDET MIT DER SITZUNG, AUCH OHNE WEITEREN SITZUNGSZUGRIFF.
// ================================================================================================

describe("Bens B6 · `giltNoch` endet mit Sitzung und Zustimmung", () => {
  const MINUTE = 60 * 1000;

  it("absolute Acht-Stunden-Grenze: Tor 1 ms davor erlaubt, 2 ms später trägt die Freigabe nicht mehr", async () => {
    const { dienst, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    // Durch reguläre Aktivität bis kurz vor die absolute Grenze aktiv gehalten. R-0777: seit der
    // Statusabruf nicht mehr berührt, hält nur der Aktivitätsweg die gleitende Frist am Leben —
    // über `getSession` liefe die Sitzung hier nach 15 min ab, bevor die Grenze erreicht ist.
    let vergangen = 0;
    while (vergangen + 10 * MINUTE < KLARA_SESSION_ABSOLUTE_MS - MINUTE) {
      vorspulen(10 * MINUTE);
      vergangen += 10 * MINUTE;
      await dienst.meldeAktivitaet(sicht.sessionId, bindung);
    }
    vorspulen(KLARA_SESSION_ABSOLUTE_MS - 1 - vergangen);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const freigabe = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(freigabe.erlaubt, "1 ms vor der Grenze trägt das Tor").toBe(true);
    const giltNoch = freigabe.erlaubt ? freigabe.giltNoch : () => true;
    expect(giltNoch()).toBe(true);
    vorspulen(2);
    expect(giltNoch(), "nach dem Sitzungsende keine Übertragung mehr").toBe(false);
    await expect(dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung)).rejects.toThrow(
      "abgelaufen",
    );
  });
});

// ================================================================================================
// Lauf 2 · Bens B8 — AUCH DIE AUFLÖSUNGSFRIST (grantedAt + KLARA_RESOLUTION_TTL_MS) BEENDET DEN LAUF.
// ================================================================================================
//
// Bens Gegenbeleg: Tor bei T0 + 5 min − 1 ms erlaubt; die Anfrage wartet im Modell-Semaphore; die
// Uhr rückt 2 ms vor — `giltNoch()` blieb `true` und der Transport wurde einmal gerufen, während
// eine neue Torprüfung dieselbe Zustimmung schon mit `aufloesung_abgelaufen` zurückwies.

describe("Bens B8 · die Laufbindung kennt dieselben Fristen wie die Deckungsprüfung", () => {
  it("am Dienst: 1 ms vor der Auflösungsfrist erlaubt, 2 ms später trägt `giltNoch` nicht mehr", async () => {
    const { dienst, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(KLARA_RESOLUTION_TTL_MS - 1);
    const freigabe = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(freigabe.erlaubt).toBe(true);
    const giltNoch = freigabe.erlaubt ? freigabe.giltNoch : () => true;
    expect(giltNoch()).toBe(true);
    vorspulen(2);
    expect(giltNoch(), "dieselbe Grenze wie die Deckungsprüfung").toBe(false);
    // Die neue Torprüfung sagt dasselbe — beide Stellen laufen nicht mehr auseinander.
    const neu = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(neu.erlaubt).toBe(false);
    const grund = neu.erlaubt || neu.deckung.gedeckt ? null : neu.deckung.grund;
    expect(grund).toBe("aufloesung_abgelaufen");
  });

  describe("über den echten Chokepoint: Freigabe des Dienstes, gecappter Client, Warten im Slot", () => {
    const MAX = process.env.KLARWERK_MODEL_MAX_INFLIGHT;

    async function wartenderLauf() {
      const k = aufbau();
      const { sicht, bindung } = await sitzung(k.dienst);
      await k.dienst.grantConsent(sicht.sessionId, bindung);
      k.vorspulen(KLARA_RESOLUTION_TTL_MS - 1);
      const freigabe = await k.dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
      expect(freigabe.erlaubt).toBe(true);
      process.env.KLARWERK_MODEL_MAX_INFLIGHT = "1";
      resetModelSemaphoreForTests();
      const transport = vi.fn(async () => "Antwort");
      const client = cappedModelClient(
        { name: "anthropic:claude", complete: transport },
        { rejectsConfidential: true },
      );
      let freigeben: () => void = () => undefined;
      const belegt = withModelSlot(
        () =>
          new Promise<void>((r) => {
            freigeben = r;
          }),
      );
      const lauf = imBindungsrahmen(() => {
        if (freigabe.erlaubt) {
          bindeZustimmung(freigabe.giltNoch);
        }
        return client.complete("system", "user", false);
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(transport, "der Lauf wartet im Semaphore").not.toHaveBeenCalled();
      return {
        transport,
        lauf,
        vorspulen: k.vorspulen,
        weiter: async () => {
          freigeben();
          await belegt;
        },
      };
    }

    function aufraeumen(): void {
      if (MAX === undefined) {
        delete process.env.KLARWERK_MODEL_MAX_INFLIGHT;
      } else {
        process.env.KLARWERK_MODEL_MAX_INFLIGHT = MAX;
      }
      resetModelSemaphoreForTests();
    }

    it("KALIBRIERUNG: innerhalb der Frist überträgt der wartende Lauf genau einmal", async () => {
      try {
        const k = await wartenderLauf();
        await k.weiter();
        await expect(k.lauf).resolves.toBe("Antwort");
        expect(k.transport).toHaveBeenCalledTimes(1);
      } finally {
        aufraeumen();
      }
    });

    it("die Auflösungsfrist läuft während des Wartens ab: der Transport wird NICHT gerufen", async () => {
      try {
        const k = await wartenderLauf();
        k.vorspulen(2);
        await k.weiter();
        await expect(k.lauf).rejects.toThrow("keine externe Übertragung");
        expect(k.transport).not.toHaveBeenCalled();
      } finally {
        aufraeumen();
      }
    });
  });
});
