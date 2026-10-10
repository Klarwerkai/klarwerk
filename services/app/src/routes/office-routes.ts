import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "../../../auth";
import type { EvidenceRecord, KnowledgeObject, KoVersionSnapshot } from "../../../knowledge-object";
import type { ObjectStore } from "../../../object-store";
import { can } from "../../../rbac";
import type { Guards, SessionUser } from "../http";
import {
  type OfficeEditorEinrichtung,
  type OfficeKoDienst,
  anhangVerlauf,
  belegstellenZumAnhang,
  editorAktion,
  fehlerCode,
  koWopiZugriff,
  leseDiscovery,
} from "../office-artikel";
import {
  type OfficeRechte,
  type OfficeSchreibweg,
  officeFormatFuer,
  officeSchreibweg,
  pruefeZugangsmarke,
  stelleZugangsmarkeAus,
} from "../office-wopi";
import {
  SpeicherWopiSitzungen,
  type WopiSitzungsablage,
  erstelleWopiHost,
} from "../office-wopi-host";
import { darfSehen } from "../sichtbarkeit";

// ================================================================================================
// OFFICE IM ARTIKEL · DIE ROUTEN (Auftrag produkt:20261007:office-artikel-editor, Plan U2/U3).
// ================================================================================================
//
// ZWEI TÜREN, ZWEI GEGENSTELLEN:
//
//   Der EDITOR (server-zu-server, ohne Klarwerk-Cookie, ausgewiesen durch die Zugangsmarke):
//     GET  /wopi/files/:anhangId             CheckFileInfo
//     GET  /wopi/files/:anhangId/contents    GetFile
//     POST /wopi/files/:anhangId/contents    PutFile
//     POST /wopi/files/:anhangId             Lock · RefreshLock · Unlock · UnlockAndRelock · GetLock
//   Alles davon beantwortet `erstelleWopiHost` (office-wopi-host.ts), unverändert aus dem
//   Machbarkeitsauftrag. Die Rechte liest der Host bei JEDER Anfrage frisch: Konto vorhanden und
//   freigegeben, Rolle, Spaces, `darfSehen`, Status.
//
//   Die ARTIKELSEITE (Klarwerk-Sitzung, dieselben Rechte wie am Artikel):
//     GET  /api/kos/:id/office/:anhangId                 Format, Schreibweg, Verlauf, Belegstellen,
//                                                         laufende Sitzung, gesicherte Stände
//     POST /api/kos/:id/office/:anhangId/sitzung         Editor-Adresse + Zugangsmarke
//     POST /api/kos/:id/office/:anhangId/uebernahme      Arbeitsstand → neue Fassung
//     POST /api/kos/:id/office/:anhangId/zurueckholen    Dokument einer früheren Fassung → neue Fassung
//     POST /api/kos/:id/office/:anhangId/gesichert       gesicherten Konfliktstand bewusst übernehmen
//
// KEINE NEUE RECHTEACHSE (Plan 3.4): lesen = `ko.read` + `darfSehen`, schreiben = `ko.create`, ein
// freigegebener Artikel ohne `users.manage` öffnet nur lesend. Unsichtbar ist wie am Detailabruf 404.
//
// PROTOKOLL: die Marke steht in der Anfrage-URL des Editors. Fastifys Anfrageprotokoll dieser App
// schreibt die URL ohne Abfrageteil (`build-app.ts`, Serializer `req`); der Hostweg selbst nennt im
// Protokoll nur Vorgang, Anhang, Status und Objekt.
//
// GRENZEN, ausdrücklich:
//   · Editor-Sitzungen und gesicherte Konfliktstände liegen im Arbeitsspeicher DIESES Prozesses
//     (`SpeicherWopiSitzungen`). Mehrere App-Prozesse hinter einem Editor brauchen eine gemeinsame
//     Ablage (Postgres); die gibt es noch nicht.
//   · Ein freigegebener Artikel wird ohne Freigaberecht nur angesehen; ein Datei-Vorschlag
//     (`KoProposal` mit Objekt) ist nicht gebaut (Plan 5.4).

/** Höchstgröße eines PutFile-Körpers; die genaue Grenze prüft `entscheidePutFile` (413). */
const WOPI_KOERPER_GRENZE = 40 * 1024 * 1024;

export interface OfficeKonto {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly approved: boolean;
}

export interface OfficeRoutesDeps {
  readonly ko: OfficeKoDienst & {
    versionsOf(id: string): Promise<KoVersionSnapshot[]>;
    evidenceOf(id: string): Promise<EvidenceRecord[]>;
  };
  readonly objekte: ObjectStore;
  readonly einrichtung: OfficeEditorEinrichtung;
  readonly konten: () => Promise<readonly OfficeKonto[]>;
  readonly spaceLesbar: (user: { id: string; role: Role }) => Promise<ReadonlySet<string>>;
  /** Liest die Discovery; austauschbar für Tests. */
  readonly holeDiscovery?: (url: string) => Promise<string>;
  readonly jetzt?: () => number;
  readonly sitzungen?: WopiSitzungsablage;
}

/** Ein Arbeitsstand, der beim Schließen wegen einer fremden Änderung NICHT übernommen wurde. */
interface GesicherterStand {
  readonly objectId: string;
  readonly nutzerId: string;
  readonly at: string;
}

async function standardDiscovery(url: string): Promise<string> {
  const antwort = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!antwort.ok) {
    throw new Error(`Discovery antwortete ${antwort.status}`);
  }
  return antwort.text();
}

export function officeRoutes(deps: OfficeRoutesDeps, guards: Guards): FastifyPluginAsync {
  const jetzt = deps.jetzt ?? Date.now;
  const sitzungen = deps.sitzungen ?? new SpeicherWopiSitzungen();
  const holeDiscovery = deps.holeDiscovery ?? standardDiscovery;
  const gesichert = new Map<string, GesicherterStand[]>();

  function rechteFuer(user: SessionUser, artikel: KnowledgeObject): OfficeRechte {
    return {
      darfLesen: can(user.role, "ko.read") && darfSehen(user, artikel),
      darfBearbeiten: can(user.role, "ko.create"),
      darfFreigegebenesAendern: can(user.role, "users.manage"),
    };
  }

  /** Das Konto hinter einer Marke, frisch gelesen; gesperrt oder gelöscht heißt: keine Rechte. */
  async function sitzungsnutzerFuer(nutzerId: string): Promise<SessionUser | undefined> {
    const konto = (await deps.konten()).find((k) => k.id === nutzerId);
    if (!konto?.approved) {
      return undefined;
    }
    return {
      id: konto.id,
      role: konto.role,
      spaceLesbar: await deps.spaceLesbar({ id: konto.id, role: konto.role }),
    };
  }

  const KEINE_RECHTE: OfficeRechte = {
    darfLesen: false,
    darfBearbeiten: false,
    darfFreigegebenesAendern: false,
  };

  const einrichtung = deps.einrichtung;
  const host = einrichtung.eingerichtet
    ? erstelleWopiHost({
        schluessel: einrichtung.umgebung.schluessel,
        jetzt,
        objekte: deps.objekte,
        artikel: koWopiZugriff(deps.ko),
        rechte: async (nutzerId, artikel) => {
          const nutzer = await sitzungsnutzerFuer(nutzerId);
          const ko = await deps.ko.get(artikel.koId);
          return nutzer && ko ? rechteFuer(nutzer, ko) : KEINE_RECHTE;
        },
        nutzerName: async (nutzerId) =>
          (await deps.konten()).find((k) => k.id === nutzerId)?.name ?? "",
        sitzungen,
        // Nur die Klarwerk-Seite selbst darf dem Editor Nachrichten schicken.
        postMessageOrigin: einrichtung.umgebung.seitenHerkunft,
        protokoll: (eintrag) => {
          if (eintrag.vorgang === "Uebernahme beim Ende: fremde-aenderung" && eintrag.objectId) {
            vermerkeGesichert(eintrag.anhangId, eintrag.objectId);
          }
        },
      })
    : undefined;

  // Wer beim Schließen gespeichert hat, steht nicht im Protokolleintrag; die Sitzung kennt nur die
  // Sperre. Der Vermerk nennt deshalb den Nutzer der letzten PutFile-Marke (`letzterSchreiber`).
  const letzterSchreiber = new Map<string, string>();
  function vermerkeGesichert(anhangId: string, objectId: string): void {
    const liste = gesichert.get(anhangId) ?? [];
    if (!liste.some((s) => s.objectId === objectId)) {
      liste.push({
        objectId,
        nutzerId: letzterSchreiber.get(anhangId) ?? "",
        at: new Date(jetzt()).toISOString(),
      });
      gesichert.set(anhangId, liste);
    }
  }

  async function artikelOder404(
    user: SessionUser,
    id: string,
    anhangId: string,
    reply: FastifyReply,
  ) {
    const artikel = await deps.ko.get(id);
    const anhang = artikel?.attachments?.find((a) => a.id === anhangId);
    if (!artikel || !anhang || !darfSehen(user, artikel)) {
      reply.code(404).send({ error: "NOT_FOUND", message: "Anhang nicht gefunden." });
      return undefined;
    }
    const format = officeFormatFuer(anhang.name, anhang.mime);
    if (!format || !anhang.objectId) {
      reply.code(400).send({
        error: "KEIN_OFFICE_ANHANG",
        message: "Dieser Anhang ist kein Word-, Excel- oder PowerPoint-Dokument.",
      });
      return undefined;
    }
    const weg: OfficeSchreibweg = officeSchreibweg(rechteFuer(user, artikel), artikel, format);
    return { artikel, anhang, format, weg };
  }

  function nichtEingerichtet(reply: FastifyReply): void {
    reply.code(503).send({
      error: "OFFICE_EDITOR_NICHT_EINGERICHTET",
      message:
        "Der eingebettete Office-Editor ist auf diesem Server nicht eingerichtet. Das Dokument wurde nicht geöffnet.",
      ...(einrichtung.eingerichtet ? {} : { fehlt: einrichtung.fehlt }),
    });
  }

  async function verlaufVon(artikel: KnowledgeObject, anhangId: string) {
    return anhangVerlauf(
      artikel,
      await deps.ko.versionsOf(artikel.id),
      await deps.ko.evidenceOf(artikel.id),
      anhangId,
    );
  }

  async function sitzungsstand(anhangId: string) {
    const s = await sitzungen.lies(anhangId);
    if (!s || s.sperre.bis <= jetzt()) {
      return { laeuft: false as const };
    }
    return {
      laeuft: true as const,
      basisFassung: s.basisFassung,
      arbeitsstandOffen: s.arbeitsstand !== undefined,
    };
  }

  return async (app) => {
    // Der Editor schickt Dateikörper als Bytes, ohne passenden Medientyp. NUR in diesem Plugin
    // (Fastify-Kapselung) wird jeder Körper roh gelesen; die übrigen Routen behalten ihre Parser.
    app.addContentTypeParser(
      "*",
      { parseAs: "buffer", bodyLimit: WOPI_KOERPER_GRENZE },
      (_request, body, fertig) => fertig(null, body),
    );

    const wopi = async (request: FastifyRequest, reply: FastifyReply) => {
      if (!host) {
        reply.code(404).send();
        return;
      }
      const pfad = (request.url.split("?")[0] ?? "").replace(/\/+$/, "");
      const koerper = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const roh = (request.query as { access_token?: unknown }).access_token;
      const accessToken = typeof roh === "string" ? roh : undefined;
      const antwort = await host.bearbeite({
        methode: request.method,
        pfad,
        accessToken,
        kopf: (name) => {
          const wert = request.headers[name.toLowerCase()];
          return Array.isArray(wert) ? wert[0] : wert;
        },
        koerper,
      });
      if (request.method === "POST" && pfad.endsWith("/contents") && antwort.status === 200) {
        const anhangId = pfad.split("/")[3] ?? "";
        const nutzer = markenNutzer(accessToken);
        if (nutzer) {
          letzterSchreiber.set(anhangId, nutzer);
        }
      }
      reply.code(antwort.status).headers(antwort.kopf);
      if (antwort.json !== undefined) {
        reply.type("application/json").send(JSON.stringify(antwort.json));
      } else if (antwort.bytes !== undefined) {
        reply.type("application/octet-stream").send(antwort.bytes);
      } else {
        reply.send();
      }
    };
    // DER RIEGEL VOR DEM PARSEN (Muster `requireAuthedBeforeParse` in ko-routes.ts): Fastify liest
    // den Körper erst NACH `onRequest`. Ohne gültige, unabgelaufene Marke für GENAU diesen Anhang
    // endet die Anfrage hier mit 401 — die 40-MiB-Parserfläche steht keinem Anonymen offen. Die
    // vollständige Prüfung (Rechte, Sperre, Größe) macht danach unverändert der Hostweg.
    const markenRiegel = async (request: FastifyRequest, reply: FastifyReply) => {
      if (!einrichtung.eingerichtet) {
        reply.code(404).send();
        return reply;
      }
      const query = request.query as { access_token?: unknown };
      const marke = typeof query.access_token === "string" ? query.access_token : "";
      const pruefung = pruefeZugangsmarke(
        marke,
        (request.params as { anhangId: string }).anhangId,
        einrichtung.umgebung.schluessel,
        jetzt(),
      );
      if (!pruefung.gueltig) {
        reply.code(401).send();
        return reply;
      }
      return undefined;
    };
    const wopiRoute = { onRequest: markenRiegel };
    app.get("/wopi/files/:anhangId", wopiRoute, wopi);
    app.get("/wopi/files/:anhangId/contents", wopiRoute, wopi);
    app.post("/wopi/files/:anhangId", wopiRoute, wopi);
    app.post("/wopi/files/:anhangId/contents", wopiRoute, wopi);

    app.get<{ Params: { id: string; anhangId: string } }>(
      "/api/kos/:id/office/:anhangId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const lage = await artikelOder404(user, request.params.id, request.params.anhangId, reply);
        if (!lage) {
          return;
        }
        const verlauf = await verlaufVon(lage.artikel, lage.anhang.id);
        reply.code(200).send({
          anwendung: lage.format.anwendung,
          endung: lage.format.endung,
          bearbeitbar: lage.format.bearbeitbar,
          schreibweg: lage.weg,
          editorEingerichtet: einrichtung.eingerichtet,
          fassung: lage.artikel.version,
          status: lage.artikel.status,
          verlauf,
          belegstellen: belegstellenZumAnhang(lage.artikel, verlauf, lage.anhang.id),
          sitzung: await sitzungsstand(lage.anhang.id),
          gesichert: (gesichert.get(lage.anhang.id) ?? []).map((s) => ({
            objectId: s.objectId,
            at: s.at,
            eigen: s.nutzerId === user.id,
          })),
        });
      },
    );

    app.post<{ Params: { id: string; anhangId: string } }>(
      "/api/kos/:id/office/:anhangId/sitzung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const lage = await artikelOder404(user, request.params.id, request.params.anhangId, reply);
        if (!lage) {
          return;
        }
        if (!einrichtung.eingerichtet) {
          nichtEingerichtet(reply);
          return;
        }
        const { umgebung } = einrichtung;
        let xml: string;
        try {
          xml = await holeDiscovery(umgebung.discoveryUrl);
        } catch {
          reply.code(502).send({
            error: "OFFICE_EDITOR_NICHT_ERREICHBAR",
            message:
              "Der Office-Editor antwortet gerade nicht. Das Dokument wurde nicht geöffnet; nichts wurde geändert.",
          });
          return;
        }
        const schreiben = lage.weg === "direkt";
        const adresse = editorAktion({
          aktionen: leseDiscovery(xml),
          aktion: schreiben ? "edit" : "view",
          endung: lage.format.endung,
          mime: lage.format.mime,
          editorHerkunft: umgebung.editorHerkunft,
          wopiSrc: `${umgebung.wopiBasis}/wopi/files/${lage.anhang.id}`,
        });
        if (!adresse) {
          reply.code(502).send({
            error: "OFFICE_FORMAT_NICHT_ANGEBOTEN",
            message: `Der Office-Editor bietet für .${lage.format.endung} keine ${schreiben ? "Bearbeitung" : "Ansicht"} an.`,
          });
          return;
        }
        const { marke, bis } = stelleZugangsmarkeAus(
          {
            koId: lage.artikel.id,
            anhangId: lage.anhang.id,
            nutzerId: user.id,
            schreiben,
            fassung: lage.artikel.version,
          },
          umgebung.schluessel,
          jetzt(),
        );
        // Die Marke geht NUR an die eigene Seite, die sie per Formular-POST in das iframe gibt.
        reply.header("Cache-Control", "no-store");
        reply.code(200).send({
          editorUrl: adresse,
          editorHerkunft: umgebung.editorHerkunft,
          accessToken: marke,
          accessTokenTtl: bis,
          schreibweg: lage.weg,
          fassung: lage.artikel.version,
        });
      },
    );

    app.post<{ Params: { id: string; anhangId: string } }>(
      "/api/kos/:id/office/:anhangId/uebernahme",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const lage = await artikelOder404(user, request.params.id, request.params.anhangId, reply);
        if (!lage) {
          return;
        }
        if (!host) {
          nichtEingerichtet(reply);
          return;
        }
        const ergebnis = await host.uebernimm(lage.anhang.id, lage.artikel.id, user.id);
        switch (ergebnis.art) {
          case "uebernommen":
            reply.code(200).send({ fassung: ergebnis.version, status: "offen" });
            return;
          case "fremde-aenderung":
            reply.code(409).send({
              error: "KO_STALE",
              message: `Der Artikel wurde außerhalb dieser Bearbeitung geändert (jetzt Fassung ${ergebnis.artikelFassung}, die Bearbeitung begann auf Fassung ${ergebnis.basisFassung}). Es wurde nichts überschrieben; Ihr Stand bleibt im Editor und wird beim Schließen gesichert.`,
              currentVersion: ergebnis.artikelFassung,
            });
            return;
          case "ohne-sitzung":
            reply.code(409).send({
              error: "OFFICE_KEINE_SITZUNG",
              message: "Für dieses Dokument läuft keine Bearbeitung.",
            });
            return;
          case "ohne-arbeitsstand":
            reply.code(409).send({
              error: "OFFICE_NICHTS_GESPEICHERT",
              message: "Der Editor hat noch nichts gespeichert. Es gibt nichts zu übernehmen.",
            });
            return;
          case "nicht-erlaubt":
            reply.code(403).send({
              error: lage.weg === "vorschlag" ? "PROPOSAL_REQUIRED" : "FORBIDDEN",
              message:
                lage.weg === "vorschlag"
                  ? "Dieser Artikel ist freigegeben. Ohne Freigaberecht wird das Dokument nur angesehen."
                  : "Sie dürfen dieses Dokument nicht ändern.",
            });
            return;
        }
      },
    );

    // Gemeinsamer Abschluss für Rückholen und gesicherten Stand: dieselben Rechte wie die Übernahme,
    // nie während einer laufenden Editor-Sitzung (der Editor würde den Stand sonst überschreiben).
    async function vorFassungsschritt(
      request: FastifyRequest<{ Params: { id: string; anhangId: string } }>,
      reply: FastifyReply,
    ) {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return undefined;
      }
      const lage = await artikelOder404(user, request.params.id, request.params.anhangId, reply);
      if (!lage) {
        return undefined;
      }
      if (lage.weg !== "direkt") {
        reply.code(403).send({
          error: lage.weg === "vorschlag" ? "PROPOSAL_REQUIRED" : "FORBIDDEN",
          message:
            lage.weg === "vorschlag"
              ? "Dieser Artikel ist freigegeben. Ohne Freigaberecht wird das Dokument nur angesehen."
              : "Sie dürfen dieses Dokument nicht ändern.",
        });
        return undefined;
      }
      if ((await sitzungsstand(lage.anhang.id)).laeuft) {
        reply.code(409).send({
          error: "OFFICE_SITZUNG_LAEUFT",
          message:
            "Das Dokument ist gerade im Editor geöffnet. Bitte zuerst die Bearbeitung schließen.",
        });
        return undefined;
      }
      return { user, lage };
    }

    function fassungsfehler(fehler: unknown, reply: FastifyReply) {
      const code = fehlerCode(fehler);
      if (code === "KO_STALE" || code === "STALE_WRITE") {
        reply.code(409).send({
          error: "KO_STALE",
          message:
            "Der Artikel wurde inzwischen geändert. Es wurde nichts überschrieben; bitte neu laden.",
        });
        return;
      }
      if (code === "INVALID" || code === "NOT_FOUND") {
        reply.code(400).send({ error: code, message: (fehler as Error).message });
        return;
      }
      throw fehler;
    }

    function erwartet(roh: unknown): number | undefined {
      return Number.isInteger(roh) && (roh as number) >= 1 ? (roh as number) : undefined;
    }

    app.post<{
      Params: { id: string; anhangId: string };
      Body: { ausFassung?: unknown; expectedVersion?: unknown };
    }>("/api/kos/:id/office/:anhangId/zurueckholen", async (request, reply) => {
      const vorher = await vorFassungsschritt(request, reply);
      if (!vorher) {
        return;
      }
      const ausFassung = erwartet(request.body?.ausFassung);
      const expectedVersion = erwartet(request.body?.expectedVersion);
      if (ausFassung === undefined || expectedVersion === undefined) {
        reply.code(400).send({
          error: "BAD_REQUEST",
          message: "ausFassung und expectedVersion müssen Ganzzahlen ab 1 sein.",
        });
        return;
      }
      // Das Objekt kommt aus dem serverseitigen Verlauf DIESES Anhangs, nie aus dem Rumpf; der Dienst
      // prüft es zusätzlich an Belegkette und Snapshots.
      const zeile = (await verlaufVon(vorher.lage.artikel, vorher.lage.anhang.id)).find(
        (z) => z.version === ausFassung && !z.aktuell,
      );
      const meta = zeile ? await deps.objekte.metadata(zeile.objectId) : undefined;
      if (!zeile || !meta) {
        reply.code(400).send({
          error: "INVALID",
          message: `Zu Fassung ${ausFassung} gibt es keinen früheren Stand dieses Dokuments.`,
        });
        return;
      }
      try {
        const { ko, belegOffen } = await deps.ko.uebernimmOfficeFassung(
          vorher.lage.artikel.id,
          {
            anhangId: vorher.lage.anhang.id,
            objectId: zeile.objectId,
            size: meta.size,
            expectedVersion,
            restoredFrom: ausFassung,
          },
          vorher.user.id,
        );
        reply.code(200).send({ fassung: ko.version, status: ko.status, belegOffen });
      } catch (fehler) {
        fassungsfehler(fehler, reply);
      }
    });

    app.post<{
      Params: { id: string; anhangId: string };
      Body: { objectId?: unknown; expectedVersion?: unknown };
    }>("/api/kos/:id/office/:anhangId/gesichert", async (request, reply) => {
      const vorher = await vorFassungsschritt(request, reply);
      if (!vorher) {
        return;
      }
      const expectedVersion = erwartet(request.body?.expectedVersion);
      const liste = gesichert.get(vorher.lage.anhang.id) ?? [];
      // Nur ein Objekt, das der Host selbst als gesicherten Konfliktstand vermerkt hat — nie eine
      // beliebige Kennung aus dem Rumpf.
      const stand = liste.find((s) => s.objectId === request.body?.objectId);
      if (!stand || expectedVersion === undefined) {
        reply.code(400).send({
          error: "BAD_REQUEST",
          message: "Unbekannter gesicherter Stand oder fehlende expectedVersion.",
        });
        return;
      }
      const meta = await deps.objekte.metadata(stand.objectId);
      if (!meta) {
        reply.code(400).send({ error: "BAD_REQUEST", message: "Der gesicherte Stand fehlt." });
        return;
      }
      try {
        const { ko, belegOffen } = await deps.ko.uebernimmOfficeFassung(
          vorher.lage.artikel.id,
          {
            anhangId: vorher.lage.anhang.id,
            objectId: stand.objectId,
            size: meta.size,
            expectedVersion,
          },
          vorher.user.id,
        );
        gesichert.set(
          vorher.lage.anhang.id,
          liste.filter((s) => s.objectId !== stand.objectId),
        );
        reply.code(200).send({ fassung: ko.version, status: ko.status, belegOffen });
      } catch (fehler) {
        fassungsfehler(fehler, reply);
      }
    });
  };
}

/** Der Nutzer einer Marke OHNE Prüfung — nur für den Vermerk, wer zuletzt gespeichert hat. */
function markenNutzer(marke: string | undefined): string | undefined {
  try {
    const nutzlast = (marke ?? "").split(".")[0] ?? "";
    const inhalt = JSON.parse(Buffer.from(nutzlast, "base64url").toString("utf8")) as {
      nutzerId?: unknown;
    };
    return typeof inhalt.nutzerId === "string" ? inhalt.nutzerId : undefined;
  } catch {
    return undefined;
  }
}
