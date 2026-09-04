import { Search } from "lucide-react";
import { type ReactNode, type UIEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CONF_TONE_CLASS, type ConfidentialityTone } from "../../lib/confidentiality";
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
  hinweis,
  onErneut,
  gesamt,
  onNachladen,
  leerAktion,
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
  // Nur im Fall gesetzt: der Auffrischungs-Hinweis über dem Bestand, den der Aufrufer baut
  // (`AUFFRISCHUNG_HINWEIS_MARKE`, eine Bauform für Liste UND Lesefläche).
  hinweis: ReactNode;
  onErneut: () => void;
  // `null` = kein frischer erfolgreicher Abruf ⇒ die Fläche zeigt „–" statt einer Zahl.
  gesamt: number | null;
  onNachladen: () => void;
  // Ein Knopf im Leerzustand (Erfassen) — die Rolle entscheidet der Aufrufer.
  leerAktion: ReactNode;
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
      data-testid="bib-liste"
      className="flex w-[380px] shrink-0 flex-col border-r border-hairline bg-surface"
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

      <div ref={spur} onScroll={beiScroll} className="min-h-0 flex-1 overflow-y-auto">
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
        {!laedt && !fehler && eintraege.length === 0 ? (
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
            <button
              key={p.id}
              type="button"
              data-testid="bib-zeile"
              data-bib-id={p.id}
              aria-current={p.id === gewaehlt ? "true" : undefined}
              onClick={() => onWaehle(p.id)}
              className={cx(
                "group flex w-full items-start gap-2.5 border-b border-hairline-soft px-4 py-3 text-left outline-none",
                p.id === gewaehlt ? "bg-[#FDEADD]" : "hover:bg-hairline-soft",
              )}
            >
              <span
                aria-hidden
                data-testid="bib-punkt"
                className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-[50%]", PUNKT_TON[p.ton])}
              />
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span
                  data-bib-text="zeile-titel"
                  title={p.titel}
                  className={cx(
                    "block truncate text-[14px] text-text",
                    p.id === gewaehlt ? "font-semibold" : "font-medium",
                  )}
                >
                  {p.titel}
                </span>
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
