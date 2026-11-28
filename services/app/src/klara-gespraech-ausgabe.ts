import {
  type AnswerSnapshotRepo,
  gehoertNutzer,
  hashAnswerSnapshot,
  modelAnswerTextHash,
} from "../../ask";
import type { KoService } from "../../knowledge-object";
import type { ModelRunRecord } from "../../model-runs";
import type { ReferenzRolle } from "../../reasoner";
import type { KlaraFristenQuellen } from "./klara-fristen-quellen";
import type {
  KlaraGespraech,
  KlaraGespraechRepo,
  KlaraNachricht,
  KlaraObjektbezug,
} from "./klara-gespraech";
import type { KlaraNotiz } from "./klara-notiz";

export type KlaraGespraechSicht = Pick<
  KlaraGespraech,
  | "id"
  | "objektbezug"
  | "nachrichten"
  | "letzterSchritt"
  | "einwilligungAm"
  | "angelegtAm"
  | "geaendertAm"
>;

interface AusgabeDeps {
  readonly antworten: Pick<AnswerSnapshotRepo, "findRecord" | "latestSnapshot" | "findSnapshot">;
  readonly modellLauf?: (id: string) => Promise<ModelRunRecord | undefined>;
  readonly rechte: Pick<KlaraFristenQuellen, "nutzer" | "lies">;
  readonly ko: Pick<KoService, "get" | "versionsOf">;
}

type Quelle = { id: string; fassung?: number };
export interface KlaraNotizModellBeleg {
  readonly rolle: ReferenzRolle;
  readonly quellen: readonly { id: string; fassung: number }[];
  readonly zitierteQuellen: readonly string[];
}
const schluessel = (q: Quelle) => JSON.stringify([q.id, q.fassung ?? null]);
const NICHT_VERFUEGBAR = "Dieser gespeicherte Inhalt ist derzeit nicht verfügbar.";
const NEUTRAL: KlaraObjektbezug = { pfad: "/fragen", seitenName: "Fragen", objekt: "Gespräch" };

function objektQuellen(b: KlaraObjektbezug): Quelle[] {
  return b.koId ? [{ id: b.koId, ...(b.fassung !== undefined ? { fassung: b.fassung } : {}) }] : [];
}

function neutraleNachricht(n: KlaraNachricht): KlaraNachricht {
  return {
    id: n.id,
    von: n.von,
    modus: n.von === "du" ? n.modus : "fehler",
    text: NICHT_VERFUEGBAR,
    objektbezug: NEUTRAL,
    antwortId: null,
    quellen: [],
    quellenAngaben: [],
    wissensklasse: null,
    grund: n.von === "du" ? null : "inhalt_nicht_verfuegbar",
    angelegtAm: n.angelegtAm,
  };
}

/**
 * AW04/PV-05-03: Gesprächsausgabe und die davon abgeleiteten Kopien prüfen denselben eigenen
 * Antwortbeleg. Rohbestand und CAS bleiben unverändert. Clientdarstellungen können die
 * serverseitige Herkunft nur einschränken, niemals ersetzen.
 */
export class KlaraGespraechAusgabe {
  constructor(private readonly d: AusgabeDeps) {}

  private async eigenerAntwortbeleg(
    kontoId: string,
    antwortId: string | null,
    hinweise?: Pick<KlaraNachricht, "quellen" | "quellenAngaben">,
    original = false,
  ) {
    const record = antwortId ? await this.d.antworten.findRecord(antwortId) : undefined;
    if (!record || record.answerId !== antwortId || !gehoertNutzer(record, kontoId)) return null;
    const snapshot = original
      ? await this.d.antworten.findSnapshot(record.answerId, 1)
      : await this.d.antworten.latestSnapshot(record.answerId);
    if (
      !snapshot ||
      snapshot.answerId !== antwortId ||
      snapshot.integrityHash !== hashAnswerSnapshot(snapshot)
    ) {
      return null;
    }
    const refs = new Map(
      snapshot.evidence.map((q) => [q.knowledgeObjectId, q.knowledgeObjectVersion]),
    );
    if (
      !snapshot.citedSources.every((id) => refs.has(id)) ||
      !(hinweise?.quellen ?? []).every((id) => refs.has(id)) ||
      !(hinweise?.quellenAngaben ?? []).every(
        (q) => refs.has(q.koId) && q.fassung === refs.get(q.koId),
      ) ||
      snapshot.evidence.some(
        (q) =>
          !Number.isSafeInteger(q.knowledgeObjectVersion) || Number(q.knowledgeObjectVersion) < 1,
      )
    ) {
      return null;
    }
    return snapshot;
  }

  /** [] ist ein gültiger, quellloser Lauf. null bezeichnet fehlende oder unvereinbare Belege. */
  private async gebundeneQuellen(
    kontoId: string,
    antwortId: string | null,
    hinweise?: Pick<KlaraNachricht, "quellen" | "quellenAngaben">,
  ): Promise<Quelle[] | null> {
    const snapshot = await this.eigenerAntwortbeleg(kontoId, antwortId, hinweise);
    if (!snapshot) return null;
    // Auch tatsächlich herangezogene, nicht zitierte Mischquellen gehören zur Herkunft.
    // Eine spätere Belegrevision kann die Zugriffskontrolle für den ursprünglichen Wortlaut
    // erweitern, aber keine seiner damaligen Quellen aus ihr herausnehmen.
    const original =
      snapshot.snapshotRevision === 1
        ? snapshot
        : await this.eigenerAntwortbeleg(kontoId, antwortId, undefined, true);
    if (!original || original.snapshotRevision !== 1) return null;
    if (original.evidence.length === 0 || snapshot.evidence.length === 0) {
      return [original, snapshot].every(
        (s) => s.evidence.length === 0 && s.status === "PENDING_EVIDENCE" && !s.modelAnswer,
      )
        ? []
        : null;
    }
    const evidence =
      original === snapshot ? snapshot.evidence : [...original.evidence, ...snapshot.evidence];
    return evidence.map((q) => ({
      id: q.knowledgeObjectId,
      fassung: Number(q.knowledgeObjectVersion),
    }));
  }

  /** Eine quelllose Statusmeldung darf keinen frei übermittelten Wortlaut einer Kopie beglaubigen. */
  async antwortQuellen(
    kontoId: string,
    antwortId: string | null,
    hinweise?: Pick<KlaraNachricht, "quellen" | "quellenAngaben">,
  ): Promise<Quelle[] | null> {
    const quellen = await this.gebundeneQuellen(kontoId, antwortId, hinweise);
    return quellen?.length ? quellen : null;
  }

  /** Ausschließlich die unveränderte Kopie einer tatsächlich vom Modell erzeugten eigenen Antwort. */
  async notizModellBeleg(n: KlaraNotiz): Promise<KlaraNotizModellBeleg | undefined> {
    if (
      n.antwortTextFassung !== n.fassung ||
      n.weg !== "gespraech" ||
      !n.quelle ||
      !n.antwortId ||
      n.wissensHerkunft
    )
      return undefined;
    const snapshot = await this.eigenerAntwortbeleg(n.kontoId, n.antwortId, undefined, true);
    if (
      !snapshot?.modelAnswer ||
      !snapshot.evidence.length ||
      !snapshot.modelRunId ||
      snapshot.snapshotRevision !== 1 ||
      snapshot.generationMode !== "model" ||
      snapshot.modelAnswer.textHash !== modelAnswerTextHash(n.inhalt) ||
      (snapshot.modelAnswer.tier !== "local" && snapshot.modelAnswer.tier !== "cloud")
    )
      return undefined;
    const lauf = await this.d.modellLauf?.(snapshot.modelRunId);
    if (
      !lauf ||
      lauf.id !== snapshot.modelRunId ||
      lauf.task !== "answer" ||
      lauf.actor !== n.kontoId ||
      lauf.status !== "success" ||
      lauf.demo ||
      !lauf.provider ||
      !lauf.reportedModel
    )
      return undefined;
    return {
      rolle: {
        anbieter: lauf.provider,
        modell: lauf.reportedModel,
        stufe: snapshot.modelAnswer.tier,
      },
      quellen: snapshot.evidence.map((q) => ({
        id: q.knowledgeObjectId,
        fassung: Number(q.knowledgeObjectVersion),
      })),
      zitierteQuellen: snapshot.citedSources,
    };
  }

  async nachrichtQuellen(kontoId: string, n: KlaraNachricht): Promise<Quelle[] | null> {
    const quellen = objektQuellen(n.objektbezug);
    if (n.modus === "ki" || n.modus === "ohne_ki") {
      const antwort = await this.antwortQuellen(kontoId, n.antwortId, n);
      if (!antwort) return null;
      quellen.push(...antwort);
    }
    return quellen;
  }

  async notizQuellen(
    n: KlaraNotiz,
    gespraeche: Pick<KlaraGespraechRepo, "hole">,
  ): Promise<Quelle[] | null> {
    if (n.quelle) {
      const g = await gespraeche.hole(n.kontoId, n.quelle.gespraechId);
      const m = g?.nachrichten.find((m) => m.id === n.quelle?.nachrichtId);
      if (m) {
        const antwortId = m.modus === "ki" || m.modus === "ohne_ki" ? m.antwortId : null;
        if (n.antwortId !== undefined && n.antwortId !== antwortId) return null;
        return this.nachrichtQuellen(n.kontoId, m);
      }
      // Altbestand ohne auflösbare Nachricht ist kein positiver Herkunftsnachweis.
      if (n.antwortId === undefined) return null;
    }
    const quellen = objektQuellen(n.objektbezug);
    if (n.antwortId !== undefined && n.antwortId !== null) {
      const antwort = await this.antwortQuellen(n.kontoId, n.antwortId);
      if (!antwort) return null;
      quellen.push(...antwort);
    }
    return quellen;
  }

  async quellenLesbar(kontoId: string, quellen: readonly Quelle[]): Promise<boolean> {
    const qs = new Map(quellen.map((q) => [schluessel(q), q]));
    const lesbar = await this.leserechte(kontoId, qs);
    return lesbar([...qs.keys()]);
  }

  private async leserechte(kontoId: string, quellen: ReadonlyMap<string, Quelle>) {
    const fassungen = new Map<string, boolean>();
    for (const [key, q] of quellen) {
      const aktuell = await this.d.ko.get(q.id);
      const vorhanden =
        !!aktuell &&
        (q.fassung === undefined ||
          aktuell.version === q.fassung ||
          (await this.d.ko.versionsOf(q.id)).some((v) => v.version === q.fassung));
      fassungen.set(key, vorhanden);
    }
    const user = await this.d.rechte.nutzer(kontoId);
    const erlaubt = new Map<string, boolean>();
    for (const [key, q] of quellen) {
      erlaubt.set(
        key,
        !!user &&
          fassungen.get(key) === true &&
          !!(await this.d.rechte.lies(user, "wissensobjekt", q.id)),
      );
    }
    return (ids: readonly string[]) => !!user && ids.every((id) => erlaubt.get(id) === true);
  }

  async sicht(g: KlaraGespraech): Promise<KlaraGespraechSicht> {
    const quellen = new Map<string, Quelle>();
    const merke = (q: Quelle) => {
      quellen.set(schluessel(q), q);
      return schluessel(q);
    };
    const bezug = (b: KlaraObjektbezug) => objektQuellen(b).map(merke);
    const grundbezug = bezug(g.objektbezug);
    const schrittbezug = g.letzterSchritt ? bezug(g.letzterSchritt.objektbezug) : [];
    const nachrichten: { n: KlaraNachricht; herkunft: boolean; quellen: string[] }[] = [];
    // Zuerst alle Ablage-/Herkunftslesungen. Heutige Rechte folgen danach, auch beim Schreib-Echo.
    for (const n of g.nachrichten) {
      const ids = bezug(n.objektbezug);
      if (n.modus !== "ki" && n.modus !== "ohne_ki") {
        nachrichten.push({ n, herkunft: true, quellen: ids });
        continue;
      }
      const qs = await this.gebundeneQuellen(g.kontoId, n.antwortId, n);
      if (qs?.length === 0 && n.von === "klara" && n.modus === "ohne_ki") {
        // Nur den Serverstatus ausgeben. Ein leerer Snapshot trägt weder Clienttext noch Metadaten.
        const hinweis: KlaraNachricht = {
          ...neutraleNachricht(n),
          modus: "ohne_ki",
          grund: "keine_belegte_antwort",
          text: "Klarwerk hat für diese Frage keine belegte Antwort gefunden.",
        };
        nachrichten.push({ n: hinweis, herkunft: true, quellen: ids });
      } else {
        nachrichten.push({
          n,
          herkunft: !!qs?.length,
          quellen: [...ids, ...(qs ?? []).map(merke)],
        });
      }
    }
    // Kein Cache über Anfragen hinweg; aktuelle Kontosperre, Rollen, Spaces und Quellleser über
    // den bestehenden autoritativen Leser. Keine gespeicherte Rolle/alte Quellfreigabe öffnet.
    const lesbar = await this.leserechte(g.kontoId, quellen);
    // Nach dieser letzten Rechteprüfung kein weiterer Speicher-/Herkunftsabruf vor der Ausgabe.
    // Ein Entzug nach ihr wirkt auf den nächsten Abruf; bereits gesendete Kopien bleiben separat.
    return {
      id: g.id,
      objektbezug: lesbar(grundbezug) ? g.objektbezug : NEUTRAL,
      nachrichten: nachrichten.map(({ n, herkunft, quellen: ids }) =>
        herkunft && lesbar(ids) ? n : neutraleNachricht(n),
      ),
      letzterSchritt:
        g.letzterSchritt &&
        (lesbar(schrittbezug)
          ? g.letzterSchritt
          : {
              ...g.letzterSchritt,
              text: NICHT_VERFUEGBAR,
              objektbezug: NEUTRAL,
            }),
      einwilligungAm: g.einwilligungAm,
      angelegtAm: g.angelegtAm,
      geaendertAm: g.geaendertAm,
    };
  }
}
