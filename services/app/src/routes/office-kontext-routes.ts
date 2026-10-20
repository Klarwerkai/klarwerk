import { randomBytes } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Guards, SessionUser } from "../http";
import { sendError } from "../http";
import {
  OFFICE_KONTEXT_VERTRAG,
  erlaubteAktionen,
  folgeaktionFuer,
  herkunftErlaubt,
  officeBezug,
  pruefeHandlungsbezug,
  pruefeKontextmarke,
  pruefeMeldung,
  stelleKontextmarkeAus,
} from "../office-kontext";
import type { KlaraSessionService, KlaraSessionView } from "../services/klara-session-service";

// ================================================================================================
// KLARA-OFFICE-01 · DER ENGE OFFICE-KANAL ÜBER DIE BESTEHENDE ANWENDUNG
// ================================================================================================
//
//   POST   /api/klara/sessions/:sessionId/office-kontext        Hostadapter meldet Kontext
//   POST   /api/klara/sessions/:sessionId/office-kontext/ziel   Einfügeziel vor dem Schreiben prüfen
//   DELETE /api/klara/sessions/:sessionId/office-kontext        Kontext verwerfen (Wechsel, Abmelden)
//
// KEIN EIGENER DIENST, KEIN LOOPBACK, KEIN BROADCAST: die Wege hängen an derselben Fastify-App,
// derselben Anmeldung (`ko.read`, wie alle Klara-Endpunkte) und derselben Klara-Sitzung samt
// Bindungsköpfen `x-klara-*` wie `/api/ask`. Antworten gehen nur an die anfragende, angemeldete
// Seite; eine `Origin` ist Pflicht (`herkunftErlaubt`).
//
// REIHENFOLGE je Weg: Rechtetor (`ko.read`) → Prüfungen ohne Nebenwirkung (Sitzungsbindung ohne
// Touch bzw. Kontextmarke) → Pflicht-Herkunft → erst dann Aktivität, Kontext oder Zustandsänderung.
// Ein fremder Aufruf verlängert also keine Sitzung und bekommt keinen Kontext.
//
// WAS DIESE DATEI NICHT TUT: sie ruft keine KI, legt kein Wissensobjekt an, schreibt nichts ins
// Dokument und erteilt keine Zustimmung. Sie meldet, prüft und verwirft Handlungsbezüge.
//
// GRENZEN, ausdrücklich: der Folgezähler je Sitzung liegt im Speicher DIESES Prozesses, der
// Markenschlüssel ebenso (ohne eigene Angabe zufällig je Start). Ein Neustart oder ein zweiter
// Prozess macht jede bisherige Marke ungültig — die sichere Richtung: der Adapter meldet neu.

const INSTANCE_HEADER = "x-klara-instance";
const DOCUMENT_HEADER = "x-klara-document";

/** Obergrenze gemerkter Sitzungsstände; die ältesten fallen zuerst heraus. */
const STAENDE_MAX = 10_000;

export interface OfficeKontextRouteDeps {
  readonly sessions: Pick<KlaraSessionService, "meldeAktivitaet" | "getSession">;
  /** Eingetragene Herkünfte der Installation (`APP_BASE_URL`); die eigene gilt immer. */
  readonly erlaubteHerkuenfte?: readonly string[];
  /** Markenschlüssel (≥ 32 Byte); ohne Angabe zufällig je Prozess. */
  readonly schluessel?: Buffer;
  readonly jetzt?: () => number;
  /**
   * Leseweg zum kontobezogenen Assistenzprofil (produkt:20261010:assistenz-name-avatar). Solange
   * jener Auftrag keine Serverablage liefert, ist er nicht verdrahtet — dann sagt die Antwort das
   * (`auftritt.quelle: "nicht-geliefert"`), statt hier eine zweite Profilablage zu erfinden.
   */
  readonly assistenzProfil?: (
    actorId: string,
  ) => Promise<{ name: string; avatarUrl: string | null } | null>;
}

interface Sitzungsstand {
  readonly seq: number;
  readonly sum: string;
  readonly doc: string;
}

function kopf(request: FastifyRequest, name: string): string {
  const wert = request.headers[name];
  return typeof wert === "string" ? wert.trim() : "";
}

export function officeKontextRoutes(
  deps: OfficeKontextRouteDeps,
  guards: Guards,
): FastifyPluginAsync {
  const jetzt = deps.jetzt ?? Date.now;
  const schluessel =
    (deps.schluessel?.length ?? 0) >= 32 ? (deps.schluessel as Buffer) : randomBytes(32);
  const eingetragen = deps.erlaubteHerkuenfte ?? [];
  const staende = new Map<string, Sitzungsstand>();

  function merke(sessionId: string, stand: Sitzungsstand): void {
    staende.delete(sessionId);
    staende.set(sessionId, stand);
    while (staende.size > STAENDE_MAX) {
      const aeltester = staende.keys().next().value;
      if (aeltester === undefined) {
        break;
      }
      staende.delete(aeltester);
    }
  }

  /** Die Klara-Bindung dieser Anfrage — dieselben Köpfe wie an `/api/ask`. */
  function bindungAus(request: FastifyRequest, user: SessionUser) {
    return {
      actorId: user.id,
      addinInstanceId: kopf(request, INSTANCE_HEADER),
      documentContextId: kopf(request, DOCUMENT_HEADER),
    };
  }

  /**
   * Die Pflicht-Herkunft. Sie steht in jedem Weg NACH dem Rechtetor und nach den Prüfungen ohne
   * Nebenwirkung (Sitzungsbindung ohne Touch, Marke), aber VOR allem, was etwas verändert oder
   * Kontext herausgibt. `true` heisst: abgelehnt, die Antwort ist gesendet.
   */
  function herkunftAbgelehnt(request: FastifyRequest, reply: FastifyReply): boolean {
    if (
      herkunftErlaubt({
        origin: request.headers.origin,
        secFetchSite: request.headers["sec-fetch-site"],
        eigenerHost: request.host,
        eingetragen,
      })
    ) {
      return false;
    }
    reply.code(403).send({
      error: "OFFICE_HERKUNFT",
      message: "Der Office-Kontext wird nur der Klarwerk-Anwendung selbst beantwortet.",
    });
    return true;
  }

  async function auftrittFuer(actorId: string) {
    if (!deps.assistenzProfil) {
      return { quelle: "nicht-geliefert" as const, name: null, avatarUrl: null };
    }
    const profil = await deps.assistenzProfil(actorId);
    return profil
      ? { quelle: "kontoprofil" as const, name: profil.name, avatarUrl: profil.avatarUrl }
      : { quelle: "kontoprofil" as const, name: null, avatarUrl: null };
  }

  function nichtGueltig(reply: FastifyReply, grund: string, verbindung: "aktiv" | "getrennt") {
    reply.code(409).send({
      gueltig: false,
      grund,
      aktion: folgeaktionFuer(grund),
      verbindung,
    });
  }

  return async (app) => {
    app.post<{ Params: { sessionId: string }; Body: unknown }>(
      "/api/klara/sessions/:sessionId/office-kontext",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const bindung = bindungAus(request, user);
        try {
          // Dieselbe Prüfung wie jeder Sitzungsweg, hier noch OHNE Touch: fremde Bindung ⇒ 404,
          // geschlossen/abgelaufen ⇒ 409. Ein abgelehnter Aufruf verlängert so nichts — und
          // verändert auch den gemerkten Stand nicht (ein fremdes Konto könnte ihn sonst löschen).
          await deps.sessions.getSession(request.params.sessionId, bindung);
        } catch (fehler) {
          sendError(reply, fehler);
          return;
        }
        if (herkunftAbgelehnt(request, reply)) {
          return;
        }
        const geprueft = pruefeMeldung(request.body);
        if (!geprueft.ok) {
          reply.code(400).send({ error: "OFFICE_KONTEXT_UNGUELTIG", grund: geprueft.grund });
          return;
        }
        const { meldung } = geprueft;
        let sicht: KlaraSessionView;
        try {
          // Erst jetzt die ausdrückliche Aktivität: sie verlängert die gleitende Frist.
          sicht = await deps.sessions.meldeAktivitaet(request.params.sessionId, bindung);
        } catch (fehler) {
          sendError(reply, fehler);
          return;
        }
        const bisher = staende.get(sicht.sessionId);
        if (bisher?.doc === sicht.documentContextId && meldung.sequenz <= bisher.seq) {
          reply.code(409).send({
            error: "OFFICE_SEQUENZ_VERALTET",
            letzteSequenz: bisher.seq,
          });
          return;
        }
        const zeit = jetzt();
        merke(sicht.sessionId, {
          seq: meldung.sequenz,
          sum: meldung.auswahl.pruefsumme,
          doc: sicht.documentContextId,
        });
        const { marke, bis } = stelleKontextmarkeAus(
          {
            sid: sicht.sessionId,
            act: sicht.actorId,
            inst: sicht.addinInstanceId,
            doc: sicht.documentContextId,
            host: meldung.host.anwendung,
            seq: meldung.sequenz,
            sum: meldung.auswahl.pruefsumme,
          },
          schluessel,
          zeit,
        );
        reply.header("Cache-Control", "no-store");
        reply.code(200).send({
          vertrag: OFFICE_KONTEXT_VERTRAG,
          verbindung: "aktiv",
          bezug: officeBezug(meldung, sicht.documentContextId, zeit),
          marke,
          markeBis: new Date(bis).toISOString(),
          sitzung: {
            sessionId: sicht.sessionId,
            expiresAt: sicht.expiresAt,
            consentState: sicht.consentState,
          },
          erlaubteAktionen: erlaubteAktionen(meldung.host.anwendung),
          auftritt: await auftrittFuer(user.id),
          // Die Meldung ist Kontext, keine Arbeit: hier wurde nichts an eine KI gegeben und nichts
          // im Dokument ausgeführt.
          kiVerarbeitung: "nicht-ausgeloest",
        });
      },
    );

    app.post<{
      Params: { sessionId: string };
      Body: { marke?: unknown; ziel?: { pruefsumme?: unknown } } | null;
    }>("/api/klara/sessions/:sessionId/office-kontext/ziel", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const kopfBindung = bindungAus(request, user);
      const pruefung = pruefeKontextmarke(request.body?.marke, schluessel, jetzt());
      if (!pruefung.gueltig) {
        nichtGueltig(reply, pruefung.grund, "aktiv");
        return;
      }
      const bindung = { sessionId: request.params.sessionId, ...kopfBindung };
      const vorab = pruefeHandlungsbezug({
        marke: pruefung.inhalt,
        bindung,
        letzteSequenz: pruefung.inhalt.seq,
        zielPruefsumme: pruefung.inhalt.sum,
      });
      // Konto, Sitzung, Instanz und Dokument VOR der Sitzungsabfrage: ein fremdes Konto erfährt
      // so nichts über die Sitzung, und der Grund bleibt benannt.
      if (!vorab.gueltig) {
        nichtGueltig(reply, vorab.grund, "aktiv");
        return;
      }
      if (herkunftAbgelehnt(request, reply)) {
        return;
      }
      let sicht: KlaraSessionView;
      try {
        // Reines Ansehen, kein Touch: die Zielprüfung verlängert die Sitzung nicht.
        sicht = await deps.sessions.getSession(request.params.sessionId, kopfBindung);
      } catch {
        nichtGueltig(reply, "sitzung_nicht_aktiv", "getrennt");
        return;
      }
      const stand = staende.get(sicht.sessionId);
      const ergebnis = pruefeHandlungsbezug({
        marke: pruefung.inhalt,
        bindung: { ...bindung, documentContextId: sicht.documentContextId },
        letzteSequenz: stand?.doc === sicht.documentContextId ? stand.seq : undefined,
        zielPruefsumme: request.body?.ziel?.pruefsumme,
      });
      if (!ergebnis.gueltig) {
        nichtGueltig(reply, ergebnis.grund, "aktiv");
        return;
      }
      reply.code(200).send({
        gueltig: true,
        verbindung: "aktiv",
        // Die vorhandene Freigaberegel bleibt: geschrieben wird erst nach dem zweiten Klick.
        bestaetigung: "zweiter-klick",
        sequenz: pruefung.inhalt.seq,
      });
    });

    app.delete<{ Params: { sessionId: string } }>(
      "/api/klara/sessions/:sessionId/office-kontext",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          await deps.sessions.getSession(request.params.sessionId, bindungAus(request, user));
        } catch (fehler) {
          sendError(reply, fehler);
          return;
        }
        if (herkunftAbgelehnt(request, reply)) {
          return;
        }
        staende.delete(request.params.sessionId);
        reply.code(200).send({ verbindung: "getrennt" });
      },
    );
  };
}
