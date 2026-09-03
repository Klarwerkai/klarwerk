// WP-D7/D7b (Befund 2 / Gelb-Fix 2): DOM-Hilfslogik für die Bild-Fußnoten im WYSIWYG-Editor. Browser
// behandeln ein <figure> mit <img> oft als atomaren Block, sodass der Klick nicht in den Fußnotentext
// gelangt. Deshalb wird im Editor gezielt verankert: das <img> ist NICHT editierbar (kein versehentliches
// Zerschneiden), die <figcaption> AUSDRÜCKLICH editierbar (klick- und tippbar). Diese contenteditable-
// Attribute sind reine Editier-UX; der Sanitizer entfernt sie beim Rausschreiben wieder (nicht in der
// Allowlist) → sie persistieren nie im gespeicherten bodyHtml.
//
// WP-D10 (Pedis Live-Befund nach Ship 4): ein Platzhalter ist KEIN Inhalt. Der Import schreibt die
// figcaption jetzt LEER; die Einladung „hier Beschreibung eintragen" ist ein RENDER-Artefakt: dieses
// Modul setzt editorseitig data-kw-placeholder (lokalisierter Text), das CSS zeigt ihn über
// figcaption:empty::before an (index.css). Das Attribut steht nicht in der Sanitizer-Allowlist
// (figcaption erlaubt NUR data-image-id) → es kann unter keinen Umständen gespeichert werden.
// Zusätzlich MIGRATION der Altlast: eine figcaption, deren Text EXAKT einem der drei früheren
// Platzhaltertexte entspricht, wird beim Verankern geleert (clientseitig, keine Server-Datenmigration).
//
// Bewusst DOM-lib-FREI typisiert (schmaler Struktur-Typ statt globalem HTMLElement): so lässt sich die
// Funktion im Gate-tsc (läuft ohne DOM-lib) mitprüfen und im jsdom-Test direkt aufrufen; der Editor reicht
// zur Laufzeit ein echtes HTMLElement, das diese Form strukturell erfüllt.

// WP-D10: die drei EXAKTEN Alt-Platzhaltertexte (DE/EN/NL des i18n-Keys capture.file.
// imageCaptionPlaceholder vor D10) — nur diese werden als „kein Inhalt" behandelt/geleert.
// AUFTRAG-mega88 Block B: die Kennungs-Wahrheit kommt aus `docx.ts` (WP-BILD-1a/1b) — dort ist sie
// mit dem Zeichenvorrat der Sanitizer abgestimmt. `docx.ts` ist DOM-frei und hat keine statischen
// Importe (mammoth lädt es lazy) → weder Zyklus noch Bündel-Last.
import { IMAGE_ID_PREFIX, newImageRunToken } from "./docx";
// AUFTRAG-mega90 Block B: beim Flachmachen entsteht HTML als Zeichenkette. Ein Textknoten, der dort
// eingesetzt wird, MUSS dieselbe Escaping-Regel sehen, die der Sanitizer auf Textknoten anwendet —
// sonst zerrisse ein „A < B" zwischen zwei Bildern das erzeugte Markup. `escapeCaptionText` IST
// diese eine Regel (richText.ts: „eine Quelle, keine Zweitkopie"); ein eigener Escaper hier wäre
// genau die Zweitkopie, die dieses Projekt verbietet. Die Richtung erzeugt keinen Zyklus:
// `richText.ts` importiert nur `htmlEntities` und kennt dieses Modul nicht.
// AUFTRAG-huelle Block A: aus derselben Quelle kommt jetzt auch die Antwort auf die Frage, welches
// Tag eine bedeutungslose Hülle sein KANN — `FLAT_BODY_TAGS`. Begründung bei `istDurchlaessigesTag`.
import { FLAT_BODY_TAGS, escapeCaptionText } from "./richText";

export const LEGACY_IMAGE_CAPTION_PLACEHOLDERS: readonly string[] = [
  "Noch keine Bildbeschreibung",
  "No image description yet",
  "Nog geen afbeeldingsbeschrijving",
];

// AUFTRAG-mega88 Block B: der Typ trägt jetzt auch, was zum VERANKERN nötig ist. Er bleibt
// DOM-lib-frei (der Gate-tsc über `services`+`tests` läuft ohne DOM), ist aber von einem echten
// `HTMLElement` strukturell erfüllt. Bewusst NUR Methoden mit Zeichenketten-Parametern und ein
// `outerHTML`-Feld: damit bleibt die strukturelle Zuweisung eines echten Elements gültig, ohne dass
// `Node`/`Element` je genannt werden müssten. `parentNode.insertBefore` wäre der naheliegende Weg
// zum Umhüllen — er ist DOM-lib-frei NICHT typisierbar (der Parameter `Node` hat kein strukturelles
// Gegenstück), `outerHTML` leistet dasselbe mit einer Zuweisung.
export interface EditableFigureRoot {
  querySelectorAll(selectors: string): Iterable<EditableElement>;
}

// AUFTRAG-mega90 Block B: der schmalste Blick auf einen KINDKNOTEN — Element ODER Text. Er wird
// gebraucht, weil `:scope > *` ausschließlich Elemente sieht und der Umbau darüber genau das
// verlor, was zwischen den Bildern stand. Auch dieser Typ bleibt DOM-lib-frei: ein echter
// `ChildNode` erfüllt ihn strukturell (`nodeType`, `textContent`), ohne dass `Node` je genannt wird.
export interface EditableChildNode {
  readonly nodeType: number;
  textContent: string | null;
}

// Die beiden Knotenarten, die in einer figure Inhalt tragen. Alles andere (Kommentar,
// Verarbeitungsanweisung) ist kein Beitragsinhalt und überlebt ohnehin keinen der beiden Sanitizer.
const KNOTEN_ELEMENT = 1;
const KNOTEN_TEXT = 3;

// AUFTRAG-mega89 Block A: der Typ trägt zusätzlich `tagName` und `querySelectorAll`. Beides ist zum
// FLACHMACHEN nötig (die direkten Kinder einer figure in Dokumentreihenfolge unterscheiden) und
// beides bleibt DOM-lib-frei: ein echtes `Element` erfüllt es strukturell, ohne dass `Node`/
// `Element` je genannt werden müssten.
export interface EditableElement extends EditableFigureRoot, EditableChildNode {
  readonly tagName: string;
  // AUFTRAG-mega90 Block B: ALLE Kindknoten in Dokumentreihenfolge, nicht nur die Elemente.
  childNodes: Iterable<EditableChildNode>;
  outerHTML: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  closest(selectors: string): EditableElement | null;
  querySelector(selectors: string): EditableElement | null;
  insertAdjacentHTML(position: string, text: string): void;
}

// AUFTRAG-mega84 Block A: der CSS-Anker der Fußnote im EDITOR. Bis hierher hing das Aussehen am
// Attribut `contenteditable="true"` — das geht nicht mehr, weil die Fußnote genau das nicht mehr
// ist. Ein eigenes data-Attribut sagt außerdem, was gemeint ist („hier führt ein Weg ins
// Formular"), statt es aus einer Editier-Eigenschaft zu erraten. Es steht NICHT in der
// Sanitizer-Allowlist (figcaption erlaubt nur data-image-id) → es kann nie gespeichert werden.
export const CAPTION_OPEN_ATTR = "data-kw-caption-open";

// ==================================================================================================
// AUFTRAG-mega88 Block B — DIE BILDSTRUKTUR-INVARIANTE. EINE STELLE, DIE ALLE WEGE DURCHLAUFEN.
// ==================================================================================================
//
// DER BEFUND (Hand in mega87, von ben gegen die eingefrorene Basis bestätigt und zum
// Auslieferungsblocker erklärt): `insertImageSrcHtml` erzeugt ein NACKTES `<img>`
// (`richText.ts:450-454`), und `RichTextEditor.tsx` nutzt diesen Helfer für die lokale
// Dateiauswahl EBENSO WIE für Drop und Einfügen. `enhanceFiguresForEditing` erweiterte bis hierher
// nur VORHANDENE `figure`-Strukturen und umschloss nackte Bilder nicht. `openCaptionFormFor` suchte
// `image.closest("figure")?.querySelector("figcaption")` und endete OHNE RÜCKMELDUNG, wenn der
// Anker fehlte — während die Aktion sichtbar blieb. Der Nutzer sah eine Fähigkeit, die auf dem
// naheliegendsten Weg lautlos nichts tat.
//
// WARUM DIE INVARIANTE HIER LIEGT UND NICHT IM HELFER — das ist die eigentliche Entscheidung:
//
//   · `insertImageSrcHtml` reparieren würde die lokale Dateiauswahl, Drop und Bild-Paste heilen
//     (alle drei laufen über `insertImageFile`). Es würde den EINFÜGE-Weg für HTML-Ausschnitte
//     NICHT heilen (`onPaste` → `normalizePastedHtml` → `insertHtmlReliable`: dort kommt fremdes
//     Markup mit fremden `<img>` an, ohne je einen Helfer zu sehen), und es würde den ALTBESTAND
//     nicht heilen (Klara-Bilder aus der Vordertür, Beispielpakete, alles vor mega88 Gespeicherte).
//     Genau das ist die Fehlerklasse aus mega50, die ben benannt hat: ein impliziter Vertrag, den
//     der Aufrufer nicht erzwingen muss.
//
//   · Eine Etage darüber gibt es EINE Stelle, an der jeder Weg vorbeikommt, weil sie am DOM des
//     Editors hängt statt an einer Zeichenkette: `enhanceFiguresForEditing`. Der Editor ruft sie an
//     genau einem Ort (`RichTextEditor.tsx`, `verankereFiguren`), und dieser Ort wird von ALLEN
//     drei Mutationswegen des contenteditable-Knotens angefahren — dem Laden von außen
//     (`el.innerHTML = safe`), jedem `exec(...)` und jedem `insertHtmlReliable(...)`. Ein Weg, der
//     den Helfer umgeht, kann diese Stelle nicht umgehen: er müsste das DOM des Editors verändern,
//     ohne das DOM des Editors zu verändern.
//
//   · Und weil die Invariante IN `enhanceFiguresForEditing` läuft (nicht daneben, an ihrem
//     Aufrufer), kann auch ein zweiter Aufrufer sie nicht vergessen. Das ist der Unterschied
//     zwischen einer Wahrheit und einer Liste.
//
// FAIL-CLOSED, NICHT OPTIONAL: die Funktion hat keinen Schalter. Sie läuft bei jedem Verankern und
// stellt für JEDES `<img>` im Editor sicher, dass es in einer `<figure>` mit `<figcaption>` steht
// und dass Bild und Fußnote DIESELBE stabile `data-image-id` tragen (die beidseitige Verankerung
// aus WP-BILD-1b). Ein Bild, das schon verankert ist, wird nicht angefasst — die Kennung bleibt
// über beliebig viele Läufe dieselbe.
//
// DIE KENNUNG IST DIE VORHANDENE WAHRHEIT, NICHT EINE ZWEITE: `IMAGE_ID_PREFIX` und
// `newImageRunToken` kommen aus `docx.ts` — dort sind sie seit WP-BILD-1a/1b definiert und mit dem
// Zeichenvorrat des Sanitizers abgestimmt (`[a-z0-9]`, Teilmenge von `[\w-]`). `docx.ts` ist selbst
// DOM-frei und hat keine statischen Importe (mammoth wird lazy geladen) — die Richtung erzeugt
// weder Zyklus noch Bündel-Last. Ein eigener ID-Generator hier wäre genau das Nachbauen, das dieser
// Auftrag verbietet.
//
// WAS DIE INVARIANTE NICHT TUT: sie speichert nichts. Sie ist ein EDITOR-Vorgang am DOM des
// contenteditable-Knotens; `emit()` läuft erst, wenn der Nutzer selbst etwas ändert. Sie fasst die
// Leseansicht nicht an (`SanitizedHtml` ruft sie nicht auf, `verankereFiguren` läuft nur in
// `mode === "edit"`). Und sie schreibt keinen TEXT in die Fußnote: die `figcaption` entsteht LEER —
// ein Platzhalter ist kein Inhalt (WP-D10, mega84).

// ==================================================================================================
// AUFTRAG-mega89 Block A — FLACH STATT VERSCHACHTELT. EINE FIGURE JE BILD.
// ==================================================================================================
//
// DER BEFUND (ben in sammel88, der letzte Ship-Blocker — Datenintegrität, kein Schönheitsfehler).
// Bis mega89 prüfte die Verankerung mit `figure.querySelector(":scope > img") === img`, ob ein Bild
// das erste direkte Kind seiner figure ist. War es das NICHT — zwei Bilder in EINER figure, wie
// Word-Markup es liefert, der Eingang, den der Kommentar unten schon immer benannt hat —, ersetzte
// `img.outerHTML = "<figure>…</figure>"` das zweite Bild INNERHALB der äußeren figure durch eine
// weitere figure. Es entstand eine VERSCHACHTELUNG, und aus ihr folgten zwei echte Schäden: das
// Formular fand über `closest("figure")?.querySelector("figcaption")` für Bild 1 die INNERE Fußnote
// von Bild 2, und die Galerie verlor beim nicht-gierigen Zerlegen den zweiten Eintrag ganz.
//
// DIE ANTWORT IST STRUKTURELL, NICHT VORSICHTIG: es entsteht gar keine Verschachtelung mehr. Eine
// eingehende figure mit mehreren Bildern wird zu einer FOLGE flacher figures — eine je Bild, alle
// auf derselben Ebene, in der ursprünglichen Reihenfolge.
//
// DIE REGEL FÜR VORHANDENEN BESCHREIBUNGSTEXT: eine bereits vorhandene Fußnote OHNE Kennung gehört
// dem ERSTEN Bild ihrer eingehenden figure (genau die Annahme, die dieser Code schon immer traf);
// jedes weitere Bild bekommt eine LEERE. Kein vorhandener Text geht verloren und keiner wandert an
// ein anderes Bild. EINE VERALLGEMEINERUNG, weil die wörtliche Regel sonst Text verlöre: bringt
// fremdes Markup MEHRERE unmarkierte Fußnoten in EINER figure mit, werden sie der Reihe nach
// verbraucht (erste Fußnote → erstes Bild, zweite → zweites).
//
// AUFTRAG-mega90 Block A HAT DIESE REGEL EINGEORDNET, nicht ersetzt: „der Reihe nach" gilt NUR für
// Fußnoten ohne Kennung. Tragen Bild und Fußnote bereits dieselbe `data-image-id`, gehören sie
// einander — auch wenn sie in gegenläufiger Reihenfolge stehen. Die vollständige dreistufige Regel
// und ihre Begründung stehen unmittelbar über `paare()`.
//
// AUCH SCHON VERSCHACHTELTER BESTAND WIRD AUFGELÖST — dieselbe Normalisierung, kein zweiter
// Mechanismus: eine figure IN einer figure ist eine eigenständige Einheit und wird rekursiv flach
// gemacht und auf die Ebene der äußeren gehoben. Das trifft, was die fehlerhafte Fassung im
// Arbeitsbaum erzeugt haben kann, und ebenso fremdes Markup aus Word oder einem Import.

/** Kleine Bequemlichkeit: die Treffer als Feld, weil an ihnen gezählt und indiziert wird. */
function alle(el: EditableFigureRoot, selektor: string): EditableElement[] {
  return Array.from(el.querySelectorAll(selektor));
}

/** Flach im Sinne von mega89: höchstens EIN Bild und KEINE figure in der figure. */
function istFlacheFigur(figure: EditableElement): boolean {
  return figure.querySelector("figure") === null && alle(figure, "img").length <= 1;
}

// Die Bestandteile einer eingehenden figure in Dokumentreihenfolge. `roh` ist alles, was weder Bild
// noch Fußnote noch figure ist und KEIN Bild enthält: fremde Elemente, Behälter, die etwas Eigenes
// tragen, UND nackte Textknoten. Es wird an seiner Stelle der Reihenfolge unverändert wieder
// ausgegeben.
//
// AUFTRAG-huelle2 Block A: `struktur` ist die ERHALTENE HÜLLE MIT BILD — dieselbe Sache, die bis
// hierher als `roh` durchging, aber nicht mehr blind. Sie trägt jetzt das ELEMENT statt einer
// vorab eingefrorenen Zeichenkette, weil ihr Inhalt zwischen Erhebung und Ausgabe noch eine
// Fußnote hineingeschoben bekommen kann. Ausgegeben wird sie unverändert als ihr `outerHTML` —
// erst am Ende, damit eine solche Verschiebung mitgeht. Begründung bei `bildplaetze`.
type Einheit =
  | { art: "bild"; el: EditableElement }
  | { art: "figur"; el: EditableElement }
  | { art: "fussnote"; el: EditableElement }
  | { art: "struktur"; el: EditableElement }
  | { art: "roh"; html: string };

// AUFTRAG-mega90 Block B — WO DIE GRENZE BEIM TEXT LIEGT UND WARUM.
//
// Verworfen wird ausschließlich Text aus Leerzeichen, Tabulator, Zeilenumbruch, Wagenrücklauf und
// Seitenvorschub. Das ist die Einrückung, die beim Serialisieren/Parsen von Markup entsteht — sie
// ist Formatierung, kein Inhalt, und sie ohne Not mitzuschleppen erzeugte bei jedem Umbau
// wachsende Leerraumreste zwischen den entstehenden figures.
//
// BEWUSST NICHT `trim()`/`\s`: beide fassen auch das geschützte Leerzeichen (U+00A0) als Leerraum
// auf. Ein &nbsp;, das jemand gesetzt hat, IST aber Inhalt — es steht sichtbar zwischen zwei Bildern
// und darf nicht stillschweigend verschwinden. Deshalb steht hier der ausgeschriebene Zeichenvorrat.
const NUR_EINRUECKUNG = /^[ \t\n\r\f]*$/;

// ==================================================================================================
// AUFTRAG-huelle Block A — EINE TABELLE IST KEINE HÜLLE. DIE GRENZE IST TAGBEWUSST.
// ==================================================================================================
//
// DER BEFUND (ben in sammel92, der letzte Ship-Blocker). Bis hierher leitete der Behälter-Zweig
// unten die Durchlässigkeit aus ZWEI Eigenschaften ab: kein einziges Attribut, und nichts als
// Bilder/Fußnoten/figures darin. Der Kommentar nannte den Verzicht auf eine Tagliste ausdrücklich
// als Vorzug — und genau das war der Fehler. Eine attributlose Tabelle
//
//   <figure><img><table><tbody><tr><td><img></td></tr></tbody></table><figcaption>…</figcaption></figure>
//
// erfüllt beide Bedingungen auf JEDER Ebene und wurde rekursiv bis auf das Bild abgeräumt — die
// ganze Tabelle verschwand. Dasselbe galt für eine attributlose Liste, einen Zitatblock und, wie
// die Messung zeigte, für alle 19 Struktur-Tags des Vertrags. Zwei Bedingungen, die beweisen, dass
// ein Element NICHTS EIGENES trägt, beweisen nicht, dass es NICHTS BEDEUTET.
//
// DIE TAGLISTE EXISTIERT LÄNGST, SIE HEISST ALLOWLIST — und sie sagt das Gegenteil: `richText.ts`
// führt `table`, `tr`, `td`, `ul`, `li`, `blockquote` und die übrigen ausdrücklich als
// erhaltenswerte Struktur („Tabellen aus Import/Paste ERHALTEN"). Eine ZWEITE, handgepflegte Liste
// hier wäre genau die driftanfällige Zweitkopie, die dieses Projekt verbietet.
//
// DESHALB DIE BINDUNG AN `FLAT_BODY_TAGS` UND NICHT AN EINE EIGENE AUFZÄHLUNG. Der Vertrag trifft
// die Unterscheidung schon, wörtlich und an genau einer Stelle: „Wirklich FLACHE Body-Tags: nur
// Absatz und Zeilenumbruch tragen keine erhaltenswerte Struktur/Formatierung. ALLES andere aus
// RICH_TEXT_ALLOWED_TAGS (und jedes unbekannte Tag) gilt als reich — bewusst konservativ (lieber
// erhalten als zerstören)." „Trägt keine erhaltenswerte Struktur" IST die Frage, die dieser Zweig
// stellt. Er stellt sie damit nicht neu, sondern schlägt sie dort nach, wo sie beantwortet ist.
// Erweitert jemand die Allowlist, ist das neue Tag automatisch REICH und wird erhalten; erklärt
// jemand ein Tag ausdrücklich für flach, ist Auflösen dann auch richtig. Die Menge kann nicht
// driften, weil es sie hier gar nicht gibt.
//
// WAS DAS JE TAG BEDEUTET, und die Fälle sind echt, nicht rhetorisch:
//   · `p` — auflösbar. Der Fall, für den dieser Zweig gebaut wurde: das nackte `<p><img></p>` aus
//     Word-Markup (mammoth liefert Inline-Bilder in Absätzen), dessen `<p>` nichts als das Bild
//     umschließt. Es trennt sonst das Bild von der Fußnote seiner figure.
//   · `br` — formal auflösbar, praktisch nie: ein Void-Tag kann kein Bild enthalten, dieser Zweig
//     sieht es nie. Kein Sonderfall nötig, und keiner, der stillschweigend etwas zuließe.
//   · `div` — NICHT auflösbar, und das ist die Entscheidung, die wirklich zu treffen war. `div`
//     steht in derselben Allowlist wie die Tabellen, und im PRODUKT ist es kein Verpackungsartefakt,
//     sondern ein Blocktyp-Träger: `ALLOWED_DIV_CLASSES` (richText.ts) führt `panel`, `callout`,
//     `panel-info/note/warning/success`, `attachment` und `panel-external` — Panels, Anhänge und den
//     Herkunftsmarker für externes Wissen. Ein `div` OHNE Klasse ist deshalb kein Beweis für
//     Bedeutungslosigkeit, sondern für ein Panel, dessen Klasse ein fremder Sanitizer oder ein
//     Copy-Paste-Weg schon abgeschnitten hat. Zerstören wäre der teurere Irrtum.
//   · `span` und jedes andere unbekannte Tag — nicht auflösbar (steht nicht im Vertrag). Es geht
//     unverändert als `roh` durch; ob es überlebt, entscheidet danach der Sanitizer, wie bisher.
//
// DIE ATTRIBUTLOSIGKEIT BLEIBT als zusätzliche Bedingung: ein `<p class="…">` trägt etwas Eigenes.
// Sie ist nur nicht mehr die einzige. Beide Bedingungen zusammen, in dieser Reihenfolge.
function istDurchlaessigesTag(tag: string): boolean {
  return FLAT_BODY_TAGS.has(tag);
}

function einheitenVon(el: EditableElement): Einheit[] {
  const aus: Einheit[] = [];
  for (const kind of Array.from(el.childNodes)) {
    if (kind.nodeType === KNOTEN_TEXT) {
      const text = kind.textContent ?? "";
      if (!NUR_EINRUECKUNG.test(text)) {
        // Der Text wird als HTML wieder eingesetzt und muss deshalb durch dieselbe Escaping-Regel,
        // die der Sanitizer auf Textknoten anwendet.
        aus.push({ art: "roh", html: escapeCaptionText(text) });
      }
      continue;
    }
    if (kind.nodeType !== KNOTEN_ELEMENT) {
      continue;
    }
    // Der einzige Abstieg im Typ, und er ist durch `nodeType` gedeckt: ein Knoten mit nodeType 1 IST
    // ein Element und erfüllt damit `EditableElement`.
    const element = kind as EditableElement;
    const tag = element.tagName.toLowerCase();
    if (tag === "img") {
      aus.push({ art: "bild", el: element });
    } else if (tag === "figure") {
      // Eine figure in einer figure ist eine EIGENE Einheit: sie wird rekursiv flach gemacht und
      // an dieser Stelle der Reihenfolge eingesetzt.
      aus.push({ art: "figur", el: element });
    } else if (tag === "figcaption") {
      aus.push({ art: "fussnote", el: element });
    } else if (element.querySelector("img, figure") !== null) {
      // ── AUFTRAG-mega90 Block B: EIN BEHÄLTER MIT BILD WIRD NICHT MEHR STILL VERWORFEN ──────────
      //
      // Bis mega90 stand hier `aus.push(...einheitenVon(kind))`: der Behälter wurde aufgelöst und
      // SELBST weggeworfen. Aus einer `<table>`, in der ein Bild steckt, blieb der Inhalt ohne
      // Tabelle; Attribute (Klasse, Kennung, Ausrichtung) verschwanden mit. Eine Tabelle, in der
      // ein Bild steckt, ist Struktur, die jemand gemacht hat.
      //
      // DIE REGEL, entschieden am Quelltext und nicht am Bauchgefühl — aufgelöst wird nur, was
      // NACHWEISLICH nichts Eigenes trägt UND nachweislich keine Struktur IST („durchlässige
      // Hülle"). Drei Bedingungen, in dieser Reihenfolge:
      //   · AUFTRAG-huelle Block A: Das TAG muss im Rich-Text-Vertrag als flach geführt sein
      //     (`istDurchlaessigesTag`, Begründung dort). Diese Bedingung steht ZUERST, weil sie die
      //     billigste ist und weil die Rekursion sonst umsonst liefe.
      //   · Der Behälter hat KEIN einziges Attribut. Ein Element ohne Attribute serialisiert sich
      //     exakt als `<tag>`; steht irgendein Attribut daran, hat das Öffnungs-Tag ein Leerzeichen
      //     und die Prüfung schlägt fehl. Das ist die Messung am wirklichen Quelltext des Knotens.
      //   · Und er enthält NICHTS außer Bildern, Fußnoten und figures (Einrückung ist oben schon
      //     verworfen). Kein Text, kein fremdes Element.
      // Das trifft genau den Fall, für den dieser Zweig gebaut wurde — das nackte `<p><img></p>`
      // aus Word-Markup, dessen `<p>` nichts als das Bild umschließt.
      //
      // ALLES ANDERE BLEIBT, WIE ES IST: der Behälter geht unverändert durch — Behälter, Attribute,
      // Text und Reihenfolge stehen danach unverändert da.
      //
      // AUFTRAG-huelle2 Block A — ABER NICHT MEHR UNDURCHSICHTIG. Bis hierher wurde er als `roh`
      // abgelegt, und damit waren seine Bilder für `paare()` unsichtbar: eine unmarkierte Fußnote
      // ging an das nächste DIREKTE Bild, auch wenn ein Bild in der Struktur ihm in
      // Dokumentreihenfolge vorausging. Die Beschriftung wanderte still zum falschen Bild. Als
      // `struktur` bleibt die Hülle unangetastet und ihre Bilder werden trotzdem gezählt.
      const ohneEigenschaften = /^<[a-zA-Z][a-zA-Z0-9-]*>/.test(element.outerHTML);
      if (istDurchlaessigesTag(tag) && ohneEigenschaften) {
        const innen = einheitenVon(element);
        // Aufgelöst wird nur, was NICHTS als Bilder, Fußnoten und figures enthält. Eine `struktur`
        // darin zählt wie `roh` als eigener Inhalt — sonst löste ein `<p>` um eine Tabelle die
        // Tabelle aus ihrer Umgebung, und das ist genau die Kante, die dieser Zweig schützt.
        if (innen.every((e) => e.art === "bild" || e.art === "figur" || e.art === "fussnote")) {
          aus.push(...innen);
          continue;
        }
      }
      aus.push({ art: "struktur", el: element });
    } else {
      aus.push({ art: "roh", html: element.outerHTML });
    }
  }
  return aus;
}

function kennungVon(el: EditableElement): string {
  return el.getAttribute("data-image-id") ?? "";
}

// ==================================================================================================
// AUFTRAG-mega90 Block A — DIE KENNUNG SCHLÄGT DIE REIHENFOLGE, UND KEINE KENNUNG WIRD ÜBERSCHRIEBEN
// ==================================================================================================
//
// DER BEFUND (ben in sammel89, vom Kopf am Quelltext nachgemessen). Bis mega90 wurden die direkten
// Fußnoten einer eingehenden figure eingesammelt und den Bildern rein POSITIONELL zugeteilt
// (`fussnoten[naechste]`). Vorhandene `data-image-id`-Paare spielten für die ZUORDNUNG keine Rolle;
// sie kamen erst danach ins Spiel, und dann stand dort `fussnote.setAttribute("data-image-id", id)`:
// die vorhandene, RICHTIGE Kennung der Fußnote wurde auf die des falsch zugeteilten Bildes
// überschrieben. Aus `img[A] img[B] figcaption[B] figcaption[A]` wurde `A="Text B"`, `B="Text A"` —
// und danach behaupteten die Kennungen, das sei so richtig. Der Fehler löschte seine eigene Spur.
//
// DIE REIHENFOLGE DER ZUORDNUNG, und sie ist nicht verhandelbar:
//
//   STUFE 1 — GLEICHE KENNUNG. Bild und Fußnote mit derselben, nicht leeren `data-image-id` gehören
//   einander, unabhängig von ihrer Stellung im Dokument. Hier wird nichts geschrieben: beide tragen
//   die Kennung bereits.
//
//   STUFE 2 — UNMARKIERTE FUSSNOTEN DER REIHE NACH. Eine Fußnote OHNE Kennung geht in
//   Dokumentreihenfolge an das nächste noch unversorgte Bild. Das ist die verlustarme Rückfallregel
//   für Altbestand und fremdes Markup (mega89) — sie steht jetzt HINTER der stabilen Kennung, nicht
//   davor. Nur hier bekommt eine Fußnote eine Kennung geschrieben, und nur, weil sie keine hatte.
//
//   STUFE 3 — NICHT RATEN. Was danach übrig ist — eine Fußnote mit einer Kennung, zu der es in
//   dieser Einheit kein Bild gibt —, wird KEINEM Bild untergeschoben. Ihr Inhalt bleibt sichtbar
//   erhalten (wie bisher die überzähligen Fußnoten), ihre Kennung bleibt unangetastet.
//
// ── JOB 916: HIER STAND EINE STUFE 2b, UND SIE IST ABGELÖST ───────────────────────────────────────
//
// Sie lautete: genau EIN Bild ohne eigene Kennung und genau EINE übrige Fußnote → das Bild
// übernimmt deren Kennung. Begründet war das als „Stabilität" — sonst bekäme das Bild eine NEUE
// Kennung und seine Beschreibung stünde verwaist daneben.
//
// DIE BEGRÜNDUNG HIELT NICHT STAND, und der Grund steht in der Kontrollfolge selbst: eine nach
// Stufe 2 ÜBRIGE Fußnote kann keine unmarkierte mehr sein — Stufe 2 nimmt genau die. Was Stufe 2b
// erreichte, trug also ZWANGSLÄUFIG eine fremde Kennung. „Stabilität" hieß an dieser Stelle: das
// Bild erbt eine Herkunft, die niemand belegt hat, und behauptet sie anschließend als seine eigene.
// Das ist derselbe Schaden wie in sammel89 — der Fehler löscht seine eigene Spur —, nur an einer
// Stelle, die ihn als Vorzug führte.
//
// SEITHER GILT AN ALLEN VIER STELLEN DASSELBE: Stufe 3 hier, `offenerAnker` und `gemeinsameKennung`
// bei der Wanderung, die Nachnormalisierung unten und der Galerie-Zerleger (`bodyImages.ts`, wo
// dieselbe Ausnahme als `|| bilder.length === 1` stand und mit abgelöst wurde). Zwei verschiedene,
// nicht leere Kennungen werden nirgends mehr gegeneinander verrechnet.
//
// DIE REICHWEITE, ausdrücklich: das gilt für die PAARUNG getrennter Einheiten. INNERHALB einer
// flachen `<figure>` bleibt die figure die Bindungseinheit — sie läuft gar nicht hier durch,
// sondern kommt erst in der Nachnormalisierung an, und dort ist der Sanitizer autoritativ
// (`anchorFigures`, `services/structure`: die Kennung der figure ist führend). Das ist kein
// Schlupfloch, sondern die Grenze zu einem stärkeren, älteren Vertrag; sie ist in
// `tests/capture/job916-stufe2b-abloesung.test.ts` in BEIDEN Richtungen gepinnt.
//
// DIE EINE STELLE, DIE NICHT AUFGEHT, und sie wird nicht gebogen: EIN Bild mit Kennung A und EINE
// Fußnote mit einer ABWEICHENDEN Kennung X. Beide Seiten tragen eine Wahrheit, und jede Paarung
// müsste eine davon überschreiben. Sie fällt deshalb in Stufe 3: das Bild bekommt eine leere
// Fußnote, der Text von X bleibt sichtbar stehen. Sichtbar danebenstehender Text ist reparierbar;
// eine überschriebene Kennung ist es nicht.
//
// AUFTRAG-huelle3: die Rückgabe ist NUR NOCH die Zuordnung. Die übrigen Fußnoten wurden bis hierher
// zusätzlich mitgegeben und beim Aufrufer unverändert weitergereicht — seit huelle3 kann eine
// Zuordnung dort noch ZURÜCKGENOMMEN werden (Kennungskonflikt, Begründung bei `gemeinsameKennung`),
// und dann wäre die mitgegebene Liste eine zweite, veraltete Wahrheit über denselben Sachverhalt.
// Sie wird jetzt an genau einer Stelle aus der Zuordnung abgeleitet, nachdem alle Entscheidungen
// gefallen sind. „Übrig" heißt: von keinem Bild verbraucht — mehr sagt das Wort nicht.
function paare(
  bilder: EditableElement[],
  fussnoten: EditableElement[],
): Map<EditableElement, EditableElement> {
  const fussnoteFuer = new Map<EditableElement, EditableElement>();
  const belegt = new Set<EditableElement>();
  const frei = (f: EditableElement): boolean => !belegt.has(f);
  const nimm = (bild: EditableElement, f: EditableElement | undefined): void => {
    if (f !== undefined) {
      belegt.add(f);
      fussnoteFuer.set(bild, f);
    }
  };

  // Stufe 1: gleiche, nicht leere Kennung.
  for (const bild of bilder) {
    const id = kennungVon(bild);
    if (id === "") {
      continue;
    }
    nimm(
      bild,
      fussnoten.find((f) => frei(f) && kennungVon(f) === id),
    );
  }
  // Stufe 2: unmarkierte Fußnoten in Dokumentreihenfolge an noch unversorgte Bilder.
  for (const bild of bilder) {
    if (fussnoteFuer.has(bild)) {
      continue;
    }
    nimm(
      bild,
      fussnoten.find((f) => frei(f) && kennungVon(f) === ""),
    );
  }
  // JOB 916: HIER STAND STUFE 2b, und sie ist ENTFERNT, nicht abgeschaltet. Was danach übrig ist,
  // fällt in Stufe 3 — die Begründung steht oben im Regelabschnitt.
  return fussnoteFuer;
}

// ==================================================================================================
// AUFTRAG-huelle2 Block A — DIE GEORDNETE STRUKTUR-PAARUNG. EIN BILD IN EINER HÜLLE HAT EINEN ORT.
// ==================================================================================================
//
// DER BEFUND (ben in sammel96, der Ship-Blocker nach `huelle`). Der tagbewusste Schutz aus `huelle`
// ist richtig — er hat aber eine Grenze VERSCHOBEN statt geschlossen: erhaltene Strukturen wurden
// für `paare()` zu undurchsichtigen Einheiten. Die Paarung sammelte nur DIREKTE Bilder; ein Bild
// in einer Tabelle war für sie nicht vorhanden. Ihre eigene, im Modul dokumentierte Regel
// („unmarkierte Fußnote → nächstes unversorgtes Bild IN DOKUMENTREIHENFOLGE") wurde damit für
// genau diese Bilder gebrochen:
//
//   <figure><table><tbody><tr><td><img B></td></tr></tbody></table><img A><figcaption>…</figcaption></figure>
//
// B steht VOR A. Die Fußnote ging trotzdem an A, und B bekam danach einen neuen, leeren Anker in
// der Zelle. Kein verwaister Text, sondern ein STILLER ZUORDNUNGSFEHLER — die Beschreibung stand
// unter dem falschen Bild und behauptete, dort hinzugehören.
//
// DIE ANTWORT, und sie löst die Struktur NICHT wieder auf: die Paarung kennt jetzt BILDPLÄTZE.
// Ein Bildplatz ist ein Bild mit seinem Ort — direkt in der figure, oder in einer erhaltenen
// Einheit (`struktur`) beziehungsweise in einer inneren `figur`. Die Plätze entstehen in
// Dokumentreihenfolge, weil die Einheiten in Dokumentreihenfolge erhoben werden und
// `querySelectorAll` innerhalb einer Einheit ebenfalls in Dokumentreihenfolge liefert. Damit
// stimmt die Reihenfolge, die `paare()` sieht, mit der überein, die der Nutzer sieht.
//
// UND DER TEXT WIRD VERSCHOBEN, NICHT KOPIERT (bens dritter Weg, sammel96 §5). Fällt eine Fußnote
// auf einen Platz INNERHALB einer Einheit, wandert sie dorthin: sie ersetzt die leere Fußnote des
// vorhandenen inneren Ankers, oder sie wird an ihn angehängt, oder das Bild wird an Ort und Stelle
// umhüllt. Sie ist damit GENAU EINMAL verbraucht — sie steht nicht mehr außen und taucht nicht als
// zweites Exemplar auf. Bild und Fußnote tragen danach GENAU EINE gemeinsame Kennung; eine zweite
// `data-image-id` entsteht nirgends. Das schließt zugleich die Verwaisung, die `huelle` als
// unlösbar gemeldet hatte (einziges Bild in einer Struktur, Fußnote daneben).
//
// WO NICHT GERATEN WIRD, und die Grenze ist dieselbe wie bei Stufe 3: ein Platz ist nur OFFEN,
// wenn an ihm nichts steht, das überschrieben werden müsste. Trägt der innere Anker schon eine
// GEFÜLLTE Fußnote, oder widersprechen sich die Kennungen von Bild und innerem Anker, ist der
// Platz kein Kandidat — die äußere Fußnote bleibt dann sichtbar stehen (Stufe 3), statt eine
// vorhandene Wahrheit zu verdrängen. Und weil ein geschlossener Platz gar nicht erst gezählt wird,
// greifen die Mehrdeutigkeitsschranken der Stufen 2b/3 unverändert weiter.

// ==================================================================================================
// AUFTRAG-huelle3 — DIESELBE ZUSAGE, ZWEI KANTEN. „NICHT RATEN" GALT NOCH NICHT VOLLSTÄNDIG.
// ==================================================================================================
//
// ben in `sammel99`, beide vom Kopf am Quelltext nachgelesen und bestätigt. Es sind keine zwei
// Befunde, sondern zwei Löcher in EINER Zusage: bei Mehrdeutigkeit wird nicht geraten.
//
// H2-01 — EINE VORHANDENE INNERE KENNUNG KONNTE STILL VERWORFEN WERDEN. Die Offenheitsprüfung
// verglich die Kennung des BILDES mit der der inneren Fußnote. Hatte das Bild KEINE, galt der Platz
// als offen — auch dann, wenn die leere innere Fußnote bereits die Kennung `X` trug:
//
//   <figure><table><tr><td><figure><img><figcaption data-image-id="X"></figcaption></figure>
//   </td></tr></table><figcaption data-image-id="Y">Aussen</figcaption></figure>
//
// Die eindeutig übrig gebliebene äußere Fußnote mit `Y` wurde danach über die damalige Stufe 2b
// gepaart (seit JOB 916 abgelöst — sie paarte fremd gekennzeichnete Fußnoten; siehe den
// Regelabschnitt über `paare()`), gewann in der damaligen Prioritätsregel und ERSETZTE die leere innere
// Fußnote samt ihrer Kennung `X`. Text ging dabei nicht verloren — ZUORDNUNGSWAHRHEIT schon: `X` war
// weg, und `Y` behauptete eine Zugehörigkeit, die niemand belegt hatte.
//
// DIE URSACHE IST DER ZEITPUNKT, NICHT DIE BEDINGUNG: die Offenheit wurde ABSCHLIESSEND entschieden,
// bevor die gepaarte äußere Fußnote überhaupt bekannt war. Deshalb ist die Prüfung jetzt ZWEIGETEILT,
// und die Teilung folgt der Frage, wann die Antwort verfügbar ist:
//   · Was ohne die eingehende Fußnote entscheidbar ist, entscheidet `offenerAnker` — VOR der
//     Paarung, damit ein geschlossener Platz gar nicht erst gezählt wird und die
//     Mehrdeutigkeitsschranken der Stufen 2b/3 unverändert weitergreifen.
//   · Der Abgleich ALLER DREI Kennungsquellen — Bild, eindeutiger innerer Anker, eingehende
//     Fußnote — kann erst NACH der Paarung fallen und steht deshalb dort (`gemeinsameKennung`).
//     Zwei verschiedene, nicht leere Kennungen verhindern die Verschiebung; die Fußnote fällt
//     zurück in Stufe 3 und bleibt sichtbar stehen.
//
// H2-02 — NUR DIE ERSTE DIREKTE FUSSNOTE EINES ANKERS WURDE GESEHEN. An drei Stellen stand
// `querySelector(":scope > figcaption")` — in der Offenheitsprüfung, beim Verschieben und bei der
// Kennungswahl. Alle drei sehen genau den ERSTEN Treffer. Bei fremdem oder beschädigtem Markup mit
// mehreren direkten Fußnoten kann die erste leer und verträglich sein, während eine spätere gefüllt
// ist oder eine widersprüchliche Kennung trägt; der Platz galt trotzdem als offen, und danach
// standen zwei Beschreibungen am selben Anker.
//
// DIE ANTWORT IST DIE VOLLSTÄNDIGE ERHEBUNG, und sie ist zugleich die Antwort auf die BAUART:
// Offen ist ein Anker nur bei NULL Fußnoten oder bei GENAU EINER leeren, voll verträglichen.
// Mehrere direkte Fußnoten, irgendein gefüllter Text oder irgendeine widersprüchliche Kennung
// schließen den Platz. Und der so validierte eindeutige leere Anker wird im `Bildplatz`
// MITGEFÜHRT, statt ihn dreimal neu als „ersten" Treffer zu suchen. Dieselbe Wahrheit an drei
// Stellen neu zu suchen IST die Bauart, aus der beide Befunde entstanden sind — es gibt sie hier
// jetzt genau einmal.

interface Bildplatz {
  bild: EditableElement;
  /** Die erhaltene Einheit, in der das Bild steckt — `null` beim direkten Bild der figure. */
  einheit: EditableElement | null;
  /** Die figure INNERHALB dieser Einheit, in der das Bild schon steckt — sonst `null`. */
  anker: EditableElement | null;
  /**
   * AUFTRAG-huelle3: die EINE geprüfte leere direkte Fußnote dieses Ankers — die einzige, die eine
   * wandernde Fußnote ersetzen dürfte. `null` heißt: der Anker hat gar keine (dann wird angehängt)
   * oder es gibt keinen Anker. Ein Anker MIT Fußnoten, die die Prüfung nicht bestehen, kommt hier
   * nie an — sein Platz ist geschlossen und steht nicht in der Liste.
   */
  ankerFussnote: EditableElement | null;
}

/**
 * Die figure, in der dieses Bild INNERHALB der Einheit schon steckt. Bewusst über `closest` und
 * einen Abgleich gegen die figures der Einheit selbst: `closest` findet die NÄCHSTE umschließende
 * figure, und der Abgleich stellt sicher, dass sie nicht außerhalb der Einheit liegt (dort fände
 * `closest` sonst die gerade umzubauende äußere figure).
 */
function ankerIn(einheit: EditableElement, bild: EditableElement): EditableElement | null {
  const naechste = bild.closest("figure");
  if (naechste === null) {
    return null;
  }
  if (naechste === einheit) {
    return einheit;
  }
  return alle(einheit, "figure").includes(naechste) ? naechste : null;
}

/**
 * Zwei Kennungen vertragen sich, wenn höchstens eine von ihnen etwas behauptet — oder wenn beide
 * dasselbe behaupten. Die eine Stelle, an der dieses Projekt „Widerspruch" definiert.
 */
function vertraeglich(a: string, b: string): boolean {
  return a === "" || b === "" || a === b;
}

/**
 * AUFTRAG-huelle3 (H2-02): ist dieser Platz OFFEN — also frei von allem, was eine hereinwandernde
 * Fußnote verdrängen würde —, und WELCHE Fußnote des Ankers dürfte sie ersetzen?
 *
 * Beides in EINER Antwort, weil es dieselbe Erhebung ist: die Frage „ist hier Platz" und die Frage
 * „was steht hier" haben genau eine gemeinsame Grundlage, nämlich ALLE direkten `figcaption`-Kinder
 * des Ankers. Getrennte Antworten bedeuteten getrennte Erhebungen, und genau daraus sind H2-01 und
 * H2-02 entstanden.
 *
 * OFFEN ist ein Anker nur in zwei Lagen:
 *   · Er hat GAR KEINE direkte Fußnote — die wandernde wird angehängt.
 *   · Er hat GENAU EINE, sie ist LEER, und ihre Kennung verträgt sich mit der des Bildes — sie wird
 *     ersetzt. Sie ist die zurückgegebene `fussnote`.
 * Alles andere schließt: mehrere direkte Fußnoten (welche gälte?), irgendein gefüllter Text (er ist
 * die Beschreibung dieses Bildes), eine widersprüchliche Kennung (jede Zuordnung überschriebe eine
 * vorhandene Wahrheit — dieselbe Regel, die seit JOB 916 auch in `paare()` ohne Ausnahme gilt).
 *
 * Was hier NICHT geprüft wird, und das ist Absicht: die Kennung der EINGEHENDEN Fußnote. Sie ist zu
 * diesem Zeitpunkt noch nicht bekannt; ihr Abgleich steht in `gemeinsameKennung` (H2-01).
 */
function offenerAnker(
  anker: EditableElement | null,
  bild: EditableElement,
): { offen: boolean; fussnote: EditableElement | null } {
  const zu = { offen: false, fussnote: null };
  if (anker === null) {
    return { offen: true, fussnote: null };
  }
  const direkte = alle(anker, ":scope > figcaption");
  if (direkte.length === 0) {
    return { offen: true, fussnote: null };
  }
  const eine = direkte[0];
  if (direkte.length > 1 || eine === undefined) {
    return zu;
  }
  if ((eine.textContent ?? "").trim() !== "") {
    return zu;
  }
  if (!vertraeglich(kennungVon(eine), kennungVon(bild))) {
    return zu;
  }
  return { offen: true, fussnote: eine };
}

/** Alle Bildplätze dieser Einheiten in Dokumentreihenfolge — geschlossene Plätze bleiben draußen. */
function bildplaetze(teile: readonly Einheit[]): Bildplatz[] {
  const plaetze: Bildplatz[] = [];
  for (const teil of teile) {
    if (teil.art === "bild") {
      plaetze.push({ bild: teil.el, einheit: null, anker: null, ankerFussnote: null });
      continue;
    }
    if (teil.art !== "struktur" && teil.art !== "figur") {
      continue;
    }
    for (const bild of alle(teil.el, "img")) {
      const anker = ankerIn(teil.el, bild);
      const { offen, fussnote } = offenerAnker(anker, bild);
      if (offen) {
        plaetze.push({ bild, einheit: teil.el, anker, ankerFussnote: fussnote });
      }
    }
  }
  return plaetze;
}

/**
 * Die Fußnote wandert an ihren Platz — an ORT UND STELLE, ohne die erhaltene Struktur anzufassen.
 * Drei Lagen, und jede verbraucht die Fußnote genau einmal:
 *   · Der innere Anker hat die eine geprüfte LEERE Fußnote → sie wird durch die wandernde ERSETZT.
 *   · Der innere Anker hat keine → sie wird an ihn angehängt. Über die gemeinsame Kennung findet
 *     der nächste Lauf (Stufe 1 beziehungsweise der Umhüllungszweig) beide wieder zueinander.
 *   · Es gibt keinen inneren Anker → das Bild wird an seiner Stelle umhüllt. Der Behälter, seine
 *     Attribute und die Reihenfolge um ihn herum bleiben unberührt.
 *
 * AUFTRAG-huelle3 (H2-02): welche Fußnote ersetzt werden darf, wird hier NICHT mehr neu gesucht.
 * Sie steht im Platz (`ankerFussnote`), von `offenerAnker` erhoben und geprüft. Die alte Suche nach
 * dem „ersten" direkten Treffer hätte an einem Anker mit mehreren Fußnoten eine andere erwischt als
 * die, über die entschieden wurde — zwei Meinungen über denselben Knoten.
 */
function verschiebeInAnker(platz: Bildplatz, fussnote: EditableElement): void {
  if (platz.anker === null) {
    platz.bild.outerHTML = `<figure>${platz.bild.outerHTML}${fussnote.outerHTML}</figure>`;
    return;
  }
  if (platz.ankerFussnote !== null) {
    platz.ankerFussnote.outerHTML = fussnote.outerHTML;
    return;
  }
  platz.anker.insertAdjacentHTML("beforeend", fussnote.outerHTML);
}

/**
 * AUFTRAG-huelle3 (H2-01): DIE EINE KENNUNG, DIE ALLE BETEILIGTEN TRAGEN — oder `null`.
 *
 * Geprüft werden alle Quellen GEMEINSAM, nicht paarweise und nicht nach Vorrang: das Bild, der
 * eindeutige innere Anker und die eingehende Fußnote. Ergebnis:
 *   · `""` — keine Seite bringt eine Wahrheit mit; es darf eine neue Kennung entstehen.
 *   · eine Kennung — sie ist die EINZIGE, die genannt wurde; alle Seiten übernehmen sie.
 *   · `null` — ZWEI VERSCHIEDENE, nicht leere Kennungen. Es gibt keine Antwort, die nicht eine
 *     vorhandene Wahrheit überschriebe. Dann wird nicht geraten: die Verschiebung unterbleibt.
 *
 * WARUM KEIN VORRANG MEHR: die alte Regel „erst Bild, dann Fußnote, dann Anker" hat bei Widerspruch
 * einfach die erste nicht-leere Quelle genommen. Ein Vorrang ist eine Antwort auf die Frage „welche
 * gilt?" — und genau diese Frage darf hier nicht beantwortet werden. Wo kein Widerspruch besteht,
 * ist ein Vorrang gegenstandslos, weil alle nicht-leeren Quellen ohnehin dasselbe sagen.
 */
function gemeinsameKennung(quellen: readonly string[]): string | null {
  let gemeinsam = "";
  for (const quelle of quellen) {
    if (quelle === "") {
      continue;
    }
    if (gemeinsam === "") {
      gemeinsam = quelle;
      continue;
    }
    if (gemeinsam !== quelle) {
      return null;
    }
  }
  return gemeinsam;
}

/**
 * Das flache Ergebnis EINER eingehenden figure als HTML: je Bild eine `<figure>` mit `<img>` und
 * `<figcaption>`, beide mit derselben stabilen Kennung. Vorhandene Kennungen gewinnen (Stabilität)
 * und werden nie überschrieben; fehlende Fußnoten entstehen leer.
 */
function flacheFigurenHtml(figure: EditableElement, neueKennung: () => string): string {
  const teile = einheitenVon(figure);
  const plaetze = bildplaetze(teile);
  const fussnoten: EditableElement[] = [];
  for (const teil of teile) {
    if (teil.art === "fussnote") {
      fussnoten.push(teil.el);
    }
  }
  const fussnoteFuer = paare(
    plaetze.map((platz) => platz.bild),
    fussnoten,
  );

  // ZUERST die Wanderung, DANN die Ausgabe: eine `struktur` wird unten als ihr `outerHTML`
  // ausgegeben, und der muss die hereingeschobene Fußnote schon enthalten.
  for (const platz of plaetze) {
    const fussnote = fussnoteFuer.get(platz.bild);
    if (platz.einheit === null || fussnote === undefined) {
      continue; // direktes Bild — es wird unten im Ausgabelauf umhüllt, wie bisher
    }
    const capId = kennungVon(fussnote);
    // AUFTRAG-huelle3 (H2-01): der Anker steht im Platz, geprüft und eindeutig — er wird nicht als
    // „erster" Treffer neu gesucht (H2-02).
    const ankerId = platz.ankerFussnote === null ? "" : kennungVon(platz.ankerFussnote);
    // KEINE NEUE KENNUNG, WO EINE VORHANDENE TRÄGT — und keine vorhandene, wo eine zweite
    // widerspricht. Alle drei Quellen gemeinsam: Bild, innerer Anker, wandernde Fußnote.
    const id = gemeinsameKennung([kennungVon(platz.bild), capId, ankerId]);
    if (id === null) {
      // ZWEI WAHRHEITEN, KEINE VERSCHIEBUNG. Die Zuordnung wird ZURÜCKGENOMMEN: die Fußnote gilt
      // als unverbraucht und fällt damit in Stufe 3 — sie bleibt sichtbar mit ihrer eigenen
      // Kennung stehen, und die Kennung des inneren Ankers bleibt unangetastet. Sichtbar
      // danebenstehender Text ist reparierbar; eine überschriebene Zuordnung ist es nicht.
      fussnoteFuer.delete(platz.bild);
      continue;
    }
    const wirkliche = id !== "" ? id : neueKennung();
    platz.bild.setAttribute("data-image-id", wirkliche);
    if (capId === "") {
      fussnote.setAttribute("data-image-id", wirkliche);
    }
    verschiebeInAnker(platz, fussnote);
  }

  // Erst JETZT steht fest, welche Fußnote verbraucht ist — nach der Paarung UND nach den
  // zurückgenommenen Zuordnungen. Eine Quelle, keine mitgeschleppte Zweitliste (siehe `paare`).
  const verbraucht = new Set(fussnoteFuer.values());
  const uebrig = fussnoten.filter((f) => !verbraucht.has(f));

  const aus: string[] = [];
  for (const teil of teile) {
    if (teil.art === "figur") {
      aus.push(flacheFigurenHtml(teil.el, neueKennung));
      continue;
    }
    if (teil.art === "struktur") {
      // Unverändert — bis auf eine Fußnote, die eben an ihren Platz IN ihm gewandert ist.
      aus.push(teil.el.outerHTML);
      continue;
    }
    if (teil.art === "roh") {
      aus.push(teil.html);
      continue;
    }
    if (teil.art === "fussnote") {
      continue; // steht unten bei ihrem Bild — oder am Ende, wenn sie keines hat
    }
    const fussnote = fussnoteFuer.get(teil.el) ?? null;
    const bildId = kennungVon(teil.el);
    const capId = fussnote === null ? "" : kennungVon(fussnote);
    // Vorhandene Kennung des BILDES gewinnt; sonst eine neue.
    //
    // JOB 916: hier stand als Mittelglied `capId !== "" ? capId` — der Ausgabe-Zwilling von
    // Stufe 2b. Er ist mit ihr ENTFALLEN und war danach unerreichbar: ein Bild ohne eigene Kennung
    // bekommt eine Fußnote nur noch über Stufe 2, und die nimmt ausschließlich Fußnoten OHNE
    // Kennung — `capId` ist in diesem Zweig also zwangsläufig leer. Ihn stehen zu lassen hieße,
    // die abgelöste Regel als toten Pfad weiterzuführen.
    const id = bildId !== "" ? bildId : neueKennung();
    teil.el.setAttribute("data-image-id", id);
    let fussnoteHtml = `<figcaption data-image-id="${id}"></figcaption>`;
    if (fussnote !== null) {
      // Die vorhandene Fußnote wird MITSAMT ihrer Auszeichnung übernommen (mega84 Block B). Ihre
      // Kennung wird NUR gesetzt, wenn sie keine hat — nach Stufe 1 ist sie sonst bereits
      // identisch, und ein Überschreiben wäre genau der Schaden aus sammel89.
      if (capId === "") {
        fussnote.setAttribute("data-image-id", id);
      }
      fussnoteHtml = fussnote.outerHTML;
    }
    aus.push(`<figure>${teil.el.outerHTML}${fussnoteHtml}</figure>`);
  }
  // Stufe 3: was keinem Bild gehört, bleibt sichtbar — mit seiner eigenen Kennung, unverändert.
  for (const uebriggeblieben of uebrig) {
    aus.push(uebriggeblieben.outerHTML);
  }
  return aus.join("");
}

// AUFTRAG-mega88 Block B: die Invariante selbst. Rückgabe ist die Zahl der Bilder, die BEI DIESEM
// LAUF einen Anker bekommen haben — der Editor braucht sie nicht, die Wächter messen daran die
// Wirkung statt der Namensanwesenheit (die Lehre aus mega86/mega87).
export function ensureImageAnchors(root: EditableFigureRoot): number {
  // Schon vergebene Kennungen im GANZEN Editor-Inhalt — damit eine neue nie eine alte trifft, auch
  // wenn der Zufalls-Token es einmal täte.
  const vergeben = new Set<string>();
  for (const el of root.querySelectorAll("[data-image-id]")) {
    const id = el.getAttribute("data-image-id");
    if (id !== null && id !== "") {
      vergeben.add(id);
    }
  }

  // Ein Token je LAUF (wie ein Import-Lauf in docx.ts), durchnummeriert. Erst erzeugt, wenn wirklich
  // eine Kennung gebraucht wird — ein Lauf ohne Fund verbraucht keine Zufallszahlen.
  let token: string | null = null;
  let n = 0;
  const neueKennung = (): string => {
    if (token === null) {
      token = newImageRunToken();
    }
    let id: string;
    do {
      n += 1;
      id = `${IMAGE_ID_PREFIX}${token}-${n}`;
    } while (vergeben.has(id));
    vergeben.add(id);
    return id;
  };

  let verankert = 0;

  // ── AUFTRAG-mega89 Block A: ZUERST FLACH MACHEN ───────────────────────────────────────────────
  //
  // Immer die ERSTE nicht-flache figure in Dokumentreihenfolge — das ist die ÄUSSERSTE, weil eine
  // äußere ihren inneren im Baum vorausgeht. Ihr Umbau macht den ganzen Teilbaum flach; danach wird
  // frisch von der Wurzel gesucht, sodass nie an einem abgelösten Knoten gearbeitet wird. Die
  // Schranke ist die Zahl der Bilder: mehr nicht-flache figures als Bilder kann es nicht geben, und
  // eine Schleife über dem DOM bekommt in diesem Projekt keinen unbegrenzten Lauf.
  const schranke = alle(root, "img").length + 1;
  for (let runde = 0; runde < schranke; runde += 1) {
    let ziel: EditableElement | null = null;
    for (const figure of root.querySelectorAll("figure")) {
      if (!istFlacheFigur(figure)) {
        ziel = figure;
        break;
      }
    }
    if (ziel === null) {
      break;
    }
    verankert += alle(ziel, "img").length;
    // Eine `outerHTML`-Zuweisung ersetzt einen Knoten durch die Folge, die daraus entsteht — das ist
    // dieselbe DOM-lib-freie Bauform wie unten, siehe die Begründung dort.
    ziel.outerHTML = flacheFigurenHtml(ziel, neueKennung);
  }

  for (const img of root.querySelectorAll("img")) {
    const figure = img.closest("figure");
    // AUFTRAG-mega89 Block A: hier stand `figure.querySelector(":scope > img") === img` — die Prüfung
    // „ist dies das erste direkte Bild seiner figure". Sie war der Auslöser der Verschachtelung: für
    // jedes WEITERE Bild derselben figure lief der Zweig unten und legte eine figure IN die figure.
    //
    // Sie wird nicht mehr gebraucht, weil das Flachmachen oben schon gelaufen ist: danach enthält
    // JEDE figure höchstens ein Bild. Steckt ein Bild in einer figure, ist es also DAS Bild dieser
    // figure — und der umhüllende Zweig läuft nur noch für Bilder, die in gar keiner figure liegen.
    // Damit kann die Zuweisung `img.outerHTML = "<figure>…"` keine Verschachtelung mehr erzeugen.
    if (figure === null) {
      const vorhandeneId = img.getAttribute("data-image-id");
      const id = vorhandeneId !== null && vorhandeneId !== "" ? vorhandeneId : neueKennung();
      const roh = img.outerHTML;
      const mitKennung = /\bdata-image-id\s*=/i.test(roh)
        ? roh
        : roh.replace(/^<img/i, `<img data-image-id="${id}"`);
      // Eine Zuweisung ersetzt GENAU einen Knoten durch GENAU einen Knoten — die Kindpositionen der
      // Umgebung bleiben gleich, ein Cursor daneben behält seinen Offset. Die erzeugte Struktur ist
      // exakt der Vertrag, den `wrapImagesInFigures` (docx.ts) auf dem Import-Weg herstellt — und
      // sie steht bewusst HIER und nicht in einem Helfer: der Sammler
      // (`tests/app/mega88-bildanker-sammler.test.tsx`) fällt sein Urteil je Funktion, und eine
      // Struktur, die über zwei Funktionen verteilt ist, kann er nicht als vollständig lesen.
      img.outerHTML = `<figure>${mitKennung}<figcaption data-image-id="${id}"></figcaption></figure>`;
      verankert += 1;
      continue;
    }

    // ── AUFTRAG-huelle4: DIE ZUSAGE ENDET NICHT AN DER WANDERUNG ──────────────────────────────────
    //
    // DER BEFUND (ben in sammel101, der letzte Ship-12-Blocker). `huelle3` hat die WANDERUNG
    // fail-safe gemacht: widersprechen sich Bild- und innere Fußnotenkennung, schließt
    // `offenerAnker` den Platz, und die äußere Fußnote bleibt sichtbar stehen. Danach lief hier
    // aber die allgemeine Nachnormalisierung weiter mit ihrer alten Antwort — nur die ERSTE direkte
    // Fußnote im Blick, und bei vorhandener Bildkennung gewann immer die Bildkennung:
    // `caption.setAttribute("data-image-id", id)` schrieb die Kennung `X` der inneren Fußnote still
    // auf `I`. Der Text blieb sichtbar, die ZUORDNUNGSWAHRHEIT nicht. Es ist genau der Schaden aus
    // sammel89, eine Etage später — und deshalb hier dieselbe Antwort wie dort, nicht eine zweite.
    //
    // DIESELBE ANTWORT HEISST WÖRTLICH DIESELBE: `gemeinsameKennung` über ALLE Quellen dieser
    // figure. Sie ist die eine Stelle, an der dieses Projekt „Widerspruch" entscheidet; sie hier
    // nachzubauen wäre die Zweitkopie, aus der beide Befunde entstanden sind.
    //   · `null` — zwei verschiedene, nicht leere Kennungen. Es wird NICHTS geschrieben, an keiner
    //     Seite. Sichtbar nebeneinanderstehende Kennungen sind reparierbar; eine überschriebene
    //     ist es nicht.
    //   · sonst — die EINE genannte Kennung (oder eine neue, wenn keine Seite eine mitbringt).
    //
    // UND DIE MENGE STATT DES ERSTEN TREFFERS (dieselbe Bauart-Korrektur wie in huelle3/H2-02):
    // `querySelector(":scope > figcaption")` sieht genau den ersten. Die erste Fußnote kann leer und
    // verträglich sein, während eine spätere widerspricht — wer nur sie ansieht, macht eine
    // beliebige Fußnote zur alleinigen Wahrheit. Erhoben wird deshalb die GANZE direkte Menge; sie
    // geht vollständig in die Kennungsfrage ein. Geschrieben wird an eine Fußnote nur, wenn es
    // GENAU EINE gibt: bei mehreren ist nicht entscheidbar, welche die Beschreibung dieses Bildes
    // ist, und eine Kennung an alle zu verteilen behauptete genau das für jede von ihnen.
    //
    // BEWUSST DIE ABFRAGE HIER UND NICHT ÜBER `alle(...)`: der Wächter über die Paarungsstellen
    // (`tests/app/mega89-paarungsstellen-sammler.test.ts`) liest den Syntaxbaum und sieht nur
    // Selektoren, die als Zeichenkette AN der Abfrage stehen. Durch den Helfer gereicht, wäre diese
    // Paarung für ihn unsichtbar — und eine spätere Verbreiterung auf „irgendeinen Nachfahren"
    // fiele niemandem mehr auf. `:scope >` bleibt damit gepinnt.
    const direkte = Array.from(figure.querySelectorAll(":scope > figcaption"));
    const imgId = kennungVon(img);
    const id = gemeinsameKennung([imgId, ...direkte.map(kennungVon)]);
    if (id === null) {
      continue;
    }
    const wirkliche = id !== "" ? id : neueKennung();

    if (imgId !== wirkliche) {
      img.setAttribute("data-image-id", wirkliche);
      verankert += 1;
    }
    const eine = direkte[0];
    if (direkte.length === 0) {
      // figure ohne Fußnote — die Fußnote fehlt, nicht die Hülle.
      figure.insertAdjacentHTML(
        "beforeend",
        `<figcaption data-image-id="${wirkliche}"></figcaption>`,
      );
      verankert += 1;
    } else if (direkte.length === 1 && eine !== undefined && kennungVon(eine) !== wirkliche) {
      eine.setAttribute("data-image-id", wirkliche);
      verankert += 1;
    }
  }

  // ==============================================================================================
  // JOB 2084 (Register I50, DRITTENS) — EINE KENNUNG GEHÖRT GENAU EINEM BILD.
  // ==============================================================================================
  //
  // DER BEFUND (ben in sammel92): „doppelte `data-image-id` sind nicht ausgeschlossen — die Paarung
  // verbraucht jede Fußnote nur einmal, aber spätere globale Kennungssuchen liefern bei Dubletten
  // den ersten Treffer."
  //
  // DIE ANTWORT STEHT SCHON IM PROJEKT, und sie steht im Sanitizer. `anchorFigures`
  // (`services/structure/src/sanitize.ts`) führt eine Menge `claimed` und lässt eine bereits
  // beanspruchte Kennung kein zweites Mal führen. Dort steht auch, WER die Doppelung weiterträgt —
  // wörtlich: „Der Editor macht die Hülle flach (`editorFigures.ts`), respektiert dabei vorhandene
  // Kennungen — zu Recht, denn Überschreiben hat früher Zuordnungen zerstört — und trug die
  // Doppelung weiter. Im Browser standen dann zwei Bilder mit derselben Identität: Wer beide
  // beschreibt, beschreibt am Ende dasselbe oder verliert eine Beschreibung beim Wiederöffnen."
  //
  // Diese Schleife ist die benannte Stelle. Sie bekommt DIESELBE Antwort wie der Sanitizer, nicht
  // eine zweite: das ERSTE Bild in Dokumentreihenfolge behält seine Kennung (Stabilität), jedes
  // weitere mit derselben bekommt eine frische, die im ganzen Inhalt noch nicht vorkommt.
  //
  // WARUM DER EDITOR UND NICHT DER CLIENT-SANITIZER, gemessen an genau diesem Körper (zwei figures,
  // dieselbe Kennung):
  //     services/structure    →  ["kw-img-dup-1", "kw-cap-zweite"]   entdublettiert
  //     apps/web/lib/richText →  ["kw-img-dup-1", "kw-img-dup-1"]    unverändert
  // Der Client-Sanitizer trägt bewusst KEIN `anchorFigures`; er ist der Spiegel der Allowlist, und
  // autoritativ ist der Server. Bis zum nächsten Serverdurchlauf ist der Editor deshalb die einzige
  // Stelle, an der die Doppelung überhaupt auffallen kann — und `emit()` speichert client-seitig.
  //
  // WORAUF SICH DAS STÜTZT: Die Editor-Auflösung der Galerie-Bitte (`RichTextEditor.tsx`) findet
  // das gewählte Bild über die Kennung seines Galerie-Eintrags. Diese Kennung MUSS im Editor-DOM
  // eindeutig sein, sonst trifft die Suche wieder mehrere. Entdublettierung und Occurrence-Kette
  // sind deshalb zwei Hälften eines Vertrags, nicht zwei Bauten nebeneinander.
  //
  // DIE FUSSNOTE FOLGT NUR, WENN SIE WIRKLICH DIESE KENNUNG TRUG. Trägt sie eine ANDERE, wird an
  // keiner Seite geschrieben: zwei verschiedene, nicht leere Kennungen werden in diesem Modul
  // nirgends gegeneinander verrechnet (`gemeinsameKennung`), und eine überschriebene Zuordnung ist
  // nicht reparierbar — eine danebenstehende schon.
  //
  // `verankert` wird NICHT hochgezählt: die Zahl sagt „so viele Bilder wurden verankert", und ein
  // Bild, das schon verankert war, wird hier nur umbenannt.
  const beansprucht = new Set<string>();
  for (const img of root.querySelectorAll("img")) {
    const alte = kennungVon(img);
    if (alte === "") {
      continue;
    }
    if (!beansprucht.has(alte)) {
      beansprucht.add(alte);
      continue;
    }
    const frische = neueKennung();
    img.setAttribute("data-image-id", frische);
    beansprucht.add(frische);
    const figure = img.closest("figure");
    const fussnote = figure === null ? null : figure.querySelector(":scope > figcaption");
    if (fussnote !== null && kennungVon(fussnote) === alte) {
      fussnote.setAttribute("data-image-id", frische);
    }
  }

  // ==============================================================================================
  // JOB 509 / D5 (nachgezogen 10.08.2026) — DER CONTAINER TRAEGT DEN ANKER MIT.
  // ==============================================================================================
  //
  // Job 509 hat den Dreifachanker figure/img/figcaption eingefuehrt und ihn in BEIDEN Sanitizern
  // durchgelassen — GESETZT hat ihn aber nur der Server (`anchorFigures`, services/structure).
  // Der Editor erzeugte weiter nur den Doppelanker img/figcaption. Folge: derselbe Koerper ergab
  // client- und serverseitig VERSCHIEDENES HTML, und genau das faengt
  // tests/capture/mega88-bildstruktur-invariante („Client- und Server-Sanitizer urteilen GLEICH").
  //
  // Der Container bekommt die Kennung SEINES Bildes — er erfindet keine. Gibt es kein verankertes
  // Bild, bleibt die figure ohne Anker: eine Huelle ohne Bild hat keine Identitaet zu tragen.
  for (const figure of root.querySelectorAll("figure")) {
    // `:scope > img` und NICHT `img`: mega89 Block B verbietet jede Paarung ueber einen beliebigen
    // Nachfahren. Bei verschachtelten figures haette die aeussere sonst die Kennung des INNEREN
    // Bildes uebernommen — derselbe Datenschaden wie in sammel88, nur eine Ebene hoeher.
    const bild = figure.querySelector(":scope > img");
    const id = bild === null ? "" : kennungVon(bild);
    if (id !== "" && kennungVon(figure) !== id) {
      figure.setAttribute("data-image-id", id);
    }
  }

  return verankert;
}

// ==================================================================================================
// AUFTRAG-mega89 Block B — BILD UND FUSSNOTE FINDEN EINANDER ÜBER DIE KENNUNG ODER ÜBER DIREKTE
// KINDER. NIRGENDS ÜBER „irgendeinen Nachfahren".
// ==================================================================================================
//
// DER BEFUND: `openCaptionFormFor` suchte `image.closest("figure")?.querySelector("figcaption")` und
// `openCaptionFormForCaption` suchte `caption.closest("figure")?.querySelector("img")` — beide OHNE
// `:scope >`, also über beliebige Nachfahren. An einer verschachtelten Struktur fand die äußere
// figure die INNERE Fußnote zuerst (Dokumentreihenfolge): Bild 1 bekam die Beschreibung von Bild 2.
// Block A stellt sicher, dass gar keine Verschachtelung mehr entsteht; diese beiden Funktionen sind
// die zweite Sicherung — sie halten auch an Markup, das nie durch die Verankerung gelaufen ist
// (eine abgelöste Fußnote im offenen Formular, ein Ausschnitt aus fremder Hand).
//
// ZWEI ZULÄSSIGE FORMEN, UND SIE STEHEN IN DIESER REIHENFOLGE:
//   1. Über die STABILE gemeinsame `data-image-id` — die robustere, weil sie auch trägt, wenn die
//      Struktur sich ändert. Verglichen wird der ATTRIBUTWERT, nicht in einen Selektor interpoliert
//      (kein Escaping-Thema; dieselbe Bauform wie die Galerie-Bitte in `RichTextEditor.tsx`).
//   2. Sonst über das DIREKTE Kind derselben figure (`:scope >`) — das trägt genau dann, wenn es
//      noch gar keine Kennung gibt: frisch eingefügtes oder eingefügtes fremdes Markup, bevor die
//      Verankerung gelaufen ist.
// Ein beliebiger Nachfahre ist in KEINEM der beiden Zweige erreichbar.

// ==================================================================================================
// JOB 3035 (Register I50, DRITTENS — die zweite Hälfte) — BEI MEHRDEUTIGKEIT WIRD NICHT GERATEN.
// ==================================================================================================
//
// DER BEFUND: hier stand `return el` beim ERSTEN Knoten mit passendem Attributwert. Ob ein zweiter
// mit demselben Wert existierte, wurde nicht erhoben. Die Begründung im Block darüber — die stabile
// Kennung ist der robustere Weg und steht deshalb VOR dem direkten Kind — trägt aber nur so lange,
// wie die Kennung eindeutig IST. Ist sie es nicht, liefert genau der robustere Weg das falsche
// Ergebnis, und der schwächere, aber lokal richtige (`:scope >`) wird gar nicht erst erreicht.
//
// `ensureImageAnchors` macht die BILDKENNUNGEN eindeutig (die Schleife „EINE KENNUNG GEHÖRT GENAU
// EINEM BILD"). Sie kann das aber nicht überall: eine Fußnote, die zu keinem Bild gehört, wird
// nicht umbenannt (Stufe 3 — „nicht raten"), und Markup, das nie durch die Verankerung gelaufen
// ist, sieht sie nie (der Fall, den der Block oben als „abgelöste Fußnote im offenen Formular, ein
// Ausschnitt aus fremder Hand" benennt). Genau dort greift diese Schranke.
//
// DIE ANTWORT IST DIESELBE WIE ÜBERALL SONST IN DIESEM MODUL: mehr als eine Auskunft heißt KEINE
// Auskunft (`gemeinsameKennung`, `offenerAnker`, Stufe 3). `captionForImage` und `imageForCaption`
// fallen dann auf ihren bereits vorhandenen zweiten Zweig zurück — das direkte Kind derselben
// figure ist bei Mehrdeutigkeit die einzige Auskunft, die noch belegt ist. Findet auch der nichts,
// bleibt es bei `null`: keine Auskunft ist ehrlicher als eine falsche. Es entsteht KEINE zweite
// Suchfunktion und kein Schalter — der Ersttreffer-Zweig ist entfernt, nicht danebengestellt.
//
// KEIN FRÜHER AUSSTIEG NACH ZWEI TREFFERN: die Menge wird ohnehin ganz durchlaufen, wenn es nur
// einen gibt (der häufige Fall), und ein Abbruch bei zwei spart nichts, was messbar wäre. Die
// vollständige Erhebung ist dieselbe Bauart-Korrektur wie in huelle3/H2-02: wer nur den ersten
// Treffer ansieht, macht einen beliebigen Knoten zur alleinigen Wahrheit.
function knotenMitKennung(
  root: EditableFigureRoot | null | undefined,
  selektor: string,
  id: string | null,
): EditableElement | null {
  if (root === null || root === undefined || id === null || id === "") {
    return null;
  }
  let treffer: EditableElement | null = null;
  for (const el of root.querySelectorAll(selektor)) {
    if (el.getAttribute("data-image-id") !== id) {
      continue;
    }
    if (treffer !== null) {
      return null;
    }
    treffer = el;
  }
  return treffer;
}

/** Die Fußnote, die zu diesem Bild gehört — über die Kennung, sonst über das direkte Kind. */
export function captionForImage(
  img: EditableElement,
  root?: EditableFigureRoot | null,
): EditableElement | null {
  const ueberKennung = knotenMitKennung(
    root,
    "figcaption[data-image-id]",
    img.getAttribute("data-image-id"),
  );
  if (ueberKennung !== null) {
    return ueberKennung;
  }
  return img.closest("figure")?.querySelector(":scope > figcaption") ?? null;
}

/** Das Bild, das zu dieser Fußnote gehört — über die Kennung, sonst über das direkte Kind. */
export function imageForCaption(
  caption: EditableElement,
  root?: EditableFigureRoot | null,
): EditableElement | null {
  const ueberKennung = knotenMitKennung(
    root,
    "img[data-image-id]",
    caption.getAttribute("data-image-id"),
  );
  if (ueberKennung !== null) {
    return ueberKennung;
  }
  return caption.closest("figure")?.querySelector(":scope > img") ?? null;
}

// AUFTRAG-mega84 Block A — DIE BESCHREIBUNG IST DER EINSTIEG, NICHT DAS TIPPFELD.
//
// Pedi, 31.07. mit Bildschirmfoto: unter dem Bild steht „✎ Bildbeschreibung hinzufügen …", und das
// ist alles, was passiert. Klickte man hinein, war die figcaption ein EIGENER Editing-Host
// (contenteditable="true") und man tippte inline — kein Formular, keine Formatierung, und der
// KI-Vorschlag erschien als Leiste am oberen Rand des Editors, weit weg von der Stelle, die man
// angeklickt hatte.
//
// Seit mega84 ist die Fußnote im Editor ein BEDIENELEMENT: nicht editierbar, aber fokussierbar,
// als Knopf angekündigt und mit Beschriftung. Der Editor öffnet auf Klick, Eingabe-/Leertaste und
// den ersten Tastendruck einer Schreibtaste das vorhandene Formular (mega9 Block F) — dasselbe,
// in das auch der Knopf der Bild-Werkzeugleiste und die Galerie (mega69) führen. Zwei Wege zum
// selben Formular sind erlaubt, zwei Formulare nicht.
export function enhanceFiguresForEditing(
  root: EditableFigureRoot,
  captionPlaceholder?: string,
  captionLabel?: string,
): void {
  // AUFTRAG-mega88 Block B/C: ZUERST die Invariante. Sie läuft INNERHALB dieser Funktion und nicht
  // neben ihr, damit kein Aufrufer sie vergessen kann — und weil der Editor sie an genau einer
  // Stelle ruft, durchläuft JEDER Weg sie: das Laden von außen (Altbestand, Block C), jedes
  // `exec(...)` und jedes `insertHtmlReliable(...)` (alle Einfügewege, Block B).
  ensureImageAnchors(root);
  for (const img of root.querySelectorAll("figure img")) {
    img.setAttribute("contenteditable", "false");
  }
  for (const caption of root.querySelectorAll("figure figcaption")) {
    // Kein Editing-Host mehr: was der Nutzer hier tippt, soll ins Formular führen und nicht
    // ungefragt in den Dokumentinhalt laufen.
    caption.setAttribute("contenteditable", "false");
    caption.setAttribute(CAPTION_OPEN_ATTR, "");
    // Barrierearm: erreichbarer Fokus, angekündigte Rolle, angekündigte Beschriftung. Der
    // Platzhalter allein trüge nichts davon — und bei GEFÜLLTER Fußnote gibt es ihn gar nicht.
    caption.setAttribute("role", "button");
    caption.setAttribute("tabindex", "0");
    if (captionLabel !== undefined) {
      caption.setAttribute("aria-label", captionLabel);
    }
    // WP-D10 Altlast-Migration: exakt einer der drei alten Platzhaltertexte → leeren. Der Nutzer sieht
    // stattdessen den visuellen Platzhalter; gespeichert wird die Leere beim nächsten emit().
    const text = (caption.textContent ?? "").trim();
    if (LEGACY_IMAGE_CAPTION_PLACEHOLDERS.includes(text)) {
      caption.textContent = "";
    }
    // WP-D10: lokalisierten Einlade-Text als data-Attribut anheften — NUR editorseitig; das CSS
    // (index.css) rendert ihn bei :empty als ::before. Der Sanitizer strippt das Attribut beim Speichern.
    if (captionPlaceholder !== undefined) {
      caption.setAttribute("data-kw-placeholder", captionPlaceholder);
    }
  }
}

// WP-D10 (Leseansicht/Galerie): Alt-Platzhaltertexte in gespeichertem bodyHtml wie LEER behandeln —
// reine ANZEIGE-Transformation (keine Server-Datenmigration, keine Sanitizer-Änderung). Ersetzt den
// figcaption-Inhalt nur, wenn er exakt (modulo Whitespace) einem der drei Alt-Texte entspricht; die
// leere figcaption blendet das CSS (:empty) dann aus.
const LEGACY_CAPTION_RE = new RegExp(
  `(<figcaption\\b[^>]*>)\\s*(?:${LEGACY_IMAGE_CAPTION_PLACEHOLDERS.join("|")})\\s*(</figcaption>)`,
  "g",
);

export function blankLegacyCaptionPlaceholders(html: string): string {
  return html.replace(LEGACY_CAPTION_RE, "$1$2");
}

// ---- WP-RETEST7 R2 — ENTFALLEN MIT AUFTRAG-mega84 Block A ----------------------------------------
//
// Hier standen `normalizeEmptyCaption` und `shouldBlockCaptionDeletion`. Beide waren Reparaturen an
// EINER Ursache: die figcaption war ein contenteditable-Editing-Host, und der Browser tat darin
// Dinge, die der Nutzer nicht gemeint hatte — ein <br>-Rest blieb beim Leeren zurück (der
// Platzhalter erschien nicht mehr), und Backspace/Delete löschte oder mergte das Element selbst.
//
// Seit mega84 ist die figcaption im Editor kein Editing-Host mehr, sondern der Einstieg ins
// Formular (siehe oben). Damit gibt es in ihr weder Caret noch Tastendruck, der Inhalt verändert:
// beide Guards hatten keinen erreichbaren Aufrufer mehr. Eine Reparatur ohne Schaden ist tote
// Fläche — sie ist entfernt, nicht auskommentiert. Der Schaden selbst kann nicht wiederkommen,
// ohne dass jemand `contenteditable` zurückstellt, und genau das ist gepinnt.
