import type { FastifyPluginAsync } from "fastify";
import {
  LAGEBILD_GESAMT,
  type LagebildBereichRecht,
  LagebildKonflikt,
  LagebildWerteFehler,
  type ManagementService,
} from "../../../management";
import { can } from "../../../rbac";
import { type Guards, type SessionUser, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";
import {
  type SpaceFassung,
  type SpaceNutzer,
  darfInSpaceSchreiben,
  darfSpaceInhalteLesen,
  istArchiviert,
} from "../spaces";

// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — WER WELCHE LAGEBILD-WERTE SIEHT UND PFLEGT.
// ================================================================================================
// Die Bereiche werden JE ANFRAGE frisch aus der Space-Ablage abgeleitet — ein entzogenes Recht wirkt
// beim nächsten Abruf (LWE-03). Lesen: `gesamt` für jede lesende Rolle, ein Space nur, wenn der
// Betrachter seine Inhalte lesen darf (dieselbe Regel wie der Sichtbarkeitstrim, ohne
// Admin-Durchgriff). Schreiben: `gesamt` nur die Verwaltung (`users.manage`); ein Space, wer darin
// schreiben darf UND `ko.create` trägt (Anwender ab Experte). Ein archivierter Space ist lesbar,
// aber nicht pflegbar. Ein Bereich, den der Betrachter nicht lesen darf, kommt in keiner Antwort vor.
export function lagebildBereicheFuer(
  spaces: readonly SpaceFassung[],
  nutzer: SpaceNutzer,
): LagebildBereichRecht[] {
  const raeume = spaces
    .filter((s) => s.id !== LAGEBILD_GESAMT && darfSpaceInhalteLesen(s, nutzer.id))
    .map((s) => ({
      bereich: s.id,
      name: s.name,
      darfSchreiben:
        !istArchiviert(s) && can(nutzer.role, "ko.create") && darfInSpaceSchreiben(s, nutzer),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.bereich.localeCompare(b.bereich));
  return [
    { bereich: LAGEBILD_GESAMT, name: null, darfSchreiben: can(nutzer.role, "users.manage") },
    ...raeume,
  ];
}

/** Die Bereiche eines angemeldeten Kontos — `build-app.ts` reicht die Space-Ablage hinein. */
export type LagebildBereicheQuelle = (user: SessionUser) => Promise<LagebildBereichRecht[]>;

// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot. Read-only, stateless.
//
// R-0751 / R-1639 / R-2183 (Nacharbeit 3): dazu der Bereichsblick mit Ruhestandshorizonten
// (`ko.read`, Grundmenge über `sichtbarkeitsfilterFuer`) und die Pflege seiner Eingänge
// (`users.manage`). `nutzerGibtEs` hält die Ruhestandspflege an echten internen Konten — eine
// fremde oder erfundene Kennung wird nicht gespeichert.
export function managementRoutes(
  management: ManagementService,
  guards: Guards,
  nutzerGibtEs: (userId: string) => Promise<boolean> = async () => false,
  // Ohne Space-Ablage gibt es nur den Bereich `gesamt`.
  lagebildBereiche: LagebildBereicheQuelle = async (user) => lagebildBereicheFuer([], user),
): FastifyPluginAsync {
  return async (app) => {
    // produkt:20261013:lagebild-reale-werte-eingabe: die realen Eingangswerte der Wissensbewertung
    // je sichtbarem Bereich, mit den Fakten über dem sichtbaren Bestand und dem Schreibrecht.
    app.get("/api/management/lagebild-werte", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const bereiche = await management.lagebildUebersicht({
        sichtbar: sichtbarkeitsfilterFuer(user),
        bereiche: await lagebildBereiche(user),
        betrachter: user.id,
      });
      reply.header("cache-control", "no-store");
      reply.code(200).send({ bereiche });
    });

    app.put<{ Params: { bereich: string } }>(
      "/api/management/lagebild-werte/:bereich",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const ziel = (await lagebildBereiche(user)).find(
          (b) => b.bereich === request.params.bereich,
        );
        // Unbekannt und nicht lesbar antworten gleich — die Antwort verrät keinen fremden Bereich.
        if (!ziel) {
          reply.code(404).send({
            error: "NOT_FOUND",
            message: "Diesen Arbeitsbereich gibt es nicht, oder Sie dürfen ihn nicht sehen.",
          });
          return;
        }
        if (!ziel.darfSchreiben) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message:
              ziel.bereich === LAGEBILD_GESAMT
                ? "Die Werte für das ganze Unternehmen pflegt die Verwaltung."
                : "Sie dürfen in diesem Arbeitsbereich nicht schreiben.",
          });
          return;
        }
        try {
          const ergebnis = await management.setLagebildWerte(ziel.bereich, request.body, user.id);
          reply.code(200).send(ergebnis);
        } catch (error) {
          if (error instanceof LagebildWerteFehler) {
            reply
              .code(400)
              .send({ error: error.code, message: error.message, fehler: error.fehler });
            return;
          }
          if (error instanceof LagebildKonflikt) {
            reply.code(409).send({
              error: error.code,
              message: error.message,
              aktuell: error.aktuell,
              aktuellVonMir: error.aktuell?.geaendertVon === user.id,
            });
            return;
          }
          sendError(reply, error);
        }
      },
    );

    app.get("/api/management/snapshot", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega76 BLOCK D: der breiteste der sechs Leckpfade. Die Grundmenge wird gefiltert,
      // BEVOR gerechnet wird — sonst trügen die Scores und die Kategoriezeilen den unsichtbaren
      // Bestand weiter mit.
      // R-1657 (Nacharbeit 2): `sicht` merkt DIESE Betrachtersicht für die regelmäßige
      // Reasoner-Analyse der Wissens-Sprints vor — sie urteilt nur über das, was sie sehen darf.
      const snapshot = await management.snapshot({
        sichtbar: sichtbarkeitsfilterFuer(user),
        sicht: user.id,
      });
      reply.code(200).send(snapshot);
    });

    // R-1639 / R-2183: „mein Bereich" — nur Bereiche, die den Abrufenden als Verantwortlichen
    // nennen; wer Bereichsprofile pflegt (`users.manage`), sieht alle. Ruhestandsangaben stehen nur
    // an Trägern dieser Bereiche, und die Grundmenge ist vor dem Zählen getrimmt.
    app.get("/api/management/risk-horizon", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const sicht = await management.riskHorizon({
        sichtbar: sichtbarkeitsfilterFuer(user),
        viewer: { userId: user.id, seesAll: can(user.role, "users.manage") },
      });
      reply.code(200).send(sicht);
    });

    app.get("/api/management/profiles", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const [categories, retirement] = await Promise.all([
        management.listCategoryProfiles(),
        management.listRetirement(),
      ]);
      reply.code(200).send({ categories, retirement });
    });

    app.put("/api/management/profiles/category", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await management.setCategoryProfile(request.body, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Params: { userId: string }; Body: { horizonMonths?: unknown } }>(
      "/api/management/profiles/retirement/:userId",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        if (!(await nutzerGibtEs(request.params.userId))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Unbekanntes Konto." });
          return;
        }
        try {
          const eintrag = await management.setRetirement(
            request.params.userId,
            request.body?.horizonMonths,
            user.id,
          );
          reply.code(200).send({ entry: eintrag });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}
