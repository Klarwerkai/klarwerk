import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { KnowledgeObject } from "../../../knowledge-object";
import { type ObjectStore, decodeDataUrl } from "../../../object-store";
import { can } from "../../../rbac";
import type { Guards, SessionUser } from "../http";
import { officeFormatFuer } from "../office-wopi";
import {
  DIMENSIONEN,
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type DatenpunktSicht,
  type Dimension,
  type FoliensatzDaten,
  type Handelnder,
  binde,
  erfasse,
  korrigiere,
  leseErfassung,
  leseFolienDaten,
  leseKorrektur,
  leseOrt,
  pruefe,
  sicht,
} from "../praesentation-daten";
import type { DatenpunktAblage } from "../praesentation-daten-ablage";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// KLARA POWERPOINT · PP-02 — DIE ROUTEN DER DATENHERKUNFT (Logik in praesentation-daten.ts).
// ================================================================================================
//
//   GET  /api/kos/:id/office/:anhangId/folien-daten   Folien und Elemente der aktuellen PPTX-Fassung
//                                                      samt der dort gebundenen Datenpunkte
//   GET  /api/kos/:id/datenpunkte                     die Datenpunkte des Artikels (Eingabeauswahl)
//   POST /api/kos/:id/datenpunkte                     Zahl/Aussage erfassen (und am Ort binden)
//   GET  /api/datenpunkte/:dpId                       die Herkunft eines Datenpunkts
//   POST /api/datenpunkte/:dpId/bindungen             an ein weiteres Folienelement binden
//   POST /api/datenpunkte/:dpId/pruefungen            eine Prüfung festhalten
//   POST /api/datenpunkte/:dpId/korrektur             Wert/Bezugsrahmen/Rechenweg/Quellfassung ändern
//
// KEINE NEUE RECHTEACHSE: lesen = `ko.read` + `darfSehen` am Heimatartikel; Quelle, Eingaben und
// Zielpräsentationen erscheinen nur mit eigenem Leserecht. Erfassen, Binden, Prüfen und Korrigieren
// = `ko.create` (wie Bearbeiten am Artikel); die fachliche Freigabe = `ko.validate` (wie die Freigabe
// eines Artikels). Unsichtbar ist wie am Detailabruf 404.
//
// GRENZE: Gelesen wird die Datei am Server mit dem vorhandenen PPTX-Weg (W06). Ins Dokument
// geschrieben wird nichts; Diagramme, SmartArt und Notizen sind nicht lesbar (L03) und damit auch
// nicht bindbar.

export interface PraesentationDatenKonto {
  readonly id: string;
  readonly name: string;
}

export interface PraesentationDatenRoutesDeps {
  readonly ko: { get(id: string): Promise<KnowledgeObject | undefined> };
  readonly objekte: ObjectStore;
  readonly ablage: DatenpunktAblage;
  readonly konten: () => Promise<readonly PraesentationDatenKonto[]>;
  readonly jetzt?: () => number;
  readonly kennung?: () => string;
}

export function praesentationDatenRoutes(
  deps: PraesentationDatenRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const jetzt = deps.jetzt ?? Date.now;
  const kennung = deps.kennung ?? (() => randomUUID());

  /** Die Umgebung EINER Anfrage: Rechte des Handelnden, Dateien je Fassung nur einmal gelesen. */
  function umgebung(user: SessionUser): DatenUmgebung {
    const gelesen = new Map<string, Promise<FoliensatzDaten | undefined>>();
    let konten: Promise<readonly PraesentationDatenKonto[]> | undefined;
    const artikel = async (koId: string) => {
      const ko = await deps.ko.get(koId);
      return ko && can(user.role, "ko.read") && darfSehen(user, ko) ? ko : undefined;
    };
    const satzVon = (objectId: string) => {
      const vorhanden = gelesen.get(objectId);
      if (vorhanden) {
        return vorhanden;
      }
      const lauf = (async () => {
        const gespeichert = await deps.objekte.read(objectId);
        const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
        return bytes ? await leseFolienDaten(bytes).catch(() => undefined) : undefined;
      })();
      gelesen.set(objectId, lauf);
      return lauf;
    };
    return {
      artikel,
      async meta(koId) {
        const ko = await deps.ko.get(koId);
        return ko
          ? {
              version: ko.version,
              ...(ko.confidentiality ? { confidentiality: ko.confidentiality } : {}),
              anhaenge: (ko.attachments ?? []).map((a) => ({
                id: a.id,
                ...(a.objectId ? { objectId: a.objectId } : {}),
              })),
            }
          : undefined;
      },
      async folien(koId, anhangId) {
        const ko = await artikel(koId);
        const anhang = ko?.attachments?.find((a) => a.id === anhangId);
        if (!anhang?.objectId || officeFormatFuer(anhang.name, anhang.mime)?.endung !== "pptx") {
          return undefined;
        }
        const satz = await satzVon(anhang.objectId);
        return satz ? { objectId: anhang.objectId, name: anhang.name, satz } : undefined;
      },
      datenpunkt: (id) => deps.ablage.lesen(id),
      async name(nutzerId) {
        konten ??= deps.konten();
        return (await konten).find((k) => k.id === nutzerId)?.name;
      },
    };
  }

  function handelnder(user: SessionUser): Handelnder {
    return { nutzerId: user.id, jetzt: new Date(jetzt()).toISOString(), kennung };
  }

  function fehler(reply: FastifyReply, f: unknown): void {
    if (f instanceof DatenFehler) {
      if (f.art === "kein_zugriff") {
        reply.code(404).send({ error: "NOT_FOUND", message: f.message });
        return;
      }
      reply.code(400).send({ error: "INVALID", message: f.message });
      return;
    }
    throw f;
  }

  function nichtGefunden(reply: FastifyReply, was = "Datenpunkt"): void {
    reply.code(404).send({ error: "NOT_FOUND", message: `${was} nicht gefunden.` });
  }

  async function sichtenVon(
    liste: readonly Datenpunkt[],
    u: DatenUmgebung,
  ): Promise<DatenpunktSicht[]> {
    const ergebnis: DatenpunktSicht[] = [];
    for (const dp of liste) {
      const s = await sicht(dp, u);
      if (s) {
        ergebnis.push(s);
      }
    }
    return ergebnis;
  }

  /** Datenpunkt lesen — nur mit Leserecht am Heimatartikel; sonst 404 ohne Existenzauskunft. */
  async function lesbarerDatenpunkt(
    id: string,
    u: DatenUmgebung,
    reply: FastifyReply,
  ): Promise<Datenpunkt | undefined> {
    const dp = await deps.ablage.lesen(id);
    if (!dp || !(await u.artikel(dp.heimatKoId))) {
      nichtGefunden(reply);
      return undefined;
    }
    return dp;
  }

  /** Erwartete Datenfassung aus dem Rumpf: eine Wirkung gilt nur für die Fassung, die man sah. */
  function fassungPasst(dp: Datenpunkt, roh: unknown, reply: FastifyReply): boolean {
    if (!Number.isInteger(roh)) {
      reply.code(400).send({
        error: "INVALID",
        message: "fassung fehlt: Prüfung und Korrektur gelten für die Datenfassung, die man sah.",
      });
      return false;
    }
    if (roh !== dp.fassung) {
      reply.code(409).send({
        error: "DATENPUNKT_GEAENDERT",
        message: `Der Datenpunkt steht inzwischen bei Fassung ${dp.fassung}. Bitte neu laden; nichts wurde geändert.`,
        aktuelleFassung: dp.fassung,
      });
      return false;
    }
    return true;
  }

  async function speichere(
    vorher: Datenpunkt,
    neu: Datenpunkt,
    u: DatenUmgebung,
    reply: FastifyReply,
  ): Promise<void> {
    if (neu === vorher) {
      reply.code(200).send(await sicht(vorher, u));
      return;
    }
    const geschrieben = { ...neu, stand: vorher.stand + 1 };
    if (!(await deps.ablage.ersetzen(geschrieben, vorher.stand))) {
      reply.code(409).send({
        error: "DATENPUNKT_GEAENDERT",
        message:
          "Der Datenpunkt wurde gleichzeitig geändert. Bitte neu laden; nichts wurde überschrieben.",
      });
      return;
    }
    reply.code(200).send(await sicht(geschrieben, u));
  }

  return async (app) => {
    app.get<{ Params: { id: string; anhangId: string } }>(
      "/api/kos/:id/office/:anhangId/folien-daten",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const u = umgebung(user);
        const ko = await u.artikel(request.params.id);
        const anhang = ko?.attachments?.find((a) => a.id === request.params.anhangId);
        if (!ko || !anhang) {
          nichtGefunden(reply, "Anhang");
          return;
        }
        const datei = await u.folien(ko.id, anhang.id);
        if (!datei) {
          reply.code(400).send({
            error: "KEINE_PRAESENTATION",
            message: "Dieser Anhang ist keine lesbare PowerPoint-Datei (.pptx).",
          });
          return;
        }
        const gebunden = await deps.ablage.gebundenAn(ko.id, anhang.id);
        const eigene = await deps.ablage.vonArtikel(ko.id);
        const alle = [...new Map([...gebunden, ...eigene].map((d) => [d.id, d] as const)).values()];
        reply.header("Cache-Control", "no-store");
        reply.code(200).send({
          koId: ko.id,
          anhangId: anhang.id,
          anhangName: datei.name,
          objectId: datei.objectId,
          artikelFassung: ko.version,
          dateiFassung: datei.satz.fassung,
          folien: datei.satz.folien,
          datenpunkte: await sichtenVon(alle, u),
          darfErfassen: can(user.role, "ko.create"),
          darfFreigeben: can(user.role, "ko.validate"),
        });
      },
    );

    app.get<{ Params: { id: string } }>("/api/kos/:id/datenpunkte", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const u = umgebung(user);
      if (!(await u.artikel(request.params.id))) {
        nichtGefunden(reply, "Artikel");
        return;
      }
      reply.header("Cache-Control", "no-store");
      reply.code(200).send({
        datenpunkte: await sichtenVon(await deps.ablage.vonArtikel(request.params.id), u),
      });
    });

    app.post<{ Params: { id: string } }>("/api/kos/:id/datenpunkte", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const u = umgebung(user);
      const heimat = await u.artikel(request.params.id);
      if (!heimat) {
        nichtGefunden(reply, "Artikel");
        return;
      }
      try {
        const dp = await erfasse(leseErfassung(request.body), heimat, u, handelnder(user));
        if (!(await deps.ablage.anlegen(dp))) {
          reply.code(409).send({ error: "DATENPUNKT_VORHANDEN", message: "Kennung vergeben." });
          return;
        }
        reply.code(201).send(await sicht(dp, u));
      } catch (f) {
        fehler(reply, f);
      }
    });

    app.get<{ Params: { dpId: string } }>("/api/datenpunkte/:dpId", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const u = umgebung(user);
      const dp = await lesbarerDatenpunkt(request.params.dpId, u, reply);
      if (!dp) {
        return;
      }
      reply.header("Cache-Control", "no-store");
      reply.code(200).send(await sicht(dp, u));
    });

    app.post<{ Params: { dpId: string }; Body: { koId?: unknown; ort?: unknown } }>(
      "/api/datenpunkte/:dpId/bindungen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const u = umgebung(user);
        const dp = await lesbarerDatenpunkt(request.params.dpId, u, reply);
        if (!dp) {
          return;
        }
        const ziel =
          typeof request.body?.koId === "string" ? await u.artikel(request.body.koId) : undefined;
        if (!ziel) {
          nichtGefunden(reply, "Artikel");
          return;
        }
        try {
          const ort = leseOrt(request.body?.ort);
          if (!ort) {
            reply.code(400).send({ error: "INVALID", message: "ort fehlt." });
            return;
          }
          await speichere(dp, await binde(dp, ziel, ort, u, handelnder(user)), u, reply);
        } catch (f) {
          fehler(reply, f);
        }
      },
    );

    app.post<{
      Params: { dpId: string };
      Body: { dimension?: unknown; ergebnis?: unknown; grund?: unknown; fassung?: unknown };
    }>("/api/datenpunkte/:dpId/pruefungen", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const u = umgebung(user);
      const dp = await lesbarerDatenpunkt(request.params.dpId, u, reply);
      if (!dp) {
        return;
      }
      const dimension = request.body?.dimension as Dimension;
      const ergebnis = request.body?.ergebnis;
      if (
        !DIMENSIONEN.includes(dimension) ||
        (ergebnis !== "bestanden" && ergebnis !== "klaerung")
      ) {
        reply.code(400).send({
          error: "INVALID",
          message: "dimension und ergebnis (bestanden oder klaerung) fehlen.",
        });
        return;
      }
      if (dimension === "fachliche_freigabe" && !can(user.role, "ko.validate")) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message: "Die fachliche Freigabe braucht dasselbe Recht wie die Freigabe eines Artikels.",
        });
        return;
      }
      if (!fassungPasst(dp, request.body?.fassung, reply)) {
        return;
      }
      try {
        const grund =
          typeof request.body?.grund === "string" ? request.body.grund.slice(0, 1000) : undefined;
        await speichere(
          dp,
          pruefe(dp, { dimension, ergebnis, ...(grund ? { grund } : {}) }, handelnder(user)),
          u,
          reply,
        );
      } catch (f) {
        fehler(reply, f);
      }
    });

    app.post<{ Params: { dpId: string }; Body: Record<string, unknown> & { fassung?: unknown } }>(
      "/api/datenpunkte/:dpId/korrektur",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const u = umgebung(user);
        const dp = await lesbarerDatenpunkt(request.params.dpId, u, reply);
        if (!dp) {
          return;
        }
        if (!fassungPasst(dp, request.body?.fassung, reply)) {
          return;
        }
        try {
          await speichere(
            dp,
            await korrigiere(dp, leseKorrektur(request.body), u, handelnder(user)),
            u,
            reply,
          );
        } catch (f) {
          fehler(reply, f);
        }
      },
    );
  };
}
