import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { KnowledgeObject } from "../../../knowledge-object";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";
import {
  type FragensatzFassung,
  VerstaendnisFehler,
  type VerstaendnisKoLeser,
  type VerstaendnisfragenDienst,
  type Versuch,
  ergebnisKurz,
  gueltigeFassung,
  juengsteFassung,
  lernSicht,
  rueckmeldung,
} from "../verstaendnisfragen";

// ================================================================================================
// VERSTÄNDNISFRAGEN · DIE NEUN TÜREN.
// ================================================================================================
//
//   GET  /api/kos/:id/verstaendnisfragen                 — Fragensätze zum Eintrag        ko.read
//   POST /api/kos/:id/verstaendnisfragen                 — Fragensatz anlegen             ko.create
//   PUT  /api/verstaendnisfragen/:id                     — neue Version (Entwurf)         ko.create
//   POST /api/verstaendnisfragen/:id/vorlegen            — zur Zweitprüfung vorlegen      ko.create
//   POST /api/verstaendnisfragen/:id/entscheiden         — annehmen / zurückweisen        ko.validate
//   POST /api/verstaendnisfragen/:id/versuche            — Versuch abgeben                ko.read
//   GET  /api/verstaendnisfragen/versuche/:versuchId     — Rückmeldung eines Versuchs     ko.read
//   GET  /api/verstaendnisfragen/meine                   — eigene Ergebnisse, Zuordnung   ko.read
//   GET  /api/verstaendnisfragen/:id/ergebnisse          — Übersicht für Zuständige       ko.read
//
// KEINE NEUE ROLLE. Über Bearbeiten und die Ergebnisse anderer entscheidet zusätzlich der Dienst
// (`darfBearbeiten`: Verantwortung am Eintrag oder Freigaberecht). Jede Tür hält den Eintrag VOR
// jeder Antwort gegen `darfSehen` — ein unsichtbarer Eintrag ist hier wie am Detailabruf ein 404.
//
// KEINE RANGLISTE. Die Übersicht für Zuständige ist nach Namen geordnet, nicht nach Ergebnis, und
// steht nur hinter `darfBearbeiten`. Lernende sehen ausschliesslich ihre eigenen Versuche.

export interface VerstaendnisfragenRoutesDeps {
  dienst: VerstaendnisfragenDienst;
  kos: VerstaendnisKoLeser;
}

const FEHLERCODE: Record<VerstaendnisFehler["status"], string> = {
  400: "VALIDATION",
  403: "NICHT_ZUSTAENDIG",
  404: "NOT_FOUND",
  409: "CONFLICT",
  503: "NICHT_HALTBAR",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof VerstaendnisFehler) {
    reply.code(fehler.status).send({
      ...fehler.details,
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

function nichtGefunden(reply: FastifyReply): void {
  reply.code(404).send({ error: "NOT_FOUND", message: "Nicht gefunden." });
}

function eingabeFehler(reply: FastifyReply, message: string): void {
  reply.code(400).send({ error: "VALIDATION", grund: "eingabe", message });
}

function koerper(request: FastifyRequest): Record<string, unknown> {
  return request.body && typeof request.body === "object"
    ? (request.body as Record<string, unknown>)
    : {};
}

function versionAus(wert: unknown): number | null {
  return typeof wert === "number" && Number.isInteger(wert) && wert > 0 ? wert : null;
}

export function verstaendnisfragenRoutes(
  deps: VerstaendnisfragenRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, kos } = deps;

  /** Der Eintrag, wenn dieses Konto ihn sehen darf — sonst `undefined` (Antwort 404). */
  async function sichtbaresKo(
    user: SessionUser,
    koId: string,
  ): Promise<KnowledgeObject | undefined> {
    const ko = await kos.get(koId);
    if (!ko || ko.deletedAt || !darfSehen(user, ko)) {
      return undefined;
    }
    return ko;
  }

  /** Der Fragensatz samt Eintrag, wenn dieses Konto den Eintrag sehen darf — sonst `undefined`. */
  async function sichtbarerSatz(
    user: SessionUser,
    id: string,
  ): Promise<{ fassungen: FragensatzFassung[]; ko: KnowledgeObject } | undefined> {
    const treffer = await dienst.mitKo(id);
    if (!treffer || !darfSehen(user, treffer.ko)) {
      return undefined;
    }
    return treffer;
  }

  /** Was eine Person an EINEM Fragensatz sieht — Lernsicht für alle, Bearbeitung nur für Befugte. */
  async function satzSicht(
    user: SessionUser,
    ko: KnowledgeObject,
    fassungen: FragensatzFassung[],
    eigene: readonly Versuch[],
  ) {
    const gueltig = gueltigeFassung(fassungen);
    const juengste = juengsteFassung(fassungen);
    const gueltigStand = gueltig ? await dienst.quellenstand(ko, gueltig.koVersion) : null;
    const meine = eigene.filter((v) => v.fragensatzId === fassungen[0]?.id);
    const bearbeitung =
      juengste && dienst.darfBearbeiten(user, ko)
        ? {
            ...juengste,
            quellenlage: (await dienst.quellenstand(ko, juengste.koVersion)).lage,
            befunde: await dienst.befunde(juengste, ko),
          }
        : null;
    return {
      id: juengste?.id ?? "",
      titel: (gueltig ?? juengste)?.titel ?? "",
      rollen: (gueltig ?? juengste)?.rollen ?? [],
      gueltig: gueltig ? lernSicht(gueltig) : null,
      quellenlage: gueltigStand?.lage ?? null,
      verbleibend: gueltig ? dienst.verbleibend(gueltig, meine) : null,
      eigeneErgebnisse: meine.map(ergebnisKurz),
      bearbeitung,
    };
  }

  return async (app) => {
    app.get<{ Params: { id: string } }>(
      "/api/kos/:id/verstaendnisfragen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const ko = await sichtbaresKo(user, request.params.id);
          if (!ko) {
            nichtGefunden(reply);
            return;
          }
          const alle = await dienst.fassungenZu(ko.id);
          const saetze = new Map<string, FragensatzFassung[]>();
          for (const f of alle) {
            saetze.set(f.id, [...(saetze.get(f.id) ?? []), f]);
          }
          const darfBearbeiten = dienst.darfBearbeiten(user, ko);
          const eigene = await dienst.versucheVon(user.id);
          const fragensaetze: Awaited<ReturnType<typeof satzSicht>>[] = [];
          for (const fassungen of saetze.values()) {
            // Ohne angenommene Version sieht ein Fragensatz nur, wer ihn bearbeiten darf.
            if (!darfBearbeiten && !gueltigeFassung(fassungen)) {
              continue;
            }
            fragensaetze.push(await satzSicht(user, ko, fassungen, eigene));
          }
          reply.code(200).send({
            koId: ko.id,
            aktuelleFassung: ko.version,
            gueltig: ko.status === "validiert",
            darfBearbeiten,
            darfEntscheiden: dienst.darfEntscheiden(user),
            fragensaetze,
          });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/kos/:id/verstaendnisfragen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const ko = await sichtbaresKo(user, request.params.id);
          if (!ko) {
            nichtGefunden(reply);
            return;
          }
          reply.code(201).send(await dienst.anlegen(user, ko, koerper(request)));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string } }>("/api/verstaendnisfragen/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const body = koerper(request);
      const gelesen = versionAus(body.version);
      if (gelesen === null) {
        eingabeFehler(reply, "Die gelesene Version fehlt.");
        return;
      }
      try {
        const satz = await sichtbarerSatz(user, request.params.id);
        if (!satz) {
          nichtGefunden(reply);
          return;
        }
        reply
          .code(200)
          .send(await dienst.aendern(user, satz.ko, satz.fassungen, gelesen, body.inhalt));
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { id: string } }>(
      "/api/verstaendnisfragen/:id/vorlegen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const version = versionAus(koerper(request).version);
        if (version === null) {
          eingabeFehler(reply, "Die Version fehlt.");
          return;
        }
        try {
          const satz = await sichtbarerSatz(user, request.params.id);
          if (!satz) {
            nichtGefunden(reply);
            return;
          }
          reply.code(200).send(await dienst.vorlegen(user, satz.ko, satz.fassungen, version));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/verstaendnisfragen/:id/entscheiden",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        const body = koerper(request);
        const version = versionAus(body.version);
        const entscheidung =
          body.entscheidung === "annehmen" || body.entscheidung === "zurueckweisen"
            ? body.entscheidung
            : null;
        const begruendung =
          typeof body.begruendung === "string" && body.begruendung.trim().length > 0
            ? body.begruendung.trim().slice(0, 1000)
            : null;
        if (version === null || entscheidung === null) {
          eingabeFehler(reply, "Version oder Entscheidung fehlen.");
          return;
        }
        try {
          const satz = await sichtbarerSatz(user, request.params.id);
          if (!satz) {
            nichtGefunden(reply);
            return;
          }
          reply
            .code(200)
            .send(
              await dienst.entscheiden(
                user,
                satz.ko,
                satz.fassungen,
                version,
                entscheidung,
                begruendung,
              ),
            );
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string } }>(
      "/api/verstaendnisfragen/:id/versuche",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const satz = await sichtbarerSatz(user, request.params.id);
          if (!satz) {
            nichtGefunden(reply);
            return;
          }
          const { versuch, bereits } = await dienst.versuchAbgeben(
            user,
            satz.ko,
            satz.fassungen,
            koerper(request),
          );
          const fassung = satz.fassungen.find((f) => f.version === versuch.fragensatzVersion);
          reply.code(bereits ? 200 : 201).send({ ...rueckmeldung(versuch, fassung), bereits });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get<{ Params: { versuchId: string } }>(
      "/api/verstaendnisfragen/versuche/:versuchId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const versuch = await dienst.versuch(request.params.versuchId);
          const satz = versuch ? await sichtbarerSatz(user, versuch.fragensatzId) : undefined;
          // Den eigenen Versuch sieht die Person selbst, einen fremden nur, wer zuständig ist —
          // beides nur, solange der Eintrag sichtbar ist. Sonst 404, ohne Existenzauskunft.
          if (
            !versuch ||
            !satz ||
            (versuch.personId !== user.id && !dienst.darfBearbeiten(user, satz.ko))
          ) {
            nichtGefunden(reply);
            return;
          }
          const fassung = satz.fassungen.find((f) => f.version === versuch.fragensatzVersion);
          reply.code(200).send(rueckmeldung(versuch, fassung));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get("/api/verstaendnisfragen/meine", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const eigene = await dienst.versucheVon(user.id);
        const zugeordnet = new Map<string, FragensatzFassung[]>();
        for (const f of await dienst.fassungenFuerRolle(user.role)) {
          zugeordnet.set(f.id, [...(zugeordnet.get(f.id) ?? []), f]);
        }
        const ids = new Set([...zugeordnet.keys(), ...eigene.map((v) => v.fragensatzId)]);
        const saetze: Record<string, unknown>[] = [];
        for (const id of ids) {
          const satz = await sichtbarerSatz(user, id);
          if (!satz) {
            continue;
          }
          const gueltig = gueltigeFassung(satz.fassungen);
          const meine = eigene.filter((v) => v.fragensatzId === id);
          // Zugeordnet ist ein Fragensatz, dessen GÜLTIGE Version die Rolle nennt.
          const istZugeordnet = gueltig?.rollen.includes(user.role) ?? false;
          if (!istZugeordnet && meine.length === 0) {
            continue;
          }
          const stand = gueltig ? await dienst.quellenstand(satz.ko, gueltig.koVersion) : null;
          saetze.push({
            fragensatzId: id,
            titel: (gueltig ?? juengsteFassung(satz.fassungen))?.titel ?? "",
            koId: satz.ko.id,
            koTitel: satz.ko.title,
            zugeordnet: istZugeordnet,
            gueltigeVersion: gueltig?.version ?? null,
            quellenlage: stand?.lage ?? null,
            regel: gueltig?.regel ?? null,
            ergebnisse: meine.map(ergebnisKurz),
          });
        }
        reply.code(200).send({ fragensaetze: saetze });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>(
      "/api/verstaendnisfragen/:id/ergebnisse",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const satz = await sichtbarerSatz(user, request.params.id);
          if (!satz) {
            nichtGefunden(reply);
            return;
          }
          if (!dienst.darfBearbeiten(user, satz.ko)) {
            reply.code(403).send({
              error: "NICHT_ZUSTAENDIG",
              grund: "nicht_zustaendig",
              message: "Ergebnisse anderer sieht nur, wer für den Fragensatz zuständig ist.",
            });
            return;
          }
          const namen = await dienst.kontoNamen();
          const versuche = (await dienst.versucheZu(request.params.id)).map((v) => ({
            ...ergebnisKurz(v),
            person: { id: v.personId, name: namen.get(v.personId) ?? null },
          }));
          // Nach Namen, dann nach Zeitpunkt — nie nach Ergebnis: keine Rangliste.
          versuche.sort(
            (a, b) =>
              (a.person.name ?? a.person.id).localeCompare(b.person.name ?? b.person.id) ||
              a.abgegebenAm.localeCompare(b.abgegebenAm),
          );
          reply.code(200).send({
            fragensatzId: request.params.id,
            koId: satz.ko.id,
            versuche,
          });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}
