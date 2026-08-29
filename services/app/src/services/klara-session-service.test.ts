import { describe, expect, it } from "vitest";
import { InMemoryKlaraSessionRepo } from "../../../reasoner";
import {
  KLARA_SESSION_ABSOLUTE_MS,
  KLARA_SESSION_CONFLICT_MESSAGE,
  KLARA_SESSION_INACTIVITY_MS,
  KLARA_SINGLE_TENANT_ID,
  KLARA_TOUCH_MINDESTABSTAND_MS,
  type KlaraDocumentDescriptor,
  type KlaraPolicyQuelle,
  KlaraSessionService,
  pruefeConsentDeckung,
} from "./klara-session-service";

// ================================================================================================
// W1 S4 R2 — SITZUNG, DOKUMENTKONTEXT UND ZUSTIMMUNG (BEN ROT-2 bis ROT-5)
// ================================================================================================
//
// Jede Beschreibung hier hat ein benanntes Gegenstück in `BERICHT-BEN-W1-S4-R1-NACHPRUEFUNG-13`.
// Die Fälle prüfen die KORREKTUREN — nicht, dass der Code tut, was er tut.

const T0 = Date.parse("2026-08-02T09:00:00.000Z");

const GESPEICHERT: KlaraDocumentDescriptor = {
  kind: "saved",
  hostDocumentId: "word-doc-1",
};

function aufbau(over: Partial<KlaraPolicyQuelle> = {}, eigenesRepo?: InMemoryKlaraSessionRepo) {
  let jetzt = T0;
  let zaehler = 0;
  let quelle: KlaraPolicyQuelle = {
    choice: "deterministic",
    source: "default",
    effectiveAnswerProvider: "deterministic",
    cloudConfigured: false,
    localConfigured: false,
    providerLabel: "Cloud-Anbieter",
    modelLabel: "cloud-modell",
    localProviderLabel: "Lokaler Anbieter",
    ...over,
  };
  const repo = eigenesRepo ?? new InMemoryKlaraSessionRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => jetzt,
    newId: () => `id-${++zaehler}`,
  });
  return {
    dienst,
    repo,
    vorspulen: (ms: number) => {
      jetzt += ms;
    },
    umkonfigurieren: (next: Partial<KlaraPolicyQuelle>) => {
      quelle = { ...quelle, ...next };
    },
  };
}

/** Eine Instanz, auf der die effektive Answer-Bindung wirklich extern ist. */
function externAufbau() {
  return aufbau({ choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" });
}

async function sitzung(dienst: KlaraSessionService) {
  const s = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
  return {
    sicht: s,
    bindung: {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: s.documentContextId,
    },
  };
}

// ================================================================================================
// BEN ROT-1 — Anbieter und Modell aus der EFFEKTIVEN Answer-Bindung
// ================================================================================================

describe("W1 S4 R2 · ROT-1 · Anbieter und Modell folgen der effektiven Answer-Bindung", () => {
  it("Cloud UND Local verdrahtet, Admin `answer=local` ⇒ internal MIT lokalem Anbieter", async () => {
    // BENs Gegenprobe, wörtlich: reportedProvider war "BEN Cloud Provider", erwartet war der
    // lokale. Genau dieser Fall.
    const { dienst } = aufbau({
      choice: "local",
      cloudConfigured: true,
      localConfigured: true,
      effectiveAnswerProvider: "local",
      providerLabel: "BEN Cloud Provider",
      modelLabel: "cloud-modell",
      localProviderLabel: "BEN Local Provider",
    });
    const { sicht } = await sitzung(dienst);
    expect(sicht.resolution.effectiveMode).toBe("internal");
    expect(sicht.resolution.provider).toBe("BEN Local Provider");
    expect(sicht.resolution.model).toBe("BEN Local Provider");
    expect(sicht.resolution.provider).not.toBe("BEN Cloud Provider");
    // Und die Anzeige weicht nicht ab: gewünscht = effektiv.
    expect(sicht.resolution.adminConfiguredMode).toBe("internal");
    expect(sicht.resolution.deviation).toBe(false);
  });

  it("Cloud verdrahtet und effektiv `cloud` ⇒ external mit Cloud-Anbieter, aber blockiert", async () => {
    const { dienst } = externAufbau();
    const { sicht } = await sitzung(dienst);
    expect(sicht.resolution.effectiveMode).toBe("external");
    expect(sicht.resolution.executionAllowed).toBe(false);
    expect(sicht.resolution.blockedReason).toBe("external_not_migrated");
  });

  it("effektiv `deterministic` trotz Admin-Wunsch `cloud` ⇒ benannter Abweichungsgrund", async () => {
    const { dienst } = aufbau({
      choice: "cloud",
      cloudConfigured: false,
      effectiveAnswerProvider: "deterministic",
    });
    const { sicht } = await sitzung(dienst);
    expect(sicht.resolution.effectiveMode).toBe("deterministic");
    expect(sicht.resolution.deviation).toBe(true);
    expect(sicht.resolution.deviationReason).toBe("external_not_configured");
  });
});

// ================================================================================================
// BEN ROT-2 — eine kanonische, persistierte resolutionId
// ================================================================================================

describe("W1 S4 R2 · ROT-2 · dieselbe Resolution über Create, GET, Grant, Revoke", () => {
  it("zwei Auskünfte liefern DIESELBE resolutionId — nicht bei jedem GET eine neue", async () => {
    // R1 schrieb das Gegenteil als Soll fest. Genau diese Zusicherung ist umgedreht.
    const { dienst } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const a = await dienst.getSession(sicht.sessionId, bindung);
    const b = await dienst.getSession(sicht.sessionId, bindung);
    expect(a.resolution.resolutionId).toBe(sicht.resolution.resolutionId);
    expect(b.resolution.resolutionId).toBe(a.resolution.resolutionId);
  });

  it("die Sitzung PERSISTIERT die resolutionId — sie überlebt einen neuen Dienst am selben Repo", async () => {
    const { dienst, repo } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const gespeichert = await repo.findSession(sicht.sessionId);
    expect(gespeichert?.resolutionId).toBe(sicht.resolution.resolutionId);

    // Neustart: neuer Dienst, dieselbe Ablage.
    let zaehler = 100;
    const zweiter = new KlaraSessionService({
      repo,
      policy: () => ({
        choice: "deterministic",
        source: "default",
        effectiveAnswerProvider: "deterministic",
        cloudConfigured: false,
        localConfigured: false,
        providerLabel: "Cloud-Anbieter",
        modelLabel: "cloud-modell",
        localProviderLabel: "Lokaler Anbieter",
      }),
      now: () => T0 + 1000,
      newId: () => `neu-${++zaehler}`,
    });
    const nachNeustart = await zweiter.getSession(sicht.sessionId, bindung);
    expect(nachNeustart.resolution.resolutionId).toBe(sicht.resolution.resolutionId);
  });

  it("Consent trägt DIESELBE resolutionId wie Sitzung und Status", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const nach = await dienst.grantConsent(sicht.sessionId, bindung);
    const consent = await repo.findConsent(sicht.sessionId);
    expect(consent?.resolutionId).toBe(nach.resolution.resolutionId);
    const session = await repo.findSession(sicht.sessionId);
    expect(session?.resolutionId).toBe(nach.resolution.resolutionId);
  });
});

describe("W1 S4 R2 · ROT-2/Pflichtkorrektur 3 · Policywechsel ohne Versionsmix", () => {
  it("ein Wechsel VOR dem Grant bindet kontrolliert neu — Sitzung, Consent und Status einig", async () => {
    // BEN: Sitzung behielt die alte Version, Consent trug die neue, die Resolution wieder die
    // neue. Genau dieser Versionsmix darf nicht mehr entstehen.
    const { dienst, repo, umkonfigurieren } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const alteResolution = sicht.resolution.resolutionId;

    umkonfigurieren({ source: "db" });
    const nach = await dienst.grantConsent(sicht.sessionId, bindung);

    // Neue Identität, weil die Grundlage wechselte — kontrolliert, nicht gemischt.
    expect(nach.resolution.resolutionId).not.toBe(alteResolution);
    const session = await repo.findSession(sicht.sessionId);
    const consent = await repo.findConsent(sicht.sessionId);
    expect(session?.policyVersion).toBe(nach.resolution.policyVersion);
    expect(consent?.policyVersion).toBe(nach.resolution.policyVersion);
    expect(session?.resolutionId).toBe(nach.resolution.resolutionId);
    expect(consent?.resolutionId).toBe(nach.resolution.resolutionId);
  });

  it("ein Wechsel NACH dem Grant entwertet die Zustimmung persistent", async () => {
    const { dienst, repo, umkonfigurieren } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    umkonfigurieren({ providerLabel: "Ein anderer Anbieter" });
    const nach = await dienst.getSession(sicht.sessionId, bindung);
    expect(nach.consentState).toBe("invalidated");
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("invalidated");
  });

  it("bleibt die Grundlage gleich, bleibt die Resolution stabil", async () => {
    const { dienst, vorspulen } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    vorspulen(60_000);
    const nach = await dienst.getSession(sicht.sessionId, bindung);
    expect(nach.consentState).toBe("granted");
    expect(nach.resolution.resolutionId).toBe(sicht.resolution.resolutionId);
  });
});

// ================================================================================================
// BEN ROT-3 — Ablauf persistiert; höchstens ein wirksamer Consent
// ================================================================================================

describe("W1 S4 R2 · ROT-3 · Ablauf hinterlässt keinen wirksamen `granted`-Zustand", () => {
  it("nach Ablauf sind Sitzung UND Consent persistent entwertet — nicht nur der Request blockiert", async () => {
    // BEN: {"sessionConsentState":"granted","consentStatus":"granted"} nach Ablauf.
    const { dienst, repo, vorspulen } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    vorspulen(KLARA_SESSION_INACTIVITY_MS + 1);
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    // Der GESPEICHERTE Nachweis ist jetzt wahr.
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("expired");
    expect((await repo.findSession(sicht.sessionId))?.consentState).toBe("expired");
  });

  it("auch ohne Zustimmung wird der Ablauf am Sitzungszustand sichtbar", async () => {
    const { dienst, repo, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    vorspulen(KLARA_SESSION_INACTIVITY_MS + 1);
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect((await repo.findSession(sicht.sessionId))?.consentState).toBe("expired");
  });
});

describe("W1 S4 R2 · ROT-3 · höchstens EIN wirksamer Consent je Sitzung", () => {
  it("ein zweiter Grant entwertet den ersten — nie zwei `granted`", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    await dienst.grantConsent(sicht.sessionId, bindung);

    const alle = await repo.alleConsents(sicht.sessionId);
    expect(alle.filter((c) => c.status === "granted")).toHaveLength(1);
    expect(alle).toHaveLength(2);
  });

  // W1 S4 R4 (KW-S4-21 §3 und §8 Gegenprobe 3) — DIESE ZUSAGE IST SCHÄRFER GEWORDEN.
  //
  // Bis R3 liefen beide parallelen Grants durch und der zweite entwertete den ersten still; geprüft
  // war nur, dass am Ende genau eine `granted`-Zeile steht. Der Architekturentscheid verlangt jetzt
  // mehr: „genau ein Übergang gewinnt; Verlierer erhält Konflikt" — und ausdrücklich KEINEN
  // automatischen Wiederholversuch für Grant. Der Fall prüft deshalb beides, das Ergebnis UND die
  // Auskunft an den Verlierer. Eine Zustimmung, die der Server stillschweigend verwirft, wäre für
  // den Aufrufer nicht von einer erteilten zu unterscheiden.
  it("zwei PARALLELE Grants: genau einer gewinnt, der Verlierer erhält einen Konflikt", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const ergebnisse = await Promise.allSettled([
      dienst.grantConsent(sicht.sessionId, bindung),
      dienst.grantConsent(sicht.sessionId, bindung),
    ]);
    expect(ergebnisse.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    const verloren = ergebnisse.find((e) => e.status === "rejected");
    expect((verloren as PromiseRejectedResult).reason).toMatchObject({
      code: "CONFLICT",
      internalCode: "KLARA_SESSION_CONFLICT",
    });
    const alle = await repo.alleConsents(sicht.sessionId);
    expect(alle.filter((c) => c.status === "granted")).toHaveLength(1);
    // Der Verlierer hat NICHTS hinterlassen — kein zweiter Datensatz, keine halbe Zustimmung.
    expect(alle).toHaveLength(1);
  });

  it("bei IDENTISCHEM Zeitstempel ist die Auswahl deterministisch, nicht zufällig", async () => {
    // BEN: `ORDER BY granted_at DESC LIMIT 1` ist bei gleichem Zeitstempel nicht deterministisch.
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    await dienst.grantConsent(sicht.sessionId, bindung); // dieselbe eingefrorene Uhr

    const a = await repo.findConsent(sicht.sessionId);
    const b = await repo.findConsent(sicht.sessionId);
    expect(a?.consentId).toBe(b?.consentId);
    expect(a?.status).toBe("granted");
  });
});

// ================================================================================================
// BEN ROT-4 — gleitende Inaktivitätsfrist mit absoluter Obergrenze
// ================================================================================================

describe("W1 S4 R2 · ROT-4 · die Inaktivitätsfrist gleitet", () => {
  it("Benutzung nach zehn Minuten verlängert die Frist — BENs Zeitgegenprobe", async () => {
    // BEN: {"lastActivityUnchanged":true,"failedSixMinutesAfterActivity":true}
    const { dienst, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);

    vorspulen(10 * 60 * 1000);
    const nachZehn = await dienst.getSession(sicht.sessionId, bindung);
    expect(Date.parse(nachZehn.lastActivityAt)).toBe(T0 + 10 * 60 * 1000);
    expect(Date.parse(nachZehn.expiresAt)).toBeGreaterThan(Date.parse(sicht.expiresAt));

    // Sechs Minuten später: früher rot, jetzt gültig.
    vorspulen(6 * 60 * 1000);
    await expect(dienst.getSession(sicht.sessionId, bindung)).resolves.toBeTruthy();
  });

  it("die absolute Maximaldauer begrenzt die Verlängerung — auch bei dauernder Benutzung", async () => {
    // Die Sitzung wird DURCHGEHEND benutzt: die Inaktivitätsfrist läuft nie ab. Genau so wird
    // sichtbar, dass die absolute Obergrenze trotzdem greift — sonst wäre eine ununterbrochen
    // benutzte Sitzung unbegrenzt gültig, und die zweite Hälfte der Architekturregel wäre tot.
    const { dienst, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const schritt = KLARA_SESSION_INACTIVITY_MS - 60_000;

    let letzte = sicht;
    for (
      let verstrichen = 0;
      verstrichen + schritt < KLARA_SESSION_ABSOLUTE_MS;
      verstrichen += schritt
    ) {
      vorspulen(schritt);
      letzte = await dienst.getSession(sicht.sessionId, bindung);
    }
    // Die Frist ist an der absoluten Grenze gedeckelt, nicht bei lastActivity + 15 Minuten.
    expect(Date.parse(letzte.expiresAt)).toBe(T0 + KLARA_SESSION_ABSOLUTE_MS);

    // Und jenseits der Grenze ist Schluss, obwohl gerade eben noch benutzt wurde.
    vorspulen(schritt);
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("auch der Widerruf schreibt die Frist fort", async () => {
    const { dienst, vorspulen } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    vorspulen(5 * 60 * 1000);
    const nach = await dienst.revokeConsent(sicht.sessionId, bindung);
    expect(Date.parse(nach.expiresAt)).toBeGreaterThan(Date.parse(sicht.expiresAt));
  });
});

// ================================================================================================
// BEN ROT-5 / S4-20 — Dokumentkontext wird serverseitig registriert
// ================================================================================================

describe("W1 S4 R2 · ROT-5 · der Dokumentkontext ist serverseitig, nicht clientgewählt", () => {
  it("ein GESPEICHERTES Dokument bekommt eine stabile, abgeleitete Id — nicht die URL", async () => {
    const { dienst } = aufbau();
    const a = await dienst.createSession("anna", "instanz-1", {
      kind: "saved",
      canonicalUrl: "https://contoso.sharepoint.com/doc-42.docx",
    });
    const b = await dienst.createSession("anna", "instanz-2", {
      kind: "saved",
      canonicalUrl: "https://contoso.sharepoint.com/doc-42.docx",
    });
    expect(a.documentContextId).toBe(b.documentContextId);
    expect(a.documentContextId).not.toContain("contoso");
    expect(a.documentContextId).toMatch(/^doc-s-/);
  });

  it("ein UNGESPEICHERTES Dokument bekommt eine temporäre Id je Registrierung", async () => {
    const { dienst } = aufbau();
    const a = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-1",
    });
    const b = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-1",
    });
    expect(a.documentContextId).toMatch(/^doc-t-/);
    // Temporär heisst temporär: dieselbe Nonce ergibt KEINE stabile Identität.
    expect(a.documentContextId).not.toBe(b.documentContextId);
  });

  it("ein Descriptor ohne Merkmal wird abgelehnt", async () => {
    const { dienst } = aufbau();
    await expect(
      dienst.createSession("anna", "instanz-1", { kind: "saved" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      dienst.createSession("anna", "instanz-1", { kind: "unsaved", clientDocumentNonce: "  " }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("der Rebind invalidiert alte Resolution UND Zustimmung (S4-20 §5)", async () => {
    const { dienst, repo } = externAufbau();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-1",
    });
    const bindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.grantConsent(start.sessionId, bindung);

    const nach = await dienst.rebindDocumentContext(start.sessionId, bindung, {
      kind: "saved",
      hostDocumentId: "jetzt-gespeichert",
    });
    expect(nach.documentContextId).not.toBe(start.documentContextId);
    expect(nach.documentContextId).toMatch(/^doc-s-/);
    expect(nach.resolution.resolutionId).not.toBe(start.resolution.resolutionId);
    expect(nach.consentState).toBe("invalidated");
    expect((await repo.findConsent(start.sessionId))?.status).toBe("invalidated");
  });

  it("nach dem Rebind trägt die ALTE Dokumentbindung nicht mehr", async () => {
    const { dienst } = aufbau();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-1",
    });
    const alteBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
      kind: "saved",
      hostDocumentId: "jetzt-gespeichert",
    });
    await expect(dienst.getSession(start.sessionId, alteBindung)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("W1 S4 R2 · die Bindung trägt weiterhin", () => {
  it("fremder Actor, fremde Instanz und fremdes Dokument scheitern gleichförmig", async () => {
    const { dienst } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    for (const fremd of [
      { ...bindung, actorId: "bernd" },
      { ...bindung, addinInstanceId: "instanz-2" },
      { ...bindung, documentContextId: "doc-s-fremd" },
    ]) {
      await expect(dienst.getSession(sicht.sessionId, fremd)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
  });

  it("Zustimmung bleibt auf `external` beschränkt", async () => {
    const { dienst } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await expect(dienst.grantConsent(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("Sitzung ohne Instanzkennung wird abgelehnt", async () => {
    const { dienst } = aufbau();
    await expect(dienst.createSession("anna", "  ", GESPEICHERT)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("der Mandant ist der offen benannte Einzelmandantenwert", async () => {
    const { dienst } = aufbau();
    const { sicht } = await sitzung(dienst);
    expect(sicht.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
  });
});

// ================================================================================================
// W1 S4 R4 — DIE NEUN GEGENPROBEN AUS KW-S4-21 §8, IN-MEMORY
// ================================================================================================
//
// WARUM SIE HIER STEHEN, OBWOHL SIE AUCH GEGEN POSTGRESQL LAUFEN. §8 verlangt beides ausdrücklich:
// „Echt gegen PostgreSQL sowie mit InMemory-Paritaet". Genau diese Doppelung war die Lücke, an der
// R3 durchkam — die In-Memory-Ablage ersetzte damals die vollständige Struktur und KONNTE einen
// Lost Update gar nicht zeigen. Sie trägt jetzt dieselbe Revisionsprüfung, und diese Fälle belegen
// das, statt es zu behaupten.
//
// DER TAKT IST DETERMINISTISCH, OHNE `sleep`: der zweite Übergang läuft VOLLSTÄNDIG, während der
// erste seinen bereits gelesenen Stand noch in der Hand hält. Genau das ist BENs Reihenfolge — nur
// ohne Container, weil hier die Ablage und nicht die Datenbank geprüft wird.
describe("W1 S4 R4 · KW-S4-21 §8 · Nebenlaeufigkeit gegen die In-Memory-Ablage", () => {
  /**
   * Die Ablage mit EINER Haltestelle. Sie hält den nächsten Grant unmittelbar VOR seinem
   * Schreibvorgang an — genau die Lage eines bereits autorisierten, noch laufenden Requests.
   * Kein `sleep`, keine Zeitannahme: der Takt hängt an Promises, die der Test selbst löst.
   */
  class TaktRepo extends InMemoryKlaraSessionRepo {
    private anhalten = false;

    erreichtSignal: (() => void) | undefined;

    private weiter: Promise<void> | undefined;

    freigabe: (() => void) | undefined;

    halteNaechstenGrantAn(): void {
      this.anhalten = true;
      this.weiter = new Promise<void>((res) => {
        this.freigabe = res;
      });
    }

    // W1 S4 R5: derselbe Takt, aber am TOUCH — die Haltestelle, an der BEN den Response-TOCTOU
    // reproduziert hat (Bericht 24, Abschnitt 4).
    private touchAnhalten = false;

    halteNaechstenTouchAn(): void {
      this.touchAnhalten = true;
      this.weiter = new Promise<void>((res) => {
        this.freigabe = res;
      });
    }

    override async touchSession(
      ...a: Parameters<InMemoryKlaraSessionRepo["touchSession"]>
    ): Promise<boolean> {
      if (this.touchAnhalten) {
        this.touchAnhalten = false;
        this.erreichtSignal?.();
        await this.weiter;
      }
      return super.touchSession(...a);
    }

    override async grantConsent(
      sessionId: string,
      expectedRevision: number,
      consent: Parameters<InMemoryKlaraSessionRepo["grantConsent"]>[2],
    ): Promise<boolean> {
      if (this.anhalten) {
        this.anhalten = false;
        this.erreichtSignal?.();
        await this.weiter;
      }
      return super.grantConsent(sessionId, expectedRevision, consent);
    }
  }

  function taktAufbau() {
    const repo = new TaktRepo();
    const basis = aufbau(
      { choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" },
      repo,
    );
    return {
      ...basis,
      repo,
      erreicht: () =>
        new Promise<void>((res) => {
          repo.erreichtSignal = res;
        }),
      freigeben: () => repo.freigabe?.(),
    };
  }

  /** Der veraltete Stand, den ein bereits laufender Request in der Hand hätte. */
  async function veralteterStand(repo: InMemoryKlaraSessionRepo, sessionId: string) {
    const s = await repo.findSession(sessionId);
    if (!s) {
      throw new Error("Sitzung fehlt");
    }
    return s;
  }

  it("1 · Touch gegen Rebind: alte Bindung, Resolution und Consent kehren nie zurueck", async () => {
    const { dienst, repo } = externAufbau();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-r4",
    });
    const alteBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.grantConsent(start.sessionId, alteBindung);
    // Der alte Request hat GELESEN — und wird gleich mit diesem Stand schreiben wollen.
    const alt = await veralteterStand(repo, start.sessionId);

    const nach = await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
      kind: "saved",
      hostDocumentId: "r4-gespeichert",
    });

    // Der veraltete Touch verliert das Rennen — die Ablage weist ihn ab, statt ihn auszufuehren.
    expect(
      await repo.touchSession(
        alt.sessionId,
        alt.revision,
        "2099-01-01T00:00:00.000Z",
        "2099-01-01T00:15:00.000Z",
      ),
    ).toBe(false);

    const jetzt = await veralteterStand(repo, start.sessionId);
    expect(jetzt.documentContextId).toBe(nach.documentContextId);
    expect(jetzt.resolutionId).toBe(nach.resolution.resolutionId);
    expect(jetzt.consentState).toBe("invalidated");
    expect(jetzt.expiresAt).not.toBe("2099-01-01T00:15:00.000Z");
  });

  it("2 · Grant gegen Rebind: der Grant auf alter Revision verliert; kein uebertragener Consent", async () => {
    const { dienst, repo } = externAufbau();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-r4-2",
    });
    const alteBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    const alt = await veralteterStand(repo, start.sessionId);
    const nach = await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
      kind: "saved",
      hostDocumentId: "r4-gespeichert-2",
    });

    // Der Grant traegt den ALTEN Dokumentkontext — genau das darf nicht mehr durchgehen.
    const consent = {
      consentId: "c-alt",
      sessionId: start.sessionId,
      tenantId: KLARA_SINGLE_TENANT_ID,
      actorId: "anna",
      documentContextId: start.documentContextId,
      consentScope: "session",
      allowedPayloadClasses: ["question"],
      providerClass: "external",
      providerBindingId: "b",
      modelReference: "m",
      providerReference: "p",
      // JOB 1943 · KA5: aus der Sitzung abgeleitet wie `sessionId` und `documentContextId` —
      // dieser Fall prueft den CAS-Konflikt, nicht die Instanzbindung.
      addinInstanceId: start.addinInstanceId,
      policyVersion: alt.policyVersion,
      configurationVersion: alt.configurationVersion,
      grantedAt: "2026-08-02T09:00:00.000Z",
      expiresAt: alt.expiresAt,
      revokedAt: null,
      status: "granted" as const,
      resolutionId: alt.resolutionId,
    };
    expect(await repo.grantConsent(start.sessionId, alt.revision, consent)).toBe(false);

    const jetzt = await veralteterStand(repo, start.sessionId);
    expect(jetzt.documentContextId).toBe(nach.documentContextId);
    expect(jetzt.consentState).not.toBe("granted");
    expect(await repo.alleConsents(start.sessionId)).toHaveLength(0);
  });

  it("3 · Revoke gegen Grant: genau ein Uebergang gewinnt, der Verlierer erhaelt Konflikt", async () => {
    const { dienst, repo, erreicht, freigeben } = taktAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    // Der zweite Grant laeuft bis unmittelbar VOR seinen Schreibvorgang und haelt dort seinen
    // gelesenen Stand fest — genau die Lage eines bereits autorisierten, noch laufenden Requests.
    repo.halteNaechstenGrantAn();
    const grantP = dienst.grantConsent(sicht.sessionId, bindung);
    await erreicht();

    // Waehrenddessen laeuft der Widerruf VOLLSTAENDIG durch.
    await dienst.revokeConsent(sicht.sessionId, bindung);

    freigeben();
    await expect(grantP).rejects.toMatchObject({
      code: "CONFLICT",
      internalCode: "KLARA_SESSION_CONFLICT",
    });
    // Der Widerruf steht — der ueberholte Grant hat ihn nicht zurueckgenommen.
    expect((await repo.findSession(sicht.sessionId))?.consentState).toBe("revoked");
    expect(
      (await repo.alleConsents(sicht.sessionId)).filter((c) => c.status === "granted"),
    ).toHaveLength(0);
  });

  it("4 · Close gegen Touch: die geschlossene Sitzung wird nie reaktiviert oder verlaengert", async () => {
    const { dienst, repo } = aufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const alt = await veralteterStand(repo, sicht.sessionId);
    await dienst.closeSession(sicht.sessionId, bindung);

    expect(
      await repo.touchSession(
        alt.sessionId,
        alt.revision,
        "2099-01-01T00:00:00.000Z",
        "2099-01-01T00:15:00.000Z",
      ),
    ).toBe(false);
    const jetzt = await veralteterStand(repo, sicht.sessionId);
    expect(jetzt.closedAt).not.toBeNull();
    expect(jetzt.expiresAt).not.toBe("2099-01-01T00:15:00.000Z");
  });

  it("5 · Ablauf/Invalidierung gegen Refresh: ein alter Refresh aktiviert nichts wieder", async () => {
    const { dienst, repo, vorspulen } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const alt = await veralteterStand(repo, sicht.sessionId);

    vorspulen(KLARA_SESSION_INACTIVITY_MS + 1);
    await expect(dienst.getSession(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    const abgelaufen = await veralteterStand(repo, sicht.sessionId);
    expect(abgelaufen.consentState).toBe("expired");

    // Der alte Refresh kommt zu spaet — er trifft null Zeilen und weckt nichts wieder auf.
    expect(
      await repo.refreshResolution(alt.sessionId, alt.revision, {
        resolutionId: "res-alt",
        policyVersion: "pol-alt",
        configurationVersion: "cfg-alt",
      }),
    ).toBe(false);
    const danach = await veralteterStand(repo, sicht.sessionId);
    expect(danach.consentState).toBe("expired");
    expect(danach.resolutionId).not.toBe("res-alt");
  });

  it("6 · Policy-/Config-Refresh gegen Rebind: die alte Resolution ueberschreibt keine neue Bindung", async () => {
    const { dienst, repo } = aufbau();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-r4-6",
    });
    const alteBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    const alt = await veralteterStand(repo, start.sessionId);
    const nach = await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
      kind: "saved",
      hostDocumentId: "r4-gespeichert-6",
    });

    expect(
      await repo.refreshResolution(alt.sessionId, alt.revision, {
        resolutionId: "res-veraltet",
        policyVersion: "pol-veraltet",
        configurationVersion: "cfg-veraltet",
      }),
    ).toBe(false);
    const jetzt = await veralteterStand(repo, start.sessionId);
    expect(jetzt.documentContextId).toBe(nach.documentContextId);
    expect(jetzt.resolutionId).toBe(nach.resolution.resolutionId);
  });

  it("7 · CAS-Verlust: generischer Konflikt ohne Existenz-, Bindungs- oder Zustandsleck", async () => {
    const { dienst, repo, erreicht, freigeben } = taktAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    repo.halteNaechstenGrantAn();
    const grantP = dienst.grantConsent(sicht.sessionId, bindung);
    await erreicht();
    await dienst.revokeConsent(sicht.sessionId, bindung);
    freigeben();
    const fehler = (await grantP.then(
      () => undefined,
      (e: { code: string; message: string }) => e,
    )) as { code: string; message: string };
    expect(fehler.code).toBe("CONFLICT");
    // Die Meldung nennt weder Sitzung noch Actor, Instanz, Dokument, Resolution, Schliess- oder
    // Ablaufzustand. Geprueft wird an den KONKRETEN Werten dieses Falls, nicht an einem Textmuster.
    for (const geheim of [
      sicht.sessionId,
      sicht.actorId,
      sicht.addinInstanceId,
      sicht.documentContextId,
      sicht.resolution.resolutionId,
    ]) {
      expect(fehler.message).not.toContain(geheim);
    }
    for (const wort of ["geschlossen", "abgelaufen", "Dokument", "Resolution", "Actor"]) {
      expect(fehler.message).not.toContain(wort);
    }
    // Und der Verlierer bekommt DENSELBEN Text wie jeder andere Sitzungs-CAS-Konflikt.
    expect(fehler.message).toBe(KLARA_SESSION_CONFLICT_MESSAGE);
    expect(await repo.findSession(sicht.sessionId)).toBeDefined();
  });

  it("8 · Rebind-Atomaritaet: nie eine aktive Sitzung ohne Resolution oder mit Mischbindung", async () => {
    const { dienst, repo } = externAufbau();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "nonce-r4-8",
    });
    const alteBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.grantConsent(start.sessionId, alteBindung);
    const vorher = await veralteterStand(repo, start.sessionId);

    const nach = await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
      kind: "saved",
      hostDocumentId: "r4-gespeichert-8",
    });
    const jetzt = await veralteterStand(repo, start.sessionId);

    // GENAU EIN Revisionsschritt — der Zweischritt aus R3 (erst null, dann neu) haette zwei erzeugt.
    expect(jetzt.revision).toBe(vorher.revision + 1);
    // Kein Zwischenzustand ist je sichtbar geworden: Bindung, Resolution und Consent passen zusammen.
    expect(jetzt.resolutionId).toBe(nach.resolution.resolutionId);
    expect(jetzt.resolutionId).not.toBeNull();
    expect(jetzt.documentContextId).toBe(nach.documentContextId);
    expect(jetzt.consentState).toBe("invalidated");
    const consents = await repo.alleConsents(start.sessionId);
    expect(consents.filter((c) => c.status === "granted")).toHaveLength(0);
    expect(consents[0]?.documentContextId).toBe(start.documentContextId);
  });

  it("9 · der generische Voll-Snapshot-Schreiber existiert nicht mehr", async () => {
    // KW-S4-21 §1: „Ein allgemeines `updateSession(snapshot)` fuer fachlich konkurrierende
    // Uebergaenge ist verboten." Ein Vertrag, den nur ein Kommentar traegt, haelt keinen zweiten
    // Umbau aus — hier ist er geprueft.
    const repo = new InMemoryKlaraSessionRepo() as unknown as Record<string, unknown>;
    for (const verboten of ["updateSession", "replaceGrantedConsent", "updateConsent"]) {
      expect(repo[verboten]).toBeUndefined();
    }
    for (const noetig of [
      "touchSession",
      "rebindSession",
      "grantConsent",
      "revokeConsent",
      "closeSession",
      "invalidateSession",
      "refreshResolution",
    ]) {
      expect(typeof repo[noetig]).toBe("function");
    }
  });
});

// ================================================================================================
// W1 S4 R5 — DIE ANTWORT GEHOERT ZUSAMMEN (KW-S4-21 §5, BEN-Bericht 24)
// ================================================================================================
//
// BEN hat in Freeze 23 belegt: die SCHREIBSEITE war nach R4 dicht, die LESESEITE nicht. Ein
// Statusabruf, dessen Touch das CAS verlor, las die Sitzung neu — und baute die Antwort trotzdem
// mit dem Zustimmungsstand von VOR dem Rennen. Ergebnis war eine Antwort, die gleichzeitig
// „widerrufen" und „externe Zustimmung erteilt" behauptete.
//
// Die Faelle hier pruefen GENAU DAS: nicht, dass die Persistenz stimmt (das tat sie schon), sondern
// dass Sitzung, Zustimmung und Aufloesung IN EINEM Antwortobjekt zusammengehoeren.
describe("W1 S4 R5 · frische Statusaufloesung nach CAS-Verlust (In-Memory)", () => {
  class StatusTaktRepo extends InMemoryKlaraSessionRepo {
    private touchAnhalten = false;
    erreichtSignal: (() => void) | undefined;
    private weiter: Promise<void> | undefined;
    freigabe: (() => void) | undefined;

    halteNaechstenTouchAn(): void {
      this.touchAnhalten = true;
      this.weiter = new Promise<void>((res) => {
        this.freigabe = res;
      });
    }

    override async touchSession(
      ...a: Parameters<InMemoryKlaraSessionRepo["touchSession"]>
    ): Promise<boolean> {
      if (this.touchAnhalten) {
        this.touchAnhalten = false;
        this.erreichtSignal?.();
        await this.weiter;
      }
      return super.touchSession(...a);
    }
  }

  function statusTakt(over: Partial<KlaraPolicyQuelle> = {}) {
    const repo = new StatusTaktRepo();
    const basis = aufbau(
      { choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud", ...over },
      repo,
    );
    return {
      ...basis,
      repo,
      erreicht: () =>
        new Promise<void>((res) => {
          repo.erreichtSignal = res;
        }),
      freigeben: () => repo.freigabe?.(),
    };
  }

  it("Status gegen Revoke: Response und Persistenz zeigen beide `revoked` (BENs Befund)", async () => {
    const { dienst, repo, erreicht, freigeben, vorspulen } = statusTakt();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    // Der Statusabruf laeuft bis unmittelbar vor seinen Touch und haelt dort seinen Stand fest.
    // JOB 2688 D1: ein Touch binnen 60 s nach dem letzten Zugriff findet nicht mehr statt — der
    // Rennfall braucht deshalb erst einen Abstand, sonst wartet `erreicht()` auf nichts.
    vorspulen(KLARA_TOUCH_MINDESTABSTAND_MS + 1000);
    repo.halteNaechstenTouchAn();
    const statusP = dienst.getSession(sicht.sessionId, bindung);
    await erreicht();

    // Waehrenddessen wird die Zustimmung VOLLSTAENDIG widerrufen.
    await dienst.revokeConsent(sicht.sessionId, bindung);
    freigeben();

    const status = await statusP;
    // DAS ist der Befund aus Bericht 24: bis R4 stand hier `revoked` UND `true` nebeneinander.
    expect(status.consentState).toBe("revoked");
    expect(status.resolution.externalConsentGranted).toBe(false);
    // Und die Persistenz sagt dasselbe — Antwort und Bestand widersprechen sich nicht.
    expect((await repo.findSession(sicht.sessionId))?.consentState).toBe("revoked");
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("revoked");
  });

  it("Status gegen Grant: die Antwort benutzt keinen vor dem CAS-Verlust gelesenen Consentstand", async () => {
    const { dienst, repo, erreicht, freigeben, vorspulen } = statusTakt();
    const { sicht, bindung } = await sitzung(dienst);
    // Ausgangslage BEWUSST ohne Zustimmung — der veraltete Stand waere „keine Zustimmung".
    // JOB 2688 D1: ein Touch binnen 60 s nach dem letzten Zugriff findet nicht mehr statt — der
    // Rennfall braucht deshalb erst einen Abstand, sonst wartet `erreicht()` auf nichts.
    vorspulen(KLARA_TOUCH_MINDESTABSTAND_MS + 1000);
    repo.halteNaechstenTouchAn();
    const statusP = dienst.getSession(sicht.sessionId, bindung);
    await erreicht();

    await dienst.grantConsent(sicht.sessionId, bindung);
    freigeben();

    const status = await statusP;
    // Die Antwort zeigt die INZWISCHEN erteilte Zustimmung, nicht den Stand von vor dem Rennen.
    expect(status.consentState).toBe("granted");
    expect(status.resolution.externalConsentGranted).toBe(true);
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("granted");
  });

  it("Status gegen Schliessen: keine gemischte Sitzungs-/Consent-Auskunft", async () => {
    const { dienst, repo, erreicht, freigeben, vorspulen } = statusTakt();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    // JOB 2688 D1: ein Touch binnen 60 s nach dem letzten Zugriff findet nicht mehr statt — der
    // Rennfall braucht deshalb erst einen Abstand, sonst wartet `erreicht()` auf nichts.
    vorspulen(KLARA_TOUCH_MINDESTABSTAND_MS + 1000);
    repo.halteNaechstenTouchAn();
    const statusP = dienst.getSession(sicht.sessionId, bindung);
    await erreicht();
    await dienst.closeSession(sicht.sessionId, bindung);
    freigeben();

    // Eine geschlossene Sitzung traegt keinen Status mehr — und ganz sicher keine erteilte
    // Zustimmung. Der Abruf endet ehrlich, statt eine Mischauskunft zu liefern.
    await expect(statusP).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await repo.findSession(sicht.sessionId))?.consentState).toBe("invalidated");
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("invalidated");
  });

  it("Status gegen Rebind: die alte Bindung traegt nicht mehr, keine Mischauskunft", async () => {
    const { dienst, repo, erreicht, freigeben, vorspulen } = statusTakt();
    const start = await dienst.createSession("anna", "instanz-1", {
      kind: "unsaved",
      clientDocumentNonce: "r5-rebind",
    });
    const alteBindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.grantConsent(start.sessionId, alteBindung);

    // JOB 2688 D1: ein Touch binnen 60 s nach dem letzten Zugriff findet nicht mehr statt — der
    // Rennfall braucht deshalb erst einen Abstand, sonst wartet `erreicht()` auf nichts.
    vorspulen(KLARA_TOUCH_MINDESTABSTAND_MS + 1000);
    repo.halteNaechstenTouchAn();
    const statusP = dienst.getSession(start.sessionId, alteBindung);
    await erreicht();
    const nach = await dienst.rebindDocumentContext(start.sessionId, alteBindung, {
      kind: "saved",
      hostDocumentId: "r5-jetzt-gespeichert",
    });
    freigeben();

    await expect(statusP).rejects.toMatchObject({ code: "NOT_FOUND" });
    const gespeichert = await repo.findSession(start.sessionId);
    expect(gespeichert?.documentContextId).toBe(nach.documentContextId);
    expect(gespeichert?.consentState).toBe("invalidated");
  });

  it("Status gegen Policywechsel: Sitzung, Consent und Resolution stammen aus EINEM Stand", async () => {
    const { dienst, repo, umkonfigurieren, erreicht, freigeben, vorspulen } = statusTakt();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    // JOB 2688 D1: ein Touch binnen 60 s nach dem letzten Zugriff findet nicht mehr statt — der
    // Rennfall braucht deshalb erst einen Abstand, sonst wartet `erreicht()` auf nichts.
    vorspulen(KLARA_TOUCH_MINDESTABSTAND_MS + 1000);
    repo.halteNaechstenTouchAn();
    const statusP = dienst.getSession(sicht.sessionId, bindung);
    await erreicht();
    // Zwei Aenderungen gleichzeitig: die Zustimmung faellt UND die Policyversion wechselt.
    await dienst.revokeConsent(sicht.sessionId, bindung);
    umkonfigurieren({ source: "db" });
    freigeben();

    const status = await statusP;
    expect(status.consentState).toBe("revoked");
    expect(status.resolution.externalConsentGranted).toBe(false);
    // Die ausgelieferten Versionen sind die der ausgelieferten Sitzung — kein Versionsmix.
    expect(status.policyVersion).toBe(status.resolution.policyVersion);
    expect(status.configurationVersion).toBe(status.resolution.configurationVersion);
    const gespeichert = await repo.findSession(sicht.sessionId);
    expect(gespeichert?.policyVersion).toBe(status.policyVersion);
    expect(gespeichert?.resolutionId).toBe(status.resolution.resolutionId);
    expect(gespeichert?.consentState).toBe("revoked");
  });

  it("ohne Rennen bleibt der Statusabruf unveraendert einfach (keine Regression)", async () => {
    const { dienst } = statusTakt();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const status = await dienst.getSession(sicht.sessionId, bindung);
    expect(status.consentState).toBe("granted");
    expect(status.resolution.externalConsentGranted).toBe(true);
  });
});

// ================================================================================================
// W1 S4 R6A — DER KONFLIKTZWEIG NACH EINEM BEREITS COMMITTETEN UEBERGANG (BEN-Bericht 30, Befund C)
// ================================================================================================
//
// DIE LUECKE, die BEN belegt hat: die drei R5-Endpruefungen an grant/revoke/close laufen in vielen
// Erfolgspfaden mit — ihr NEUER Zweig war aber nirgends direkt geprueft. Die vorhandenen R4-Races
// halten jeweils VOR dem Repo-Schreibvorgang an und messen einen verlorenen CAS beim Uebergang
// selbst; sie erzeugen keinen Revisionwechsel NACH erfolgreichem Commit.
//
// GENAU DAS stellen die drei Faelle hier her, und zwar ohne jede Produktnaht: eine Ablage, die nach
// dem ECHTEN Commit des jeweiligen Uebergangs einen FREMDEN, ebenso echten Touch ausfuehrt. Damit
// ist der Zustand exakt der, den `antwortstandPruefen()` abfangen soll — der Uebergang gilt, aber
// die Auskunft darueber waere schon ueberholt.
//
// Kein sleep, keine Zeitannahme, keine private Implementierungsbehauptung: gemessen werden
// ausschliesslich der oeffentliche Dienstvertrag (wirft er?) und der oeffentliche Repo-Vertrag
// (was steht danach in der Ablage?).
describe("W1 S4 R6A · Endpruefung nach Commit: fail-safe Konflikt ohne Retry", () => {
  type NachCommit = "grantConsent" | "revokeConsent" | "closeSession";

  class NachCommitStoerRepo extends InMemoryKlaraSessionRepo {
    /** Der Uebergang, nach dessen erfolgreichem Commit ein FREMDER Schreiber dazwischenfaehrt. */
    stoerNach: NachCommit | undefined;

    /** Zaehlt, wie oft der Dienst den jeweiligen Uebergang versucht hat — belegt „kein Retry". */
    readonly versuche = new Map<NachCommit, number>();

    private zaehle(name: NachCommit): void {
      this.versuche.set(name, (this.versuche.get(name) ?? 0) + 1);
    }

    /**
     * Der fremde Schreiber: ein echter, schmaler Touch mit der aktuellen Revision. Er aendert
     * bewusst NUR die Aktivitaetsfelder — die Zusage des soeben committeten Uebergangs bleibt
     * damit sichtbar unangetastet, und trotzdem stimmt die Revision nicht mehr.
     */
    private async fremderTouch(sessionId: string): Promise<void> {
      const s = await this.findSession(sessionId);
      if (!s) {
        return;
      }
      await super.touchSession(sessionId, s.revision, s.lastActivityAt, s.expiresAt);
    }

    private async nachCommit(name: NachCommit, sessionId: string, ok: boolean): Promise<void> {
      if (ok && this.stoerNach === name) {
        this.stoerNach = undefined;
        await this.fremderTouch(sessionId);
      }
    }

    override async grantConsent(
      ...a: Parameters<InMemoryKlaraSessionRepo["grantConsent"]>
    ): Promise<boolean> {
      this.zaehle("grantConsent");
      const ok = await super.grantConsent(...a);
      await this.nachCommit("grantConsent", a[0], ok);
      return ok;
    }

    override async revokeConsent(
      ...a: Parameters<InMemoryKlaraSessionRepo["revokeConsent"]>
    ): Promise<boolean> {
      this.zaehle("revokeConsent");
      const ok = await super.revokeConsent(...a);
      await this.nachCommit("revokeConsent", a[0], ok);
      return ok;
    }

    override async closeSession(
      ...a: Parameters<InMemoryKlaraSessionRepo["closeSession"]>
    ): Promise<boolean> {
      this.zaehle("closeSession");
      const ok = await super.closeSession(...a);
      await this.nachCommit("closeSession", a[0], ok);
      return ok;
    }
  }

  function stoerAufbau() {
    const repo = new NachCommitStoerRepo();
    return {
      ...aufbau({ choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" }, repo),
      repo,
    };
  }

  it("grantConsent: committet, dann fremde Revision → Konflikt, kein Retry, Zustimmung bleibt", async () => {
    const { dienst, repo } = stoerAufbau();
    const { sicht, bindung } = await sitzung(dienst);

    repo.stoerNach = "grantConsent";
    await expect(dienst.grantConsent(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
      internalCode: "KLARA_SESSION_CONFLICT",
    });

    // Der bereits committete Uebergang BLEIBT — der Konflikt betrifft die Auskunft, nicht die Tat.
    const gespeichert = await repo.findSession(sicht.sessionId);
    expect(gespeichert?.consentState).toBe("granted");
    const alle = await repo.alleConsents(sicht.sessionId);
    expect(alle.filter((c) => c.status === "granted")).toHaveLength(1);
    // KEIN Retry: der Uebergang wurde genau EINMAL versucht (KW-S4-21 §3).
    expect(repo.versuche.get("grantConsent")).toBe(1);
  });

  it("revokeConsent: committet, dann fremde Revision → Konflikt, kein Retry, Widerruf bleibt", async () => {
    const { dienst, repo } = stoerAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    repo.stoerNach = "revokeConsent";
    await expect(dienst.revokeConsent(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
      internalCode: "KLARA_SESSION_CONFLICT",
    });

    const gespeichert = await repo.findSession(sicht.sessionId);
    expect(gespeichert?.consentState).toBe("revoked");
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("revoked");
    expect(
      (await repo.alleConsents(sicht.sessionId)).filter((c) => c.status === "granted"),
    ).toHaveLength(0);
    expect(repo.versuche.get("revokeConsent")).toBe(1);
  });

  it("closeSession: committet, dann fremde Revision → Konflikt, kein Retry, Schliessen bleibt", async () => {
    const { dienst, repo } = stoerAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    repo.stoerNach = "closeSession";
    await expect(dienst.closeSession(sicht.sessionId, bindung)).rejects.toMatchObject({
      code: "CONFLICT",
      internalCode: "KLARA_SESSION_CONFLICT",
    });

    const gespeichert = await repo.findSession(sicht.sessionId);
    expect(gespeichert?.closedAt).not.toBeNull();
    expect(gespeichert?.consentState).toBe("invalidated");
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("invalidated");
    expect(repo.versuche.get("closeSession")).toBe(1);
  });

  it("ohne fremden Schreiber bleiben alle drei Wege unveraendert erfolgreich (keine Regression)", async () => {
    const { dienst, repo } = stoerAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    // stoerNach bleibt undefined — dieselbe Ablage, nur ohne Stoerung.
    expect((await dienst.grantConsent(sicht.sessionId, bindung)).consentState).toBe("granted");
    expect((await dienst.revokeConsent(sicht.sessionId, bindung)).consentState).toBe("revoked");
    expect((await dienst.closeSession(sicht.sessionId, bindung)).closed).toBe(true);
    expect(repo.versuche.get("grantConsent")).toBe(1);
    expect(repo.versuche.get("revokeConsent")).toBe(1);
    expect(repo.versuche.get("closeSession")).toBe(1);
  });
});

// ================================================================================================
// W1 S4 R6B — CONSENT-BINDUNG (KW-S4-23)
// ================================================================================================
//
// BENs Loch: eine Zustimmung konnte auf Auflösung A erteilt sein, während die Sitzung nach einem
// Refresh Auflösung B verwendete. Eine aktuelle `sessionRevision` beweist das NICHT — KW-S4-23 §2
// nennt genau diese Ableitung als No-Go.
//
// Die Fälle hier prüfen die fünf Pflichtgegenproben des Auftrags. Dieselben laufen gegen echtes
// PostgreSQL in `db.migrate.integration.test.ts`; die Parität ist Akzeptanzkriterium 7.
describe("W1 S4 R6B · Consent-Bindung an die verwendete Auflösung (KW-S4-23)", () => {
  it("1 · Consent A, Policy wechselt zu B → invalidiert, externe Ausführung blockiert", async () => {
    const { dienst, repo, umkonfigurieren } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const mitConsent = await dienst.grantConsent(sicht.sessionId, bindung);
    expect(mitConsent.resolution.externalConsentGranted).toBe(true);

    // Der Admin ändert die autoritative Konfiguration — sonst nichts. Kein Rebind, kein Widerruf.
    umkonfigurieren({ source: "db" });

    const nach = await dienst.getSession(sicht.sessionId, bindung);
    // Die Auflösung ist neu — und die alte Zustimmung deckt sie NICHT mehr.
    expect(nach.policyVersion).not.toBe(mitConsent.policyVersion);
    expect(nach.resolution.externalConsentGranted).toBe(false);
    expect(nach.consentState).toBe("invalidated");
    // Fail-safe auch in der Ablage — nicht nur in der Antwort.
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("invalidated");

    // Und das finale Tor blockiert mit dem FACHLICHEN Grund, nicht mit einem CAS-Konflikt.
    const tor = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
  });

  it("2 · Refresh und Invalidierung sind atomar — eine veraltete Revision bringt den Consent nicht zurück", async () => {
    const { dienst, repo, umkonfigurieren } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    // Der Stand, den ein bereits laufender Request in der Hand hätte.
    const alt = await repo.findSession(sicht.sessionId);
    if (!alt) {
      throw new Error("Sitzung fehlt");
    }

    umkonfigurieren({ source: "db" });
    await dienst.getSession(sicht.sessionId, bindung);

    // Der veraltete Schreiber will die Zustimmung zurückholen — er trifft null Zeilen.
    expect(
      await repo.grantConsent(sicht.sessionId, alt.revision, {
        consentId: "c-zurueck",
        sessionId: sicht.sessionId,
        tenantId: KLARA_SINGLE_TENANT_ID,
        actorId: "anna",
        documentContextId: sicht.documentContextId,
        consentScope: "session",
        allowedPayloadClasses: ["question"],
        providerClass: "external",
        providerBindingId: "b",
        modelReference: "m",
        providerReference: "p",
        // JOB 1943 · KA5: aus der Sitzung abgeleitet — dieser Fall prueft den veralteten
        // Schreiber, nicht die Instanzbindung.
        addinInstanceId: sicht.addinInstanceId,
        policyVersion: alt.policyVersion,
        configurationVersion: alt.configurationVersion,
        grantedAt: "2026-08-02T09:00:00.000Z",
        expiresAt: alt.expiresAt,
        revokedAt: null,
        status: "granted",
        resolutionId: alt.resolutionId,
      }),
    ).toBe(false);

    expect((await repo.findSession(sicht.sessionId))?.consentState).toBe("invalidated");
    expect(
      (await repo.alleConsents(sicht.sessionId)).filter((c) => c.status === "granted"),
    ).toHaveLength(0);
  });

  it("3 · identische Auflösung ohne Versionswechsel → der Consent bleibt gültig", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    // Mehrfache Abrufe OHNE jede Änderung dürfen die Zustimmung nicht verschleissen.
    for (let i = 0; i < 3; i++) {
      const nach = await dienst.getSession(sicht.sessionId, bindung);
      expect(nach.resolution.externalConsentGranted).toBe(true);
      expect(nach.consentState).toBe("granted");
    }
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("granted");
  });

  it("4a · unvollständige Bindung (Altbestand ohne providerReference) → blocked", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const mitConsent = await dienst.grantConsent(sicht.sessionId, bindung);

    // Eine Zeile, wie sie R2..R6A hinterlassen haben: alles da ausser der Anbieterbindung.
    const vorhanden = await repo.findConsent(sicht.sessionId);
    if (!vorhanden) {
      throw new Error("Consent fehlt");
    }
    await repo.grantConsent(
      sicht.sessionId,
      (await repo.findSession(sicht.sessionId))?.revision ?? 0,
      {
        ...vorhanden,
        consentId: "c-altbestand",
        providerReference: null,
      },
    );

    const tor = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
    expect(tor.erlaubt === false && tor.deckung.gedeckt).toBe(false);
    expect(tor.erlaubt === false && !tor.deckung.gedeckt && tor.deckung.grund).toBe(
      "bindung_unvollstaendig",
    );
    // Unklare Kompatibilität wird NICHT stillschweigend übernommen — sie wird entwertet.
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("invalidated");
    expect(mitConsent.resolution.externalConsentGranted).toBe(true); // vorher war sie gültig
  });

  it("4b · abweichende Bindung (fremder Dokumentkontext) → blocked, mit benanntem Feld", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);
    const vorhanden = await repo.findConsent(sicht.sessionId);
    if (!vorhanden) {
      throw new Error("Consent fehlt");
    }
    await repo.grantConsent(
      sicht.sessionId,
      (await repo.findSession(sicht.sessionId))?.revision ?? 0,
      {
        ...vorhanden,
        consentId: "c-fremd",
        documentContextId: "doc-s-fremd",
      },
    );

    const tor = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && !tor.deckung.gedeckt && tor.deckung.abweichungen).toContain(
      "documentContextId",
    );
  });

  it("5 · das finale Tor erkennt eine Änderung zwischen vorherigem Lesen und Ausführungsversuch", async () => {
    const { dienst, repo, umkonfigurieren } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const vorher = await dienst.grantConsent(sicht.sessionId, bindung);
    expect(vorher.resolution.externalConsentGranted).toBe(true);

    // Genau das Fenster, das §2.3 meint: die Auskunft von vorhin sagt „Zustimmung liegt vor",
    // und ERST DANACH wechselt die Konfiguration.
    umkonfigurieren({ source: "db" });

    const tor = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
    expect((await repo.findConsent(sicht.sessionId))?.status).toBe("invalidated");
  });

  it("6 · das Tor unterscheidet Zustimmungsproblem und Blockade der Auflösung selbst", async () => {
    const { dienst } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await dienst.grantConsent(sicht.sessionId, bindung);

    // Die Zustimmung DECKT — geblockt wird trotzdem, aber aus einem anderen Grund: die externe
    // Ausführung ist im Bestand gar nicht freigeschaltet (`external_not_migrated`). Ein Tor, das
    // beides in einen Topf würfe, machte aus einem Betriebszustand ein Zustimmungsproblem.
    const tor = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && tor.grund).toBe("external_not_migrated");
    expect(tor.erlaubt === false && tor.deckung.gedeckt).toBe(true);
  });

  it("7 · das Tor liefert kein blosses Boolean — Grund und geprüfte Auflösung reisen mit", async () => {
    const { dienst } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    const tor = await dienst.pruefeExterneAusfuehrung(sicht.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    if (tor.erlaubt === false) {
      expect(tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
      expect(tor.deckung.gedeckt).toBe(false);
      expect(!tor.deckung.gedeckt && tor.deckung.grund).toBe("kein_consent");
      expect(tor.resolution.resolutionId).toBe(sicht.resolution.resolutionId);
    }
  });

  it("8 · eine fremde Bindung erreicht das Tor gar nicht — dieselbe generische NOT_FOUND-Klasse", async () => {
    const { dienst } = externAufbau();
    const { sicht, bindung } = await sitzung(dienst);
    await expect(
      dienst.pruefeExterneAusfuehrung(sicht.sessionId, {
        ...bindung,
        documentContextId: "doc-s-fremd",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ================================================================================================
// W1 S4 R6B · BENS EIGENTLICHES FENSTER — DER WECHSEL INNERHALB EINES REQUESTS
// ================================================================================================
//
// WARUM DIESER FALL SEPARAT STEHT, und warum er der einzige ist, der die neue Prüfung wirklich
// beweist: `laden()` prüft den Versionsbruch bereits seit R2 und entwertet dabei. Ein Policywechsel
// ZWISCHEN zwei Requests wird deshalb schon dort gefangen — jeder Test, der so aufgebaut ist, wäre
// auch mit der alten Boolean-Ableitung grün und bewiese nichts.
//
// BENs Befund A beschreibt ein anderes Fenster (Bericht 30, Abschnitt 4): der Wechsel geschieht
// NACH der Prüfung in `laden()` und VOR der Auflösung in `aufloesen()`. Genau dann trägt die
// Sitzung die neue Version, während die Zustimmung noch an der alten hängt — und genau dann sagte
// die alte Ableitung „Zustimmung liegt vor".
//
// Der Takt ist deterministisch und ohne Zeitannahme: die Policyquelle wechselt beim ZWEITEN Aufruf
// nach dem Scharfstellen. Der erste ist die Prüfung in `laden()`, der zweite die Auflösung.
describe("W1 S4 R6B · Policywechsel INNERHALB eines Requests (BEN Bericht 30, Befund A)", () => {
  function fensterAufbau() {
    const repo = new InMemoryKlaraSessionRepo();
    let jetzt = T0;
    let zaehler = 0;
    const quelleA: KlaraPolicyQuelle = {
      choice: "cloud",
      source: "default",
      effectiveAnswerProvider: "cloud",
      cloudConfigured: true,
      localConfigured: false,
      providerLabel: "Cloud-Anbieter",
      modelLabel: "cloud-modell",
      localProviderLabel: "Lokaler Anbieter",
    };
    const quelleB: KlaraPolicyQuelle = { ...quelleA, source: "db" };
    let scharf = false;
    let seitScharf = 0;
    const dienst = new KlaraSessionService({
      repo,
      policy: () => {
        if (scharf) {
          seitScharf += 1;
          // Aufruf 1 = die Prüfung in `laden()`, Aufruf 2 = die Auflösung. Ab da gilt B.
          if (seitScharf >= 2) {
            return quelleB;
          }
        }
        return quelleA;
      },
      now: () => jetzt,
      newId: () => `f-${++zaehler}`,
    });
    return {
      dienst,
      repo,
      scharfstellen: () => {
        scharf = true;
        seitScharf = 0;
      },
      vorspulen: (ms: number) => {
        jetzt += ms;
      },
    };
  }

  it("der Wechsel zwischen laden() und aufloesen() darf keine gedeckte Zustimmung vortäuschen", async () => {
    const { dienst, repo, scharfstellen } = fensterAufbau();
    const start = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
    const bindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    const mitConsent = await dienst.grantConsent(start.sessionId, bindung);
    expect(mitConsent.resolution.externalConsentGranted).toBe(true);
    const consentVorher = await repo.findConsent(start.sessionId);
    expect(consentVorher?.status).toBe("granted");

    // Ab jetzt wechselt die Konfiguration MITTEN im nächsten Request.
    scharfstellen();
    const nach = await dienst.getSession(start.sessionId, bindung);

    // Die Sitzung trägt die NEUE Version …
    expect(nach.policyVersion).not.toBe(mitConsent.policyVersion);
    // … und die Zustimmung, die an der ALTEN hängt, deckt sie nicht mehr.
    expect(nach.resolution.externalConsentGranted).toBe(false);
    expect(nach.consentState).toBe("invalidated");
    expect((await repo.findConsent(start.sessionId))?.status).toBe("invalidated");
  });

  it("dasselbe Fenster am finalen Tor — die Ausführung wird blockiert", async () => {
    const { dienst, repo, scharfstellen } = fensterAufbau();
    const start = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
    const bindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.grantConsent(start.sessionId, bindung);

    scharfstellen();
    const tor = await dienst.pruefeExterneAusfuehrung(start.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
    expect(tor.erlaubt === false && !tor.deckung.gedeckt && tor.deckung.abweichungen).toContain(
      "policyVersion",
    );
    expect((await repo.findConsent(start.sessionId))?.status).toBe("invalidated");
  });
});

// ================================================================================================
// BEN-35 — DIE DREI NACHGEPRUEFTEN BEFUNDE DES CONSENT-GATES
// ================================================================================================
//
// Alle drei haben dieselbe Bauart: das Gate BEHAUPTET eine Bindung, die es an der entscheidenden
// Stelle nicht herstellt. Einmal wird gegen eine hart codierte Klasse statt gegen die verwendete
// Auflösung verglichen; einmal wird ein verlorenes CAS als erledigte Invalidierung gelesen; einmal
// reist eine Deckungszusage mit einer Auflösung, zu der sie nicht gehört.
describe("W1 S4 · BEN-35: das finale Consent-Gate", () => {
  // ----------------------------------------------------------------------------------------------
  // BEFUND 1 — die effektiven Payload-Klassen kommen aus der VERWENDETEN Auflösung
  // ----------------------------------------------------------------------------------------------
  it("BEN-35/1: eine Auflösung mit abweichender Payload-Klasse wird NICHT gedeckt", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht: start, bindung } = await sitzung(dienst);
    const gewaehrt = await dienst.grantConsent(start.sessionId, bindung);
    const consent = await repo.findConsent(gewaehrt.sessionId);
    const session = await repo.findSession(gewaehrt.sessionId);
    expect(consent?.status).toBe("granted");
    if (!consent || !session) {
      throw new Error("Aufbau unvollständig");
    }

    // Genau BENs Gegenprobe: dieselbe Zustimmung, aber eine Auflösung, die eine ANDERE Nutzlast
    // versenden würde. Sie darf nicht als gedeckt gelten — sonst bindet der Consent die
    // Nutzlastsemantik überhaupt nicht.
    const abweichend = {
      ...gewaehrt.resolution,
      effectivePayloadClasses: ["full_document"] as readonly string[],
    };
    const deckung = pruefeConsentDeckung(consent, session, abweichend, T0);
    expect(deckung.gedeckt).toBe(false);
    expect(!deckung.gedeckt && deckung.grund).toBe("bindung_abweichend");
    expect(!deckung.gedeckt && deckung.abweichungen).toContain("effectivePayloadClasses");

    // GEGENKONTROLLE: dieselbe Zustimmung gegen die UNVERÄNDERTE Auflösung deckt weiterhin —
    // ohne sie wäre nicht unterscheidbar, ob die Prüfung bindet oder einfach alles ablehnt.
    expect(pruefeConsentDeckung(consent, session, gewaehrt.resolution, T0).gedeckt).toBe(true);
  });

  it("BEN-35/1: die Klassenprüfung ist mengenstabil, nicht reihenfolgeabhängig", async () => {
    const { dienst, repo } = externAufbau();
    const { sicht: start, bindung } = await sitzung(dienst);
    const gewaehrt = await dienst.grantConsent(start.sessionId, bindung);
    const consent = await repo.findConsent(gewaehrt.sessionId);
    const session = await repo.findSession(gewaehrt.sessionId);
    if (!consent || !session) {
      throw new Error("Aufbau unvollständig");
    }
    const gedreht = {
      ...gewaehrt.resolution,
      effectivePayloadClasses: [...gewaehrt.resolution.effectivePayloadClasses].reverse(),
    };
    expect(pruefeConsentDeckung(consent, session, gedreht, T0).gedeckt).toBe(true);
  });

  // ----------------------------------------------------------------------------------------------
  // BEFUND 2 — verlorenes CAS der fail-safe Invalidierung
  // ----------------------------------------------------------------------------------------------
  //
  // Der Takt ist echt und deterministisch: unmittelbar VOR der Invalidierung gewinnt ein fremder,
  // vollkommen gültiger Touch. Die Invalidierung bekommt damit eine veraltete Revision und meldet
  // korrekt `false`. Ein Stub, der einfach `false` zurückgibt, würde dasselbe Symptom zeigen, aber
  // nicht dieselbe Tatsache — deshalb der echte Fremdschreiber.
  //
  // DER AUFBAU IST BEWUSST SO GEBAUT, DASS NUR DAS TOR INVALIDIERT. Ein Policywechsel wäre der
  // naheliegende Auslöser — aber dann entwertet bereits `laden()`, und die Störung träfe die
  // falsche Stelle. Stattdessen weicht die ZUSTIMMUNG selbst ab (ein anderes Modell): die Sitzung
  // ist unauffällig, `laden()` hat nichts zu tun, und der einzige Invalidierungsversuch des
  // Requests ist der des Tors.
  class VerlorenesCasRepo extends InMemoryKlaraSessionRepo {
    /** Lässt die gelesene Zustimmung auf ein anderes Modell zeigen — Deckung fällt, Sitzung nicht. */
    consentVerstimmen = false;
    /** Lässt unmittelbar vor der Invalidierung einen fremden, gültigen Touch gewinnen. */
    fremdschreiberScharf = false;
    invalidierungsversuche = 0;

    override async findConsent(sessionId: string) {
      const c = await super.findConsent(sessionId);
      if (!c || !this.consentVerstimmen) {
        return c;
      }
      return { ...c, modelReference: `${c.modelReference}-abweichend` };
    }

    override async invalidateSession(
      sessionId: string,
      expectedRevision: number,
      werte: Parameters<InMemoryKlaraSessionRepo["invalidateSession"]>[2],
    ): Promise<boolean> {
      this.invalidierungsversuche += 1;
      if (this.fremdschreiberScharf) {
        this.fremdschreiberScharf = false;
        const s = await super.findSession(sessionId);
        if (s) {
          // Ein vollkommen gültiger fremder Touch — kein Stub, der einfach `false` liefert.
          await this.touchSession(sessionId, s.revision, s.lastActivityAt, s.expiresAt);
        }
      }
      return super.invalidateSession(sessionId, expectedRevision, werte);
    }
  }

  it("BEN-35/2: verliert das Gate sein CAS, endet es im Konfliktvertrag — kein stilles granted", async () => {
    const repo = new VerlorenesCasRepo();
    const u = aufbau(
      { choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" },
      repo,
    );
    const { sicht: start, bindung } = await sitzung(u.dienst);
    const gewaehrt = await u.dienst.grantConsent(start.sessionId, bindung);
    expect((await repo.findConsent(gewaehrt.sessionId))?.status).toBe("granted");

    // Die Zustimmung deckt nicht mehr → das Tor WILL entwerten …
    repo.consentVerstimmen = true;
    // … und genau dort verliert es sein CAS an einen fremden Touch.
    repo.fremdschreiberScharf = true;
    repo.invalidierungsversuche = 0;

    await expect(u.dienst.pruefeExterneAusfuehrung(gewaehrt.sessionId, bindung)).rejects.toThrow(
      KLARA_SESSION_CONFLICT_MESSAGE,
    );
    // Beleg, dass wirklich das Tor gestört wurde und nicht ein früherer Pfad.
    expect(repo.invalidierungsversuche).toBe(1);

    // Der entscheidende Satz: die Zustimmung darf NICHT als erledigt gelten. Sie steht noch, und
    // der nächste Aufruf muss dieselbe Entscheidung erneut treffen — statt sie zu verschweigen.
    repo.consentVerstimmen = false;
    expect((await repo.findConsent(gewaehrt.sessionId))?.status).toBe("granted");
  });

  it("BEN-35/2: ohne CAS-Verlust bleibt der Weg unverändert — fachlicher Block, entwertete Zustimmung", async () => {
    const repo = new VerlorenesCasRepo();
    const u = aufbau(
      { choice: "cloud", cloudConfigured: true, effectiveAnswerProvider: "cloud" },
      repo,
    );
    const { sicht: start, bindung } = await sitzung(u.dienst);
    const gewaehrt = await u.dienst.grantConsent(start.sessionId, bindung);
    // Derselbe Pfad, dieselbe fehlende Deckung — nur ohne verlorenes CAS.
    repo.consentVerstimmen = true;
    const tor = await u.dienst.pruefeExterneAusfuehrung(gewaehrt.sessionId, bindung);
    expect(tor.erlaubt).toBe(false);
    expect(tor.erlaubt === false && tor.grund).toBe("CONSENT_RECONFIRMATION_REQUIRED");
    repo.consentVerstimmen = false;
    expect((await repo.findConsent(gewaehrt.sessionId))?.status).toBe("invalidated");
  });

  // ----------------------------------------------------------------------------------------------
  // BEFUND 3 — die zurückgegebene Auflösung gehört zur geprüften Deckung
  // ----------------------------------------------------------------------------------------------
  //
  // Der Wechsel erfolgt bewusst erst beim DRITTEN Policyaufruf: die Deckungsprüfung bleibt grün,
  // und nur die letzte Auflösung wäre eine andere. Der vorhandene Fenstertest wechselt beim
  // zweiten Aufruf und kann diesen Fall nicht sehen.
  function drittesFensterAufbau() {
    const repo = new InMemoryKlaraSessionRepo();
    let jetzt = T0;
    let zaehler = 0;
    const quelleA: KlaraPolicyQuelle = {
      choice: "cloud",
      source: "default",
      effectiveAnswerProvider: "cloud",
      cloudConfigured: true,
      localConfigured: false,
      providerLabel: "Cloud-Anbieter",
      modelLabel: "cloud-modell",
      localProviderLabel: "Lokaler Anbieter",
    };
    const quelleB: KlaraPolicyQuelle = { ...quelleA, source: "db" };
    let scharf = false;
    let seitScharf = 0;
    const dienst = new KlaraSessionService({
      repo,
      policy: () => {
        if (scharf) {
          seitScharf += 1;
          if (seitScharf >= 3) {
            return quelleB;
          }
        }
        return quelleA;
      },
      now: () => jetzt,
      newId: () => `d-${++zaehler}`,
    });
    return {
      dienst,
      repo,
      scharfstellen: () => {
        scharf = true;
        seitScharf = 0;
      },
      aufrufe: () => seitScharf,
      vorspulen: (ms: number) => {
        jetzt += ms;
      },
    };
  }

  it("BEN-35/3: nach grüner Deckung reist keine fremde Auflösung mit", async () => {
    const { dienst, repo, scharfstellen } = drittesFensterAufbau();
    const start = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
    const bindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    const gewaehrt = await dienst.grantConsent(start.sessionId, bindung);
    const consent = await repo.findConsent(start.sessionId);
    expect(consent?.status).toBe("granted");

    scharfstellen();
    const tor = await dienst.pruefeExterneAusfuehrung(start.sessionId, bindung);

    // Ob das Tor erlaubt oder blockiert, entscheidet der Migrationsschalter — NICHT dieser Fall.
    // Geprüft wird ausschliesslich: die zurückgegebene Auflösung gehört zu derselben
    // Policy-Auflösung wie die Deckung, gegen die geprüft wurde.
    expect(tor.resolution.policyVersion).toBe(consent?.policyVersion);
    expect(tor.resolution.configurationVersion).toBe(consent?.configurationVersion);
    expect(tor.resolution.resolutionId).toBe(gewaehrt.resolution.resolutionId);
  });

  it("BEN-35/3: dieselbe Zusage gilt für die Statusauskunft", async () => {
    const { dienst, repo, scharfstellen } = drittesFensterAufbau();
    const start = await dienst.createSession("anna", "instanz-1", GESPEICHERT);
    const bindung = {
      actorId: "anna",
      addinInstanceId: "instanz-1",
      documentContextId: start.documentContextId,
    };
    await dienst.grantConsent(start.sessionId, bindung);
    const consent = await repo.findConsent(start.sessionId);

    scharfstellen();
    const sicht = await dienst.getSession(start.sessionId, bindung);
    if (sicht.resolution.externalConsentGranted) {
      // Nur wenn die Deckung getragen hat, ist die Aussage überhaupt anwendbar.
      expect(sicht.resolution.policyVersion).toBe(consent?.policyVersion);
    }
  });
});
