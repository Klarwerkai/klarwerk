import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { AuditService } from "../../audit";
import type { AuthService } from "../../auth";
import { type KoService, anlagenVon, normalizeAsset } from "../../knowledge-object";
import { can } from "../../rbac";
import type { SessionUser } from "./http";
import type { KlaraAufgabeRepo } from "./klara-aufgabe";
import type { KlaraAuftrag } from "./klara-auftrag";
import type {
  KlaraDNormAuftragsEingabe,
  KlaraDNormAuftragsPort,
  KlaraDNormAuftragsPruefung,
} from "./klara-d-normauftrag-vertrag";
import { FRISTEN_GRENZEN, FristenFehler, type FristenStand } from "./klara-fristen";
import type { KlaraFristenRepo } from "./klara-fristen-ablage";
import type { GeleseneFristenQuelle } from "./klara-fristen-dienst";
import type { KlaraFristenQuellen } from "./klara-fristen-quellen";
import type { KlaraGespraechRepo } from "./klara-gespraech";
import {
  NORM_EREIGNISARTEN,
  type NormAbloesung,
  type NormBeleg,
  type NormEreignis,
  type NormKonfliktauswahl,
  type NormKonfliktklaerung,
  type NormPruefauftragRef,
  type Normgeschichte,
  erkenneNormBekanntmachung,
  normAbloesungsbeleg,
  normAktuelleKonfliktklaerung,
  normFachereignisse,
  normHatWiderspruch,
  normKlaerung,
  normKonfliktarten,
  normKonfliktauswahlGueltig,
  normKonfliktbeleg,
  normQuellstand,
  vereinigeNormgeschichten,
} from "./klara-normereignisse";
import type { KlaraNotizDienst, NotizSchreibbedingung } from "./klara-notiz";
import type {
  NormBetroffenheit,
  NormFolgeversuch,
  NormVorbereitung,
} from "./klara-normvorbereitung-typen";
import type { KlaraWissensHerkunft } from "./klara-wissensuebernahme";

export type { NormBetroffenheit, NormFolgeversuch, NormVorbereitung };
export interface NormDienstDeps {
  repo: KlaraFristenRepo;
  quellen: Pick<KlaraFristenQuellen, "nutzer" | "lies">;
  ko: Pick<KoService, "list" | "get" | "versionsOf">;
  belege: Pick<AuditService, "list">;
  auth: Pick<AuthService, "kontoLesen">;
  gespraeche: Pick<KlaraGespraechRepo, "hole" | "aktuelles">;
  aufgaben: Pick<KlaraAufgabeRepo, "hole">;
  readonly normPruefauftrag?: () => KlaraDNormAuftragsPort | undefined;
  readonly pruefNotizen?: Pick<KlaraNotizDienst, "lege">;
  jetzt?: () => number;
}

export class NormereignisFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "NormereignisFehler";
  }
}

function gemeinsam(bedingungen: readonly NotizSchreibbedingung[]): NotizSchreibbedingung {
  return {
    gilt: () => bedingungen.every((b) => b.gilt?.() !== false),
    sql(start) {
      const und: string[] = [];
      const params: unknown[] = [];
      for (const bedingung of bedingungen) {
        const b = bedingung.sql?.(start + params.length);
        if (!b) throw new Error("Normvorbereitung ohne aktuelle Schreibbedingung");
        und.push(...b.und);
        params.push(...b.params);
      }
      return { und, params };
    },
  };
}

/** Der echte D-Repo-Pfad bleibt maßgeblich: kein künstliches PG-gilt und kein Memory-SQL-Ersatz. */
function folgeBedingung(
  lauf: NotizSchreibbedingung,
  weitere: readonly NotizSchreibbedingung[],
): NotizSchreibbedingung {
  return {
    ...(lauf.gilt
      ? { gilt: () => lauf.gilt?.() === true && weitere.every((b) => !b.gilt || b.gilt()) }
      : {}),
    ...(lauf.sql
      ? {
          sql: (start: number) => {
            const b = gemeinsam([lauf, ...weitere]).sql?.(start);
            if (!b?.und.length)
              throw new NormereignisFehler(409, "Echter D-Norm-SQL-Schreibschutz fehlt.");
            return b;
          },
        }
      : {}),
  };
}

/** Auch gespeicherte Anleitungsreferenzen sind beim heutigen Lesen geschützte Herkunft. */
function normQuellen(n: Normgeschichte) {
  const quellen = new Map<string, NormBeleg["quelle"]>(
    n.ereignisse.flatMap((e) =>
      e.belege.map((b) => [`${b.quelle.art}:${b.quelle.id}`, b.quelle] as const),
    ),
  );
  for (const e of n.ereignisse)
    for (const a of e.pruefeingang?.abhaengigkeiten ?? [])
      quellen.set(`wissensobjekt:${a.koId}`, {
        art: "wissensobjekt",
        id: a.koId,
        fassung: String(a.fassung),
        belegId: `ko:${a.koId}`,
      });
  return quellen;
}

const geltungsSchluessel = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de");

/**
 * Die bestehenden ausgewählten KO-Leser und dieselbe Fristen-CAS/Backupablage.
 * Beobachten wird nur durch den ausdrücklich bestellten vorhandenen Routinenlauf aufgerufen.
 * Kein URL-Abruf, Anhangsleser, Modell, eigener Zeitgeber oder Eingriff in eine gültige Anleitung.
 */
export class KlaraNormereignisDienst {
  private readonly jetzt: () => number;
  constructor(private readonly deps: NormDienstDeps) {
    this.jetzt = deps.jetzt ?? Date.now;
  }

  private async lesungen(kontoId: string, ids: readonly string[]) {
    const user = await this.deps.quellen.nutzer(kontoId);
    if (!user || ids.length < 1 || ids.length > 20 || new Set(ids).size !== ids.length)
      throw new FristenFehler(404, "Aktueller persönlicher Normauftrag nicht verfügbar.");
    const gelesen: GeleseneFristenQuelle[] = [];
    for (const id of ids) {
      const q = await this.deps.quellen.lies(user, "wissensobjekt", id);
      if (!q)
        throw new FristenFehler(404, "Eine beauftragte Bekanntmachungsquelle ist nicht lesbar.");
      gelesen.push(q);
    }
    return { user, gelesen };
  }

  private auswerten(alt: readonly Normgeschichte[], gelesen: readonly GeleseneFristenQuelle[]) {
    let geschichten = alt;
    const ungeprueft: NormVorbereitung["ungeprueft"][number][] = [];
    const aktuelleIds = new Set<string>();
    const am = new Date(this.jetzt()).toISOString();
    for (const q of gelesen) {
      const r = erkenneNormBekanntmachung(q.quelle, true, am);
      geschichten = vereinigeNormgeschichten(normQuellstand(geschichten, q.quelle), r.geschichten);
      for (const n of r.geschichten) for (const e of n.ereignisse) aktuelleIds.add(e.id);
      for (const hinweis of r.ungeprueft) ungeprueft.push({ quelleId: q.quelle.id, hinweis });
    }
    if (
      geschichten.reduce(
        (sum, n) => sum + n.ereignisse.reduce((s, e) => s + e.belege.length, 0),
        0,
      ) > FRISTEN_GRENZEN.fristen
    )
      throw new FristenFehler(
        409,
        "Die bestehende Fristenablage ist für weitere Normereignisbelege voll.",
      );
    return {
      geschichten,
      ungeprueft,
      aktuelleIds,
      quellIds: new Set(gelesen.map((q) => q.quelle.id)),
    };
  }

  private async vorbereiten(
    user: SessionUser,
    auswertung: ReturnType<KlaraNormereignisDienst["auswerten"]>,
  ): Promise<NormVorbereitung> {
    const bestand = await this.deps.ko.list({});
    const ereignisse: NormVorbereitung["ereignisse"][number][] = [];
    const ungeprueft = [...auswertung.ungeprueft];
    const unlesbar = () => {
      const hinweis = "Normgeschichte mit den heutigen Quellenrechten nicht vollständig prüfbar.";
      for (const quelleId of auswertung.quellIds)
        if (!ungeprueft.some((q) => q.quelleId === quelleId && q.hinweis === hinweis))
          ungeprueft.push({ quelleId, hinweis });
    };
    for (const n of auswertung.geschichten) {
      if (!n.ereignisse.some((e) => auswertung.aktuelleIds.has(e.id))) continue;
      // Auch Vorschau und Erfassungsantwort enthalten alte Belege. Eine lesbare Kopie
      // erteilt kein heutiges Leserecht für andere historische Quellen derselben Geschichte.
      const quellen = normQuellen(n);
      const gelesen: GeleseneFristenQuelle[] = [];
      let sichtbar = true;
      for (const q of quellen.values()) {
        const l = await this.deps.quellen.lies(user, q.art, q.id);
        if (!l) {
          sichtbar = false;
          break;
        }
        gelesen.push(l);
      }
      if (!sichtbar) {
        unlesbar();
        continue;
      }
      // Nur die ausdrücklich gespeicherte kanonische Zuordnung „Norm N-17“ belegt diesen Bezug.
      const referenz = normalizeAsset(`Norm ${n.kennung}`);
      const betroffen: NormBetroffenheit[] = [];
      for (const ko of bestand) {
        if (auswertung.quellIds.has(ko.id) || !referenz || !anlagenVon(ko).includes(referenz))
          continue;
        const q = await this.deps.quellen.lies(user, "wissensobjekt", ko.id);
        const aktuell = q ? await this.deps.ko.get(ko.id) : null;
        if (
          !q ||
          !aktuell ||
          String(aktuell.version) !== q.quelle.fassung ||
          !anlagenVon(aktuell).includes(referenz)
        )
          continue;
        betroffen.push({
          koId: aktuell.id,
          titel: aktuell.title,
          fassung: aktuell.version,
          grund: { art: "gespeicherte_normzuordnung", referenz },
        });
        gelesen.push(q);
      }
      if (!(await Promise.all(gelesen.map((q) => q.nochAktuell()))).every(Boolean)) {
        unlesbar();
        continue;
      }
      for (const e of n.ereignisse)
        if (auswertung.aktuelleIds.has(e.id))
          ereignisse.push({
            normId: n.id,
            kennung: n.kennung,
            ausgabe: n.ausgabe,
            ereignis: e,
            klaerung: normKlaerung(n),
            betroffen,
          });
    }
    return { ereignisse, ungeprueft };
  }

  /** Dieselben aktuellen Quellen, aber weder Normbeleg noch Prüfaufgabe gespeichert. */
  async vorschau(kontoId: string, ids: readonly string[]): Promise<NormVorbereitung> {
    const { user, gelesen } = await this.lesungen(kontoId, ids);
    const alt = await this.deps.repo.hole(kontoId);
    return this.vorbereiten(user, this.auswerten(alt?.normereignisse ?? [], gelesen));
  }

  /** Auftrags-/Laufbedingung gehört im selben CAS zu den heute gelesenen Quellen. */
  async beobachten(
    kontoId: string,
    ids: readonly string[],
    lauf: NotizSchreibbedingung,
    folge?: NormFolgeversuch,
  ): Promise<NormVorbereitung> {
    for (let versuch = 0; versuch < 3; versuch++) {
      const { user, gelesen } = await this.lesungen(kontoId, ids);
      const alt: FristenStand = (await this.deps.repo.hole(kontoId)) ?? {
        kontoId,
        fassung: 0,
        regel: null,
        fristen: [],
      };
      const r = this.auswerten(alt.normereignisse ?? [], gelesen);
      if (
        !(await Promise.all(gelesen.map((q) => q.nochAktuell()))).every(Boolean) ||
        lauf.gilt?.() === false
      )
        continue;
      if (
        isDeepStrictEqual(alt.normereignisse ?? [], r.geschichten) ||
        (await this.deps.repo.speichere(
          { ...alt, fassung: alt.fassung + 1, normereignisse: r.geschichten },
          alt.fassung,
          gemeinsam([lauf, ...gelesen.map((q) => q.bedingung)]),
        ))
      ) {
        const v = await this.vorbereiten(user, r);
        if (folge) v.folgepruefung = await this.folgepruefen(kontoId, ids, lauf, folge, v);
        return v;
      }
    }
    throw new FristenFehler(
      409,
      "Normauftrag, Quellen oder Fristenbestand haben sich inzwischen geändert.",
    );
  }

  /** Jeder heutige Originalbeleg und gespeicherte Anleitungsbezug bleibt im tatsächlichen Schreibschutz. */
  private async folgeStand(
    kontoId: string,
    ids: readonly string[],
    normId: string,
    ereignisId: string,
    abhaengigkeiten: readonly { koId: string; fassung: number }[],
  ) {
    const { user, gelesen } = await this.lesungen(kontoId, ids);
    const s = await this.deps.repo.hole(kontoId);
    const n = s?.normereignisse?.find((n) => n.id === normId);
    const e = n?.ereignisse.find((e) => e.id === ereignisId);
    if (!s || !n || !e) throw new NormereignisFehler(404, "Eigener Normvorgang fehlt.");
    const bekannt = new Set(gelesen.map((q) => `${q.quelle.art}:${q.quelle.id}`));
    for (const b of n.ereignisse.flatMap((e) => e.belege)) {
      const key = `${b.quelle.art}:${b.quelle.id}`;
      if (bekannt.has(key)) continue;
      const q = await this.deps.quellen.lies(user, b.quelle.art, b.quelle.id);
      if (!q)
        throw new NormereignisFehler(404, "Historischer Normbeleg ist heute nicht mehr lesbar.");
      bekannt.add(key);
      gelesen.push(q);
    }
    if (
      !isDeepStrictEqual(n, this.auswerten([n], gelesen).geschichten[0]) ||
      !e.belege.some((b) => b.aktuell && ids.includes(b.quelle.id))
    )
      throw new NormereignisFehler(
        409,
        "Aktuelle Normquellen sind noch nicht vollständig im Ereignisstand berücksichtigt.",
      );
    const bedingungen = gelesen.map((q) => q.bedingung);
    const referenz = normalizeAsset(`Norm ${n.kennung}`);
    for (const ziel of abhaengigkeiten) {
      const q = await this.deps.quellen.lies(user, "wissensobjekt", ziel.koId);
      const ko = q ? await this.deps.ko.get(ziel.koId) : null;
      if (
        !q ||
        !ko ||
        ko.version !== ziel.fassung ||
        q.quelle.fassung !== String(ziel.fassung) ||
        !referenz ||
        !anlagenVon(ko).includes(referenz)
      )
        throw new NormereignisFehler(
          409,
          "Belegte Anleitungsfassung, Normzuordnung oder heutige Leseberechtigung wurde geändert.",
        );
      gelesen.push(q);
      bedingungen.push(q.bedingung, {
        sql: (start) => ({
          und: [
            `EXISTS(SELECT 1 FROM kos WHERE id=$${start}::text AND data=$${start + 1}::jsonb FOR SHARE)`,
          ],
          params: [ko.id, JSON.stringify(ko)],
        }),
      });
    }
    if (!(await Promise.all(gelesen.map((q) => q.nochAktuell()))).every(Boolean))
      throw new NormereignisFehler(
        409,
        "Quellenrechte oder Fassungen wurden während der Normvorbereitung geändert.",
      );
    return { s, n, e, user, bedingungen };
  }

  private async folgepruefen(
    kontoId: string,
    ids: readonly string[],
    lauf: NotizSchreibbedingung,
    versuch: NormFolgeversuch,
    v: NormVorbereitung,
  ): Promise<NonNullable<NormVorbereitung["folgepruefung"]>> {
    const port = this.deps.normPruefauftrag?.();
    const notizen = this.deps.pruefNotizen;
    if (!port || !notizen) return { stand: "nicht_verfuegbar" };
    await versuch.pruefeAktuell();
    let offen = v.ungeprueft.length > 0 || v.ereignisse.length === 0;
    for (const kandidat of v.ereignisse) {
      const bezug = await this.pruefbezug(kontoId, kandidat.normId, kandidat.ereignis.id);
      if (bezug.e.pruefauftrag && !bezug.e.pruefeingang) continue;
      if (
        !bezug.e.datum ||
        !bezug.e.geltung ||
        !bezug.e.belege.some((b) => b.aktuell && !b.widerspruch && b.klaerung.length === 0) ||
        kandidat.betroffen.length > 20
      ) {
        offen = true;
        continue;
      }
      const abhaengigkeiten =
        bezug.e.pruefeingang?.abhaengigkeiten ??
        kandidat.betroffen.map((b) => ({ koId: b.koId, fassung: b.fassung }));
      let eingabe = bezug.e.pruefeingang?.eingabe;
      let entwurf: Omit<KlaraDNormAuftragsEingabe, "gespraechId">;
      if (!eingabe) {
        const grund = await this.folgeStand(kontoId, ids, bezug.n.id, bezug.e.id, abhaengigkeiten);
        const titel = `Normprüfung ${bezug.n.kennung} v${bezug.n.ausgabe} · ${bezug.e.art}`.slice(
          0,
          120,
        );
        const art = {
          angekuendigt: "Ankündigung",
          veroeffentlicht: "Veröffentlichung",
          inkrafttreten: "Inkrafttreten",
          uebergangsfrist: "Übergangsfrist",
        }[bezug.e.art];
        const kopierteBelege = bezug.e.belege.filter((b) => b.aktuell).slice(0, 1);
        const belegQuellen = kopierteBelege.map((b) => {
          const fassung = Number(b.quelle.fassung);
          if (b.quelle.art !== "wissensobjekt" || !Number.isSafeInteger(fassung) || fassung < 1)
            throw new NormereignisFehler(409, "Die kopierte Normquellfassung ist nicht gebunden.");
          return { id: b.quelle.id, fassung };
        });
        const inhalt = [
          "Automatisch vorbereitete persönliche Normprüfung aus dem ausdrücklich bestellten Quellenwatch.",
          `Norm ${bezug.n.kennung} v${bezug.n.ausgabe}: ${art} am ${bezug.e.datum}; Geltung: ${bezug.e.geltung}.`,
          "Bekanntmachung und Kalenderdatum sind keine fachliche Annahme einer Anleitung.",
          ...kopierteBelege.map(
            (b) =>
              `Begrenzter Originalbeleg (${b.quelle.id}, Fassung ${b.quelle.fassung}):\n${b.norm.wortlaut}\n${b.ereignis.wortlaut}\n${b.geltung?.wortlaut ?? ""}`,
          ),
          ...kandidat.betroffen.map(
            (b) =>
              `Gespeicherte Normzuordnung: ${b.titel.slice(0, 200)} (KO ${b.koId}, Fassung ${b.fassung}).`,
          ),
        ].join("\n");
        // Dieselbe persistierte F08-Herkunft schützt die Kopie auch NACH der Schreibwirkung:
        // normale Notiz-/Aufgabenleser und weitere Übernahmen prüfen die heutigen Originalrechte.
        const herkunft: KlaraWissensHerkunft = {
          projekt: "Persönliche Normprüfung",
          abschnitt: `${bezug.n.kennung} v${bezug.n.ausgabe} · ${bezug.e.art}`,
          antwortFassung: bezug.e.pruefVorgang,
          anbieter: null,
          modell: null,
          vorherigeNotiz: null,
          textAbdruck: createHash("sha256").update(inhalt).digest("hex"),
          aussagen: [
            {
              text: inhalt,
              art: "empfehlung",
              quellen: [
                ...belegQuellen,
                ...kandidat.betroffen.map((b) => ({ id: b.koId, fassung: b.fassung })),
              ],
            },
          ],
        };
        await versuch.pruefeAktuell();
        const notiz = (
          await notizen.lege(
            kontoId,
            {
              vorgang: bezug.e.pruefVorgang,
              art: "notiz",
              weg: "geschrieben",
              titel,
              inhalt,
              objektbezug: {
                pfad: "/kalender#normereignisse",
                seitenName: "Mein Kalender",
                objekt: titel,
              },
            },
            folgeBedingung(lauf, grund.bedingungen),
            herkunft,
          )
        ).notiz;
        if (
          notiz.titel !== titel ||
          notiz.inhalt !== inhalt ||
          !isDeepStrictEqual(notiz.wissensHerkunft, herkunft)
        )
          throw new NormereignisFehler(
            409,
            "Die eigene ursprüngliche Prüfungsnotiz wurde geändert; kein Ersatzoriginal.",
          );
        entwurf = {
          kontoId,
          erinnerungId: versuch.erinnerungId,
          erinnerungFassung: versuch.erinnerungFassung,
          routineFassung: versuch.routineFassung,
          normId: bezug.n.id,
          ereignisId: bezug.e.id,
          pruefVorgang: bezug.e.pruefVorgang,
          notiz: { id: notiz.id, fassung: notiz.fassung },
          titel,
        };
      } else {
        const { gespraechId: _g, ...rest } = eingabe;
        entwurf = rest;
      }
      let frisch: NotizSchreibbedingung | null = null;
      let ersteAnlage = false;
      const pruefe = async (p: KlaraDNormAuftragsPruefung): Promise<void> => {
        const { gespraechId: _g, ...ohneGespraech } = p.eingabe;
        if (
          !isDeepStrictEqual(ohneGespraech, entwurf) ||
          (eingabe && !isDeepStrictEqual(p.eingabe, eingabe)) ||
          !p.abdruck ||
          p.abdruck.length > 200
        )
          throw new NormereignisFehler(
            409,
            "G-Eingabe oder Inhaltsbindung stimmt nicht mit dem Original überein.",
          );
        const { s, n, e, user, bedingungen } = await this.folgeStand(
          kontoId,
          ids,
          entwurf.normId,
          entwurf.ereignisId,
          abhaengigkeiten,
        );
        const notiz = await this.deps.quellen.lies(user, "notiz", p.eingabe.notiz.id);
        if (!notiz || notiz.quelle.fassung !== String(p.eingabe.notiz.fassung))
          throw new NormereignisFehler(
            404,
            "Eigene gebundene Prüfungsnotiz fehlt oder wurde geändert.",
          );
        if (
          e.pruefeingang &&
          (!isDeepStrictEqual(e.pruefeingang.eingabe, p.eingabe) ||
            e.pruefeingang.abdruck !== p.abdruck ||
            !isDeepStrictEqual(e.pruefeingang.abhaengigkeiten, abhaengigkeiten))
        )
          throw new NormereignisFehler(
            409,
            "Der kanonische Normeingang oder sein Inhalt wurde geändert.",
          );
        if (e.pruefauftrag && (!p.original || p.original.id !== e.pruefauftrag.auftragId))
          throw new NormereignisFehler(409, "Das gebundene G-Original fehlt; kein Ersatzauftrag.");
        let guardFassung = s.fassung;
        if (p.phase !== "lesen") {
          await versuch.pruefeAktuell();
          if (p.eingabe.erinnerungId !== versuch.erinnerungId)
            throw new NormereignisFehler(
              409,
              "Ein anderer Auftrag hat dieses Original bereits bestellt; keine zweite Aufgabe.",
            );
          if (p.phase === "anlegen" && !p.original && e.pruefeingang && !ersteAnlage)
            throw new NormereignisFehler(
              409,
              "Früherer Anlageausgang unklar; nur das Original nachlesen.",
            );
          if (p.phase === "wirken" && (!e.pruefeingang || !p.original))
            throw new NormereignisFehler(409, "Aktuelle kanonische Originalbindung fehlt.");
          if (p.phase === "anlegen" && !e.pruefeingang) {
            const normereignisse = (s.normereignisse ?? []).map((x) =>
              x.id === n.id
                ? {
                    ...x,
                    ereignisse: x.ereignisse.map((x) =>
                      x.id === e.id
                        ? {
                            ...x,
                            pruefeingang: {
                              eingabe: p.eingabe,
                              abdruck: p.abdruck,
                              abhaengigkeiten,
                            },
                          }
                        : x,
                    ),
                  }
                : x,
            );
            if (
              !(await this.deps.repo.speichere(
                { ...s, fassung: s.fassung + 1, normereignisse },
                s.fassung,
                folgeBedingung(lauf, [notiz.bedingung, ...bedingungen]),
              ))
            )
              throw new NormereignisFehler(
                409,
                "Der ursprüngliche Normeingang wurde gleichzeitig beansprucht.",
              );
            ersteAnlage = true;
            eingabe = p.eingabe;
            guardFassung = s.fassung + 1;
          }
        }
        const guard: NotizSchreibbedingung = {
          sql: (start) => ({
            und: [
              `EXISTS(SELECT 1 FROM klara_fristen WHERE konto_id=$${start}::text AND fassung=$${start + 1}::int AND data->'normereignisse' @> $${start + 2}::jsonb FOR SHARE)`,
            ],
            params: [
              kontoId,
              guardFassung,
              JSON.stringify([
                {
                  id: entwurf.normId,
                  ereignisse: [
                    {
                      id: entwurf.ereignisId,
                      pruefeingang: { eingabe: p.eingabe, abdruck: p.abdruck, abhaengigkeiten },
                    },
                  ],
                },
              ]),
            ],
          }),
        };
        frisch = folgeBedingung(lauf, [guard, notiz.bedingung, ...bedingungen]);
      };
      const kontext = {
        vorkommenId: versuch.vorkommenId,
        besitzer: versuch.besitzer,
        pruefe,
        bedingung: {
          ...(lauf.gilt ? { gilt: () => frisch?.gilt?.() === true } : {}),
          ...(lauf.sql
            ? {
                sql: (start: number) => {
                  if (!frisch?.sql)
                    throw new NormereignisFehler(409, "Aktueller Norm-SQL-Schreibschutz fehlt.");
                  return frisch.sql(start);
                },
              }
            : {}),
        },
      };
      // Diese einzige G-Setupnaht beansprucht ihren echten kanonischen Eingang vor der Anlage.
      const fest = eingabe ?? (await port.eingang(entwurf, kontext));
      if (!isDeepStrictEqual(fest, eingabe))
        throw new NormereignisFehler(409, "G-Eingang wurde nicht im Norm-CAS bestätigt.");
      const alt = await port.original(fest, kontext);
      const antwort =
        alt &&
        (alt.auftrag.stand === "abgebrochen" ||
          alt.auftrag.stand === "abgeschlossen" ||
          fest.erinnerungId !== versuch.erinnerungId)
          ? alt
          : await port.ausfuehren(fest, kontext);
      if (
        antwort.referenz.gespraechId !== fest.gespraechId ||
        antwort.auftrag.id !== antwort.referenz.auftragId ||
        antwort.referenz.nr !== 1 ||
        !antwort.auftrag.schritte.some(
          (s) => s.nr === 1 && s.schluessel === antwort.referenz.schluessel,
        )
      )
        throw new NormereignisFehler(409, "G hat kein passendes Original bestätigt.");
      for (let anlauf = 0; anlauf < 3; anlauf++) {
        const s = await this.deps.repo.hole(kontoId);
        const n = s?.normereignisse?.find((n) => n.id === fest.normId);
        const e = n?.ereignisse.find((e) => e.id === fest.ereignisId);
        if (!s || !n || !e?.pruefeingang || !isDeepStrictEqual(e.pruefeingang.eingabe, fest))
          throw new NormereignisFehler(
            409,
            "Der kanonische Vorgang wurde nach G-Readback geändert.",
          );
        if (e.pruefauftrag) {
          if (!isDeepStrictEqual(e.pruefauftrag, antwort.referenz))
            throw new NormereignisFehler(409, "Abweichende Originalreferenz.");
          break;
        }
        const normereignisse = (s.normereignisse ?? []).map((x) =>
          x.id === n.id
            ? {
                ...x,
                ereignisse: x.ereignisse.map((x) =>
                  x.id === e.id ? { ...x, pruefauftrag: antwort.referenz } : x,
                ),
              }
            : x,
        );
        if (
          await this.deps.repo.speichere(
            { ...s, fassung: s.fassung + 1, normereignisse },
            s.fassung,
            lauf,
          )
        )
          break;
        if (anlauf === 2)
          throw new NormereignisFehler(
            409,
            "G-Original vorhanden, D-Referenz noch unklar. Nur nachlesen.",
          );
      }
    }
    return { stand: offen ? "klaerung_noetig" : "am_original" };
  }

  /** Historische Auszüge bleiben hinter heutigen Quellenrechten; GET verändert keine Fassung. */
  async sicht(kontoId: string): Promise<readonly Normgeschichte[]> {
    return (await this.stand(kontoId)).normen;
  }

  private async pruefbezug(kontoId: string, normId: string, ereignisId: string) {
    const user = await this.deps.quellen.nutzer(kontoId);
    const n = user ? (await this.sicht(kontoId)).find((n) => n.id === normId) : null;
    const e = n?.ereignisse.find((e) => e.id === ereignisId);
    if (!user || !n || !e) throw new NormereignisFehler(404, "Normereignis nicht gefunden.");
    return { user, n, e };
  }

  private async pruefplan(user: SessionUser, e: NormEreignis, a: KlaraAuftrag) {
    const p = a.plan?.[0];
    if (
      a.verantwortlich !== user.id ||
      a.plan?.length !== 1 ||
      p?.aktion !== "persoenliche_aufgabe_anlegen" ||
      !p.notizQuelle ||
      !a.erlaubteQuellen.includes(`notiz:${p.notizQuelle.id}`)
    )
      return null;
    const q = await this.deps.quellen.lies(user, "notiz", p.notizQuelle.id);
    if (
      !q ||
      q.quelle.fassung !== String(p.notizQuelle.fassung) ||
      !e.belege.some((b) => b.aktuell) ||
      !q.quelle.text
        .split(/\r?\n/)
        .some((zeile) =>
          erkenneNormBekanntmachung(
            { ...q.quelle, text: zeile },
            true,
            e.zuerstGelesenAm,
          ).geschichten.some((n) => n.ereignisse.some((beleg) => beleg.id === e.id)),
        )
    )
      return null;
    return q;
  }

  /** Echte eigene bereits beauftragte Notizpläne; Lesen bestellt und erzeugt nichts. */
  async pruefauftraege(kontoId: string, normId: string, ereignisId: string) {
    const { user, e } = await this.pruefbezug(kontoId, normId, ereignisId);
    const g = e.pruefauftrag
      ? await this.deps.gespraeche.hole(kontoId, e.pruefauftrag.gespraechId)
      : e.pruefeingang
        ? await this.deps.gespraeche.hole(kontoId, e.pruefeingang.eingabe.gespraechId)
        : await this.deps.gespraeche.aktuelles(kontoId);
    const auftraege = [];
    for (const a of g?.auftraege ?? []) {
      if (e.pruefeingang && !e.pruefauftrag) continue;
      if (e.pruefauftrag && a.id !== e.pruefauftrag.auftragId) continue;
      const q = await this.pruefplan(user, e, a);
      // Ein gebundener Auftrag wird nach Quellenänderung nicht durch einen anderen ersetzt.
      if (!q && !e.pruefauftrag) continue;
      const schritt = a.schritte.find((s) => s.nr === 1);
      const original =
        schritt?.ergebnis?.art === "persoenliche_aufgabe"
          ? await this.deps.aufgaben.hole(kontoId, schritt.ergebnis.id)
          : null;
      auftraege.push({
        gespraechId: g?.id ?? "",
        auftragId: a.id,
        nr: 1 as const,
        schluessel: e.pruefauftrag?.schluessel ?? schritt?.schluessel ?? e.pruefVorgang,
        titel: a.ziel,
        fassung: a.fassung,
        stand: a.stand,
        quelleAktuell: q !== null,
        ergebnisVorhanden: schritt?.ergebnis ? original !== null : null,
        // Der Nachweis bleibt im tatsächlichen G-Journal. Keine Kopie des operativen Zustands.
        schritt: schritt
          ? {
              stand: schritt.stand,
              ausgangUnklar: schritt.ausgangUnklar ?? false,
              ergebnis: schritt.ergebnis,
            }
          : null,
      });
    }
    return {
      gebunden: e.pruefauftrag ?? null,
      auftraege,
      ...(e.pruefeingang ? { automatisch: true } : {}),
    };
  }

  /** Bindet ausschließlich die gewählte bestehende Originalreferenz; führt keine Aktion aus. */
  async verknuepfePruefauftrag(kontoId: string, normId: string, ereignisId: string, roh: unknown) {
    const { user, e } = await this.pruefbezug(kontoId, normId, ereignisId);
    const r =
      roh && typeof roh === "object" && !Array.isArray(roh) ? (roh as Record<string, unknown>) : {};
    if (
      Object.keys(r).some(
        (k) => !["fassung", "gespraechId", "auftragId", "bestaetigt"].includes(k),
      ) ||
      !Number.isSafeInteger(r.fassung) ||
      r.bestaetigt !== true ||
      typeof r.gespraechId !== "string" ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(r.gespraechId) ||
      typeof r.auftragId !== "string" ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(r.auftragId)
    )
      throw new NormereignisFehler(
        400,
        "Den vorhandenen eigenen Notizauftrag ausdrücklich wählen.",
      );
    if (e.pruefauftrag) {
      if (e.pruefauftrag.gespraechId === r.gespraechId && e.pruefauftrag.auftragId === r.auftragId)
        return { pruefauftrag: e.pruefauftrag, wiederholt: true };
      throw new NormereignisFehler(
        409,
        "Dieses Ereignis hat bereits seinen Originalprüfauftrag. Keine zweite Aufgabe anlegen.",
      );
    }
    if (e.pruefeingang)
      throw new NormereignisFehler(
        409,
        "Dieser bestellte Prüfauftrag hat seinen kanonischen Eingang. Nur das Original nachlesen, keinen anderen Auftrag binden.",
      );
    const s = await this.deps.repo.hole(kontoId);
    if (!s || s.fassung !== r.fassung)
      throw new NormereignisFehler(409, "Normgeschichte wurde inzwischen geändert.");
    const g = await this.deps.gespraeche.hole(kontoId, r.gespraechId);
    const a = g?.auftraege?.find((a) => a.id === r.auftragId);
    const q = a ? await this.pruefplan(user, e, a) : null;
    if (!g || !a || !q)
      throw new NormereignisFehler(404, "Passender eigener Originalnotizauftrag nicht gefunden.");
    const gelesen = [q];
    for (const b of e.belege.filter((b) => b.aktuell)) {
      const quelle = await this.deps.quellen.lies(user, b.quelle.art, b.quelle.id);
      if (!quelle || quelle.quelle.fassung !== b.quelle.fassung)
        throw new NormereignisFehler(409, "Bekanntmachungsquelle wurde inzwischen geändert.");
      gelesen.push(quelle);
    }
    if (!(await Promise.all(gelesen.map((q) => q.nochAktuell()))).every(Boolean))
      throw new NormereignisFehler(409, "Quellen wurden inzwischen geändert.");
    const pruefauftrag: NormPruefauftragRef = {
      gespraechId: g.id,
      auftragId: a.id,
      nr: 1,
      schluessel: a.schritte.find((s) => s.nr === 1)?.schluessel ?? e.pruefVorgang,
    };
    const normereignisse = (s.normereignisse ?? []).map((n) =>
      n.id !== normId
        ? n
        : {
            ...n,
            ereignisse: n.ereignisse.map((x) => (x.id === e.id ? { ...x, pruefauftrag } : x)),
          },
    );
    if (
      !(await this.deps.repo.speichere(
        { ...s, fassung: s.fassung + 1, normereignisse },
        s.fassung,
        gemeinsam([
          ...gelesen.map((q) => q.bedingung),
          {
            sql: (start) => ({
              und: [
                `EXISTS(SELECT 1 FROM klara_gespraeche WHERE id=$${start}::text AND konto_id=$${start + 1}::text AND data=$${start + 2}::jsonb FOR SHARE)`,
              ],
              params: [g.id, kontoId, JSON.stringify(g)],
            }),
          },
        ]),
      ))
    )
      throw new NormereignisFehler(
        409,
        "Auftrag oder Quelle wurde inzwischen geändert. Keine Verknüpfung gespeichert.",
      );
    return { pruefauftrag, wiederholt: false };
  }

  async stand(kontoId: string): Promise<{
    fassung: number;
    normen: readonly (Normgeschichte & {
      widerspruch: boolean;
      annahmeUngeprueft: boolean;
      konfliktarten: readonly (typeof NORM_EREIGNISARTEN)[number][];
      klaerungAktuell: string | null;
    })[];
    fachannahmeErlaubt: boolean;
  }> {
    const user = await this.deps.quellen.nutzer(kontoId);
    if (!user) return { fassung: 0, normen: [], fachannahmeErlaubt: false };
    const s = await this.deps.repo.hole(kontoId);
    const lesbar: (Normgeschichte & { annahmeUngeprueft: boolean })[] = [];
    for (const n of s?.normereignisse ?? []) {
      const quellen = normQuellen(n);
      let aktuell: readonly Normgeschichte[] = [n];
      let sichtbar = quellen.size > 0;
      for (const q of quellen.values()) {
        const gelesen = await this.deps.quellen.lies(user, q.art, q.id);
        if (!gelesen) {
          sichtbar = false;
          break;
        }
        aktuell = normQuellstand(aktuell, gelesen.quelle);
      }
      if (sichtbar && aktuell[0]) {
        const annahmen: NormAbloesung[] = [];
        let annahmeUngeprueft = false;
        for (const annahme of aktuell[0].annahmen) {
          const bisher = await this.deps.quellen.lies(user, "wissensobjekt", annahme.bisher.koId);
          const nachfolger = await this.deps.quellen.lies(
            user,
            "wissensobjekt",
            annahme.nachfolger.koId,
          );
          if (bisher && nachfolger) annahmen.push(annahme);
          else annahmeUngeprueft = true;
        }
        lesbar.push({ ...aktuell[0], annahmen, annahmeUngeprueft });
      }
    }
    return {
      fassung: s?.fassung ?? 0,
      normen: lesbar.map((n) => ({
        ...n,
        widerspruch: normHatWiderspruch(n),
        konfliktarten: normKonfliktarten(n),
        klaerungAktuell: normAktuelleKonfliktklaerung(n)?.id ?? null,
      })),
      fachannahmeErlaubt: can(user.role, "ko.validate"),
    };
  }

  /** Metadaten belegter Anleitungsfassungen; kein Volltext und keine Freigabe durch diesen GET. */
  async fachoptionen(
    kontoId: string,
    normId: string,
  ): Promise<readonly { koId: string; titel: string; fassung: number; aktuell: boolean }[]> {
    const user = await this.deps.quellen.nutzer(kontoId);
    if (!user || !can(user.role, "ko.validate"))
      throw new NormereignisFehler(403, "Die fachliche Freigabeberechtigung fehlt.");
    const norm = (await this.sicht(kontoId)).find((n) => n.id === normId);
    if (!norm) throw new NormereignisFehler(404, "Normgeschichte nicht gefunden.");
    const referenz = normalizeAsset(`Norm ${norm.kennung}`);
    const optionen: { koId: string; titel: string; fassung: number; aktuell: boolean }[] = [];
    for (const k of await this.deps.ko.list({})) {
      if (
        !referenz ||
        !anlagenVon(k).includes(referenz) ||
        !(await this.deps.quellen.lies(user, "wissensobjekt", k.id))
      )
        continue;
      const aktuell = await this.deps.ko.get(k.id);
      if (!aktuell || !anlagenVon(aktuell).includes(referenz)) continue;
      const versionen = new Map(
        (await this.deps.ko.versionsOf(k.id)).map((v) => [v.version, v.snapshot]),
      );
      versionen.set(aktuell.version, aktuell);
      const belege = await this.deps.belege.list({ target: k.id });
      for (const v of versionen.values()) {
        const ref = v.annahmeRef?.koVersion === v.version ? v.annahmeRef : v.validationDecisionRef;
        const belegt = belege.some(
          (b) =>
            b.payload.koVersion === v.version &&
            (["ko.admin-validated", "ko.owner-validated", "ko.weisung-validated"].includes(
              b.action,
            ) ||
              (b.action === "ko.rated" && b.payload.verdict === "up")) &&
            (ref
              ? b.seq === ref.auditSeq && b.hash === ref.auditHash
              : v.version !== aktuell.version),
        );
        if (belegt && (v.version !== aktuell.version || aktuell.status === "validiert"))
          optionen.push({
            koId: k.id,
            titel: aktuell.title,
            fassung: v.version,
            aktuell: v.version === aktuell.version,
          });
      }
    }
    return optionen.sort((a, b) => a.titel.localeCompare(b.titel) || a.fassung - b.fassung);
  }

  /** Eine konkret belegte Anleitungsfassung lesen, auch nach einer späteren Überarbeitung. */
  async fachfassung(
    kontoId: string,
    normId: string,
    koId: string,
    fassung: number,
  ): Promise<{
    koId: string;
    fassung: number;
    titel: string;
    aussage: string;
    freigegebenAm: string;
  }> {
    const user = await this.deps.quellen.nutzer(kontoId);
    const norm = user ? (await this.sicht(kontoId)).find((n) => n.id === normId) : null;
    if (!user || !norm || !Number.isSafeInteger(fassung) || fassung < 1)
      throw new NormereignisFehler(404, "Belegte Anleitungsfassung nicht gefunden.");
    const bezug = norm.annahmen
      .flatMap((a) => [
        { ziel: a.bisher, beleg: a.fachfreigabe.bisher },
        { ziel: a.nachfolger, beleg: a.fachfreigabe.nachfolger },
      ])
      .find((a) => a.ziel.koId === koId && a.ziel.fassung === fassung);
    if (
      !bezug &&
      (!can(user.role, "ko.validate") ||
        !(await this.fachoptionen(kontoId, normId)).some(
          (o) => o.koId === koId && o.fassung === fassung,
        ))
    )
      throw new NormereignisFehler(404, "Belegte Anleitungsfassung nicht gefunden.");
    const q = await this.deps.quellen.lies(user, "wissensobjekt", koId);
    const ko = q ? await this.deps.ko.get(koId) : null;
    const konkret =
      ko?.version === fassung
        ? ko
        : ko
          ? (await this.deps.ko.versionsOf(koId)).find((v) => v.version === fassung)?.snapshot
          : null;
    if (!konkret) throw new NormereignisFehler(404, "Belegte Anleitungsfassung nicht gefunden.");
    const ref =
      bezug?.beleg ??
      (konkret.annahmeRef?.koVersion === fassung
        ? konkret.annahmeRef
        : konkret.validationDecisionRef);
    const beleg = (await this.deps.belege.list({ target: koId })).find(
      (b) =>
        b.payload.koVersion === fassung &&
        (["ko.admin-validated", "ko.owner-validated", "ko.weisung-validated"].includes(b.action) ||
          (b.action === "ko.rated" && b.payload.verdict === "up")) &&
        (!ref || (b.seq === ref.auditSeq && b.hash === ref.auditHash)),
    );
    if (!beleg) throw new NormereignisFehler(404, "Fachlicher Fassungsbeleg nicht gefunden.");
    return {
      koId,
      fassung,
      titel: konkret.title,
      aussage: konkret.statement,
      freigegebenAm: beleg.at,
    };
  }

  /** Eine begründete Auswahl zwischen echten Belegen, keine neue Bekanntmachung oder Fachannahme. */
  async klaereKonflikt(
    kontoId: string,
    normId: string,
    roh: unknown,
  ): Promise<{ fassung: number; klaerung: NormKonfliktklaerung; wiederholt: boolean }> {
    const user = await this.deps.quellen.nutzer(kontoId);
    if (!user || !can(user.role, "ko.validate"))
      throw new NormereignisFehler(403, "Die heutige fachliche Freigabeberechtigung fehlt.");
    if (!roh || typeof roh !== "object" || Array.isArray(roh))
      throw new NormereignisFehler(400, "Eine ausdrückliche Konfliktklärung ist erforderlich.");
    const r = roh as Record<string, unknown>;
    if (
      Object.keys(r).some(
        (k) => !["fassung", "auswahl", "begruendung", "bestaetigt"].includes(k),
      ) ||
      r.bestaetigt !== true ||
      !Number.isInteger(r.fassung) ||
      typeof r.begruendung !== "string" ||
      !r.begruendung.trim() ||
      r.begruendung.length > 2000 ||
      !Array.isArray(r.auswahl) ||
      r.auswahl.length < 1 ||
      r.auswahl.length > NORM_EREIGNISARTEN.length
    )
      throw new NormereignisFehler(
        400,
        "Vorhandene Ereignisbelege, Begründung und ausdrückliche Bestätigung wählen; Person und Zeitpunkt setzt der Server.",
      );
    const auswahl: NormKonfliktauswahl[] = r.auswahl
      .map((x: unknown) => {
        if (!x || typeof x !== "object" || Array.isArray(x))
          throw new NormereignisFehler(400, "Konkreter Ereignisbeleg fehlt.");
        const w = x as Record<string, unknown>;
        if (
          Object.keys(w).some((k) => k !== "art" && k !== "ereignisId") ||
          !NORM_EREIGNISARTEN.some((art) => art === w.art) ||
          typeof w.ereignisId !== "string" ||
          !/^ne-[a-f0-9]{64}$/.test(w.ereignisId)
        )
          throw new NormereignisFehler(
            400,
            "Nur vorhandene Ereigniskennungen wählen; kein Datum oder Geltungsbereich wird erfunden.",
          );
        return { art: w.art as NormKonfliktauswahl["art"], ereignisId: w.ereignisId };
      })
      .sort((a, b) => NORM_EREIGNISARTEN.indexOf(a.art) - NORM_EREIGNISARTEN.indexOf(b.art));
    const s = await this.deps.repo.hole(kontoId);
    const n = (await this.sicht(kontoId)).find((n) => n.id === normId);
    if (!s || !n) throw new NormereignisFehler(404, "Normgeschichte nicht gefunden.");
    if (!normKonfliktauswahlGueltig(n, auswahl))
      throw new NormereignisFehler(
        409,
        "Für jede widersprüchliche Ereignisart genau einen heute belegten eindeutigen Termin samt Geltung wählen. Fehlende Angaben brauchen zuerst einen neuen Beleg.",
      );
    const gelesen = await this.fachQuellen(user, n);
    const person = await this.deps.auth.kontoLesen(user.id);
    if (!person?.approved || person.role !== user.role || !can(person.role, "ko.validate"))
      throw new NormereignisFehler(
        403,
        "Die fachliche Freigabeberechtigung wurde inzwischen geändert.",
      );
    if (!(await Promise.all(gelesen.map((q) => q.nochAktuell()))).every(Boolean))
      throw new NormereignisFehler(
        409,
        "Belege wurden während der Konfliktklärung geändert. Bitte neu lesen.",
      );
    const aktuell = normAktuelleKonfliktklaerung(n);
    if (
      aktuell &&
      isDeepStrictEqual(aktuell.auswahl, auswahl) &&
      aktuell.begruendung === r.begruendung.trim()
    )
      return { fassung: s.fassung, klaerung: aktuell, wiederholt: true };
    if (s.fassung !== r.fassung)
      throw new NormereignisFehler(
        409,
        "Die Normgeschichte wurde inzwischen geändert. Bitte neu lesen.",
      );
    const klaerung = normKonfliktbeleg(n, {
      auswahl,
      begruendung: r.begruendung.trim(),
      entschiedenVon: user.id,
      entschiedenName: person.name,
      entschiedenAm: new Date(this.jetzt()).toISOString(),
    });
    const normereignisse =
      s.normereignisse?.map((alt) =>
        alt.id === n.id ? { ...alt, klaerungen: [...(alt.klaerungen ?? []), klaerung] } : alt,
      ) ?? [];
    if (
      !(await this.deps.repo.speichere(
        { ...s, fassung: s.fassung + 1, normereignisse },
        s.fassung,
        gemeinsam(gelesen.map((q) => q.bedingung)),
      ))
    )
      throw new NormereignisFehler(
        409,
        "Berechtigung, Belege oder Konfliktklärung wurden inzwischen geändert. Nichts geklärt.",
      );
    return { fassung: s.fassung + 1, klaerung, wiederholt: false };
  }

  private async fachQuellen(user: SessionUser, n: Normgeschichte) {
    const quellen = new Map(
      n.ereignisse.flatMap((e) =>
        e.belege.map((b) => [`${b.quelle.art}:${b.quelle.id}`, b.quelle] as const),
      ),
    );
    const gelesen: GeleseneFristenQuelle[] = [];
    for (const q of quellen.values()) {
      const l = await this.deps.quellen.lies(user, q.art, q.id);
      if (!l) throw new NormereignisFehler(404, "Normbeleg nicht mehr lesbar.");
      const neu = erkenneNormBekanntmachung(
        l.quelle,
        true,
        new Date(this.jetzt()).toISOString(),
      ).geschichten.find((x) => x.id === n.id);
      const aktuellBekannt = n.ereignisse
        .flatMap((e) =>
          e.belege
            .filter((b) => b.aktuell && b.quelle.art === q.art && b.quelle.id === q.id)
            .map((b) => `${e.id}:${b.id}`),
        )
        .sort();
      const aktuellGelesen =
        neu?.ereignisse.flatMap((e) => e.belege.map((b) => `${e.id}:${b.id}`)).sort() ?? [];
      if (!isDeepStrictEqual(aktuellBekannt, aktuellGelesen))
        throw new NormereignisFehler(
          409,
          "Der aktuelle Bekanntmachungsstand ist noch nicht in den Ereignisbelegen berücksichtigt. Bitte zuerst erneut prüfen.",
        );
      gelesen.push(l);
    }
    return gelesen;
  }

  /** Kalenderdatum oder Veröffentlichung erreichen diesen Fachweg nie. */
  async nehmeAbloesungAn(
    kontoId: string,
    normId: string,
    roh: unknown,
  ): Promise<{ fassung: number; annahme: NormAbloesung; wiederholt: boolean }> {
    const user = await this.deps.quellen.nutzer(kontoId);
    if (!user || !can(user.role, "ko.validate"))
      throw new NormereignisFehler(403, "Die heutige fachliche Freigabeberechtigung fehlt.");
    if (!roh || typeof roh !== "object" || Array.isArray(roh))
      throw new NormereignisFehler(400, "Eine ausdrückliche Fachentscheidung ist erforderlich.");
    const r = roh as Record<string, unknown>;
    if (
      Object.keys(r).some(
        (k) =>
          !["fassung", "bisher", "nachfolger", "geltung", "begruendung", "bestaetigt"].includes(k),
      ) ||
      r.bestaetigt !== true ||
      !Number.isInteger(r.fassung) ||
      typeof r.geltung !== "string" ||
      !r.geltung.trim() ||
      r.geltung.length > 200 ||
      typeof r.begruendung !== "string" ||
      !r.begruendung.trim() ||
      r.begruendung.length > 2000
    )
      throw new NormereignisFehler(
        400,
        "Konkrete Fassungen, Geltung, Begründung und ausdrückliche Fachannahme sind erforderlich; Person und Zeitpunkt setzt der Server.",
      );
    const ziel = (x: unknown): { koId: string; fassung: number } => {
      if (!x || typeof x !== "object" || Array.isArray(x))
        throw new NormereignisFehler(400, "Beide Anleitungsfassungen sind erforderlich.");
      const z = x as Record<string, unknown>;
      if (
        Object.keys(z).some((k) => k !== "koId" && k !== "fassung") ||
        typeof z.koId !== "string" ||
        !/^[A-Za-z0-9_-]{1,200}$/.test(z.koId) ||
        !Number.isInteger(z.fassung) ||
        Number(z.fassung) < 1
      )
        throw new NormereignisFehler(
          400,
          "Jede Anleitung braucht Originalkennung und konkrete Fassung.",
        );
      return { koId: z.koId, fassung: Number(z.fassung) };
    };
    const bisher = ziel(r.bisher);
    const nachfolger = ziel(r.nachfolger);
    if (bisher.koId === nachfolger.koId && bisher.fassung === nachfolger.fassung)
      throw new NormereignisFehler(
        400,
        "Nachfolger und bisherige Fassung müssen sich unterscheiden.",
      );
    const s = await this.deps.repo.hole(kontoId);
    const n = (await this.sicht(kontoId)).find((n) => n.id === normId);
    if (!s || !n) throw new NormereignisFehler(404, "Normgeschichte nicht gefunden.");
    const klaerung = normAktuelleKonfliktklaerung(n);
    const gewaehlteGeltung = geltungsSchluessel(r.geltung);
    const schon = n.annahmen.find(
      (a) =>
        isDeepStrictEqual(a.bisher, bisher) &&
        isDeepStrictEqual(a.nachfolger, nachfolger) &&
        geltungsSchluessel(a.geltung) === gewaehlteGeltung &&
        a.klaerungId === klaerung?.id,
    );
    if (schon) return { fassung: s.fassung, annahme: schon, wiederholt: true };
    if (s.fassung !== r.fassung)
      throw new NormereignisFehler(
        409,
        "Die Normgeschichte wurde inzwischen geändert. Bitte neu lesen.",
      );
    const aktuelle = normFachereignisse(n);
    const geltung = gewaehlteGeltung;
    if (
      !aktuelle.some((e) => e.geltung && geltungsSchluessel(e.geltung) === geltung) ||
      normHatWiderspruch(n)
    )
      throw new NormereignisFehler(
        409,
        "Ereignisgeltung oder widersprüchliche Termine sind zuerst fachlich zu klären.",
      );
    const gelesen = await this.fachQuellen(user, n);
    const schnappschuesse: NotizSchreibbedingung[] = [];
    const fachfreigaben: Partial<NormAbloesung["fachfreigabe"]> = {};
    const referenz = normalizeAsset(`Norm ${n.kennung}`);
    for (const [art, z] of [
      ["bisher", bisher],
      ["nachfolger", nachfolger],
    ] as const) {
      const q = await this.deps.quellen.lies(user, "wissensobjekt", z.koId);
      const ko = q ? await this.deps.ko.get(z.koId) : null;
      if (!q || !ko) throw new NormereignisFehler(404, "Anleitungsfassung nicht lesbar.");
      const historisch =
        art === "bisher" && ko.version !== z.fassung
          ? (await this.deps.ko.versionsOf(ko.id)).find((v) => v.version === z.fassung)?.snapshot
          : null;
      const konkret = historisch ?? ko;
      if (
        konkret.version !== z.fassung ||
        String(ko.version) !== q.quelle.fassung ||
        (art === "nachfolger" && ko.status !== "validiert") ||
        !referenz ||
        !anlagenVon(ko).includes(referenz)
      )
        throw new NormereignisFehler(
          409,
          "Die konkrete fachlich freigegebene Anleitungsfassung oder ihre gespeicherte Normzuordnung fehlt.",
        );
      gelesen.push(q);
      const ref =
        konkret.annahmeRef?.koVersion === z.fassung
          ? konkret.annahmeRef
          : konkret.validationDecisionRef;
      const freigabe = (await this.deps.belege.list({ target: ko.id })).find((b) => {
        const annahme =
          ["ko.admin-validated", "ko.owner-validated", "ko.weisung-validated"].includes(b.action) ||
          (b.action === "ko.rated" && b.payload.verdict === "up");
        return (
          annahme &&
          b.payload.koVersion === z.fassung &&
          (ref ? b.seq === ref.auditSeq && b.hash === ref.auditHash : art === "bisher")
        );
      });
      if (!freigabe)
        throw new NormereignisFehler(
          409,
          "Der tatsächliche fachliche Annahmebeleg genau dieser Anleitungsfassung fehlt.",
        );
      fachfreigaben[art] = {
        auditSeq: freigabe.seq,
        auditHash: freigabe.hash,
        koVersion: z.fassung,
      };
      schnappschuesse.push({
        sql: (start) => ({
          und: [
            `EXISTS(SELECT 1 FROM kos WHERE id=$${start}::text AND data=$${start + 1}::jsonb FOR SHARE)`,
          ],
          params: [ko.id, JSON.stringify(ko)],
        }),
      });
      if (historisch)
        schnappschuesse.push({
          sql: (start) => ({
            und: [
              `EXISTS(SELECT 1 FROM ko_versions WHERE ko_id=$${start}::text AND version=$${start + 1}::int AND snapshot=$${start + 2}::jsonb FOR SHARE)`,
            ],
            params: [ko.id, historisch.version, JSON.stringify(historisch)],
          }),
        });
    }
    const person = await this.deps.auth.kontoLesen(user.id);
    if (!person?.approved || person.role !== user.role || !can(person.role, "ko.validate"))
      throw new NormereignisFehler(
        403,
        "Die fachliche Freigabeberechtigung wurde inzwischen geändert.",
      );
    if (!(await Promise.all(gelesen.map((q) => q.nochAktuell()))).every(Boolean))
      throw new NormereignisFehler(
        409,
        "Beleg oder Anleitungsfassung hat sich während der Fachentscheidung geändert.",
      );
    if (!fachfreigaben.bisher || !fachfreigaben.nachfolger)
      throw new NormereignisFehler(409, "Die fachlichen Fassungsbelege sind nicht vollständig.");
    const entscheidung = normAbloesungsbeleg(n.id, {
      ...(klaerung ? { klaerungId: klaerung.id } : {}),
      bisher,
      nachfolger,
      fachfreigabe: { bisher: fachfreigaben.bisher, nachfolger: fachfreigaben.nachfolger },
      geltung: r.geltung.trim(),
      begruendung: r.begruendung.trim(),
      entschiedenVon: user.id,
      entschiedenName: person.name,
      entschiedenAm: new Date(this.jetzt()).toISOString(),
    });
    const normereignisse =
      s.normereignisse?.map((alt) =>
        alt.id === n.id ? { ...alt, annahmen: [...alt.annahmen, entscheidung] } : alt,
      ) ?? [];
    if (
      !(await this.deps.repo.speichere(
        { ...s, fassung: s.fassung + 1, normereignisse },
        s.fassung,
        gemeinsam([...gelesen.map((q) => q.bedingung), ...schnappschuesse]),
      ))
    )
      throw new NormereignisFehler(
        409,
        "Berechtigung, Belege oder Fachentscheidung wurden inzwischen geändert. Nichts angenommen.",
      );
    return { fassung: s.fassung + 1, annahme: entscheidung, wiederholt: false };
  }
}
