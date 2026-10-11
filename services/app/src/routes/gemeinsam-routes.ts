import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { KnowledgeObject } from "../../../knowledge-object";
import { can } from "../../../rbac";
import {
  EntwurfsFehler,
  type EntwurfsStand,
  type GemeinsamerEntwurf,
  type GemeinsamerEntwurfDienst,
  artikelStand,
  rumpfAusText,
  textAusRumpf,
  uebernahmeAenderung,
} from "../gemeinsamer-entwurf";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// ARTIKEL-GEMEINSAM · DIE TÜREN DES GEMEINSAMEN ENTWURFS (`../gemeinsamer-entwurf.ts`).
// ================================================================================================
//
//   GET  /api/kos/:id/gemeinsam              — Entwurf, gültige Lesefassung und Übernahmeweg
//   POST /api/kos/:id/gemeinsam              — den offenen Entwurf öffnen oder anlegen
//   PUT  /api/kos/:id/gemeinsam              — einen Arbeitsstand speichern (zusammenführen/409)
//   POST /api/kos/:id/gemeinsam/angleichen   — den Entwurf auf die neue Lesefassung heben
//   POST /api/kos/:id/gemeinsam/abschluss    — eine Übernahme oder Einreichung festhalten
//
// KEINE NEUE RECHTEACHSE: jede Tür verlangt `ko.create` — dasselbe Recht wie `revise`, `propose`
// und der Bearbeitungshinweis — und einen Artikel, den der Aufrufer sehen darf (`darfSehen`, sonst
// 404 wie am Detailabruf). Ein Konto, das nur liest, sieht den Entwurf nicht: es liest die gültige
// Fassung. Rolle und Sichtbarkeit werden bei JEDER Anfrage frisch entschieden; ein Rechteentzug
// gilt deshalb ab dem nächsten Speichern.
//
// DER ARTIKEL WIRD HIER NICHT GESCHRIEBEN. Die Übernahme läuft über `PUT /api/kos/:id`
// (`revise` mit `expectedVersion`, bzw. `propose` bei einem freigegebenen Artikel ohne
// Freigaberecht) — mit allen Regeln und Folgearbeiten dieses Wegs. `weg` sagt der Fläche, welcher
// Weg gilt, und `uebernahme.aenderung` genau, was sie dort schickt.
//
// WAS HINAUSGEHT: Namen, keine Kontokennungen und keine E-Mail — `eigen` unterscheidet den eigenen
// Schritt von fremden.

export interface GemeinsamRoutesDeps {
  entwuerfe: GemeinsamerEntwurfDienst;
  /** Die Leseseite des KO-Bestands. */
  kos: { get(id: string): Promise<KnowledgeObject | undefined> };
  /** Die vorhandene sichtbare Nutzerbezeichnung eines Kontos (`undefined`: unbekannt). */
  nutzerName: (nutzerId: string) => Promise<string | undefined>;
  audit?: AuditService;
}

type Weg = "direkt" | "vorschlag";

interface SpeicherRumpf {
  entwurfId?: unknown;
  basisRevision?: unknown;
  titel?: unknown;
  /** Der Inhalt als HTML (einheitlicher Editor). */
  rumpf?: unknown;
  /** Ersatzweise Klartext, je Absatz durch eine Leerzeile getrennt. */
  text?: unknown;
  basisStand?: unknown;
}

interface AngleichRumpf {
  entwurfId?: unknown;
  revision?: unknown;
  aufgeloest?: unknown;
}

interface AbschlussRumpf {
  entwurfId?: unknown;
  revision?: unknown;
  fassung?: unknown;
  vorschlagId?: unknown;
}

function ansicht(e: GemeinsamerEntwurf, betrachter: SessionUser) {
  const beteiligte = e.verlauf
    .map((s) => s.nutzerName)
    .filter((name, i, alle) => alle.indexOf(name) === i);
  const letzter = e.verlauf[e.verlauf.length - 1];
  return {
    id: e.id,
    zustand: e.zustand,
    revision: e.revision,
    basisVersion: e.basisVersion,
    titel: e.stand.titel,
    rumpf: e.stand.rumpf,
    text: textAusRumpf(e.stand.rumpf),
    geaendertAm: e.geaendertAm,
    geaendertVon: letzter?.nutzerName ?? "",
    beteiligte,
    verlauf: e.verlauf.map((s) => ({
      revision: s.revision,
      am: s.am,
      name: s.nutzerName,
      eigen: s.nutzerId === betrachter.id,
      art: s.art,
      ...(s.fassung === undefined ? {} : { fassung: s.fassung }),
      ...(s.vorschlagId === undefined ? {} : { vorschlagId: s.vorschlagId }),
    })),
  };
}

function lesefassung(ko: KnowledgeObject) {
  const { rumpf } = artikelStand(ko);
  return {
    version: ko.version,
    status: ko.status,
    titel: ko.title,
    rumpf,
    text: textAusRumpf(rumpf),
  };
}

function kennung(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.length > 0 && wert.length <= 200 ? wert : undefined;
}

function wegFuer(user: SessionUser, ko: KnowledgeObject): Weg {
  return ko.status === "validiert" && !can(user.role, "users.manage") ? "vorschlag" : "direkt";
}

function ganzzahl(wert: unknown): number | undefined {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 1 ? wert : undefined;
}

/** `{ titel, rumpf }` (HTML) oder ersatzweise `{ titel, text }` (Klartext-Absätze). */
function stand(wert: unknown): EntwurfsStand | undefined {
  if (typeof wert !== "object" || wert === null) {
    return undefined;
  }
  const { titel, rumpf, text } = wert as { titel?: unknown; rumpf?: unknown; text?: unknown };
  if (typeof titel !== "string") {
    return undefined;
  }
  if (typeof rumpf === "string") {
    return { titel, rumpf };
  }
  return typeof text === "string" ? { titel, rumpf: rumpfAusText(text) } : undefined;
}

function entwurfsFehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof EntwurfsFehler) {
    reply.code(e.status).send({ error: e.grund, message: e.message, ...e.details });
    return;
  }
  sendError(reply, e);
}

export function gemeinsamRoutes(deps: GemeinsamRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { entwuerfe, kos, nutzerName, audit } = deps;

  async function sichtbarOder404(
    user: SessionUser,
    id: string,
    reply: FastifyReply,
  ): Promise<KnowledgeObject | undefined> {
    const ko = await kos.get(id);
    if (!ko || !darfSehen(user, ko)) {
      reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
      return undefined;
    }
    return ko;
  }

  async function nutzer(user: SessionUser): Promise<{ id: string; name: string }> {
    return { id: user.id, name: (await nutzerName(user.id)) ?? "" };
  }

  /** Die ganze Lage, wie sie jede Tür nach ihrem Schritt zurückgibt. */
  async function lage(user: SessionUser, ko: KnowledgeObject) {
    const offen = await entwuerfe.offener(ko.id);
    const letzter = offen ? undefined : await entwuerfe.letzter(ko.id);
    const leser = lesefassung(ko);
    const weg = wegFuer(user, ko);
    return {
      entwurf: offen ? ansicht(offen, user) : null,
      abgeschlossen: letzter ? ansicht(letzter, user) : null,
      lesefassung: leser,
      weg,
      uebernahme: offen
        ? {
            revision: offen.revision,
            basisVersion: offen.basisVersion,
            aktuell: offen.basisVersion === ko.version,
            // Ein Vorschlag trägt keinen Titel — eine Titeländerung geht nur über den direkten Weg.
            titelGeht: weg === "direkt" || offen.stand.titel === ko.title,
            aenderung: uebernahmeAenderung(offen.stand),
          }
        : null,
    };
  }

  async function beleg(
    user: SessionUser,
    koId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await audit?.record({ actor: user.id, action, target: koId, payload });
  }

  return async (app) => {
    app.get<{ Params: { id: string } }>("/api/kos/:id/gemeinsam", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const ko = await sichtbarOder404(user, request.params.id, reply);
      if (!ko) {
        return;
      }
      reply.code(200).send(await lage(user, ko));
    });

    app.post<{ Params: { id: string } }>("/api/kos/:id/gemeinsam", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const ko = await sichtbarOder404(user, request.params.id, reply);
      if (!ko) {
        return;
      }
      try {
        const { entwurf, neu } = await entwuerfe.beginne(ko, await nutzer(user));
        if (neu) {
          await beleg(user, ko.id, "gemeinsam.angelegt", {
            entwurf: entwurf.id,
            basisVersion: entwurf.basisVersion,
          });
        }
        reply.code(neu ? 201 : 200).send(await lage(user, ko));
      } catch (e) {
        entwurfsFehler(reply, e);
      }
    });

    app.put<{ Params: { id: string }; Body: SpeicherRumpf }>(
      "/api/kos/:id/gemeinsam",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const ko = await sichtbarOder404(user, request.params.id, reply);
        if (!ko) {
          return;
        }
        const body = request.body ?? {};
        const basisRevision = ganzzahl(body.basisRevision);
        const entwurfId = kennung(body.entwurfId);
        const eingabe = stand(body);
        const basisStand = body.basisStand === undefined ? undefined : stand(body.basisStand);
        if (
          basisRevision === undefined ||
          entwurfId === undefined ||
          eingabe === undefined ||
          (body.basisStand !== undefined && basisStand === undefined)
        ) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message:
              "entwurfId, basisRevision (Ganzzahl ab 1), titel und rumpf (oder text) werden gebraucht; basisStand ist { titel, rumpf }.",
          });
          return;
        }
        try {
          const ergebnis = await entwuerfe.speichere(ko.id, await nutzer(user), {
            entwurfId,
            basisRevision,
            ...eingabe,
            ...(basisStand === undefined ? {} : { basisStand }),
          });
          if (!ergebnis.unveraendert) {
            await beleg(user, ko.id, "gemeinsam.gespeichert", {
              entwurf: ergebnis.entwurf.id,
              revision: ergebnis.entwurf.revision,
              zusammengefuehrt: ergebnis.zusammengefuehrt,
            });
          }
          reply.code(200).send({
            ...(await lage(user, ko)),
            zusammengefuehrt: ergebnis.zusammengefuehrt,
            unveraendert: ergebnis.unveraendert,
          });
        } catch (e) {
          entwurfsFehler(reply, e);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: AngleichRumpf }>(
      "/api/kos/:id/gemeinsam/angleichen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const ko = await sichtbarOder404(user, request.params.id, reply);
        if (!ko) {
          return;
        }
        const body = request.body ?? {};
        const revision = ganzzahl(body.revision);
        const aufgeloest = body.aufgeloest === undefined ? undefined : stand(body.aufgeloest);
        if (revision === undefined || (body.aufgeloest !== undefined && !aufgeloest)) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "revision (Ganzzahl ab 1) wird gebraucht; aufgeloest ist { titel, rumpf }.",
          });
          return;
        }
        const entwurfId = kennung(body.entwurfId);
        try {
          const e = await entwuerfe.gleicheAn(ko, await nutzer(user), {
            revision,
            ...(aufgeloest ? { aufgeloest } : {}),
            ...(entwurfId === undefined ? {} : { entwurfId }),
          });
          await beleg(user, ko.id, "gemeinsam.angeglichen", {
            entwurf: e.id,
            revision: e.revision,
            basisVersion: e.basisVersion,
          });
          reply.code(200).send(await lage(user, ko));
        } catch (e) {
          entwurfsFehler(reply, e);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: AbschlussRumpf }>(
      "/api/kos/:id/gemeinsam/abschluss",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const ko = await sichtbarOder404(user, request.params.id, reply);
        if (!ko) {
          return;
        }
        const body = request.body ?? {};
        const revision = ganzzahl(body.revision);
        const fassung = ganzzahl(body.fassung);
        const vorschlagId =
          typeof body.vorschlagId === "string" && body.vorschlagId.length > 0
            ? body.vorschlagId
            : undefined;
        if (revision === undefined || (fassung === undefined) === (vorschlagId === undefined)) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "revision und genau eines von fassung oder vorschlagId werden gebraucht.",
          });
          return;
        }
        const entwurfId = kennung(body.entwurfId);
        try {
          const e = await entwuerfe.schliesseAb(ko, await nutzer(user), {
            revision,
            ...(fassung === undefined ? {} : { fassung }),
            ...(vorschlagId === undefined ? {} : { vorschlagId }),
            ...(entwurfId === undefined ? {} : { entwurfId }),
          });
          const action = fassung === undefined ? "gemeinsam.eingereicht" : "gemeinsam.uebernommen";
          await beleg(user, ko.id, action, {
            entwurf: e.id,
            revision,
            ...(fassung === undefined ? { vorschlagId } : { fassung }),
            offen: e.zustand === "offen",
          });
          reply.code(200).send(await lage(user, ko));
        } catch (e) {
          entwurfsFehler(reply, e);
        }
      },
    );
  };
}
