// ================================================================================================
// AUFTRAG-mega67 BLOCK C + D — DER ZUGANGS-ZUSTAND JE SYSTEM, LESEND.
// ================================================================================================
//
// Die Auskunft, die mega32 als Grund nannte, die Blöcke I und J NICHT zu beginnen: „Sind die
// Zugangsdaten hinterlegt — Ja oder Nein?" war serverseitig nirgends abfragbar. Der einzige Weg,
// es zu erfahren, war ein echter Admin-POST auf eine Import-Route und das Lesen ihres 503
// (`IMPORT_UNAVAILABLE`, confluence-import-routes.ts:177-183 u. a.) — also erst NACH dem Versuch.
//
// ================================================================================================
// WARUM DIESE ROUTE UNBEDINGT REGISTRIERT WIRD — DER GANZE WITZ DES BLOCKS.
// ================================================================================================
//
// `KLARWERK_CONFLUENCE_IMPORT` entscheidet, ob die Import-Routen ÜBERHAUPT REGISTRIERT werden
// (build-app.ts:1037). Steht der Schalter aus, existieren sie nicht — und genau deshalb kann man
// sie auch nicht fragen. Läge DIESE Route hinter demselben Schalter, könnte sie den einen Zustand
// nicht melden, für den sie gebaut ist: „ausgeschaltet". Sie steht deshalb bewusst davor.
//
// ================================================================================================
// WARUM EINE EIGENE AUSKUNFT UND NICHT /api/features.
// ================================================================================================
//
// mega46 hat die Vielzahl der Schalterleser beseitigt und dabei die Regel gesetzt: neue SCHALTER
// kommen ins Registry, nicht in eine zweite Route. Diese Auskunft ist aber kein Schalter — sie sagt
// MEHR als einer (Schalter UND Zugangsdaten-Zustand UND der HTTPS-Riegel). Für genau diesen Fall
// nennt features-routes.ts:18-21 selbst den Präzedenzfall `GET /api/capture/slides/availability`
// und begründet, warum er getrennt gehört: sonst gäbe es zwei Wahrheiten über dieselbe Sache, und
// die im Schalter-Vertrag wäre die zu optimistische. Der Schalter-Vertrag ist zudem ausdrücklich
// auf „Booleans, keine Variablennamen" festgelegt (tests/app/mega46-schalter-auskunft.test.ts) —
// und Block C verlangt die Variablennamen. Sie hier zu führen, hält jenen Vertrag unberührt.
//
// ================================================================================================
// WAS SIE NICHT TUT.
// ================================================================================================
//
// KEIN Aufruf an Confluence. Kein neuer Egress, keine Verbindungsprüfung auf Verdacht. Sie liest
// den Schalter und die Anwesenheit der Variablen, beides lokal. KEIN Wert, KEINE Maske mit Länge.
// KEIN Schreibweg: es gibt hier nichts zu setzen, weil die Zugangsdaten nach Pedis Entscheidung vom
// 30.07. ausschließlich auf dem Server in der Umgebung stehen.
//
// `users.manage`, wie JEDE Confluence-Import-Route (confluence-import-routes.ts) — der Import ist
// ohnehin admin-gebunden, eine weichere Tür für seinen Zustand wäre eine Rechte-Ausweitung durch
// die Hintertür. Die Oberfläche fragt deshalb gar nicht erst, wenn die Rolle es nicht trägt
// (kein 403-Rauschen), genau wie bei /api/reasoner/config.
import type { FastifyPluginAsync } from "fastify";
import { confluenceCredentialState } from "../../../confluence";
import { schalterAn } from "../feature-flags";
import type { Guards } from "../http";

export function importAccessRoutes(guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/import/confluence/zugang", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const credentials = confluenceCredentialState();
      reply.code(200).send({
        system: "confluence",
        // Ist der Import für dieses System eingeschaltet? (Schalter aus ⇒ die Routen existieren nicht.)
        enabled: schalterAn("confluenceImport"),
        // Die Variablen, benannt, mit Ja/Nein — und der Grund, falls trotz aller vier kein Zugang
        // zustande käme (unverschlüsselte Basis-URL).
        credentials: credentials.vars,
        credentialsUsable: credentials.usable,
        blocker: credentials.blocker,
        // Wann zuletzt erfolgreich verbunden wurde, wäre nach Block C zu zeigen — „FALLS das ohne
        // neuen Aufruf ablesbar ist". Es ist es nicht: es gibt im Bestand keinen Ort, der einen
        // erfolgreichen Confluence-Kontakt festhält. Statt einer erfundenen Zahl steht hier
        // ausdrücklich nichts — und die Fläche sagt ehrlich, dass sie es nicht weiß.
        lastConnectedAt: null,
      });
    });
  };
}
