// ================================================================================================
// JOB 3281 · WORD-VERGLEICH — DIE BUEHNE: EIN ECHTES PANEL, EIN NACHGEBAUTER WORD-HOST.
// ================================================================================================
//
// Gemessen wird am AUSGELIEFERTEN Aufgabenfenster: `createKlaraPanel`
// (tests/app/klara-panel-fixture.ts) baut den Rumpf von
// `apps/web/public/word-addin/taskpane.html` ins jsdom-DOM und fuehrt das vollstaendige
// Inline-Skript aus. Diese Datei ergaenzt genau das, was jene Fixture bewusst NICHT stellt:
// `window.Word`.
//
// WARUM DIE FIXTURE UNVERAENDERT BLEIBT. Ihr Kopf sagt woertlich: „`Word` bleibt bewusst
// ungesetzt: der Auswahl-Weg braucht es nicht, und ein halb gefaelschtes Word.run wuerde einen
// Pfad vortaeuschen, den dieser Test nicht deckt." Dieser Test deckt ihn — also steht der
// Word-Host HIER, vollstaendig und pruefbar, und wird NACH dem Panelstart gesetzt. Das geht,
// weil der Vergleichsweg `window.Word` erst beim Klick liest (kein Schnappschuss beim Laden);
// dass er das wirklich tut, ist selbst eine Zusicherung dieser Datei (Fall W0).
//
// WAS DER HOST MITSCHREIBT, damit die Zusagen des Auftrags messbar sind:
//   · `syncs`    — wie oft `context.sync()` lief (ein Lauf ohne Schreibzugriff bleibt bei 0 Farben);
//   · `schreib`  — JEDER Text-Schreibzugriff (`insertText`, `insertHtml`, `insertParagraph`,
//                  `insertOoxml`). Der Vergleichsweg darf hier NIE auftauchen (§5.2/§6e).
//   · `gewaehlt` — die Absaetze, auf denen `range.select()` gerufen wurde (§5.3, Sprung).
//   · `farben`   — die Hervorhebungsfarbe je Absatz, wie sie nach dem Lauf im Dokument steht.
//
// KEINE ATTRAPPE DES PRUEFLINGS: der Host bildet nur die Office.js-Formen nach, die der
// Vergleichsweg benutzt (`Word.run`, `context.document.body.paragraphs`, `load`, `sync`,
// `paragraph.text`, `paragraph.font.highlightColor`, `paragraph.getRange().select()`). Die
// Einstufung selbst faellt im Panel, nicht hier.
import {
  type FakeReplyInit,
  type FakeRoute,
  type KlaraPanel,
  createKlaraPanel,
} from "../app/klara-panel-fixture";

/** Was der Host von einem Absatz weiss — Text und Hervorhebung, mehr braucht der Weg nicht. */
export interface BuehneAbsatz {
  text: string;
  /** `null` = keine Hervorhebung. Genau das liefert Word fuer einen unmarkierten Absatz. */
  highlightColor?: string | null;
}

export interface WordMitschrift {
  syncs: number;
  /** Jeder Schreibzugriff auf den Text — muss im Vergleichsweg leer bleiben. */
  schreib: Array<{ absatz: number; art: string }>;
  /** Absatznummern, auf denen `select()` lief. */
  gewaehlt: number[];
  /** Wie oft `Word.run` ueberhaupt gerufen wurde. */
  laeufe: number;
}

export interface WordBuehne {
  Word: Record<string, unknown>;
  mitschrift: WordMitschrift;
  /** Die Farben, wie sie JETZT im Dokument stehen — `null` heisst „keine Hervorhebung". */
  farben(): Array<string | null>;
  /** Die Texte, wie sie JETZT im Dokument stehen (der Host aendert sie nie von selbst). */
  texte(): string[];
  /** Ein Absatz wird von Hand umgeschrieben — die Lage nach einer Textaenderung (§ Nachfuehrung). */
  aendere(nr: number, text: string): void;
  /** Ein Absatz wird von Hand entfernt — Absatznummern verschieben sich. */
  entferne(nr: number): void;
  /** Ein MENSCH setzt eine Hervorhebung — waehrend oder nach dem Lauf (Ben 08.09., Pflicht 2). */
  faerbe(nr: number, farbe: string | null): void;
  /**
   * Codex-Vorpruefung R2 (08.09., 16:10), zweite Pruefluecke: der `sync`, der das Faerben
   * BESTAETIGT, kommt in Word nicht sofort zurueck. `haelteSync` haelt genau diesen einen Aufruf
   * fest; hier wird er wieder losgelassen — `true` = Word hat bestaetigt, `false` = der Schreiblauf
   * ist gescheitert. Ohne diesen Griff waere „waehrend der Schreiblauf noch haengt, laeuft schon
   * der naechste Vergleich" nicht messbar, weil ein sofort aufgeloester `sync` das Fenster,
   * in dem sich die beiden Laeufe ueberholen, gar nicht erst oeffnet.
   */
  syncFreigeben(ok: boolean): void;
  /** Haengt gerade ein `sync` fest? Zusicherung, dass der Fall wirklich hergestellt ist. */
  syncHaengt(): boolean;
}

interface HostAbsatz {
  text: string;
  font: { highlightColor: string | null };
  getRange(): { select(): void };
  select(): void;
  insertText(text: string): void;
  insertHtml(html: string): void;
  insertParagraph(text: string): void;
  insertOoxml(xml: string): void;
}

/**
 * Der Word-Host. `laufWirft` laesst `Word.run` scheitern — die ehrliche Lage „Word hat keinen
 * lesbaren Text geliefert", die ohne diesen Schalter nicht messbar waere. `wirftAbLauf` laesst
 * erst den n-ten Lauf scheitern: so ist der SCHREIBLAUF am Ende einzeln pruefbar (Lauf 1 liest,
 * Lauf 2 faerbt) — der Fehlerpfad, den Ben am 08.09. als ungeprueft benannt hat.
 *
 * `haelteSync` haelt den n-ten `sync()` fest, bis `syncFreigeben(ok)` ihn loslaesst. Gezaehlt wird
 * ueber ALLE Laeufe hinweg, wie `mitschrift.syncs`: ein vollstaendiger Vergleich braucht vier
 * (Lesen: 1 und 2, Faerben: 3 und 4), der bestaetigende Schreib-`sync` ist also der vierte.
 */
export function createWordBuehne(
  absaetze: readonly BuehneAbsatz[],
  optionen: { laufWirft?: boolean; wirftAbLauf?: number; haelteSync?: number } = {},
): WordBuehne {
  const mitschrift: WordMitschrift = { syncs: 0, schreib: [], gewaehlt: [], laeufe: 0 };
  // Der festgehaltene `sync`: solange er hier steht, hat der Aufrufer noch keine Antwort.
  let haltend: { weiter: () => void; scheitern: () => void } | null = null;
  const items: HostAbsatz[] = absaetze.map((a, nr) => {
    const eintrag: HostAbsatz = {
      text: a.text,
      font: { highlightColor: a.highlightColor ?? null },
      getRange: () => ({
        select: (): void => {
          mitschrift.gewaehlt.push(items.indexOf(eintrag));
        },
      }),
      select: (): void => {
        mitschrift.gewaehlt.push(items.indexOf(eintrag));
      },
      insertText: (): void => {
        mitschrift.schreib.push({ absatz: nr, art: "insertText" });
      },
      insertHtml: (): void => {
        mitschrift.schreib.push({ absatz: nr, art: "insertHtml" });
      },
      insertParagraph: (): void => {
        mitschrift.schreib.push({ absatz: nr, art: "insertParagraph" });
      },
      insertOoxml: (): void => {
        mitschrift.schreib.push({ absatz: nr, art: "insertOoxml" });
      },
    };
    return eintrag;
  });

  const paragraphs = {
    items,
    // `load` ist im echten Office.js die Ankuendigung, WELCHE Felder der naechste `sync` bringt.
    // Der Host haelt die Felder ohnehin bereit; gemessen wird, DASS geladen wird (Fall W0b).
    geladen: [] as string[],
    load(felder: string): void {
      paragraphs.geladen.push(felder);
    },
  };

  const context = {
    document: { body: { paragraphs } },
    sync(): Promise<void> {
      mitschrift.syncs += 1;
      if (optionen.haelteSync !== mitschrift.syncs) {
        return Promise.resolve();
      }
      return new Promise<void>((weiter, ab) => {
        haltend = {
          weiter: () => weiter(),
          scheitern: () => ab(new Error("Word hat den Schreiblauf nicht bestaetigt")),
        };
      });
    },
  };

  const Word: Record<string, unknown> = {
    run(rueckruf: (ctx: typeof context) => Promise<unknown>): Promise<unknown> {
      mitschrift.laeufe += 1;
      if (
        optionen.laufWirft === true ||
        (typeof optionen.wirftAbLauf === "number" && mitschrift.laeufe >= optionen.wirftAbLauf)
      ) {
        return Promise.reject(new Error("Word nicht erreichbar"));
      }
      try {
        return Promise.resolve(rueckruf(context));
      } catch (err) {
        return Promise.reject(err);
      }
    },
  };

  return {
    Word,
    mitschrift,
    farben: () => items.map((i) => i.font.highlightColor),
    texte: () => items.map((i) => i.text),
    aendere(nr, text): void {
      const ziel = items[nr];
      if (ziel !== undefined) {
        ziel.text = text;
      }
    },
    entferne(nr): void {
      items.splice(nr, 1);
    },
    faerbe(nr, farbe): void {
      const ziel = items[nr];
      if (ziel !== undefined) {
        ziel.font.highlightColor = farbe;
      }
    },
    syncFreigeben(ok): void {
      const offen = haltend;
      if (offen === null) {
        throw new Error("syncFreigeben ohne festgehaltenen sync — der Fall ist nicht hergestellt");
      }
      haltend = null;
      if (ok) {
        offen.weiter();
      } else {
        offen.scheitern();
      }
    },
    syncHaengt: () => haltend !== null,
  };
}

interface Globals {
  Word?: unknown;
  window: Record<string, unknown>;
}

/**
 * Panel starten UND den Word-Host anhaengen. Die Reihenfolge ist Absicht: `createKlaraPanel`
 * entfernt `Word`, also wird der Host DANACH gesetzt — genau die Lage, in der ein Panel den
 * Host erst beim Klick liest. `restore()` der Fixture nimmt ihn wieder weg (`hadWord === false`).
 */
export function starteMitWord(
  routen: Record<string, FakeReplyInit | FakeRoute>,
  buehne: WordBuehne,
  weiter: { selectionText?: string } = {},
): KlaraPanel {
  const panel = createKlaraPanel({ routes: routen, ...weiter });
  const globals = globalThis as unknown as Globals;
  globals.Word = buehne.Word;
  globals.window.Word = buehne.Word;
  return panel;
}
