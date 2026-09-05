// ================================================================================================
// JOB 1496 · D1 (M-2, Schritt 2) — DIE VERTRAGSFLÄCHE DES GRAPH-LESEMODELLS.
// ================================================================================================
//
// WARUM DIESE DATEI GETRENNT STEHT. Drei Bahnen bauen auf dem Lesemodell auf (Auftrag §88), und
// PRO5 setzt in `services/wissensnetz/src/luecken*.ts` unmittelbar darauf. Was sie brauchen, ist
// nicht die Abfrage, sondern der Vertrag: welche Form die Eingangsdaten haben, welche Form die
// Antwort hat. Steht beides in derselben Datei wie die Auswertung, kann man das eine nicht
// übernehmen, ohne das andere mitzuziehen.
//
// ================================================================================================
// WARUM PORTS UND KEINE IMPORTE — gemessen, nicht Geschmack.
// ================================================================================================
//
// Die Datenquelle dieses Lesemodells ist `KantenLeseService` aus
// `services/knowledge-object/src/kanten-service.ts` (JOB 1140 D1, im Produkt). Ein direkter Import
// von dort ist diesem Modul VERBOTEN: `.dependency-cruiser.cjs:16-27` erlaubt Cross-Modul-Importe
// ausschliesslich über die öffentliche `index.ts` des Zielmoduls, und `kanten-service` ist in
// `services/knowledge-object/index.ts` NICHT exportiert (gemessen: 0 Treffer). Dasselbe gilt für
// `KoService.list`.
//
// Deshalb beschreibt diese Datei die beiden Quellen als PORTS — als Mindestform, die der echte
// Dienst strukturell erfüllt. Das ist dieselbe Bauform, mit der `kanten-service.ts:97` seinen
// eigenen Bestand beschreibt (`KantenRepo`), und sie hat hier einen zweiten Vorzug: Das Lesemodell
// ist heute schon prüfbar, obwohl das Kantenaggregat aus JOB 1139 D2 noch entsteht.
//
// DASS DER PORT ZUR WIRKLICHKEIT PASST, IST NICHT BEHAUPTET, SONDERN GEPRÜFT:
// `tests/wissensnetz/lesemodell-sicht.test.ts` weist den echten `KantenLeseService` diesem Port zu.
// Tests liegen nicht unter `services/` und unterliegen der Modulgrenze nicht — der Beweis ist dort
// erlaubt, wo er hingehört, und er ist ein Typfehler, sobald PRO die Fläche ändert.

// ================================================================================================
// DIE SICHTBARKEITSENTSCHEIDUNG — ÜBERGEBEN, NIE SELBST AUSGELEGT.
// ================================================================================================
//
// Wörtlich dieselbe Begründung wie in `kanten-service.ts:120-127`: Dieses Modul beantwortet NICHT,
// wer was sehen darf. Die Frage verbindet Rolle, Rechtematrix und Stufe am Objekt und wird an genau
// EINER Stelle beantwortet (`services/app/src/sichtbarkeit.ts`). Ein eigenes Prädikat hier wäre die
// zweite Wahrheit, gegen die jene Datei gebaut ist — und dieses Lesemodell wäre dann gegen seine
// eigene Erfindung grün.

/**
 * Die Mindestform eines Wissensobjekts für dieses Lesemodell. Bewusst schmal: `tags` trägt die
 * Themen, `author` den Beitrag. Titel und Aussage stehen hier NICHT — eine Themenübersicht braucht
 * sie nicht, und was nicht mitreist, kann nicht auslaufen.
 *
 * ================================================================================================
 * JOB 3073 · V6 — `category` IST HIER WEG, UND ZWAR ABSICHTLICH.
 * ================================================================================================
 *
 * Bis JOB 3071 stand hier `category: string`, und `lesemodell.ts` bildete daraus seine Themen —
 * während `themenkarte.ts` dieselbe Antwort nach `tags` zeichnete. Das waren ZWEI Themenachsen in
 * EINER Antwort, an der echten Route gemessen
 * (`tests/wissensnetz-leseweg/namensraum-kette.test.tsx`). Die Achse ist zusammengeführt: es gibt
 * genau eine Zerlegung (`themenVon` in `themenkarte.ts`), und sie liest die Schlagworte.
 *
 * Das Feld steht deshalb nicht mehr im Vertrag — nicht daneben, nicht optional. Ein Modul, das
 * `category` weiterhin führte, wäre die Einladung, die zweite Achse wieder zu bauen.
 */
export interface WissensnetzKo {
  id: string;
  /**
   * Die Schlagworte. Sie sind die EINE Themenachse — Themenzähler wie Kartenknoten entstehen aus
   * ihnen, über dieselbe Funktion. Optional aus demselben Grund wie unten bei `ThemenkarteKo`:
   * fehlt das Feld, ist das Objekt themenlos (`ohneThema`), nicht in ein erfundenes Sammelthema
   * einsortiert.
   */
  tags?: readonly string[] | null | undefined;
  author?: string | null | undefined;
}

// ================================================================================================
// JOB 2600 · D1 — DREI FELDER MEHR, UND WARUM ALLE DREI OPTIONAL SIND.
// ================================================================================================
//
// Die Themenkarte (`themenkarte.ts`) braucht neben dem Thema (den SCHLAGWORTEN, seit JOB 3073 im
// Grundvertrag oben) den FREIGABESTATUS (Kanten und Farbe) und die QUELLEN (Farbe). Der einzige
// Aufrufer im Produkt reicht schon heute vollstaendige `KnowledgeObject`s herein
// (`services/app/src/routes/ko-routes.ts:492`, `{ kos: { alle: () => ko.list({}) } }`) — die
// Felder sind also DA; dieses Modul hat sie bisher nur nicht angesehen.
//
// OPTIONAL, und das ist keine Bequemlichkeit:
//   · Der Bestandsvertrag `WissensnetzKo` wird von Tests und Ports strukturell erfuellt, die diese
//     Felder nicht fuehren. Pflichtfelder haetten jeden dieser Aufrufer zu einem Typfehler gemacht
//     — eine Aenderung an fremden Dateien fuer eine additive Faehigkeit.
//   · `sources` ist bewusst `readonly unknown[]`: Dieses Modul liest davon NUR die Laenge. Den
//     echten `KoSource`-Typ nachzubauen waere die zweite Wahrheit, gegen die diese Datei an drei
//     Stellen ausdruecklich gebaut ist; ihn zu importieren verbietet die Modulgrenze.
//   · Fehlt ein Feld, faellt das Objekt still auf den vorsichtigen Wert: keine Schlagworte
//     (kein Knoten), nicht freigegeben (keine Kante, Farbe `offen`), keine Quelle. Eine fehlende
//     Angabe erzeugt damit NIE eine staerkere Aussage als eine vorhandene.
export interface ThemenkarteKo extends WissensnetzKo {
  /** `KoStatus`; als Freigabe zaehlt ausschliesslich `"validiert"`. */
  status?: string | null | undefined;
  /** Nur die LAENGE wird gelesen: hat dieses Objekt Belege oder nicht. */
  sources?: readonly unknown[] | null | undefined;
}

/**
 * WARUM DIESE PORTS GENERISCH SIND — gemessen, nicht Stilfrage.
 *
 * Die Sichtbarkeitsentscheidung kommt aus `services/app/src/sichtbarkeit.ts:51-54`, und ihr
 * Parameter ist ENG typisiert (`confidentiality?: Confidentiality | null | undefined`). Schriebe
 * dieses Modul die Fakten mit `confidentiality?: string`, wäre der Hausfilter unter
 * `strictFunctionTypes` NICHT mehr zuweisbar: eine Funktion, die nur die enge Union annimmt, darf
 * nicht dort stehen, wo eine beliebige Zeichenkette erlaubt ist.
 *
 * Die Union hier nachzubauen wäre die zweite Wahrheit, gegen die `sichtbarkeit.ts` gebaut ist.
 * Also nennt dieses Modul den Objekttyp gar nicht, sondern lässt ihn offen: `K` ist, was der
 * Aufrufer führt (im Produkt `KnowledgeObject`), und das Prädikat spricht über genau dieses `K`.
 * Das Lesemodell selbst liest daraus nur `id`, `tags` und `author`.
 */
export type WissensnetzSichtbar<K> = (ko: K) => boolean;

/** Die Leseseite des KO-Bestands, die dieses Lesemodell braucht — erfüllt von `KoService.list`. */
export interface WissensnetzKoLeser<K extends WissensnetzKo = WissensnetzKo> {
  /**
   * Die Grundmenge, UNGETRIMMT. Das Lesemodell trimmt selbst und zählt danach — genau in dieser
   * Reihenfolge, siehe `lesemodell.ts`. Ein vorgetrimmter Port würde die Zusage an eine Stelle
   * verlagern, die dieses Modul nicht prüfen kann.
   */
  alle(): Promise<readonly K[]>;
}

/**
 * Die Kantenauskunft, soweit dieses Lesemodell sie braucht: nur die Zahl der SICHTBAREN Kanten.
 * `KuratierteKanten` (kanten-service.ts:172) trägt mehr; ein Port nimmt sich, was er nutzt.
 */
export interface WissensnetzKantenAuskunft {
  total: number;
}

/**
 * Die Leseseite der kuratierten Kanten — erfüllt von `KantenLeseService.kantenFuer`.
 *
 * `kantenFuer` ist bewusst in METHODENSCHREIBWEISE deklariert und nicht als Eigenschaft mit
 * Funktionstyp: nur so vergleicht TypeScript die Parameter bivariant, und nur so darf der echte
 * Dienst hier stehen, obwohl sein `sichtbar` über die enge Faktenform spricht und dieses Modul
 * über `K`. Der Beweis, dass er wirklich passt, steht im Test — nicht in diesem Kommentar.
 */
export interface WissensnetzKantenLeser<K> {
  kantenFuer(
    koId: string,
    opts: { sichtbar?: WissensnetzSichtbar<K> },
  ): Promise<WissensnetzKantenAuskunft>;
}

// JOB 2600 D7 · Der Ergebnistyp kommt aus `themenkarte-typen.ts`, nicht mehr aus `themenkarte.ts`.
// Vorher zeigten beide Module aufeinander — diese Datei auf die Ausgabe, `themenkarte.ts` auf die
// Eingabe `ThemenkarteKo` —, und `./tools/check` brach bei `architecture` mit `no-circular` ab.
// Die Typendatei haengt an nichts, deshalb zeigen jetzt beide dorthin. Begruendung in ihrem Kopf.
import type { Themenkarte } from "./themenkarte-typen";

// ================================================================================================
// DIE ANTWORT.
// ================================================================================================
//
// Sie beantwortet die Fragen 1 und 2 der Abnahmefrage (Auftrag §102-108) und liefert für Frage 3
// das Rohmaterial — nicht die Auswertung. Die Grenze ist ausdrücklich gezogen (Auftrag §110-112):
// PRO5 baut die Lückenauswertung in `luecken*.ts`. Hier stehen deshalb ZÄHLER, keine Schwellen,
// keine Rangfolge nach Bedürftigkeit und kein Urteil „hier fehlt etwas".

/** Ein Mensch und sein Umfang innerhalb eines Themas. Nur Sichtbares ist gezählt. */
export interface WissensnetzBeitrag {
  urheber: string;
  objekte: number;
}

export interface WissensnetzThema {
  thema: string;
  /**
   * Sichtbare Objekte dieses Themas. Zählt NACH dem Trimm.
   *
   * ==============================================================================================
   * JOB 3073 · DIE ZUSAGE, DIE SICH HIER GEÄNDERT HAT — ausgesprochen, nicht kaschiert.
   * ==============================================================================================
   *
   * Seit die Themen aus den SCHLAGWORTEN entstehen (`themenVon`), zählt ein Objekt mit drei
   * Schlagworten in DREI Themen. **Die Summe der `objekte` über alle Themen ist damit keine
   * Objektsumme mehr**, sondern eine Summe von Zuordnungen; sie ist ≥ `objekteGesamt - ohneThema`
   * und gleich nur dann, wenn kein sichtbares Objekt mehr als ein Schlagwort trägt.
   *
   * Wer eine OBJEKTZAHL braucht, nimmt `objekteGesamt` — die zählt jedes Objekt einmal.
   *
   * Bis JOB 3071 war die Summe eine Objektsumme, weil `category` EIN Wert je Objekt war. Der
   * Bruch mit dieser Lesart ist der Preis der einen Themenachse, und er steht hier, weil eine
   * Seite sonst eine Zahl addierte, die nichts mehr zählt. Auf der Fläche behauptet ihn niemand:
   * `apps/web/src/pages/Wissensnetz.tsx` zeigt `objekteGesamt` und `ohneThema` als eigene Zahlen
   * (`Sichtzahlen`) und summiert die Themenzähler nirgends — gemessen in
   * `tests/wissensnetz-achse/eine-achse.test.ts` (A3).
   */
  objekte: number;
  /**
   * Absteigend nach Umfang, Name als Stichentscheid. **Am `BEITRAGENDE_DECKEL` abgeschnitten** —
   * ob das geschehen ist, sagt `beitragendeAbgeschnitten`.
   */
  beitragende: WissensnetzBeitrag[];
  /**
   * `true`, wenn die Beitragendenliste dieses Themas am Deckel beschnitten wurde.
   *
   * Der Deckel selbst folgt der Begründung, die `lesemodell.ts` für den Themendeckel gibt: eine
   * unbegrenzte Antwort ist ein Speicherrisiko, das der Aufrufer nicht sieht. Sie galt eine Ebene
   * tiefer genauso und war dort nicht angewandt.
   *
   * **Es gibt bewusst KEINE Zahl der weggelassenen Beitragenden** — sie wäre eine Mengenauskunft
   * über nicht Ausgeliefertes, derselbe Fehlertyp, den `abgeschnitten` eine Ebene höher vermeidet
   * und den `kanten-service.ts:27-30` ausdrücklich verbietet.
   *
   * **Nicht optional**, wie `ohneBeitragende`: immer bestimmbar, und `undefined` wäre hier keine
   * ehrliche Auslassung.
   *
   * **Folge für die Summenprobe:** Bei `true` ist die Summe der `beitragende[].objekte` plus
   * `ohneBeitragende` **kleiner** als `objekte` — die Differenz ist dann kein stiller Fehler,
   * sondern genau das, was dieser Schalter ansagt.
   */
  beitragendeAbgeschnitten: boolean;
  /**
   * Sichtbare Objekte dieses Themas OHNE benannten Urheber. Sie zählen in `objekte` mit, stehen
   * aber in keinem `beitragende`-Eintrag — **ohne diese Zahl bliebe die Differenz unerklärt.**
   * Dieselbe Bauform wie `ohneThema` eine Ebene höher: kein erfundener Sammelurheber
   * („Unbekannt"), sondern eine eigene Zahl.
   *
   * **Nicht optional.** Anders als `verknuepft`/`unverknuepft` hängt sie an keiner Anforderung —
   * sie ist immer erhebbar, und eine `undefined` wäre hier keine ehrliche Auslassung, sondern
   * eine fehlende Auskunft.
   *
   * ROHMATERIAL FÜR FRAGE 3, NICHT IHRE ANTWORT: Ob ein Thema ohne benannte Urheber eine Lücke
   * IST, entscheidet PRO5 in `luecken*.ts` — hier steht nur, wie viele es sind.
   */
  ohneBeitragende: number;
  /**
   * Sichtbare Objekte MIT mindestens einer sichtbaren kuratierten Kante — und ohne.
   * `undefined`, solange `mitVerknuepfung` nicht angefordert wurde (siehe `lesemodell.ts`):
   * eine Null wäre hier eine Aussage, und zwar eine falsche.
   *
   * DAS IST DAS ROHMATERIAL FÜR FRAGE 3, NICHT IHRE ANTWORT. Ob ein unverknüpftes Objekt eine
   * Lücke ist, entscheidet PRO5 — hier steht nur, wie viele es sind.
   */
  verknuepft?: number;
  unverknuepft?: number;
}

/**
 * Die beiden Gründe, aus denen die Kantenzähler ausgelassen werden können. Geschlossene Union:
 * ein dritter Grund ist ein Typfehler, kein stiller Sonderfall.
 */
export type VerknuepfungAusgelassenGrund = "kein-kantenport" | "zu-viele-objekte";

export interface WissensnetzSicht {
  themen: WissensnetzThema[];
  /** Sichtbare Objekte insgesamt, NACH dem Trimm. */
  objekteGesamt: number;
  /** Verschiedene sichtbare Beitragende insgesamt. */
  beitragendeGesamt: number;
  /**
   * Sichtbare Objekte OHNE Thema — also ohne ein einziges Schlagwort. Sie stehen in keinem
   * `themen`-Eintrag, weil ein erfundenes Sammelthema („Sonstiges") auf der Seite wie ein echtes
   * aussähe. Diese Zahl ist selbst Rohmaterial für Frage 3.
   *
   * **JOB 3073 — die Gleichung, die hier stand, gilt so nicht mehr.** Bis JOB 3071 war das Thema
   * `category`, EIN Wert je Objekt, und die Summe der Themenzähler war deshalb genau
   * `objekteGesamt - ohneThema`. Seit die Themen aus den SCHLAGWORTEN entstehen, zählt ein Objekt
   * in jedes seiner Schlagworte. Es gilt nur noch:
   *
   *     Summe der `themen[].objekte`  ≥  `objekteGesamt - ohneThema`
   *
   * mit Gleichheit genau dann, wenn kein sichtbares Objekt mehr als ein Schlagwort trägt (und
   * `abgeschnitten` `false` ist). Die alte Gleichheit zu behalten hätte geheissen, ein Objekt
   * willkürlich EINEM seiner Schlagworte zuzuschlagen — dann stimmte die Summe und die Liste
   * nicht mehr mit dem Bild überein. Siehe auch `WissensnetzThema.objekte`.
   */
  ohneThema: number;
  /**
   * Verschiedene sichtbare Beitragende, die zu KEINEM Thema beitragen, weil alle ihre sichtbaren
   * Objekte ohne Thema sind. Sie zählen in `beitragendeGesamt` mit, stehen aber in keinem
   * `beitragende`-Eintrag — **ohne diese Zahl bliebe die Differenz unerklärt.**
   *
   * Sie schliesst die Personenseite derselben Gleichung, die eine Zeile höher für die Objektseite
   * schon steht: verschiedene Urheber über alle `themen[].beitragende` **plus** diese Zahl ergibt
   * `beitragendeGesamt`. Ohne sie zeigt eine Seite eine Kopfzahl, die die Themenliste nicht
   * einlöst.
   *
   * **Die Gleichung gilt genau dann, wenn `abgeschnitten` `false` ist.** Diese Zahl wird gegen
   * ALLE gebildeten Themen gerechnet, nicht gegen die am Deckel beschnittene Ausgabe: Wer nur
   * in einem weggeschnittenen Thema steht, ist nicht themenlos, und ihn hier zu zählen wäre eine
   * falsche Auskunft. Bei `abgeschnitten: true` ist die Summe deshalb eine Untergrenze — genau
   * das sagt `abgeschnitten` an.
   *
   * **Nicht optional**, aus demselben Grund wie `ohneBeitragende`: immer erhebbar, kostet nichts,
   * und ein `undefined` wäre keine ehrliche Auslassung, sondern eine fehlende Auskunft.
   *
   * ROHMATERIAL FÜR FRAGE 3, NICHT IHRE ANTWORT: Ob jemand, der nur ausserhalb der Themen
   * beiträgt, eine Lücke IST, entscheidet PRO5 in `luecken*.ts` — hier steht nur, wie viele es
   * sind. Kein erfundener Sammelurheber, keine Kennungen.
   */
  beitragendeNurOhneThema: number;
  /**
   * `true`, wenn `mitVerknuepfung` angefordert war, die sichtbare Grundmenge aber über
   * `KANTEN_ABFRAGE_DECKEL` lag und die Kantenzähler deshalb ausgelassen wurden.
   *
   * Ohne dieses Feld wären „nicht angefordert" und „zu gross" beide nur `undefined` — der Aufrufer
   * könnte eine fehlende Zahl nicht von einer nicht gestellten Frage unterscheiden.
   */
  verknuepfungAusgelassen: boolean;
  /**
   * **Warum** ausgelassen wurde — steht nur da, wenn `verknuepfungAusgelassen` `true` ist.
   *
   * Der Schalter allein warf zwei Ursachen zusammen, die entgegengesetzte Reaktionen verlangen:
   * ein nicht verdrahteter Kantenport ist ein Fehler der Kompositionswurzel und gehört repariert;
   * eine zu grosse Grundmenge ist erwartetes Verhalten und verlangt eine engere Abfrage. Aus einem
   * einzelnen `true` war das nicht zu unterscheiden — dieselbe stille Differenz, gegen die dieses
   * Modul an drei anderen Stellen gebaut ist.
   *
   * **Ohne Auslassung fehlt der Schlüssel** (nicht `undefined` als Wert): ein Grund ohne
   * Auslassung wäre eine Aussage über nichts — dieselbe Entscheidung wie bei
   * `verknuepft`/`unverknuepft`.
   */
  verknuepfungAusgelassenGrund?: VerknuepfungAusgelassenGrund;
  /**
   * `true`, wenn die Themenliste am Deckel abgeschnitten wurde. Es gibt bewusst KEINE Zahl der
   * weggelassenen Themen: sie wäre eine Mengenauskunft über nicht Ausgeliefertes — derselbe
   * Fehlertyp, den `kanten-service.ts:27-30` als Schnittzähler ausdrücklich verbietet.
   */
  abgeschnitten: boolean;
  /**
   * JOB 2600 D1 — die Themenkarte. **Der Schlüssel fehlt, solange `mitThemenkarte` nicht
   * angefordert wurde** (dieselbe Entscheidung wie bei `verknuepft`: eine leere Karte wäre eine
   * Aussage, und zwar eine falsche).
   *
   * Sie entsteht aus DERSELBEN getrimmten Grundmenge wie alles andere in dieser Antwort — es gibt
   * keinen zweiten Lesevorgang und keine zweite Sichtbarkeitsentscheidung.
   */
  themenkarte?: Themenkarte;
}
