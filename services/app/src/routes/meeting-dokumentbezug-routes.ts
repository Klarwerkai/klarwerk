import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { isValidConfidentiality } from "../../../knowledge-object";
import { type ObjectStore, decodeDataUrl } from "../../../object-store";
import type { Guards, SessionUser } from "../http";
import {
  BindungsFehler,
  type Foliensatz,
  FoliensatzFehler,
  type Folienwechsel,
  MeetingDokumentbezug,
  type Rechtepruefung,
  type RueckmeldungsArt,
  foliensatzLesen,
  webvttLesen,
} from "../meeting-dokumentbezug";
import type { MeetingBezugAblage, MeetingBezugEintrag } from "../meeting-dokumentbezug-ablage";
import { type AnhangQuellen, beurteileAnhang } from "../sichtbarkeit";

// ================================================================================================
// BPA-16 · DER BEDIENWEG DER MEETING-/FOLIENBEZÜGE (Nacharbeit 2, Bens Befund 1).
// ================================================================================================
//
// Alle Pfade unter /api/meetings:
//   GET  /                                 — eigene Meetingbezüge
//   POST /                                 — Bezug anlegen (Titel, Zeitbasis, Teilnehmer)
//   GET  /:id                              — Präsentationen, Mitschriften, Rückmeldungen
//   POST /:id/praesentationen              — präsentierte Datei (+ Original) verbinden
//   POST /:id/mitschriften                 — WebVTT-Mitschrift verbinden
//   POST /:id/folienwechsel                — Folienwechsel (Host: Datei/Fassung/sldId)
//   POST /:id/rueckmeldungen               — Rückmeldung zu einer Gesprächsstelle
//   GET  /:id/rueckmeldungen/:rid          — Rückmeldung samt Historie
//   POST /:id/rueckmeldungen/:rid/klaerung — Zuordnung klären/korrigieren
//   POST /:id/rueckmeldungen/:rid/verwerfen — Vorschlag verwerfen
//   GET  /:id/folien/:dateiId/:sldId       — Rückmeldungen AUS DER FOLIE
//   GET  /:id/zeitstellen/:zeitMs          — Rückmeldungen AUS DER ZEITSTELLE
//   POST /:id/fassungsabgleich             — neue Originalfassung abgleichen
//
// DATEIEN kommen ausschliesslich über den vorhandenen berechtigten Objektweg: hochgeladen über
// `POST /api/objects`, gelesen über `ObjectStore`, beurteilt mit DEMSELBEN Prädikat wie
// `GET /api/objects/:id` (`beurteileAnhang`). Die Dateikennung einer Präsentation IST die
// Objektkennung. Eine Bildschirmansicht oder ein Bild ist hier kein Weg zur Originaldatei.
//
// RECHTE: Lesen verlangt `ko.read`, Wirkungen `ko.create` — kein neues Recht. Dazu das
// Meetingrecht (Eigner oder eingetragener Teilnehmer; sonst 404, keine Existenzauskunft) und je
// Datei das aktuelle Sichtbarkeitsurteil des Objekts, erhoben bei JEDER Anfrage. Versteckte
// Folien und Sprechernotizen hängen am Leserecht der Datei selbst — wer die Datei öffnen darf,
// sieht beides auch in PowerPoint; Meetingteilnahme allein öffnet keins von beiden.
//
// OCR wird über diesen Weg nicht angenommen (`ocrErlaubt: false`): die Prüfung der Schutzstufe
// für eine Modellstufe (P04, „Keine KI") ist hier nicht verdrahtet. Eine KI-Empfehlung legt diese
// Route ebenfalls nicht an — es gibt hier keinen Modellaufruf.

export interface MeetingDokumentbezugRoutesDeps {
  ablage: MeetingBezugAblage;
  objects: ObjectStore;
  /** Dieselben Herkünfte wie an `objectRoutes` — für dasselbe Urteil über jede Datei. */
  quellen: AnhangQuellen;
}

const NICHT_GEFUNDEN = { error: "NOT_FOUND", message: "Meeting nicht gefunden." };
const ARTEN_AUS_GESPRAECH: readonly RueckmeldungsArt[] = [
  "beschlossene_korrektur",
  "vorschlag",
  "offene_frage",
];

function ungueltig(reply: FastifyReply, message: string): void {
  reply.code(400).send({ error: "VALIDATION", message });
}

function text(wert: unknown, max: number): string | null {
  return typeof wert === "string" && wert.trim().length > 0 && wert.length <= max
    ? wert.trim()
    : null;
}

function zahl(wert: unknown): number | null {
  return typeof wert === "number" && Number.isInteger(wert) && wert >= 0 ? wert : null;
}

/** Fehler der Bindungsschicht → Antwort. Unbekanntes wird weitergeworfen (500 über Fastify). */
function fehlerAntwort(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof BindungsFehler) {
    if (fehler.art === "kein_zugriff") {
      reply.code(404).send(NICHT_GEFUNDEN);
      return;
    }
    ungueltig(reply, fehler.message);
    return;
  }
  if (fehler instanceof FoliensatzFehler) {
    if (fehler.status === 413) {
      reply.code(413).send({ error: "PAYLOAD_TOO_LARGE", message: fehler.message });
      return;
    }
    ungueltig(reply, fehler.message);
    return;
  }
  throw fehler;
}

interface Zugang {
  eintrag: MeetingBezugEintrag;
  bezug: MeetingDokumentbezug;
}

export function meetingDokumentbezugRoutes(
  deps: MeetingDokumentbezugRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { ablage, objects, quellen } = deps;

  /**
   * Der Meetingbezug mit den Rechten DIESES Nutzers zu DIESEM Zeitpunkt — oder null (404 bereits
   * gesendet). Das Dokumentrecht ist je Datei das Urteil von `beurteileAnhang`, wie am Objektweg.
   */
  async function zugang(
    user: SessionUser,
    meetingId: string,
    reply: FastifyReply,
    weitere: readonly string[] = [],
  ): Promise<Zugang | null> {
    const eintrag = await ablage.lesen(meetingId);
    if (!eintrag || (eintrag.eigner !== user.id && !eintrag.teilnehmer.includes(user.id))) {
      reply.code(404).send(NICHT_GEFUNDEN);
      return null;
    }
    const roh = MeetingDokumentbezug.ausZustand(eintrag.zustand, {
      meetingLesen: () => false,
      dokumentLesen: () => false,
      versteckteFolienLesen: () => false,
      notizenLesen: () => false,
    });
    const sichtbar = new Set<string>();
    for (const id of new Set([...roh.dateiKennungen(), ...weitere])) {
      const obj = await objects.read(id);
      if (!obj) {
        continue;
      }
      const urteil = await beurteileAnhang(
        user,
        id,
        {
          confidentiality: isValidConfidentiality(obj.ref.confidentiality)
            ? obj.ref.confidentiality
            : null,
          author: obj.ref.lifecycle?.owner ?? null,
        },
        quellen,
      );
      if (urteil.sichtbar) {
        sichtbar.add(id);
      }
    }
    const rechte: Rechtepruefung = {
      meetingLesen: (n, m) => n === user.id && m === eintrag.meetingId,
      dokumentLesen: (n, d) => n === user.id && sichtbar.has(d),
      versteckteFolienLesen: (n, d) => n === user.id && sichtbar.has(d),
      notizenLesen: (n, d) => n === user.id && sichtbar.has(d),
    };
    return { eintrag, bezug: MeetingDokumentbezug.ausZustand(eintrag.zustand, rechte) };
  }

  /** Die Bytes eines Dateiobjekts — nur mit Leserecht (dasselbe Urteil), sonst null. */
  async function dateiLesen(user: SessionUser, objectId: string): Promise<Uint8Array | null> {
    const obj = await objects.read(objectId);
    if (!obj) {
      return null;
    }
    const urteil = await beurteileAnhang(
      user,
      objectId,
      {
        confidentiality: isValidConfidentiality(obj.ref.confidentiality)
          ? obj.ref.confidentiality
          : null,
        author: obj.ref.lifecycle?.owner ?? null,
      },
      quellen,
    );
    if (!urteil.sichtbar) {
      return null;
    }
    return decodeDataUrl(obj.data)?.bytes ?? null;
  }

  /** Schreibt bedingt gegen die gelesene Version. `false`: 409 bereits gesendet. */
  async function speichern(z: Zugang, reply: FastifyReply): Promise<boolean> {
    const neu: MeetingBezugEintrag = {
      ...z.eintrag,
      version: z.eintrag.version + 1,
      zustand: z.bezug.zustand(),
    };
    if (!(await ablage.ersetzen(neu, z.eintrag.version))) {
      reply.code(409).send({
        error: "STAND_VERALTET",
        message: "Der Meetingbezug wurde inzwischen geändert — bitte neu laden.",
      });
      return false;
    }
    return true;
  }

  return async (app) => {
    app.get("/api/meetings", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ meetings: await ablage.fuerKonto(user.id) });
    });

    app.post<{ Body: { titel?: unknown; zeitbasis?: unknown; teilnehmer?: unknown } }>(
      "/api/meetings",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const titel = text(request.body?.titel, 200);
        const zeitbasis = text(request.body?.zeitbasis, 100);
        const roh = request.body?.teilnehmer ?? [];
        if (
          !titel ||
          !zeitbasis ||
          !Array.isArray(roh) ||
          roh.length > 100 ||
          !roh.every((t) => text(t, 200) !== null)
        ) {
          ungueltig(reply, "titel, zeitbasis und teilnehmer (Liste von Kontokennungen) prüfen.");
          return;
        }
        const meetingId = `mt-${randomUUID()}`;
        const leer = new MeetingDokumentbezug(
          { meetingId, zeitbasis, ocrErlaubt: false },
          {
            meetingLesen: () => false,
            dokumentLesen: () => false,
            versteckteFolienLesen: () => false,
            notizenLesen: () => false,
          },
        );
        const eintrag: MeetingBezugEintrag = {
          meetingId,
          titel,
          eigner: user.id,
          teilnehmer: [...new Set((roh as string[]).map((t) => t.trim()))].filter(
            (t) => t !== user.id,
          ),
          version: 1,
          angelegtAm: new Date().toISOString(),
          zustand: leer.zustand(),
        };
        await ablage.anlegen(eintrag);
        reply.code(201).send({ meetingId, titel, version: 1 });
      },
    );

    app.get<{ Params: { id: string } }>("/api/meetings/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const z = await zugang(user, request.params.id, reply);
      if (!z) {
        return;
      }
      reply.code(200).send({
        meetingId: z.eintrag.meetingId,
        titel: z.eintrag.titel,
        eigen: z.eintrag.eigner === user.id,
        zeitbasis: z.bezug.meeting.zeitbasis,
        version: z.eintrag.version,
        praesentationen: await mitDateinamen(objects, z.bezug.praesentationen(user.id)),
        mitschriften: z.bezug.mitschriftenSicht(user.id),
        rueckmeldungen: z.bezug.alle(user.id),
      });
    });

    app.post<{ Params: { id: string }; Body: { objectId?: unknown; originalObjectId?: unknown } }>(
      "/api/meetings/:id/praesentationen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const objectId = text(request.body?.objectId, 200);
        const originalId =
          request.body?.originalObjectId === undefined
            ? null
            : text(request.body.originalObjectId, 200);
        if (!objectId || (request.body?.originalObjectId !== undefined && !originalId)) {
          ungueltig(reply, "objectId (und optional originalObjectId) angeben.");
          return;
        }
        const z = await zugang(user, request.params.id, reply, [
          objectId,
          ...(originalId ? [originalId] : []),
        ]);
        if (!z) {
          return;
        }
        try {
          const bytes = await dateiLesen(user, objectId);
          if (!bytes) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Datei nicht gefunden." });
            return;
          }
          const satz = await foliensatzLesen(objectId, bytes);
          let original: Foliensatz | null = null;
          if (originalId) {
            const originalBytes = await dateiLesen(user, originalId);
            if (!originalBytes) {
              reply.code(404).send({ error: "NOT_FOUND", message: "Datei nicht gefunden." });
              return;
            }
            original =
              originalId === objectId ? satz : await foliensatzLesen(originalId, originalBytes);
          }
          const abgleich = z.bezug.verbinden(user.id, satz, original);
          if (await speichern(z, reply)) {
            reply.code(200).send({ dateiId: satz.dateiId, fassung: satz.fassung, abgleich });
          }
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { objectId?: unknown; zeitbasis?: unknown } }>(
      "/api/meetings/:id/mitschriften",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const objectId = text(request.body?.objectId, 200);
        const zeitbasis = text(request.body?.zeitbasis, 100);
        if (!objectId || !zeitbasis) {
          ungueltig(reply, "objectId und zeitbasis angeben.");
          return;
        }
        const z = await zugang(user, request.params.id, reply, [objectId]);
        if (!z) {
          return;
        }
        try {
          const bytes = await dateiLesen(user, objectId);
          if (!bytes) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Datei nicht gefunden." });
            return;
          }
          const stellen = webvttLesen(Buffer.from(bytes).toString("utf8"));
          z.bezug.mitschriftVerbinden(user.id, { id: objectId, zeitbasis, stellen });
          if (await speichern(z, reply)) {
            reply.code(200).send({ id: objectId, zeitbasis, stellen });
          }
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
      "/api/meetings/:id/folienwechsel",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const b = request.body ?? {};
        const zeitMs = zahl(b.zeitMs);
        const zeitbasis = text(b.zeitbasis, 100);
        let ereignis: Folienwechsel | null = null;
        if (zeitMs !== null && zeitbasis) {
          const dateiId = text(b.dateiId, 200);
          const fassung = text(b.fassung, 100);
          const sldId = text(b.sldId, 20);
          const position = zahl(b.position);
          if (b.quelle === "host" && dateiId && fassung && sldId) {
            ereignis = { quelle: "host", zeitMs, zeitbasis, dateiId, fassung, sldId };
          } else if (b.quelle === "nummer" && position !== null) {
            ereignis = { quelle: "nummer", zeitMs, zeitbasis, position };
          }
        }
        if (!ereignis) {
          ungueltig(
            reply,
            "quelle (host: dateiId/fassung/sldId; nummer: position) und Zeit angeben.",
          );
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        try {
          z.bezug.folienwechsel(user.id, ereignis);
          if (await speichern(z, reply)) {
            reply.code(200).send({ angenommen: true });
          }
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
      "/api/meetings/:id/rueckmeldungen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const b = request.body ?? {};
        const mitschriftId = text(b.mitschriftId, 200);
        const stelleId = text(b.stelleId, 200);
        const inhalt = text(b.text, 2000);
        const art = ARTEN_AUS_GESPRAECH.find((a) => a === b.art);
        if (!mitschriftId || !stelleId || !inhalt || !art) {
          ungueltig(reply, "mitschriftId, stelleId, art und text angeben.");
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        try {
          const vorher = z.bezug.alle(user.id).length;
          const eingabe = { mitschriftId, stelleId, art, text: inhalt };
          const sicht = z.bezug.rueckmeldung(user.id, eingabe);
          if (await speichern(z, reply)) {
            // 201 neu angelegt, 200 dieselbe Rückmeldung erneut gemeldet (keine Dublette).
            reply.code(z.bezug.alle(user.id).length > vorher ? 201 : 200).send(sicht);
          }
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string; rid: string } }>(
      "/api/meetings/:id/rueckmeldungen/:rid",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        const sicht = z.bezug.sicht(user.id, request.params.rid);
        if (!sicht) {
          reply.code(404).send(NICHT_GEFUNDEN);
          return;
        }
        const historie = z.bezug.historie(user.id, request.params.rid);
        reply.code(200).send({ rueckmeldung: sicht, historie });
      },
    );

    app.post<{ Params: { id: string; rid: string }; Body: Record<string, unknown> }>(
      "/api/meetings/:id/rueckmeldungen/:rid/klaerung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const b = request.body ?? {};
        const dateiId = text(b.dateiId, 200);
        const fassung = text(b.fassung, 100);
        const sldId = text(b.sldId, 20);
        if (!dateiId || !fassung || !sldId) {
          ungueltig(reply, "dateiId, fassung und sldId angeben.");
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        try {
          const sicht = z.bezug.klaeren(user.id, request.params.rid, { dateiId, fassung, sldId });
          if (await speichern(z, reply)) {
            reply.code(200).send(sicht);
          }
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    app.post<{ Params: { id: string; rid: string } }>(
      "/api/meetings/:id/rueckmeldungen/:rid/verwerfen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        try {
          const sicht = z.bezug.verwerfen(user.id, request.params.rid);
          if (await speichern(z, reply)) {
            reply.code(200).send(sicht);
          }
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    app.get<{ Params: { id: string; dateiId: string; sldId: string } }>(
      "/api/meetings/:id/folien/:dateiId/:sldId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        reply.code(200).send({
          rueckmeldungen: z.bezug.ausFolie(user.id, request.params.dateiId, request.params.sldId),
        });
      },
    );

    app.get<{ Params: { id: string; zeitMs: string } }>(
      "/api/meetings/:id/zeitstellen/:zeitMs",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const zeitMs = /^\d{1,12}$/.test(request.params.zeitMs)
          ? Number(request.params.zeitMs)
          : null;
        if (zeitMs === null) {
          ungueltig(reply, "zeitMs ist eine ganze Zahl von Millisekunden.");
          return;
        }
        const z = await zugang(user, request.params.id, reply);
        if (!z) {
          return;
        }
        reply.code(200).send({ rueckmeldungen: z.bezug.ausZeitstelle(user.id, zeitMs) });
      },
    );

    app.post<{
      Params: { id: string };
      Body: { originalObjectId?: unknown; neueFassungObjectId?: unknown };
    }>("/api/meetings/:id/fassungsabgleich", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const originalId = text(request.body?.originalObjectId, 200);
      const neuId = text(request.body?.neueFassungObjectId, 200);
      if (!originalId || !neuId) {
        ungueltig(reply, "originalObjectId und neueFassungObjectId angeben.");
        return;
      }
      const z = await zugang(user, request.params.id, reply, [neuId]);
      if (!z) {
        return;
      }
      try {
        // Die neue Fassung liegt als eigenes Dateiobjekt vor (ein Upload ist unveränderlich). Sie
        // wird unter der LOGISCHEN Kennung des Originals abgeglichen, behält aber ihr tatsächliches
        // Quellobjekt (Nacharbeit 4, Befund 2): Öffnen und spätere Rechteprüfung gehen dorthin.
        // Nacharbeit 5 (Befund 2): `originalObjectId` ist nur die logische Kennung. Gelesen wird
        // allein das neue Objekt; das Recht am AKTUELLEN Quellobjekt prüft die Bindungsschicht
        // (`aktuelleQuelle`). Ein abgelöstes Objekt hinter der logischen Kennung zählt nicht mehr.
        const bytes = await dateiLesen(user, neuId);
        if (!bytes) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Datei nicht gefunden." });
          return;
        }
        const neu = await foliensatzLesen(originalId, bytes, neuId);
        const eintraege = z.bezug.fassungsabgleich(user.id, neu);
        if (await speichern(z, reply)) {
          reply.code(200).send({
            dateiId: originalId,
            quelleId: neuId,
            fassung: neu.fassung,
            eintraege,
          });
        }
      } catch (fehler) {
        fehlerAntwort(reply, fehler);
      }
    });
  };
}

/**
 * Nacharbeit 9 (Bens Befund 1): der Dateiname jeder Präsentation, damit gleich benannte Folien
 * verschiedener Dateien und Fassungen in der Auswahl unterscheidbar sind. Die Liste enthält nur
 * Präsentationen, deren Quellobjekt der Nutzer gerade lesen darf (`praesentationen` filtert nach
 * demselben Urteil); ein fehlendes Objekt ergibt `null`, keinen erfundenen Namen.
 */
async function mitDateinamen<T extends { quelleId: string }>(
  objects: ObjectStore,
  liste: T[],
): Promise<(T & { dateiname: string | null })[]> {
  const ergebnis: (T & { dateiname: string | null })[] = [];
  for (const p of liste) {
    const obj = await objects.read(p.quelleId);
    ergebnis.push({ ...p, dateiname: obj?.ref.name ?? null });
  }
  return ergebnis;
}
