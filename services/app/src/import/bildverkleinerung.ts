// ================================================================================================
// JOB 3400 · M5c-b-R2 — DIE SERVERSEITIGE BILDABLEITUNG FÜR DEN ADD-IN-IMPORT
// ================================================================================================
//
// WAS HIER PASSIERT: `POST /api/drafts/from-docx` reichte die Bildbytes einer Word-Datei bisher
// unverändert in den gespeicherten Entwurf durch (`capture-routes.ts`, `mapImage: async (src) =>
// src`). Ein Dokument mit einem Foto legte damit einen Entwurf mit mehreren Megabyte `bodyHtml`
// an. Dieses Modul tritt an genau diese Stelle: es nimmt die von mammoth eingebettete
// `data:`-Bildquelle entgegen und gibt eine ABGELEITETE, für die Anzeige angemessene
// `data:`-Bildquelle zurück.
//
// WARUM SERVERSEITIG UND WARUM `sharp`: Der Browser-Importweg verkleinert über ein Canvas
// (`apps/web/src/lib/files.ts`). Ein Canvas gibt es hier nicht — `capture-routes.ts` nutzt
// ausdrücklich den DOM-FREIEN Kern `apps/web/src/lib/docx.ts`. Die Bibliothekswahl ist entschieden
// (Codex, 09.09.2026, Entscheidung 60): `sharp`, ein begrenzter Import-Fix, kein vorgeschalteter
// Ablehn-Job.
//
// WARUM NICHT `imageBudgetBytes`: Der Budgetzweig in `docx.ts:1199-1216` LÄSST überzählige Bilder
// WEG (`droppedImages`). Gemessen (BEN, 3229 R2): mit `imageBudgetBytes: 3500000` schrumpft
// `bodyHtml` auf 7 Bytes — „das Bild ist restlos weg". Verkleinern heisst kleiner machen, nicht
// wegnehmen; der Einhängepunkt ist deshalb `mapImage` und nicht das Budget.
//
// DAS ORIGINAL BLEIBT UNANGETASTET: Verkleinert wird ausschliesslich die Ableitung, die in den
// Entwurf geschrieben wird. Die hochgeladene `.docx` wird gelesen und nicht verändert; dieses
// Modul sieht sie nie, es sieht nur eine Zeichenkette.
//
// EHRLICHKEIT IM FEHLERFALL: Kann ein Bild nicht abgeleitet werden (defekt, unbekanntes Format,
// jenseits einer Grenze), wird es NICHT weggeworfen. Es bleibt in seiner Originalquelle stehen —
// genau so, wie es ohne diesen Durchgang im Entwurf gestanden hätte — und der Bericht nennt den
// Grund beim Namen. Ein einzelnes schlechtes Bild kippt damit weder den Import noch das Dokument.
// Seit Runde 3 steht dieser Grund zusätzlich AM BETROFFENEN BILD im gespeicherten Entwurf
// (`bildausfaelleVermerken`, unten) — eine Summe in der Importantwort sagt „ein Bild ist defekt",
// nicht welches.
import sharp from "sharp";

// ================================================================================================
// DIE GRENZEN — jede an genau EINER Stelle, mit Begründung.
// ================================================================================================

/**
 * Die längste Kante der Ableitung in Pixeln. Der Entwurf wird in der Web-Oberfläche und im
 * Word-Panel in einer Textspalte angezeigt; 1280 Pixel decken auch eine Netzhautanzeige einer
 * solchen Spalte ab. Kleinere Bilder werden NICHT vergrössert (`withoutEnlargement`).
 */
export const BILD_MAX_KANTE = 1280;

/**
 * Die Qualitätsstufe der Ableitung. WebP, weil es als einziges der vom Server-Sanitizer erlaubten
 * Formate (`services/structure/src/sanitize.ts`, png|jpeg|gif|webp) sowohl Fotos gut packt ALS AUCH
 * Transparenz trägt — ein Format für alle Fälle statt zweier Zweige, die auseinanderlaufen können.
 */
export const BILD_QUALITAET = 80;

/**
 * Grösse, unter der eine Quelle bereits als angemessene Ableitung gilt. Ein Bild, das klein ist
 * UND innerhalb der Zielkante liegt, wird nicht neu kodiert: eine erneute verlustbehaftete
 * Kodierung kostete Qualität, ohne Bytes zu sparen, und kann kleine Grafiken sogar vergrössern.
 */
export const BILD_KLEIN_GENUG_BYTES = 64 * 1024;

/**
 * Obergrenze der EINGABE in Bytes. Darüber wird gar nicht erst dekodiert. Die entpackte `.docx`
 * darf bis zu `DOCX_ENTPACKT_MAX_BYTES` (200 MiB) gross sein; ein einzelnes Bild daraus in den
 * Dekodierer zu geben, hiesse dessen Speicherbedarf zu vervielfachen. 32 MiB liegt über jedem
 * Bild, das in einem Textdokument sinnvoll ist, und weit unter der Dokumentgrenze.
 */
export const BILD_MAX_EINGABE_BYTES = 32 * 1024 * 1024;

/**
 * Obergrenze der EINGABE in Pixeln (`limitInputPixels`, https://sharp.pixelplumbing.com/api-constructor/).
 * Sie ist die eigentliche Abwehr gegen die Pixelbombe: ein PNG, dessen Kopf 30000×30000 nennt, ist
 * als DATEI winzig und käme an jeder Bytegrenze vorbei — dekodiert wären es 2,7 GB. sharp prüft
 * diese Zahl am Kopf, BEVOR Speicher angefordert wird. 40 Megapixel liegen über jeder heutigen
 * Kamera und drei Grössenordnungen unter dem Schaden.
 */
export const BILD_MAX_EINGABE_PIXEL = 40_000_000;

/**
 * Zeitgrenze JE BILD. Sie begrenzt, wie lange der Import auf ein Bild WARTET; die Arbeit in
 * libvips bricht sie nicht ab, dafür gibt es keinen Zugang. Dass daraus keine Lücke wird, hängt an
 * ZWEI Dingen und nicht an gutem Willen: die Arbeit selbst ist durch `BILD_MAX_EINGABE_PIXEL` und
 * `BILD_MAX_EINGABE_BYTES` nach oben begrenzt, UND ihr Platz in der Warteschlange bleibt belegt,
 * bis sie wirklich fertig ist (s. den Block „DIE WARTESCHLANGE" unten). Ein abgelaufenes Bild
 * verschwindet damit aus dem Warten, nicht aus der Buchhaltung.
 * Sie liegt deutlich unter `DOCX_UMWANDLUNG_TIMEOUT_MS` (30 s), damit ein einzelnes Bild nicht die
 * ganze Frist des Imports aufbraucht.
 */
export const BILD_ZEITGRENZE_MS = 8_000;

/**
 * Wie viele Bilder im GANZEN PROZESS gleichzeitig in sharp sein dürfen. Der heutige Aufrufer
 * (`mapInlineImages`, `apps/web/src/lib/docx.ts:226-241`) ruft `mapImage` NACHEINANDER auf, und die
 * Route lässt ohnehin nur einen Import zur Zeit in die Umwandlung (Slot-Claim, `docxOnRequest`) —
 * die Grenze senkt heute also nichts, sie sichert zu. Sie steht trotzdem hier und nicht im
 * Aufrufer, weil die Zusage „nicht alle Bilder eines Dokuments gleichzeitig durch sharp" zu diesem
 * Modul gehört und nicht davon abhängen darf, wie ein fremder Aufrufer schleift.
 */
export const BILD_GLEICHZEITIG = 2;

/**
 * Arbeitsfäden je libvips-Umwandlung. Ohne diese Zeile öffnet sharp so viele Fäden, wie der
 * Rechner Kerne hat — auf einem Rechner, den sich Tor, Bahnen und Betrieb teilen, ist das zu viel
 * für eine Nebenaufgabe des Imports.
 */
export const BILD_LIBVIPS_FAEDEN = 2;

sharp.concurrency(BILD_LIBVIPS_FAEDEN);
// Der libvips-Zwischenspeicher hält Zwischenbilder für WIEDERHOLTE Operationen vor. Hier läuft
// jedes Bild genau einmal durch; der Speicher brächte also keinen Treffer, sondern nur Belegung.
// Ausschalten ist die dritte Grenze neben Pixeln und Bytes: sie deckelt, was NACH der Arbeit
// liegen bleibt.
sharp.cache(false);

// ================================================================================================
// DER BERICHT — die Zahlen, mit denen die Route ehrlich bleibt.
// ================================================================================================

/** Warum ein Bild seine Originalquelle behalten hat. Ein Wert je Fall, kein Freitext. */
export type Uebersprungsgrund =
  /** Keine eingebettete `data:`-Bildquelle (z. B. ein Object-Store-Pfad) — nichts zu tun. */
  | "keine-data-quelle"
  /** Bereits innerhalb Zielkante und Grössenschwelle. */
  | "schon-klein-genug"
  /** Über `BILD_MAX_EINGABE_BYTES` — gar nicht erst dekodiert. */
  | "eingabe-zu-gross"
  /** Nicht dekodierbar: defekt, unbekanntes Format oder über `BILD_MAX_EINGABE_PIXEL`. */
  | "nicht-dekodierbar"
  /** `BILD_ZEITGRENZE_MS` überschritten. */
  | "zeitgrenze"
  /** Die Ableitung war nicht kleiner als die Quelle — dann ist die Quelle die bessere Ableitung. */
  | "ableitung-nicht-kleiner";

/**
 * Die Teilmenge der Gründe, bei denen wirklich ETWAS SCHIEFGING und ein Mensch es erfahren muss.
 *
 * Die Unterscheidung ist keine Kosmetik: „schon-klein-genug" und „ableitung-nicht-kleiner" sind
 * ERFOLGE — das Bild ist heil, es war nur nichts zu tun. Ein Warnhinweis dafür wäre ein Fehlalarm
 * bei jedem zweiten Dokument und würde die echten Fälle unsichtbar machen. „keine-data-quelle" ist
 * ebenfalls kein Ausfall: dort liegt gar kein eingebettetes Bild vor.
 */
export type Ausfallgrund = Extract<
  Uebersprungsgrund,
  "eingabe-zu-gross" | "nicht-dekodierbar" | "zeitgrenze"
>;

const AUSFALLGRUENDE: ReadonlySet<Uebersprungsgrund> = new Set<Uebersprungsgrund>([
  "eingabe-zu-gross",
  "nicht-dekodierbar",
  "zeitgrenze",
]);

function istAusfall(grund: Uebersprungsgrund): grund is Ausfallgrund {
  return AUSFALLGRUENDE.has(grund);
}

/** Ein benanntes Bild, das keine Ableitung bekommen hat — mit seiner Nummer im Dokument. */
export interface Bildausfall {
  /**
   * Das wievielte eingebettete Bild des Dokuments (ab 1). Es ist DIESELBE Zählung, aus der
   * `wrapImagesInFigures` die Bildkennung `kw-img-<token>-N` bildet: beide zählen die
   * `<img src="data:…">` in Dokumentreihenfolge, und die Verkleinerung ändert an dieser Reihenfolge
   * nichts (eine Ableitung bleibt eine `data:`-Quelle, ein Ausfall behält seine).
   */
  readonly bildNummer: number;
  readonly grund: Ausfallgrund;
}

export interface Verkleinerungsbericht {
  /** Wie viele Bildquellen dieses Import-Lauf gesehen hat. */
  gesehen: number;
  /** Wie viele davon wirklich verkleinert wurden. */
  verkleinert: number;
  /** Bytes der Quellen der verkleinerten Bilder (Rohbytes, nicht Base64). */
  quellbytes: number;
  /** Bytes der Ableitungen derselben Bilder. */
  ableitungsbytes: number;
  /** Je übersprungenem Bild ein benannter Grund, in Reihenfolge des Auftretens. */
  uebersprungen: Uebersprungsgrund[];
  /**
   * Nur die echten AUSFÄLLE, jeder mit seiner Bildnummer. `uebersprungen` ist die Summe für die
   * Importantwort; diese Liste ist das, woran der Entwurf den Hinweis AN DAS RICHTIGE BILD hängt.
   */
  ausfaelle: Bildausfall[];
  /**
   * Wie viele Bilder in diesem Lauf HÖCHSTENS gleichzeitig in sharp waren — gemessen, nicht
   * behauptet. Ohne diese Zahl wäre `BILD_GLEICHZEITIG` eine Zusage, die niemand nachprüfen kann.
   */
  gleichzeitigMax: number;
}

export interface Bildverkleinerung {
  /** Passt auf `extractDocxRich`s `mapImage?: (src: string) => Promise<string>`. */
  readonly mapImage: (src: string) => Promise<string>;
  /** Der Stand NACH der Umwandlung. Vorher gelesen ist er unvollständig, nicht falsch. */
  readonly bericht: Verkleinerungsbericht;
}

// ================================================================================================
// DIE ARBEIT
// ================================================================================================

/** `data:<typ>;base64,<rumpf>` — alles andere ist keine eingebettete Quelle. */
const DATA_QUELLE = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]*)$/i;

/**
 * Die Eingabegrenzen für JEDEN sharp-Aufruf dieses Moduls, an einer Stelle. Sie stehen hier und
 * nicht zweimal im Text, damit die Dekodierprobe unten unter denselben Grenzen läuft wie die
 * Ableitung selbst — zwei Aufrufe mit verschiedenen Grenzen wären zwei verschiedene Zusagen.
 */
const EINGABE = { limitInputPixels: BILD_MAX_EINGABE_PIXEL, failOn: "error" } as const;

// ================================================================================================
// DIE WARTESCHLANGE — UND DIE ZWEI FEHLER, DIE SIE IN RUNDE 1 HATTE (Prüfbefund 09.09. 15:4x)
// ================================================================================================
//
// FEHLER 1 — DER PLATZ HING AM WARTEN STATT AN DER ARBEIT. Runde 1 schrieb
// `einreihen(() => mitZeitgrenze(ableiten(quelle)))`: Lief die Zeitgrenze ab, endete das WARTEN,
// der `finally`-Zweig gab den Platz frei — und `ableiten` rechnete in libvips WEITER. Bei fünf
// langsamen Bildern hätte die Zusage „höchstens zwei gleichzeitig" fünf gleichzeitige native
// Arbeiten zugelassen. Die Grenze hätte genau dann nicht gegriffen, wenn sie gebraucht wird.
// JETZT hängt die Freigabe an `lauf` selbst (`lauf.then(frei, frei)`): der Aufrufer wartet nach der
// Zeitgrenze nicht mehr, der PLATZ bleibt aber belegt, bis libvips wirklich fertig ist.
//
// FEHLER 2 — DIE SCHLANGE WAR PRO ANFRAGE. Jede Anfrage brachte ihre eigene Schlange mit; zehn
// gleichzeitige Importe hätten zwanzig native Arbeiten ergeben. Die Schlange steht deshalb JETZT
// im Modul und gilt für den ganzen Prozess. Der Bericht bleibt pro Anfrage — er misst, was DIESE
// Anfrage an der gemeinsamen Grenze gesehen hat.
//
// Bewusst kein Paket und keine Abstraktion: das ist der ganze Mechanismus, und er steht neben den
// Zahlen, die ihn begrenzen.
interface Warteschlange {
  /**
   * Startet `arbeit`, sobald ein Platz frei ist, und wartet höchstens `zeitgrenzeMs` auf sie.
   * `melden` bekommt bei jedem Start den Stand der GLEICHZEITIG laufenden nativen Arbeiten.
   */
  fahren<T>(
    arbeit: () => Promise<T>,
    zeitgrenzeMs: number,
    melden: (laufend: number) => void,
  ): Promise<T | "zeitgrenze">;
}

function warteschlange(breite: number): Warteschlange {
  let laufend = 0;
  const wartende: (() => void)[] = [];
  const frei = (): void => {
    laufend -= 1;
    wartende.shift()?.();
  };
  return {
    async fahren<T>(
      arbeit: () => Promise<T>,
      zeitgrenzeMs: number,
      melden: (laufend: number) => void,
    ): Promise<T | "zeitgrenze"> {
      // `while` und nicht `if`: geweckt wird genau einer, aber zwischen Wecken und Weiterlaufen
      // kann ein anderer den Platz genommen haben. Wer aufwacht, prüft neu.
      while (laufend >= breite) {
        await new Promise<void>((weiter) => wartende.push(weiter));
      }
      laufend += 1;
      melden(laufend);
      let lauf: Promise<T>;
      try {
        lauf = arbeit();
      } catch (fehler) {
        frei();
        throw fehler;
      }
      // DIE EINE ZEILE, UM DIE ES GEHT: der Platz wird zurückgegeben, wenn die ARBEIT settled ist.
      // Ob jemand noch auf sie wartet, ist dafür belanglos.
      void lauf.then(frei, frei);
      return mitZeitgrenze(lauf, zeitgrenzeMs);
    },
  };
}

/**
 * Der serverweite Deckel. Er steht im Modul und nicht in `bildVerkleinerung()`, weil sonst jede
 * Anfrage ihren eigenen bekäme (Fehler 2 oben).
 */
const SCHLANGE = warteschlange(BILD_GLEICHZEITIG);

/**
 * Wartet höchstens `zeitgrenzeMs` auf die Umwandlung. Der Zeitgeber wird in JEDEM Ausgang
 * gelöscht — ein hängender Zeitgeber hielte den Prozess am Leben.
 */
async function mitZeitgrenze<T>(
  arbeit: Promise<T>,
  zeitgrenzeMs: number,
): Promise<T | "zeitgrenze"> {
  let zeitgeber: NodeJS.Timeout | null = null;
  const frist = new Promise<"zeitgrenze">((fertig) => {
    zeitgeber = setTimeout(() => fertig("zeitgrenze"), zeitgrenzeMs);
    zeitgeber.unref?.();
  });
  try {
    return await Promise.race([arbeit, frist]);
  } finally {
    if (zeitgeber !== null) {
      clearTimeout(zeitgeber);
    }
  }
}

/**
 * KEINE ZWEITE CODEBAHN, ein vorbelegter Parameter — dieselbe Bauart wie `DocxGrenzen` in
 * `capture-routes.ts`. Der Betrieb läuft durch dieselben Zeilen mit der Vorgabe; eine niedrige
 * eingesetzte Zeitgrenze macht den Zeitgrenzenfall in Millisekunden prüfbar, statt ihn acht
 * Sekunden lang zu simulieren.
 */
export interface Bildgrenzen {
  readonly zeitgrenzeMs: number;
}

/**
 * DER EINE BILDWEG des Add-in-Imports. Je Anfrage einmal erzeugt: der Bericht gehört zu genau
 * diesem Import und darf sich nicht mit einem anderen mischen. Die Warteschlange dagegen ist
 * gemeinsam — sie ist eine Aussage über den Prozess, nicht über eine Anfrage.
 */
export function bildVerkleinerung(grenzen: Partial<Bildgrenzen> = {}): Bildverkleinerung {
  const zeitgrenzeMs = grenzen.zeitgrenzeMs ?? BILD_ZEITGRENZE_MS;
  const bericht: Verkleinerungsbericht = {
    gesehen: 0,
    verkleinert: 0,
    quellbytes: 0,
    ableitungsbytes: 0,
    uebersprungen: [],
    ausfaelle: [],
    gleichzeitigMax: 0,
  };
  const melden = (laufend: number): void => {
    bericht.gleichzeitigMax = Math.max(bericht.gleichzeitigMax, laufend);
  };

  const behalten = (src: string, grund: Uebersprungsgrund): string => {
    bericht.uebersprungen.push(grund);
    if (istAusfall(grund)) {
      // `bericht.gesehen` ist an dieser Stelle bereits hochgezählt und damit die Nummer GENAU
      // dieses Bildes — kein zweiter Zähler, der auseinanderlaufen könnte.
      bericht.ausfaelle.push({ bildNummer: bericht.gesehen, grund });
    }
    return src;
  };

  const mapImage = async (src: string): Promise<string> => {
    bericht.gesehen += 1;
    const treffer = DATA_QUELLE.exec(src);
    if (!treffer) {
      return behalten(src, "keine-data-quelle");
    }
    const quelle = Buffer.from(treffer[2] ?? "", "base64");
    if (quelle.byteLength > BILD_MAX_EINGABE_BYTES) {
      return behalten(src, "eingabe-zu-gross");
    }
    const ausgang = await SCHLANGE.fahren(() => ableiten(quelle), zeitgrenzeMs, melden);
    if (ausgang === "zeitgrenze") {
      return behalten(src, "zeitgrenze");
    }
    if (typeof ausgang === "string") {
      return behalten(src, ausgang);
    }
    if (ausgang.byteLength >= quelle.byteLength) {
      return behalten(src, "ableitung-nicht-kleiner");
    }
    bericht.verkleinert += 1;
    bericht.quellbytes += quelle.byteLength;
    bericht.ableitungsbytes += ausgang.byteLength;
    return `data:image/webp;base64,${ausgang.toString("base64")}`;
  };

  return { mapImage, bericht };
}

// ================================================================================================
// DER AUSFALL AM BILD — was der Mensch im gespeicherten Entwurf liest (Prüfbefund BEN, Runde 2)
// ================================================================================================
//
// DIE LÜCKE, DIE HIER GESCHLOSSEN WIRD: Runde 2 nannte jeden Ausfall in der ANTWORT des Imports
// (`imagesKeptOriginal`, `imageSkipReasons`). Das ist eine Summe — sie sagt „ein Bild ist defekt",
// nicht WELCHES, und sie ist weg, sobald die Antwort gelesen ist. Wer den Entwurf später öffnet,
// sieht ein Bild, das vielleicht angezeigt wird und vielleicht nicht, und erfährt den Grund
// nirgends. BENs Wortlaut: „ausschliesslich neue POST-Antwortfelder erfüllen diese Pflicht nicht."
//
// WO DER HINWEIS STEHT: im `<figure>` des betroffenen Bildes, unmittelbar hinter dem `<img>`. Das
// figure IST die Bildeinheit dieses Imports, und das `<img>` darin trägt die Bildkennung
// `kw-img-<token>-N` — der Hinweis hängt damit an genau EINEM Bild, auch wenn im Dokument fünf
// stehen. Die `<figcaption>` bleibt unberührt: sie trägt die Beschriftung aus dem Word-Dokument und
// ist die Quelle der Bildsuche (`services/structure/src/captions.ts`); Maschinentext hineinzumischen
// hiesse, die Suchtexte des Anwenders mit unseren Sätzen zu verunreinigen.
//
// WARUM DER HINWEIS DIE KENNUNG NICHT SELBST TRÄGT, und das ist gemessen, nicht angenommen: Der
// Server-Sanitizer (`services/structure/src/sanitize.ts`) lässt `data-image-id` NUR an `img`,
// `figure` und `figcaption` durch; an `div` steht allein `class` in der Allowlist. Ein Attribut zu
// setzen, das das Speichern nicht überlebt, wäre eine Zusage ohne Deckung — die Zuordnung ist
// deshalb die Klammer des figure, und genau die messen die Fälle H1/H3.
//
// `div class="panel panel-warning"` ist die vorhandene Warnfläche des Produkts (beide Klassen
// stehen in `ALLOWED_DIV_CLASSES`) — kein neues Bauteil für einen Sonderfall.
// WARUM KEIN SATZ HIER BEHAUPTET, DAS BILD SEI NOCH DA — gemessen, nicht überlegt: Der erste
// Entwurf dieser Texte endete auf „Es steht hier unverändert so, wie es im Word-Dokument lag." Der
// Bestandsfall W1 (`tests/m5c-b-addin-bildunterschriften/route.test.ts`) hat diese Zusage sofort
// widerlegt: Ein EMF-Bild ist für sharp nicht lesbar (also ein Ausfall), UND der Sanitizer wirft es
// danach ersatzlos weg (`isSafeImgSrc` lässt nur png|jpeg|gif|webp durch). Der Hinweis stand dann
// über einer leeren Fläche und behauptete ein Bild, das es nicht mehr gab.
// Die Sätze reden deshalb ausschliesslich davon, was die ABLEITUNG getan hat („die Bildquelle wurde
// unverändert gelassen") — das ist in jedem Fall wahr —, und über die Anzeige steht die schwächere
// Aussage da („möglicherweise wird kein Bild angezeigt") statt der starken.
//
// Die Bytegrenze in der Sprache des Lesers — abgeleitet, nicht abgeschrieben: verschiebt sich die
// Grenze, verschiebt sich der Satz mit.
const EINGABE_MAX_MB = Math.round(BILD_MAX_EINGABE_BYTES / (1024 * 1024));

const AUSFALL_HINWEIS: Record<Ausfallgrund, string> = {
  "nicht-dekodierbar":
    "Dieses Bild konnte beim Import nicht gelesen werden — es ist beschädigt oder liegt in einem Format vor, das der Import nicht öffnen kann. Die Bildquelle wurde unverändert gelassen, nicht verkleinert und nicht ersetzt; möglicherweise wird an dieser Stelle kein Bild angezeigt.",
  zeitgrenze:
    "Dieses Bild liess sich in der vorgesehenen Zeit nicht verkleinern. Die Bildquelle wurde unverändert gelassen.",
  "eingabe-zu-gross": `Dieses Bild ist grösser als ${EINGABE_MAX_MB} MB und wurde deshalb nicht verkleinert. Die Bildquelle wurde unverändert gelassen.`,
};

/** Dieselbe Bildmenge, die auch `wrapImagesInFigures` zählt: eingebettete `data:`-Bildquellen. */
const IMG_DATA_TAG = /<img\b[^>]*\bsrc="data:image\/[a-zA-Z0-9.+-]+;base64,[^"]*"[^>]*>/gi;

/**
 * Setzt hinter jedes ausgefallene Bild seinen Hinweis. Ohne Ausfall wird die Eingabe UNVERÄNDERT
 * zurückgegeben (dieselbe Zeichenkette, kein Neuaufbau) — ein heiler Import bleibt damit
 * zeichengleich zu dem, den es ohne diesen Durchgang gegeben hätte.
 */
export function bildausfaelleVermerken(html: string, ausfaelle: readonly Bildausfall[]): string {
  if (ausfaelle.length === 0) {
    return html;
  }
  const jeNummer = new Map(ausfaelle.map((a) => [a.bildNummer, a.grund]));
  let nummer = 0;
  return html.replace(IMG_DATA_TAG, (bildTag) => {
    nummer += 1;
    const grund = jeNummer.get(nummer);
    return grund === undefined
      ? bildTag
      : `${bildTag}<div class="panel panel-warning"><p>${AUSFALL_HINWEIS[grund]}</p></div>`;
  });
}

/**
 * Die eigentliche Umwandlung. Liefert entweder die Ableitung ODER den Grund, warum es keine gibt —
 * nie einen geworfenen Fehler: ein einzelnes schlechtes Bild darf den Import nicht kippen.
 */
async function ableiten(quelle: Buffer): Promise<Buffer | Uebersprungsgrund> {
  try {
    const bild = sharp(quelle, EINGABE);
    // `metadata()` liest den KOPF und dekodiert keine Pixel. Genau hier greift auch die
    // Pixelgrenze, also bevor irgendetwas Speicher in Bildgrösse anfordert.
    const kopf = await bild.metadata();
    const breite = kopf.width ?? 0;
    const hoehe = kopf.height ?? 0;
    if (breite === 0 || hoehe === 0) {
      return "nicht-dekodierbar";
    }
    if (
      breite <= BILD_MAX_KANTE &&
      hoehe <= BILD_MAX_KANTE &&
      quelle.byteLength <= BILD_KLEIN_GENUG_BYTES
    ) {
      // ERHALTENE BYTES BEWEISEN KEINE DARSTELLBARKEIT — der Fehler, den Runde 2 hier hatte
      // (Prüfbefund BEN, 09.09.). `metadata()` liest nur den KOPF: ein PNG mit heilem IHDR und
      // zerstörtem IDAT nennt dort brav „64×64" und ging als „schon klein genug" durch, ohne dass
      // je jemand hineingesehen hätte — gemeldet wurde eine Grössenoptimierung, geliefert ein Bild,
      // das kein Anzeigeprogramm öffnet. Deshalb wird auch das kleine Bild WIRKLICH dekodiert;
      // verworfen wird nur das Ergebnis, nicht die Prüfung.
      //
      // Der Speicher dafür ist von der Bedingung darüber gedeckelt und nicht von gutem Willen:
      // höchstens BILD_MAX_KANTE × BILD_MAX_KANTE Pixel (rund 6,5 MB roh), und die Quelle ist
      // ohnehin kleiner als BILD_KLEIN_GENUG_BYTES. Der Lauf steht innerhalb derselben
      // Warteschlange und derselben Zeitgrenze wie die Ableitung selbst.
      await sharp(quelle, EINGABE).raw().toBuffer();
      return "schon-klein-genug";
    }
    return await bild
      // Die Aufnahmedrehung aus den EXIF-Daten wird ANGEWANDT, nicht weitergereicht: die Ableitung
      // trägt danach keine Metadaten mehr (sharp gibt sie ohne `withMetadata` nicht weiter), und
      // ein hochkant aufgenommenes Foto stünde sonst quer im Entwurf.
      .rotate()
      .resize({
        width: BILD_MAX_KANTE,
        height: BILD_MAX_KANTE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: BILD_QUALITAET })
      .toBuffer();
  } catch {
    // Absichtlich ohne den Fehlertext: er käme aus libvips, wäre englisch und technisch, und die
    // Unterscheidung, die hier zählt, ist bereits getroffen — dieses Bild ist nicht dekodierbar.
    return "nicht-dekodierbar";
  }
}
