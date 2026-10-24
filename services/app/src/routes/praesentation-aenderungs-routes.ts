import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { KnowledgeObject, KoAttachment } from "../../../knowledge-object";
import { decodeDataUrl } from "../../../object-store";
import { FOLIEN_ABGLEICH_GRENZEN, pruefeAbgleichKoerper } from "../folien-abgleich-grenzen";
import type { Guards, SessionUser } from "../http";
import { fehlerCode } from "../office-artikel";
import {
  aktualisiereDatenDatei,
  leseDeckVertraege,
  schreibeTiefe,
} from "../office-daten-aenderungen";
import { lesePraesentation } from "../office-nachbearbeitung";
import {
  type AenderungsPlan,
  VorschauKonflikt,
  aenderungsVorschau,
  leseAenderungen,
} from "../praesentation-aenderungen";
import {
  DatenFehler,
  type Datenpunkt,
  binde,
  fingerabdruck,
  inFassung,
  leseFolienDaten,
  vollLesbar,
} from "../praesentation-daten";
import type { DatenpunktAblage } from "../praesentation-daten-ablage";
import { verknuepfeDeckFassungen } from "../praesentation-fassungen";
import { snapshotLesbar } from "../praesentation-snapshot-recht";
import {
  type UebernahmeBeleg,
  bereiteDatenUebernahmeVor,
  betteUebernahmeBelegEin,
  leseUebernahmeBeleg,
  quellAbdruck,
  ruecknahmeDatenpunkt,
} from "../praesentation-uebernahme";
import type { OfficeRoutesDeps } from "./office-routes-typen";
import { datenUmgebung } from "./praesentation-daten-routes";

type Anfrage = FastifyRequest<{ Params: { id: string; anhangId: string } }>;
type Vorher = {
  user: SessionUser;
  lage: { artikel: KnowledgeObject; anhang: KoAttachment; format: { endung: string } };
};
type Deps = OfficeRoutesDeps & { datenpunkte: DatenpunktAblage };

/** Nur innerhalb des bestehenden Office-Routers mit seinen Rechte-/Sitzungs-/Reihenfolgetoren. */
export function registriereDatenAenderungsRouten(
  app: FastifyInstance,
  deps: Deps,
  guards: Guards,
  vorFassungsschritt: (request: Anfrage, reply: FastifyReply) => Promise<Vorher | undefined>,
  nacheinander: <T>(anhangId: string, schritt: () => Promise<T>) => Promise<T>,
) {
  const jetzt = deps.jetzt ?? Date.now;
  const umgebung = (user: SessionUser) =>
    datenUmgebung(
      { ko: deps.ko, objekte: deps.objekte, ablage: deps.datenpunkte, konten: deps.konten },
      user,
    );
  const h = (user: SessionUser) => ({
    nutzerId: user.id,
    jetzt: new Date(jetzt()).toISOString(),
    kennung: randomUUID,
  });
  const roh = (request: Anfrage) =>
    request.body && typeof request.body === "object"
      ? (request.body as Record<string, unknown>)
      : {};
  async function dateiVon(objectId: string) {
    const o = await deps.objekte.read(objectId);
    const bytes = o ? decodeDataUrl(o.data)?.bytes : undefined;
    if (!bytes) throw new DatenFehler("ungueltig", "Die gespeicherte Präsentation fehlt.");
    const g = await pruefeAbgleichKoerper(bytes, FOLIEN_ABGLEICH_GRENZEN);
    if (g) throw new DatenFehler("ungueltig", g.message);
    return bytes;
  }
  function fehler(f: unknown, reply: FastifyReply) {
    if (
      f instanceof VorschauKonflikt ||
      ["KO_STALE", "STALE_WRITE"].includes(fehlerCode(f) ?? "")
    ) {
      reply.code(409).send({ error: "KO_STALE", message: (f as Error).message });
      return;
    }
    if (f instanceof DatenFehler) {
      reply
        .code(f.art === "kein_zugriff" ? 404 : 400)
        .send({ error: f.art === "kein_zugriff" ? "NOT_FOUND" : "INVALID", message: f.message });
      return;
    }
    throw f;
  }
  async function vorbereiten(request: Anfrage, vorher: Vorher) {
    const b = roh(request);
    const { user, lage } = vorher;
    if (lage.format.endung !== "pptx" || !lage.anhang.objectId)
      throw new DatenFehler("ungueltig", "Eine gespeicherte PPTX-Präsentation auswählen.");
    if (!Number.isInteger(b.expectedVersion) || typeof b.dateiFassung !== "string")
      throw new DatenFehler("ungueltig", "Artikel- und Dateifassung fehlen.");
    const bytes = await dateiVon(lage.anhang.objectId);
    const satz = await leseFolienDaten(bytes);
    if (b.expectedVersion !== lage.artikel.version || b.dateiFassung !== satz.fassung)
      throw new VorschauKonflikt(
        "Die Präsentation wurde geändert. Vorschau neu erstellen; nichts wurde überschrieben.",
      );
    const auftraege = leseAenderungen(b.aenderungen);
    const u = umgebung(user);
    const handelnder = h(user);
    const p = await bereiteDatenUebernahmeVor({
      bytes,
      ko: lage.artikel,
      anhangId: lage.anhang.id,
      objectId: lage.anhang.objectId,
      dateiFassung: satz.fassung,
      auftraege,
      u,
      ablage: deps.datenpunkte,
      h: handelnder,
    });
    return { ...p, u, handelnder, auftraege };
  }
  async function stand(beleg: UebernahmeBeleg, user: SessionUser) {
    const u = umgebung(user);
    const punkte = [];
    for (const ref of beleg.punkte) {
      const dp = await deps.datenpunkte.lesen(ref.id);
      if (!dp || !(await vollLesbar(dp, u)))
        throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
      const voll =
        dp.stand === ref.vorherStand + 1 &&
        dp.fassung === ref.nachherFassung &&
        fingerabdruck(dp) === ref.nachherAbdruck;
      const vorher =
        dp.fassung === ref.vorherFassung &&
        fingerabdruck(dp) === ref.vorherAbdruck &&
        dp.stand === ref.vorherStand;
      punkte.push({
        id: ref.id,
        fassung: dp.fassung,
        stand: dp.stand,
        zustand: voll ? "uebernommen" : vorher ? "offen" : "spaeter_geaendert",
        vorherWert: inFassung(dp, ref.vorherFassung)?.wert,
        aktuellWert: dp.wert,
      });
    }
    return {
      vorschauId: beleg.vorschauId,
      basisFassung: beleg.basis.artikelFassung,
      punkte,
      konflikteOffen: beleg.konflikteOffen,
      ruecknahmeMoeglich: punkte.every((p) => p.zustand !== "spaeter_geaendert"),
    };
  }
  async function speichern(
    request: Anfrage,
    reply: FastifyReply,
    vorher: Vorher,
    p: {
      plan: AenderungsPlan;
      datei: Awaited<ReturnType<typeof aktualisiereDatenDatei>>;
      basis: UebernahmeBeleg["basis"];
      vorschauId: string;
      handelnder: ReturnType<typeof h>;
      quellen?: { id: string; version: number; abdruck: string }[];
    },
    ruecknahmeVon?: string,
  ) {
    const { user, lage } = vorher;
    const ids = new Set([...p.plan.geaendert, ...p.datei.bindungsziele.map((b) => b.datenpunktId)]);
    const refs: UebernahmeBeleg["punkte"] = [];
    for (const alt of p.plan.vorher.values()) {
      const current = await deps.datenpunkte.lesen(alt.id);
      if (!current || current.stand !== alt.stand || !(await vollLesbar(current, umgebung(user))))
        throw new VorschauKonflikt(
          "Eine verwendete Datenfassung oder deren Rechte wurden geändert. Vorschau neu erstellen.",
        );
    }
    for (const id of ids) {
      const alt = p.plan.vorher.get(id);
      const neu = p.plan.nachher.get(id);
      if (!alt || !neu) continue;
      const current = await deps.datenpunkte.lesen(id);
      if (!current || current.stand !== alt.stand || !(await vollLesbar(current, umgebung(user))))
        throw new VorschauKonflikt(
          "Ein Datenpunkt oder seine Rechte wurden geändert. Vorschau neu erstellen.",
        );
      refs.push({
        id,
        vorherFassung: alt.fassung,
        vorherStand: alt.stand,
        vorherAbdruck: fingerabdruck(alt),
        nachherFassung: neu.fassung,
        nachherAbdruck: fingerabdruck(neu),
        bindungenVorher: alt.bindungen.map((b) => b.id),
      });
    }
    if (refs.length > 80)
      throw new DatenFehler(
        "ungueltig",
        "Die Dateiaktualisierung enthält mehr als 80 Datenpunkte; den vorhandenen PP05-Prüf-/Downloadrahmen bitte aufteilen. Nichts gespeichert.",
      );
    const quellenPassen = async (nachher: boolean) => {
      for (const q of p.quellen ?? []) {
        const ko = await umgebung(user).artikel(q.id);
        if (!ko) return false;
        const ziel = q.id === lage.artikel.id;
        if (nachher && ziel && ko.version !== q.version + 1) return false;
        if (
          quellAbdruck(
            ko,
            nachher && ziel ? q.version : ko.version,
            nachher && ziel ? { anhangId: lage.anhang.id, objectId: p.basis.objectId } : undefined,
          ) !== q.abdruck
        )
          return false;
      }
      return true;
    };
    const beleg: UebernahmeBeleg = {
      vertrag: "klara-pp07-uebernahme-v1",
      vorschauId: p.vorschauId,
      actor: user.id,
      am: p.handelnder.jetzt,
      basis: p.basis,
      punkte: refs,
      konflikteOffen: p.datei.konflikte.map((k) => ({ id: k.id, grund: k.grund })),
      ...(ruecknahmeVon ? { ruecknahmeVon } : {}),
    };
    const bytes = await betteUebernahmeBelegEin(p.datei.bytes, beleg);
    const gelesen = await leseFolienDaten(bytes);
    const frisch = await vorFassungsschritt(request, reply);
    if (!frisch) return;
    if (
      frisch.lage.artikel.version !== lage.artikel.version ||
      frisch.lage.anhang.objectId !== lage.anhang.objectId
    )
      throw new VorschauKonflikt(
        "Die Datei wurde während der Vorbereitung geändert. Bitte neu laden.",
      );
    let version: number | undefined;
    const aktualisiert: string[] = [];
    const offen: string[] = [];
    try {
      const ref = await deps.objekte.put({
        name: lage.anhang.name,
        mime: lage.anhang.mime,
        data: `data:${lage.anhang.mime};base64,${bytes.toString("base64")}`,
        purpose: "attachment",
        owner: user.id,
        confidentiality: lage.artikel.confidentiality ?? "vertraulich",
        privatQuelle: lage.artikel.id,
      });
      if (!(await quellenPassen(false)))
        throw new VorschauKonflikt(
          "Eine verwendete Quelle oder ihre Rechte wurden während der Vorbereitung geändert. Datei wurde nicht übernommen.",
        );
      const { ko, belegOffen } = await deps.ko.uebernimmOfficeFassung(
        lage.artikel.id,
        {
          anhangId: lage.anhang.id,
          objectId: ref.id,
          size: ref.size,
          expectedVersion: lage.artikel.version,
        },
        user.id,
      );
      version = ko.version;
      const gespeichert = await dateiVon(ref.id);
      if (!gespeichert.equals(bytes))
        throw new Error("Gespeicherte Dateibytes konnten nicht bestätigt werden.");
      for (let i = 0; i < refs.length; i++) {
        const r = refs[i];
        if (!r) continue;
        const alt = p.plan.vorher.get(r.id);
        const neu = p.plan.nachher.get(r.id);
        if (!alt || !neu) throw new Error("Geplanter Datenpunkt fehlt.");
        const u = umgebung(user);
        const aktuell = await deps.datenpunkte.lesen(r.id);
        if (!aktuell || aktuell.stand !== r.vorherStand || !(await vollLesbar(aktuell, u))) {
          offen.push(...refs.slice(i).map((x) => x.id));
          break;
        }
        let gebunden = neu;
        for (const z of p.datei.bindungsziele.filter((z) => z.datenpunktId === r.id))
          gebunden = await binde(
            gebunden,
            ko,
            {
              anhangId: lage.anhang.id,
              sldId: z.sldId,
              shapeId: z.shapeId,
              ...(z.zeile === undefined ? {} : { zeile: z.zeile, spalte: z.spalte }),
            },
            u,
            p.handelnder,
            "datenwert",
          );
        if (!(await deps.datenpunkte.ersetzen({ ...gebunden, stand: alt.stand + 1 }, alt.stand))) {
          offen.push(...refs.slice(i).map((x) => x.id));
          break;
        }
        aktualisiert.push(r.id);
      }
      if (!offen.length) {
        for (const alt of p.plan.vorher.values()) {
          const current = await deps.datenpunkte.lesen(alt.id);
          const ref = refs.find((r) => r.id === alt.id);
          const erwartet = p.plan.nachher.get(alt.id) ?? alt;
          if (
            !current ||
            current.stand !== alt.stand + (ref ? 1 : 0) ||
            fingerabdruck(current) !== fingerabdruck(erwartet) ||
            !(await vollLesbar(current, umgebung(user)))
          )
            offen.push(alt.id);
        }
        if (!(await quellenPassen(true))) offen.push("verwendete-quellen-pruefen");
      }
      if (offen.length) {
        reply.code(500).send({
          error: "PP07_TEILWIRKUNG",
          message: `Datei als Fassung ${version} gespeichert. ${aktualisiert.length} Datenpunkte übernommen; ${offen.length} noch offen. Keine vollständige Übernahme. Den gespeicherten Stand prüfen oder bewusst zurücknehmen.`,
          fassung: version,
          vorschauId: p.vorschauId,
          aktualisiert,
          offen,
          belegOffen,
          dateiFassung: gelesen.fassung,
        });
        return;
      }
      reply.send({
        zustand: belegOffen || p.datei.konflikte.length ? "teilweise_uebernommen" : "uebernommen",
        fassung: version,
        status: ko.status,
        dateiFassung: gelesen.fassung,
        vorschauId: p.vorschauId,
        belegOffen,
        aktualisiert,
        konflikteOffen: p.datei.konflikte,
        hinweis:
          "Neue Datei- und Datenfassungen gespeichert. Die fachliche Freigabe wurde nicht übernommen. Rücknahme erzeugt ebenfalls neue, erneut zu prüfende Fassungen.",
      });
    } catch (f) {
      if (version !== undefined) {
        reply.code(500).send({
          error: "PP07_TEILWIRKUNG",
          fassung: version,
          vorschauId: p.vorschauId,
          aktualisiert,
          message: `Die Datei wurde als Fassung ${version} gespeichert; nachfolgende Daten-/Wiederöffnungsprüfung unvollständig. Keine vollständige Übernahme behauptet. Gespeicherten Stand prüfen oder zurücknehmen.`,
        });
        return;
      }
      throw f;
    }
  }
  app.post<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/datenaktualisierung/vorschau",
    { bodyLimit: 65536 },
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      try {
        const vorher = await vorFassungsschritt(request, reply);
        if (!vorher) return;
        const p = await vorbereiten(request, vorher);
        const sicht = await aenderungsVorschau(
          [...p.plan.vorher.values()],
          p.auftraege,
          p.u,
          deps.datenpunkte,
          p.handelnder,
          Date.parse(p.handelnder.jetzt),
        );
        reply.header("Cache-Control", "no-store").send({
          ...sicht,
          vorschauId: p.vorschauId,
          expectedVersion: vorher.lage.artikel.version,
          dateiFassung: p.basis.dateiFassung,
          dateiwirkungen: p.datei.wirkungen,
          dateikonflikte: p.datei.konflikte,
          uebernahme: {
            verfuegbar:
              p.plan.konflikte.length === 0 && !p.datei.konflikte.some((k) => k.sperrtUebernahme),
            grund:
              "Bewusste Übernahme nach Prüfung dieser konkreten Datei- und Datenvorschau. Offene Dateikonflikte müssen einzeln als unverändert bestätigt werden.",
          },
        });
      } catch (f) {
        fehler(f, reply);
      }
    },
  );
  app.post<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/datenaktualisierung/uebernehmen",
    { bodyLimit: 65536 },
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      await nacheinander(request.params.anhangId, async () => {
        try {
          const vorher = await vorFassungsschritt(request, reply);
          if (!vorher) return;
          const b = roh(request);
          if (typeof b.vorschauId !== "string")
            throw new DatenFehler("ungueltig", "Die geprüfte Vorschaukennung fehlt.");
          if (vorher.lage.anhang.objectId) {
            const beleg = await leseUebernahmeBeleg(await dateiVon(vorher.lage.anhang.objectId));
            if (
              beleg?.vorschauId === b.vorschauId &&
              beleg.basis.koId === vorher.lage.artikel.id &&
              beleg.basis.anhangId === vorher.lage.anhang.id
            ) {
              reply.send({
                zustand: "bereits_gespeichert",
                fassung: vorher.lage.artikel.version,
                wiederholt: true,
                ...(await stand(beleg, user)),
              });
              return;
            }
          }
          const p = await vorbereiten(request, vorher);
          if (p.vorschauId !== b.vorschauId)
            throw new VorschauKonflikt(
              "Daten, Quellen, Rechte oder Datei wurden seit der Vorschau geändert. Vorschau neu erstellen.",
            );
          if (p.plan.konflikte.length || p.datei.konflikte.some((k) => k.sperrtUebernahme))
            throw new DatenFehler(
              "ungueltig",
              "Die ausgewiesenen Quellen-/Prüfstatuskonflikte müssen zuerst behoben werden.",
            );
          const bestaetigt = Array.isArray(b.bestaetigteKonflikte) ? b.bestaetigteKonflikte : [];
          if (p.datei.konflikte.some((k) => !bestaetigt.includes(k.id)))
            throw new DatenFehler(
              "ungueltig",
              "Offene Dateikonflikte einzeln prüfen und ausdrücklich unverändert lassen; sonst nichts übernehmen.",
            );
          const frisch = await vorFassungsschritt(request, reply);
          if (!frisch) return;
          const kontrolliert = await vorbereiten(request, frisch);
          if (kontrolliert.vorschauId !== p.vorschauId)
            throw new VorschauKonflikt(
              "Die Grundlage wurde während der Vorbereitung geändert. Vorschau neu erstellen.",
            );
          await speichern(request, reply, frisch, kontrolliert);
        } catch (f) {
          fehler(f, reply);
        }
      });
    },
  );
  app.get<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/datenaktualisierung/stand",
    async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) return;
      try {
        const u = umgebung(user);
        const ko = await u.artikel(request.params.id);
        const anhang = ko?.attachments?.find((a) => a.id === request.params.anhangId);
        if (!ko || !anhang?.objectId)
          throw new DatenFehler("kein_zugriff", "Anhang nicht gefunden.");
        const bytes = await dateiVon(anhang.objectId);
        const beleg = await leseUebernahmeBeleg(bytes);
        const uebernahme = beleg ? await stand(beleg, user) : null;
        const { zip } = await lesePraesentation(bytes);
        const decks = await leseDeckVertraege(zip);
        const satz = await leseFolienDaten(bytes);
        const fassungen = [];
        for (const { deck } of decks)
          try {
            fassungen.push({
              verfuegbar: true,
              ...(await verknuepfeDeckFassungen(
                { dateiFassung: satz.fassung, deck },
                satz,
                u,
                deps.datenpunkte,
              )),
            });
          } catch (f) {
            if (f instanceof DatenFehler && f.art === "ungueltig")
              fassungen.push({ verfuegbar: false, grund: f.message });
            else if (f instanceof DatenFehler && f.art === "kein_zugriff" && beleg) {
              let lesbar = true;
              for (const ref of deck.plan.fakten) {
                const aktuell = await deps.datenpunkte.lesen(ref.id);
                if (!aktuell || !(await vollLesbar(aktuell, u))) {
                  lesbar = false;
                  break;
                }
              }
              if (!lesbar) throw f;
              fassungen.push({
                verfuegbar: false,
                grund:
                  "Die Datei wurde gespeichert, aber die geplanten Datenfassungen sind noch nicht vollständig übernommen. Den dokumentierten Teilstand konkret klären; Dateifassungen bleiben gesperrt.",
              });
            } else throw f;
          }
        reply.header("Cache-Control", "no-store").send({
          fassung: ko.version,
          dateiFassung: satz.fassung,
          uebernahme,
          fassungen,
          hinweis:
            "Gespeicherte Dateifassungen sind Momentaufnahmen; keine automatische Live-Synchronisierung.",
        });
      } catch (f) {
        fehler(f, reply);
      }
    },
  );
  app.post<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/datenaktualisierung/ruecknahme",
    { bodyLimit: 8192 },
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      await nacheinander(request.params.anhangId, async () => {
        try {
          const vorher = await vorFassungsschritt(request, reply);
          if (!vorher) return;
          const { lage } = vorher;
          const b = roh(request);
          if (
            b.expectedVersion !== lage.artikel.version ||
            typeof b.vorschauId !== "string" ||
            !lage.anhang.objectId
          )
            throw new VorschauKonflikt("Die Fassung wurde geändert. Vor der Rücknahme neu laden.");
          const bytes = await dateiVon(lage.anhang.objectId);
          const beleg = await leseUebernahmeBeleg(bytes);
          if (
            !beleg ||
            beleg.vorschauId !== b.vorschauId ||
            beleg.basis.koId !== lage.artikel.id ||
            beleg.basis.anhangId !== lage.anhang.id
          )
            throw new DatenFehler(
              "ungueltig",
              "Die aktuelle Datei hat keinen passenden PP07-Übernahmebeleg.",
            );
          const versionen = await deps.ko.versionsOf(lage.artikel.id);
          const basis = versionen
            .find((v) => v.version === beleg.basis.artikelFassung)
            ?.snapshot.attachments?.find((a) => a.id === lage.anhang.id);
          if (!basis || basis.objectId !== beleg.basis.objectId)
            throw new DatenFehler(
              "ungueltig",
              "Die Rücknahmebasis ist im bestehenden Dateiverlauf nicht belegt.",
            );
          const basisBytes = await dateiVon(beleg.basis.objectId);
          if ((await leseFolienDaten(basisBytes)).fassung !== beleg.basis.dateiFassung)
            throw new DatenFehler(
              "ungueltig",
              "Die belegte Ausgangsdatei stimmt nicht mit dem Übernahmebeleg überein.",
            );
          const u = umgebung(user);
          const alt = new Map<string, Datenpunkt>();
          const neu = new Map<string, Datenpunkt>();
          const handelnder = h(user);
          for (const ref of beleg.punkte) {
            const dp = await deps.datenpunkte.lesen(ref.id);
            if (!dp || !(await vollLesbar(dp, u)))
              throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
            const istVorher =
              dp.stand === ref.vorherStand &&
              dp.fassung === ref.vorherFassung &&
              fingerabdruck(dp) === ref.vorherAbdruck;
            const istNachher =
              dp.stand === ref.vorherStand + 1 &&
              dp.fassung === ref.nachherFassung &&
              fingerabdruck(dp) === ref.nachherAbdruck;
            if (!istVorher && !istNachher)
              throw new VorschauKonflikt(
                "Ein Datenpunkt wurde später verändert oder geprüft. Die Rücknahme würde fremde Arbeit überschreiben; bitte zuerst konkret klären.",
              );
            alt.set(dp.id, dp);
            neu.set(dp.id, istVorher ? dp : await ruecknahmeDatenpunkt(dp, ref, u, handelnder));
          }
          const projiziert = {
            ...u,
            datenpunkt: async (id: string) => neu.get(id) ?? u.datenpunkt(id),
          };
          const plan: AenderungsPlan = {
            vorher: alt,
            nachher: neu,
            geaendert: [...neu.keys()].filter(
              (id) =>
                fingerabdruck(neu.get(id) as Datenpunkt) !==
                fingerabdruck(alt.get(id) as Datenpunkt),
            ),
            konflikte: [],
            umgebung: projiziert,
          };
          const datei = await aktualisiereDatenDatei({
            bytes: basisBytes,
            ko: lage.artikel,
            anhangId: lage.anhang.id,
            plan,
            u,
            ablage: deps.datenpunkte,
            jetzt: Date.parse(handelnder.jetzt),
          });
          if (datei.konflikte.length)
            throw new DatenFehler(
              "ungueltig",
              `Die rückzunehmende Ausgangsdatei braucht konkrete Klärung: ${datei.konflikte.map((k) => k.grund).join(" ")}`,
            );
          await speichern(
            request,
            reply,
            vorher,
            {
              plan,
              datei,
              basis: {
                koId: lage.artikel.id,
                anhangId: lage.anhang.id,
                artikelFassung: lage.artikel.version,
                objectId: lage.anhang.objectId,
                dateiFassung: (await leseFolienDaten(bytes)).fassung,
              },
              vorschauId: `ruecknahme-${randomUUID()}`,
              handelnder,
            },
            beleg.vorschauId,
          );
        } catch (f) {
          fehler(f, reply);
        }
      });
    },
  );
  app.post<{ Params: { id: string; anhangId: string } }>(
    "/api/kos/:id/office/:anhangId/datenaktualisierung/fassungen",
    { bodyLimit: 8192 },
    async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) return;
      await nacheinander(request.params.anhangId, async () => {
        const dateien: {
          objectId: string;
          name: string;
          tiefe: string;
          basis: string;
          dateiFassung: string;
          wiederoeffnet: boolean;
        }[] = [];
        try {
          const vorher = await vorFassungsschritt(request, reply);
          if (!vorher) return;
          const { lage } = vorher;
          const b = roh(request);
          if (b.expectedVersion !== lage.artikel.version || !lage.anhang.objectId)
            throw new VorschauKonflikt(
              "Die Präsentation wurde geändert. Vor dem Speichern neu laden.",
            );
          const bytes = await dateiVon(lage.anhang.objectId);
          const satz = await leseFolienDaten(bytes);
          if (b.dateiFassung !== satz.fassung)
            throw new VorschauKonflikt("Die Dateifassung wurde geändert. Bitte neu laden.");
          const { zip } = await lesePraesentation(bytes);
          const decks = await leseDeckVertraege(zip);
          if (!decks.length)
            throw new DatenFehler(
              "ungueltig",
              "Diese Datei hat noch keinen PP05-Deckvertrag. Den vorhandenen Folienaufbau verwenden.",
            );
          const u = umgebung(user);
          for (const { deck } of decks) {
            const f = await verknuepfeDeckFassungen(
              { dateiFassung: satz.fassung, deck },
              satz,
              u,
              deps.datenpunkte,
            );
            if (f.konflikte.length)
              throw new DatenFehler(
                "ungueltig",
                "Die ausgewiesenen manuellen Daten-/Bindungskonflikte zuerst klären.",
              );
            if (f.gemeinsam.datenbasis.some((p) => p.fassung !== p.aktuelleFassung))
              throw new VorschauKonflikt(
                "Die Präsentation verwendet ältere Datenfassungen. Zuerst die gebundenen Vorkommen aktualisieren.",
              );
          }
          // Rechte/Weitergabe erneut über PP05 prüfen, auch für frühere Quellen und Korrekturen.
          const { planeAufbau } = await import("../praesentation-aufbau");
          for (const { deck } of decks)
            await planeAufbau({
              ziel: lage.artikel,
              anhangId: lage.anhang.id,
              dateiFassung: satz.fassung,
              auftrag: { ...deck.plan.auftrag, expectedVersion: lage.artikel.version },
              u,
              ablage: deps.datenpunkte,
              jetzt,
            });
          for (const tiefe of ["kurz", "ausfuehrlich"] as const) {
            const ausgabe = await schreibeTiefe(bytes, tiefe);
            const name = `${lage.anhang.name.replace(/\.pptx$/i, "")}-${tiefe}.pptx`;
            const aktuell = await vorFassungsschritt(request, reply);
            if (!aktuell) return;
            if (
              aktuell.lage.artikel.version !== lage.artikel.version ||
              aktuell.lage.anhang.objectId !== lage.anhang.objectId
            )
              throw new VorschauKonflikt(
                "Die Grundlage wurde während der Dateierstellung geändert.",
              );
            const ref = await deps.objekte.put({
              name,
              mime: lage.anhang.mime,
              data: `data:${lage.anhang.mime};base64,${ausgabe.bytes.toString("base64")}`,
              purpose: "attachment",
              owner: user.id,
              privatQuelle: lage.artikel.id,
              confidentiality:
                lage.artikel.confidentiality === "streng_vertraulich"
                  ? "streng_vertraulich"
                  : "vertraulich",
            });
            const eintrag = {
              objectId: ref.id,
              name,
              tiefe,
              basis: ausgabe.basis,
              dateiFassung: (await leseFolienDaten(ausgabe.bytes)).fassung,
              wiederoeffnet: false,
            };
            dateien.push(eintrag);
            const obj = await deps.objekte.read(ref.id);
            const gelesen = obj ? decodeDataUrl(obj.data)?.bytes : undefined;
            if (!gelesen?.equals(ausgabe.bytes))
              throw new Error("Die gespeicherte Fassungsdatei konnte nicht bestätigt werden.");
            const download = await snapshotLesbar(gelesen, ref.id, umgebung(user));
            if (!download?.sichtbar)
              throw new VorschauKonflikt(
                "Die gespeicherte Fassungsdatei kann unter den heutigen Quellenrechten nicht bestätigt werden. Den Teilstand prüfen; keine vollständige Ausgabe.",
              );
            eintrag.wiederoeffnet = true;
          }
          reply.header("Cache-Control", "no-store").send({
            zustand: "gespeichert",
            dateien,
            hinweis:
              "Beide Dateien verwenden dieselbe gebundene Daten-/Quellfassungsbasis. In der Kurzfassung sind Einzelfolien und Belege ausgeblendet, weiter im Dokument verfügbar. Private Momentaufnahmen; keine Live-Synchronisierung und keine zusätzlichen Klarwerkrechte.",
          });
        } catch (f) {
          if (dateien.length) {
            reply.code(500).send({
              error: "PP07_FASSUNGEN_TEILWIRKUNG",
              message:
                "Nur die genannten Dateien wurden bisher gespeichert; keine gemeinsame Zweidatei-Transaktion. Bestätigte Dateien können verwendet, fehlende Fassungen erneut erstellt werden.",
              dateien,
            });
            return;
          }
          fehler(f, reply);
        }
      });
    },
  );
}
