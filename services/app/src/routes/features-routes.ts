// ================================================================================================
// AUFTRAG-mega46 BLOCK F — DIE OBERFLÄCHE ERFÄHRT, WELCHE SCHALTER STEHEN.
// ================================================================================================
//
// Der Befund aus mega45: Die Oberfläche hatte keinen Weg zu erfahren, ob ein Schalter gesetzt ist.
// Sie konnte es nur RATEN — am 404 einer Route (so macht es die Experten-Sicht heute,
// apps/web/src/api/hooks.ts) oder gar nicht. Raten am Fehlercode ist ein schlechter Weg: Er
// verwechselt „abgeschaltet" mit „kaputt", er kostet einen echten Fehlversuch, und er taugt nicht
// für eine Fläche, die gar nicht erst gerendert werden soll.
//
// WARUM EINE NEUE AUSKUNFT UND KEINE VORHANDENE (F1 verlangt die Begründung):
// Es gibt heute mehrere lesende Statusauskünfte, aber KEINE allgemeine. Jede ist an ihr Fach
// gebunden und wäre der falsche Ort:
//   · GET /api/auth/status  — gehört dem Auth-Modul (needsSetup/oidcEnabled). Das Auth-Modul weiß
//                             nichts von Herkunft oder Import; Schalter dort einzuhängen risse eine
//                             Modulgrenze auf, die dependency-cruiser zu Recht bewacht.
//   · GET /api/ai-status, /api/reasoner/status — abstrahierter KI-Zustand, eigener Vertrag.
//   · GET /api/capture/slides/availability — sagt MEHR als ein Schalter (Flag UND Konverter
//                             erreichbar) und verlangt `ko.create`. Genau deshalb steht der
//                             Folien-Schalter NICHT im Registry: Es gäbe sonst zwei Wahrheiten über
//                             die Folien, eine davon zu optimistisch.
// Also: EINE neue, schmale Auskunft — und danach keine weitere. Neue Schalter kommen ins Registry
// (services/app/src/feature-flags.ts), nicht in eine zweite Route.
//
// WAS SIE HERGIBT UND WAS NICHT: ausschließlich Ja/Nein je registriertem Schalter. Keine Werte,
// keine Variablennamen, keine Pfade, keine Versionen, keine Zählungen. Der Sammler in
// tests/app/mega46-schalter-auskunft.test.ts prüft das an der ANTWORT, nicht an der Absicht: Jeder
// Wert muss ein Boolean sein, und die Zeichenkette der Antwort darf weder „KLARWERK" noch einen
// gesetzten Umgebungswert enthalten.
//
// WARUM `requireUser` UND NICHT ÖFFENTLICH: Welche Flächen ein Betrieb freigeschaltet hat, ist
// keine Anmeldeinformation — die Oberfläche braucht sie erst NACH dem Anmelden (vorher gibt es nur
// die Anmeldemaske). Also die engste Tür, die den Zweck noch erfüllt. Ein Recht darüber hinaus
// wäre falsch: Auch eine Betrachterin muss wissen, welche Flächen es gibt.
import type { FastifyPluginAsync } from "fastify";
import { schalterZustand } from "../feature-flags";
import type { Guards } from "../http";

export function featuresRoutes(guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/features", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ features: schalterZustand() });
    });
  };
}
