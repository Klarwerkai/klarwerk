// ================================================================================================
// ADMIN-15 · UNTERNEHMENSPROFIL UND INTERNE RICHTLINIEN — DIE TÜREN (`unternehmensprofil.ts`).
// ================================================================================================
//
// RECHTE NACH DER BESTEHENDEN KONTOREGEL, KEINE NEUE ROLLE:
//   · Lesen des Profils und der eigenen Richtlinien, eigene Kenntnisnahme/Zustimmung: jedes
//     angemeldete Konto (`requireUser`). Welche Richtlinien jemand sieht, entscheidet die Geltung
//     der Fassung (Rollen); eine fremde oder nicht geltende Richtlinie endet im 404.
//   · Profil ändern, Richtlinien veröffentlichen, Wirkung und Protokoll einsehen: `users.manage` —
//     dieselbe Schranke wie die Markenwahl (`branding-routes.ts`) und die übrige Verwaltung.
//
// KEIN LÖSCHWEG. Es gibt hier keine DELETE-Tür: weder für Profilfassungen noch für Richtlinien-
// fassungen noch für Handlungen. Korrigiert wird durch eine neue Fassung.
//
// ANZEIGEN SCHREIBT NICHTS. `GET /api/richtlinien` liest; eine Handlung entsteht nur über
// `POST /api/richtlinien/:id/handlungen`, ausgelöst von der Person selbst.
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { Guards } from "../http";
import {
  LOGO_GRENZEN,
  MIN_KONTRAST,
  NAME_GRENZEN,
  type UnternehmenDienst,
  UnternehmenFehler,
  akzentListe,
  profilAuskunft,
} from "../unternehmensprofil";

export interface UnternehmenRouteDienste {
  dienst: UnternehmenDienst;
  audit?: AuditService;
}

// Ein Logo von höchstens 200 KB reist als Base64 (rund 270 KB) im JSON-Rumpf.
const PROFIL_BODY_LIMIT = 512 * 1024;

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof UnternehmenFehler) {
    reply.code(e.status).send({ ...e.extra, error: e.code, message: e.message });
    return;
  }
  throw e;
}

export function unternehmenRoutes(
  dienste: UnternehmenRouteDienste,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst } = dienste;
  return async (app) => {
    // Das Profil für die Unternehmensfläche — Name, Logo, Akzent. Kein Verlauf, kein Bearbeiter.
    app.get("/api/unternehmensprofil", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(profilAuskunft(await dienst.aktuellesProfil()));
    });

    // Verwaltung: aktuelle Fassung, alle früheren Fassungen und die erlaubten Gestaltungsoptionen.
    app.get("/api/admin/unternehmensprofil", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({
        fassungen: await dienst.profilFassungen(),
        akzente: akzentListe(),
        grenzen: { logo: LOGO_GRENZEN, name: NAME_GRENZEN, minKontrast: MIN_KONTRAST },
      });
    });

    // Speichern — eine NEUE Fassung. `version` nennt die zuletzt gesehene Fassung (0: noch keine).
    app.put<{ Body: unknown }>(
      "/api/admin/unternehmensprofil",
      { bodyLimit: PROFIL_BODY_LIMIT },
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const { vorher, nachher } = await dienst.speichereProfil(request.body, user.id);
          // Ins Protokoll kommen Version und Art der Änderung — nicht die Logodatei.
          await dienste.audit?.record({
            actor: user.id,
            action: "unternehmensprofil.geaendert",
            target: "unternehmensprofil",
            payload: {
              vorherVersion: vorher?.version ?? 0,
              version: nachher.version,
              akzent: nachher.akzent,
              nameGeaendert: vorher?.name !== nachher.name,
              logoGeaendert: (vorher?.logo?.daten ?? null) !== (nachher.logo?.daten ?? null),
              uebernommenAus: nachher.uebernommenAus,
            },
          });
          reply.code(200).send(nachher);
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Die Richtlinien, die für das angemeldete Konto gelten — samt seiner eigenen Handlung.
    app.get("/api/richtlinien", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ richtlinien: await dienst.fuerKonto(user) });
    });

    // Die ausdrückliche Kenntnisnahme oder Zustimmung — genau zu der genannten Fassung.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/richtlinien/:id/handlungen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { neu, eintrag } = await dienst.handle(user, request.params.id, request.body);
          if (neu) {
            await dienste.audit?.record({
              actor: user.id,
              action: "richtlinie.handlung",
              target: eintrag.richtlinieId,
              payload: { fassung: eintrag.fassung, handlung: eintrag.handlung },
            });
          }
          reply.code(neu ? 201 : 200).send({ ...eintrag, bereits: !neu });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Verwaltung: alle Richtlinien mit allen Fassungen und dem Stand zur aktuellen Fassung.
    app.get("/api/admin/richtlinien", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ richtlinien: await dienst.verwaltung() });
    });

    // Das Protokoll einer Richtlinie über alle Fassungen. Lesend; es gibt keinen Löschweg.
    app.get<{ Params: { id: string } }>(
      "/api/admin/richtlinien/:id/protokoll",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(await dienst.protokoll(request.params.id));
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Die Wirkung einer geplanten Fassung — VOR dem Veröffentlichen. Schreibt nichts.
    app.post<{ Body: unknown }>("/api/admin/richtlinien/wirkung", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await dienst.wirkung(request.body));
      } catch (e) {
        fehler(reply, e);
      }
    });

    // Eine neue Richtlinie — Fassung 1.
    app.post<{ Body: unknown }>("/api/admin/richtlinien", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        const { fassung, wirkung } = await dienst.veroeffentliche(null, request.body, user.id);
        await dienste.audit?.record({
          actor: user.id,
          action: "richtlinie.veroeffentlicht",
          target: fassung.id,
          payload: {
            fassung: fassung.fassung,
            anforderung: fassung.anforderung,
            rollen: fassung.rollen,
            gueltigAb: fassung.gueltigAb,
            betroffen: wirkung.betroffen,
          },
        });
        reply.code(201).send({ fassung, wirkung });
      } catch (e) {
        fehler(reply, e);
      }
    });

    // Eine neue Fassung einer bestehenden Richtlinie. `gesehen` nennt die zuletzt gesehene Fassung;
    // frühere Fassungen und alle Handlungen dazu bleiben unverändert.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/admin/richtlinien/:id/fassungen",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const { fassung, wirkung } = await dienst.veroeffentliche(
            request.params.id,
            request.body,
            user.id,
          );
          await dienste.audit?.record({
            actor: user.id,
            action: "richtlinie.veroeffentlicht",
            target: fassung.id,
            payload: {
              fassung: fassung.fassung,
              anforderung: fassung.anforderung,
              rollen: fassung.rollen,
              gueltigAb: fassung.gueltigAb,
              betroffen: wirkung.betroffen,
              erneut: wirkung.erneut,
              bisherigeHandlungen: wirkung.bisherigeHandlungen,
            },
          });
          reply.code(201).send({ fassung, wirkung });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );
  };
}
