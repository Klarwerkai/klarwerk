import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { KnowledgeObject } from "../../../knowledge-object";
import { type ObjectStore, decodeDataUrl } from "../../../object-store";
import { can } from "../../../rbac";
import {
  FOLIEN_ABGLEICH_GRENZEN,
  type FolienAbgleichGrenzen,
  abgleichEinlass,
  pruefeAbgleichKoerper,
} from "../folien-abgleich-grenzen";
import type { Guards, SessionUser } from "../http";
import { officeFormatFuer } from "../office-wopi";
import {
  DIMENSIONEN,
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type Dimension,
  type FoliensatzDaten,
  type Handelnder,
  binde,
  elementBefund,
  erfasse,
  inFassung,
  korrigiere,
  leseErfassung,
  leseFolienDaten,
  leseKorrektur,
  leseOrt,
  pruefe,
  sicht,
  vollLesbar,
} from "../praesentation-daten";
import type { DatenpunktAblage } from "../praesentation-daten-ablage";
import { datenlage } from "../praesentation-pruefung";
import {
  type KontrollAnschluss,
  type KontrollierteSicht,
  kontrollAnschluss,
} from "../praesentation-pruefung-anschluss";
import { VortragsKonflikt, leseVortragsAuftrag, vortragAuswerten } from "../praesentation-vortrag";
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
//   POST /api/kos/:id/office/:anhangId/folien-abgleich die in PowerPoint (Mac, Web) GEÖFFNETE
//                                                      Präsentation gegen die Bindungen des Anhangs
//
// KEINE NEUE RECHTEACHSE: lesen = `ko.read` + `darfSehen` am Heimatartikel; Quelle, Eingaben und
// Zielpräsentationen erscheinen nur mit eigenem Leserecht. Erfassen, Binden, Prüfen und Korrigieren
// = `ko.create` (wie Bearbeiten am Artikel); die fachliche Freigabe = `ko.validate` (wie die Freigabe
// eines Artikels). Unsichtbar ist wie am Detailabruf 404.
//
// GRENZE: Gelesen wird die Datei am Server mit dem vorhandenen PPTX-Weg (W06). Ins Dokument
// geschrieben wird nichts; Diagramme, SmartArt und Notizen sind nicht lesbar (L03) und damit auch
// nicht bindbar.
//
// PP-03 (produkt:20261015:klara-powerpoint-validierung): jede Sicht der aktuellen Datenfassung trägt
// ihre `kontrolle` (`praesentation-pruefung-anschluss.ts`), die Folienliste zusätzlich die
// `datenlage`. Dieselbe Umgebung, dieselben Rechte; Prüfen und Korrigieren bleiben diese Routen.

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
  /** Grenzen des Hostabgleichs (Vorgabe `FOLIEN_ABGLEICH_GRENZEN`); Tests setzen sie niedrig. */
  readonly abgleichGrenzen?: Partial<FolienAbgleichGrenzen>;
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

  // Der große Körper des Hostabgleichs wird erst gelesen, wenn das Leserecht feststeht (Muster
  // `requireKoCreateBeforeParse`, ko-routes.ts). Benannter Helfer, damit der Routenscanner im
  // Routenblock genau EIN Recht zählt; der Handler prüft es erneut, er braucht den Nutzer.
  // Prüfbefund B1 (d): VOR dem Körper auch der Takt je Nutzer — wie `/api/capture/slides`
  // (slides-routes.ts). Den Platz belegt seit der Nachprüfung N3 erst der Handler, wenn der Körper
  // vollständig da ist: ein langsamer Upload hält keinen Platz und sperrt niemanden aus.
  const abgleichGrenzen: FolienAbgleichGrenzen = {
    ...FOLIEN_ABGLEICH_GRENZEN,
    ...deps.abgleichGrenzen,
  };
  const einlass = abgleichEinlass(abgleichGrenzen);
  const leserechtVorDemKoerper = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const user = await guards.requirePermission("ko.read", request, reply);
    if (!user) {
      return;
    }
    if (einlass.ueberTakt(user.id, Date.now())) {
      reply.code(429).header("retry-after", "60").send({
        error: "RATE_LIMITED",
        message: "Zu viele Abgleiche in kurzer Zeit — bitte eine Minute warten und neu abgleichen.",
      });
      return;
    }
    // Abgerissen während des Wartens auf die Anmeldung: den Körper gar nicht erst lesen.
    if (request.raw.aborted || request.raw.destroyed) {
      reply.code(408).send({ error: "CLIENT_ABORTED", message: "Verbindung abgebrochen." });
    }
  };

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

  /** PP-03: die Kontrollen einer Anfrage — dieselbe Umgebung, dieselben Rechte. */
  function kontrolle(u: DatenUmgebung): KontrollAnschluss {
    return kontrollAnschluss(u, deps.ablage, jetzt);
  }

  /** Die Sicht samt PP-03-Kontrolle; `undefined` wie `sicht` (ohne volles Leserecht). */
  async function kontrollierteSicht(
    dp: Datenpunkt,
    u: DatenUmgebung,
    k: KontrollAnschluss,
  ): Promise<KontrollierteSicht | undefined> {
    const s = await sicht(dp, u);
    return s ? k.kontrolliert(dp, s) : undefined;
  }

  async function sichtenVon(
    liste: readonly Datenpunkt[],
    u: DatenUmgebung,
    k: KontrollAnschluss = kontrolle(u),
  ): Promise<KontrollierteSicht[]> {
    const ergebnis: KontrollierteSicht[] = [];
    for (const dp of liste) {
      const s = await kontrollierteSicht(dp, u, k);
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
    // Nacharbeit 2: die GANZE Herkunft (Heimat, Quellen, Eingaben, Historie) — sonst 404, auch für
    // Prüfen, Binden und Korrigieren. Der Heimatartikel geht hier sichtbar durch `u.artikel`
    // (darfSehen), bevor `vollLesbar` Quellen, Eingaben und Historie mit derselben Umgebung prüft —
    // dieselbe Entscheidung, die vollLesbar als ersten Schritt fährt; so steht sie an der
    // Registrierung jeder Datenpunkt-Route (mega74-lesewege-sammler.test.ts, Urteil PRAEDIKAT).
    if (!dp || !(await u.artikel(dp.heimatKoId)) || !(await vollLesbar(dp, u))) {
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
      reply.code(200).send(await kontrollierteSicht(vorher, u, kontrolle(u)));
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
    reply.code(200).send(await kontrollierteSicht(geschrieben, u, kontrolle(u)));
  }

  return async (app) => {
    app.post<{ Params: { id: string; anhangId: string } }>(
      "/api/kos/:id/office/:anhangId/vortrag",
      { bodyLimit: 512 * 1024 },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) return;
        const u = umgebung(user);
        const ko = await u.artikel(request.params.id);
        const datei = ko ? await u.folien(ko.id, request.params.anhangId) : undefined;
        if (!ko || !datei) {
          nichtGefunden(reply, "Präsentation");
          return;
        }
        reply.header("Cache-Control", "no-store");
        try {
          const gebunden = await deps.ablage.gebundenAn(ko.id, request.params.anhangId);
          const sichten = await sichtenVon(gebunden, u);
          reply.send(
            vortragAuswerten(
              {
                koId: ko.id,
                anhangId: request.params.anhangId,
                dateiFassung: datei.satz.fassung,
                folien: datei.satz.folien,
                datenpunkte: sichten,
              },
              leseVortragsAuftrag(request.body),
            ),
          );
        } catch (f) {
          if (f instanceof VortragsKonflikt)
            reply.code(409).send({ error: "CONFLICT", message: f.message });
          else fehler(reply, f);
        }
      },
    );

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
        const sichten = await sichtenVon(alle, u);
        reply.header("Cache-Control", "no-store");
        reply.code(200).send({
          koId: ko.id,
          anhangId: anhang.id,
          anhangName: datei.name,
          objectId: datei.objectId,
          artikelFassung: ko.version,
          dateiFassung: datei.satz.fassung,
          folien: datei.satz.folien,
          datenpunkte: sichten,
          // PP-03: Zustände und offene Punkte der lesbaren Datenpunkte dieser Präsentation.
          datenlage: datenlage(sichten.flatMap((s) => (s.kontrolle ? [s.kontrolle] : []))),
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
        reply.code(201).send(await kontrollierteSicht(dp, u, kontrolle(u)));
      } catch (f) {
        fehler(reply, f);
      }
    });

    app.get<{ Params: { dpId: string }; Querystring: { fassung?: string } }>(
      "/api/datenpunkte/:dpId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const u = umgebung(user);
        const dp = await lesbarerDatenpunkt(request.params.dpId, u, reply);
        if (!dp) {
          return;
        }
        // Nacharbeit 2 (Bens Befund 2): `?fassung=n` zeigt die Herkunft der Datenfassung n — so,
        // wie eine Berechnung sie verwendet hat (damalige Quelle, Fundstelle, Eingaben).
        const roh = request.query?.fassung;
        const fassung = roh === undefined ? dp.fassung : Number(roh);
        const gezeigt = inFassung(dp, fassung);
        if (!gezeigt) {
          reply.code(400).send({
            error: "INVALID",
            message: `Fassung ${roh ?? ""} gibt es nicht; der Datenpunkt steht bei Fassung ${dp.fassung}.`,
          });
          return;
        }
        const s = await sicht(gezeigt, u, undefined, dp.fassung);
        if (!s) {
          nichtGefunden(reply);
          return;
        }
        reply.header("Cache-Control", "no-store");
        // PP-03: nur die aktuelle Fassung trägt Kontrollen; eine frühere bleibt Herkunft.
        reply.code(200).send(await kontrolle(u).kontrolliert(gezeigt, s));
      },
    );

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

    // --------------------------------------------------------------------------------------------
    // HOSTANSCHLUSS — PowerPoint für Mac und im Web über das vorhandene Office-Fenster aus A01
    // (aufnahme:20260922:excel-erster-weg). Das Fenster schickt die Präsentation, die PowerPoint
    // GERADE geöffnet hat (`getFileAsync`, Format Compressed = .pptx), einmal je Abgleich. Gelesen
    // wird sie mit demselben Leser wie der Anhang; daraus kommen die echten `p:sldId` und
    // `p:cNvPr/@id` der geöffneten Datei — das Fenster muss das nicht dokumentierte Format der
    // Office-Kennungen nicht deuten. Jede Bindung dieses Anhangs wird mit `elementBefund` gegen die
    // geöffnete Datei geprüft. Gespeichert wird nichts; Herkunft und Prüfstand sind dieselben
    // Sichten wie an `folien-daten` (der Anhang am Artikel bleibt die Quelle, nicht die Hostdatei).
    // --------------------------------------------------------------------------------------------
    app.post<{ Params: { id: string; anhangId: string }; Body: { datei?: unknown } }>(
      "/api/kos/:id/office/:anhangId/folien-abgleich",
      { bodyLimit: FOLIEN_ABGLEICH_KOERPER, onRequest: leserechtVorDemKoerper },
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
        const keinePraesentation = () =>
          reply.code(400).send({
            error: "KEINE_PRAESENTATION",
            message: "Dieser Anhang ist keine lesbare PowerPoint-Datei (.pptx).",
          });
        // Prüfbefund B1 (f): erst der Körper, dann der gespeicherte Anhang — ein leerer oder
        // feindlicher Körper kostet keinen Anhang-Parse mehr. Ob der Anhang eine .pptx ist, steht
        // ohne Lesen fest.
        if (!anhang.objectId || officeFormatFuer(anhang.name, anhang.mime)?.endung !== "pptx") {
          keinePraesentation();
          return;
        }
        const roh = request.body?.datei;
        const bytes =
          typeof roh === "string" && BASE64.test(roh) ? Buffer.from(roh, "base64") : undefined;
        if (!bytes || bytes.length === 0) {
          reply.code(400).send({
            error: "INVALID",
            message: "datei fehlt: die geöffnete Präsentation als Base64, wie Office sie liefert.",
          });
          return;
        }
        // Nachprüfung N3: der Platz wird erst JETZT belegt — der Körper ist vollständig empfangen.
        // Höchstens einer je Nutzer und `gleichzeitig` insgesamt; frei im `finally`, auch bei Fehlern.
        if (!einlass.belege(request, user.id, Date.now())) {
          reply.code(429).header("retry-after", "5").send({
            error: "ABGLEICH_BESCHAEFTIGT",
            message: "Gerade laufen andere Abgleiche — bitte in einem Moment neu abgleichen.",
          });
          return;
        }
        try {
          // Prüfbefund B1 (a): echte, gestreamte Entpackgrenze (Summe und Verhältnis), BEVOR ein
          // Parser die fremden Bytes sieht.
          const befund = await pruefeAbgleichKoerper(bytes, abgleichGrenzen);
          if (befund) {
            reply.code(befund.status).send({ error: befund.error, message: befund.message });
            return;
          }
          const geoeffnet = await leseFolienDaten(bytes).catch((f: unknown) =>
            f instanceof DatenFehler ? f : undefined,
          );
          if (!geoeffnet || geoeffnet instanceof DatenFehler) {
            reply.code(400).send({
              error: "KEINE_PRAESENTATION",
              message:
                geoeffnet?.message ??
                "Die geöffnete Datei ist keine lesbare PowerPoint-Datei (.pptx).",
            });
            return;
          }
          const datei = await u.folien(ko.id, anhang.id);
          if (!datei) {
            keinePraesentation();
            return;
          }
          const gebunden = await deps.ablage.gebundenAn(ko.id, anhang.id);
          const eigene = await deps.ablage.vonArtikel(ko.id);
          const alle = [
            ...new Map([...gebunden, ...eigene].map((d) => [d.id, d] as const)).values(),
          ];
          const sichten = await sichtenVon(alle, u);
          const lesbar = new Set(sichten.map((s) => s.id));
          const hostLagen = alle
            .filter((dp) => lesbar.has(dp.id))
            .flatMap((dp) =>
              dp.bindungen
                .filter((b) => b.koId === ko.id && b.anhangId === anhang.id)
                .map((b) => ({
                  datenpunktId: dp.id,
                  bindungId: b.id,
                  sldId: b.sldId,
                  shapeId: b.shapeId,
                  ...(b.zeile === undefined ? {} : { zeile: b.zeile, spalte: b.spalte }),
                  ...elementBefund(dp, b, geoeffnet),
                })),
            );
          reply.header("Cache-Control", "no-store");
          reply.code(200).send({
            koId: ko.id,
            anhangId: anhang.id,
            anhangName: datei.name,
            objectId: datei.objectId,
            artikelFassung: ko.version,
            dateiFassung: datei.satz.fassung,
            geoeffnet: {
              fassung: geoeffnet.fassung,
              gleicheDatei: geoeffnet.fassung === datei.satz.fassung,
              // Prüfbefund B1 (e): nur, was das Fenster zur Zuordnung braucht (folien-herkunft.js,
              // `zuordnungBauen`) — keine Texte, Zellen oder Titel der Datei zurück an den Absender.
              folien: geoeffnet.folien.map((f) => ({
                sldId: f.sldId,
                position: f.position,
                elemente: f.elemente.map((e) => ({ shapeId: e.shapeId, name: e.name })),
              })),
            },
            datenpunkte: sichten,
            hostLagen,
            darfErfassen: can(user.role, "ko.create"),
            darfFreigeben: can(user.role, "ko.validate"),
          });
        } finally {
          einlass.gibFrei(request);
        }
      },
    );
  };
}

/** Bis 30 MiB Präsentation, als Base64 (4/3) samt JSON-Hülle. */
export const FOLIEN_ABGLEICH_KOERPER = 41 * 1024 * 1024;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
