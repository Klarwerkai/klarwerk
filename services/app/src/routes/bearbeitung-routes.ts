import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { KantenKoLeser } from "../../../knowledge-object";
import {
  BEARBEITUNG_ABLAUF_SEKUNDEN,
  BEARBEITUNG_ERNEUERN_SEKUNDEN,
  type Bearbeitung,
  type BearbeitungsRepo,
  istSitzungskennung,
} from "../bearbeitungshinweis";
import type { Guards, SessionUser } from "../http";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · DIE DREI TÜREN DES BEARBEITUNGSHINWEISES.
// ================================================================================================
//
//   GET    /api/kos/:id/bearbeitungen            — wer bearbeitet diesen Eintrag gerade?
//   PUT    /api/kos/:id/bearbeitungen/:sitzung   — die EIGENE Bearbeitung beginnen oder erneuern
//   DELETE /api/kos/:id/bearbeitungen/:sitzung   — die EIGENE Bearbeitung beenden
//
// KEINE NEUE RECHTEACHSE: Lesen verlangt `ko.read`, Beginnen/Erneuern/Beenden verlangt `ko.create`
// — dieselben Rechte wie Lesen und Bearbeiten des Eintrags selbst (`ko-routes.ts`, `revise`). Die
// Sichtbarkeit entscheidet dieselbe Funktion wie am Detailabruf (`darfSehen`), und ein unsichtbarer
// Eintrag ist hier wie dort ein 404: schon „dort bearbeitet jemand" wäre eine Existenzauskunft.
// Wird einem Konto das Recht entzogen, gilt das ab der nächsten Anfrage — die Rolle kommt bei
// jeder Anfrage frisch aus der Sitzung (`makeGuards`).
//
// WAS HINAUSGEHT: die sichtbare Nutzerbezeichnung, Beginn und Ablauf — keine E-Mail, keine
// Kontokennung eines fremden Kontos und keine fremde Sitzungskennung (mit der ohnehin niemand etwas
// anfangen könnte, s. `bearbeitungshinweis.ts`). Die eigene Bearbeitung trägt `eigen: true` und
// ihre Sitzung, damit ein zweites Fenster desselben Kontos sich von der eigenen unterscheiden kann.
//
// UND DER SPEICHERWEG KENNT DIESE ROUTEN NICHT. Gespeichert wird weiterhin ausschliesslich über
// `PUT /api/kos/:id` mit `expectedVersion`; ein Hinweis macht dort nichts erlaubt und nichts
// verboten.

export interface BearbeitungRoutesDeps {
  bearbeitungen: BearbeitungsRepo;
  /** Die Leseseite des KO-Bestands — genau `get`, verdrahtet mit `services.ko`. */
  kos: KantenKoLeser;
  /** Die vorhandene sichtbare Nutzerbezeichnung eines Kontos (`undefined`: unbekannt). */
  nutzerName: (nutzerId: string) => Promise<string | undefined>;
}

/** Eine laufende Bearbeitung, wie sie über den Draht geht. */
interface BearbeitungAntwort {
  name: string;
  eigen: boolean;
  /** Nur bei der eigenen Bearbeitung gesetzt. */
  sitzung?: string;
  seit: string;
  bis: string;
}

function alsAntwort(b: Bearbeitung, betrachter: SessionUser): BearbeitungAntwort {
  const eigen = b.nutzerId === betrachter.id;
  return {
    name: b.nutzerName,
    eigen,
    ...(eigen ? { sitzung: b.sitzung } : {}),
    seit: b.seit,
    bis: b.bis,
  };
}

const TAKT = {
  ablaufSekunden: BEARBEITUNG_ABLAUF_SEKUNDEN,
  erneuernSekunden: BEARBEITUNG_ERNEUERN_SEKUNDEN,
} as const;

export function bearbeitungRoutes(deps: BearbeitungRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { bearbeitungen, kos, nutzerName } = deps;

  async function sichtbarOder404(
    user: SessionUser,
    id: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    const item = await kos.get(id);
    if (!item || !darfSehen(user, item)) {
      reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
      return false;
    }
    return true;
  }

  function sitzungOder400(sitzung: string, reply: FastifyReply): boolean {
    if (!istSitzungskennung(sitzung)) {
      reply.code(400).send({
        error: "BAD_REQUEST",
        message: "Die Sitzungskennung der Bearbeitung ist ungültig.",
      });
      return false;
    }
    return true;
  }

  return async (app) => {
    app.get<{ Params: { id: string } }>("/api/kos/:id/bearbeitungen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      if (!(await sichtbarOder404(user, request.params.id, reply))) {
        return;
      }
      const stand = await bearbeitungen.laufende(request.params.id);
      reply.code(200).send({
        jetzt: stand.jetzt,
        ...TAKT,
        bearbeitungen: stand.bearbeitungen.map((b) => alsAntwort(b, user)),
      });
    });

    app.put<{ Params: { id: string; sitzung: string } }>(
      "/api/kos/:id/bearbeitungen/:sitzung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        if (!sitzungOder400(request.params.sitzung, reply)) {
          return;
        }
        if (!(await sichtbarOder404(user, request.params.id, reply))) {
          return;
        }
        const name = (await nutzerName(user.id)) ?? "";
        const { jetzt, bearbeitung } = await bearbeitungen.melde(
          request.params.id,
          { id: user.id, name },
          request.params.sitzung,
        );
        reply.code(200).send({ jetzt, ...TAKT, bearbeitung: alsAntwort(bearbeitung, user) });
      },
    );

    app.delete<{ Params: { id: string; sitzung: string } }>(
      "/api/kos/:id/bearbeitungen/:sitzung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        if (!sitzungOder400(request.params.sitzung, reply)) {
          return;
        }
        if (!(await sichtbarOder404(user, request.params.id, reply))) {
          return;
        }
        // Beendet wird ausschliesslich die Zeile DIESES Kontos. Eine fremde Sitzungskennung trifft
        // damit nichts — `beendet: false`, und die fremde Bearbeitung läuft unverändert weiter.
        const beendet = await bearbeitungen.beende(
          request.params.id,
          user.id,
          request.params.sitzung,
        );
        reply.code(200).send({ beendet });
      },
    );
  };
}
