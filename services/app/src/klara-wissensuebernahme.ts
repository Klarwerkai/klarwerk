import { createHash } from "node:crypto";
import { bindeAussagen, bindungsQuelleAus } from "../../ask";
import type { ReferenzPruefdienst } from "../../ask";
import type { AuditService } from "../../audit";
import {
  type CreateKoInput,
  type KoService,
  createOperationFingerprint,
} from "../../knowledge-object";
import { can } from "../../rbac";
import { kernaussageAusKlartext } from "../../structure";
import type { SessionUser } from "./http";
import { type KlaraNotiz, KlaraNotizDienst, type KlaraNotizRepo } from "./klara-notiz";
import { darfSehen } from "./sichtbarkeit";
import { type SpacesRepo, darfInSpaceSchreiben, darfSpaceInhalteLesen } from "./spaces";
import type { VorlagenEinreichungPort } from "./vorlagen";

/** Serverseitige Herkunft am privaten Original. Keine Übernahme eines fremden Chatverlaufs. */
export interface KlaraWissensHerkunft {
  projekt: string;
  abschnitt: string;
  antwortFassung: string;
  anbieter: string | null;
  modell: string | null;
  vorherigeNotiz: string | null;
  textAbdruck: string;
  aussagen: {
    text: string;
    art: "behauptung" | "empfehlung" | "kreativ" | "nutzerentscheidung";
    quellen: { id: string; fassung: number }[];
  }[];
}
export interface WissensZiel {
  art: "artikel" | "space";
  spaceId?: string;
  confidentiality: "intern" | "vertraulich" | "streng_vertraulich";
  type: CreateKoInput["type"];
  category: string;
  conditions: string[];
  vorlage?: { id: string; version: number };
}
export class WissensFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
const abdruck = (text: string) => createHash("sha256").update(text).digest("hex");
const html = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function text(x: unknown, max: number, kuerzen = true): string {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw new WissensFehler(400, "Ungültige oder fehlende Textangabe.");
  return kuerzen ? x.trim() : x;
}
function liste(x: unknown): unknown[] {
  if (!Array.isArray(x) || x.length > 50) throw new WissensFehler(400, "Ungültige Liste.");
  return x;
}
function objekt(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new WissensFehler(400, "Objekt erwartet.");
  return x as Record<string, unknown>;
}
export function wissensZiel(roh: unknown): WissensZiel {
  const x = objekt(roh);
  if (x.art !== "artikel" && x.art !== "space")
    throw new WissensFehler(400, "Artikel oder Space wählen.");
  if (!["intern", "vertraulich", "streng_vertraulich"].includes(String(x.confidentiality)))
    throw new WissensFehler(400, "Sichtbarkeit bewusst wählen.");
  if (
    !["bauchgefuehl", "best_practice", "lernkurve", "technik", "negativwissen"].includes(
      String(x.type),
    )
  )
    throw new WissensFehler(400, "Wissensart wählen.");
  const vorlage = x.vorlage === undefined ? undefined : objekt(x.vorlage);
  if (vorlage && (!Number.isInteger(vorlage.version) || Number(vorlage.version) < 1))
    throw new WissensFehler(400, "Vorlagenfassung fehlt.");
  return {
    art: x.art,
    ...(x.art === "space" ? { spaceId: text(x.spaceId, 200) } : {}),
    confidentiality: x.confidentiality as WissensZiel["confidentiality"],
    type: x.type as WissensZiel["type"],
    category: text(x.category, 200),
    conditions: liste(x.conditions ?? []).map((v) => text(v, 500)),
    ...(vorlage
      ? { vorlage: { id: text(vorlage.id, 200), version: Number(vorlage.version) } }
      : {}),
  };
}
export interface WissensDienste {
  notizen: KlaraNotizRepo;
  ko: KoService;
  spaces: SpacesRepo;
  vorlagen: VorlagenEinreichungPort;
  referenz: ReferenzPruefdienst;
  audit: AuditService;
}
/** Kein neuer Bestand: private Originale in KlaraNotizRepo, Beiträge in KoService. */
export class KlaraWissensDienst {
  constructor(private readonly d: WissensDienste) {}

  async importiere(user: SessionUser, roh: unknown) {
    const x = objekt(roh);
    const inhalt = text(x.inhalt, 20_000, false);
    const projekt = text(x.projekt, 200);
    const abschnitt = text(x.abschnitt, 500);
    const antwortFassung = text(x.antwortFassung, 200);
    const aussagen = liste(x.aussagen).map((v) => {
      const a = objekt(v);
      if (!["behauptung", "empfehlung", "kreativ", "nutzerentscheidung"].includes(String(a.art)))
        throw new WissensFehler(400, "Aussageart fehlt.");
      const wortlaut = text(a.text, 4_000);
      if (!inhalt.includes(wortlaut))
        throw new WissensFehler(400, "Aussage fehlt im gewählten Abschnitt.");
      const quellen = liste(a.quellen ?? []).map((v) => {
        const q = objekt(v);
        if (!Number.isInteger(q.fassung) || Number(q.fassung) < 1)
          throw new WissensFehler(400, "Quellfassung fehlt.");
        return { id: text(q.id, 200), fassung: Number(q.fassung) };
      });
      return {
        text: wortlaut,
        art: a.art as KlaraWissensHerkunft["aussagen"][number]["art"],
        quellen,
      };
    });
    const vorherigeNotiz = x.vorherigeNotiz == null ? null : text(x.vorherigeNotiz, 200);
    if (vorherigeNotiz) await this.original(user, vorherigeNotiz);
    const herkunft: KlaraWissensHerkunft = {
      projekt,
      abschnitt,
      antwortFassung,
      anbieter: x.anbieter == null || x.anbieter === "" ? null : text(x.anbieter, 100),
      modell: x.modell == null || x.modell === "" ? null : text(x.modell, 100),
      vorherigeNotiz,
      textAbdruck: abdruck(inhalt),
      aussagen,
    };
    // Einschließlich Fassung UND Inhalt: gleiche Antwort ist idempotent, Korrektur eine neue Fassung.
    const vorgang = `wissen-${abdruck(JSON.stringify({ ...herkunft, vorherigeNotiz: null }))}`;
    const alt = await this.d.notizen.zuVorgang(user.id, vorgang);
    if (alt) return { notiz: alt, wiederholt: true };
    const ergebnis = await new KlaraNotizDienst({ repo: this.d.notizen }).lege(
      user.id,
      {
        vorgang,
        weg: "ausschnitt",
        titel: text(x.titel, 200),
        inhalt,
        objektbezug: {
          pfad: "/start",
          seitenName: "Gewählter Chatabschnitt",
          objekt: projekt,
          bezug: "markierung",
        },
        offeneFragen: [],
      },
      undefined,
      herkunft,
    );
    return { notiz: await this.original(user, ergebnis.notiz.id), wiederholt: ergebnis.wiederholt };
  }

  async original(user: SessionUser, id: string): Promise<KlaraNotiz> {
    const n = await this.d.notizen.hole(user.id, id);
    if (!n) throw new WissensFehler(404, "Notiz nicht gefunden.");
    for (const q of this.quellen(n)) {
      const ko = await this.d.ko.get(q.id);
      if (!ko || !darfSehen(user, ko)) throw new WissensFehler(404, "Notizquelle nicht verfügbar.");
    }
    return n;
  }
  private quellen(n: KlaraNotiz) {
    const qs = n.wissensHerkunft?.aussagen.flatMap((a) => a.quellen) ?? [];
    return n.objektbezug.koId
      ? [...qs, { id: n.objektbezug.koId, fassung: n.objektbezug.fassung ?? 0 }]
      : qs;
  }
  async pruefe(user: SessionUser, id: string) {
    const n = await this.original(user, id);
    const quellen = new Map();
    for (const q of this.quellen(n)) {
      const ko = await this.d.ko.get(q.id);
      // Neue Passage erbt keine alte Bestätigung. Nicht gebundene/ersetzte Fassung bleibt offen.
      if (ko && ko.version === q.fassung) quellen.set(ko.id, bindungsQuelleAus(ko, undefined));
    }
    const herkunftGueltig =
      !n.wissensHerkunft || n.wissensHerkunft.textAbdruck === abdruck(n.inhalt);
    const behauptungen =
      (herkunftGueltig ? n.wissensHerkunft : undefined)?.aussagen
        .filter((a) => a.art === "behauptung")
        .map((a) => a.text)
        .join("\n") ?? n.inhalt;
    const beleg = bindeAussagen({
      antwort: behauptungen,
      sources: [...quellen.keys()],
      citedSources: [...quellen.keys()],
      quellen,
    });
    // Manuelle Exportangaben sind keine nachgewiesene tatsächliche Modellidentität.
    // Ohne einen gebundenen Adapterbeleg darf sich ein unbekanntes Modell nicht selbst bestätigen.
    const ergebnis = await this.d.referenz.pruefe({
      beleg,
      antwortRolle: undefined,
      akteur: user.id,
      antwortId: n.id,
      leser: {
        aktuell: (id) => this.d.ko.get(id),
        imPapierkorb: async () => undefined,
        fassung: async (id, version) => {
          const aktuell = await this.d.ko.get(id);
          return aktuell && aktuell.version === version && darfSehen(user, aktuell)
            ? { statement: aktuell.statement, sources: aktuell.sources }
            : undefined;
        },
      },
      darfSehen: (ko) => darfSehen(user, ko),
    });
    await this.original(user, id);
    return {
      fassung: n.fassung,
      beleg,
      ergebnis,
      herkunftUnveraendert: herkunftGueltig,
    };
  }

  async vorschau(user: SessionUser, id: string, fassung: unknown, ziel: WissensZiel) {
    if (!can(user.role, "ko.create")) throw new WissensFehler(403, "Kein Beitragsrecht.");
    const n = await this.original(user, id);
    if (!Number.isInteger(fassung) || n.fassung !== fassung)
      throw new WissensFehler(409, "Notizfassung geändert; neu öffnen.");
    if (n.wissensHerkunft && n.wissensHerkunft.textAbdruck !== abdruck(n.inhalt))
      throw new WissensFehler(
        409,
        "Der Importtext wurde geändert. Bitte eine nachvollziehbare neue Antwortfassung importieren.",
      );
    const space =
      ziel.art === "space"
        ? (await this.d.spaces.aktuelle()).find((s) => s.id === ziel.spaceId)
        : null;
    if (ziel.art === "space" && (!space || !darfSpaceInhalteLesen(space, user.id)))
      throw new WissensFehler(404, "Ziel nicht gefunden.");
    if (space && !darfInSpaceSchreiben(space, user))
      throw new WissensFehler(403, "Kein Schreibrecht im Ziel.");
    for (const q of this.quellen(n)) {
      const ko = await this.d.ko.get(q.id);
      if (!ko || !darfSehen(user, ko)) throw new WissensFehler(404, "Quelle nicht verfügbar.");
      if (ko.version !== q.fassung)
        throw new WissensFehler(409, "Quellfassung geändert; Herkunft zuerst klären.");
      // Kein Auszug deklassifiziert eine geschützte Quelle. Deren bewusste Fachfreigabe ist ein eigener Weg.
      if (
        ko.confidentiality !== "intern" ||
        (ko.quellrechte &&
          (ko.quellrechte.stufe !== "intern" ||
            ko.quellrechte.leser !== undefined ||
            ko.quellrechte.leserUnvollstaendig === true)) ||
        (ko.spaceId && ko.spaceId !== space?.id)
      )
        throw new WissensFehler(
          403,
          "Geschützte Quelle darf über diesen Weg nicht weitergegeben werden.",
        );
    }
    const bezug = ziel.vorlage ? { ...ziel.vorlage, spaceId: space?.id } : null;
    const kennzeichnung = n.wissensHerkunft
      ? `<p>Importangaben: Projekt ${html(n.wissensHerkunft.projekt)} · Antwortfassung ${html(n.wissensHerkunft.antwortFassung)} · Anbieter ${html(n.wissensHerkunft.anbieter ?? "unbekannt")} · Modell ${html(n.wissensHerkunft.modell ?? "unbekannt")}. Keine automatische fachliche Bestätigung.</p>${n.wissensHerkunft.aussagen
          .map(
            (a) =>
              `<p>${html(a.art === "nutzerentscheidung" ? "Im Import als Nutzerentscheidung bezeichnet (Person nicht verifiziert)" : a.art)}: ${html(a.text)}</p>`,
          )
          .join("")}`
      : "";
    const quellenLinks = this.quellen(n)
      .map(
        (q) =>
          `<p><a href="/wissen/${encodeURIComponent(q.id)}?fassung=${q.fassung}">Quellfassung ${q.fassung}</a></p>`,
      )
      .join("");
    const bodyHtml = `${quellenLinks}${kennzeichnung}<p>${html(n.inhalt).replaceAll("\n", "</p><p>")}</p><p>Herkunft: <a href="/start?notiz=${encodeURIComponent(n.id)}">Persönliches Original</a> · Fassung ${n.fassung}</p>${n.offeneFragen.length ? `<p>Offen: ${html(n.offeneFragen.join("; "))}</p>` : ""}`;
    const input: CreateKoInput = {
      title: n.titel,
      statement: kernaussageAusKlartext(n.inhalt),
      bodyHtml,
      type: ziel.type,
      category: ziel.category,
      conditions: ziel.conditions,
      confidentiality: ziel.confidentiality,
      author: user.id,
    };
    const entscheid = await this.d.vorlagen.pruefe(
      bezug,
      { bodyHtml, category: input.category, tags: [] },
      user,
      space?.id,
    );
    if (!entscheid.ok) throw new WissensFehler(entscheid.status, entscheid.message);
    const stempel = createOperationFingerprint({
      notiz: {
        id: n.id,
        fassung: n.fassung,
        inhalt: n.inhalt,
        fragen: n.offeneFragen,
        herkunft: n.wissensHerkunft ?? null,
      },
      ziel,
      spaceVersion: space?.version ?? null,
      rolle: user.role,
      input,
    });
    return {
      notizId: n.id,
      fassung: n.fassung,
      original: n.inhalt,
      offeneFragen: n.offeneFragen,
      herkunft: n.wissensHerkunft ?? null,
      ziel,
      space: space
        ? { id: space.id, name: space.name, version: space.version, zugang: space.zugang }
        : null,
      verantwortlich: user.id,
      kontoregel:
        "Eigenes Beitragsrecht; fachlicher Status bleibt offen bis zum bestehenden Prüfweg.",
      stempel,
      input,
      bezug: entscheid.bezug,
    };
  }
  async uebernehmen(user: SessionUser, id: string, roh: unknown) {
    const x = objekt(roh);
    if (x.bewusst !== true) throw new WissensFehler(400, "Bewusste Übernahme fehlt.");
    const ziel = wissensZiel(x.ziel);
    return this.d.vorlagen.sperre(
      ziel.vorlage ?? null,
      async () => {
        const v = await this.vorschau(user, id, x.fassung, ziel);
        if (v.stempel !== x.stempel)
          throw new WissensFehler(409, "Vorschau geändert; erneut prüfen.");
        const operation = {
          id: `klara-wissen-${abdruck(`${id}:${v.fassung}`)}`,
          actor: user.id,
          fingerprint: v.stempel,
        };
        let ko = await this.d.ko.lookupDocumentCreate(operation.id, operation);
        const wiederholt = Boolean(ko);
        if (!ko) {
          await this.original(user, id);
          ko = await this.d.ko.create(v.input, operation, undefined, ziel.spaceId);
          await this.d.vorlagen.vermerke(ko.id, v.bezug, user, ziel.spaceId);
          await this.d.audit.record({
            actor: user.id,
            action: "klara.wissen.uebernommen",
            target: ko.id,
            payload: { notizId: id, fassung: v.fassung },
          });
        }
        const gelesen = await this.d.ko.get(ko.id);
        if (
          !gelesen ||
          !darfSehen(user, gelesen) ||
          (ziel.art === "space" && gelesen.spaceId !== ziel.spaceId)
        )
          throw new WissensFehler(409, "Beitrag noch nicht im gewählten Ziel bestätigt.");
        return {
          beitrag: {
            id: gelesen.id,
            version: gelesen.version,
            status: gelesen.status,
            spaceId: gelesen.spaceId ?? null,
            verantwortlich: gelesen.author,
            ruecklink: `/start?notiz=${encodeURIComponent(id)}`,
          },
          wiederholt,
        };
      },
      ziel.spaceId,
    );
  }
}
