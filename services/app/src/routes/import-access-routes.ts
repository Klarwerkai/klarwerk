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
// KEIN Schreibweg für Zugangsdaten: sie stehen nach Pedis Entscheidung vom 30.07. ausschließlich
// auf dem Server in der Umgebung. Der EINE Schreibweg hier (R-0134/R-1005, unten) legt nur den
// Betreiberschalter um — ein Ja/Nein, kein Wert.
//
// `users.manage`, wie JEDE Confluence-Import-Route (confluence-import-routes.ts) — der Import ist
// ohnehin admin-gebunden, eine weichere Tür für seinen Zustand wäre eine Rechte-Ausweitung durch
// die Hintertür. Die Oberfläche fragt deshalb gar nicht erst, wenn die Rolle es nicht trägt
// (kein 403-Rauschen), genau wie bei /api/reasoner/config.
//
// ================================================================================================
// JOB 924 · D6 — DIE ROUTE STELLT DIE ANFRAGE UND BAUT DIE ANTWORT NICHT MEHR SELBST.
// ================================================================================================
//
// BIS D5 STAND HIER: „es gibt im Bestand keinen Ort, der einen erfolgreichen Confluence-Kontakt
// festhält." Diese Begründung war überholt und ist gemessen widerlegt — den Ort gibt es seit
// AUFTRAG-144: `ImportRun.completedAt` mit Status `COMPLETED`, persistiert und in der
// Kompositionswurzel gehalten. Die Route las ihn nur nicht, und das feste `lastConnectedAt: null`
// war deshalb keine Ehrlichkeit mehr, sondern eine veraltete Auskunft.
//
// WARUM DIE ROUTE JETZT NUR NOCH EINEN AUFRUF TUT: Mit der vierten Tatsache bräuchte sie ein
// Repository. Eine Route, die eine Ablage kennt, ist der Anfang der zweiten Wahrheit — die nächste
// Zeile läse dann direkt, und niemand käme mehr an der Auswahlregel vorbei. Die vollständige
// Antwort baut deshalb `ImportAccessService`; hier bleibt das Recht und die Weitergabe.
import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import type { ImportAccessService } from "../services/import-access-service";

export function importAccessRoutes(
  guards: Guards,
  zugang: ImportAccessService,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/import/confluence/zugang", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await zugang.zugangsstatus());
    });

    // ==========================================================================================
    // R-0134 / R-1005 — DER BETREIBERSCHALTER: EIN- UND AUSSCHALTEN ÜBER DIE OBERFLÄCHE.
    // ==========================================================================================
    //
    // Der einzige Schreibweg dieser Datei, und er nimmt GENAU EIN Ja/Nein entgegen — keine
    // Zugangsdaten, keinen Wert, keinen Namen (die stehen weiterhin nur in der Umgebung). Dasselbe
    // Recht wie jede Confluence-Importroute (`users.manage`). Die Wirkung setzen die Importrouten
    // je Anfrage durch (confluence-import-routes.ts, `betreiberSperre`).
    //
    // 409, wenn die Installation den Import nicht freigibt: ein „an", das nichts bewirken kann,
    // wird nicht gespeichert. 503, wenn kein Betreiberschalter verdrahtet ist.
    app.put<{ Body: { an?: unknown } }>(
      "/api/import/confluence/schalter",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const an = request.body?.an;
        if (typeof an !== "boolean") {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "Erwartet wird { an: true | false }.",
          });
          return;
        }
        const ergebnis = await zugang.setzeBetreiberSchalter(an, user.id);
        if (ergebnis === "nicht-freigegeben") {
          reply.code(409).send({
            error: "IMPORT_NOT_RELEASED",
            message:
              "Der Confluence-Import ist in dieser Installation nicht freigegeben; der Schalter wirkt erst nach der Freigabe auf dem Server.",
          });
          return;
        }
        if (ergebnis === "kein-schalter") {
          reply.code(503).send({
            error: "SWITCH_UNAVAILABLE",
            message: "Der Betreiberschalter ist in dieser Instanz nicht verfügbar.",
          });
          return;
        }
        reply.code(200).send(ergebnis);
      },
    );

    // ==========================================================================================
    // JOB 4086 — DIESELBE AUSKUNFT FÜR SHAREPOINT/ONEDRIVE.
    // ==========================================================================================
    //
    // Sie steht aus demselben Grund VOR dem Schalter wie ihre Confluence-Schwester darüber: Läge
    // sie hinter `KLARWERK_SHAREPOINT_IMPORT`, könnte sie den einen Zustand nicht melden, für den
    // sie gebaut ist — „in dieser Installation nicht eingeschaltet". Die Oberfläche fragte dann
    // ins Leere und müsste raten oder einen Fehler provozieren.
    //
    // EIGENE ADRESSE STATT PARAMETER: `/api/import/:system/zugang` wäre eine Tür, hinter der ein
    // Aufrufer nach beliebigen Systemnamen fragen kann — und die Antwort auf einen unbekannten
    // Namen müsste man erfinden. Zwei benannte Adressen kennen genau die zwei Systeme, die es
    // wirklich gibt. Dieselbe Rechtebindung (`users.manage`), derselbe Vertrag, dieselbe Zusage:
    // kein Wert, keine Maske, kein Aufruf an die Gegenstelle.
    app.get("/api/import/sharepoint/zugang", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await zugang.sharepointZugangsstatus());
    });

    // R-0170 — DIESELBE AUSKUNFT FÜR JIRA, aus demselben Grund VOR dem Schalter
    // `KLARWERK_JIRA_IMPORT`: nur so kann sie „in dieser Installation nicht eingeschaltet" melden.
    // Dieselbe Rechtebindung, derselbe Vertrag: kein Wert, keine Maske, kein Aufruf an Jira.
    app.get("/api/import/jira/zugang", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await zugang.jiraZugangsstatus());
    });
  };
}
