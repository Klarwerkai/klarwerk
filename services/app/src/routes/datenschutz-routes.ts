// ================================================================================================
// BETROFFENENRECHTE — AUSKUNFT, DATENMITNAHME, LÖSCHANTRAG, VERARBEITUNGSVERZEICHNIS.
// ================================================================================================
//
// R-0663 · R-1645: `GET /api/me/daten` — jede angemeldete Person holt „auf Knopfdruck", was das
// System über sie gespeichert hat (`selbstauskunft.ts`). Für ein Konto, das sich nicht mehr anmelden
// kann (ausgeschieden, gesperrt, gelöscht), erstellt die Verwaltung dieselbe Auskunft über
// `GET /api/datenschutz/auskunft/:nutzerId`.
// R-0661: `POST /api/me/loeschantrag` legt einen Antrag mit Frist an; die Verwaltung sieht ihn als
// Aufgabe (Glocke und Datenschutzkarte) und erledigt ihn über den VORHANDENEN Löschweg oder lehnt
// ihn mit Grund ab (`loeschantraege.ts`).
// R-0667: `GET /api/datenschutz/verarbeitungsverzeichnis` erzeugt das Verzeichnis aus dem
// Dateninventar und der Betriebslage (`dateninventar.ts`) — als JSON oder Markdown.
//
// RECHTE NACH DER BESTEHENDEN KONTOREGEL, KEINE NEUE ROLLE: die eigenen Daten und der eigene Antrag
// brauchen nur eine Anmeldung (`requireUser`); alles über fremde Konten und das Verzeichnis braucht
// `users.manage` (Verwalter) — dieselbe Grenze wie das Löschen eines Kontos.
//
// SICHTBARKEIT: welche Objekttitel in einer Auskunft erscheinen, entscheidet
// `sichtbarkeitsfilterFuer` des BETRACHTERS — die eigenen Beiträge erscheinen immer, ein Titel nur,
// wenn der Betrachter das Objekt heute sehen darf.
//
// PRÜFPROTOKOLL OHNE FREITEXT: belegt werden Antrag, Entscheidung und erteilte Auskunft mit
// Kennungen und Frist — nie Begründung, Ablehnungsgrund oder Inhalt der Auskunft.
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { AuthError, type PublicUser } from "../../../auth";
import {
  type Betriebslage,
  erzeugeVerarbeitungsverzeichnis,
  verzeichnisAlsMarkdown,
} from "../dateninventar";
import type { Guards } from "../http";
import {
  LOESCHANTRAG_GRENZEN,
  type Loeschantrag,
  LoeschantragFehler,
  type LoeschantragRepo,
  istUeberfaellig,
  istWiederaufnehmbar,
  neuerLoeschantrag,
  uebernahmeAbgelaufenVor,
} from "../loeschantraege";
import { type SelbstauskunftQuellen, erstelleSelbstauskunft } from "../selbstauskunft";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

export interface DatenschutzRouteDienste {
  quellen: SelbstauskunftQuellen;
  loeschantraege: LoeschantragRepo;
  auth: {
    listUsers(): Promise<PublicUser[]>;
    deleteUser(userId: string, actorId: string): Promise<void>;
  };
  audit: AuditService;
  /** Die Betriebslage zum Zeitpunkt der Erzeugung (Modellanbieter, Recherche, Mailversand). */
  betriebslage: () => Betriebslage;
  /** Uhr in Millisekunden — in Tests stellbar für Frist und Überfälligkeit. */
  jetzt?: () => number;
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof LoeschantragFehler) {
    const status =
      e.code === "NICHT_GEFUNDEN"
        ? 404
        : e.code === "NICHT_HALTBAR"
          ? 503
          : e.code === "BEREITS_OFFEN" || e.code === "NICHT_OFFEN"
            ? 409
            : 400;
    reply.code(status).send({ error: e.code, message: e.message });
    return;
  }
  throw e;
}

function textAus(body: unknown, feld: string): string | null | undefined {
  const wert = (body as Record<string, unknown> | null | undefined)?.[feld];
  if (wert === undefined || wert === null) {
    return null;
  }
  return typeof wert === "string" ? wert : undefined;
}

/** Ein Antrag für die Verwaltung: mit Name und Adresse des Kontos, solange es besteht. */
function verwaltungssicht(
  antrag: Loeschantrag,
  konten: readonly PublicUser[],
  jetzt: number,
): Loeschantrag & {
  nutzer: { name: string; email: string } | null;
  ueberfaellig: boolean;
  wiederaufnehmbar: boolean;
} {
  const konto = konten.find((k) => k.id === antrag.nutzerId);
  return {
    ...antrag,
    nutzer: konto ? { name: konto.name, email: konto.email } : null,
    ueberfaellig: istUeberfaellig(antrag, jetzt),
    wiederaufnehmbar: istWiederaufnehmbar(antrag, jetzt),
  };
}

export function datenschutzRoutes(
  dienste: DatenschutzRouteDienste,
  guards: Guards,
): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => Date.now());
  return async (app) => {
    // ---- die eigene Person -------------------------------------------------------------------

    // Auskunft und Datenmitnahme (Art. 15, Art. 20): alles, was über die eigene Kennung gespeichert ist.
    app.get("/api/me/daten", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const auskunft = await erstelleSelbstauskunft(
        dienste.quellen,
        user.id,
        sichtbarkeitsfilterFuer(user),
        new Date(jetzt()),
      );
      await dienste.audit.record({
        actor: user.id,
        action: "datenschutz.auskunft",
        target: user.id,
        payload: { weg: "selbst" },
      });
      reply.code(200).send(auskunft);
    });

    // Die eigenen Löschanträge, jüngster zuerst.
    app.get("/api/me/loeschantrag", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const antraege = await dienste.loeschantraege.vonNutzer(user.id);
      const t = jetzt();
      reply.code(200).send({
        antraege: antraege.map((a) => ({ ...a, ueberfaellig: istUeberfaellig(a, t) })),
      });
    });

    // Antrag stellen. Ein offener Antrag je Konto; ein zweiter ist 409, nicht ein Duplikat.
    app.post<{ Body: unknown }>("/api/me/loeschantrag", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      const begruendung = textAus(request.body, "begruendung");
      if (begruendung === undefined) {
        reply.code(400).send({
          error: "BEGRUENDUNG_UNGUELTIG",
          message: "Die Begründung muss Text sein.",
        });
        return;
      }
      try {
        const antrag = neuerLoeschantrag(user.id, begruendung, new Date(jetzt()));
        if (!(await dienste.loeschantraege.lege(antrag))) {
          throw new LoeschantragFehler(
            "BEREITS_OFFEN",
            "Es gibt bereits einen offenen Löschantrag für dieses Konto.",
          );
        }
        await dienste.audit.record({
          actor: user.id,
          action: "loeschantrag.gestellt",
          target: antrag.id,
          payload: { nutzerId: user.id, fristBis: antrag.fristBis },
        });
        reply.code(201).send({ ...antrag, ueberfaellig: false });
      } catch (e) {
        fehler(reply, e);
      }
    });

    // Den eigenen offenen Antrag zurückziehen.
    app.post<{ Params: { id: string } }>(
      "/api/me/loeschantrag/:id/zurueckziehen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const antrag = await dienste.loeschantraege.finde(request.params.id);
          // Ein fremder Antrag ist für den Aufrufer nicht vorhanden — dieselbe 404 wie ein fehlender.
          if (!antrag || antrag.nutzerId !== user.id) {
            throw new LoeschantragFehler("NICHT_GEFUNDEN", "Löschantrag nicht gefunden.");
          }
          const neu: Loeschantrag = {
            ...antrag,
            status: "zurueckgezogen",
            entschiedenVon: user.id,
            entschiedenAm: new Date(jetzt()).toISOString(),
          };
          if (!(await dienste.loeschantraege.abschliessen(neu))) {
            throw new LoeschantragFehler("NICHT_OFFEN", "Der Löschantrag ist nicht mehr offen.");
          }
          await dienste.audit.record({
            actor: user.id,
            action: "loeschantrag.zurueckgezogen",
            target: antrag.id,
            payload: { nutzerId: user.id },
          });
          reply.code(200).send({ ...neu, ueberfaellig: false });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // ---- die Verwaltung ------------------------------------------------------------------------

    // Alle Anträge mit Frist und Überfälligkeit — die Aufgabenliste der Verwaltung.
    app.get("/api/datenschutz/loeschantraege", async (request, reply) => {
      const admin = await guards.requirePermission("users.manage", request, reply);
      if (!admin) {
        return;
      }
      const [antraege, konten] = await Promise.all([
        dienste.loeschantraege.alle(),
        dienste.auth.listUsers(),
      ]);
      const t = jetzt();
      reply.code(200).send({ antraege: antraege.map((a) => verwaltungssicht(a, konten, t)) });
    });

    // Erledigen = den Antrag ATOMAR übernehmen, DANN das Konto über den vorhandenen Löschweg
    // löschen, dann aus der Übernahme abschliessen (Nacharbeit 4, BEN). Wer die Übernahme nicht
    // gewinnt — weil zurückgezogen, abgelehnt oder von einer zweiten Erledigung übernommen —, löscht
    // nichts. Scheitert das Löschen, wird die Übernahme freigegeben: der Antrag ist wieder offen und
    // erneut bearbeitbar. Bricht der Vorgang ganz ab, wird die Übernahme nach
    // `UEBERNAHME_GUELTIG_MS` wieder übernehmbar.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/datenschutz/loeschantraege/:id/erledigen",
      async (request, reply) => {
        const admin = await guards.requirePermission("users.manage", request, reply);
        if (!admin) {
          return;
        }
        try {
          const t = jetzt();
          const uebernahme = {
            token: randomUUID(),
            am: new Date(t).toISOString(),
            von: admin.id,
          };
          const antrag = await dienste.loeschantraege.uebernehmen(
            request.params.id,
            uebernahme,
            uebernahmeAbgelaufenVor(t),
          );
          if (!antrag) {
            if (!(await dienste.loeschantraege.finde(request.params.id))) {
              throw new LoeschantragFehler("NICHT_GEFUNDEN", "Löschantrag nicht gefunden.");
            }
            throw new LoeschantragFehler(
              "NICHT_OFFEN",
              "Der Löschantrag ist nicht mehr offen oder wird gerade bearbeitet.",
            );
          }
          let grund: string | null = null;
          try {
            await dienste.auth.deleteUser(antrag.nutzerId, admin.id);
          } catch (e) {
            if (e instanceof AuthError && e.code === "NOT_FOUND") {
              grund = "Konto war bereits gelöscht.";
            } else {
              // Nichts gelöscht: die Übernahme zurückgeben, damit der Antrag offen bleibt.
              await dienste.loeschantraege.freigeben(antrag.id, uebernahme.token);
              if (e instanceof AuthError && e.code === "FORBIDDEN") {
                reply.code(409).send({
                  error: "LETZTER_ADMIN",
                  message:
                    "Das letzte unbefristete Verwalterkonto kann nicht gelöscht werden. Bitte zuerst ein weiteres Verwalterkonto einrichten oder den Antrag mit Grund ablehnen.",
                });
                return;
              }
              throw e;
            }
          }
          const neu: Loeschantrag = {
            ...antrag,
            status: "erledigt",
            entschiedenVon: admin.id,
            entschiedenAm: new Date(jetzt()).toISOString(),
            entscheidungsgrund: grund,
          };
          // Nur wer die Übernahme noch hält, schliesst ab. Hat eine zweite Erledigung eine
          // abgelaufene Übernahme an sich gezogen, gilt deren Abschluss; sie findet das Konto
          // gelöscht vor und vermerkt das. Hier wird dann NICHTS behauptet.
          if (!(await dienste.loeschantraege.abschliessen(neu, "in_bearbeitung"))) {
            throw new LoeschantragFehler(
              "NICHT_OFFEN",
              "Das Konto ist gelöscht, der Antrag wurde aber inzwischen von einer anderen Bearbeitung übernommen; sie schliesst ihn ab.",
            );
          }
          await dienste.audit.record({
            actor: admin.id,
            action: "loeschantrag.erledigt",
            target: antrag.id,
            payload: { nutzerId: antrag.nutzerId, fristBis: antrag.fristBis },
          });
          reply
            .code(200)
            .send({ ...neu, nutzer: null, ueberfaellig: false, wiederaufnehmbar: false });
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Ablehnen — nur mit Grund (er steht am Antrag, nicht im Protokoll).
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/datenschutz/loeschantraege/:id/ablehnen",
      async (request, reply) => {
        const admin = await guards.requirePermission("users.manage", request, reply);
        if (!admin) {
          return;
        }
        try {
          const grund = textAus(request.body, "grund")?.trim() ?? "";
          if (grund.length === 0) {
            throw new LoeschantragFehler("GRUND_FEHLT", "Eine Ablehnung braucht einen Grund.");
          }
          if (grund.length > LOESCHANTRAG_GRENZEN.grund) {
            throw new LoeschantragFehler(
              "ZU_LANG",
              `Der Grund darf höchstens ${LOESCHANTRAG_GRENZEN.grund} Zeichen lang sein.`,
            );
          }
          const antrag = await dienste.loeschantraege.finde(request.params.id);
          if (!antrag) {
            throw new LoeschantragFehler("NICHT_GEFUNDEN", "Löschantrag nicht gefunden.");
          }
          const neu: Loeschantrag = {
            ...antrag,
            status: "abgelehnt",
            entschiedenVon: admin.id,
            entschiedenAm: new Date(jetzt()).toISOString(),
            entscheidungsgrund: grund,
          };
          if (!(await dienste.loeschantraege.abschliessen(neu))) {
            throw new LoeschantragFehler("NICHT_OFFEN", "Der Löschantrag ist nicht mehr offen.");
          }
          await dienste.audit.record({
            actor: admin.id,
            action: "loeschantrag.abgelehnt",
            target: antrag.id,
            payload: { nutzerId: antrag.nutzerId, fristBis: antrag.fristBis },
          });
          const konten = await dienste.auth.listUsers();
          reply.code(200).send(verwaltungssicht(neu, konten, jetzt()));
        } catch (e) {
          fehler(reply, e);
        }
      },
    );

    // Auskunft über ein anderes Konto — auch eines, das sich nicht mehr anmelden kann (R-1645).
    app.get<{ Params: { nutzerId: string } }>(
      "/api/datenschutz/auskunft/:nutzerId",
      async (request, reply) => {
        const admin = await guards.requirePermission("users.manage", request, reply);
        if (!admin) {
          return;
        }
        const auskunft = await erstelleSelbstauskunft(
          dienste.quellen,
          request.params.nutzerId,
          sichtbarkeitsfilterFuer(admin),
          new Date(jetzt()),
        );
        await dienste.audit.record({
          actor: admin.id,
          action: "datenschutz.auskunft",
          target: request.params.nutzerId,
          payload: { weg: "verwaltung" },
        });
        reply.code(200).send(auskunft);
      },
    );

    // Das Verzeichnis der Verarbeitungstätigkeiten, erzeugt aus Inventar und Betriebslage.
    app.get<{ Querystring: { format?: string } }>(
      "/api/datenschutz/verarbeitungsverzeichnis",
      async (request, reply) => {
        const admin = await guards.requirePermission("users.manage", request, reply);
        if (!admin) {
          return;
        }
        const format = request.query.format ?? "json";
        if (format !== "json" && format !== "markdown") {
          reply.code(400).send({
            error: "FORMAT_UNBEKANNT",
            message: "Erlaubt sind format=json und format=markdown.",
          });
          return;
        }
        const verzeichnis = erzeugeVerarbeitungsverzeichnis(
          dienste.betriebslage(),
          new Date(jetzt()),
        );
        if (format === "markdown") {
          reply
            .code(200)
            .header("content-type", "text/markdown; charset=utf-8")
            .send(verzeichnisAlsMarkdown(verzeichnis));
          return;
        }
        reply.code(200).send(verzeichnis);
      },
    );
  };
}
