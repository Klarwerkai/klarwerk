import { Languages, Search } from "lucide-react";
import { type ReactNode, type UIEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CONF_TONE_CLASS, type ConfidentialityTone } from "../../lib/confidentiality";
import type { KoPreviewSource } from "../../lib/koPreview";
import { useLesevariante } from "../../lib/lesevariante";
import { KoSummaryDisclosure } from "../KoSummaryDisclosure";
import { cx } from "../ui";
import { BIB_SEGMENTE, type BibSegment, type ZustandsTon, amListenende } from "./zustand";

// ==================================================================================================
// JOB 3063 · H4 — DIE LINKE SPALTE: SUCHEN, EINGRENZEN, WÄHLEN. MEHR STEHT HIER NICHT.
// ==================================================================================================
//
// Maßstab ist `design/klarwerk/Bibliothek.dc.html` Z.37-100: 380 px breit, weiß, rechte Haarlinie;
// oben Suchfeld und Umschalter, darunter die Einträge als Punkt + Titel + eine Meta-Zeile, unten der
// Zähler. Jede Zahl dieser Datei wird in `tests/design/zielbild-h4-bibliothek.test.ts` an der
// GEBAUTEN Seite in Chromium gegen genau diese Vorlage gemessen — nicht hier behauptet.
//
// ZUSTANDSMODELL (Auftrag §9), und es ist der Grund für die `null`-fähige Zahl unten:
//   laden   → leere Spalte OHNE Text (ein „Lädt …" wäre der Erklärsatz, den diese Seite loswird)
//   leer    → EIN Satz plus ein Knopf
//   Fehler  → EIN Satz plus „Erneut versuchen"
//   pausiert → wie laden: NICHTS. Offline wird gar nicht gerufen; ein Leerzustand behauptete dann
//             ein Ergebnis, das niemand geholt hat (JOB 3099 · Q6c, s. den Zweig unten)
//   Zähler  → NUR nach erfolgreichem frischem Abruf eine Zahl; sonst „–". Ein Zähler aus altem
//             Cache behauptete Aktualität, die niemand geprüft hat.

// Der Punkt links: der Zustand als Farbe UND als Wort in der Meta-Zeile daneben, nie nur als Farbe.
const PUNKT_TON: Record<ZustandsTon, string> = {
  pos: "bg-trust-pos-fill",
  warn: "bg-trust-warn-fill",
  crit: "bg-trust-crit-fill",
};

export interface BibZeile {
  art: "eintrag";
  id: string;
  titel: string;
  // „Bereich · Zustand" — genau die zwei Angaben der Vorlage, aus `ko.category` und `status.*`.
  bereich: string;
  zustandWort: string;
  ton: ZustandsTon;
  // JOB 3034: die Vertraulichkeitsstufe im Klartext, auch die fehlende — s. `vertraulichkeitsAuskunft`.
  stufe: { labelKey: string; tone: ConfidentialityTone };
  // ================================================================================================
  // JOB 3488 · BIBLIOTHEK-VORSCHAU-AUFKLAPPER — DIE QUELLE DES VORSCHAUTEXTES, MEHR NICHT.
  // ================================================================================================
  // Der Aufklapper der Zeile liest AUSSCHLIESSLICH, was der Aufrufer hier hereinreicht; gekürzt wird
  // an der einen vorhandenen Stelle (`lib/koPreview.ts`, `koPreviewText`), nicht hier. Das Feld ist
  // optional, weil eine Zeile ohne Kernaussage schlicht keinen Aufklapper bekommt — kein leerer
  // Kasten, kein erfundener Text (`KoSummaryDisclosure.tsx:50-53` gibt dann `null` zurück).
  vorschau?: KoPreviewSource;
}

// D-BIB: die Untergruppen-Ansicht überlebt als Zwischenüberschrift in derselben Liste (vorher
// aufklappbare Karten). Ohne gewählte Untergruppe kommt keine einzige davon vor — die Vorlage bleibt.
export interface BibGruppenkopf {
  art: "gruppe";
  id: string;
  titel: string;
  anzahl: number;
}

export type BibListenPosten = BibZeile | BibGruppenkopf;

// ==================================================================================================
// JOB 3335 · UX-21 — WIE BREIT DIE LISTE IST, STEHT HIER. NUR HIER.
// ==================================================================================================
//
// Bis zu diesem Auftrag hielt diese Datei die 380 px der Vorlage bedingungslos fest, und die Fläche
// darüber überschrieb sie schmal per Nachfahren-Selektor auf die Marke dieser Liste — ein
// Fremdgriff, dessen Kommentar selbst sagte, er sei nur der Weg, „ohne die Datei anzufassen".
// Jetzt sagt die Fläche der Liste, in welcher LAGE sie steht, und die Liste kleidet sich selbst:
//   spalte    → neben dem Bericht, 380 px, rechte Haarlinie (Desktop; die Vorlage, gemessen in
//               `tests/design/zielbild-h4-bibliothek.test.ts` V1/D1)
//   allein    → sie trägt die Fläche, volle Breite (Telefon; Tablet ohne gewählten Bericht)
//   darueber  → das Lese-Tablet mit ausgeklappter Liste: 380 px als Schublade ÜBER dem Bericht,
//               links, mit Schatten nach rechts, bis zum unteren Rand der Fläche (die gibt dafür
//               `relative` und ihre feste Höhe, in der die Spur unten rollt) — und UNTER der
//               haftenden Leiste des Berichts (`top-12` = deren Höhe `h-12`, `BibliothekFlaeche.tsx`),
//               damit Rückweg und Schalter frei liegen und bedienbar bleiben. Der Bericht weicht
//               nicht — sonst stünde er wieder in den 356 px von N-0044.
// Die Fläche entscheidet, OB die Liste steht (`zeigeListe`); hier steht, WIE BREIT und WO.
//
// DREI FLACHE KONSTANTEN UND EINE ENTSCHEIDUNG DAZWISCHEN — nicht ein Nachschlagen `TABELLE[lage]`:
// der Klassensammler (`tests/app/mega47-modale-flaechen-sammler.test.tsx`, JOB 1181) liest flache
// Konstanten vollständig auf; offen bleibt allein die Wahl (dieselbe Bauform wie
// `cx(STAND_ZEILE, … ? STAND_GESTOERT : STAND_RUHIG)`, JOB 3135). Ein berechneter Klassenname
// wäre ihm ein dritter, stiller Zustand (Auflage aus JOB 3267).
type BibListenLage = "spalte" | "allein" | "darueber";
const LAGE_SPALTE = "w-[380px] shrink-0";
const LAGE_ALLEIN = "w-full";
const LAGE_DARUEBER =
  "absolute bottom-0 left-0 top-12 z-20 w-[380px] shadow-[8px_0_24px_rgba(14,22,38,0.12)]";

// ==================================================================================================
// JOB 3362 · LESEVARIANTE-FLAECHEN — DER ZEILENTITEL STEHT IN DER LESESPRACHE.
// ==================================================================================================
//
// Liegt für dieses Wissensobjekt eine Leseübersetzung in der Oberflächensprache vor, trägt die Zeile
// den übersetzten Titel — mit derselben Kennzeichnung wie überall sonst („Übersetzung · Original:
// Englisch"). Die ENTSCHEIDUNG darüber fällt nicht hier, sondern an der einen Stelle aus JOB 3326
// (`lib/lesevariante.ts`, `useLesevariante` → `anzuzeigendeVariante`): andere Sprache als das
// Original, Variante vorhanden — sonst `undefined`, und dann steht das Original ohne jeden Hinweis
// da. Diese Datei zeichnet nur, sie entscheidet nichts.
//
// WARUM DIE KURZFORM UND NICHT DER BAUSTEIN `LesevarianteHinweis`: der Baustein trägt seinen
// Umschalter „Original anzeigen" als eigenen `<button>`, und dieser Umschalter gehört in den
// ZEILENKNOPF hinein — dort, wo der Titel steht, den er umschaltet. Ein Knopf im Knopf ist im DOM
// nicht erlaubt und mit der Tastatur nicht erreichbar. Die Zeile trägt die Kennzeichnung deshalb als
// reinen Text — in DERSELBEN Bauform wie die Kurzvorschau (`KoSummaryDisclosure.tsx:75-84`), mit
// denselben Schlüsseln aus JOB 3326 und ohne einen zweiten Wortlaut. Der Weg zum Original ist die
// Lesefläche rechts, die den vollen Baustein samt Umschalter zeigt.
//
// JOB 3488 — DIE ALTE BEGRÜNDUNG „die Zeile IST ein `<button>`" GILT SO NICHT MEHR und ist deshalb
// hier nachgeführt: die Zeile ist seit dem Vorschau-Aufklapper ein BLOCK aus Zeilenknopf und
// Umschalter als GESCHWISTER (s. unten am Markup). Was bleibt, ist die Regel selbst — ein Knopf in
// einem Knopf entsteht nicht. Für die Lesevariante ändert das nichts: ihr Umschalter säße nicht
// neben dem Titel, sondern müsste ihn ersetzen, und dafür ist die Lesefläche der Ort.
//
// DAS ORIGINAL BLEIBT WAHRHEIT, und zwar messbar: `title=` am Titel führt weiter den ORIGINALtitel
// (der Werkzeugtipp an der abgeschnittenen Zeile), und Suche, Reihung und Gruppierung entstehen
// unverändert in `BibliothekFlaeche.tsx` aus `ko.title` — diese Datei bekommt `posten` fertig
// gereicht und ändert daran nichts.
function ZeilenTitel({ zeile, gewaehlt }: { zeile: BibZeile; gewaehlt: boolean }): JSX.Element {
  const { t } = useTranslation();
  const variante = useLesevariante(zeile.id);
  // Eine Variante OHNE Titel ist für diese Zeile keine: dann steht das Original da, ohne
  // Kennzeichnung. Ein leerer Titel mit dem Vermerk „Übersetzung" wäre die Behauptung einer
  // Übersetzung, die man nicht lesen kann.
  const uebersetzt = variante && variante.title.trim().length > 0 ? variante : undefined;
  // Dieselbe Regel wie im Hinweis-Baustein (`LesevarianteHinweis.tsx:32-37`): der Sprachname kommt
  // aus der Übersetzungsfläche; ein unbekannter Code wird als Code gezeigt und nicht erfunden.
  const sprachname = (code: string): string => {
    const schluessel = `lesevariante.sprache.${code}`;
    const name = t(schluessel);
    return name === schluessel ? code.toUpperCase() : name;
  };
  return (
    <>
      <span
        data-bib-text="zeile-titel"
        title={zeile.titel}
        className={cx(
          "block truncate text-[14px] text-text",
          gewaehlt ? "font-semibold" : "font-medium",
        )}
      >
        {uebersetzt ? uebersetzt.title : zeile.titel}
      </span>
      {uebersetzt ? (
        <span
          data-testid="bib-zeile-uebersetzung"
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-2"
        >
          <Languages size={12} aria-hidden="true" className="shrink-0" />
          {t("lesevariante.badge.uebersetzung", {
            sprache: sprachname(uebersetzt.originalLanguage),
          })}
        </span>
      ) : null}
    </>
  );
}

export function BibliothekListe({
  q,
  onQ,
  ortszeile,
  segment,
  onSegment,
  menues,
  posten,
  gewaehlt,
  onWaehle,
  laedt,
  fehler,
  pausiert,
  hinweis,
  onErneut,
  gesamt,
  onNachladen,
  leerAktion,
  lage,
}: {
  q: string;
  onQ: (wert: string) => void;
  // JOB 381 · `P-1`: die Ortszeile — WORIN gerade gesucht wird. Sie steht ÜBER dem Suchfeld, weil
  // sie den Bestand benennt, auf den sich Suche, Umschalter und Menüs beziehen; die Tabreihenfolge
  // folgt damit der Leserichtung (`R-17`/`A-9`). Der Aufrufer baut sie, die Liste gibt ihr den Ort.
  ortszeile: ReactNode;
  segment: BibSegment;
  onSegment: (wert: BibSegment) => void;
  // Die drei Menüs der Kopfzeile („…", „Bereich", „Filter") — sie kennen die Filterlogik, die
  // Liste kennt sie nicht.
  menues: { punkte: ReactNode; bereich: ReactNode; filter: ReactNode };
  posten: readonly BibListenPosten[];
  gewaehlt: string | null;
  onWaehle: (id: string) => void;
  laedt: boolean;
  fehler: boolean;
  // JOB 3099: der Abruf ist offline ANGEHALTEN und hat für diese Suche noch keine Antwort. Weder
  // ein Laden noch ein Fehler — und deshalb erst recht kein Ergebnis. Der Aufrufer bildet die Lage
  // (`BibliothekFlaeche.tsx`, `fetchStatus === "paused"`); die Liste wertet sie nur aus.
  pausiert: boolean;
  // Nur im Fall gesetzt: der Auffrischungs-Hinweis über dem Bestand, den der Aufrufer baut
  // (`AUFFRISCHUNG_HINWEIS_MARKE`, eine Bauform für Liste UND Lesefläche).
  hinweis: ReactNode;
  onErneut: () => void;
  // `null` = kein frischer erfolgreicher Abruf ⇒ die Fläche zeigt „–" statt einer Zahl.
  gesamt: number | null;
  onNachladen: () => void;
  // Ein Knopf im Leerzustand (Erfassen) — die Rolle entscheidet der Aufrufer.
  leerAktion: ReactNode;
  // JOB 3335: die Lage auf der Fläche — s. `LAGE_KLASSE` oben. Der Aufrufer weiss, welches Band
  // gilt; diese Datei weiss, wie breit sie darin ist.
  lage: BibListenLage;
}): JSX.Element {
  const { t } = useTranslation();
  const spur = useRef<HTMLDivElement | null>(null);

  // Nachladen beim Scrollen ans Ende — und einmal nach dem Zeichnen, falls die sichtbaren Zeilen
  // die Spalte gar nicht füllen (dann gäbe es nie ein Scroll-Ereignis und der Rest bliebe unsichtbar).
  useEffect(() => {
    const el = spur.current;
    if (el && !laedt && !fehler && amListenende(el)) {
      onNachladen();
    }
  });

  const beiScroll = (e: UIEvent<HTMLDivElement>): void => {
    if (amListenende(e.currentTarget)) {
      onNachladen();
    }
  };

  const eintraege = posten.filter((p): p is BibZeile => p.art === "eintrag");

  return (
    <div
      // Die Kennung ist das Ziel von `aria-controls` am Schalter „Trefferliste" der Fläche
      // (JOB 3335): der Schalter sagt damit, WELCHEN Bereich er ein- und ausklappt.
      id="bib-liste"
      data-testid="bib-liste"
      data-lage={lage}
      className={cx(
        "flex flex-col border-r border-hairline bg-surface",
        lage === "spalte" ? LAGE_SPALTE : lage === "allein" ? LAGE_ALLEIN : LAGE_DARUEBER,
      )}
    >
      <div className="flex flex-col gap-2.5 px-4 pb-2.5 pt-4">
        {ortszeile}
        <div className="flex items-center gap-2">
          <div
            data-testid="bib-suchfeld"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-btn border border-hairline bg-page px-3 py-2"
          >
            <Search size={15} aria-hidden className="shrink-0 text-muted" />
            <label htmlFor="bib-suche" className="sr-only">
              {t("lib.searchLabel")}
            </label>
            <input
              id="bib-suche"
              type="search"
              value={q}
              onChange={(e) => onQ(e.target.value)}
              placeholder={t("lib.searchLabel")}
              data-testid="bib-suche"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-[#9AA2B1]"
            />
          </div>
          {menues.punkte}
        </div>
        <div className="flex items-center justify-between gap-2">
          {/* Ein echtes `fieldset` statt `role="group"` — die im Haus getroffene Entscheidung
              (`LibraryScopeBar.tsx:159`, `RichTextEditor.tsx:1826`): die Gruppe bekommt ihren
              Namen aus dem Element plus `aria-label`, nicht aus einem ARIA-Nachbau. */}
          <fieldset
            data-testid="bib-segment"
            aria-label={t("lib.segment.label")}
            className="flex rounded-btn border-0 bg-[#EEEAE3] p-0.5"
          >
            {BIB_SEGMENTE.map((s) => {
              const aktiv = segment === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={aktiv}
                  data-testid={`bib-segment-${s}`}
                  onClick={() => onSegment(s)}
                  className={cx(
                    "rounded-[7px] px-[14px] py-1.5 text-[13px] outline-none",
                    aktiv
                      ? "bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(14,22,38,0.08)]"
                      : "text-muted",
                  )}
                >
                  {s === "alle" ? t("lib.segment.alle") : t(`status.${s}`)}
                </button>
              );
            })}
          </fieldset>
          <div className="flex shrink-0 items-center gap-1">
            {menues.bereich}
            {menues.filter}
          </div>
        </div>
      </div>

      {/* JOB 3063 R6: der Hinweis „Stand von <Zeit> · Auffrischung fehlgeschlagen" — die zweite
          Hälfte der Zusage aus REGELN §7 und Auftrag §9. Die Zeilen bleiben stehen (dafür sorgt
          `fehler` in der Fläche), und HIER steht, dass sie nicht mehr frisch sind. Er steht über
          der Liste und nicht im Fuss, damit der Fuss weiter genau EINE Angabe trägt: den Zähler,
          der in derselben Lage „–" zeigt. Ohne den Fall ist hier nichts. */}
      {hinweis ? <div className="px-4">{hinweis}</div> : null}

      {/* JOB 3335: die Marke trägt die Rollspur nach aussen — die Fläche merkt sich beim Einklappen
          der Liste (Tablet) deren Rollstand und stellt ihn beim Ausklappen wieder her; dafür muss
          sie das rollende Element finden, ohne seine Klassen zu kennen. */}
      <div
        ref={spur}
        onScroll={beiScroll}
        data-testid="bib-spur"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {/* Laden: keine Zeile, kein Text. Erst wenn etwas feststeht, steht hier etwas. */}
        {fehler ? (
          <div className="px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-muted">{t("lib.liste.fehler")}</p>
            <button
              type="button"
              onClick={onErneut}
              className="mt-2 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
            >
              {t("lib.liste.erneut")}
            </button>
          </div>
        ) : null}
        {/* ==========================================================================================
            JOB 3099 · Q6c — HIER WIRD GESCHWIEGEN, WEIL NICHTS GEMESSEN WURDE.
            ==========================================================================================
            Der Leerzustand ist eine TATSACHENAUSSAGE über den Bestand („gesucht, nichts gefunden")
            samt Angebot, den Eintrag neu zu erfassen. Er darf deshalb nur nach einem erfolgreichen
            Abruf entstehen. Die dritte Lage `pausiert` (offline angehalten, noch keine Antwort) war
            bis JOB 3099 keiner der beiden alten Zweige — und fiel damit in den Leerzweig.

            WARUM HIER NICHTS STEHT UND NICHT EIN EIGENER SATZ: Der bessere Satz wäre „Ohne
            Verbindung kann gerade nicht gesucht werden." Er braucht einen neuen Schlüssel in
            `apps/web/src/i18n.ts`, und diese Datei ist von JOB 3079 und JOB 3095 belegt (Auftrag
            §4/§10) — ein Wort ohne Übersetzung wäre die halbe Lieferung. Schweigen ist dagegen
            immer erlaubt (dieselbe Begründung wie beim Zähler, `BibliothekFlaeche.tsx:464-466`) und
            genau das, was diese Datei beim Laden schon tut (`:191`). Der eigene Satz bleibt als
            benannte Restschuld offen, sobald `i18n.ts` frei ist. */}
        {!laedt && !fehler && !pausiert && eintraege.length === 0 ? (
          <div data-testid="bib-leer" className="px-4 py-3">
            <p className="text-[12.5px] leading-relaxed text-muted">
              {q.trim() ? t("lib.liste.leerSuche") : t("lib.liste.leer")}
            </p>
            <div className="mt-2">{leerAktion}</div>
          </div>
        ) : null}
        {posten.map((p) =>
          p.art === "gruppe" ? (
            <div
              key={p.id}
              data-testid="bib-gruppenkopf"
              className="flex items-center gap-2 border-b border-hairline-soft bg-page px-4 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text">
                {p.titel}
              </span>
              <span className="shrink-0 text-[11px] text-muted">{p.anzahl}</span>
            </div>
          ) : (
            // ======================================================================================
            // JOB 3488 · DIE ZEILE IST EIN BLOCK: ZEILENKNOPF UND VORSCHAU-UMSCHALTER SIND
            // GESCHWISTER.
            // ======================================================================================
            // Bis hierher war die ganze Zeile EIN `<button>` und damit der einzige Bedienweg — wer
            // wissen wollte, worum es geht, musste den Eintrag öffnen und die Liste verlassen. Der
            // Aufklapper braucht einen zweiten Knopf; ein Knopf IM Knopf ist im DOM nicht erlaubt und
            // mit der Tastatur nicht erreichbar (die Regel oben). Also trägt jetzt ein Block beides
            // nebeneinander. Der alte Aufbau steht nicht als zweiter Zweig daneben, er ist ersetzt.
            //
            // WAS DER BLOCK TRÄGT UND WAS DER KNOPF: gezeichnet werden Auswahlanstrich und
            // Trennlinie GENAU EINMAL, nämlich am Block — sonst stünden zwei Haarlinien
            // übereinander, sobald ein Aufklapper darunter hängt. Der Knopf ERBT beides
            // (`bg-inherit`, `border-inherit`) und behält seine gemessenen Zeilenmaße (12/16 px
            // Polster). Damit misst `tests/design/zielbild-h4-bibliothek.test.ts` V10/V11 an der
            // Zeile weiter genau die Werte, die die Zeile zeigt.
            //
            // WAS AM KNOPF BLEIBEN MUSS, weil fremder Code es liest: `data-testid="bib-zeile"` plus
            // `data-bib-id` an einem FOKUSSIERBAREN Element (`BibliothekFlaeche.tsx:1011-1012`
            // sucht es, `:1017`/`:1029`/`:1037` fokussiert es, `:1030` rollt es ins Bild) und
            // `aria-current` für die gewählte Zeile. Eine Marke am umhüllenden `div` machte den
            // Fokus- und Rollweg aus JOB 3121/3335 kaputt.
            <div
              key={p.id}
              data-testid="bib-zeilenblock"
              data-bib-id={p.id}
              className={cx(
                "border-b border-hairline-soft",
                p.id === gewaehlt ? "bg-[#FDEADD]" : "hover:bg-hairline-soft",
              )}
            >
              <button
                type="button"
                data-testid="bib-zeile"
                data-bib-id={p.id}
                aria-current={p.id === gewaehlt ? "true" : undefined}
                onClick={() => onWaehle(p.id)}
                className="group flex w-full items-start gap-2.5 border-inherit bg-inherit px-4 py-3 text-left outline-none"
              >
                <span
                  aria-hidden
                  data-testid="bib-punkt"
                  className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-[50%]", PUNKT_TON[p.ton])}
                />
                <span className="flex min-w-0 flex-col gap-[3px]">
                  {/* JOB 3362: der Titel in der Lesesprache, wenn es eine Übersetzung gibt — samt
                    Kennzeichnung. Die Begründung steht am Bauteil selbst. */}
                  <ZeilenTitel zeile={p} gewaehlt={p.id === gewaehlt} />
                  <span data-bib-text="zeile-meta" className="block text-[12px] text-muted">
                    {`${p.bereich} · ${p.zustandWort}`}
                  </span>
                  {/* JOB 3034 · JOB 3063 R6: die Vertraulichkeitsstufe im Klartext — JEDE Zeile trägt
                    genau EINE, und die fehlende sagt „Nicht eingestuft" statt zu schweigen. Sie
                    steht bewusst NEBEN der Meta-Zeile und nicht darin: die Meta-Zeile ist auf
                    „Bereich · Zustand" gemessen (`zielbild-h4-bibliothek` V15, genau zwei Teile).
                    Der Einbau der Runde 5 reichte die Stufe bis hierher durch und zeichnete sie
                    dann nicht — der Weg endete blind, und `stufe-im-klartext` fand nichts. */}
                  <span
                    data-testid="ko-vertraulichkeitsstufe"
                    data-bib-text="zeile-stufe"
                    title={t("conf.field")}
                    className={cx(
                      "mt-[3px] w-fit rounded-pill px-1.5 py-0.5 text-[11px] font-semibold",
                      CONF_TONE_CLASS[p.stufe.tone],
                    )}
                  >
                    {t(p.stufe.labelKey)}
                  </span>
                </span>
              </button>
              {/* Der Aufklapper — der EINE vorhandene Baustein, importiert und nicht abgeschrieben.
                  Er hält seinen Offen-Zustand je Vorkommen (`KoSummaryDisclosure.tsx:38`), also je
                  Treffer, und sein Umschalter hält Klick und Vorgabe an (`:60-62`): weder wechselt
                  die Auswahl mit, noch wandert die Adresse. Ohne Kernaussage gibt er `null` zurück —
                  dann steht hier nichts, und die Zeile behauptet auch nicht, es gäbe nichts.
                  `id` reicht die Kennung nur für die Leseübersetzung durch (JOB 3326).
                  DAS POLSTER: der Umschalter rückt in das Fusspolster des Zeilenknopfs (`-mt-2`) und
                  beginnt an der Textspalte (34 px = 16 px Polster + 8 px Punkt + 10 px Abstand) —
                  so bleiben die gemessenen Zeilenmaße unangetastet und der Block fällt trotzdem
                  nicht auseinander. */}
              <KoSummaryDisclosure
                source={{ ...p.vorschau, id: p.id }}
                className="-mt-2 pb-3 pl-[34px] pr-4"
              />
            </div>
          ),
        )}
      </div>

      <div
        data-testid="bib-fuss"
        data-bib-text="zaehler"
        className="mt-auto border-t border-hairline-soft px-4 py-2.5 text-[12px] text-muted"
      >
        {gesamt === null
          ? t("lib.liste.eintraegeUnbekannt")
          : t("lib.liste.eintraege", { count: gesamt })}
      </div>
    </div>
  );
}
