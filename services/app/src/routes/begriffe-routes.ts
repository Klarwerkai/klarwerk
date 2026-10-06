// ================================================================================================
// FIRMENWÖRTERBUCH — PFLEGE, NACHSCHLAGEN UND BEGRIFFSHINWEISE (`firmenwoerterbuch.ts`).
// ================================================================================================
//
// RECHTE NACH DER BESTEHENDEN KONTOREGEL, KEINE NEUE ROLLE:
//   · Lesen und Prüfen: `ko.read` — jede Rolle, die Wissen lesen darf, darf auch nachschlagen, was
//     ein Begriff im Haus bedeutet, und ihren eigenen Text gegen den Katalog abgleichen.
//   · Pflegen (anlegen, ändern): `ko.validate` — dieselben Rollen, die über den Beitrag anderer
//     urteilen (controller, admin). Ein Katalogeintrag gilt für alle Texte des Hauses; er wirkt
//     unmittelbar nach dem Speichern, also direkte Annahme durch die berechtigte Person. Es gibt
//     keine zusätzliche Freigabestufe.
//
// UNTERNEHMENSINSTANZ: eine Kundeninstanz ist ein Datenraum (eigene Datenbank, eigene Sitzungen).
// Diese Routen lesen und schreiben ausschliesslich die Ablage ihrer eigenen App; eine Sitzung oder
// Kennung aus einer anderen Instanz findet hier weder Konto noch Eintrag (401 bzw. 404).
//
// KEIN KI-AUFRUF: der Prüfweg ist der deterministische Abgleich aus `firmenwoerterbuch.ts`. Weder
// Reasoner noch Embedder noch externe Suche werden hier erreicht — die Datei importiert sie nicht.
//
// KEINE RÜCKWIRKUNG: keine dieser Routen liest oder schreibt Wissensobjekte. Ein geänderter
// Eintrag ist eine neue Fassung im Katalog; bestehende, freigegebene Inhalte bleiben, was sie sind.
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import {
  BEGRIFF_GRENZEN,
  type BegriffEingabe,
  type BegriffFassung,
  BegriffFehler,
  type BegriffeRepo,
  begriffsHinweise,
  doppelterEintrag,
  pruefeBegriffEingabe,
} from "../firmenwoerterbuch";
import type { Guards } from "../http";

export interface BegriffeRouteDienste {
  begriffe: BegriffeRepo;
  audit?: AuditService;
  /** Uhr für `geaendertAm` — in Tests stellbar. */
  jetzt?: () => Date;
}

const PRUEFEN_BODY_LIMIT = 512 * 1024;

function sortiert(liste: BegriffFassung[]): BegriffFassung[] {
  const name = (b: BegriffFassung): string =>
    (b.bezeichnungen.de?.vorzug ?? b.bezeichnungen.en?.vorzug ?? "").toLocaleLowerCase();
  return liste.sort(
    (a, b) =>
      a.geltungsbereich.localeCompare(b.geltungsbereich) ||
      name(a).localeCompare(name(b)) ||
      a.id.localeCompare(b.id),
  );
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof BegriffFehler) {
    reply.code(400).send({ error: e.code, message: e.message });
    return;
  }
  throw e;
}

export function begriffeRoutes(dienste: BegriffeRouteDienste, guards: Guards): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => new Date());
  return async (app) => {
    // Der Katalog: je Eintrag die gültige Fassung.
    app.get("/api/begriffe", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ begriffe: sortiert(await dienste.begriffe.aktuelle()) });
    });

    // Ein Eintrag mit ALLEN Fassungen — so bleibt jede frühere Fassung zuordenbar.
    app.get<{ Params: { id: string } }>("/api/begriffe/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const fassungen = await dienste.begriffe.fassungen(request.params.id);
      const aktuell = fassungen[fassungen.length - 1];
      if (!aktuell) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Begriff nicht gefunden." });
        return;
      }
      reply.code(200).send({ aktuell, fassungen });
    });

    // Genau die Fassung, auf die sich ein Hinweis bezogen hat — auch nach späteren Änderungen.
    app.get<{ Params: { id: string; version: string } }>(
      "/api/begriffe/:id/fassungen/:version",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const version = Number(request.params.version);
        const fassung = (await dienste.begriffe.fassungen(request.params.id)).find(
          (f) => f.version === version,
        );
        if (!fassung) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Fassung nicht gefunden." });
          return;
        }
        reply.code(200).send(fassung);
      },
    );

    // Anlegen — Version 1.
    app.post<{ Body: unknown }>("/api/begriffe", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      let eingabe: BegriffEingabe;
      try {
        eingabe = pruefeBegriffEingabe(request.body);
      } catch (e) {
        fehler(reply, e);
        return;
      }
      const doppelt = doppelterEintrag(await dienste.begriffe.aktuelle(), eingabe);
      if (doppelt) {
        reply.code(409).send({
          error: "BEGRIFF_DOPPELT",
          message:
            "Im selben Geltungsbereich gibt es bereits einen Eintrag mit dieser Vorzugsbezeichnung. Bitte diesen Eintrag ändern statt einen zweiten anzulegen.",
          vorhanden: doppelt.id,
        });
        return;
      }
      const fassung: BegriffFassung = {
        ...eingabe,
        id: randomUUID(),
        version: 1,
        geaendertVon: user.id,
        geaendertAm: jetzt().toISOString(),
      };
      await dienste.begriffe.lege(fassung);
      await dienste.audit?.record({
        actor: user.id,
        action: "begriff.angelegt",
        target: fassung.id,
        payload: { version: 1, geltungsbereich: fassung.geltungsbereich },
      });
      reply.code(201).send(fassung);
    });

    // Ändern — eine NEUE Fassung. `version` nennt die Fassung, die der Bearbeiter gesehen hat; ist
    // sie nicht mehr die jüngste, wird nichts geschrieben (409) statt still zu überschreiben.
    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/begriffe/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const bisher = await dienste.begriffe.fassungen(request.params.id);
        const aktuell = bisher[bisher.length - 1];
        if (!aktuell) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Begriff nicht gefunden." });
          return;
        }
        const gesehen = (request.body as { version?: unknown } | null)?.version;
        if (typeof gesehen !== "number") {
          reply.code(400).send({
            error: "VERSION_FEHLT",
            message: "Die zuletzt gesehene Version des Eintrags fehlt.",
          });
          return;
        }
        let eingabe: BegriffEingabe;
        try {
          eingabe = pruefeBegriffEingabe(request.body);
        } catch (e) {
          fehler(reply, e);
          return;
        }
        const doppelt = doppelterEintrag(await dienste.begriffe.aktuelle(), eingabe, aktuell.id);
        if (doppelt) {
          reply.code(409).send({
            error: "BEGRIFF_DOPPELT",
            message:
              "Im selben Geltungsbereich gibt es bereits einen anderen Eintrag mit dieser Vorzugsbezeichnung.",
            vorhanden: doppelt.id,
          });
          return;
        }
        const fassung: BegriffFassung = {
          ...eingabe,
          id: aktuell.id,
          version: gesehen + 1,
          geaendertVon: user.id,
          geaendertAm: jetzt().toISOString(),
        };
        const gelegt = gesehen === aktuell.version && (await dienste.begriffe.lege(fassung));
        if (!gelegt) {
          reply.code(409).send({
            error: "VERSION_VERALTET",
            message:
              "Der Eintrag wurde inzwischen geändert. Bitte neu laden und die Änderung erneut vornehmen.",
            aktuelleVersion: aktuell.version,
          });
          return;
        }
        await dienste.audit?.record({
          actor: user.id,
          action: "begriff.geaendert",
          target: fassung.id,
          payload: {
            vorherVersion: aktuell.version,
            version: fassung.version,
            geltungsbereich: fassung.geltungsbereich,
          },
        });
        reply.code(200).send(fassung);
      },
    );

    // Der Abgleich eines Textes. Schreibt nichts, merkt sich nichts, ruft kein Modell.
    app.post<{ Body: { segmente?: unknown; kontext?: unknown } }>(
      "/api/begriffe/pruefen",
      { bodyLimit: PRUEFEN_BODY_LIMIT },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const segmente = request.body?.segmente;
        const kontext = request.body?.kontext;
        const gueltig =
          Array.isArray(segmente) &&
          segmente.length <= BEGRIFF_GRENZEN.segmente &&
          segmente.every((s) => typeof s === "string") &&
          (segmente as string[]).reduce((n, s) => n + s.length, 0) <=
            BEGRIFF_GRENZEN.zeichenGesamt &&
          (kontext === undefined ||
            kontext === null ||
            (typeof kontext === "string" && kontext.length <= BEGRIFF_GRENZEN.kontext));
        if (!gueltig) {
          reply.code(400).send({
            error: "PRUEFUNG_UNGUELTIG",
            message: `Erwartet werden { segmente: string[] (höchstens ${BEGRIFF_GRENZEN.segmente} Segmente, ${BEGRIFF_GRENZEN.zeichenGesamt} Zeichen), kontext?: string }.`,
          });
          return;
        }
        const ergebnis = begriffsHinweise(
          await dienste.begriffe.aktuelle(),
          segmente as string[],
          typeof kontext === "string" ? kontext : null,
        );
        reply.code(200).send(ergebnis);
      },
    );
  };
}
