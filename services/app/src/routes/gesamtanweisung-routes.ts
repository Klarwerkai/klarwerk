// ================================================================================================
// JOB 4154 · WIKI-GESAMTANWEISUNG — DIE ROUTE. RECHT UND TRANSPORT, SONST NICHTS.
// ================================================================================================
//
// Registrierbares Fastify-Plugin im Muster von `library-routes.ts:1` — mit `Guards` und `sendError`
// aus `../http` und derselben Sichtbarkeitsnaht wie `ko-routes.ts:1092-1107` (`darfSehen` aus
// `../sichtbarkeit`, die EINE Stelle, an der diese Frage fällt).
//
// ================================================================================================
// NOCH NICHT REGISTRIERT — UND WARUM DAS HIER STEHT UND NICHT IN EINER FUSSNOTE
// ================================================================================================
//
// `services/app/src/build-app.ts` ist in diesem Durchgang gesperrt (JOB 4151 und der benannte
// Nachfolger WIKI-GESAMTANWEISUNG-ANSCHLUSS halten sie). Dieses Plugin ist deshalb LAUFFÄHIG, aber
// noch an keiner App angemeldet. Solange das so ist, meldet niemand „in der App erreichbar".
// Geprüft wird es über die Registrierung auf einer frischen Fastify-Instanz
// (`tests/wiki-gesamtanweisung/f8-plugin-registrierung.test.ts`) — jeder Endpunkt wirklich gerufen,
// nicht nur importiert.
//
// ================================================================================================
// WARUM DER DIENST ALS PORT KOMMT UND DIE ANTWORTEN `unknown` SIND
// ================================================================================================
//
// GEMESSEN: `.dependency-cruiser.cjs` (Regel `module-boundaries`) erlaubt einen Cross-Modul-Import
// AUSSCHLIESSLICH über `services/<modul>/index.ts`. Der Gegenstand „Anweisung" wohnt in
// `services/knowledge-object/src/gesamtanweisung-*.ts`, und `services/knowledge-object/index.ts`
// exportiert ihn noch nicht — die Datei gehört dem Nachfolger (Eingang NACHTRAG-2, Abschnitt 4:
// „alle Exporte … liegen in WIKI-GESAMTANWEISUNG-ANSCHLUSS"). Ein tiefer Import von hier wäre ein
// Architekturverstoss, den `./tools/check` rot macht.
//
// Es gibt zwei Auswege, und der eine ist falsch: die Antwortgestalten hier NOCHMAL zu deklarieren
// wäre eine zweite Wahrheit über denselben Gegenstand — dieselbe Klasse Fehler, gegen die
// `sichtbarkeit.ts` und `kanten-service.ts` ausdrücklich gebaut sind.
//
// Der gewählte Weg: ein PORT mit genau den Methoden, die diese Route ruft, und `unknown` als
// Antwortgestalt. Das ist ehrlich — eine HTTP-Route ist ein Transport; WAS in der Antwort steht,
// verantwortet der Dienst, und dort ist es typisiert und geprüft. Dass beide Seiten
// zusammenpassen, ist nicht geglaubt: der Registrierungstest bindet den ECHTEN Dienst an dieses
// Plugin (der TypeScript-Compiler prüft die Zuweisbarkeit) und liest die Felder der echten
// Antworten. Der Nachfolger darf diesen Port ersatzlos durch den Modulimport ersetzen.
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Confidentiality } from "../../../knowledge-object";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// DER PORT
// ================================================================================================

/** Strukturgleich zu `SichtbarkeitsFakten` (`../sichtbarkeit`) — hier nur als Parametertyp. */
export interface AnweisungSichtbarkeitsFakten {
  readonly confidentiality?: Confidentiality | null | undefined;
  readonly author?: string | null | undefined;
}

export type AnweisungSichtbar = (fakten: AnweisungSichtbarkeitsFakten) => boolean;

export interface AnweisungKopfEingabe {
  readonly titel?: string;
  readonly zweck?: string;
  readonly geltungsbereich?: string;
  readonly voraussetzungen?: string;
}

export interface AnweisungBausteinEingabe {
  readonly koId: string;
  readonly koVersion: number;
  readonly nachweisHash: string | null;
  readonly voraussetzung?: string;
}

/**
 * Was diese Route vom Anweisungsdienst braucht — und keine Methode mehr.
 *
 * `sichtbar` reist durch JEDE Methode. Das ist kein Zierrat: der Dienst prüft damit das Recht an
 * JEDEM gebundenen Baustein, nicht einmal an der Anweisung. Eine Methode ohne diesen Parameter
 * wäre eine Tür ohne Schloss.
 */
export interface GesamtanweisungDienstPort {
  anlegen(kopf: AnweisungKopfEingabe, urheber: string): Promise<unknown>;
  lesen(id: string, sichtbar: AnweisungSichtbar): Promise<unknown>;
  kopfAendern(
    id: string,
    version: number,
    kopf: AnweisungKopfEingabe,
    sichtbar: AnweisungSichtbar,
  ): Promise<unknown>;
  bausteinAufnehmen(
    id: string,
    version: number,
    eingabe: AnweisungBausteinEingabe,
    sichtbar: AnweisungSichtbar,
  ): Promise<unknown>;
  reihenfolgeSetzen(
    id: string,
    version: number,
    reihenfolge: readonly string[],
    sichtbar: AnweisungSichtbar,
  ): Promise<unknown>;
  voraussetzungSetzen(
    id: string,
    version: number,
    bausteinId: string,
    text: string | null,
    sichtbar: AnweisungSichtbar,
  ): Promise<unknown>;
  staende(id: string, sichtbar: AnweisungSichtbar): Promise<readonly number[]>;
  vergleichen(
    id: string,
    vonVersion: number,
    bisVersion: number,
    sichtbar: AnweisungSichtbar,
  ): Promise<unknown>;
  vorlegen(id: string, version: number, sichtbar: AnweisungSichtbar): Promise<unknown>;
  entscheiden(
    id: string,
    version: number,
    entscheidung: "angenommen" | "abgelehnt",
    sichtbar: AnweisungSichtbar,
  ): Promise<unknown>;
}

export interface GesamtanweisungRoutesOptions {
  readonly dienst: GesamtanweisungDienstPort;
  readonly guards: Guards;
}

// ================================================================================================
// FEHLER UND EINGABEN
// ================================================================================================

interface AnweisungFehlerFakten {
  readonly code: string;
  readonly message: string;
  readonly aktuell: { readonly stand: string; readonly version: number } | null;
}

function alsFehler(error: unknown): AnweisungFehlerFakten | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }
  const roh = error as { code: unknown; message?: unknown; aktuell?: unknown };
  const aktuell =
    roh.aktuell && typeof roh.aktuell === "object"
      ? (roh.aktuell as { stand?: unknown; version?: unknown })
      : null;
  return {
    code: String(roh.code),
    message: typeof roh.message === "string" ? roh.message : String(roh.code),
    aktuell:
      aktuell && typeof aktuell.stand === "string" && typeof aktuell.version === "number"
        ? { stand: aktuell.stand, version: aktuell.version }
        : null,
  };
}

/**
 * Der eine Antwortweg für jeden Fehler dieser Route.
 *
 * DIE 409 IST EIGEN GEBAUT UND NICHT ÜBER `sendError` GEFÜHRT, und das ist der Kern von F4: der
 * Aufrufer muss den NEUEN Stand erfahren, sonst ist die Ablehnung nicht nachvollziehbar und er
 * probiert es blind noch einmal. `sendError` sendet ausschliesslich `{error, message}` und könnte
 * `stand`/`version` gar nicht mitgeben (`http.ts:157`). Alles andere geht unverändert durch
 * `sendError` — es gibt hier keine zweite Fehlerabbildung.
 *
 * KEINE GESCHÜTZTEN AUSKÜNFTE: `stand` und `version` gehören der ANWEISUNG, die der Aufrufer
 * gerade bearbeitet. Titel, Kennungen oder Zahlen fremder Einträge stehen in keiner Antwort dieser
 * Datei — die Meldungen des Dienstes sind darauf angelegt (`gesamtanweisung-service.ts`).
 */
function antworteMitFehler(reply: FastifyReply, error: unknown): void {
  const fakten = alsFehler(error);
  if (fakten?.code === "CONFLICT" && fakten.aktuell) {
    reply.code(409).send({
      error: "CONFLICT",
      message: fakten.message,
      stand: fakten.aktuell.stand,
      version: fakten.aktuell.version,
    });
    return;
  }
  sendError(reply, error);
}

function koerper(request: FastifyRequest): Record<string, unknown> {
  return request.body && typeof request.body === "object"
    ? (request.body as Record<string, unknown>)
    : {};
}

function text(wert: unknown): string | undefined {
  return typeof wert === "string" ? wert : undefined;
}

/**
 * Die Version aus dem Körper — PFLICHT bei jedem Schreibweg.
 *
 * Ohne sie gäbe es keinen bedingten Schreibzugriff, und „Änderung während der Entscheidung" (F4)
 * wäre nicht erkennbar. Eine fehlende Version wird deshalb NICHT still auf den aktuellen Stand
 * ergänzt — das wäre genau das blinde Überschreiben, das hier verhindert werden soll.
 */
function version(wert: unknown): number | null {
  return typeof wert === "number" && Number.isInteger(wert) && wert > 0 ? wert : null;
}

function kopfAus(body: Record<string, unknown>): AnweisungKopfEingabe {
  const felder = ["titel", "zweck", "geltungsbereich", "voraussetzungen"] as const;
  const kopf: Record<string, string> = {};
  for (const feld of felder) {
    const wert = text(body[feld]);
    if (wert !== undefined) {
      kopf[feld] = wert;
    }
  }
  return kopf;
}

/**
 * Die Sichtbarkeitsentscheidung dieses Aufrufers — gebildet aus `darfSehen` und sonst nichts.
 *
 * Sie wird als DATUM übergeben, nicht als Flag: seit mega74/Variante A hängt die Sichtbarkeit auch
 * am Autor, und ein Boolescher Wert könnte „vertrauliches, aber eigenes Objekt" nicht ausdrücken
 * (`sichtbarkeit.ts:101-104`).
 */
function sichtbarFuer(user: SessionUser): AnweisungSichtbar {
  return (fakten) =>
    darfSehen(user, {
      confidentiality: fakten.confidentiality ?? null,
      author: fakten.author ?? null,
    });
}

// ================================================================================================
// DAS PLUGIN
// ================================================================================================
//
// DIE RECHTEZUORDNUNG IST DIE BESTEHENDE — keine neue Rolle, keine Vier-Augen-Regel:
//   lesen                                   `ko.read`      (wie /api/kos/:id/versions)
//   anlegen, ändern, aufnehmen, ordnen,
//   vorlegen                                `ko.create`    („Einreichen ohne Freigaberecht")
//   entscheiden                             `ko.validate`  („direkte Freigabe durch Berechtigte")
//
// Die Zuordnung stammt wörtlich aus dem Startvertrag, Abschnitt „Entscheidung": „Bestehende
// Berechtigungen bleiben maßgeblich: direkte Freigabe durch Berechtigte, Einreichen ohne
// Freigaberecht, freiwillige Zweitprüfung. Keine neue obligatorische Vier-Augen-Regel."
export const gesamtanweisungRoutes: FastifyPluginAsync<GesamtanweisungRoutesOptions> = async (
  app,
  options,
) => {
  const { dienst, guards } = options;

  app.post("/api/gesamtanweisungen", async (request, reply) => {
    const user = await guards.requirePermission("ko.create", request, reply);
    if (!user) {
      return;
    }
    try {
      reply.code(201).send(await dienst.anlegen(kopfAus(koerper(request)), user.id));
    } catch (error) {
      antworteMitFehler(reply, error);
    }
  });

  app.get<{ Params: { id: string } }>("/api/gesamtanweisungen/:id", async (request, reply) => {
    const user = await guards.requirePermission("ko.read", request, reply);
    if (!user) {
      return;
    }
    try {
      reply.code(200).send(await dienst.lesen(request.params.id, sichtbarFuer(user)));
    } catch (error) {
      antworteMitFehler(reply, error);
    }
  });

  // PUT und nicht PATCH: der Client-Baustein `apps/web/src/api/client.ts` kennt kein PATCH, und
  // `client.ts` gehört nicht zu diesem Auftrag. Derselbe Weg wie `PUT /api/kos/:id`.
  app.put<{ Params: { id: string } }>("/api/gesamtanweisungen/:id", async (request, reply) => {
    const user = await guards.requirePermission("ko.create", request, reply);
    if (!user) {
      return;
    }
    const body = koerper(request);
    const stand = version(body.version);
    if (stand === null) {
      reply.code(400).send({ error: "VALIDATION", message: "Der gelesene Stand fehlt." });
      return;
    }
    try {
      reply
        .code(200)
        .send(
          await dienst.kopfAendern(request.params.id, stand, kopfAus(body), sichtbarFuer(user)),
        );
    } catch (error) {
      antworteMitFehler(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/gesamtanweisungen/:id/bausteine",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const body = koerper(request);
      const stand = version(body.version);
      const koId = text(body.koId);
      const koVersion = body.koVersion;
      if (stand === null || !koId || typeof koVersion !== "number") {
        reply
          .code(400)
          .send({ error: "VALIDATION", message: "Eintrag, Fassung oder Stand fehlen." });
        return;
      }
      const voraussetzung = text(body.voraussetzung);
      try {
        reply.code(200).send(
          await dienst.bausteinAufnehmen(
            request.params.id,
            stand,
            {
              koId,
              koVersion,
              nachweisHash: text(body.nachweisHash) ?? null,
              ...(voraussetzung === undefined ? {} : { voraussetzung }),
            },
            sichtbarFuer(user),
          ),
        );
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );

  app.put<{ Params: { id: string } }>(
    "/api/gesamtanweisungen/:id/reihenfolge",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const body = koerper(request);
      const stand = version(body.version);
      const reihenfolge = Array.isArray(body.reihenfolge)
        ? body.reihenfolge.filter((w): w is string => typeof w === "string")
        : null;
      if (stand === null || !reihenfolge) {
        reply.code(400).send({ error: "VALIDATION", message: "Reihenfolge oder Stand fehlen." });
        return;
      }
      try {
        reply
          .code(200)
          .send(
            await dienst.reihenfolgeSetzen(
              request.params.id,
              stand,
              reihenfolge,
              sichtbarFuer(user),
            ),
          );
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );

  app.put<{ Params: { id: string; bausteinId: string } }>(
    "/api/gesamtanweisungen/:id/bausteine/:bausteinId/voraussetzung",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const body = koerper(request);
      const stand = version(body.version);
      if (stand === null) {
        reply.code(400).send({ error: "VALIDATION", message: "Der gelesene Stand fehlt." });
        return;
      }
      try {
        reply.code(200).send(
          await dienst.voraussetzungSetzen(
            request.params.id,
            stand,
            request.params.bausteinId,
            // `null` ist hier eine Angabe und kein Fehlen: „die Voraussetzung entfällt".
            text(body.voraussetzung) ?? null,
            sichtbarFuer(user),
          ),
        );
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/gesamtanweisungen/:id/staende",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply
          .code(200)
          .send({ staende: await dienst.staende(request.params.id, sichtbarFuer(user)) });
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );

  app.get<{ Params: { id: string }; Querystring: { von?: string; bis?: string } }>(
    "/api/gesamtanweisungen/:id/vergleich",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const von = version(Number(request.query.von));
      const bis = version(Number(request.query.bis));
      if (von === null || bis === null) {
        reply
          .code(400)
          .send({ error: "VALIDATION", message: "Es fehlen zwei vergleichbare Stände." });
        return;
      }
      try {
        reply
          .code(200)
          .send(await dienst.vergleichen(request.params.id, von, bis, sichtbarFuer(user)));
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/gesamtanweisungen/:id/vorlegen",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const stand = version(koerper(request).version);
      if (stand === null) {
        reply.code(400).send({ error: "VALIDATION", message: "Der gelesene Stand fehlt." });
        return;
      }
      try {
        reply.code(200).send(await dienst.vorlegen(request.params.id, stand, sichtbarFuer(user)));
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );

  // Das Freigaberecht — und NUR hier. Ein `ko.create`-Konto legt vor; es entscheidet nicht.
  app.post<{ Params: { id: string } }>(
    "/api/gesamtanweisungen/:id/entscheiden",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      const body = koerper(request);
      const stand = version(body.version);
      const entscheidung = body.entscheidung;
      if (stand === null || (entscheidung !== "angenommen" && entscheidung !== "abgelehnt")) {
        reply.code(400).send({ error: "VALIDATION", message: "Entscheidung oder Stand fehlen." });
        return;
      }
      try {
        reply
          .code(200)
          .send(
            await dienst.entscheiden(request.params.id, stand, entscheidung, sichtbarFuer(user)),
          );
      } catch (error) {
        antworteMitFehler(reply, error);
      }
    },
  );
};
