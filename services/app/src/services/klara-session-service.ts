import { createHash, randomUUID } from "node:crypto";
import {
  type KlaraConsent,
  type KlaraConsentStatus,
  type KlaraResolution,
  type KlaraSession,
  type KlaraSessionRepo,
  type ReasonerPolicySource,
  type ReasonerTaskChoice,
  klaraConfigurationVersion,
  klaraPolicyVersion,
  resolveKlaraPolicy,
} from "../../../reasoner";

// ================================================================================================
// W1 S4 R2 — KLARA-SITZUNG, DOKUMENTKONTEXT UND ZUSTIMMUNG
// (KW-S4-03, KW-S4-04 §59-100, KW-S4-20 · korrigiert nach BEN ROT-2 bis ROT-5)
// ================================================================================================
//
// WAS HIER STEHT: die ORCHESTRIERUNG. Sitzung registrieren, Bindung prüfen, Ablauf gleitend
// fortschreiben, Dokumentkontext registrieren und umbinden, Zustimmung erteilen/widerrufen.
// Welcher Modus, Anbieter oder Blockierungsgrund gilt, entscheidet ausschliesslich
// `resolveKlaraPolicy` im Reasoner-Modul.
//
// VIER KORREKTUREN GEGENÜBER R1, jede an einem belegten BEN-Befund:
//
//  ROT-2  Die `resolutionId` gehört jetzt der SITZUNG und wird persistiert. R1 rief bei jeder
//         Auskunft `newId()` — Status, Sitzung und Consent konnten unmöglich dieselbe Resolution
//         referenzieren. Jetzt wird sie wiederverwendet, solange Policy- und Konfigurationsversion
//         tragen, und bei einem Wechsel KONTROLLIERT erneuert (statt eines Versionsmix).
//  ROT-3  Ablauf wird PERSISTIERT, bevor er den Aufruf abweist. R1 warf in `laden()` bei
//         abgelaufener Sitzung, bevor die Consent-Entwertung darunter überhaupt erreicht war —
//         der gespeicherte Nachweis blieb `granted`. Jetzt wird erst entwertet, dann abgewiesen.
//  ROT-4  Die Inaktivitätsfrist ist GLEITEND: jede erfolgreiche Benutzung schreibt
//         `lastActivityAt` und `expiresAt` fort, begrenzt durch die absolute Maximaldauer.
//  ROT-5  Der Dokumentkontext wird SERVERSEITIG registriert (S4-20 §3). Der Client liefert einen
//         Descriptor, nie die fertige `documentContextId`.

/**
 * DER MANDANT — und eine ehrliche Auskunft darüber, was er heute ist.
 *
 * Der Vertrag verlangt `tenantId`. Das Repository führt kein Mandantenmodell: `auth` kennt Rollen,
 * keinen Tenant. Statt ein Feld zu erfinden, das später falsch belegt wäre, steht hier EIN
 * benannter Einzelmandantenwert — der ehrliche Ist-Zustand einer dedizierten Kundeninstanz und die
 * eine Stelle, die zu ändern ist, wenn es echte Mandanten gibt.
 */
export const KLARA_SINGLE_TENANT_ID = "klarwerk-single-tenant";

/**
 * ZEITLICHE BEGRENZUNG (KW-S4-03 §1.2). Die Architekturregel lautet wörtlich:
 *
 *     sessionExpiresAt = min(inactivityTimeout, absoluteLifetime)
 *
 * BEN ROT-4 hat gezeigt, dass R1 sie nicht erfüllte: `expiresAt` wurde bei der Anlage einmal
 * gerechnet und nie fortgeschrieben. Eine Sitzung, die nach zehn Minuten benutzt wurde, scheiterte
 * sechs Minuten später am fünfzehn Minuten alten Erstellungszeitpunkt — das ist keine Frist seit
 * der letzten Aktivität. Beide Werte sind Betriebsparameter, keine Produktentscheidung.
 */
export const KLARA_SESSION_INACTIVITY_MS = 15 * 60 * 1000;
export const KLARA_SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000;

// BEN-35 Befund 1: hier stand `KLARA_DEFAULT_PAYLOAD_CLASS` — die Payload-Klasse als Konstante des
// SITZUNGSDIENSTES. Genau das war der Fehler: der Dienst kannte die Nutzlastsemantik selbst und
// verglich den Consent gegen seine eigene Annahme statt gegen die verwendete Auflösung. Die Klasse
// gehört zur Auflösung (`KLARA_PAYLOAD_CLASS_QUESTION` in `klara-policy.ts`) und wird von hier nur
// noch GELESEN — über `resolution.effectivePayloadClasses`.

/**
 * DER DOKUMENT-DESCRIPTOR (KW-S4-20 §3). Der Client liefert ein Merkmal, NICHT die Identität.
 *
 * `saved` trägt ein stabiles Merkmal des gespeicherten Dokuments; daraus leitet der Server eine
 * stabile, opake `documentContextId` ab — dasselbe Dokument ergibt dieselbe Id, ohne dass das
 * Merkmal selbst nach aussen wandert. `unsaved` trägt eine zufällige Nonce; daraus entsteht eine
 * TEMPORÄRE Id, die an genau diese Sitzung gebunden ist.
 */
export type KlaraDocumentDescriptor =
  | {
      readonly kind: "saved";
      readonly hostDocumentId?: string | undefined;
      readonly itemId?: string | undefined;
      readonly canonicalUrl?: string | undefined;
    }
  | { readonly kind: "unsaved"; readonly clientDocumentNonce: string };

export interface KlaraBindung {
  readonly actorId: string;
  readonly addinInstanceId: string;
  readonly documentContextId: string;
}

/** Die Reasoner-Lage, aus der die Auflösung entsteht — von der Kompositionswurzel geliefert. */
export interface KlaraPolicyQuelle {
  choice: ReasonerTaskChoice;
  source: ReasonerPolicySource;
  /** `config.effectiveProvider.answer` — die taskbezogene Wahrheit (BEN ROT-1). */
  effectiveAnswerProvider: "cloud" | "local" | "deterministic";
  cloudConfigured: boolean;
  localConfigured: boolean;
  providerLabel: string;
  modelLabel?: string | undefined;
  localProviderLabel?: string | undefined;
}

export interface KlaraSessionServiceDeps {
  readonly repo: KlaraSessionRepo;
  readonly policy: () => KlaraPolicyQuelle | Promise<KlaraPolicyQuelle>;
  readonly now?: () => number;
  readonly newId?: () => string;
}

export type KlaraFehlerCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST";

/**
 * W1 S4 R4 (KW-S4-21 §3) — DER INTERNE KONFLIKTCODE.
 *
 * Er ist ausdrücklich NICHT der Code, der nach aussen geht: `KlaraError.code` bleibt `CONFLICT`,
 * damit die vorhandene Abbildung (`http.ts`, `STATUS_BY_CODE`) unverändert `409` liefert und die
 * Antwort genau `{ error: "CONFLICT", message: … }` lautet. Dieser Wert dient der internen
 * Unterscheidung — Protokoll, Diagnose und Test — und erreicht die Leitung nie.
 */
export const KLARA_SESSION_CONFLICT = "KLARA_SESSION_CONFLICT";

/**
 * Die generische Konfliktmeldung (KW-S4-21 §3). Sie sagt NICHTS darüber, ob die Sitzung existiert,
 * ob Actor, Instanz oder Dokument abweichen, ob eine Resolution erneuert wurde oder ob die Sitzung
 * geschlossen beziehungsweise abgelaufen ist. Wer den Text ändert, muss diese Eigenschaft erhalten.
 */
export const KLARA_SESSION_CONFLICT_MESSAGE =
  "Die Sitzung wurde zwischenzeitlich geändert. Bitte erneut laden und wiederholen.";

export class KlaraError extends Error {
  readonly code: KlaraFehlerCode;

  /** Nur intern (KW-S4-21 §3) — wird nie serialisiert. */
  readonly internalCode: string | undefined;

  constructor(code: KlaraFehlerCode, message: string, internalCode?: string) {
    super(message);
    this.code = code;
    this.name = "KlaraError";
    this.internalCode = internalCode;
  }
}

/** Der eine Weg, einen Sitzungs-CAS-Konflikt zu erzeugen — generisch nach aussen, benannt nach innen. */
function sitzungsKonflikt(): KlaraError {
  return new KlaraError("CONFLICT", KLARA_SESSION_CONFLICT_MESSAGE, KLARA_SESSION_CONFLICT);
}

// ================================================================================================
// W1 S4 R6B (KW-S4-23) — DIE DECKUNG EINER ZUSTIMMUNG
// ================================================================================================
//
// DAS LOCH, das BEN belegt hat: eine Zustimmung konnte auf Auflösung A erteilt worden sein,
// während die Sitzung nach einem Refresh Auflösung B verwendete. Eine aktuelle `sessionRevision`
// beweist NICHT, dass die Zustimmung noch zur tatsächlich verwendeten Policy-/Konfigurationsversion
// passt — KW-S4-23 §2 nennt genau das als No-Go.
//
// DIE ANTWORT IST EINE VOLLSTÄNDIGE FELDPRÜFUNG, KEIN BOOLEAN. `KW-S4-23` §1 zählt neun Bindungen
// auf; alle neun werden hier geprüft, und das Ergebnis benennt bei Abweichung die BETROFFENEN
// FELDER. Ein `boolean` könnte „nicht gedeckt" nicht von „gar nicht vorhanden" unterscheiden, und
// genau diese Unterscheidung entscheidet über die Fehlerform (§4).

/** Der fachliche Grund, warum externe Ausführung nicht gedeckt ist (KW-S4-23 §4). */
export const KLARA_CONSENT_RECONFIRMATION_REQUIRED = "CONSENT_RECONFIRMATION_REQUIRED";

export type KlaraDeckungsGrund =
  /** Es gibt gar keine Zustimmung zu dieser Sitzung. */
  | "kein_consent"
  /** Es gibt eine, sie ist aber nicht (mehr) erteilt. */
  | "nicht_erteilt"
  /** Sie ist erteilt, aber abgelaufen. */
  | "abgelaufen"
  /** Sie stammt aus Altbestand und trägt nicht alle Bindungen — unklare Kompatibilität (§4). */
  | "bindung_unvollstaendig"
  /** Sie ist vollständig, weicht aber in mindestens einem gebundenen Feld ab. */
  | "bindung_abweichend";

/**
 * Das Ergebnis der Deckungsprüfung. BEWUSST eine unterscheidbare Summe und kein `boolean`:
 * KW-S4-23 No-Go 1 lautet wörtlich „Consent nur als Boolean behandeln".
 */
export type KlaraConsentDeckung =
  | { readonly gedeckt: true; readonly consentId: string }
  | {
      readonly gedeckt: false;
      readonly grund: KlaraDeckungsGrund;
      /** Die Namen der abweichenden Bindungen — leer, wenn es gar keine Zustimmung gibt. */
      readonly abweichungen: readonly string[];
    };

/**
 * DER MENGENSTABILE SCHLÜSSEL EINER NUTZLASTKLASSEN-MENGE (BEN-35 Befund 1).
 *
 * Reihenfolge und Dubletten sind Schreibweisen derselben Menge. Eine Zustimmung an einer
 * Schreibweise scheitern zu lassen wäre so falsch, wie eine echte Abweichung durchzulassen —
 * deshalb wird normalisiert und nicht bloss sortiert.
 *
 * WARUM HIER UND NICHT IM RESOLVER: Der Resolver NENNT die Klassen, das Gate VERGLEICHT sie. Die
 * Normalisierung gehört zum Vergleich. (Der praktische Grund steht daneben: `services/reasoner`
 * ist nur über seine `index.ts` erreichbar, und die liegt ausserhalb dieses Auftragsscopes — eine
 * dort nicht ausgeleitete Hilfsfunktion wäre von hier gar nicht importierbar.)
 */
function payloadKlassenSchluessel(klassen: readonly string[]): string {
  return [...new Set(klassen.map((k) => k.trim()))].sort().join(",");
}

/**
 * DIE EINE STELLE, an der entschieden wird, ob eine Zustimmung die verwendete Auflösung deckt.
 *
 * Sie ist rein und ohne Nebenwirkung, damit sie an BEIDEN Orten dieselbe Antwort gibt: bei der
 * Statusauskunft und beim finalen Ausführungstor. Zwei Auslegungen derselben Regel wären genau der
 * Fehler, den KW-S4-23 abstellt.
 *
 * ABLAUF wird gegen `jetzt` geprüft und nicht gegen die Sitzung: eine Zustimmung kann vor der
 * Sitzung enden, und dann deckt sie nichts mehr, auch wenn die Sitzung noch lebt.
 */
export function pruefeConsentDeckung(
  consent: KlaraConsent | undefined,
  session: KlaraSession,
  resolution: KlaraResolution,
  jetzt: number,
): KlaraConsentDeckung {
  if (!consent) {
    return { gedeckt: false, grund: "kein_consent", abweichungen: [] };
  }
  if (consent.status !== "granted") {
    return { gedeckt: false, grund: "nicht_erteilt", abweichungen: [] };
  }
  // Altbestand aus R2..R6A trägt `providerReference` nicht. Das ist NICHT „passt schon", sondern
  // unklare Kompatibilität — und die ist nach §4 ausdrücklich `blocked`.
  if (consent.providerReference === null) {
    return {
      gedeckt: false,
      grund: "bindung_unvollstaendig",
      abweichungen: ["providerReference"],
    };
  }
  // JOB 1943 · KA5: dieselbe Lage wie eine Zeile höher, für die Add-in-Instanz. Altbestand ohne
  // dieses Feld hat die Instanz nie gebunden; still zu decken hiesse, eine Zustimmung für eine
  // Instanz zu unterstellen, die niemand festgehalten hat.
  if (consent.addinInstanceId === null) {
    return {
      gedeckt: false,
      grund: "bindung_unvollstaendig",
      abweichungen: ["addinInstanceId"],
    };
  }
  if (jetzt >= Date.parse(consent.expiresAt)) {
    return { gedeckt: false, grund: "abgelaufen", abweichungen: ["expiresAt"] };
  }

  // Die neun Bindungen aus KW-S4-23 §1, jede einzeln benannt.
  const erwartet: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ["resolutionId", consent.resolutionId, resolution.resolutionId],
    ["policyVersion", consent.policyVersion, resolution.policyVersion],
    ["configurationVersion", consent.configurationVersion, resolution.configurationVersion],
    ["provider", consent.providerReference, resolution.provider],
    ["model", consent.modelReference, resolution.model],
    ["providerClass", consent.providerClass, resolution.effectiveMode],
    ["documentContextId", consent.documentContextId, session.documentContextId],
    ["sessionId", consent.sessionId, session.sessionId],
    // JOB 1943 · KA5 — DIE ZEHNTE BINDUNG. Bis hierher deckte eine Zustimmung jede Add-in-Instanz
    // derselben Sitzung mit: die Instanz wurde ausschliesslich in `laden` (`:919`) verglichen, also
    // nur solange, wie dieser Weg davorsteht. Die Zustimmung selbst trägt jetzt, wofür sie gilt.
    ["addinInstanceId", consent.addinInstanceId, session.addinInstanceId],
    // BEN-35 Befund 1: der Sollwert kommt jetzt aus der TATSÄCHLICH VERWENDETEN Auflösung. Bis
    // hierher stand rechts eine hart codierte Klasse — die Prüfung verglich den Consent also mit
    // sich selbst und nicht mit dem, was gesendet würde.
    [
      "effectivePayloadClasses",
      payloadKlassenSchluessel(consent.allowedPayloadClasses),
      payloadKlassenSchluessel(resolution.effectivePayloadClasses),
    ],
  ];
  const abweichungen = erwartet
    .filter(([, ist, soll]) => ist !== soll)
    .map(([feld]) => feld as string);

  if (abweichungen.length > 0) {
    return { gedeckt: false, grund: "bindung_abweichend", abweichungen };
  }
  return { gedeckt: true, consentId: consent.consentId };
}

/**
 * Die Antwort des finalen Ausführungstors (KW-S4-23 §2.3). Auch hier kein `boolean`: der Aufrufer
 * bekommt den GRUND und die Auflösung mit, gegen die geprüft wurde.
 */
export type KlaraAusfuehrungsfreigabe =
  | {
      readonly erlaubt: true;
      readonly resolution: KlaraResolution;
      readonly consentId: string;
    }
  | {
      readonly erlaubt: false;
      /** `CONSENT_RECONFIRMATION_REQUIRED` oder ein Blockierungsgrund der Auflösung selbst. */
      readonly grund: string;
      readonly deckung: KlaraConsentDeckung;
      readonly resolution: KlaraResolution;
    };

/** Die Sicht, die nach aussen geht — ohne interne Policyregeln, ohne Secrets. */
export interface KlaraSessionView {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly addinInstanceId: string;
  readonly documentContextId: string;
  readonly createdAt: string;
  readonly lastActivityAt: string;
  readonly expiresAt: string;
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly consentState: KlaraSession["consentState"];
  readonly closed: boolean;
  readonly resolution: KlaraResolution;
}

export class KlaraSessionService {
  private readonly repo: KlaraSessionRepo;

  private readonly policy: KlaraSessionServiceDeps["policy"];

  private readonly now: () => number;

  private readonly newId: () => string;

  constructor(deps: KlaraSessionServiceDeps) {
    this.repo = deps.repo;
    this.policy = deps.policy;
    this.now = deps.now ?? (() => Date.now());
    this.newId = deps.newId ?? (() => randomUUID());
  }

  // ----------------------------------------------------------------------------------------------
  // DOKUMENTKONTEXT (KW-S4-20 §3)
  // ----------------------------------------------------------------------------------------------

  /**
   * Registriert einen Descriptor zu einer serverseitigen `documentContextId`.
   *
   * GESPEICHERT: stabil abgeleitet, damit dasselbe Dokument in einer neuen Sitzung wiedererkannt
   * wird. Der Hash ist kein Geheimnisschutz, sondern die Trennung von Merkmal und Identität — die
   * URL selbst wandert nie in eine Id, die nach aussen geht (S4-20 §3: „nicht die URL selbst").
   * UNGESPEICHERT: rein zufällig und damit temporär; ein ungespeichertes Dokument HAT kein stabiles
   * Merkmal, und eines zu erfinden wäre eine Behauptung.
   */
  private dokumentkontext(descriptor: KlaraDocumentDescriptor): string {
    if (descriptor.kind === "saved") {
      const merkmal = descriptor.hostDocumentId ?? descriptor.itemId ?? descriptor.canonicalUrl;
      if (!merkmal?.trim()) {
        throw new KlaraError(
          "BAD_REQUEST",
          "Gespeicherter Dokumentkontext braucht hostDocumentId, itemId oder canonicalUrl.",
        );
      }
      return `doc-s-${createHash("sha256").update(merkmal.trim()).digest("hex").slice(0, 32)}`;
    }
    if (!descriptor.clientDocumentNonce?.trim()) {
      throw new KlaraError(
        "BAD_REQUEST",
        "Ungespeicherter Dokumentkontext braucht eine clientDocumentNonce.",
      );
    }
    // Temporär: an DIESE Registrierung gebunden, nie aus der Nonce ableitbar.
    return `doc-t-${this.newId()}`;
  }

  // ----------------------------------------------------------------------------------------------
  // RESOLUTION (BEN ROT-2)
  // ----------------------------------------------------------------------------------------------

  /**
   * Die Auflösung EINER Sitzung — mit stabiler Identität.
   *
   * Solange Policy- und Konfigurationsversion der Sitzung tragen, wird ihre gespeicherte
   * `resolutionId` wiederverwendet. Wechselt eine der beiden, entsteht KONTROLLIERT eine neue Id,
   * die zusammen mit den neuen Versionen an der Sitzung persistiert wird (Pflichtkorrektur 3:
   * „kontrolliert auf eine neue kompatible Resolution binden" statt Versionsmix).
   *
   * Der Rückgabewert trägt die Sitzung mit, weil der Aufrufer den fortgeschriebenen Stand braucht.
   */
  private async aufloesen(
    session: KlaraSession,
    consentGranted: boolean,
  ): Promise<{ session: KlaraSession; resolution: KlaraResolution; quelle: KlaraPolicyQuelle }> {
    const quelle = await this.policy();
    const policyVersion = klaraPolicyVersion(quelle);
    const configurationVersion = klaraConfigurationVersion(quelle);
    const traegt = (s: KlaraSession): boolean =>
      s.resolutionId !== null &&
      s.policyVersion === policyVersion &&
      s.configurationVersion === configurationVersion;

    let gebunden = session;
    if (!traegt(gebunden)) {
      // ==========================================================================================
      // W1 S4 R4 — DER REFRESH IST EIN EIGENER, REVISIONSGEBUNDENER ÜBERGANG (KW-S4-21 §4).
      // ==========================================================================================
      //
      // Bis R3 lief er über den generischen Voll-Schreiber und trug damit den ganzen gelesenen
      // Snapshot mit — ein Refresh, der einen Rebind überlappte, restaurierte dessen alte Bindung.
      // Jetzt fasst er genau drei Felder an und gewinnt nur mit gültiger Revision.
      const werte = { resolutionId: this.newId(), policyVersion, configurationVersion };
      if (await this.repo.refreshResolution(session.sessionId, session.revision, werte)) {
        gebunden = { ...session, ...werte, revision: session.revision + 1 };
      } else {
        // KW-S4-21 §3: GENAU EINMAL neu lesen — und nur wiederholen, wenn die Operation danach
        // semantisch dieselbe und zulässig bleibt.
        const frisch = await this.repo.findSession(session.sessionId);
        if (!frisch) {
          throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
        }
        if (traegt(frisch)) {
          // Ein anderer Übergang hat dieselbe Auflösung bereits gesetzt. Nichts zu tun — die
          // Absicht ist erfüllt, und ein zweiter Schreibversuch wäre eine erfundene Erneuerung.
          gebunden = frisch;
        } else if (frisch.closedAt || this.now() >= Date.parse(frisch.expiresAt)) {
          // Gegenprobe 5: ein alter Refresh darf eine geschlossene oder abgelaufene Sitzung NIE
          // wieder anfassen. Kein Wiederholversuch.
          throw sitzungsKonflikt();
        } else if (await this.repo.refreshResolution(frisch.sessionId, frisch.revision, werte)) {
          gebunden = { ...frisch, ...werte, revision: frisch.revision + 1 };
        } else {
          throw sitzungsKonflikt();
        }
      }
    }

    const resolution = resolveKlaraPolicy({
      ...quelle,
      externalConsentGranted: consentGranted,
      now: this.now(),
      resolutionId: gebunden.resolutionId as string,
    });
    // BEN-35 Befund 3: die benutzte Policyquelle reist MIT. Wer später dieselbe Auflösung noch
    // einmal braucht — etwa mit getragener Zustimmung —, darf sie nicht neu einlesen, sondern
    // bildet sie aus genau diesem Stand.
    return { session: gebunden, resolution, quelle };
  }

  // ----------------------------------------------------------------------------------------------
  // ÖFFENTLICHE OPERATIONEN
  // ----------------------------------------------------------------------------------------------

  /** `POST /api/klara/sessions` — Sitzung und Dokumentkontext registrieren (S4-20 §4). */
  async createSession(
    actorId: string,
    addinInstanceId: string,
    descriptor: KlaraDocumentDescriptor,
  ): Promise<KlaraSessionView> {
    if (!addinInstanceId.trim()) {
      throw new KlaraError("BAD_REQUEST", "addinInstanceId ist erforderlich.");
    }
    const documentContextId = this.dokumentkontext(descriptor);
    const quelle = await this.policy();
    const jetzt = this.now();
    const session: KlaraSession = {
      sessionId: this.newId(),
      tenantId: KLARA_SINGLE_TENANT_ID,
      actorId,
      addinInstanceId: addinInstanceId.trim(),
      documentContextId,
      createdAt: new Date(jetzt).toISOString(),
      lastActivityAt: new Date(jetzt).toISOString(),
      expiresAt: this.ablauf(jetzt, jetzt),
      policyVersion: klaraPolicyVersion(quelle),
      configurationVersion: klaraConfigurationVersion(quelle),
      consentState: "none",
      closedAt: null,
      resolutionId: this.newId(),
      // W1 S4 R4: die Sitzung beginnt bei Revision 0 — derselbe Wert, den die Spalte als Default
      // trägt (Bestandszeilen sind damit sofort teilnahmefähig, ohne Backfill).
      revision: 0,
    };
    await this.repo.insertSession(session);
    const { session: gebunden, resolution } = await this.aufloesen(session, false);
    return this.sicht(gebunden, resolution);
  }

  /**
   * `GET /api/klara/sessions/{id}` — und jede Benutzung schreibt die Frist fort (ROT-4).
   *
   * ============================================================================================
   * W1 S4 R5 (KW-S4-21 §5, BEN-Bericht 24 Abschnitt 3.2/4) — DIE ANTWORT MUSS ZUSAMMENGEHÖREN.
   * ============================================================================================
   *
   * DER BEFUND. R4 hat die SCHREIBSEITE geschlossen: jeder Übergang ist revisionsgebunden, kein
   * veralteter Write kann eine neuere Bindung zurückrollen. Die LESESEITE war es nicht. Diese
   * Methode las Sitzung und Zustimmung EINMAL gemeinsam (`laden`), liess `beruehre` bei einem
   * verlorenen Touch die Sitzung NEU lesen — und baute die Antwort danach trotzdem mit dem
   * Zustimmungsstand von VOR dem Rennen. BEN hat daraus reproduzierbar eine Antwort erzeugt, die
   * gleichzeitig `consentState: "revoked"` und `externalConsentGranted: true` behauptete.
   * Persistenz und Antwort waren beide für sich stimmig — nur nicht miteinander.
   *
   * DIE KORREKTUR, und warum sie so und nicht anders aussieht:
   *
   *   1. DIE ZUSTIMMUNG WIRD ZULETZT GELESEN, nach `laden` und nach `beruehre`. Damit stammt sie
   *      nie aus einem Stand, der älter ist als die Sitzung, mit der sie zusammen ausgeliefert
   *      wird. Das allein genügt nicht — deshalb:
   *   2. VOR DER RESPONSE WIRD DIE VERWENDETE REVISION GEPRÜFT. Ist sie noch die aktuelle, hat
   *      seit dem letzten eigenen Schreibvorgang niemand etwas geändert; Sitzung, Zustimmung und
   *      Auflösung gehören dann nachweislich zusammen. Das ist §5 wörtlich: „Vor der Response
   *      muss die verwendete Revision weiterhin aktuell sein oder der Status neu aufgelöst
   *      werden."
   *   3. IST SIE ES NICHT, WIRD DER GANZE STATUS NEU AUFGELÖST — nicht nachgebessert. Ein
   *      Teil-Nachlesen würde genau die Mischung erzeugen, die hier abgestellt wird.
   *
   * WARUM DIE REVISION ALS PRÜFSTEIN TRÄGT: seit R4 erhöht JEDER zustandsändernde Übergang sie,
   * und jede Änderung an einer Zustimmungszeile geschieht ausschliesslich INNERHALB eines solchen
   * Übergangs (dieselbe Transaktion). Eine unveränderte Revision beweist deshalb nicht nur, dass
   * die Sitzung unverändert ist, sondern auch, dass die Zustimmung es ist.
   *
   * GENAU EIN NEUER ANLAUF (§3). Ein Statusabruf ist idempotent, seine Wiederholung also
   * ausdrücklich zulässig — aber nicht unbegrenzt: bleibt der Stand auch beim zweiten Anlauf
   * unter den Händen unruhig, ist die ehrliche Antwort der generische Konflikt und keine
   * Auskunft, die vielleicht schon wieder überholt ist.
   *
   * KEINE NEUE REPO-OPERATION. Der Auftrag verbietet Änderungen an `klara-policy-store.ts`, und
   * es braucht auch keine: die Prüfung kommt mit `findSession`/`findConsent` aus, und der
   * CAS-Vertrag aus R4 bleibt unangetastet.
   */
  async getSession(sessionId: string, bindung: KlaraBindung): Promise<KlaraSessionView> {
    for (let anlauf = 0; anlauf < 2; anlauf++) {
      const { session } = await this.laden(sessionId, bindung);
      const beruehrt = await this.beruehre(session, bindung);
      // Die Zustimmung ZULETZT — nie aus einem Stand vor dem Touch.
      const consent = await this.repo.findConsent(sessionId);
      // ========================================================================================
      // W1 S4 R6B (KW-S4-23 §2) — DIE AUFLÖSUNG ENTSTEHT ZUERST, DIE DECKUNG DANACH.
      // ========================================================================================
      //
      // Bis R6A stand hier `consent?.status === "granted"` — ein Boolean, gebildet BEVOR die
      // Auflösung feststand. Genau darin lag BENs Loch: `aufloesen` kann die Policy-/
      // Konfigurationsversion erneuern, und der Boolean wusste davon nichts. Er behauptete
      // „Zustimmung liegt vor" für eine Auflösung, die es zum Zeitpunkt der Zustimmung noch gar
      // nicht gab.
      //
      // Jetzt wird ZUERST aufgelöst — bewusst mit `false`, also ohne jede Vorannahme über die
      // Zustimmung — und danach geprüft, ob die vorhandene Zustimmung diese konkrete Auflösung
      // wirklich deckt. Erst das Ergebnis dieser Prüfung geht in die Antwort.
      const {
        session: gebunden,
        resolution: ohneConsent,
        quelle,
      } = await this.aufloesen(beruehrt, false);
      const deckung = pruefeConsentDeckung(consent, gebunden, ohneConsent, this.now());

      // FAIL-SAFE (KW-S4-23 §4): eine noch erteilte, aber nicht mehr deckende Zustimmung wird
      // ENTWERTET — unter CAS, im selben schmalen Übergang wie jeder andere Zustandswechsel. Ohne
      // diesen Schritt bliebe eine Zustimmung liegen, die der Server soeben für unzureichend
      // erklärt hat, und der nächste Aufruf müsste dieselbe Entscheidung neu treffen.
      let stand = gebunden;
      if (!deckung.gedeckt && consent?.status === "granted") {
        const revokedAt = new Date(this.now()).toISOString();
        if (
          await this.repo.invalidateSession(sessionId, stand.revision, {
            consentState: "invalidated",
            revokedAt,
          })
        ) {
          stand = { ...stand, consentState: "invalidated", revision: stand.revision + 1 };
        } else {
          // Ein fremder Write war schneller. Kein zweiter Versuch (KW-S4-21 §3): der Durchlauf
          // wird verworfen und der ganze Status neu aufgelöst.
          continue;
        }
      }

      // Die ausgelieferte Auflösung trägt die GEPRÜFTE Deckung, nicht den Rohzustand — und sie
      // entsteht aus DERSELBEN Policyquelle wie die Deckungsprüfung (BEN-35 Befund 3).
      const resolution = deckung.gedeckt
        ? this.aufloesenOhneSchreiben(stand, true, quelle)
        : ohneConsent;

      const kontrolle = await this.repo.findSession(sessionId);
      if (!kontrolle) {
        throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
      }
      if (kontrolle.revision === stand.revision) {
        return this.sicht(stand, resolution);
      }
      // Zwischenzeitlich hat jemand geschrieben: der ganze Status wird neu aufgelöst.
    }
    throw sitzungsKonflikt();
  }

  /**
   * Dieselbe Auflösung wie `aufloesen`, aber GARANTIERT ohne Schreibvorgang.
   *
   * Sie wird nur aufgerufen, nachdem `aufloesen` die Versionen bereits festgeschrieben hat — es
   * gäbe also nichts mehr zu schreiben. Der eigene Weg macht das zur Zusage statt zur Annahme:
   * ein zweiter Refresh an dieser Stelle würde die Revision erhöhen, die zwei Zeilen später
   * geprüft wird, und die Endkontrolle gegen sich selbst laufen lassen.
   *
   * ============================================================================================
   * BEN-35 BEFUND 3 — DIE POLICYQUELLE WIRD ÜBERGEBEN, NICHT NEU GELESEN.
   * ============================================================================================
   *
   * Bis hierher las diese Methode `this.policy()` selbst. Damit war sie eine DRITTE Auflösung:
   * die Deckung war gegen die zweite geprüft, zurück reiste die dritte. Wechselte die Policy genau
   * in diesem Fenster, trug die Antwort eine Deckungszusage für eine Auflösung, die sie gar nicht
   * enthielt — BENs Gegenprobe C, wörtlich.
   *
   * Der Parameter ist deshalb PFLICHT und nicht optional. Ein optionaler wäre die Einladung, ihn
   * beim nächsten Aufrufer wegzulassen, und der Fehler wäre still zurück.
   */
  private aufloesenOhneSchreiben(
    session: KlaraSession,
    consentGranted: boolean,
    quelle: KlaraPolicyQuelle,
  ): KlaraResolution {
    return resolveKlaraPolicy({
      ...quelle,
      externalConsentGranted: consentGranted,
      now: this.now(),
      resolutionId: session.resolutionId as string,
    });
  }

  /**
   * ============================================================================================
   * W1 S4 R6B (KW-S4-23 §2.3) — DAS FINALE TOR VOR EINER EXTERNEN AUSFÜHRUNG.
   * ============================================================================================
   *
   * WARUM ES DIESE GRENZE GIBT UND KEINE ROUTE. Es existiert heute kein produktiver externer
   * Ausführungsendpunkt (`executionAllowed` ist im Bestand durchgehend `false`, Grund
   * `external_not_migrated`). Einen zu erfinden wäre eine Produktbehauptung; der Auftrag verbietet
   * sie ausdrücklich. Das Tor ist deshalb eine schmale, serverseitig aufrufbare Dienstgrenze —
   * genau der Ort, an dem ein späterer Ausführungsweg sie aufrufen MUSS.
   *
   * ES LIEST FRISCH. Das ist der ganze Sinn: zwischen einer vorherigen Statusauskunft und dem
   * Ausführungsversuch kann alles passiert sein — ein Rebind, ein Widerruf, ein Policywechsel. Ein
   * Tor, das der Auskunft von vorhin glaubt, ist kein Tor.
   *
   * ES GIBT KEINEN BOOLEAN-SHORTCUT (Akzeptanzkriterium 6). Der Rückgabewert trägt den Grund und
   * die geprüfte Auflösung; wer nur `erlaubt` liest, bekommt trotzdem nie ein stilles „ja".
   */
  async pruefeExterneAusfuehrung(
    sessionId: string,
    bindung: KlaraBindung,
  ): Promise<KlaraAusfuehrungsfreigabe> {
    // Frisch laden — dieselbe Bindungsprüfung wie jeder andere Weg (fremde Sitzung ⇒ NOT_FOUND).
    const { session } = await this.laden(sessionId, bindung);
    const {
      session: gebunden,
      resolution: ohneConsent,
      quelle,
    } = await this.aufloesen(session, false);
    const consent = await this.repo.findConsent(sessionId);
    const deckung = pruefeConsentDeckung(consent, gebunden, ohneConsent, this.now());

    if (!deckung.gedeckt) {
      // ==========================================================================================
      // BEN-35 BEFUND 2 — EIN VERLORENES CAS IST KEINE ERLEDIGTE INVALIDIERUNG.
      // ==========================================================================================
      //
      // Bis hierher wurde der Rückgabewert von `invalidateSession` verworfen. Gewann ein fremder
      // Write das Rennen, meldete das Tor trotzdem einen fachlichen Block — und liess Sitzung und
      // Zustimmung persistent `granted` liegen. Die kanonische Reihenfolge aus KW-S4-23 lautet
      // aber „Consent entwerten, DANN blockieren"; wer den ersten Schritt nicht schafft, darf den
      // zweiten nicht als Erfolg verkaufen.
      //
      // Der ehrliche Ausgang ist der VORHANDENE Konfliktvertrag (KW-S4-23 §4 reserviert für einen
      // echten nebenläufigen Session-Write den generischen Konflikt) — kein neuer Fehlerwert und
      // kein zweiter Anlauf: das Tor ist die Stelle, an der im Zweifel NICHT ausgeführt wird.
      if (consent?.status === "granted") {
        const entwertet = await this.repo.invalidateSession(sessionId, gebunden.revision, {
          consentState: "invalidated",
          revokedAt: new Date(this.now()).toISOString(),
        });
        if (!entwertet) {
          throw sitzungsKonflikt();
        }
      }
      return {
        erlaubt: false,
        grund: KLARA_CONSENT_RECONFIRMATION_REQUIRED,
        deckung,
        resolution: ohneConsent,
      };
    }

    // Die Zustimmung deckt. Erst JETZT darf die Auflösung sie tragen — gebildet aus DERSELBEN
    // Policyquelle, gegen die eben geprüft wurde (BEN-35 Befund 3).
    const resolution = this.aufloesenOhneSchreiben(gebunden, true, quelle);
    if (!resolution.executionAllowed) {
      // Die Auflösung selbst blockiert (z. B. `external_not_migrated`). Das ist KEIN
      // Zustimmungsproblem und wird deshalb auch nicht als solches gemeldet.
      return {
        erlaubt: false,
        grund: resolution.blockedReason ?? "execution_not_allowed",
        deckung,
        resolution,
      };
    }
    return { erlaubt: true, resolution, consentId: deckung.consentId };
  }

  /** Die Auflösung zu einer registrierten Sitzung — der einzige Statusweg (S4-20 §6). */
  async statusFor(sessionId: string, bindung: KlaraBindung): Promise<KlaraResolution> {
    return (await this.getSession(sessionId, bindung)).resolution;
  }

  /**
   * `POST .../document-context` — der Rebind aus S4-20 §5.
   *
   * Er ist ausdrücklich KEIN stilles Umschreiben: die alte Resolution wird entwertet und eine
   * bestehende Zustimmung verworfen. Ein temporärer Kontext, der gespeichert wird, ist ein ANDERER
   * Dokumentkontext — eine Zustimmung, die für den alten galt, gilt für den neuen nicht.
   */
  async rebindDocumentContext(
    sessionId: string,
    bindung: KlaraBindung,
    descriptor: KlaraDocumentDescriptor,
  ): Promise<KlaraSessionView> {
    const { session, consent } = await this.laden(sessionId, bindung);
    const neuerKontext = this.dokumentkontext(descriptor);
    const jetzt = this.now();
    // ============================================================================================
    // W1 S4 R4 (KW-S4-21 §6) — EIN SCHRITT STATT ZWEI.
    // ============================================================================================
    //
    // Bis R3 schrieb der Rebind zuerst `resolutionId: null` und liess `aufloesen` die neue
    // Identität in einem ZWEITEN Write nachtragen. Dazwischen lag ein Fenster, in dem eine aktive
    // Sitzung ohne Resolution im Bestand stand — der R1-Altbestandszustand, mitten im Betrieb.
    // Die neue Auflösung wird deshalb VOR dem Schreiben gebildet und reist mit; die Ablage setzt
    // Bindung, Resolution, Versionen, Fristen und die Consent-Entwertung in EINER Transaktion.
    const quelle = await this.policy();
    // Bewusst ohne benannte Typannotation: `KlaraRebindWerte` ist im Store deklariert, aber die
    // Modul-Fassade `services/reasoner/index.ts` liegt AUSSERHALB des Auftragsscope und wird nicht
    // angefasst. Die strukturelle Prüfung am Aufruf unten leistet dasselbe.
    const werte = {
      documentContextId: neuerKontext,
      resolutionId: this.newId(),
      policyVersion: klaraPolicyVersion(quelle),
      configurationVersion: klaraConfigurationVersion(quelle),
      lastActivityAt: new Date(jetzt).toISOString(),
      expiresAt: this.ablauf(Date.parse(session.createdAt), jetzt),
      consentState: (consent ? "invalidated" : "none") as KlaraSession["consentState"],
      revokedAt: new Date(jetzt).toISOString(),
    };
    // KW-S4-21 §3: für den Rebind gibt es KEINEN automatischen Wiederholversuch. Er ist eine
    // Benutzerentscheidung über die Bindung; ein stiller zweiter Anlauf auf einem fremden neuen
    // Zustand würde genau die Entscheidung überschreiben, die inzwischen jemand anders getroffen hat.
    if (!(await this.repo.rebindSession(sessionId, session.revision, werte))) {
      throw sitzungsKonflikt();
    }
    const umgebunden: KlaraSession = {
      ...session,
      documentContextId: werte.documentContextId,
      resolutionId: werte.resolutionId,
      policyVersion: werte.policyVersion,
      configurationVersion: werte.configurationVersion,
      lastActivityAt: werte.lastActivityAt,
      expiresAt: werte.expiresAt,
      consentState: werte.consentState,
      revision: session.revision + 1,
    };
    // Kein zweiter Schreibweg: die Auflösung wird aus denselben Werten gebildet, die soeben
    // committet wurden — `aufloesen` hätte hier nichts mehr zu tun und dürfte nichts mehr tun.
    const resolution = resolveKlaraPolicy({
      ...quelle,
      externalConsentGranted: false,
      now: jetzt,
      resolutionId: werte.resolutionId,
    });
    return this.sicht(umgebunden, resolution);
  }

  /** `POST .../consent` — Zustimmung AUSSCHLIESSLICH für externe KI (KW-S4-04 §99). */
  async grantConsent(sessionId: string, bindung: KlaraBindung): Promise<KlaraSessionView> {
    const { session } = await this.laden(sessionId, bindung);
    const beruehrt = await this.beruehre(session, bindung);
    const { session: gebunden, resolution } = await this.aufloesen(beruehrt, false);
    if (resolution.effectiveMode !== "external") {
      throw new KlaraError(
        "CONFLICT",
        `Zustimmung ist nur für externe KI möglich (aktueller Modus ${resolution.effectiveMode}).`,
      );
    }
    const jetzt = this.now();
    const consent: KlaraConsent = {
      consentId: this.newId(),
      sessionId: gebunden.sessionId,
      tenantId: gebunden.tenantId,
      actorId: gebunden.actorId,
      documentContextId: gebunden.documentContextId,
      consentScope: "session",
      // BEN-35 Befund 1: die Zustimmung bindet, was die Auflösung TATSÄCHLICH versenden würde —
      // dieselbe Herkunft wie Anbieter, Modell und Versionen eine Zeile weiter unten. Eine hart
      // codierte Klasse hätte eine Bindung behauptet, die von der Auflösung gar nicht kommt.
      allowedPayloadClasses: [...resolution.effectivePayloadClasses],
      providerClass: resolution.effectiveMode,
      providerBindingId: resolution.configurationVersion,
      modelReference: resolution.model,
      // W1 S4 R6B (KW-S4-23 §1): der Anbieter selbst, nicht nur seine Klasse.
      providerReference: resolution.provider,
      // JOB 1943 · KA5: die Instanz, FUER DIE zugestimmt wird — aus der GEBUNDENEN Sitzung, nicht
      // aus der Bindung des Aufrufs. `laden` hat beide soeben abgeglichen (`:919`); die gebundene
      // Sitzung ist die Quelle, die auch alle anderen Kontextfelder hier speisen.
      addinInstanceId: gebunden.addinInstanceId,
      policyVersion: resolution.policyVersion,
      configurationVersion: resolution.configurationVersion,
      grantedAt: new Date(jetzt).toISOString(),
      // Die Zustimmung überlebt die Sitzung nie — sie endet spätestens mit ihr.
      expiresAt: gebunden.expiresAt,
      revokedAt: null,
      status: "granted",
      // BEN ROT-2: dieselbe Resolution wie Sitzung und Status.
      resolutionId: resolution.resolutionId,
    };
    // W1 S4 R4: ATOMAR und REVISIONSGEBUNDEN. Sitzungszustand und Zustimmungszeile entstehen in
    // einer Transaktion; die R2-Zusage „höchstens eine wirksame Zustimmung" trägt unverändert
    // weiter (Entwertung im selben Schritt plus partieller Unique-Index). Neu ist die Revision:
    // ein Grant, dessen gelesener Stand von einem Rebind überholt wurde, gewinnt nicht mehr —
    // sonst hinge die frische Zustimmung am alten Dokumentkontext (Gegenprobe 2).
    if (!(await this.repo.grantConsent(gebunden.sessionId, gebunden.revision, consent))) {
      throw sitzungsKonflikt();
    }
    const aktualisiert: KlaraSession = {
      ...gebunden,
      consentState: "granted",
      revision: gebunden.revision + 1,
    };
    const { session: fertig, resolution: mitConsent } = await this.aufloesen(aktualisiert, true);
    await this.antwortstandPruefen(sessionId, fertig);
    return this.sicht(fertig, mitConsent);
  }

  /** `DELETE .../consent` — Widerruf wirkt SOFORT (KW-S4-04 §219). */
  async revokeConsent(sessionId: string, bindung: KlaraBindung): Promise<KlaraSessionView> {
    const { session } = await this.laden(sessionId, bindung);
    const jetzt = this.now();
    const werte = {
      lastActivityAt: new Date(jetzt).toISOString(),
      // ROT-4: auch der Widerruf ist eine Benutzung und schreibt die Frist fort.
      expiresAt: this.ablauf(Date.parse(session.createdAt), jetzt),
      revokedAt: new Date(jetzt).toISOString(),
    };
    // W1 S4 R4: Sitzungszustand und Zustimmungszeile in einer Transaktion, revisionsgebunden.
    // Kein automatischer Wiederholversuch (KW-S4-21 §3) — Widerruf und Erteilung sind beide
    // Benutzerentscheidungen; genau eine darf gewinnen, die andere bekommt einen Konflikt
    // (Gegenprobe 3).
    if (!(await this.repo.revokeConsent(sessionId, session.revision, werte))) {
      throw sitzungsKonflikt();
    }
    const aktualisiert: KlaraSession = {
      ...session,
      consentState: "revoked",
      lastActivityAt: werte.lastActivityAt,
      expiresAt: werte.expiresAt,
      revision: session.revision + 1,
    };
    const { session: gebunden, resolution } = await this.aufloesen(aktualisiert, false);
    await this.antwortstandPruefen(sessionId, gebunden);
    return this.sicht(gebunden, resolution);
  }

  /** `POST .../close` — Sitzung schliessen; die Zustimmung wird unwirksam. */
  async closeSession(sessionId: string, bindung: KlaraBindung): Promise<KlaraSessionView> {
    const { session } = await this.laden(sessionId, bindung);
    const jetzt = this.now();
    const werte = {
      closedAt: new Date(jetzt).toISOString(),
      lastActivityAt: new Date(jetzt).toISOString(),
    };
    // W1 S4 R4: revisionsgebunden und ohne Wiederholversuch. Gegenprobe 4 hängt daran: ein
    // Aktivitäts-Write, der das Schliessen überholt, darf die Sitzung nie wieder verlängern —
    // und ein Schliessen auf veraltetem Stand darf keinen neueren Übergang überschreiben.
    if (!(await this.repo.closeSession(sessionId, session.revision, werte))) {
      throw sitzungsKonflikt();
    }
    const geschlossen: KlaraSession = {
      ...session,
      consentState: "invalidated",
      closedAt: werte.closedAt,
      lastActivityAt: werte.lastActivityAt,
      revision: session.revision + 1,
    };
    const { session: gebunden, resolution } = await this.aufloesen(geschlossen, false);
    await this.antwortstandPruefen(sessionId, gebunden);
    return this.sicht(gebunden, resolution);
  }

  /**
   * W1 S4 R5 — DIE LETZTE PRÜFUNG VOR DER RESPONSE (KW-S4-21 §5).
   *
   * Sie beantwortet genau eine Frage: gilt die Revision, aus der diese Antwort gebaut wurde,
   * überhaupt noch? Wenn ja, gehören Sitzung, Zustimmung und Auflösung nachweislich zusammen —
   * denn seit R4 erhöht jeder Zustandsübergang die Revision, und jede Änderung an einer
   * Zustimmungszeile geschieht ausschliesslich innerhalb eines solchen Übergangs.
   *
   * WARUM HIER KEIN NEUER ANLAUF FOLGT, anders als beim Statusabruf: Grant, Widerruf und
   * Schliessen sind Benutzerentscheidungen. Sie zu wiederholen hiesse, eine zwischenzeitlich
   * getroffene fremde Entscheidung zu überschreiben — genau das verbietet KW-S4-21 §3. Ihr
   * Schreibvorgang ist bereits committet und bleibt gültig; nur die AUSKUNFT darüber wäre
   * möglicherweise schon überholt, und dann ist der generische Konflikt die ehrliche Antwort.
   */
  private async antwortstandPruefen(sessionId: string, verwendet: KlaraSession): Promise<void> {
    const kontrolle = await this.repo.findSession(sessionId);
    if (!kontrolle) {
      throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
    }
    if (kontrolle.revision !== verwendet.revision) {
      throw sitzungsKonflikt();
    }
  }

  // ----------------------------------------------------------------------------------------------
  // DIE PRÜFUNG, DIE ALLES TRÄGT
  // ----------------------------------------------------------------------------------------------
  //
  // Sie beantwortet in einem Zug: existiert die Sitzung, gehört sie DIESEM Aufrufer, lebt sie noch,
  // und gilt die Zustimmung überhaupt noch?
  //
  // DIE REIHENFOLGE IST DIE KORREKTUR (BEN ROT-3). R1 warf bei abgelaufener Sitzung, BEVOR die
  // Consent-Entwertung darunter erreicht war — der Request wurde zwar mit 409 blockiert, aber der
  // gespeicherte Zustimmungsnachweis blieb `granted`. Jetzt wird JEDER Endzustand zuerst
  // PERSISTIERT und erst danach abgewiesen: was in der Datenbank steht, ist wahr, auch wenn niemand
  // mehr fragt.
  //
  // FEHLERFORM: eine fremde Sitzung ist `NOT_FOUND`, nicht `FORBIDDEN`. Ein 403 würde bestätigen,
  // dass es diese sessionId gibt — eine Kennung ist kein Leserecht und keine Existenzauskunft.
  private async laden(
    sessionId: string,
    bindung: KlaraBindung,
  ): Promise<{ session: KlaraSession; consent: KlaraConsent | undefined }> {
    const session = await this.repo.findSession(sessionId);
    if (!session) {
      throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
    }
    const fremd =
      session.actorId !== bindung.actorId ||
      session.addinInstanceId !== bindung.addinInstanceId ||
      session.documentContextId !== bindung.documentContextId;
    if (fremd) {
      throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
    }

    let gueltig = session;
    let consent = await this.repo.findConsent(sessionId);
    const jetzt = this.now();
    const abgelaufen = jetzt >= Date.parse(session.expiresAt);

    // (1) Entwerten — IMMER zuerst, unabhängig davon, ob der Aufruf gleich abgewiesen wird.
    //
    // W1 S4 R4: die Entwertung ist ein eigener, revisionsgebundener Übergang (KW-S4-21 §4) und
    // fasst nur den Zustimmungszustand an — Sitzungszeile und Zustimmungszeile in EINER
    // Transaktion. Verliert sie das Rennen, hat ein anderer Übergang (Widerruf, Schliessen,
    // Rebind) die Zustimmung bereits selbst entwertet; dann wird EINMAL neu gelesen und mit dem
    // frischen Stand weitergearbeitet. Ein zweiter Schreibversuch unterbleibt bewusst: er könnte
    // genau die Entscheidung überschreiben, die inzwischen jemand getroffen hat (Gegenprobe 5).
    const entwerten = async (grund: KlaraConsentStatus): Promise<void> => {
      const revokedAt = new Date(jetzt).toISOString();
      if (
        await this.repo.invalidateSession(sessionId, gueltig.revision, {
          consentState: grund,
          revokedAt,
        })
      ) {
        gueltig = { ...gueltig, consentState: grund, revision: gueltig.revision + 1 };
        consent = consent ? { ...consent, status: grund, revokedAt } : consent;
        return;
      }
      const frisch = await this.repo.findSession(sessionId);
      if (!frisch) {
        throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
      }
      // KW-S4-21 §3 — GENAU EIN Wiederholversuch, und nur wenn die Operation semantisch dieselbe
      // und zulässig bleibt. Zwei Fälle:
      //   · Widerruf, Schliessen oder Rebind war schneller ⇒ die Zustimmung ist bereits entwertet,
      //     es gibt nichts mehr zu tun, und ein zweiter Schreibversuch würde eine fremde
      //     Entscheidung überschreiben (Gegenprobe 5). Er unterbleibt.
      //   · Ein blosser TOUCH war schneller ⇒ er hat die Revision erhöht, ohne die Zustimmung zu
      //     berühren. Die Entwertung ist unverändert nötig und zulässig — sie wird einmal
      //     wiederholt. Ohne diese Wiederholung bliebe die Zeile bis zum nächsten Aufruf
      //     `granted`, obwohl der Server sie soeben für ungültig erklärt hat; genau das war in R1
      //     BEN ROT-3.
      const frischerConsent = await this.repo.findConsent(sessionId);
      if (
        frischerConsent?.status === "granted" &&
        (await this.repo.invalidateSession(sessionId, frisch.revision, {
          consentState: grund,
          revokedAt,
        }))
      ) {
        gueltig = { ...frisch, consentState: grund, revision: frisch.revision + 1 };
        consent = { ...frischerConsent, status: grund, revokedAt };
        return;
      }
      gueltig = frisch;
      consent = frischerConsent;
    };

    if (consent && consent.status === "granted") {
      const quelle = await this.policy();
      const versionsbruch =
        consent.policyVersion !== klaraPolicyVersion(quelle) ||
        consent.configurationVersion !== klaraConfigurationVersion(quelle);
      const consentAbgelaufen = jetzt >= Date.parse(consent.expiresAt);
      const grund: KlaraConsent["status"] | null = session.closedAt
        ? "invalidated"
        : versionsbruch
          ? "invalidated"
          : consentAbgelaufen || abgelaufen
            ? "expired"
            : null;
      if (grund) {
        await entwerten(grund);
      }
    } else if (abgelaufen && session.consentState !== "expired" && !session.closedAt) {
      // Auch ohne Zustimmung wird der Ablauf am Sitzungszustand sichtbar.
      await entwerten("expired");
    }

    // (2) Erst jetzt abweisen — und zwar gegen den FRISCHESTEN bekannten Stand. Hat ein Rebind
    // die Bindung inzwischen gewechselt, trägt die vorgelegte Bindung nicht mehr: dieselbe
    // generische `NOT_FOUND`-Klasse wie eine nie vorhandene Sitzung, keine Sonderauskunft.
    if (
      gueltig.actorId !== bindung.actorId ||
      gueltig.addinInstanceId !== bindung.addinInstanceId ||
      gueltig.documentContextId !== bindung.documentContextId
    ) {
      throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
    }
    if (gueltig.closedAt) {
      throw new KlaraError("CONFLICT", "Sitzung ist geschlossen.");
    }
    if (jetzt >= Date.parse(gueltig.expiresAt)) {
      throw new KlaraError("CONFLICT", "Sitzung ist abgelaufen.");
    }
    return { session: gueltig, consent };
  }

  /**
   * GLEITENDE FRIST (BEN ROT-4). Jede erfolgreiche Benutzung schreibt `lastActivityAt` und
   * `expiresAt` fort — begrenzt durch die absolute Maximaldauer, die dadurch NIE überschritten wird.
   */
  private async beruehre(session: KlaraSession, bindung: KlaraBindung): Promise<KlaraSession> {
    // ============================================================================================
    // W1 S4 R4 (KW-S4-21 §5) — DER TOUCH IST DIE STELLE, AN DER R3 GEBROCHEN IST.
    // ============================================================================================
    //
    // Er schreibt jetzt nur noch `last_activity_at` und `expires_at`, revisionsgebunden. Verliert
    // er, gilt die Dreierregel aus §5 wörtlich: EINMAL neu lesen · bei weiterhin aktiver,
    // identischer Bindung EINMAL wiederholen · bei Rebind, Schliessen, Ablauf oder Invalidierung
    // still verwerfen.
    //
    // „Still verwerfen" heisst NICHT „mit dem alten Stand weiterarbeiten": ab dem Neulesen trägt
    // der frische Stand. Ein verlorener Touch darf beim Client kein Konflikt sein — aber eine
    // fachliche Antwort aus einem veralteten Snapshot darf es erst recht nicht geben.
    const versuch = async (s: KlaraSession): Promise<KlaraSession | undefined> => {
      const jetzt = this.now();
      const lastActivityAt = new Date(jetzt).toISOString();
      const expiresAt = this.ablauf(Date.parse(s.createdAt), jetzt);
      const gewonnen = await this.repo.touchSession(
        s.sessionId,
        s.revision,
        lastActivityAt,
        expiresAt,
      );
      return gewonnen ? { ...s, lastActivityAt, expiresAt, revision: s.revision + 1 } : undefined;
    };

    const erster = await versuch(session);
    if (erster) {
      return erster;
    }
    // (1) genau EINMAL neu lesen
    const frisch = await this.repo.findSession(session.sessionId);
    if (!frisch) {
      throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
    }
    // (3) Rebind → die vorgelegte Bindung trägt nicht mehr; dieselbe generische Klasse wie eine
    // nie vorhandene Sitzung. Schliessen/Ablauf → die vorhandenen, unveränderten Meldungen.
    if (
      frisch.actorId !== bindung.actorId ||
      frisch.addinInstanceId !== bindung.addinInstanceId ||
      frisch.documentContextId !== bindung.documentContextId
    ) {
      throw new KlaraError("NOT_FOUND", "Sitzung nicht gefunden.");
    }
    if (frisch.closedAt) {
      throw new KlaraError("CONFLICT", "Sitzung ist geschlossen.");
    }
    if (this.now() >= Date.parse(frisch.expiresAt)) {
      throw new KlaraError("CONFLICT", "Sitzung ist abgelaufen.");
    }
    // (2) identische aktive Bindung → GENAU EIN Wiederholversuch. Scheitert auch der, wird der
    // Touch still verworfen und der frische Stand getragen — kein Konflikt für den Client.
    return (await versuch(frisch)) ?? frisch;
  }

  /** `min(lastActivity + inactivityTimeout, createdAt + absoluteLifetime)` — KW-S4-03 §1.2. */
  private ablauf(createdAtMs: number, lastActivityMs: number): string {
    return new Date(
      Math.min(
        lastActivityMs + KLARA_SESSION_INACTIVITY_MS,
        createdAtMs + KLARA_SESSION_ABSOLUTE_MS,
      ),
    ).toISOString();
  }

  private sicht(session: KlaraSession, resolution: KlaraResolution): KlaraSessionView {
    return {
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      actorId: session.actorId,
      addinInstanceId: session.addinInstanceId,
      documentContextId: session.documentContextId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      policyVersion: session.policyVersion,
      configurationVersion: session.configurationVersion,
      consentState: session.consentState,
      closed: session.closedAt !== null,
      resolution,
    };
  }
}
