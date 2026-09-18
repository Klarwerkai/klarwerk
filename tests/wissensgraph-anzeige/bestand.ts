// ================================================================================================
// JOB 4153 (WG-ANZEIGE) — DER PRÜFSTAND: DER VERTRAG ALS ANTWORTENDE GEGENSEITE.
// ================================================================================================
//
// WARUM HIER EIN KLEINER SERVER STEHT UND NICHT EINE LISTE FESTER ANTWORTEN.
//
// Die drei Zusagen, die dieser Auftrag prüft, sind ZUSAMMENHÄNGE und keine Einzelantworten:
//
//   · „Bestätigt wird erst nach Servererfolg" heißt: solange die Antwort aussteht, ist die Liste
//     unverändert — und NACH der Antwort ist sie die des Servers, nicht die des Browsers.
//   · „Dedup erzeugt keinen zweiten Eintrag" (G3) heißt: derselbe `beitragSchluessel` führt auf
//     DIESELBE Kante. Eine feste Antwort könnte das nicht zeigen; sie würde einfach zweimal
//     dasselbe behaupten, egal was der Client sendet. Genau darum ist die Gegenprobe („Schlüssel je
//     Absenden neu erzeugen") hier auch wirklich rot: der Prüfstand legt dann eine zweite Kante an.
//   · Der Fassungsvermerk (G6) heißt: `aktuell` wird beim LESEN aus dem Bestand gerechnet und
//     `abweichung` durch VERGLEICH mit `beurteilt` bestimmt. Stünde `abweichung` als fester Wert im
//     Testdatum, prüfte der Fall nur, ob die Fläche eine Zeichenkette durchreicht — das ist die
//     Lehre aus JOB 4141 R1 (15.09. 17:17): „Ein Feld zählt erst als Nachweis, wenn seine Werte
//     tatsächlich verglichen werden."
//
// WAS DER PRÜFSTAND NICHT IST: der Server. Er ist die Antwortform aus dem verbindlichen API-Vertrag
// (`jobs/4151/HINWEIS.md`, Abschnitt „Verbindlicher API-Vertrag"; Eingang WISSENSGRAPH-INTEGRATION
// Nachtrag 1 §2, Nachtrag 2 §1–3). Persistenz, Rechte und Routen liegen bei JOB 4151; hier wird
// KEIN Byte Servercode geprüft und keiner behauptet.
import { ApiError } from "../../apps/web/src/api/client";
import type {
  BeziehungAbweichung,
  BeziehungBeurteilt,
  BeziehungSetzenBody,
  Graph,
  GraphKuratierteKante,
  KantenArt,
  KantenRichtung,
  KantenRolle,
  KuratierteKanteAnsicht,
  KuratierteKanten,
} from "../../apps/web/src/api/types";

export const QUELLE_ID = "ko-quelle";
export const QUELLE_TITEL = "Filter F3 monatlich auf Verschmutzung prüfen.";

/** Die zwei Ziele, die die Suche findet. Ihre Fassungen wandern als `gesehen` in den Schreibweg. */
export const ZIEL_A = { id: "ko-ziel-a", title: "Filterwechsel F3 — neue Fassung", version: 2 };
export const ZIEL_B = { id: "ko-ziel-b", title: "Wartungsplan Halle 2", version: 9 };

/** Ein Wissensobjekt in der Form, die die Fläche liest. Mehr Felder braucht sie hier nicht. */
export function alsKo(o: { id: string; title: string; version: number }): Record<string, unknown> {
  return {
    id: o.id,
    title: o.title,
    version: o.version,
    status: "validiert",
    tags: [],
    trust: 80,
    confidence: 80,
    type: "regel",
    category: "Betrieb",
    conditions: [],
    measures: [],
    author: "a",
    originalAuthor: "a",
  };
}

/** Die gespeicherte Kante — `aktuell` und `abweichung` stehen hier NICHT: sie werden gerechnet. */
export interface Kantenbestand {
  id: string;
  art: KantenArt;
  richtung: KantenRichtung;
  rolle?: KantenRolle;
  gegenstueck: { id: string; title: string; status: "offen" | "validiert" };
  urheber: string;
  gesetztAm: string;
  version: number;
  status: "aktiv" | "widerrufen";
  /** `null` = der beurteilte Inhaltsstand ist unbekannt (Altbestand). Wird NIE aufgefüllt. */
  beurteilt: BeziehungBeurteilt | null;
}

export type Stoerung = null | "403" | "409-stand" | "409" | "netz" | "haengt";

export interface Pruefstand {
  /** Der Bestand, wie der Prüfstand ihn hält. Tests dürfen ihn vor der Montage setzen. */
  kanten: Kantenbestand[];
  quelleVersion: number;
  zielVersionen: Map<string, number>;
  /** Jeder gesendete Rumpf, in der Reihenfolge des Sendens — daran hängt die Idempotenzprüfung. */
  gesendet: BeziehungSetzenBody[];
  /** beitragSchluessel → Kantenkennung. Die Idempotenz des Vertrags, in einer Zeile. */
  schluessel: Map<string, string>;
  stoerung: Stoerung;
  /** Der Widerruf antwortet eigenständig — 403/409 sind eigene Fälle (G5). */
  widerrufStoerung: Stoerung;
  /** Scheitert die Liste? Für das Zustandsmodell (laden · leer · Fehler · Cache). */
  listeStoerung: boolean;
  /** Antwortet die Liste GAR NICHT? Das ist „laden" bzw. „Auffrischung läuft" mit Cache. */
  listeHaengt: boolean;
  /** Die Suche scheitert oder findet nichts. */
  sucheStoerung: boolean;
  /**
   * EINMALIG: der Schreibvorgang wird ausgeführt UND die Übertragung bricht danach ab. Das ist der
   * Fall, für den `beitragSchluessel` überhaupt existiert — der Mensch weiß nicht, ob es geklappt
   * hat, und sendet erneut (G3).
   */
  uebertragungBricht: boolean;
  /**
   * EINMALIG: der Widerruf wird ausgeführt UND die Übertragung bricht danach ab — derselbe unklare
   * Ausgang wie `uebertragungBricht`, nur auf dem zweiten Schreibweg (BEN-Korrekturpflicht 1:
   * „auch beim Widerruf").
   */
  widerrufBricht: boolean;
  /**
   * Der Widerruf wird mit 200 beantwortet — und die Kante bleibt AKTIV. Das ist die Bühne für die
   * Frage, die BEN in Runde 3 gestellt hat: eine angekommene Antwort ist keine Zustandsänderung.
   * Ohne diesen Schalter liesse sich „Widerrufen" auch dann melden, wenn der Server widerspricht.
   */
  widerrufOhneWirkung: boolean;
  /**
   * Der Server antwortet mit der ERSTEN vorhandenen Kante statt mit der angeforderten. Das ist die
   * Bühne für die zweite Verteidigungslinie: eine Antwort, die nicht der Auftrag ist, darf nicht
   * als Erfolg des Auftrags erscheinen (BEN2). Ohne diesen Schalter liesse sich der Schutz nicht
   * rot fahren — und ein Schutz, den niemand rot bekommt, ist keiner.
   */
  antwortVerdreht: boolean;
  beziehungen(koId: string): Promise<KuratierteKanten>;
  setzen(koId: string, body: BeziehungSetzenBody): Promise<KuratierteKanteAnsicht>;
  widerruf(kanteId: string, body: { version: number }): Promise<KuratierteKanteAnsicht>;
  suche(params: { q?: string }): Promise<Record<string, unknown>[]>;
  ko(id: string): Promise<Record<string, unknown>>;
}

/**
 * `abweichung` aus dem VERGLEICH, nicht aus dem Testdatum.
 * `unbekannt` gewinnt über alles: fehlt die beurteilte Fassung, gibt es nichts zu vergleichen, und
 * eine „unveraendert"-Aussage wäre erfunden (Nachtrag 2 §1).
 */
export function abweichungAus(
  beurteilt: BeziehungBeurteilt | null,
  aktuellQuelle: number,
  aktuellZiel: number,
): BeziehungAbweichung {
  if (beurteilt === null) {
    return "unbekannt";
  }
  return beurteilt.quelleVersion !== aktuellQuelle || beurteilt.zielVersion !== aktuellZiel
    ? "geaendert"
    : "unveraendert";
}

export function neuerPruefstand(): Pruefstand {
  const p: Pruefstand = {
    kanten: [],
    quelleVersion: 4,
    zielVersionen: new Map([
      [ZIEL_A.id, ZIEL_A.version],
      [ZIEL_B.id, ZIEL_B.version],
    ]),
    gesendet: [],
    schluessel: new Map(),
    stoerung: null,
    widerrufStoerung: null,
    listeStoerung: false,
    listeHaengt: false,
    sucheStoerung: false,
    uebertragungBricht: false,
    widerrufBricht: false,
    widerrufOhneWirkung: false,
    antwortVerdreht: false,

    async beziehungen(koId: string): Promise<KuratierteKanten> {
      if (p.listeHaengt) {
        return new Promise<never>(() => undefined);
      }
      if (p.listeStoerung) {
        throw new ApiError(500, "SERVER_ERROR", "Prüfstand: Liste gestört");
      }
      // Nur AKTIVE Kanten mit sichtbarem Gegenstück — widerrufene erscheinen nicht und werden auch
      // nicht gezählt (`total` nach dem Trimm, wie im Vertrag).
      const ansichten = p.kanten.filter((k) => k.status === "aktiv").map((k) => ansichtVon(p, k));
      return { koId, kanten: ansichten, total: ansichten.length };
    },

    async setzen(_koId: string, body: BeziehungSetzenBody): Promise<KuratierteKanteAnsicht> {
      p.gesendet.push(body);
      if (p.stoerung === "haengt") {
        return new Promise<never>(() => undefined);
      }
      if (p.stoerung === "403") {
        throw new ApiError(403, "FORBIDDEN", "Prüfstand: kein Schreibrecht");
      }
      if (p.stoerung === "409") {
        throw new ApiError(409, "CONFLICT", "Prüfstand: Versionskonflikt");
      }
      if (p.stoerung === "netz") {
        throw new Error("Prüfstand: Verbindung abgebrochen");
      }
      const zielVersion = p.zielVersionen.get(body.zielId);
      if (
        p.stoerung === "409-stand" ||
        body.gesehen.quelleVersion !== p.quelleVersion ||
        zielVersion === undefined ||
        body.gesehen.zielVersion !== zielVersion
      ) {
        // Der Server nennt in dieser Antwort die AKTUELLEN Versionen; der Client liest sie über
        // seine aufgefrischten Abfragen, nicht aus dem Fehlertext (der könnte einen geschützten
        // Titel tragen — Vertrag Nr. 3).
        throw new ApiError(409, "stand_veraltet", "Prüfstand: Stand veraltet");
      }
      // IDEMPOTENZ: derselbe Vorgangsschlüssel führt auf DIESELBE Kante.
      const bekannt = p.schluessel.get(body.beitragSchluessel);
      const vorhanden =
        (bekannt !== undefined ? p.kanten.find((k) => k.id === bekannt) : undefined) ??
        // DEDUP: dieselbe fachliche Beziehung (Paar + Art) ist EINE Beziehung.
        p.kanten.find(
          (k) => k.gegenstueck.id === body.zielId && k.art === body.art && k.status === "aktiv",
        );
      const kante =
        vorhanden ??
        (() => {
          const neu: Kantenbestand = {
            id: `k${p.kanten.length + 1}`,
            art: body.art,
            richtung: body.richtung,
            ...(body.richtung === "gerichtet" ? { rolle: "quelle" as KantenRolle } : {}),
            gegenstueck: {
              id: body.zielId,
              title: zielTitel(body.zielId),
              status: "validiert",
            },
            urheber: "Pedi",
            gesetztAm: "2026-09-15T18:00:00.000Z",
            version: 1,
            status: "aktiv",
            beurteilt: {
              quelleVersion: body.gesehen.quelleVersion,
              zielVersion: body.gesehen.zielVersion,
              quelleFassungAm: "2026-09-15T17:00:00.000Z",
              zielFassungAm: "2026-09-15T17:30:00.000Z",
            },
          };
          p.kanten.push(neu);
          return neu;
        })();
      p.schluessel.set(body.beitragSchluessel, kante.id);
      if (p.uebertragungBricht) {
        // GESCHRIEBEN — und die Antwort kommt nicht an. Genau hier trägt der Vorgangsschlüssel,
        // und genau hier darf die Fläche keine Nicht-Speicherung behaupten (BEN1).
        p.uebertragungBricht = false;
        throw new Error("Prüfstand: Antwort verloren");
      }
      if (p.antwortVerdreht) {
        // Eine Antwort, die NICHT der Auftrag ist — die erste Kante des Bestands statt der eigenen.
        const erste = p.kanten[0];
        if (erste) {
          return ansichtVon(p, erste);
        }
      }
      return ansichtVon(p, kante);
    },

    async widerruf(kanteId: string, body: { version: number }): Promise<KuratierteKanteAnsicht> {
      if (p.widerrufStoerung === "403") {
        throw new ApiError(403, "FORBIDDEN", "Prüfstand: kein Schreibrecht");
      }
      const kante = p.kanten.find((k) => k.id === kanteId);
      if (!kante) {
        throw new ApiError(404, "NOT_FOUND", "Prüfstand: unbekannte Kante");
      }
      // Compare-and-Set: ein veralteter Stand wird sicher abgelehnt, nicht still überschrieben.
      if (p.widerrufStoerung === "409" || body.version !== kante.version) {
        throw new ApiError(409, "CONFLICT", "Prüfstand: veraltete Version");
      }
      if (p.widerrufOhneWirkung) {
        // 200 — und der Bestand bleibt, wie er war. Die Antwort trägt `status: "aktiv"`.
        return ansichtVon(p, kante);
      }
      kante.status = "widerrufen";
      kante.version += 1;
      if (p.widerrufBricht) {
        // WIDERRUFEN — und die Antwort kommt nicht an. Auch hier gilt: keine Behauptung über den
        // Bestand, nur die ehrliche Auskunft, dass nichts angekommen ist.
        p.widerrufBricht = false;
        throw new Error("Prüfstand: Antwort verloren");
      }
      return { ...ansichtVon(p, kante), geaendertAm: "2026-09-15T18:30:00.000Z" };
    },

    async suche(params: { q?: string }): Promise<Record<string, unknown>[]> {
      if (p.sucheStoerung) {
        throw new ApiError(500, "SERVER_ERROR", "Prüfstand: Suche gestört");
      }
      const q = (params.q ?? "").toLowerCase();
      return [ZIEL_A, ZIEL_B]
        .map((z) => ({ ...z, version: p.zielVersionen.get(z.id) ?? z.version }))
        .filter((z) => q.length === 0 || z.title.toLowerCase().includes(q))
        .map(alsKo);
    },

    async ko(id: string): Promise<Record<string, unknown>> {
      if (id === QUELLE_ID) {
        return alsKo({ id, title: QUELLE_TITEL, version: p.quelleVersion });
      }
      return alsKo({ id, title: zielTitel(id), version: p.zielVersionen.get(id) ?? 1 });
    },
  };
  return p;
}

function zielTitel(id: string): string {
  return id === ZIEL_A.id ? ZIEL_A.title : id === ZIEL_B.id ? ZIEL_B.title : id;
}

/**
 * Die Leseansicht: `aktuell` frisch aus dem Bestand, `abweichung` aus dem Vergleich.
 *
 * JOB 4336 · `aktuell` ist nach der GESPEICHERTEN Kante ausgerichtet und nicht nach dem geöffneten
 * Eintrag — Zeile für Zeile wie `aktuellVon` im Dienst (`kanten-service.ts:598-607`): trägt die
 * Kante `rolle: "ziel"`, dann IST der geöffnete Eintrag das Ziel der Kante, seine eigene Fassung
 * steht in `zielVersion` und die des Gegenstücks in `quelleVersion`. Bis hierher setzte der
 * Prüfstand `quelleVersion` unbesehen auf die Fassung des geöffneten Eintrags — ein Fall aus der
 * ZIEL-Sicht war damit in sich widersprüchlich (die Kachel hätte eine andere eigene Fassung
 * genannt als das Formular darunter), und ein Prüfstand, der die Seiten anders herum füllt als der
 * Dienst, kann eine Vertauschung an der Fläche gar nicht zeigen.
 */
function ansichtVon(p: Pruefstand, k: Kantenbestand): KuratierteKanteAnsicht {
  const eigeneFassung = p.quelleVersion;
  const gegenFassung = p.zielVersionen.get(k.gegenstueck.id) ?? 1;
  const aktuellQuelle = k.rolle === "ziel" ? gegenFassung : eigeneFassung;
  const aktuellZiel = k.rolle === "ziel" ? eigeneFassung : gegenFassung;
  return {
    id: k.id,
    art: k.art,
    richtung: k.richtung,
    ...(k.rolle ? { rolle: k.rolle } : {}),
    gegenstueck: k.gegenstueck,
    urheber: k.urheber,
    gesetztAm: k.gesetztAm,
    status: k.status,
    version: k.version,
    herkunft: "kuratiert",
    beurteilt: k.beurteilt,
    aktuell: { quelleVersion: aktuellQuelle, zielVersion: aktuellZiel },
    abweichung: abweichungAus(k.beurteilt, aktuellQuelle, aktuellZiel),
  };
}

// ------------------------------------------------------------------------------------------------
// FESTE BESTÄNDE FÜR EINZELNE FÄLLE
// ------------------------------------------------------------------------------------------------

/**
 * R1: eine GERICHTETE `ersetzt`-Kante mit der Rolle `quelle` und eine UNGERICHTETE `ergaenzt`-Kante.
 * Die zweite ist der Gegenfall: für sie darf kein Richtungssatz entstehen.
 */
export function zweiAktiveKanten(): Kantenbestand[] {
  return [
    {
      id: "k-ersetzt",
      art: "ersetzt",
      richtung: "gerichtet",
      rolle: "quelle",
      gegenstueck: { id: ZIEL_A.id, title: ZIEL_A.title, status: "validiert" },
      urheber: "Pedi",
      gesetztAm: "2026-09-14T09:15:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 4,
        zielVersion: 2,
        quelleFassungAm: "2026-09-14T09:00:00.000Z",
        zielFassungAm: "2026-09-14T09:05:00.000Z",
      },
    },
    {
      id: "k-ergaenzt",
      art: "ergaenzt",
      richtung: "ungerichtet",
      gegenstueck: { id: ZIEL_B.id, title: ZIEL_B.title, status: "offen" },
      urheber: "Anna",
      gesetztAm: "2026-09-14T10:20:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 4,
        zielVersion: 9,
        quelleFassungAm: "2026-09-14T10:00:00.000Z",
        zielFassungAm: "2026-09-14T10:10:00.000Z",
      },
    },
  ];
}

/** R3: eine Kante, deren beurteilte Fassung 3 war — der Bestand steht heute auf 5. */
export function kanteMitAlterFassung(): Kantenbestand[] {
  return [
    {
      id: "k-alt",
      art: "gehoert_zu",
      richtung: "gerichtet",
      rolle: "quelle",
      gegenstueck: { id: ZIEL_A.id, title: ZIEL_A.title, status: "validiert" },
      urheber: "Pedi",
      gesetztAm: "2026-09-10T08:00:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 3,
        zielVersion: 2,
        quelleFassungAm: "2026-09-10T07:00:00.000Z",
        zielFassungAm: "2026-09-10T07:30:00.000Z",
      },
    },
  ];
}

/**
 * R3c (JOB 4336): DIESELBE gerichtete Beziehung aus der ZIEL-Sicht — der geöffnete Eintrag ist das
 * Ziel der Kante, nicht ihre Quelle. Beurteilt wurde an Fassung 3 der Quelle und Fassung 2 des
 * Ziels; welche Fassungen heute gelten, setzt der Fall selbst (`quelleVersion` = die eigene,
 * `zielVersionen` = die des Gegenstücks).
 *
 * Die Zahlen sind ABSICHTLICH auf beiden Seiten verschieden: mit gleichen Fassungen bliebe eine
 * Vertauschung der Seiten unsichtbar, und der Test wäre grün, ohne die Zuordnung zu prüfen (BEN,
 * JOB 4153 R5: „Test mit unterschiedlichen Quell-/Zielfassungen").
 */
export function kanteAusZielsicht(): Kantenbestand[] {
  return [
    {
      id: "k-ziel-alt",
      art: "gehoert_zu",
      richtung: "gerichtet",
      rolle: "ziel",
      gegenstueck: { id: ZIEL_A.id, title: ZIEL_A.title, status: "validiert" },
      urheber: "Pedi",
      gesetztAm: "2026-09-11T08:00:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 3,
        zielVersion: 2,
        quelleFassungAm: "2026-09-11T07:00:00.000Z",
        zielFassungAm: "2026-09-11T07:30:00.000Z",
      },
    },
  ];
}

/**
 * R3c (JOB 4336): die Ziel-Sicht im Fall `unveraendert`, mit UNGLEICHEN Fassungen (Quelle 4,
 * Ziel 7). Nur so ist prüfbar, ob der Vermerk die eigene Fassung (7) zuerst nennt — bei gleichen
 * Zahlen wäre jede Reihenfolge richtig.
 */
export function kanteAusZielsichtUnveraendert(): Kantenbestand[] {
  return [
    {
      id: "k-ziel-gleich",
      art: "ersetzt",
      richtung: "gerichtet",
      rolle: "ziel",
      gegenstueck: { id: ZIEL_A.id, title: ZIEL_A.title, status: "validiert" },
      urheber: "Anna",
      gesetztAm: "2026-09-12T08:00:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 4,
        zielVersion: 7,
        quelleFassungAm: "2026-09-12T07:00:00.000Z",
        zielFassungAm: "2026-09-12T07:30:00.000Z",
      },
    },
  ];
}

/**
 * R3c (JOB 4336): eine GERICHTETE Kante, deren `rolle` der Vertrag weglässt (`kanten-service.ts:571`
 * setzt sie nur, wenn es eine Aussage GIBT). Dann ist unbekannt, welche der beiden Fassungen zum
 * geöffneten Eintrag gehört — der Vermerk darf keine Seite als „diesen Eintrag" ausgeben.
 */
export function kanteGerichtetOhneRolle(): Kantenbestand[] {
  return [
    {
      id: "k-ohne-rolle",
      art: "gehoert_zu",
      richtung: "gerichtet",
      gegenstueck: { id: ZIEL_A.id, title: ZIEL_A.title, status: "validiert" },
      urheber: "Pedi",
      gesetztAm: "2026-09-13T08:00:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 3,
        zielVersion: 2,
        quelleFassungAm: "2026-09-13T07:00:00.000Z",
        zielFassungAm: "2026-09-13T07:30:00.000Z",
      },
    },
  ];
}

/** R3b: eine Bestandskante OHNE beurteilte Fassung — der Bezug ist und bleibt unbekannt. */
export function kanteOhneBeurteilteFassung(): Kantenbestand[] {
  return [
    {
      id: "k-ohne",
      art: "beispiel_fuer",
      richtung: "gerichtet",
      rolle: "ziel",
      gegenstueck: { id: ZIEL_B.id, title: ZIEL_B.title, status: "offen" },
      urheber: "Anna",
      gesetztAm: "2026-08-01T08:00:00.000Z",
      version: 1,
      status: "aktiv",
      beurteilt: null,
    },
  ];
}

/** R1-Variante: eine `widerspricht`-Kante — an ihr muss die fachliche Grenze sichtbar stehen. */
export function kanteWiderspricht(): Kantenbestand[] {
  return [
    {
      id: "k-wider",
      art: "widerspricht",
      richtung: "gerichtet",
      rolle: "quelle",
      gegenstueck: { id: ZIEL_A.id, title: ZIEL_A.title, status: "validiert" },
      urheber: "Pedi",
      gesetztAm: "2026-09-12T11:00:00.000Z",
      version: 3,
      status: "aktiv",
      beurteilt: {
        quelleVersion: 4,
        zielVersion: 2,
        quelleFassungAm: "2026-09-12T10:00:00.000Z",
        zielFassungAm: "2026-09-12T10:30:00.000Z",
      },
    },
  ];
}

// ------------------------------------------------------------------------------------------------
// DER GRAPH (R9/R10) — dieselbe Antwort, zwei Kantenmengen.
// ------------------------------------------------------------------------------------------------

export const GRAPH_KNOTEN: readonly { id: string; title: string }[] = [
  { id: "g1", title: "Kaltstart: Vorwärmung aktivieren" },
  { id: "g2", title: "Vorwärmung bei Kaltstart nicht nötig" },
  { id: "g3", title: "Wartungsplan Halle 2" },
];

export const GRAPH_TAGKANTEN: readonly { a: string; b: string; via: string }[] = [
  { a: "g1", b: "g2", via: "kaltstart" },
  { a: "g2", b: "g3", via: "wartung" },
];

export const GRAPH_KURATIERT: readonly GraphKuratierteKante[] = [
  {
    a: "g1",
    b: "g2",
    art: "widerspricht",
    richtung: "gerichtet",
    status: "aktiv",
    herkunft: "kuratiert",
  },
  {
    a: "g1",
    b: "g3",
    art: "gehoert_zu",
    richtung: "ungerichtet",
    status: "aktiv",
    herkunft: "kuratiert",
  },
];

/** Die Antwort MIT kuratierter Menge (R9). */
export function graphMitKuratierten(): Graph {
  return {
    nodes: [...GRAPH_KNOTEN],
    edges: [...GRAPH_TAGKANTEN],
    kuratierteKanten: [...GRAPH_KURATIERT],
  };
}

/** Die Antwort OHNE kuratierte Menge (R10) — ein Server ohne die Erweiterung aus JOB 4151. */
export function graphOhneKuratierte(): Graph {
  return { nodes: [...GRAPH_KNOTEN], edges: [...GRAPH_TAGKANTEN] };
}

export function graphKos(): Record<string, unknown>[] {
  return GRAPH_KNOTEN.map((k) => alsKo({ id: k.id, title: k.title, version: 1 }));
}
