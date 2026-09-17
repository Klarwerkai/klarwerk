// ================================================================================================
// JOB 4299 · DIE ERWARTUNG DES WORD-RÜCKWEGS — EINMAL AUFGESCHRIEBEN, VON BEIDEN LÄUFEN GELESEN.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. Der Rückweg aus Word wird ab JOB 4299 an ZWEI Ablagen gemessen:
// gegen echtes PostgreSQL (`rueckweg-pg.integration.test.ts`, Q4/Q5) und gegen den Speicherbestand
// (`rueckweg-kalibrierung.test.ts`). Zwei Läufe mit zwei eigenen Zahlen wären zwei Abnahmen, die
// eines Tages Verschiedenes meinen und beide grün sind. Rollen, Ausgangsstand, erwartete
// Fassungsnummern und erwarteter Endzustand stehen deshalb HIER, einmal — genau das Muster von
// `services/knowledge-object/src/repo-pg-kandidaten.integration.test.ts:38-41` („derselbe Massstab,
// zwei Adapter"), das seinen Bestand ebenfalls aus einer geteilten Datei liest.
//
// WAS HIER AUSDRÜCKLICH NICHT STEHT: eine Zusicherung. Diese Datei trägt Daten und den Antrieb der
// echten Route (register/login/propose/decide) — geurteilt wird in den beiden Testdateien. Wer eine
// Zahl hier verstellt, färbt BEIDE rot; das ist der Zweck.
//
// DIE GEMESSENE MATRIX, NICHT DIE VERMUTETE. Der Auftrag beschreibt den Entscheider als „Konto MIT
// `ko.validate`". Am Quelltext nachgeschlagen verlangt die Route aber `users.manage`
// (`services/app/src/routes/ko-routes.ts`, Fall `decide-proposal`), und `users.manage` hat laut
// `services/rbac/src/policy.ts:30-43` allein `admin`. `controller` trägt `ko.validate` und wird
// heute trotzdem abgewiesen. Die Konten unten bilden die Matrix ab, WIE SIE STEHT — der Wechsel
// admin → controller ist Pedis Entscheidung (Auftrag §10) und wird hier nicht vorweggenommen.
import type { FastifyInstance } from "fastify";
import type { Role } from "../../services/auth";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { TRUST_MAX } from "../../services/validation/src/trust";

/** Der ausführliche Inhalt, den der Eintrag VOR dem Vorschlag trägt — das Vergleichsmass. */
export const BESTAND_RUMPF = "<p>Der freigegebene ausführliche Inhalt des Eintrags.</p>";

// ------------------------------------------------------------------------------------------------
// DIE FLIESSTEXTE — JOB 4299 RUNDE 2, NACH BENS BEFUND.
// ------------------------------------------------------------------------------------------------
//
// „Fließtext" heisst `bodyHtml`, und nichts sonst. Runde 1 reichte in Q5 BEIDE Vorschläge OHNE
// `bodyHtml` ein und prüfte danach allein `statement` — BENs gezielte Fließtextlöschung beim
// Übernehmen überlebte deshalb BEIDE Läufe (PostgreSQL-Fall und Kalibrierung blieben grün). Eine
// gemeinsame Erwartungsdatei schützt vor auseinanderlaufenden Zahlen, nicht vor einer gemeinsamen
// Blindstelle; geschlossen wird sie nur dort, wo die Zusicherung steht.
//
// DESHALB TRAGEN A UND B JETZT UNTERSCHEIDBARE RÜMPFE. Der Unterschied ist nicht dekorativ: er ist
// das Messinstrument. Fällt der Fließtext weg, trifft `toBe` nicht mehr; wird A von B überschrieben,
// trifft es ebenfalls nicht — und das Merkmal von B stünde dort, wo nur A stehen darf.

/** Der Fließtext, den Vorschlag A aus Word mitbringt. A gewinnt das Rennen. */
export const Q5_RUMPF_A =
  "<p>Fassung A: Ventil X wird von Hand geschlossen; der Vorgang wird im Schichtbuch protokolliert.</p>";

/** Der Fließtext von Vorschlag B. Er darf nach dem Konflikt NIRGENDS gespeichert sein. */
export const Q5_RUMPF_B =
  "<p>Fassung B: Ventil X wird über die Leitwarte geschlossen; die Leitwarte meldet den Vollzug.</p>";

/** Derselbe Satz ohne Auszeichnung — „ersetzt" heisst, dass er danach NICHT mehr dasteht. */
export const BESTAND_SATZ = "Der freigegebene ausführliche Inhalt des Eintrags.";

/** Ein FREIGEGEBENES Objekt mit ausführlichem Inhalt — der Zustand, den Pedis Regel schützt. */
export function bestandsObjekt(id: string, bodyHtml: string | null): KnowledgeObject {
  return {
    id,
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 99,
    trust: TRUST_MAX,
    status: "validiert",
    version: 1,
    originalAuthor: "admin-1",
    author: "admin-1",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as KnowledgeObject;
}

// ------------------------------------------------------------------------------------------------
// DIE KONTEN
// ------------------------------------------------------------------------------------------------

export interface Pruefkonto {
  readonly name: string;
  readonly email: string;
  readonly passwort: string;
  readonly rolle: Role;
}

/** Das ERSTE Konto der leeren Ablage — nur dieses wird Admin (FR-AUTH-01) und darf entscheiden. */
export const ENTSCHEIDER: Pruefkonto = {
  name: "Entscheidung",
  email: "entscheider@job4299.test",
  passwort: "geheim12345",
  rolle: "admin",
};

/** Der Mensch in Word: er reicht ein und darf NICHT selbst übernehmen. */
export const EINREICHER: Pruefkonto = {
  name: "Einreichung",
  email: "einreicher@job4299.test",
  passwort: "geheim12345",
  rolle: "experte",
};

/**
 * Ein ZWEITER Experte, der den Vorschlag NICHT eingereicht hat.
 *
 * Ohne ihn bliebe Q4 zweideutig: der Einreicher würde auch dann abgewiesen, wenn allein die Regel
 * „den eigenen Vorschlag gibt niemand selbst frei" (`PROPOSAL_OWN`) griffe. Erst ein Fremder ohne
 * Recht zeigt, dass die RECHTEPRÜFUNG abweist.
 */
export const FREMDER_EXPERTE: Pruefkonto = {
  name: "Fremdexpertise",
  email: "fremd@job4299.test",
  passwort: "geheim12345",
  rolle: "experte",
};

/** Der zweite Einreicher der Konfliktprobe (Q5) — sein Vorschlag B verliert das Rennen. */
export const ZWEITER_EINREICHER: Pruefkonto = {
  name: "Zweiteinreichung",
  email: "zweiter@job4299.test",
  passwort: "geheim12345",
  rolle: "experte",
};

/**
 * Ein `controller`: er HAT `ko.validate`, aber nicht `users.manage`.
 *
 * Er steht hier, weil er die Matrix misst, wie sie heute ist — und weil er der Beleg dafür ist,
 * dass die Abweisung von Q4 am RECHT hängt und nicht an der Rolle „experte".
 */
export const PRUEFER_OHNE_VERWALTUNG: Pruefkonto = {
  name: "Pruefung",
  email: "controller@job4299.test",
  passwort: "geheim12345",
  rolle: "controller",
};

export const NEBENKONTEN: readonly Pruefkonto[] = [
  EINREICHER,
  FREMDER_EXPERTE,
  ZWEITER_EINREICHER,
  PRUEFER_OHNE_VERWALTUNG,
];

// ------------------------------------------------------------------------------------------------
// Q4 · RECHTE
// ------------------------------------------------------------------------------------------------

export const Q4 = {
  /** Die Kennung des Prüfobjekts — in beiden Läufen dieselbe. */
  kennung: "job4299-rechte",
  /** Der Stand VOR dem Vorschlag. */
  ausgangsVersion: 1,
  /** Der Text, den der Mensch in Word markiert und einreicht. */
  vorschlagStatement:
    "Bei Überdruck ist Ventil X unverzüglich von Hand zu schließen und der Vorgang zu protokollieren.",
  /** Die Herkunftsangabe des Aufgabenfensters. */
  herkunft: "word_addin",
  /**
   * Der Fließtext, den die KALIBRIERUNG einreicht — dort gibt es keine echte Word-Datei.
   *
   * Der PostgreSQL-Fall reicht stattdessen die echte Word-Auswahl ein und prüft ihre Bildquellen
   * POSITIV nach; die Kalibrierung braucht dafür ihr eigenes, ebenso positiv prüfbares Mass. Runde 1
   * hatte hier nur „enthält den alten Satz NICHT" stehen — das hätte auch ein LEERER Rumpf erfüllt
   * (BENs Korrekturpflicht 3).
   */
  kalibrierungRumpf: "<p>Der überarbeitete ausführliche Inhalt aus der Textverarbeitung.</p>",
  /** Wer heute NICHT entscheiden darf — jeder einzeln gemessen. */
  ohneEntscheidungsrecht: [EINREICHER, FREMDER_EXPERTE, PRUEFER_OHNE_VERWALTUNG] as const,
  /** Die Abweisung der Rechteprüfung, wörtlich am Draht. */
  abweisungHttp: 403,
  abweisungCode: "FORBIDDEN",
  /** Nach JEDEM abgewiesenen Versuch: nichts hat sich bewegt. */
  versionNachAbweisung: 1,
  statusNachAbweisung: "offen",
  /** Erst das Konto MIT dem Recht schreibt die Fassung. */
  uebernahmeHttp: 200,
  versionNachUebernahme: 2,
  statusNachUebernahme: "uebernommen",
} as const;

// ------------------------------------------------------------------------------------------------
// Q5 · KONFLIKT
// ------------------------------------------------------------------------------------------------

export const Q5 = {
  kennung: "job4299-konflikt",
  /** BEIDE Vorschläge beruhen auf derselben Fassung — das ist der Konflikt. */
  basisVersion: 1,
  statementA: "Fassung A: Ventil X wird von Hand geschlossen und der Vorgang protokolliert.",
  statementB: "Fassung B: Ventil X wird über die Leitwarte geschlossen.",
  /** Die Fließtexte beider Vorschläge — unterscheidbar, damit Verlust und Verwechslung auffallen. */
  rumpfA: Q5_RUMPF_A,
  rumpfB: Q5_RUMPF_B,
  /**
   * Was nach der Übernahme von A und AUCH nach der Abweisung von B im Fließtext stehen muss.
   *
   * Geprüft wird mit `toBe`, nicht mit `toContain`: „enthält" wäre schon erfüllt, wenn B seinen Text
   * danebenstellte. Und nicht mit „enthält den alten Satz nicht": das wäre auch bei `null` erfüllt.
   */
  erwarteterRumpfNachKonflikt: Q5_RUMPF_A,
  /**
   * Zwei Sätze, die je NUR in einer der beiden Fassungen vorkommen — und in KEINEM `statement`.
   *
   * Sie trennen die beiden Fehlerbilder: fehlt `merkmalA`, ist der Fließtext verloren gegangen;
   * steht `merkmalB` da, hat der abgewiesene Vorschlag doch geschrieben.
   */
  merkmalA: "im Schichtbuch protokolliert",
  merkmalB: "die Leitwarte meldet den Vollzug",
  /** A gewinnt. */
  uebernahmeHttp: 200,
  versionNachA: 2,
  /** B kommt mit demselben erwarteten Stand — und wird abgewiesen. */
  konfliktHttp: 409,
  konfliktCode: "KO_STALE",
  /** Die Abweisung nennt den JETZT gespeicherten Stand; ohne ihn kann niemand weiterentscheiden. */
  konfliktNenntVersion: 2,
  /** Der Endzustand: 2, NICHT 3 — es ist keine zweite Wahrheit entstanden. */
  erwarteteEndfassung: 2,
  statusA: "uebernommen",
  statusB: "offen",
} as const;

// ------------------------------------------------------------------------------------------------
// DER ANTRIEB DER ECHTEN ROUTE — beide Läufe fahren denselben Weg, nicht zwei ähnliche.
// ------------------------------------------------------------------------------------------------

export type Kopf = Readonly<Record<string, string>>;

function alsText(rumpf: string): string {
  return rumpf.length > 400 ? `${rumpf.slice(0, 400)}…` : rumpf;
}

/**
 * Legt die Konten an: das ERSTE über die Selbstregistrierung (nur so entsteht ein Admin), die
 * übrigen über `POST /api/users` mit ausdrücklicher Rolle.
 *
 * Wird das erste Konto NICHT Admin, war die Nutzertabelle nicht leer. Das ist kein milder Ausfall,
 * sondern der Boden dieser Abnahme — deshalb wirft es hier laut, statt eine Rechteprobe gegen ein
 * Konto zu fahren, dessen Rolle niemand kennt.
 */
export async function richteKontenEin(app: FastifyInstance): Promise<void> {
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: ENTSCHEIDER.name,
      email: ENTSCHEIDER.email,
      password: ENTSCHEIDER.passwort,
    },
  });
  if (registriert.statusCode !== 201) {
    throw new Error(
      `JOB 4299: Entscheiderkonto nicht angelegt (${registriert.statusCode}) — ${alsText(registriert.body)}`,
    );
  }
  const rolle = (registriert.json() as { role?: unknown }).role;
  if (rolle !== ENTSCHEIDER.rolle) {
    throw new Error(
      `JOB 4299: das erste Konto wurde „${String(rolle)}" statt „${ENTSCHEIDER.rolle}" — die Nutzerablage war nicht leer, die Rechteprobe hätte keinen Boden.`,
    );
  }
  const admin = await anmeldung(app, ENTSCHEIDER);
  for (const konto of NEBENKONTEN) {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: {
        name: konto.name,
        email: konto.email,
        password: konto.passwort,
        role: konto.rolle,
      },
    });
    if (angelegt.statusCode !== 201) {
      throw new Error(
        `JOB 4299: Konto ${konto.email} (${konto.rolle}) nicht angelegt (${angelegt.statusCode}) — ${alsText(angelegt.body)}`,
      );
    }
  }
}

/** Anmeldung am echten Weg; der Kopf trägt danach den echten Zugangsschlüssel. */
export async function anmeldung(app: FastifyInstance, konto: Pruefkonto): Promise<Kopf> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: konto.email, password: konto.passwort },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `JOB 4299: Anmeldung ${konto.email} fehlgeschlagen (${antwort.statusCode}) — ${alsText(antwort.body)}`,
    );
  }
  const token = (antwort.json() as { token?: unknown }).token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`JOB 4299: Anmeldung ${konto.email} ohne Zugangsschlüssel.`);
  }
  return { authorization: `Bearer ${token}` };
}

/**
 * Den Vorschlag über die ECHTE Route einreichen und seine Kennung zurückgeben.
 *
 * Die Kennung wird NICHT geraten: die Route antwortet mit dem ganzen Wissensobjekt, und gesucht
 * wird der Vorschlag mit genau diesem Text, der noch offen ist.
 */
export async function reicheVorschlagEin(
  app: FastifyInstance,
  kopf: Kopf,
  id: string,
  vorschlag: { statement: string; bodyHtml?: string; baseVersion: number; origin?: string },
): Promise<string> {
  const antwort = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: kopf,
    payload: {
      action: "propose",
      proposal: {
        statement: vorschlag.statement,
        ...(vorschlag.bodyHtml === undefined ? {} : { bodyHtml: vorschlag.bodyHtml }),
        baseVersion: vorschlag.baseVersion,
        ...(vorschlag.origin === undefined ? {} : { origin: vorschlag.origin }),
      },
    },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `JOB 4299: Vorschlag nicht angenommen (${antwort.statusCode}) — ${alsText(antwort.body)}`,
    );
  }
  const ko = antwort.json() as { proposals?: { id: string; statement: string; status: string }[] };
  const treffer = (ko.proposals ?? []).filter(
    (p) => p.statement === vorschlag.statement && p.status === "offen",
  );
  const letzter = treffer[treffer.length - 1];
  if (!letzter) {
    throw new Error(
      `JOB 4299: die Route hat den Vorschlag angenommen, gibt ihn aber nicht zurück — ${alsText(antwort.body)}`,
    );
  }
  return letzter.id;
}

/** Über einen Vorschlag entscheiden — die Antwort wird UNGEPRÜFT zurückgegeben, geurteilt wird im Test. */
export function entscheide(
  app: FastifyInstance,
  kopf: Kopf,
  id: string,
  proposalId: string,
  expectedVersion: number,
  entscheidung: "uebernehmen" | "ablehnen" = "uebernehmen",
) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: kopf,
    payload: { action: "decide-proposal", proposalId, decision: entscheidung, expectedVersion },
  });
}

/** Der Vorschlag, wie er im ZURÜCKGELESENEN Objekt steht — `undefined`, wenn er verschwunden ist. */
export function vorschlagAus(
  ko: KnowledgeObject | undefined,
  proposalId: string,
): { status: string; resultVersion?: number } | undefined {
  return (ko?.proposals ?? []).find((p) => p.id === proposalId);
}
