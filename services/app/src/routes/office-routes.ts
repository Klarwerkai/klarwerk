import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "../../../auth";
import type { EvidenceRecord, KnowledgeObject, KoVersionSnapshot } from "../../../knowledge-object";
import type { ObjectStore } from "../../../object-store";
import { can } from "../../../rbac";
import type { Guards, SessionUser } from "../http";
import { type OfficeAblage, SpeicherOfficeAblage } from "../office-ablage";
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
  type NachbearbeitungsErgebnis,
  NachbearbeitungsFehler,
  type Nachbearbeitungsauftrag,
  type Teilfehler,
  type Wirkung,
  fuehreNachbearbeitungAus,
  leseAuftrag,
  teilfehler,
} from "../office-nachbearbeitung";
import {
  type OfficeRechte,
  type OfficeSchreibweg,
  officeFormatFuer,
  officeSchreibweg,
  pruefeZugangsmarke,
  stelleZugangsmarkeAus,
} from "../office-wopi";
import { type WopiSitzungsablage, erstelleWopiHost } from "../office-wopi-host";
import { DatenFehler, binde } from "../praesentation-daten";
import type { DatenpunktAblage } from "../praesentation-daten-ablage";
import { praesentationDatenUmgebung } from "../praesentation-daten-umgebung";
import {
  ergaenzungsAuftrag,
  ergaenzungsVorschau,
  leseErgaenzungsSuche,
} from "../praesentation-ergaenzung";
import { ergaenzungsDatenbeleg } from "../praesentation-ergaenzung-snapshot";
import { darfSehen } from "../sichtbarkeit";
import { registriereAufbauRouten } from "./praesentation-aufbau-routes";

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
// ABLAGE (Nacharbeit 2): Editor-Sitzungen, der letzte Schreiber und gesicherte Konfliktstände
// liegen in `OfficeAblage` (`office-ablage.ts`) — im Postgres-Betrieb `PgOfficeAblage`, damit eine
// als „gesichert" angezeigte Fassung einen Neustart überlebt und danach übernommen werden kann.
//
// GRENZEN, ausdrücklich:
//   · Die Reihenfolge der Vorgänge an EINEM Anhang hält der Hostweg je Prozess (`seriell`). Mehrere
//     App-Prozesse hinter einem Editor teilen die Ablage, aber nicht diese Reihenfolge.
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
  readonly datenpunkte?: DatenpunktAblage;
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
  /** Sitzungen und gesicherte Stände; ohne Angabe die Speicherfassung (ohne Neustartschutz). */
  readonly ablage?: OfficeAblage;
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
  const ablage = deps.ablage ?? new SpeicherOfficeAblage();
  const holeDiscovery = deps.holeDiscovery ?? standardDiscovery;
  // ==============================================================================================
  // Nacharbeit 4 (bens Befund) — ERST SICHERN, DANN DIE SITZUNG LÖSCHEN.
  // ==============================================================================================
  //
  // Der Hostweg löscht beim Entsperren die Sitzung — auch dann, wenn ihr Arbeitsstand wegen einer
  // fremden Änderung NICHT übernommen wurde. Bis Nacharbeit 3 sicherte diese Datei den Stand erst
  // danach; scheiterte das Schreiben oder endete der Prozess dazwischen, war die Referenz weg.
  //
  // JETZT: der Host bekommt `hostAblage`. Löscht er eine Sitzung, die noch einen Arbeitsstand trägt,
  // wird sie NICHT gelöscht, sondern als BEENDET fortgeschrieben (Sperre abgelaufen, Arbeitsstand
  // bleibt). `abschliessen` macht daraus danach — wiederholbar — den dauerhaften Zustand: ein noch
  // nicht übernommener Arbeitsstand wird gesichert, und ERST DANN wird die Sitzung gelöscht. Scheitert
  // das Sichern, bleibt die beendete Sitzung mit ihrem Arbeitsstand stehen; jeder weitere Zugriff
  // (Lage, Sitzungsbeginn, jede Editor-Anfrage, auch nach einem Neustart) versucht es erneut.
  // Dasselbe gilt für eine Sitzung, deren Sperre ohne Entsperren abgelaufen ist (Editor abgestürzt):
  // ihr Arbeitsstand wird gesichert, bevor eine neue Sitzung ihn überschreiben könnte.
  const hostAblage: WopiSitzungsablage = {
    lies: (anhangId) => ablage.lies(anhangId),
    async schreibe(anhangId, sitzung) {
      if (sitzung === undefined) {
        const bisher = await ablage.lies(anhangId);
        if (bisher?.arbeitsstand) {
          await ablage.schreibe(anhangId, { ...bisher, sperre: { ...bisher.sperre, bis: 0 } });
          return;
        }
      }
      await ablage.schreibe(anhangId, sitzung);
    },
  };

  // Alle Abschlüsse und Editor-Anfragen an EINEM Anhang laufen in diesem Prozess nacheinander, damit
  // ein Abschluss nie eine eben begonnene neue Sitzung löscht.
  const ketten = new Map<string, Promise<unknown>>();
  function nacheinander<T>(anhangId: string, vorgang: () => Promise<T>): Promise<T> {
    const vorher = ketten.get(anhangId) ?? Promise.resolve();
    const lauf = vorher.then(vorgang, vorgang);
    const ende = lauf.catch(() => undefined);
    ketten.set(anhangId, ende);
    void ende.then(() => {
      if (ketten.get(anhangId) === ende) {
        ketten.delete(anhangId);
      }
    });
    return lauf;
  }

  /**
   * Beendet eine beendete oder abgelaufene Sitzung dauerhaft: ein Arbeitsstand, der nicht der
   * aktuelle Anhang ist, wird gesichert; erst danach wird die Sitzung gelöscht. Wirft, wenn das
   * Sichern scheitert — dann bleibt alles stehen. Ohne Aufrufer-Serialisierung (`nacheinander`).
   */
  async function abschliessenRoh(anhangId: string, koId: string): Promise<void> {
    const sitzung = await ablage.lies(anhangId);
    if (!sitzung || sitzung.sperre.bis > jetzt()) {
      return;
    }
    if (sitzung.arbeitsstand) {
      const artikel = await deps.ko.get(koId);
      const anhang = artikel?.attachments?.find((a) => a.id === anhangId);
      if (!anhang) {
        // Nicht zuzuordnen: nichts löschen, die Referenz bleibt in der Sitzung.
        return;
      }
      if (anhang.objectId !== sitzung.arbeitsstand.objectId) {
        await ablage.sichere({
          koId,
          anhangId,
          objectId: sitzung.arbeitsstand.objectId,
          nutzerId: (await ablage.schreiber(anhangId)) ?? "",
          at: new Date(jetzt()).toISOString(),
        });
      }
    }
    await ablage.schreibe(anhangId, undefined);
  }

  const abschliessen = (anhangId: string, koId: string) =>
    nacheinander(anhangId, () => abschliessenRoh(anhangId, koId));

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
        sitzungen: hostAblage,
        // Nur die Klarwerk-Seite selbst darf dem Editor Nachrichten schicken.
        postMessageOrigin: einrichtung.umgebung.seitenHerkunft,
      })
    : undefined;

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

  /** Gesicherte Stände genau dieses Anhangs DIESES Artikels. */
  async function gesicherteAm(koId: string, anhangId: string) {
    return (await ablage.gesicherte(anhangId)).filter((s) => s.koId === koId);
  }

  async function sitzungsstand(anhangId: string) {
    const s = await ablage.lies(anhangId);
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
      const anhangId = (request.params as { anhangId: string }).anhangId;
      const inhalt = pfad.endsWith("/contents");
      // Die Marke ist am Riegel bereits geprüft; hier wird nur ihr Inhalt gelesen.
      const pruefung = pruefeZugangsmarke(
        accessToken ?? "",
        anhangId,
        einrichtung.eingerichtet ? einrichtung.umgebung.schluessel : Buffer.alloc(32),
        jetzt(),
      );
      const marke = pruefung.gueltig ? pruefung.inhalt : undefined;
      if (!marke) {
        reply.code(401).send();
        return;
      }
      const ergebnis = await nacheinander(anhangId, async () => {
        // VOR dem Hostweg: eine beendete oder abgelaufene Sitzung dauerhaft abschließen. Scheitert
        // das Sichern, bekommt der Editor 503 und der Hostweg wird gar nicht erst gefragt — sonst
        // könnte eine neue Sitzung den ungesicherten Arbeitsstand überschreiben.
        try {
          await abschliessenRoh(anhangId, marke.koId);
        } catch (fehler) {
          request.log.error({ fehler, anhangId }, "Office: Arbeitsstand nicht gesichert");
          return undefined;
        }
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
        if (request.method === "POST" && inhalt && antwort.status === 200) {
          await ablage.merkeSchreiber(anhangId, marke.nutzerId);
        }
        // NACH dem Hostweg: hat er die Sitzung beendet (Entsperren), wird ihr Arbeitsstand jetzt
        // gesichert und erst danach die Sitzung gelöscht. Scheitert das, bleibt die beendete Sitzung
        // mit ihrem Arbeitsstand stehen und wird beim nächsten Zugriff erneut abgeschlossen; das
        // Entsperren selbst ist gelungen, der Editor bekommt seine Antwort.
        try {
          await abschliessenRoh(anhangId, marke.koId);
        } catch (fehler) {
          request.log.error({ fehler, anhangId }, "Office: Abschluss vertagt");
        }
        return antwort;
      });
      if (!ergebnis) {
        reply.code(503).send();
        return;
      }
      const antwort = ergebnis;
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
        // Ein vertagter Abschluss wird hier nachgeholt; scheitert er wieder, bleibt der Stand in der
        // beendeten Sitzung und die Lage wird trotzdem beantwortet.
        await abschliessen(lage.anhang.id, lage.artikel.id).catch((fehler: unknown) =>
          request.log.error({ fehler }, "Office: Abschluss vertagt"),
        );
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
          gesichert: (await gesicherteAm(lage.artikel.id, lage.anhang.id)).map((s) => ({
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

    if (deps.datenpunkte) {
      registriereAufbauRouten(
        app,
        { ...deps, datenpunkte: deps.datenpunkte },
        guards,
        vorFassungsschritt,
        nacheinander,
      );
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
      Body: { kandidatId?: unknown; token?: unknown };
    }>("/api/kos/:id/office/:anhangId/ergaenzung/uebernehmen", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      const datenpunkte = deps.datenpunkte;
      if (!datenpunkte) return reply.code(503).send({ error: "PP06_NICHT_ANGEBUNDEN" });
      // Derselbe Anhangsriegeltakt wie WOPI und Rücknahme, keine zweite Schreibverwaltung.
      return nacheinander(request.params.anhangId, async () => {
        const vorher = await vorFassungsschritt(request, reply);
        if (!vorher) return;
        let dokument: NachbearbeitungsErgebnis | undefined;
        const wirkungen: Wirkung[] = [];
        try {
          const suche = leseErgaenzungsSuche(request.body);
          if (suche.ort.anhangId !== request.params.anhangId)
            throw new DatenFehler("ungueltig", "Anhang passt nicht.");
          const umgebung = () => praesentationDatenUmgebung({ ...deps, ablage: datenpunkte }, user);
          const v = await ergaenzungsVorschau(
            request.params.id,
            suche,
            umgebung(),
            datenpunkte,
            jetzt,
          );
          const k = v.kandidaten.find((k) => k.datenpunkt.id === request.body?.kandidatId);
          if (!k || !k.passend || k.token !== request.body?.token) {
            return reply.code(409).send({
              error: "PP06_VORSCHAU_GEAENDERT",
              message:
                "Die Ergänzung passt nicht mehr zur Vorschau. Quelle, Rechte und Datenlage neu prüfen; nichts geändert.",
            });
          }
          const dp = await datenpunkte.lesen(k.datenpunkt.id);
          if (!dp) throw new DatenFehler("kein_zugriff", "Datenpunkt nicht verfügbar.");
          dokument = await fuehreNachbearbeitungAus(
            {
              ko: deps.ko,
              objekte: deps.objekte,
              verlauf: verlaufVon,
              jetzt,
              datenbeleg: ergaenzungsDatenbeleg(request.params.id, suche, v, k, dp),
            },
            {
              artikel: vorher.lage.artikel,
              anhang: vorher.lage.anhang,
              nutzerId: user.id,
              gestoppt: () => false,
              melde: (wirkung) => wirkungen.push(wirkung),
            },
            ergaenzungsAuftrag(v, k, suche, `pp06:${k.token}`),
          );
          if (dokument.zustand !== "gespeichert" || !dokument.pruefung?.ok) {
            return reply.code(409).send({
              error: "PP06_NICHT_UEBERNOMMEN",
              message:
                "Der Office-Fassungsweg hat die Ergänzung nicht vollständig bestätigt. Den konkreten Bericht prüfen.",
              dokument,
            });
          }
          // Nach tatsächlichem Wiederöffnen dieselbe Zahl binden; Herkunft/Prüfungen nie kopieren.
          const u = umgebung();
          const ziel = await u.artikel(request.params.id);
          if (!ziel) throw new DatenFehler("kein_zugriff", "Artikel nicht verfügbar.");
          const neu = await binde(dp, ziel, suche.ort, u, {
            nutzerId: user.id,
            jetzt: new Date(jetzt()).toISOString(),
            kennung: () => `pp06:${k.token}`,
          });
          if (!(await datenpunkte.ersetzen({ ...neu, stand: dp.stand + 1 }, dp.stand))) {
            return reply.code(409).send({
              error: "PP06_BINDUNG_OFFEN",
              message:
                "Dokument gespeichert, aber der Datenpunkt wurde gleichzeitig geändert. Herkunftsbindung ist offen; keine zweite Dateiübernahme starten. Rücknahme steht im Bericht.",
              dokument,
            });
          }
          reply.header("Cache-Control", "no-store");
          return { datenpunktId: dp.id, dokument, bindung: "gespeichert" };
        } catch (fehler) {
          if (dokument?.zustand === "gespeichert") {
            return reply.code(409).send({
              error: "PP06_BINDUNG_OFFEN",
              message:
                "Dokument gespeichert; Herkunftsbindung konnte nicht bestätigt werden. Rücknahme steht im Bericht.",
              dokument,
            });
          }
          if (wirkungen.length > 0) {
            return reply.code(500).send({
              error: "PP06_TEILFEHLER",
              message:
                "Der Vorgang endete nach einer Wirkung. Aktuelle Dokumentfassung und Verlauf prüfen; die Ergänzung ist nicht vollständig bestätigt.",
              wirkungen,
            });
          }
          if (fehler instanceof DatenFehler) {
            return reply
              .code(fehler.art === "kein_zugriff" ? 404 : 400)
              .send({ error: "INVALID", message: fehler.message });
          }
          if (fehler instanceof NachbearbeitungsFehler)
            return reply.code(400).send({ error: fehler.code, message: fehler.message });
          fassungsfehler(fehler, reply);
        }
      });
    });

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
      const liste = await gesicherteAm(vorher.lage.artikel.id, vorher.lage.anhang.id);
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
        await ablage.entferneGesichert(vorher.lage.anhang.id, stand.objectId);
        reply.code(200).send({ fassung: ko.version, status: ko.status, belegOffen });
      } catch (fehler) {
        fassungsfehler(fehler, reply);
      }
    });

    // ============================================================================================
    // BPA-17 · PRÄSENTATION NACH DER BESPRECHUNG NACHBEARBEITEN
    // (Auftrag produkt:20261011:assistenz-dokumentnachbearbeitung; Logik in office-nachbearbeitung.ts)
    // ============================================================================================
    //
    //   POST /api/kos/:id/office/:anhangId/nachbearbeitung                 begrenzter Auftrag → Fassung
    //   POST /api/kos/:id/office/:anhangId/nachbearbeitung/:laufId/stopp   vor der nächsten Wirkung halten
    //
    // DIESELBEN TORE WIE `zurueckholen` (`vorFassungsschritt`): `ko.create`, sichtbar, Schreibweg
    // `direkt` — ein freigegebener Artikel ohne Freigaberecht bleibt beim Vorschlagsweg, und während
    // einer laufenden Editor-Sitzung wird nichts geschrieben. Lesen allein (z. B. als
    // Besprechungsteilnehmer mit `ko.read`) ändert das Original nie.
    //
    // LÄUFE: je `laufId` höchstens eine Ausführung. Eine Wiederholung derselben Kennung liefert das
    // gespeicherte Ergebnis (`wiederholt: true`) und schreibt nichts. Das Gedächtnis dafür hält DIESER
    // Prozess (wie die Reihenfolge `nacheinander`); nach einem Neustart zeigt der Verlauf des Anhangs,
    // was gespeichert wurde.
    type Lauf = {
      nutzerId: string;
      stopp: boolean;
      /** Was schon geschehen ist — gemeldet vom Kern, bevor das Ergebnis feststeht. */
      wirkungen: Wirkung[];
      ergebnis?: NachbearbeitungsErgebnis | Teilfehler;
    };
    const laeufe = new Map<string, Lauf>();
    const LAEUFE_HOECHSTENS = 500;
    const laufSchluessel = (koId: string, anhangId: string, laufId: string) =>
      `${koId}\u0000${anhangId}\u0000${laufId}`;

    app.post<{ Params: { id: string; anhangId: string } }>(
      "/api/kos/:id/office/:anhangId/nachbearbeitung",
      async (request, reply) => {
        const vorher = await vorFassungsschritt(request, reply);
        if (!vorher) {
          return;
        }
        const { user, lage } = vorher;
        if (lage.format.endung !== "pptx") {
          reply.code(400).send({
            error: "NACHBEARBEITUNG_FORMAT",
            message:
              "Die Nachbearbeitung ist zuerst für PowerPoint-Dateien (.pptx) gebaut. Dieses Dokument wurde nicht geändert.",
          });
          return;
        }
        let auftrag: Nachbearbeitungsauftrag;
        try {
          auftrag = leseAuftrag(request.body);
        } catch (fehler) {
          if (fehler instanceof NachbearbeitungsFehler) {
            reply.code(400).send({ error: fehler.code, message: fehler.message });
            return;
          }
          throw fehler;
        }
        const schluessel = laufSchluessel(lage.artikel.id, lage.anhang.id, auftrag.laufId);
        const bekannt = laeufe.get(schluessel);
        if (bekannt) {
          if (bekannt.nutzerId !== user.id) {
            reply.code(409).send({
              error: "LAUF_KENNUNG_BELEGT",
              message: "Diese Laufkennung gehört zu einem anderen Auftrag.",
            });
            return;
          }
          if (!bekannt.ergebnis) {
            reply.code(409).send({
              error: "LAUF_LAEUFT",
              message: "Dieser Auftrag läuft bereits.",
            });
            return;
          }
          const zustand = bekannt.ergebnis.zustand;
          reply
            .code(zustand === "teilfehler" ? 500 : zustand === "konflikt" ? 409 : 200)
            .send({ ...bekannt.ergebnis, wiederholt: true });
          return;
        }
        const eintrag: Lauf = { nutzerId: user.id, stopp: false, wirkungen: [] };
        laeufe.set(schluessel, eintrag);
        let ergebnis: NachbearbeitungsErgebnis | Teilfehler;
        try {
          ergebnis = await nacheinander(lage.anhang.id, () =>
            fuehreNachbearbeitungAus(
              {
                ko: deps.ko,
                objekte: deps.objekte,
                verlauf: verlaufVon,
                jetzt,
              },
              {
                artikel: lage.artikel,
                anhang: lage.anhang,
                nutzerId: user.id,
                gestoppt: () => eintrag.stopp,
                melde: (wirkung) => eintrag.wirkungen.push(wirkung),
              },
              auftrag,
            ),
          );
        } catch (fehler) {
          // Ben-Befund AC07/G12: OHNE eingetretene Wirkung darf der Lauf neu versucht werden. MIT
          // Wirkung bleibt der Lauf mit seinen Ergebniskennungen stehen — eine Wiederholung derselben
          // Kennung liefert diesen Stand und erzeugt keine weiteren Kopien.
          if (eintrag.wirkungen.length === 0) {
            laeufe.delete(schluessel);
            if (fehler instanceof NachbearbeitungsFehler) {
              reply.code(400).send({ error: fehler.code, message: fehler.message });
              return;
            }
            throw fehler;
          }
          request.log.error({ fehler, laufId: auftrag.laufId }, "Nachbearbeitung: Teilfehler");
          ergebnis = teilfehler(
            auftrag,
            { koId: lage.artikel.id, anhangId: lage.anhang.id },
            eintrag.wirkungen,
            fehler,
          );
        }
        eintrag.ergebnis = ergebnis;
        // Ältestes abgeschlossenes Gedächtnis zuerst vergessen; laufende bleiben.
        for (const [k, v] of laeufe) {
          if (laeufe.size <= LAEUFE_HOECHSTENS) {
            break;
          }
          if (v.ergebnis) {
            laeufe.delete(k);
          }
        }
        if (ergebnis.zustand === "teilfehler") {
          reply.code(500).send({
            error: "NACHBEARBEITUNG_TEILFEHLER",
            message: ergebnis.fehler.meldung,
            ...ergebnis,
          });
          return;
        }
        if (ergebnis.zustand === "konflikt") {
          reply.code(409).send({
            error: "KO_STALE",
            message:
              "Das Dokument wurde seit der besprochenen Fassung geändert. Es wurde nichts überschrieben; der Bericht zeigt je Änderung, ob sie auf den heutigen Stand passt.",
            ...ergebnis,
          });
          return;
        }
        reply.code(200).send(ergebnis);
      },
    );

    app.post<{ Params: { id: string; anhangId: string; laufId: string } }>(
      "/api/kos/:id/office/:anhangId/nachbearbeitung/:laufId/stopp",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const lage = await artikelOder404(user, request.params.id, request.params.anhangId, reply);
        if (!lage) {
          return;
        }
        const eintrag = laeufe.get(
          laufSchluessel(lage.artikel.id, lage.anhang.id, request.params.laufId),
        );
        // Ein fremder Lauf sieht aus wie kein Lauf.
        if (!eintrag || eintrag.nutzerId !== user.id) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Kein solcher Auftrag." });
          return;
        }
        if (eintrag.ergebnis) {
          reply.code(409).send({
            error: "LAUF_BEENDET",
            message: "Der Auftrag ist bereits abgeschlossen; Stopp ändert nichts mehr.",
            zustand: eintrag.ergebnis.zustand,
          });
          return;
        }
        eintrag.stopp = true;
        reply.code(202).send({
          gestoppt: true,
          message:
            "Vor der nächsten Wirkung wird angehalten. Bereits Gespeichertes bleibt und steht im Ergebnis.",
        });
      },
    );
  };
}
