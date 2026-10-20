import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import {
  type KlaraErinnerungAenderung,
  type KlaraErinnerungDienst,
  type KlaraErinnerungEingabe,
  type KlaraErinnerungEintrag,
  KlaraErinnerungFehler,
  type KlaraErinnerungLauf,
  type KlaraErinnerungLaufbericht,
  anzeigeVon,
  lageVon,
} from "../klara-erinnerung";

// ================================================================================================
// produkt:20261007:klara-erinnerungen-kalender (Klara 10) — DIE EIGENEN ERINNERUNGEN.
// ================================================================================================
//
//   GET    /api/me/klara/erinnerungen                         — die eigenen Erinnerungen mit Lage
//   POST   /api/me/klara/erinnerungen/vorschau                — Zeitangabe deuten/klären, nichts speichern
//   POST   /api/me/klara/erinnerungen                         — anlegen (eindeutiger Zeitplan)
//   GET    /api/me/klara/erinnerungen/ueberwachung            — Rückstau, Läufe je Status, letzter Takt
//   GET    /api/me/klara/erinnerungen/:id                     — eine Erinnerung samt Läufen
//   PUT    /api/me/klara/erinnerungen/:id                     — ganze Erinnerung/Serie ändern
//   POST   /api/me/klara/erinnerungen/:id/status              — pausieren, fortsetzen, erledigen, …
//   POST   /api/me/klara/erinnerungen/:id/vorkommen/:termin   — EINEN Termin absagen/verschieben/…
//   POST   /api/me/klara/erinnerungen/:id/ab/:termin          — diesen und alle folgenden ändern
//   POST   /api/me/klara/erinnerungen/:id/laeufe/:lauf/klaeren — Entscheidung zu einem offenen Lauf
//   DELETE /api/me/klara/erinnerungen/:id                     — löschen (samt Läufen und Meldungen)
//   GET/PUT /api/me/klara/erinnerungen/einstellungen          — Vorgaben des Einrichtungsassistenten (P07)
//   POST   /api/me/klara/erinnerungen/:id/uebergabe           — bewusst übergeben / zurücknehmen (K08)
//   POST   /api/me/klara/erinnerungen/:id/uebergabe/zurueckgeben — die Zuständige gibt zurück
//
// Das Konto kommt AUSSCHLIESSLICH aus der Sitzung; fremd und unbekannt antworten gleich (404). Ins
// Prüfprotokoll gehen Kennung, Art, Status und Fassung — nie Titel, Notiz oder Bezugstext.

export const KLARA_ERINNERUNG_ANGELEGT = "klara.erinnerung.angelegt";
export const KLARA_ERINNERUNG_GEAENDERT = "klara.erinnerung.geaendert";
export const KLARA_ERINNERUNG_GELOESCHT = "klara.erinnerung.geloescht";
export const KLARA_ERINNERUNG_UEBERGEBEN = "klara.erinnerung.uebergeben";
export const KLARA_ERINNERUNG_EINGERICHTET = "klara.erinnerung.eingerichtet";

export interface KlaraErinnerungRoutenDeps {
  dienst: KlaraErinnerungDienst;
  audit: AuditService;
  /** Der letzte Takt der Steuerung dieses Prozesses — `null`, wenn (noch) keiner lief. */
  letzterLauf?: () => KlaraErinnerungLaufbericht | null;
  /** Der Takt der Steuerung in Sekunden, wie `server.ts` ihn gestartet hat — `null` ohne Steuerung. */
  taktSekunden?: () => number | null;
  /** Namen zu Kontokennungen (Übergabe) — `AuthService.kontoLesen`. */
  personen?: { kontoLesen(id: string): Promise<{ name: string } | undefined> };
}

const FEHLERCODE: Record<KlaraErinnerungFehler["status"], string> = {
  400: "VALIDATION",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

function antworteMitFehler(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof KlaraErinnerungFehler) {
    reply.code(fehler.status).send({
      error: FEHLERCODE[fehler.status],
      grund: fehler.grund,
      message: fehler.message,
    });
    return;
  }
  sendError(reply, fehler);
}

function laufSicht(l: KlaraErinnerungLauf) {
  return {
    vorkommenId: l.vorkommenId,
    geplantFuer: l.geplantFuer,
    status: l.status,
    versuch: l.versuch,
    art: l.art,
    ergebnis: l.ergebnis,
    aktualisiertAm: l.aktualisiertAm,
  };
}

/** Die Sicht nach außen — ohne Kontokennung; Anzeige und Lage aus Plan UND Läufen. */
export function erinnerungSicht(
  eintrag: KlaraErinnerungEintrag,
  laeufe: readonly KlaraErinnerungLauf[],
  jetzt: number,
  uebergebenAn: string | null = null,
) {
  const e = eintrag.erinnerung;
  return {
    id: e.id,
    vorgang: e.vorgang,
    bereich: e.bereich,
    zustaendig: e.zustaendig ? ("uebergeben" as const) : ("selbst" as const),
    // AW18-K08: die bewusste Übergabe — wann und an wen (Name, nie Kontokennung).
    uebergabe: e.zustaendig ? { seit: e.zustaendig.seit, anName: uebergebenAn } : null,
    titel: e.titel,
    notiz: e.notiz,
    bezug: e.bezug,
    objektbezug: e.objektbezug,
    zeitzone: e.zeitzone,
    zeitplan: e.zeitplan,
    sommerzeit: e.sommerzeit,
    verpasst: e.verpasst,
    aktion: e.aktion,
    // EQF-07: die versionierte Routinendefinition (Abschnitte, Quellen, Ziel, Wirkungen, Modus).
    routine: e.routine ?? null,
    ziel: e.ziel,
    status: e.status,
    lage: lageVon(eintrag, laeufe, jetzt),
    anzeige: anzeigeVon(e, Math.max(jetzt, eintrag.steuer.bearbeitetBis ?? 0)),
    ausnahmen: e.ausnahmen,
    quelleFehltAkzeptiert: e.quelleFehltAkzeptiert,
    serieVon: e.serieVon,
    angelegtAm: e.angelegtAm,
    geaendertAm: e.geaendertAm,
    fassung: e.fassung,
    laeufe: laeufe.map(laufSicht),
  };
}

/**
 * AW18-K08: was die bewusst ZUSTÄNDIGE Person sieht — Titel, Termine, Status und Lage. NIE Notiz,
 * Bezug, Objektbezug, Quellinhalt oder Laufergebnisse: persönliche Inhalte bleiben beim Eigentümer.
 */
export function uebernommeneSicht(
  eintrag: KlaraErinnerungEintrag,
  laeufe: readonly KlaraErinnerungLauf[],
  jetzt: number,
  vonName: string | null,
) {
  const e = eintrag.erinnerung;
  return {
    id: e.id,
    titel: e.titel,
    zeitzone: e.zeitzone,
    zeitplan: e.zeitplan,
    status: e.status,
    lage: lageVon(eintrag, laeufe, jetzt),
    anzeige: anzeigeVon(e, Math.max(jetzt, eintrag.steuer.bearbeitetBis ?? 0)),
    seit: e.zustaendig?.seit ?? null,
    vonName,
  };
}

function rumpf<T>(body: unknown): T {
  return (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as T;
}

export function klaraErinnerungRoutes(
  deps: KlaraErinnerungRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, audit } = deps;

  const nameVon = async (id: string | undefined): Promise<string | null> =>
    id && deps.personen ? ((await deps.personen.kontoLesen(id))?.name ?? null) : null;

  const sicht = async (eintrag: KlaraErinnerungEintrag) =>
    erinnerungSicht(
      eintrag,
      await dienst.laeufe(eintrag.erinnerung.id),
      dienst.uhr(),
      await nameVon(eintrag.erinnerung.zustaendig?.kontoId),
    );

  const geaendert = (actor: string, eintrag: KlaraErinnerungEintrag, art: string) =>
    audit.record({
      actor,
      action: KLARA_ERINNERUNG_GEAENDERT,
      target: `klara-erinnerung:${eintrag.erinnerung.id}`,
      payload: { art, fassung: eintrag.erinnerung.fassung, status: eintrag.erinnerung.status },
    });

  return async (app) => {
    app.get("/api/me/klara/erinnerungen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const eintraege = await dienst.liste(user.id);
        const uebernommen = await dienst.uebernommene(user.id);
        reply.code(200).send({
          erinnerungen: await Promise.all(eintraege.map(sicht)),
          uebernommen: await Promise.all(
            uebernommen.map(async (u) =>
              uebernommeneSicht(
                u,
                await dienst.laeufe(u.erinnerung.id),
                dienst.uhr(),
                await nameVon(u.erinnerung.kontoId),
              ),
            ),
          ),
        });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    // P07: die Vorgaben des freiwilligen, erneut aufrufbaren Einrichtungsassistenten.
    app.get("/api/me/klara/erinnerungen/einstellungen", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const { kontoId: _konto, ...einstellungen } = await dienst.einstellungen(user.id);
        reply.code(200).send({ einstellungen });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.put<{ Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/einstellungen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { kontoId: _konto, ...einstellungen } = await dienst.setzeEinstellungen(
            user.id,
            rumpf<Record<string, unknown>>(request.body),
          );
          await audit.record({
            actor: user.id,
            action: KLARA_ERINNERUNG_EINGERICHTET,
            target: `klara-erinnerung-einstellungen:${user.id}`,
            payload: {
              fassung: einstellungen.fassung,
              zeitzone: einstellungen.zeitzone,
              abgeschlossen: einstellungen.eingerichtetAm !== null,
            },
          });
          reply.code(200).send({ einstellungen });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/vorschau",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          reply.code(200).send(dienst.vorschau(rumpf<Record<string, unknown>>(request.body)));
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Body: KlaraErinnerungEingabe }>(
      "/api/me/klara/erinnerungen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { eintrag, wiederholt } = await dienst.lege(
            user.id,
            rumpf<KlaraErinnerungEingabe>(request.body),
          );
          if (!wiederholt) {
            await audit.record({
              actor: user.id,
              action: KLARA_ERINNERUNG_ANGELEGT,
              target: `klara-erinnerung:${eintrag.erinnerung.id}`,
              payload: {
                zeitplan: eintrag.erinnerung.zeitplan.art,
                bezug: eintrag.erinnerung.bezug.art,
                zeitzone: eintrag.erinnerung.zeitzone,
              },
            });
          }
          reply.code(wiederholt ? 200 : 201).send({ erinnerung: await sicht(eintrag), wiederholt });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Vor `/:id` registriert — sonst wäre „ueberwachung" eine Kennung.
    app.get("/api/me/klara/erinnerungen/ueberwachung", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      try {
        const eigene = await dienst.ueberwachung(user.id);
        reply.code(200).send({
          ...eigene,
          steuerung: {
            taktSekunden: deps.taktSekunden?.() ?? null,
            // Nur Zeitpunkte und Zahlen des letzten Takts — keine Inhalte anderer Personen.
            letzterLauf: deps.letzterLauf?.() ?? null,
          },
        });
      } catch (fehler) {
        antworteMitFehler(reply, fehler);
      }
    });

    app.get<{ Params: { id: string } }>(
      "/api/me/klara/erinnerungen/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          reply
            .code(200)
            .send({ erinnerung: await sicht(await dienst.eintrag(user.id, request.params.id)) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: KlaraErinnerungAenderung }>(
      "/api/me/klara/erinnerungen/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eintrag = await dienst.aendere(
            user.id,
            request.params.id,
            rumpf<KlaraErinnerungAenderung>(request.body),
          );
          await geaendert(user.id, eintrag, "ganz");
          reply.code(200).send({ erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // AW18-K08: bewusste Übergabe an eine heute aktive Person (`an`: Adresse) — oder zurück (`null`).
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/:id/uebergabe",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { eintrag, an } = await dienst.uebergib(
            user.id,
            request.params.id,
            rumpf<Record<string, unknown>>(request.body),
          );
          await audit.record({
            actor: user.id,
            action: KLARA_ERINNERUNG_UEBERGEBEN,
            target: `klara-erinnerung:${eintrag.erinnerung.id}`,
            // Kennungen, nie Titel — die Empfängerin steht als Kontokennung im Protokoll.
            payload: { an: an?.id ?? null, fassung: eintrag.erinnerung.fassung },
          });
          reply.code(200).send({ erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // Die Zuständige gibt eine übergebene Erinnerung bewusst an den Eigentümer zurück.
    app.post<{ Params: { id: string } }>(
      "/api/me/klara/erinnerungen/:id/uebergabe/zurueckgeben",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          await dienst.gibZurueck(user.id, request.params.id);
          await audit.record({
            actor: user.id,
            action: KLARA_ERINNERUNG_UEBERGEBEN,
            target: `klara-erinnerung:${request.params.id}`,
            payload: { zurueckgegeben: true },
          });
          reply.code(200).send({ zurueckgegeben: true });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // EQF-07: eine Routine in Worten („künftig montags“, „nimm die erledigten Aufgaben dazu“,
    // „pausieren“, „beenden“) oder per Definition ändern. Ohne `anwenden: true` nur deuten.
    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/:id/routine",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { deutung, angewendet, eintrag } = await dienst.aendereRoutine(
            user.id,
            request.params.id,
            rumpf<Record<string, unknown>>(request.body),
          );
          if (angewendet) {
            await geaendert(user.id, eintrag, `routine:${deutung.art}`);
          }
          reply.code(200).send({ deutung, angewendet, erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    // EQF-07: den Bericht EINES Termins zurücknehmen (Notiz entfernen) — nur unverändert.
    app.post<{ Params: { id: string; lauf: string } }>(
      "/api/me/klara/erinnerungen/:id/laeufe/:lauf/ergebnis-zuruecknehmen",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const lauf = await dienst.nimmRoutineErgebnisZurueck(
            user.id,
            request.params.id,
            request.params.lauf,
          );
          await audit.record({
            actor: user.id,
            action: KLARA_ERINNERUNG_GEAENDERT,
            target: `klara-erinnerung:${request.params.id}`,
            payload: { vorgang: "routine:ergebnis_zurueckgenommen", lauf: lauf.vorkommenId },
          });
          const eintrag = await dienst.eintrag(user.id, request.params.id);
          reply.code(200).send({ erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/:id/status",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eintrag = await dienst.status(
            user.id,
            request.params.id,
            rumpf<Record<string, unknown>>(request.body),
          );
          await geaendert(user.id, eintrag, `status:${String(request.body?.aktion)}`);
          reply.code(200).send({ erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string; termin: string }; Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/:id/vorkommen/:termin",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eintrag = await dienst.vorkommen(
            user.id,
            request.params.id,
            request.params.termin,
            rumpf<Record<string, unknown>>(request.body),
          );
          await geaendert(user.id, eintrag, `vorkommen:${String(request.body?.aktion)}`);
          reply.code(200).send({ erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string; termin: string }; Body: KlaraErinnerungAenderung }>(
      "/api/me/klara/erinnerungen/:id/ab/:termin",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const { bisher, neu } = await dienst.abHier(
            user.id,
            request.params.id,
            request.params.termin,
            rumpf<KlaraErinnerungAenderung & { vorgang?: unknown }>(request.body),
          );
          await geaendert(user.id, bisher, "folgende");
          if (neu.erinnerung.id !== bisher.erinnerung.id) {
            await audit.record({
              actor: user.id,
              action: KLARA_ERINNERUNG_ANGELEGT,
              target: `klara-erinnerung:${neu.erinnerung.id}`,
              payload: { zeitplan: neu.erinnerung.zeitplan.art, serieVon: bisher.erinnerung.id },
            });
          }
          reply.code(200).send({ bisher: await sicht(bisher), neu: await sicht(neu) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string; lauf: string }; Body: Record<string, unknown> }>(
      "/api/me/klara/erinnerungen/:id/laeufe/:lauf/klaeren",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          const eintrag = await dienst.klaere(
            user.id,
            request.params.id,
            request.params.lauf,
            rumpf<Record<string, unknown>>(request.body),
          );
          await geaendert(user.id, eintrag, `klaerung:${String(request.body?.entscheidung)}`);
          reply.code(200).send({ erinnerung: await sicht(eintrag) });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );

    app.delete<{ Params: { id: string } }>(
      "/api/me/klara/erinnerungen/:id",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        try {
          if (!(await dienst.loesche(user.id, request.params.id))) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Erinnerung nicht gefunden." });
            return;
          }
          await audit.record({
            actor: user.id,
            action: KLARA_ERINNERUNG_GELOESCHT,
            target: `klara-erinnerung:${request.params.id}`,
          });
          reply.code(200).send({ geloescht: 1 });
        } catch (fehler) {
          antworteMitFehler(reply, fehler);
        }
      },
    );
  };
}
