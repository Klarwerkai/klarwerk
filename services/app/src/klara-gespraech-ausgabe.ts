import { type AnswerSnapshotRepo, gehoertNutzer, hashAnswerSnapshot } from "../../ask";
import type { KoService } from "../../knowledge-object";
import type { KlaraFristenQuellen } from "./klara-fristen-quellen";
import type { KlaraGespraech, KlaraNachricht, KlaraObjektbezug } from "./klara-gespraech";

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
  readonly antworten: Pick<AnswerSnapshotRepo, "findRecord" | "latestSnapshot">;
  readonly rechte: Pick<KlaraFristenQuellen, "nutzer" | "lies">;
  readonly ko: Pick<KoService, "get" | "versionsOf">;
}

type Quelle = { id: string; fassung?: number };
const NICHT_VERFUEGBAR = "Dieser gespeicherte Inhalt ist derzeit nicht verfügbar.";
const NEUTRAL: KlaraObjektbezug = { pfad: "/fragen", seitenName: "Fragen", objekt: "Gespräch" };

/**
 * AW04/PV-05-03: nur die gemeinsame HTTP-Ausgabe projizieren. Rohbestand, interne Leser und CAS
 * bleiben unverändert. Die Herkunft kommt aus dem eigenen serverseitigen Antwortbeleg; Angaben
 * aus der gespeicherten Clientdarstellung können sie nur einschränken, niemals ersetzen.
 */
export class KlaraGespraechAusgabe {
  constructor(private readonly d: AusgabeDeps) {}

  async sicht(g: KlaraGespraech): Promise<KlaraGespraechSicht> {
    const quellen = new Map<string, Quelle>();
    const schluessel = (q: Quelle) => JSON.stringify([q.id, q.fassung ?? null]);
    const merke = (q: Quelle) => {
      quellen.set(schluessel(q), q);
      return schluessel(q);
    };
    const bezug = (b: KlaraObjektbezug) =>
      b.koId
        ? [merke({ id: b.koId, ...(b.fassung !== undefined ? { fassung: b.fassung } : {}) })]
        : [];
    const grundbezug = bezug(g.objektbezug);
    const schrittbezug = g.letzterSchritt ? bezug(g.letzterSchritt.objektbezug) : [];
    const nachrichten: { n: KlaraNachricht; herkunft: boolean; quellen: string[] }[] = [];
    // Zuerst alle Ablage-/Herkunftslesungen. Heutige Rechte folgen danach, auch beim Schreib-Echo.
    for (const n of g.nachrichten) {
      const ids = bezug(n.objektbezug);
      let herkunft = true;
      if (n.modus === "ki" || n.modus === "ohne_ki") {
        const record = n.antwortId ? await this.d.antworten.findRecord(n.antwortId) : undefined;
        const snapshot =
          record && gehoertNutzer(record, g.kontoId)
            ? await this.d.antworten.latestSnapshot(record.answerId)
            : undefined;
        herkunft = Boolean(
          snapshot &&
            snapshot.answerId === n.antwortId &&
            snapshot.integrityHash === hashAnswerSnapshot(snapshot),
        );
        if (snapshot && herkunft) {
          const refs = new Map(
            snapshot.evidence.map((q) => [q.knowledgeObjectId, q.knowledgeObjectVersion]),
          );
          // Fehlende/erfundene Herkunft ist kein aktuelles Leserecht. Auch nicht zitierte,
          // tatsächlich herangezogene Quellen können vertraulichen Mischtext getragen haben.
          herkunft =
            snapshot.citedSources.every((id) => refs.has(id)) &&
            n.quellen.every((id) => refs.has(id)) &&
            (n.quellenAngaben ?? []).every(
              (q) => refs.has(q.koId) && q.fassung === refs.get(q.koId),
            );
          for (const q of snapshot.evidence) {
            if (
              !Number.isSafeInteger(q.knowledgeObjectVersion) ||
              Number(q.knowledgeObjectVersion) < 1
            )
              herkunft = false;
            else
              ids.push(
                merke({ id: q.knowledgeObjectId, fassung: Number(q.knowledgeObjectVersion) }),
              );
          }
          // Ein leerer Beleg trägt keinen nachweisbar quellenabhängigen Antworttext.
          if (snapshot.evidence.length === 0) herkunft = false;
        }
      }
      nachrichten.push({ n, herkunft, quellen: ids });
    }
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
    // Kein Cache über Anfragen hinweg; aktuelle Kontosperre, Rollen, Spaces und Quellleser über
    // den bestehenden autoritativen Leser. Keine gespeicherte Rolle/alte Quellfreigabe öffnet.
    const user = await this.d.rechte.nutzer(g.kontoId);
    const erlaubt = new Map<string, boolean>();
    for (const [key, q] of quellen) {
      erlaubt.set(
        key,
        !!user &&
          fassungen.get(key) === true &&
          !!(await this.d.rechte.lies(user, "wissensobjekt", q.id)),
      );
    }
    // Nach dieser letzten Rechteprüfung kein weiterer Speicher-/Herkunftsabruf vor der Ausgabe.
    // Ein Entzug nach ihr wirkt auf den nächsten Abruf; bereits gesendete Kopien bleiben separat.
    const lesbar = (ids: readonly string[]) =>
      !!user && ids.every((id) => erlaubt.get(id) === true);
    const neutral = (n: KlaraNachricht): KlaraNachricht => ({
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
    });
    return {
      id: g.id,
      objektbezug: lesbar(grundbezug) ? g.objektbezug : NEUTRAL,
      nachrichten: nachrichten.map(({ n, herkunft, quellen: ids }) =>
        herkunft && lesbar(ids) ? n : neutral(n),
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
