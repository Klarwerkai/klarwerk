// ================================================================================================
// AUFNAHME 20260922 · PAARPFLICHTEN-DAUERHAFT (G2/KW-DKP) — JEDE AUSSAGE-PAARPRÜFUNG ALS PFLICHT.
// ================================================================================================
//
// Vertrag: docs/entscheidungen/paarpflichten-dauerhaft.md. Der Istvertrag
// (docs/entscheidungen/wissenspruefung-istvertrag.md, Abschnitte 3 und 5) hält fest, dass kein Weg
// „jeder gegen jeden" prüft und ungeprüfte Paare nicht benennbar sind. Dieses Modul legt für eine
// gewählte Aussagemenge JEDES ungeordnete Paar als gespeicherte Pflicht an und arbeitet sie
// wiederaufnehmbar ab:
//
//   planen      — n Aussagen ergeben genau n·(n−1)/2 Pflichten. Kein Kandidatenlimit, keine
//                 Vorauswahl: ein Limit gibt es nur beim Abarbeiten, und dort bleibt der Rest offen.
//   abarbeiten  — beansprucht je Schritt EINE Pflicht mit Frist (Token), fragt den Prüfer und
//                 schließt nur mit passendem Token ab (Compare-and-Set). Ein Absturz hinterlässt
//                 höchstens eine beanspruchte Pflicht; nach Ablauf der Frist nimmt ein neuer Lauf sie
//                 wieder auf. Ein verspäteter Abschluss mit altem Token schreibt nichts (kein
//                 Doppelurteil).
//   bilanz      — geurteilt, unbestimmt, fehler und die offene Restmenge getrennt gezählt.
//
// ZUSTÄNDE einer Pflicht:
//   offen      — noch kein Urteil. Auch nach „kein_modell": ohne Modellaufruf gibt es kein Urteil.
//   in_arbeit  — beansprucht; nach Fristablauf wieder beanspruchbar.
//   geurteilt  — ein Modell hat fachlich geurteilt (Ergebnis + Modellbeleg gespeichert).
//   unbestimmt — ein Modell hat geantwortet, aber kein belastbares Fachurteil gegeben.
//   fehler     — technischer Fehler; bis `maxFehlversuche` erneut beanspruchbar, danach bleibt er.
//
// GESPEICHERT werden je Seite Kennung, Aussageversion, Quellrevision (Fingerabdruck der Prüfbasis
// `quelle` samt Quellen-/Anhangkennungen) und Kontext-Fingerabdruck, je Pflicht Bestandsstempel und
// Prüffassung — kein Text, keine Modellbegründung. Freigaben und Rechte berührt dieses Modul nicht.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { CONFLICT_MIN_CONFIDENCE, type ConflictVerdict, relationToType } from "./detect";
import { memoryKey } from "./pair-memory";

export interface PaarpflichtAussage {
  refId: string;
  // Inhaltsfassung (`KnowledgeObject.version`).
  version: number;
  // Quellrevision: Prüfbasis-Teil `quelle` (Fassung + Quellen + Anhänge, s. pruefbasis.ts).
  quelle: string;
  // Kennungen der gebundenen Quellen und Anhänge, sortiert — lesbar statt nur im Fingerabdruck.
  quellen: string[];
  // Prüfbasis-Teil `kontext` (Kategorie, Schlagworte, Anlage, Vertraulichkeit).
  kontext: string;
}

export interface PaarpflichtKontext {
  // Bestandsstempel bei der Planung (`bestandsStempelVon`).
  bestand: string;
  // Fassung der Prüfanweisung, unter der geurteilt werden soll.
  pruefFassung: string;
}

export type PaarpflichtZustand = "offen" | "in_arbeit" | "geurteilt" | "unbestimmt" | "fehler";

export interface Paarpflicht {
  id: string;
  laufId: string;
  pairKey: string;
  // a.refId < b.refId — ungeordnet, deshalb fest sortiert.
  a: PaarpflichtAussage;
  b: PaarpflichtAussage;
  kontext: PaarpflichtKontext;
  zustand: PaarpflichtZustand;
  fehlversuche: number;
  beansprucht?: { token: string; bis: string };
  urteil?: { ergebnis: string; modell: string; sicherheit?: number; at: string };
  hinweis?: { art: "fehler" | "kein_modell"; grund: string; at: string };
  angelegt: string;
  aktualisiert: string;
}

// Was der Prüfer über ein Paar meldet. Nur `urteil`/`unbestimmt` mit Modellbeleg schließen ab.
export type PaarpflichtErgebnis =
  | { art: "urteil"; ergebnis: string; modell: string; sicherheit?: number }
  | { art: "unbestimmt"; modell: string; sicherheit?: number }
  | { art: "kein_modell"; grund: string }
  | { art: "fehler"; grund: string };

// Der Prüfer bekommt nur die gespeicherten Stände; er muss genau diese Fassungen beurteilen und
// meldet sonst `fehler` (z. B. grund „fassung_ueberholt").
export type PaarpflichtPruefer = (
  a: PaarpflichtAussage,
  b: PaarpflichtAussage,
  kontext: PaarpflichtKontext,
) => Promise<PaarpflichtErgebnis>;

export interface PaarpflichtBilanz {
  gesamt: number;
  offen: number;
  inArbeit: number;
  geurteilt: number;
  unbestimmt: number;
  fehler: number;
  // Teilmenge von `offen`: zuletzt ohne Modellaufruf zurückgegeben.
  ohneModell: number;
  // Noch abzuarbeiten: offen + in_arbeit. Fehler und unbestimmte Urteile zählen getrennt.
  rest: number;
  // Jede Pflicht trägt ein gespeichertes Modellurteil (geurteilt oder unbestimmt), kein Fehler.
  abgeschlossen: boolean;
}

export interface PaarpflichtSchritt {
  geurteilt: number;
  unbestimmt: number;
  fehler: number;
  ohneModell: number;
  // Abschluss abgelehnt, weil die Beanspruchung inzwischen einem anderen Lauf gehört.
  verworfen: number;
  bilanz: PaarpflichtBilanz;
}

export class PaarpflichtFehler extends Error {
  constructor(
    readonly code: "AUSSAGE_DOPPELT" | "ZU_WENIG_AUSSAGEN" | "LAUF_STAND_ABWEICHUNG",
    message: string,
  ) {
    super(message);
    this.name = "PaarpflichtFehler";
  }
}

export function paarpflichtId(laufId: string, pairKey: string): string {
  return `${laufId}#${pairKey}`;
}

/** Alle ungeordneten Paare der Aussagemenge — ohne Limit, ohne Vorauswahl. */
export function paarpflichtenPlanen(
  laufId: string,
  aussagen: readonly PaarpflichtAussage[],
  kontext: PaarpflichtKontext,
  jetzt: string,
): Paarpflicht[] {
  const kennungen = new Set<string>();
  for (const aussage of aussagen) {
    if (kennungen.has(aussage.refId)) {
      throw new PaarpflichtFehler("AUSSAGE_DOPPELT", `Aussage ${aussage.refId} ist doppelt.`);
    }
    kennungen.add(aussage.refId);
  }
  if (aussagen.length < 2) {
    throw new PaarpflichtFehler("ZU_WENIG_AUSSAGEN", "Ein Paar braucht zwei Aussagen.");
  }
  const sortiert = [...aussagen].sort((p, q) => (p.refId < q.refId ? -1 : 1));
  const pflichten: Paarpflicht[] = [];
  for (let i = 0; i < sortiert.length; i += 1) {
    for (let j = i + 1; j < sortiert.length; j += 1) {
      const a = sortiert[i] as PaarpflichtAussage;
      const b = sortiert[j] as PaarpflichtAussage;
      const pairKey = memoryKey(a.refId, b.refId);
      pflichten.push({
        id: paarpflichtId(laufId, pairKey),
        laufId,
        pairKey,
        a: { ...a, quellen: [...a.quellen].sort() },
        b: { ...b, quellen: [...b.quellen].sort() },
        kontext: { ...kontext },
        zustand: "offen",
        fehlversuche: 0,
        angelegt: jetzt,
        aktualisiert: jetzt,
      });
    }
  }
  return pflichten;
}

export function paarpflichtBilanz(pflichten: readonly Paarpflicht[]): PaarpflichtBilanz {
  const zaehle = (zustand: PaarpflichtZustand) =>
    pflichten.filter((p) => p.zustand === zustand).length;
  const offen = zaehle("offen");
  const inArbeit = zaehle("in_arbeit");
  const fehler = zaehle("fehler");
  const ohneModell = pflichten.filter(
    (p) => p.zustand === "offen" && p.hinweis?.art === "kein_modell",
  );
  return {
    gesamt: pflichten.length,
    offen,
    inArbeit,
    geurteilt: zaehle("geurteilt"),
    unbestimmt: zaehle("unbestimmt"),
    fehler,
    ohneModell: ohneModell.length,
    rest: offen + inArbeit,
    abgeschlossen: pflichten.length > 0 && offen + inArbeit + fehler === 0,
  };
}

// Modul-reine Form eines Reasoner-Ausgangs der Konfliktprüfung (`ConflictJudgeOutcome`).
export interface KonfliktpruefungAusgang {
  verdict: Pick<ConflictVerdict, "relation" | "confidence"> | null;
  failure?: string;
}

/**
 * Bildet einen Ausgang der Konfliktprüfung auf das Pflichtergebnis ab. `unsicher` und ein
 * Widerspruch/Überholt unter der Anlegeschwelle sind ein unbestimmtes Fachurteil. Ohne Urteil wegen
 * fehlendem oder unzulässigem Modell ist es KEIN Urteil, jeder andere Ausgang ohne Urteil ein Fehler.
 */
export function ergebnisAusKonfliktUrteil(
  outcome: KonfliktpruefungAusgang,
  modell: string,
): PaarpflichtErgebnis {
  const { verdict, failure } = outcome;
  if (!verdict) {
    if (failure === "no-model" || failure === "confidential") {
      return { art: "kein_modell", grund: failure };
    }
    return { art: "fehler", grund: failure ?? "model-error" };
  }
  const unterSchwelle =
    relationToType(verdict.relation) !== null && verdict.confidence < CONFLICT_MIN_CONFIDENCE;
  if (verdict.relation === "unsicher" || unterSchwelle) {
    return { art: "unbestimmt", modell, sicherheit: verdict.confidence };
  }
  return { art: "urteil", ergebnis: verdict.relation, modell, sicherheit: verdict.confidence };
}

export interface PaarpflichtBeanspruchung {
  token: string;
  jetzt: string;
  bis: string;
  maxFehlversuche: number;
  // In diesem Aufruf schon bearbeitet — nicht noch einmal fragen (z. B. nach „kein_modell").
  ausser: readonly string[];
}

export interface PaarpflichtRepo {
  // Einfügen, wenn noch nicht vorhanden (je id); vorhandene Pflichten bleiben unberührt.
  anlegen(pflichten: readonly Paarpflicht[]): Promise<number>;
  liste(laufId: string): Promise<Paarpflicht[]>;
  // Atomar EINE beanspruchbare Pflicht übernehmen: offen, Fehler unter der Versuchsgrenze oder
  // in_arbeit mit abgelaufener Frist. Kein Kandidat → null.
  beanspruchen(laufId: string, b: PaarpflichtBeanspruchung): Promise<Paarpflicht | null>;
  // Nur, wenn die Pflicht noch in_arbeit mit DIESEM Token ist.
  abschliessen(id: string, token: string, neu: Paarpflicht): Promise<boolean>;
}

function beanspruchbar(p: Paarpflicht, b: PaarpflichtBeanspruchung): boolean {
  if (b.ausser.includes(p.id)) {
    return false;
  }
  if (p.zustand === "offen") {
    return true;
  }
  if (p.zustand === "fehler") {
    return p.fehlversuche < b.maxFehlversuche;
  }
  return (
    p.zustand === "in_arbeit" &&
    p.beansprucht !== undefined &&
    Date.parse(p.beansprucht.bis) < Date.parse(b.jetzt)
  );
}

export class InMemoryPaarpflichtRepo implements PaarpflichtRepo {
  private readonly pflichten = new Map<string, Paarpflicht>();

  anlegen(pflichten: readonly Paarpflicht[]): Promise<number> {
    let neu = 0;
    for (const p of pflichten) {
      if (!this.pflichten.has(p.id)) {
        this.pflichten.set(p.id, structuredClone(p));
        neu += 1;
      }
    }
    return Promise.resolve(neu);
  }

  liste(laufId: string): Promise<Paarpflicht[]> {
    return Promise.resolve(this.lauf(laufId).map((p) => structuredClone(p)));
  }

  // Lesen und Setzen ohne Unterbrechung — zwei gleichzeitige Läufe greifen nie dieselbe Pflicht.
  beanspruchen(laufId: string, b: PaarpflichtBeanspruchung): Promise<Paarpflicht | null> {
    const kandidat = this.lauf(laufId).find((p) => beanspruchbar(p, b));
    if (!kandidat) {
      return Promise.resolve(null);
    }
    const neu: Paarpflicht = {
      ...structuredClone(kandidat),
      zustand: "in_arbeit",
      beansprucht: { token: b.token, bis: b.bis },
      aktualisiert: b.jetzt,
    };
    this.pflichten.set(neu.id, structuredClone(neu));
    return Promise.resolve(neu);
  }

  abschliessen(id: string, token: string, neu: Paarpflicht): Promise<boolean> {
    const alt = this.pflichten.get(id);
    if (alt?.zustand !== "in_arbeit" || alt.beansprucht?.token !== token) {
      return Promise.resolve(false);
    }
    this.pflichten.set(id, structuredClone(neu));
    return Promise.resolve(true);
  }

  private lauf(laufId: string): Paarpflicht[] {
    return [...this.pflichten.values()]
      .filter((p) => p.laufId === laufId)
      .sort((p, q) => (p.pairKey < q.pairKey ? -1 : 1));
  }
}

interface PflichtRow {
  data: Paarpflicht;
}

// Tabelle `conflict_pair_obligations` — angelegt in CONFLICTS_SCHEMA (repo-pg.ts), dieselbe Stufe.
export class PgPaarpflichtRepo implements PaarpflichtRepo {
  constructor(private readonly pool: Pool) {}

  async anlegen(pflichten: readonly Paarpflicht[]): Promise<number> {
    if (pflichten.length === 0) {
      return 0;
    }
    const res = await this.pool.query(
      "INSERT INTO conflict_pair_obligations(id,lauf_id,pair_key,data) " +
        "SELECT * FROM unnest($1::text[],$2::text[],$3::text[],$4::jsonb[]) " +
        "ON CONFLICT (id) DO NOTHING",
      [
        pflichten.map((p) => p.id),
        pflichten.map((p) => p.laufId),
        pflichten.map((p) => p.pairKey),
        pflichten.map((p) => JSON.stringify(p)),
      ],
    );
    return res.rowCount ?? 0;
  }

  async liste(laufId: string): Promise<Paarpflicht[]> {
    const res = await this.pool.query<PflichtRow>(
      "SELECT data FROM conflict_pair_obligations WHERE lauf_id = $1 ORDER BY pair_key",
      [laufId],
    );
    return res.rows.map((row) => row.data);
  }

  // SKIP LOCKED: zwei gleichzeitige Läufe greifen nie dieselbe Zeile; die Bedingung wird nach dem
  // Sperren gegen die neueste Zeilenfassung erneut geprüft.
  async beanspruchen(laufId: string, b: PaarpflichtBeanspruchung): Promise<Paarpflicht | null> {
    const res = await this.pool.query<PflichtRow>(
      `UPDATE conflict_pair_obligations SET data = data || jsonb_build_object(
         'zustand', 'in_arbeit',
         'beansprucht', jsonb_build_object('token', $2::text, 'bis', $4::text),
         'aktualisiert', $3::text)
       WHERE id = (
         SELECT id FROM conflict_pair_obligations
         WHERE lauf_id = $1 AND NOT (id = ANY($6::text[])) AND (
           data->>'zustand' = 'offen'
           OR (data->>'zustand' = 'fehler' AND (data->>'fehlversuche')::int < $5)
           OR (data->>'zustand' = 'in_arbeit'
               AND (data->'beansprucht'->>'bis')::timestamptz < $3::text::timestamptz))
         ORDER BY pair_key
         LIMIT 1
         FOR UPDATE SKIP LOCKED)
       RETURNING data`,
      [laufId, b.token, b.jetzt, b.bis, b.maxFehlversuche, [...b.ausser]],
    );
    return res.rows[0]?.data ?? null;
  }

  async abschliessen(id: string, token: string, neu: Paarpflicht): Promise<boolean> {
    const res = await this.pool.query(
      "UPDATE conflict_pair_obligations SET data = $3::jsonb " +
        "WHERE id = $1 AND data->>'zustand' = 'in_arbeit' AND data->'beansprucht'->>'token' = $2",
      [id, token, JSON.stringify(neu)],
    );
    return (res.rowCount ?? 0) === 1;
  }
}

export interface PaarpflichtServiceDeps {
  repo: PaarpflichtRepo;
  jetzt?: () => Date;
  token?: () => string;
  // Wie lange eine Beanspruchung gilt, bevor ein anderer Lauf die Pflicht übernimmt.
  fristMs?: number;
  maxFehlversuche?: number;
}

export const PAARPFLICHT_FRIST_MS = 5 * 60_000;
export const PAARPFLICHT_MAX_FEHLVERSUCHE = 3;

function gleicheAussage(x: PaarpflichtAussage, y: PaarpflichtAussage): boolean {
  return (
    x.refId === y.refId &&
    x.version === y.version &&
    x.quelle === y.quelle &&
    x.kontext === y.kontext &&
    x.quellen.join("\n") === y.quellen.join("\n")
  );
}

export class PaarpflichtService {
  private readonly repo: PaarpflichtRepo;
  private readonly jetzt: () => Date;
  private readonly token: () => string;
  private readonly fristMs: number;
  private readonly maxFehlversuche: number;

  constructor(deps: PaarpflichtServiceDeps) {
    this.repo = deps.repo;
    this.jetzt = deps.jetzt ?? (() => new Date());
    this.token = deps.token ?? randomUUID;
    this.fristMs = deps.fristMs ?? PAARPFLICHT_FRIST_MS;
    this.maxFehlversuche = deps.maxFehlversuche ?? PAARPFLICHT_MAX_FEHLVERSUCHE;
  }

  /**
   * Legt die Pflichten eines Laufs an (wiederholbar). Ein Lauf ist an seine Stände gebunden: trägt
   * eine schon gespeicherte Pflicht andere Stände oder anderen Kontext, ist das ein neuer Lauf.
   */
  async planen(
    laufId: string,
    aussagen: readonly PaarpflichtAussage[],
    kontext: PaarpflichtKontext,
  ): Promise<{ gesamt: number; neu: number }> {
    const geplant = paarpflichtenPlanen(laufId, aussagen, kontext, this.jetzt().toISOString());
    const neu = await this.repo.anlegen(geplant);
    const gespeichert = new Map((await this.repo.liste(laufId)).map((p) => [p.id, p]));
    for (const p of geplant) {
      const vorhanden = gespeichert.get(p.id);
      if (
        !vorhanden ||
        !gleicheAussage(vorhanden.a, p.a) ||
        !gleicheAussage(vorhanden.b, p.b) ||
        vorhanden.kontext.bestand !== kontext.bestand ||
        vorhanden.kontext.pruefFassung !== kontext.pruefFassung
      ) {
        throw new PaarpflichtFehler(
          "LAUF_STAND_ABWEICHUNG",
          `Lauf ${laufId} ist an andere Stände gebunden (${p.pairKey}).`,
        );
      }
    }
    return { gesamt: gespeichert.size, neu };
  }

  /**
   * Arbeitet höchstens `limit` Pflichten nacheinander ab. Das Limit begrenzt nur diesen Schritt —
   * was übrig bleibt, steht als `rest` in der Bilanz und wird beim nächsten Aufruf fortgesetzt.
   */
  async abarbeiten(
    laufId: string,
    pruefer: PaarpflichtPruefer,
    optionen: { limit?: number } = {},
  ): Promise<PaarpflichtSchritt> {
    const limit = optionen.limit ?? Number.POSITIVE_INFINITY;
    const schritt = { geurteilt: 0, unbestimmt: 0, fehler: 0, ohneModell: 0, verworfen: 0 };
    // Ein Token je Aufruf; dieselbe Pflicht wird in einem Aufruf höchstens einmal beansprucht.
    const token = this.token();
    const gesehen: string[] = [];
    while (gesehen.length < limit) {
      const start = this.jetzt();
      const pflicht = await this.repo.beanspruchen(laufId, {
        token,
        jetzt: start.toISOString(),
        bis: new Date(start.getTime() + this.fristMs).toISOString(),
        maxFehlversuche: this.maxFehlversuche,
        ausser: gesehen,
      });
      if (!pflicht) {
        break;
      }
      gesehen.push(pflicht.id);
      let ergebnis: PaarpflichtErgebnis;
      try {
        ergebnis = await pruefer(pflicht.a, pflicht.b, pflicht.kontext);
      } catch {
        ergebnis = { art: "fehler", grund: "pruefer_ausnahme" };
      }
      const neu = this.folgezustand(pflicht, ergebnis, this.jetzt().toISOString());
      if (!(await this.repo.abschliessen(pflicht.id, token, neu))) {
        schritt.verworfen += 1;
      } else if (neu.zustand === "offen") {
        schritt.ohneModell += 1;
      } else if (neu.zustand === "geurteilt" || neu.zustand === "unbestimmt") {
        schritt[neu.zustand] += 1;
      } else {
        schritt.fehler += 1;
      }
    }
    return { ...schritt, bilanz: await this.bilanz(laufId) };
  }

  async bilanz(laufId: string): Promise<PaarpflichtBilanz> {
    return paarpflichtBilanz(await this.repo.liste(laufId));
  }

  liste(laufId: string): Promise<Paarpflicht[]> {
    return this.repo.liste(laufId);
  }

  private folgezustand(p: Paarpflicht, e: PaarpflichtErgebnis, at: string): Paarpflicht {
    // Die Stände bleiben, wie geplant; Beanspruchung und alter Hinweis fallen weg.
    const basis: Paarpflicht = {
      id: p.id,
      laufId: p.laufId,
      pairKey: p.pairKey,
      a: p.a,
      b: p.b,
      kontext: p.kontext,
      zustand: p.zustand,
      fehlversuche: p.fehlversuche,
      angelegt: p.angelegt,
      aktualisiert: at,
    };
    // Ein Urteil ohne Modellbeleg ist keins.
    const ohneBeleg = (e.art === "urteil" || e.art === "unbestimmt") && !e.modell.trim();
    if (ohneBeleg || e.art === "fehler") {
      const grund = e.art === "fehler" ? e.grund : "urteil_ohne_modell";
      return {
        ...basis,
        zustand: "fehler",
        fehlversuche: p.fehlversuche + 1,
        hinweis: { art: "fehler", grund, at },
      };
    }
    if (e.art === "kein_modell") {
      return { ...basis, zustand: "offen", hinweis: { art: "kein_modell", grund: e.grund, at } };
    }
    return {
      ...basis,
      zustand: e.art === "urteil" ? "geurteilt" : "unbestimmt",
      urteil: {
        ergebnis: e.art === "urteil" ? e.ergebnis : "unbestimmt",
        modell: e.modell,
        ...(e.sicherheit !== undefined ? { sicherheit: e.sicherheit } : {}),
        at,
      },
      aktualisiert: at,
    };
  }
}
