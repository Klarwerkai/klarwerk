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
//
// ================================================================================================
// AUFTRAG-mega61 BLOCK A — DIE PRÄMISSE VON OBEN GILT NICHT MEHR VOLLSTÄNDIG.
// ================================================================================================
//
// „vorher gibt es nur die Anmeldemaske" war bis mega60 wahr. Seit mega61 gibt es ZWEI Flächen vor
// der Anmeldung: /impressum und /datenschutz. Sie MÜSSEN dort liegen — eine Datenschutzerklärung,
// die man erst nach der Kontoanlage lesen kann, kommt nach der ersten Datenerhebung und ist damit
// wertlos. Und ihr Fußbereich steht auf der Anmeldemaske selbst.
//
// DESHALB antwortet diese Auskunft jetzt AUCH ohne Sitzung — aber nur mit der Teilmenge, deren
// Fläche vor der Anmeldung überhaupt erreichbar ist (`schalterZustandVorAnmeldung`). Bewusst KEINE
// zweite Route: mega46 hat gerade die Vielzahl der Schalterleser beseitigt, und eine zweite
// Auskunft wäre der Rückfall. Bewusst auch nicht der volle Zustand: welche Fähigkeiten ein Betrieb
// gebucht hat, geht einen Unangemeldeten nichts an.
//
// Der Aufrufer in der Oberfläche schlüsselt seinen Zwischenspeicher nach Sitzung (`useFeatures`),
// damit die Teilmenge von vor der Anmeldung nicht als vollständige Antwort danach hängenbleibt.
import type { FastifyPluginAsync } from "fastify";
import { schalterZustand, schalterZustandVorAnmeldung } from "../feature-flags";
import { type Guards, tokenFromRequest } from "../http";

export function featuresRoutes(guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/features", async (request, reply) => {
      // Ohne mitgereichte Sitzung gar nicht erst nach ihr fragen: `requireUser` würde 401 senden
      // und der Unangemeldete bekäme die Rechtsseiten nicht zu sehen. Wer einen Token mitbringt,
      // durchläuft die unveränderte Prüfung — ein ABGELAUFENER Token ist weiterhin ein 401 und
      // wird nicht stillschweigend zur öffentlichen Teilmenge herabgestuft.
      if (!tokenFromRequest(request)) {
        reply.code(200).send({ features: schalterZustandVorAnmeldung() });
        return;
      }
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ features: schalterZustand() });
    });
  };
}
