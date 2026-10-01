import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../../audit";
import { InMemoryKlaraSessionRepo, type KlaraConsent } from "../../../reasoner";
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
  const lage = { ausfall: false, halt: null as Promise<void> | null };
  const protokoll: KlaraEinwilligungsProtokoll = {
    async recordOnce(eventId, input) {
      if (lage.halt) {
        await lage.halt;
      }
      if (lage.ausfall) {
        throw new Error("Protokoll nicht erreichbar");
      }
      return audit.recordOnce(eventId, input);
    },
    exists(filter) {
      return lage.ausfall
        ? Promise.reject(new Error("Protokoll nicht erreichbar"))
        : audit.exists(filter);
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
