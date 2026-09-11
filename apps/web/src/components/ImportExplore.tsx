// IC-2 (Import-Cockpit): erste sichtbare Erkundungs-Ansicht „was ist da". Zeigt VOR jedem Import eine
// Landkarte der Quelle (Mengen, Autoren, Themen, Zeitraum, Bild-Hinweis). READ-ONLY — der „Erkunden"-
// Knopf ruft nur die aggregierende Explore-Route (schreibt nichts). Quellen-Kacheln: Confluence aktiv,
// Jira „bald" (ausgegraut). Design schlicht, iPad-tauglich. Übersetzung DE/EN/NL über i18n-Keys.
// WP-IC-PAKET-1 (Teil 3): Autoren-/Themen-/Space-Chips sind jetzt KLICKBARE Filter (aria-pressed,
// aktiver Zustand deutlich, große Trefferfläche) — sie speisen die Auswahl-Vorschau (ImportSelect).
// WP-IC-PAKET-1 (Teil 2): abgeleitete Themen (aus Titeln, deterministisch) sind dezent gekennzeichnet.
// WP-IC-PAKET-1 (Teil 4): „davon bereits importiert"-Zeile aus dem Quell-Referenz-Abgleich.
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Images, Loader2, Search, Users } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ImportExploreResponse } from "../api/types";
import { displayImportText } from "../lib/htmlEntities";
import {
  type ExploreView,
  NO_AUTHOR_LABEL,
  NO_THEME_LABEL,
  toExploreView,
} from "../lib/importExplore";
import { JSON_SOURCE_IDS } from "../lib/importSourceGallery";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { usePersistentString } from "../lib/usePersistentValue";
import { ImportSelect, registriereRahmenTexte } from "./ImportSelect";
// AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie (Systeme + Dateien) mit Zustandsbadges.
import { ImportSourceGallery } from "./ImportSourceGallery";
// WP-COCKPIT-LINIE: Schritt-Überschriften (1 Quelle · 2 Erkunden) + Meilenstein-Meldung an die Leiste.
import { ImportStepHeading, useImportSource, useReportImportStage } from "./ImportStepper";
import { Button, Card, TextInput } from "./ui";

// ================================================================================================
// JOB 3640 · DER VORFÜHRRAHMEN — „FÜR WELCHE FIRMA FÜHRE ICH VOR?"
// ================================================================================================
//
// PEDIS BEFUND (11.09., über Codex): Er hatte „bereits verlangt, die Firma eingeben/auswählen zu
// können, für die er vorführt; danach sollen nur deren Daten sichtbar sein, z. B. beim
// Confluence-Import". Er fand die Auswahl nicht — es GAB sie nicht. Ausdrücklich: „Themenwort
// ‚Demo' als nachträglicher Suchfilter reicht nicht."
//
// ------------------------------------------------------------------------------------------------
// WELCHES MERKMAL TRENNT DEN BESTAND WIRKLICH? (Auftrag §4.3)
// ------------------------------------------------------------------------------------------------
// Geprüft in der vom Auftrag vorgegebenen Reihenfolge, mit den Zahlen aus Pedis Bildbeleg
// (`gespraech/feedback-20260911-admin-loeschen/confluence-ohne-demo-firmenfilter.png`, 110 Seiten):
//
//   QUELLE (`spaces`)      1 Quelle für alle 110 Seiten. Ein Quellenfilter kann hier NICHTS
//                          trennen — genau deshalb blendet diese Fläche die Space-Chips bei einer
//                          einzigen Quelle bis heute aus (`view.spaces.length > 1`, s. unten).
//   AUTOR (`authors`)      1 Autor („Peter Kohnert", 110). Trennt ebenfalls nichts.
//   THEMA (`themes`)       10 Gruppen, ALLE mit „abgeleitet" gekennzeichnet: sie stammen nicht aus
//                          Quell-Labels, sondern werden deterministisch aus je EINEM Titelwort
//                          erzeugt (`services/library-analytics/src/themes.ts`). 27 der 110 Seiten
//                          tragen dabei gar kein Thema („(ohne Thema) 27"), und die Liste ist auf
//                          die Top 12 gedeckelt. Ein Thema ist ein Wort, keine Firma; als Rahmen
//                          wäre es lückenhaft (27 Seiten fielen durch) und zufällig.
//   TITEL (`titleContains`, JOB 3356)
//                          Substring-Vergleich im kanonisierten Titel, UND-verknüpft mit allen
//                          anderen Kriterienarten (`filterImportItems`). Das ist in diesem Bestand
//                          das EINZIGE Merkmal, das überhaupt trennen kann.
//
// DESHALB IST DER RAHMEN EIN TITELWORT — UND KEINE AUSWAHLLISTE ERFUNDENER FIRMEN. Das Produkt
// kennt keine Firmenzugehörigkeit je Seite; weder Quelle noch Autor noch Label sagen etwas darüber.
// Eine Liste „Advisor / Basic / …" wäre eine Behauptung über Daten, die niemand geschrieben hat
// (Auftrag §5: „Nichts umetikettieren"). Der Mensch nennt das Wort, das SEINE Seiten im Titel
// tragen, und die Fläche sagt ihm mit einer GEMESSENEN Zahl, wie viele Seiten das sind — auch die 0.
//
// ------------------------------------------------------------------------------------------------
// WAS GERAHMT IST — UND WAS AUSDRÜCKLICH NICHT (Auftrag §4.4 und §5)
// ------------------------------------------------------------------------------------------------
// GERAHMT (der Rahmen reist als `titleContains` mit und lässt sich nicht wegklicken):
//   · die Seitenzahl im Erkunden — eigens gemessen, s. `useRahmenUmfang` unten,
//   · Eingrenzen/Vorschau: `ImportSelect.buildCriteria` legt ihn in JEDE Anfrage,
//   · Gruppierung und Übernahme: sie laufen über `preview.criteria` des Servers, und dort steht der
//     Rahmen, weil die Klick-Kriterien die KI-Deutung schlagen (`{...derived, ...clickCriteria}`,
//     `routes/confluence-import-routes.ts`).
//
// NICHT GERAHMT, und deshalb SICHTBAR SO BENANNT: die Landkarte der Erkundung (Autoren, Themen,
// Quellen, Zeitraum, „davon bereits importiert"). Die Erkundungs-Route nimmt keine Kriterien
// entgegen und liefert nur fertige Aggregate; diese Zahlen nachzubauen hieße, ein zweites
// Aggregat neben dem des Servers zu führen. Eine ehrliche Lücke ist besser als ein Filter, der
// Vollständigkeit behauptet (Auftrag §5) — die Fläche schreibt deshalb an die Landkarte, dass sie
// den Gesamtbestand zählt, statt eine gerahmte Zahl vorzutäuschen.
//
// GESPEICHERT wird der Rahmen pro Browser (`usePersistentString`, dieselbe fehlertolerante Grenze
// wie jede andere überlebende Anzeigewahl). Damit muss Pedi nicht vor jeder Vorführung daran
// denken — und er sieht in der Leiste jederzeit, dass ein Rahmen gilt.
const VORFUEHRRAHMEN_SPEICHER = "klarwerk.import.vorfuehrrahmen";

// DIE TEXTE DES RAHMENS (DE/EN/NL) wohnen bei ihrer Funktion, in `ImportSelect.tsx` — mit voller
// Begründung dort. Sie melden sich an der EINEN i18next-Instanz an; `t("imp.rahmen…")` unten ist
// danach ein Nachschlag wie jeder andere. Der Aufruf steht hier NOCH EINMAL und ist idempotent:
// er darf nicht davon abhängen, welches der beiden Module zuerst geladen wird.
registriereRahmenTexte();

/**
 * Der GEMESSENE Umfang des Rahmens.
 *
 * `zahl === null` heißt „noch nicht gemessen" und NICHT „0" (LEHREN §7: die Fläche unterscheidet
 * unbekannt von leer). Eine Zahl steht hier ausschließlich aus einer erfolgreichen Antwort.
 */
interface RahmenUmfang {
  zahl: number | null;
  laeuft: boolean;
  fehler: boolean;
  erneut: () => void;
}

/**
 * Die Seitenzahl des Rahmens — über die BESTEHENDE, READ-ONLY Auswahl-Route, mit genau einem
 * Kriterium.
 *
 * WARUM ÜBERHAUPT EIN EIGENER AUFRUF: Die Erkundungs-Route kennt keine Kriterien, ihr `totalCount`
 * ist immer der ganze Bestand. Ohne diese Messung stünde über einem gerahmten Import weiter die
 * ungerahmte 110 — „eine Zahl, die den Rahmen ignoriert, wäre schlimmer als kein Rahmen"
 * (Auftrag §4.4). Gemessen wird mit derselben Filterfunktion, die danach auch die Vorschau
 * auswählt; es entsteht kein zweiter Zählweg.
 *
 * OHNE SATZ UND OHNE MODELL: `prompt: ""` — die Route leitet nur bei nicht-leerem Satz Kriterien
 * ab, ruft also weder Reasoner noch Cloud. `promptConfidential: true` ist das fail-safe Pflichtfeld
 * des Vertrags; es gibt hier keinen Satz, der irgendwohin gehen könnte. `limit: 1` hält die Antwort
 * klein — `matched` zählt serverseitig VOR dem Deckel (`filterImportItems`) und bleibt exakt.
 *
 * KEINE HINTERGRUND-AUFFRISCHUNG: gemessen wird, wenn ein Rahmen UND eine Landkarte da sind, und
 * danach nur noch auf ausdrückliche Handlung (Erkunden-Knopf, „Erneut zählen"). Scheitert eine
 * Auffrischung, bleibt die zuletzt erfolgreich gemessene Zahl stehen und wird als solche benannt.
 */
function useRahmenUmfang(
  rahmen: string | null,
  landkarteDa: boolean,
  erkundungsLauf: number,
): RahmenUmfang {
  const { i18n } = useTranslation();
  const abfrage = useQuery({
    queryKey: ["import-vorfuehrrahmen-umfang", "confluence", rahmen, erkundungsLauf],
    enabled: rahmen !== null && landkarteDa,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<number> => {
      const antwort = await endpoints.admin.import.select({
        prompt: "",
        criteria: { titleContains: [rahmen ?? ""], limit: 1 },
        locale: toReasonerLocale(i18n.language),
        promptConfidential: true,
      });
      return antwort.matched;
    },
  });
  return {
    zahl: abfrage.data ?? null,
    laeuft: abfrage.isFetching,
    fehler: abfrage.isError,
    erneut: () => {
      void abfrage.refetch();
    },
  };
}

/**
 * Die sichtbare Wahl VOR dem Erkunden — und danach die Leiste, die zeigt, dass sie gilt.
 *
 * Zwei Zustände, ein Griff zurück: ohne Rahmen ein benanntes Feld mit Knopf, mit Rahmen eine
 * Leiste mit Namen, gemessener Seitenzahl und „Rahmen aufheben". Die Leiste steht ganz oben in der
 * Karte und bleibt über alle Schritte sichtbar.
 */
function VorfuehrrahmenKasten({
  rahmen,
  umfang,
  setzen,
  aufheben,
}: {
  rahmen: string | null;
  umfang: RahmenUmfang;
  setzen: (firma: string) => void;
  aufheben: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [entwurf, setEntwurf] = useState("");

  if (rahmen === null) {
    const uebernehmen = (): void => {
      const wort = entwurf.trim();
      if (wort.length > 0) {
        setzen(wort);
        setEntwurf("");
      }
    };
    return (
      <div
        data-testid="vorfuehrrahmen-wahl"
        className="mb-4 rounded-card border border-hairline bg-page px-3 py-2.5"
      >
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text">
          <Building2 size={14} /> {t("imp.rahmen.titel")}
        </span>
        <p className="mt-1 text-[12px] text-muted">{t("imp.rahmen.erklaerung")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TextInput
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                uebernehmen();
              }
            }}
            placeholder={t("imp.rahmen.platzhalter")}
            aria-label={t("imp.rahmen.feldLabel")}
            className="w-56"
          />
          <Button disabled={entwurf.trim().length === 0} onClick={uebernehmen}>
            {t("imp.rahmen.setzen")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="vorfuehrrahmen-leiste"
      className="mb-4 rounded-card border border-ink/30 bg-page px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text">
          <Building2 size={14} /> {t("imp.rahmen.aktiv", { firma: rahmen })}
        </span>
        {/* Die Zahl hängt an ihrer Voraussetzung: gemessen / wird gemessen / nicht abrufbar /
            noch gar nicht gemessen — vier Zustände, vier eigene Sätze, nie eine erfundene Zahl. */}
        <span data-testid="vorfuehrrahmen-umfang" className="text-[12px] text-muted">
          {umfang.zahl !== null
            ? t("imp.rahmen.umfang", { count: umfang.zahl })
            : umfang.laeuft
              ? t("imp.rahmen.umfangLaeuft")
              : umfang.fehler
                ? t("imp.rahmen.umfangFehler")
                : t("imp.rahmen.umfangUngemessen")}
        </span>
        {/* Eine gescheiterte Auffrischung leert die zuletzt gemessene Zahl NICHT — sie sagt, dass
            sie die zuletzt gemessene ist (LEHREN §7). */}
        {umfang.zahl !== null && umfang.fehler ? (
          <span className="text-[12px] text-trust-warn-text">{t("imp.rahmen.umfangVeraltet")}</span>
        ) : null}
        {umfang.fehler ? (
          <Button variant="ghost" onClick={umfang.erneut} disabled={umfang.laeuft}>
            {t("imp.rahmen.umfangErneut")}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={aufheben}>
          {t("imp.rahmen.aufheben")}
        </Button>
      </div>
      {/* Der leere Rahmen ist kein stilles Nichts — er sagt, dass er leer ist, und warum. */}
      {umfang.zahl === 0 ? (
        <p className="mt-1.5 text-[12px] text-trust-warn-text">
          {t("imp.rahmen.leer", { firma: rahmen })}
        </p>
      ) : null}
    </div>
  );
}

// Die Kern-Platzhalter kommen sprach-neutral aus IC-1 („(ohne Autor)"/„(ohne Label)"); hier auf die
// lokalisierten Anzeigetexte abbilden, damit die Landkarte in jeder UI-Sprache ehrlich lesbar ist.
// WP-IC-PAKET-1c (ROT-2): der defensive Entity-Decode läuft NUR, wenn der Decode-Marker der Summary
// fehlt (Altbestand) — kanonische Namen (Marker "decoded") würden sonst DOPPELT dekodiert und ein
// echtes Literal wie „&uuml;" fälschlich zu ü.
function localizeName(name: string, t: (k: string) => string, textDecoded: boolean): string {
  if (name === NO_AUTHOR_LABEL) {
    return t("imp.explore.noAuthor");
  }
  if (name === NO_THEME_LABEL) {
    return t("imp.explore.noTheme");
  }
  return displayImportText(name, textDecoded ? "decoded" : undefined);
}

// WP-IC-PAKET-1 (Teil 3): einheitlicher Filter-Chip — echtes button, aria-pressed, iPad-große Fläche,
// aktiver Zustand deutlich (invertiert). Platzhalter-Einträge bleiben nicht-klickbare Anzeige.
function FilterChip({
  label,
  count,
  active,
  onToggle,
  extra,
  title,
}: {
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
  extra?: string;
  title?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      {...(title !== undefined ? { title } : {})}
      className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[12.5px] ${
        active
          ? "border-ink/30 bg-ink text-white"
          : "border-hairline bg-page text-text hover:border-ink/20"
      }`}
    >
      {label}
      {extra !== undefined ? (
        <span className={`text-[10px] italic ${active ? "text-white/70" : "text-muted-2"}`}>
          {extra}
        </span>
      ) : null}
      <span className={`font-mono text-[10.5px] ${active ? "text-white/80" : "text-muted-2"}`}>
        {count}
      </span>
    </button>
  );
}

function toggleValue(setter: (fn: (prev: string[]) => string[]) => void, value: string): void {
  setter((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
}

function ExploreMap({
  view,
  truncated,
  alreadyImported,
  alreadyQueued,
  failedPages,
  abbruch,
  rahmen,
  umfang,
}: {
  view: ExploreView;
  truncated: boolean;
  // JOB 3640: der gültige Vorführrahmen (Titelwort) und seine gemessene Seitenzahl. `null` = kein
  // Rahmen — dann verhält sich diese Landkarte zeichengleich wie vorher.
  rahmen: string | null;
  umfang: RahmenUmfang;
  alreadyImported: number;
  // WP-SHIP9-S1b (bens GELB): getrennt vom Import — offene Kandidaten sind nur „vorgemerkt".
  alreadyQueued: number;
  // WP-SAMMEL20-FIX (bens Fix 6a): Seiten, die beim Lesen/Mappen der Quelle scheiterten.
  failedPages: number;
  // JOB 2683 D2: der Grund, warum die Erkundung vor dem Ende abbrach — damit „unvollständig"
  // nicht nur ein Wort ist, sondern sagt, was passiert ist und wie viel schon da ist.
  abbruch: ImportExploreResponse["abbruch"] | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  // WP-IC-PAKET-1 (Teil 3): Klick-Filter der Landkarte — Roh-Werte (Server-Vertrag), Anzeige dekodiert.
  const [selAuthors, setSelAuthors] = useState<string[]>([]);
  const [selThemes, setSelThemes] = useState<string[]>([]);
  const [selSpaces, setSelSpaces] = useState<string[]>([]);

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      {truncated ? (
        <p
          data-testid="explore-truncated"
          className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text"
        >
          {t("imp.explore.truncated", { n: view.totalCount })}
          {/* JOB 2683 D2: der Abbruchgrund steht direkt dabei — gelesene Seiten bleiben sichtbar. */}
          {abbruch ? (
            <span data-testid="explore-abbruch" className="mt-1 block">
              {t(`imp.explore.abbruch.${abbruch.grund}`, { n: abbruch.nachSeiten })}
            </span>
          ) : null}
        </p>
      ) : null}
      {/* WP-SAMMEL20-FIX (bens Fix 6a): partielle Lesefehler nüchtern ausweisen statt verschweigen. */}
      {failedPages > 0 ? (
        <p className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12px] text-trust-warn-text">
          {t("imp.explore.failedPages", { n: failedPages })}
        </p>
      ) : null}
      {/* Kennzahlen.
          JOB 3640: Gilt ein Rahmen UND ist seine Seitenzahl GEMESSEN, steht sie hier statt der
          ungerahmten Gesamtzahl — mit der Gesamtzahl als ehrlicher Bezugsgröße darunter. Ist sie
          (noch) nicht gemessen, bleibt die Gesamtzahl mit ihrer eigenen Beschriftung stehen: eine
          gerahmte Zahl zu behaupten, die niemand gezählt hat, wäre schlimmer als keine. */}
      <div className="grid grid-cols-3 gap-2">
        {rahmen !== null && umfang.zahl !== null ? (
          <Stat
            label={t("imp.rahmen.seitenImRahmen")}
            value={String(umfang.zahl)}
            note={t("imp.rahmen.vonGesamt", { total: view.totalCount })}
          />
        ) : (
          <Stat label={t("imp.explore.pages")} value={String(view.totalCount)} />
        )}
        <Stat label={t("imp.explore.sources")} value={String(view.distinctSources)} />
        <Stat label={t("imp.explore.period")} value={view.period} />
      </div>
      {/* Auftrag §5: die Landkarte kann nicht gerahmt zählen (die Erkundungs-Route nimmt keine
          Kriterien entgegen) — dann sagt sie es, statt gerahmte Zahlen vorzutäuschen. */}
      {rahmen !== null ? (
        <p data-testid="rahmen-landkarte-hinweis" className="mt-2 text-[12px] text-trust-warn-text">
          {t("imp.rahmen.landkarteUngerahmt")}
        </p>
      ) : null}
      {/* WP-IC-PAKET-1 (Teil 4, IC-6a): ehrlicher Import-Status über die Quell-Referenzen —
          WP-SHIP9-S1b: importiert (lebender KO-Anker) und vorgemerkt (offener Kandidat) getrennt. */}
      {alreadyImported > 0 ? (
        <p className="mt-2 text-[12px] text-muted">
          {t("imp.explore.alreadyImported", { n: alreadyImported })}
        </p>
      ) : null}
      {alreadyQueued > 0 ? (
        <p className="mt-2 text-[12px] text-muted">
          {t("imp.explore.alreadyQueued", { n: alreadyQueued })}
        </p>
      ) : null}

      {/* Autoren — klickbare Filter (WP-IC-PAKET-1 Teil 3; vorher nur Anzeige). */}
      {view.authors.length > 0 ? (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <Users size={13} /> {t("imp.explore.authors")}
            {/* WP-SAMMEL20-FIX (bens Fix 6b): der Server liefert Top-N — ehrlich beziffert. */}
            {view.authorsTotal > view.authorsListed ? (
              <span className="font-normal text-muted-2">
                · {t("imp.explore.topOf", { n: view.authorsListed, total: view.authorsTotal })}
              </span>
            ) : null}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.authors.map((a) =>
              a.name === NO_AUTHOR_LABEL ? (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12.5px] text-muted-2"
                >
                  {localizeName(a.name, t, view.textDecoded)}
                  <span className="font-mono text-[10.5px]">{a.count}</span>
                </span>
              ) : (
                <FilterChip
                  key={a.name}
                  label={localizeName(a.name, t, view.textDecoded)}
                  count={a.count}
                  active={selAuthors.includes(a.name)}
                  onToggle={() => toggleValue(setSelAuthors, a.name)}
                />
              ),
            )}
            {view.authorsRest > 0 ? (
              <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] text-muted-2">
                {t("imp.explore.more", { n: view.authorsRest })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Themen — klickbare Filter; abgeleitete Themen (aus Titeln) dezent gekennzeichnet (Teil 2). */}
      {view.themes.length > 0 ? (
        <div className="mt-4">
          <span className="text-[12px] font-semibold text-muted">
            {t("imp.explore.themes")}
            {view.themesTotal > view.themesListed ? (
              <span className="font-normal text-muted-2">
                {" "}
                · {t("imp.explore.topOf", { n: view.themesListed, total: view.themesTotal })}
              </span>
            ) : null}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.themes.map((th) =>
              th.label === NO_THEME_LABEL ? (
                <span
                  key={th.label}
                  className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-page px-2.5 py-1 text-[12.5px] text-muted-2"
                >
                  {localizeName(th.label, t, view.textDecoded)}
                  <span className="font-mono text-[10.5px]">{th.count}</span>
                </span>
              ) : (
                <FilterChip
                  key={th.label}
                  label={localizeName(th.label, t, view.textDecoded)}
                  count={th.count}
                  active={selThemes.includes(th.label)}
                  onToggle={() => toggleValue(setSelThemes, th.label)}
                  {...(th.derived
                    ? { extra: t("imp.explore.derivedTag"), title: t("imp.explore.derivedHint") }
                    : {})}
                />
              ),
            )}
            {view.themesRest > 0 ? (
              <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-[12px] text-muted-2">
                {t("imp.explore.more", { n: view.themesRest })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Spaces — Filter nur, wenn es MEHRERE gibt (Teil 3; bei einem Space wäre der Chip sinnlos). */}
      {view.spaces.length > 1 ? (
        <div className="mt-4">
          <span className="text-[12px] font-semibold text-muted">{t("imp.explore.spaces")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {view.spaces.map((s) => (
              <FilterChip
                key={s.name}
                label={displayImportText(s.name, view.textDecoded ? "decoded" : undefined)}
                count={s.count}
                active={selSpaces.includes(s.name)}
                onToggle={() => toggleValue(setSelSpaces, s.name)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Bild-Hinweis */}
      {view.withImagesHint > 0 ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-muted-2">
          <Images size={13} /> {t("imp.explore.withImages", { n: view.withImagesHint })}
        </p>
      ) : null}

      {view.totalCount === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-2">{t("imp.explore.empty")}</p>
      ) : null}

      {/* IC-3: prompt-/filtergesteuerte Auswahl-Vorschau — die Chips der Landkarte sind die Filter.
          READ-ONLY (kein Übernahme-Button; das ist IC-4). */}
      {view.totalCount > 0 ? (
        <ImportSelect
          chip={{ themes: selThemes, authors: selAuthors, spaces: selSpaces }}
          rahmen={rahmen}
        />
      ) : null}
    </div>
  );
}

// JOB 3194 (M6b) — DER RÜCKWEG AUS DER ERKLÄRSEITE MUSS WIRKLICH HIER LANDEN.
//
// Die Erklärseite `public/demonstration/importwege.html` zeigt mit ihrem Rückweg-Link auf
// `/import#import-source-gallery`. Beim Vollaufruf dieser Adresse gibt es den Anker beim Parsen des
// Dokuments NOCH NICHT: `/import` lädt sein Seitenmodul erst nach (`routes.tsx`,
// `lazy(() => import("./pages/Stufe2"))`), die Galerie entsteht also nach dem Ankersprung des
// Browsers. Gemessen im Ausgangszustand (JOB 3194, gebaute App in Chromium): der Anker lag bei
// 1440×900 bei 982 px, bei 390×844 bei 1208 px — beide Male unter dem Fenster —, und der Fokus stand
// auf `body`. Der Sprung wird deshalb hier nachgeholt, sobald die Galerie WIRKLICH montiert ist.
//
// Die Kennung selbst gehört der Galerie (`ImportSourceGallery.tsx`, `id="import-source-gallery"`)
// und wird hier nur GELESEN — nie über Struktur oder Position gesucht.
const GALERIE_ANKER = "import-source-gallery";

// JOB 3194 RUNDE 3 (BENs Befund) — UND DASSELBE FÜR DAS BROWSER-ZURÜCK.
//
// Der Ankersprung oben trägt nur, wenn die Adresse den Anker führt. Wer `/import` GEWÖHNLICH aufruft
// (ohne Anker), von dort auf die Erklärseite geht und dann Browser-Zurück drückt, landet auf genau
// diesem gewöhnlichen Verlaufseintrag — ohne Anker, also ohne Sprung. Gemessen: Galerie bei 982 px
// (1440×900) bzw. 1208 px (390×844), Fokus auf `body`.
//
// Die Lösung setzt an der URSACHE an, nicht am Symptom: Wer die Fläche über den Erklärlink DER
// GALERIE verlässt, war bei der Galerie — also bekommt der Verlaufseintrag, den er zurücklässt, in
// diesem Moment den Anker. Das Zurück führt danach auf `/import#import-source-gallery`, und es
// greift derselbe, bereits belegte Weg. Kein zweiter Mechanismus, kein neuer Speicher, kein Raten
// über die Herkunft: der Rückkehrpunkt wird nur dann gesetzt, wenn der Mensch WIRKLICH über diesen
// Link hinausgeht.
//
// GESCHRIEBEN WIRD DIE ADRESSE AUSSCHLIESSLICH ÜBER DEN ROUTER (`useNavigate`, `{ replace: true }`).
//
// Runde 3 rief hier `window.history.replaceState` direkt auf. Das war falsch, und der Wächter
// `tests/app/navguard-history-authority.test.ts` (Kante 1) hat es gefangen: Der Router stempelt bei
// jedem push/replace seinen `history.state.idx`; ein von Hand erzeugter Eintrag trägt diesen Stempel
// NICHT, und React Router warnt, dass ein späteres POP auf so einen Eintrag STILL scheitert
// (`router.js:1579`). Genau daran hängt der Zurück-Wächter der Anwendung (`app/NavGuardContext.tsx`,
// `app/navHistory.ts`) — der Rückweg der Erklärseite hätte den Zurück-Schutz der ganzen App
// beschädigen können. Über `navigate` bleibt der Index gestempelt und es gibt eine Autorität für die
// Adresse, nicht zwei.
const ERKLAERSEITE_PFAD = "/demonstration/importwege.html";

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  // JOB 3640: die Bezugsgröße unter der Kennzahl („von 110 im Gesamtbestand") — nur gesetzt, wo es
  // wirklich eine gibt; ohne sie sieht die Kachel zeichengleich aus wie bisher.
  note?: string;
}): JSX.Element {
  return (
    <div className="rounded-card border border-hairline bg-page px-3 py-2">
      <div className="text-[18px] font-semibold leading-tight text-text">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-2">{label}</div>
      {note !== undefined ? <div className="mt-0.5 text-[11px] text-muted-2">{note}</div> : null}
    </div>
  );
}

export function ImportExplore(): JSX.Element {
  const { t } = useTranslation();
  const explore = useMutation<ImportExploreResponse>({
    mutationFn: () => endpoints.admin.import.explore(),
  });

  const view = explore.data ? toExploreView(explore.data.summary) : null;
  const errorMessage = explore.error instanceof ApiError ? explore.error.message : t("state.error");

  // JOB 3640: der gültige Vorführrahmen. Gespeichert wird der rohe Text; gültig ist er erst nach
  // dem Trimmen — ein Rahmen aus Leerzeichen ist kein Rahmen.
  const [rahmenRoh, setRahmenRoh] = usePersistentString(VORFUEHRRAHMEN_SPEICHER, "");
  const rahmen = rahmenRoh.trim().length > 0 ? rahmenRoh.trim() : null;
  // Welcher Erkundungslauf gilt gerade? Die Zahl gehört in den Abfrageschlüssel, damit ein neuer
  // Lauf auch eine neue Messung des Rahmens verlangt: sonst stünde neben einer frisch erkundeten
  // Landkarte eine Rahmenzahl aus dem Lauf davor. Gezählt wird an der HANDLUNG (unten, `erkunden`)
  // und nicht in einem Effekt — ein Effekt würde bei jeder Neuzeichnung erneut messen wollen.
  const [erkundungsLauf, setErkundungsLauf] = useState(0);
  const umfang = useRahmenUmfang(rahmen, view !== null, erkundungsLauf);

  // Der Erkunden-Weg — EINE Stelle für beide Auslöser (Knopf und Confluence-Kachel).
  const erkunden = (): void => {
    setErkundungsLauf((lauf) => lauf + 1);
    explore.mutate();
  };

  // WP-COCKPIT-LINIE: Landkarte da → Meilenstein "explored" an die Schritt-Leiste melden und die
  // Ansicht zum neuen Schritt scrollen (Muster aus R7 — der Schrittwechsel darf nicht vom
  // Scroll-Zufall abhängen).
  const reach = useReportImportStage();
  // AUFTRAG-mega32 H1: die gewählte Quelle steuert, was von diesem Kasten überhaupt gezeigt wird.
  const { source, chooseSource } = useImportSource();
  const mapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (explore.data) {
      reach("explored");
      mapRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [explore.data, reach]);

  // JOB 3194 (M6b): der nachgeholte Ankersprung (siehe GALERIE_ANKER oben).
  // Bedingungen, jede mit Absicht:
  //  · NUR wenn genau dieser Anker im `location.hash` steht — ein gewöhnlicher Aufruf von `/import`
  //    verschiebt keinen Fokus (sonst wäre es Fokusklau).
  //  · GENAU EINMAL je Ankeraufruf (`gesprungen`), nicht bei jeder Neuzeichnung.
  //  · Erst wenn die Galerie montiert ist: der Effekt läuft nach dem ersten Zeichnen dieser Fläche,
  //    und die Galerie wird von derselben Fläche unbedingt gezeichnet (kein Sprung ins Leere).
  // Der Zustand der Erkundung (lädt / leer / Fehler / Cache) spielt dabei keine Rolle: die Galerie
  // steht in jedem dieser Zustände, und dieser Sprung sagt über Daten nichts aus.
  // GESCHRIEBEN wird die Adresse ausschließlich über den Router (siehe ERKLAERSEITE_PFAD oben).
  // GELESEN wird zweimal, und zwar bewusst aus zwei Quellen: der Klickweg unten fragt den Ort des
  // ROUTERS (er navigiert gleich selbst und muss dessen Sicht treffen), der Ankersprung darüber
  // fragt `window.location` (er beschreibt den Zustand des DOKUMENTS beim ersten Zeichnen — genau
  // die Adresse, mit der der Browser diese Seite geöffnet hat). Lesen ist frei; die Wächterregel
  // aus `tests/app/navguard-history-authority.test.ts` betrifft nur das Schreiben und Bewegen.
  const navigate = useNavigate();
  const ort = useLocation();
  const galerieRef = useRef<HTMLDivElement | null>(null);
  const gesprungen = useRef(false);
  useEffect(() => {
    if (gesprungen.current || window.location.hash !== `#${GALERIE_ANKER}`) {
      return;
    }
    const ziel = galerieRef.current?.querySelector<HTMLElement>(`#${GALERIE_ANKER}`);
    if (!ziel) {
      return;
    }
    gesprungen.current = true;
    // Ein Abschnitt ist von sich aus nicht fokussierbar. `tabindex="-1"` macht ihn zum Sprungziel,
    // OHNE ihn in die Tabulatorreihenfolge zu nehmen — das übliche Sprungmarken-Muster. Gesetzt
    // wird das Attribut hier und nicht in der Galerie, weil der Sprung diesem Weg gehört und die
    // Galerie ohne ihn unverändert bleibt.
    if (!ziel.hasAttribute("tabindex")) {
      ziel.setAttribute("tabindex", "-1");
    }
    ziel.scrollIntoView({ block: "start" });
    ziel.focus({ preventScroll: true });
  }, []);

  // JOB 3194 R4: den Rückkehrpunkt setzen, BEVOR der Browser die Seite verlässt (siehe
  // ERKLAERSEITE_PFAD oben) — über den Router, mit `replace`, damit kein zusätzlicher
  // Verlaufseintrag entsteht und der Index gestempelt bleibt.
  // Nur bei einem Klick, der wirklich navigiert: ein Klick mit Zusatztaste oder mittlerer Maustaste
  // öffnet einen neuen Tab und lässt diese Seite stehen; dann wäre eine geänderte Adresse eine
  // Behauptung über einen Weg, den niemand gegangen ist.
  const merkeRueckkehrpunkt = (ereignis: ReactMouseEvent<HTMLDivElement>): void => {
    if (ereignis.defaultPrevented || ereignis.button !== 0) {
      return;
    }
    if (ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey || ereignis.altKey) {
      return;
    }
    const link = (ereignis.target as Element).closest("a");
    if (link?.getAttribute("href") !== ERKLAERSEITE_PFAD) {
      return;
    }
    if (ort.hash === `#${GALERIE_ANKER}`) {
      return;
    }
    // Pfad und Abfrage werden ausdrücklich mitgegeben: ein reines `{ hash }` würde einen
    // vorhandenen Abfrageteil verwerfen (react-router `resolveTo`).
    navigate(
      { pathname: ort.pathname, search: ort.search, hash: `#${GALERIE_ANKER}` },
      { replace: true },
    );
  };

  // AUFTRAG-ic7-import-vision: Klick auf eine AKTIVE Galerie-Kachel loest den echten, bereits
  // existierenden Fluss aus — Confluence die READ-ONLY Erkundung, JSON den bestehenden Datei-Dialog
  // (derselbe versteckte Upload; kein neuer Egress-Pfad). „bald"/„geplant" rufen dies GAR NICHT auf
  // (das entscheidet die Galerie selbst).
  //
  // AUFTRAG-mega32 BLOCK H — DIE KACHEL WÄHLT JETZT, STATT NUR AUSZULÖSEN.
  //
  // H3: Hier stand der DOM-Durchgriff — `document.getElementById(JSON_UPLOAD_INPUT_ID).click()`.
  // Der Eingang liegt im JSON-Kasten, den H2 ausblendet; bedingt gerendert hätte der Griff ins
  // Leere gegriffen, GERÄUSCHLOS. Jetzt meldet die Kachel nur ihre WAHL an das Cockpit; der Kasten
  // öffnet seinen eigenen Eingang über eine Referenz, sobald die Anforderung steigt.
  const handleActivate = (id: string): void => {
    if (id === "confluence") {
      chooseSource("confluence");
      erkunden();
      return;
    }
    if ((JSON_SOURCE_IDS as readonly string[]).includes(id)) {
      chooseSource("json");
    }
  };

  return (
    <Card className="mb-5">
      {/* JOB 3640: die Wahl der Firma steht VOR allem anderen und bleibt sichtbar, solange sie
          gilt — sie rahmt jeden folgenden Schritt. Begründung im Kopf dieser Datei. */}
      <VorfuehrrahmenKasten
        rahmen={rahmen}
        umfang={umfang}
        setzen={setRahmenRoh}
        aufheben={() => setRahmenRoh("")}
      />

      {/* WP-COCKPIT-LINIE Schritt 1: Quelle wählen. */}
      <ImportStepHeading step="source" />

      {/* AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie „wo die Reise hingeht" — Systeme
          (Confluence · JSON-Import aktiv; Jira · Word · PDF bald; SharePoint/Teams/Drive/… geplant)
          + Dateien (JSON aktiv; Word/PDF bald; Excel/PowerPoint/CSV/OCR/Transkript geplant). NUR
          aktive Kacheln loesen den echten, bestehenden Fluss aus: Confluence startet die READ-ONLY
          Erkundung, JSON oeffnet den bestehenden Datei-Dialog. „bald"/„geplant" zeigen nur einen
          ehrlichen Hinweis — kein Import, kein Formular, kein Fortschritt. */}
      <div className="mt-2 pl-8" ref={galerieRef} onClickCapture={merkeRueckkehrpunkt}>
        <ImportSourceGallery onActivate={handleActivate} />
      </div>

      {/* AUFTRAG-mega32 H2: Was nicht zur gewählten Quelle gehört, verschwindet. Bei JSON tun die
          Confluence-Schritte Erkunden und Eingrenzen nicht mehr so, als gehörten sie zum Weg.
          Solange NICHTS gewählt ist (`source === null`), bleibt alles stehen wie bisher. */}
      {source === "json" ? null : (
        <>
          {/* WP-COCKPIT-LINIE Schritt 2: Erkunden. Der Knopf ist der EINE Primär-CTA des Einstiegs
          („Weiter: …"-Muster); sobald die Landkarte da ist, tritt er zurück (outline, „Neu
          erkunden") — der nächste Primär-Knopf gehört dann Schritt 3. */}
          <div className="mt-4">
            <ImportStepHeading step="explore" />
          </div>
          <div className="mt-2 pl-8">
            <Button
              variant={view ? "outline" : "primary"}
              disabled={explore.isPending}
              onClick={erkunden}
            >
              {explore.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Search size={15} />
              )}
              {explore.isPending
                ? t("imp.explore.exploring")
                : view
                  ? t("imp.explore.ctaAgain")
                  : t("imp.explore.cta")}
            </Button>
          </div>

          {explore.isError ? (
            <p
              data-testid="explore-error"
              className="mt-3 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
            >
              {errorMessage}
            </p>
          ) : null}

          {view ? (
            <div ref={mapRef} className="scroll-mt-4">
              <ExploreMap
                view={view}
                rahmen={rahmen}
                umfang={umfang}
                truncated={explore.data?.truncated ?? false}
                alreadyImported={explore.data?.alreadyImported ?? 0}
                alreadyQueued={explore.data?.alreadyQueued ?? 0}
                failedPages={explore.data?.failedPages ?? 0}
                abbruch={explore.data?.abbruch}
              />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
