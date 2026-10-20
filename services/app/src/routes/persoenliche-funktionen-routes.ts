import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { KnowledgeObject } from "../../../knowledge-object";
import { type Guards, sendError } from "../http";
import {
  type EntwurfEingabe,
  type FunktionAendernEingabe,
  type FunktionSpeichernEingabe,
  type FunktionenDienst,
  FunktionsFehler,
  type LaufEingabe,
  type PersoenlicheFunktion,
  type QuelleLesen,
  ZEITAUFTRAG_FAEHIGKEIT,
  type ZeitauftragEingabe,
  aktuelleFassung,
} from "../persoenliche-funktionen";
import { type Sichtbarkeitsfilter, sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// ================================================================================================
// produkt:20261011:peter-p06:beschaffungsroutine (BES-07) · MEINE FUNKTIONEN — NUR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET    /api/me/funktionen                     — die eigenen Funktionen samt offener Fähigkeiten
//   POST   /api/me/funktionen/entwurf             — aus einem Satz einen Entwurf machen (speichert nichts)
//   POST   /api/me/funktionen                     — speichern (kein Lauf, keine Serie, kein Außenrecht)
//   GET    /api/me/funktionen/:id                 — eine Funktion mit Fassungen, Serie und Läufen
//   PUT    /api/me/funktionen/:id                 — ändern, pausieren, fortsetzen, deaktivieren
//   PUT    /api/me/funktionen/:id/zeitauftrag     — Serie ausdrücklich einrichten (Ausführung offen)
//   DELETE /api/me/funktionen/:id/zeitauftrag     — Serie entfernen
//   POST   /api/me/funktionen/:id/laeufe          — manueller Aufruf mit Parametern dieses Laufs
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung (`user.id`); fremd und unbekannt antworten 404.
// Quellen liest jede Tür, die sie anfasst, mit der EINEN Sichtbarkeitsentscheidung des Augenblicks
// (`sichtbarkeitsfilterFuer`) — eine unbekannte und eine nicht zugängliche Quelle sehen gleich aus.
//
// Ins Prüfprotokoll gehen Kennung, Fassung, Stand und Zahlen — nie der Satz, nie Parameterwerte.

export const FUNKTION_GESPEICHERT = "funktion.gespeichert";
export const FUNKTION_GEAENDERT = "funktion.geaendert";
export const FUNKTION_ZEITAUFTRAG_GESETZT = "funktion.zeitauftrag-gesetzt";
export const FUNKTION_ZEITAUFTRAG_ENTFERNT = "funktion.zeitauftrag-entfernt";
export const FUNKTION_LAUF_VORBEREITET = "funktion.lauf-vorbereitet";

/**
 * Der schmale Leseport des Wissensbestands, verdrahtet mit `services.ko`: das aktuelle Objekt und —
 * nur für die Unterscheidung „gelöscht" — das Objekt im Papierkorb.
 */
export interface FunktionenKoLeser {
  get(id: string): Promise<KnowledgeObject | undefined>;
  papierkorbFassungVon(id: string): Promise<KnowledgeObject | undefined>;
}

export interface FunktionenRoutenDeps {
  dienst: FunktionenDienst;
  kos: FunktionenKoLeser;
  audit: AuditService;
}

const FEHLERCODE: Record<FunktionsFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof FunktionsFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
      ...(fehler.fehlend.length > 0 ? { fehlend: fehler.fehlend } : {}),
      // Nacharbeit 4: bei `vorgang_mehrdeutig` die Fälle des EIGENEN Gesprächs zur Auswahl.
      ...(fehler.abschnitte.length > 0 ? { abschnitte: fehler.abschnitte } : {}),
    });
    return;
  }
  sendError(reply, fehler);
}

/**
 * Liest eine Quelle mit der Sichtbarkeit des Fragenden — `null` für unbekannt UND verborgen.
 * „Gelöscht" erfährt nur, wer das Objekt im Papierkorb sehen dürfte (dieselbe Regel wie bei den
 * Fundstellen, `aussage-fundstellen.ts`); ein Lesefehler ist „nicht erreichbar", nie „fehlt".
 */
export function quellenLeser(kos: FunktionenKoLeser, sichtbar: Sichtbarkeitsfilter): QuelleLesen {
  return async (koId) => {
    try {
      const ko = await kos.get(koId);
      if (ko) {
        return sichtbar(ko) ? { fassung: ko.version, status: ko.status } : null;
      }
      const imPapierkorb = await kos.papierkorbFassungVon(koId);
      return imPapierkorb && sichtbar(imPapierkorb) ? "geloescht" : null;
    } catch {
      return "nicht_erreichbar";
    }
  };
}

/** Die Sicht nach außen — ohne Kontokennung, dazu die geltende Fassung und was offen ist. */
function sicht(dienst: FunktionenDienst, f: PersoenlicheFunktion) {
  const offen = dienst.offeneFaehigkeiten();
  return {
    id: f.id,
    art: f.art,
    stand: f.stand,
    aktuell: aktuelleFassung(f),
    fassungen: f.fassungen,
    zeitauftrag: f.zeitauftrag,
    vorschau: dienst.vorschau(f),
    laeufe: [...f.laeufe].reverse(),
    rev: f.rev,
    angelegtAm: f.angelegtAm,
    geaendertAm: f.geaendertAm,
    // BES-07-K08: ein Favorit ist nur „ausführbar", wenn keine Fähigkeit offen ist — nie simuliert.
    ausfuehrbar: offen.length === 0,
    offeneFaehigkeiten: offen,
    zeitauftragFaehigkeit: ZEITAUFTRAG_FAEHIGKEIT,
  };
}

function rumpf<T extends object>(body: unknown): T {
  return (body && typeof body === "object" ? body : {}) as T;
}

export function persoenlicheFunktionenRoutes(
  deps: FunktionenRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, kos, audit } = deps;

  return async (app) => {
    app.get("/api/me/funktionen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const funktionen = await dienst.eigene(user.id);
        reply.code(200).send({ funktionen: funktionen.map((f) => sicht(dienst, f)) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    // Nur der Entwurf: nichts wird gespeichert, kein Protokolleintrag, kein Lauf (BES-07-K04).
    // Mit `gespraech` samt den Quellen des Vorgangs, die der Fragende JETZT sehen darf.
    app.post("/api/me/funktionen/entwurf", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const vorbereitung = await dienst.entwurf(
          user.id,
          rumpf<EntwurfEingabe>(request.body),
          quellenLeser(kos, sichtbarkeitsfilterFuer(user)),
        );
        reply.code(200).send({ ...vorbereitung, offeneFaehigkeiten: dienst.offeneFaehigkeiten() });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.post("/api/me/funktionen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const { funktion, beispielwerte, nichtUebernommen } = await dienst.speichern(
          user.id,
          rumpf<FunktionSpeichernEingabe>(request.body),
          quellenLeser(kos, sichtbarkeitsfilterFuer(user)),
        );
        await audit.record({
          actor: user.id,
          action: FUNKTION_GESPEICHERT,
          target: `funktion:${funktion.id}`,
          payload: {
            art: funktion.art,
            stand: funktion.stand,
            fassung: aktuelleFassung(funktion).version,
            quellen: aktuelleFassung(funktion).quellen.length,
            verworfeneBeispielwerte: beispielwerte.length,
            herkunft: aktuelleFassung(funktion).herkunft.art,
            quellenNichtUebernommen: nichtUebernommen,
          },
        });
        reply
          .code(201)
          .send({ funktion: sicht(dienst, funktion), beispielwerte, nichtUebernommen });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>("/api/me/funktionen/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const funktion = await dienst.hole(user.id, request.params.id);
        reply.code(200).send({ funktion: sicht(dienst, funktion) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.put<{ Params: { id: string } }>("/api/me/funktionen/:id", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const funktion = await dienst.aendere(
          user.id,
          request.params.id,
          rumpf<FunktionAendernEingabe>(request.body),
          quellenLeser(kos, sichtbarkeitsfilterFuer(user)),
        );
        await audit.record({
          actor: user.id,
          action: FUNKTION_GEAENDERT,
          target: `funktion:${funktion.id}`,
          payload: { stand: funktion.stand, fassung: aktuelleFassung(funktion).version },
        });
        reply.code(200).send({ funktion: sicht(dienst, funktion) });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.put<{ Params: { id: string } }>(
      "/api/me/funktionen/:id/zeitauftrag",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { funktion } = await dienst.setzeZeitauftrag(
            user.id,
            request.params.id,
            rumpf<ZeitauftragEingabe>(request.body),
          );
          await audit.record({
            actor: user.id,
            action: FUNKTION_ZEITAUFTRAG_GESETZT,
            target: `funktion:${funktion.id}`,
            payload: {
              rhythmus: funktion.zeitauftrag?.rhythmus ?? null,
              zeitzone: funktion.zeitauftrag?.zeitzone ?? null,
              ausfuehrung: "offen",
            },
          });
          reply.code(200).send({ funktion: sicht(dienst, funktion) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.delete<{ Params: { id: string }; Querystring: { rev?: string } }>(
      "/api/me/funktionen/:id/zeitauftrag",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const rev = Number(request.query.rev);
          const funktion = await dienst.entferneZeitauftrag(user.id, request.params.id, rev);
          await audit.record({
            actor: user.id,
            action: FUNKTION_ZEITAUFTRAG_ENTFERNT,
            target: `funktion:${funktion.id}`,
          });
          reply.code(200).send({ funktion: sicht(dienst, funktion) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Der manuelle Aufruf: Rolle und Quellen von JETZT, Parameter nur dieses Laufs (BES-07-K05).
    app.post<{ Params: { id: string } }>(
      "/api/me/funktionen/:id/laeufe",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { funktion, lauf } = await dienst.laufVorbereiten(
            user.id,
            request.params.id,
            rumpf<LaufEingabe>(request.body),
            { rolle: user.role, quelleLesen: quellenLeser(kos, sichtbarkeitsfilterFuer(user)) },
          );
          await audit.record({
            actor: user.id,
            action: FUNKTION_LAUF_VORBEREITET,
            target: `funktion:${funktion.id}`,
            payload: {
              lauf: lauf.id,
              fassung: lauf.fassung,
              stand: lauf.stand,
              offen: lauf.offen,
              quellenGelesen: lauf.quellen.filter((q) => q.zustand === "gelesen").length,
              quellenNichtZugaenglich: lauf.quellen.filter((q) => q.zustand !== "gelesen").length,
              klaerung: lauf.klaerung.map((k) => k.art),
              aussenwirkung: lauf.aussenwirkung,
            },
          });
          reply.code(201).send({ funktion: sicht(dienst, funktion), lauf });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}
