import { createHash } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { type Guards, sendError, tokenFromRequest } from "../http";
import { type BegleiterAktion, BegleiterFehler, type BegleiterKanal } from "../klara-begleiter";

// ================================================================================================
// produkt:20261010:klara-office-mac-maskottchen — DER KONTEXTKANAL ZWISCHEN WORD UND BEGLEITAPP.
// ================================================================================================
//
//   POST   /api/me/klara/begleiter/adapter                     — ein Word-Fenster meldet sich an
//   PUT    /api/me/klara/begleiter/adapter/:instanz            — Auswahl melden, Aktionen abholen
//   DELETE /api/me/klara/begleiter/adapter/:instanz            — das Word-Fenster meldet sich ab
//   GET    /api/me/klara/begleiter/kontext                     — was die Begleitapp sehen darf
//   POST   /api/me/klara/begleiter/adapter/:instanz/aktionen   — die Begleitapp beauftragt Word
//   GET    /api/me/klara/begleiter/sitzung                     — Nutzer + Sitzungsfingerabdruck
//                                                                 (BPA-01 AC10, Browserkarte)
//   POST   /api/me/klara/begleiter/auftraege/:schluessel/klaeren — Klärung bei verlorener Antwort
//
// Die ersten drei ruft der Office-Adapter (`apps/web/public/word-addin/begleiter.js`), die letzten
// zwei die Begleitapp (`apps/web/src/pages/Begleiter.tsx` in `apps/desktop/klara-begleiter`). Alle
// gehen über dieselbe Anmeldung; das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`). Kein
// zusätzliches Recht: der Kanal trägt nur, was die Person in ihrem eigenen Word-Fenster markiert
// hat, zu ihrer eigenen Begleitapp — eine Frage daraus beantwortet das Aufgabenfenster über seinen
// eigenen, gebundenen Weg mit Einwilligung und Rechten. Regeln und Fristen: `klara-begleiter.ts`.

export interface KlaraBegleiterRoutenDeps {
  kanal: BegleiterKanal;
}

const FEHLERCODE: Record<BegleiterFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof BegleiterFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

/** Die Sicht einer Aktion nach außen — ohne interne Zeitstempel. */
function aktionSicht(a: BegleiterAktion) {
  return {
    id: a.id,
    art: a.art,
    stand: a.stand,
    auswahlStand: a.auswahlStand,
    ...(a.abbruchAngefordert ? { abbruchAngefordert: true } : {}),
  };
}

export function klaraBegleiterRoutes(
  deps: KlaraBegleiterRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { kanal } = deps;

  return async (app) => {
    app.post("/api/me/klara/begleiter/adapter", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(201).send(kanal.anmelden(user.id, request.body));
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.put<{ Params: { instanz: string } }>(
      "/api/me/klara/begleiter/adapter/:instanz",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(kanal.melden(user.id, request.params.instanz, request.body));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.delete<{ Params: { instanz: string } }>(
      "/api/me/klara/begleiter/adapter/:instanz",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send({ abgemeldet: kanal.abmelden(user.id, request.params.instanz) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.get("/api/me/klara/begleiter/kontext", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(kanal.kontext(user.id));
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post<{ Params: { instanz: string } }>(
      "/api/me/klara/begleiter/adapter/:instanz/aktionen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const aktion = kanal.beauftragen(user.id, request.params.instanz, request.body);
          reply.code(202).send({ aktion: aktionSicht(aktion) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // BPA-01 AC10 (aufnahme:20260922:gesamt-browser-kontextkarten, nacharbeit-19): WELCHE
    // Anmeldesitzung die Begleitapp gerade trägt. Der Host bindet die Browserkarte an Nutzer UND
    // Sitzung — ein Ab- und Neuanmelden desselben Nutzers ist eine NEUE Sitzung und sperrt alte
    // Karten. Geliefert wird nie das Sitzungsmerkmal, nur sein Fingerabdruck (SHA-256 mit eigenem
    // Zweckpräfix, nicht umkehrbar, kein Anmeldenachweis); er bleibt für dieselbe Sitzung gleich.
    app.get("/api/me/klara/begleiter/sitzung", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const token = tokenFromRequest(request);
      if (!token) {
        // `requireUser` hat ohne Merkmal schon 401 geantwortet; fail-closed, falls nicht.
        reply.code(401).send({ error: "UNAUTHENTICATED" });
        return;
      }
      reply.header("cache-control", "no-store");
      reply.code(200).send({ nutzer: user.id, sitzung: begleiterSitzung(token) });
    });

    // Nacharbeit 58 (Ben, MACG57-POST-GET-01): auftragsbezogene Klärung einer Beauftragung, deren
    // Antwort verloren ging. 200 `angenommen` mit genau der Aktion zu diesem Schlüssel — oder 200
    // `nicht_angelegt`: der Schlüssel ist ab jetzt gesperrt, ein verspäteter POST legt nichts an.
    // Nacharbeit 63: Rumpf `{ ausgestelltAm }`; ist der Auftrag älter als die Frist und nicht mehr
    // vermerkt, 200 `unbekannt` (nicht mehr sicher klärbar; angenommen werden kann er nicht mehr).
    app.post<{ Params: { schluessel: string } }>(
      "/api/me/klara/begleiter/auftraege/:schluessel/klaeren",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const k = kanal.klaeren(user.id, request.params.schluessel, request.body);
          const antwort =
            k.stand === "angenommen"
              ? {
                  stand: k.stand,
                  instanz: k.instanz,
                  aktion: aktionSicht(k.aktion),
                  // Nacharbeit 65: die Kanalinstanz, die das belegt (Herkunft der Annahme).
                  kanal: kanal.epoche,
                }
              : { stand: k.stand };
          reply.header("cache-control", "no-store");
          reply.code(200).send(antwort);
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14): eine eigene Aktion
    // stoppen. Offen ⇒ 200 gestoppt; übergeben ⇒ 202, Abbruch an Word weitergereicht (Nacharbeit 7);
    // fremd, unbekannt ⇒ 404 — dieselbe Antwort wie überall im Kanal.
    app.post<{ Params: { instanz: string; aktion: string } }>(
      "/api/me/klara/begleiter/adapter/:instanz/aktionen/:aktion/stopp",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const aktion = kanal.stoppen(user.id, request.params.instanz, request.params.aktion);
          // 202: Abbruch an das ausführende Word-Fenster weitergereicht, Ende noch unbestätigt.
          const status = aktion.stand === "uebergeben" ? 202 : 200;
          reply.code(status).send({ aktion: aktionSicht(aktion) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}

/** Der Fingerabdruck einer Anmeldesitzung für die Begleitapp — Zweckpräfix, SHA-256, 32 Zeichen. */
export function begleiterSitzung(token: string): string {
  return createHash("sha256")
    .update(`klara-begleiter-sitzung\u0000${token}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}
