import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { KnowledgeObject, KoAttachment } from "../../../knowledge-object";
import { decodeDataUrl } from "../../../object-store";
import { FOLIEN_ABGLEICH_GRENZEN, pruefeAbgleichKoerper } from "../folien-abgleich-grenzen";
import type { Guards, SessionUser } from "../http";
import { fehlerCode } from "../office-artikel";
import { schreibeDatenfolien } from "../office-datenfolien";
import { leseAufbau, planeAufbau } from "../praesentation-aufbau";
import { DatenFehler, binde, leseFolienDaten } from "../praesentation-daten";
import type { DatenpunktAblage } from "../praesentation-daten-ablage";
import { darfSehen } from "../sichtbarkeit";
import type { OfficeRoutesDeps } from "./office-routes";
import { datenUmgebung } from "./praesentation-daten-routes";

type Anfrage = FastifyRequest<{ Params: { id: string; anhangId: string } }>;
type Vorher = {
  user: SessionUser;
  lage: { artikel: KnowledgeObject; anhang: KoAttachment; format: { endung: string } };
};

/** Anschluss INNERHALB des vorhandenen Office-Routers, mit dessen Schreib-/Sitzungstor. */
export function registriereAufbauRouten(
  app: FastifyInstance,
  deps: OfficeRoutesDeps & { datenpunkte: DatenpunktAblage },
  guards: Guards,
  vorFassungsschritt: (request: Anfrage, reply: FastifyReply) => Promise<Vorher | undefined>,
  nacheinander: <T>(anhangId: string, vorgang: () => Promise<T>) => Promise<T>,
): void {
  const jetzt = deps.jetzt ?? Date.now;
  const datenDeps = {
    ko: deps.ko,
    objekte: deps.objekte,
    ablage: deps.datenpunkte,
    konten: deps.konten,
  };
  async function ausfuehren(request: Anfrage, reply: FastifyReply, uebernehmen: boolean) {
    let gespeicherteFassung: number | undefined;
    try {
      reply.header("Cache-Control", "no-store");
      const vorher = await vorFassungsschritt(request, reply);
      if (!vorher) return;
      const { user, lage } = vorher;
      if (!darfSehen(user, lage.artikel))
        throw new DatenFehler("kein_zugriff", "Anhang nicht verfügbar.");
      if (lage.format.endung !== "pptx" || !lage.anhang.objectId)
        throw new DatenFehler("ungueltig", "Für den Folienaufbau eine PPTX-Vorlage auswählen.");
      const auftrag = leseAufbau(request.body);
      const objekt = await deps.objekte.read(lage.anhang.objectId);
      const bytes = objekt ? decodeDataUrl(objekt.data)?.bytes : undefined;
      if (!bytes) throw new DatenFehler("ungueltig", "Vorlagendatei fehlt.");
      const grenze = await pruefeAbgleichKoerper(bytes, FOLIEN_ABGLEICH_GRENZEN);
      if (grenze) {
        reply.code(grenze.status).send(grenze);
        return;
      }
      const satz = await leseFolienDaten(bytes);
      const plane = async () => {
        const u = datenUmgebung(datenDeps, user);
        const ziel = await u.artikel(lage.artikel.id);
        if (!ziel) throw new DatenFehler("kein_zugriff", "Anhang nicht verfügbar.");
        return planeAufbau({
          ziel,
          anhangId: lage.anhang.id,
          dateiFassung: satz.fassung,
          auftrag,
          u,
          ablage: deps.datenpunkte,
          jetzt,
        });
      };
      const plan = await plane();
      if (!uebernehmen) {
        const probe = await schreibeDatenfolien(bytes, plan);
        reply.send({ ...plan, folien: probe.deck.folien });
        return;
      }
      const planId = (request.body as { planId?: unknown })?.planId;
      if (planId !== plan.planId) {
        reply.code(409).send({
          error: "KO_STALE",
          message:
            "Daten, Quelle, Prüfstand oder Vorschau wurden geändert. Vorschau erneut erstellen.",
        });
        return;
      }
      const ausgabe = await schreibeDatenfolien(bytes, plan);
      // Nach dem Bau nochmals frisch lesen: auch ein Rechteentzug oder eine neue Eingabe macht
      // die freigegebene Vorschau unpassend. Der Zielstand wird zusätzlich atomar im KO-Dienst geprüft.
      if ((await plane()).planId !== planId) {
        reply.code(409).send({
          error: "KO_STALE",
          message: "Die Grundlage wurde während des Aufbaus geändert. Vorschau erneut erstellen.",
        });
        return;
      }
      const erneutVorher = await vorFassungsschritt(request, reply);
      if (!erneutVorher) return;
      const ref = await deps.objekte.put({
        name: lage.anhang.name,
        mime: lage.anhang.mime,
        data: `data:${lage.anhang.mime};base64,${ausgabe.bytes.toString("base64")}`,
        purpose: "attachment",
        owner: user.id,
        confidentiality: lage.artikel.confidentiality ?? "vertraulich",
      });
      const { ko, belegOffen } = await deps.ko.uebernimmOfficeFassung(
        lage.artikel.id,
        {
          anhangId: lage.anhang.id,
          objectId: ref.id,
          size: ref.size,
          expectedVersion: auftrag.expectedVersion,
        },
        user.id,
      );
      gespeicherteFassung = ko.version;
      const gespeichert = await deps.objekte.read(ref.id);
      if (!gespeichert || !decodeDataUrl(gespeichert.data)?.bytes.equals(ausgabe.bytes))
        throw new Error("Gespeicherte Datei konnte nicht bestätigt werden.");
      // PP-02 bindet die native Text-/Tabellenausgabe an dieselben Datenpunkte. Kein neuer Bestand.
      // Ein Bindungskonflikt nach dem Dateispeichern wird ausdrücklich als Teilwirkung gemeldet.
      const offen: string[] = [];
      for (const f of plan.fakten) {
        const dp = await deps.datenpunkte.lesen(f.id);
        if (!dp || dp.fassung !== f.fassung) {
          offen.push(f.id);
          continue;
        }
        try {
          let neu = dp;
          const u = datenUmgebung(datenDeps, user);
          for (const b of ausgabe.deck.bindungen.filter((b) => b.datenpunktId === f.id)) {
            neu = await binde(
              neu,
              ko,
              {
                anhangId: lage.anhang.id,
                sldId: b.sldId,
                shapeId: b.shapeId,
                ...(b.zeile ? { zeile: b.zeile, spalte: b.spalte } : {}),
              },
              u,
              { nutzerId: user.id, jetzt: new Date(jetzt()).toISOString(), kennung: randomUUID },
              "datenwert",
            );
          }
          if (!(await deps.datenpunkte.ersetzen({ ...neu, stand: dp.stand + 1 }, dp.stand)))
            offen.push(f.id);
        } catch {
          offen.push(f.id);
        }
      }
      reply.send({
        zustand: "gespeichert",
        fassung: ko.version,
        status: ko.status,
        belegOffen,
        bindungenOffen: offen,
        dateiFassung: (await leseFolienDaten(ausgabe.bytes)).fassung,
        deck: ausgabe.deck,
        hinweis: offen.length
          ? "Datei gespeichert; Herkunftsbindungen teilweise offen. Nicht als vollständige Übernahme behandeln."
          : "Datei gespeichert und wieder geöffnet. Rücknahme über den bestehenden Fassungsverlauf.",
      });
    } catch (f) {
      if (gespeicherteFassung !== undefined) {
        reply.code(500).send({
          error: "PP05_TEILWIRKUNG",
          fassung: gespeicherteFassung,
          message: `Die Datei wurde als Fassung ${gespeicherteFassung} übernommen. Die Wiederöffnungs- oder Bindungsprüfung konnte nicht vollständig bestätigt werden. Bitte den Dateistand prüfen.`,
        });
        return;
      }
      if (f instanceof DatenFehler) {
        reply
          .code(f.art === "kein_zugriff" ? 404 : 400)
          .send({ error: f.art === "kein_zugriff" ? "NOT_FOUND" : "INVALID", message: f.message });
        return;
      }
      const code = fehlerCode(f);
      if (code === "KO_STALE" || code === "STALE_WRITE") {
        reply.code(409).send({ error: "KO_STALE", message: (f as Error).message });
        return;
      }
      throw f;
    }
  }
  app.post<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/folienaufbau/vorschau",
    { bodyLimit: 32768 },
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      await ausfuehren(request, reply, false);
    },
  );
  app.post<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/folienaufbau/uebernehmen",
    { bodyLimit: 32768 },
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      await nacheinander(request.params.anhangId, () => ausfuehren(request, reply, true));
    },
  );
}
