// ================================================================================================
// JOB 3326 · LESEVARIANTE — DER SICHTBARE HINWEIS UND DER WEG ZURÜCK ZUM ORIGINAL.
// ================================================================================================
//
// Wer eine Übersetzung liest, muss es WISSEN. Dieses Bauteil ist die eine Stelle, an der das steht:
// die Kennzeichnung „Übersetzung · Original: Englisch", der ehrliche Zusatz, dass eine Übersetzung
// nie Freigabegegenstand ist, der Vorbehalt „Original seit der Übersetzung geändert" (serverseitig
// gemessen) — und der Umschalter, der mit einem Klick das Original zeigt.
//
// Es entscheidet NICHTS: ob überhaupt eine Variante gezeigt wird, entscheidet `anzuzeigendeVariante`
// (lib/lesevariante.ts). Hier steht nur, wie die Entscheidung aussieht.
//
// PETER NR. 20 (12.10.2026): „Übersetzung sichtbar als maschinelle Lesehilfe mit Originalquelle und
// Fassung kennzeichnen; Original bleibt maßgeblich. Übersetzungswidersprüche melden, keine
// automatische fachliche Freigabe." Deshalb trägt der Baustein jetzt zusätzlich
//   · den Satz „Maschinelle Lesehilfe — maßgeblich ist das Original",
//   · die Originalquelle (Titel, Anker, Quellfassung) — oder ausdrücklich „nicht zugeordnet",
//   · die belegte Fassung — oder ausdrücklich „Fassung nicht zugeordnet",
//   · und, wo die Fläche einen Meldeweg reicht (`onWiderspruch`), „Widerspruch melden". Die Meldung
//     ist ein Protokolleintrag; sie ändert weder Übersetzung noch Original noch Freigabe.
// Die bisherigen Wortlaute („Übersetzung · Original: …", „Übersetzung, keine Freigabe") bleiben.
//
// WARUM KEINE NEUEN TEILKOMPONENTEN: die Zeilen und das Meldeformular stehen als kleingeschriebene
// Hilfsfunktionen bzw. im Baustein selbst. Es ist dieselbe EINE Kennzeichnungsfläche — sie wird
// länger, nicht mehr (die Sammler in `tests/app/mega84-…` zählen Komponenten exakt).
import { Languages } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  LesevarianteFassung,
  LesevarianteKennzeichnung,
  LesevarianteOriginalquelle,
} from "../api/types";

// Dieselbe Form wie `Translate` in `lib/auditAction.ts`: als Überladung ohne `undefined`-Fall ist
// die echte i18next-`t` auch unter `exactOptionalPropertyTypes` zuweisbar.
interface Uebersetze {
  (schluessel: string): string;
  (schluessel: string, werte: Record<string, unknown>): string;
}

// Die Kennzeichnung trägt bewusst KEINE von aussen gesetzte Klassenkette: sie soll überall gleich
// aussehen, und ein durchgereichtes `className` wäre eine im Quelltext nicht auflösbare Bindung
// (der Flächen-Sammler in `tests/app/mega47-modale-flaechen-sammler.test.tsx` zählt genau die).
//
// JOB 3363: DIE PROPS SIND VERENGT, NICHT ERWEITERT. Bis hierher verlangte dieser Baustein eine
// vollständige `LesevarianteKurz` — samt `koId`, `lang`, `title`, `statement`, `updatedAt`. Gelesen
// hat er davon nie mehr als `originalLanguage`, `herkunft`, `quellabgleich` und `originalGeaendert`.
// Die Prüfkarte in Stufe 2 zeigt die Variante eines noch NICHT angenommenen Kandidaten: dort gibt es
// keine `koId`, und eine erfundene wäre eine Kennung, die auf nichts zeigt. Statt einer zweiten
// Kennzeichnungsfläche daneben (oder eines `as`, das die Lücke überstreicht) verlangt der Baustein
// jetzt genau das, was er benutzt — `LesevarianteKennzeichnung`. Die beiden Verbraucher aus JOB 3326
// (Detailansicht, Bibliotheks-Lesefläche) übergeben unverändert ihre volle Variante.
export function LesevarianteHinweis({
  variante,
  zeigtOriginal,
  onUmschalten,
  onWiderspruch,
}: {
  variante: LesevarianteKennzeichnung;
  /** Der Leser hat „Original anzeigen" gewählt — dann steht hier die Gegenrichtung. */
  zeigtOriginal: boolean;
  onUmschalten: () => void;
  /**
   * Peter Nr. 20: der Meldeweg „Übersetzungswiderspruch". Die FLÄCHE reicht ihn, weil nur sie weiss,
   * WORAN gemeldet wird (Wissensobjekt oder Kandidat). Fehlt er, steht kein Meldeknopf da.
   */
  onWiderspruch?: (begruendung: string) => Promise<unknown>;
}): JSX.Element {
  const { t } = useTranslation();
  const feldId = useId();
  const [meldestand, setMeldestand] = useState<Meldestand>("zu");
  const [begruendung, setBegruendung] = useState("");
  const [begruendungFehlt, setBegruendungFehlt] = useState(false);
  // Die Sprachnamen kommen aus der Übersetzungsfläche und nicht aus einer Tabelle im Code: „EN"
  // heißt auf Deutsch „Englisch" und auf Englisch „English".
  const sprachname = (code: string): string => {
    const schluessel = `lesevariante.sprache.${code}`;
    const name = t(schluessel);
    // Unbekannter Code → der Code selbst, groß. Ehrlicher als ein erfundener Name.
    return name === schluessel ? code.toUpperCase() : name;
  };
  // Peter Nr. 20: ohne Begründung keine Meldung — sonst wüsste niemand, WAS sich widerspricht.
  const sendeWiderspruch = async (): Promise<void> => {
    const text = begruendung.trim();
    if (!onWiderspruch) {
      return;
    }
    if (text.length === 0) {
      setBegruendungFehlt(true);
      return;
    }
    setBegruendungFehlt(false);
    setMeldestand("laeuft");
    try {
      await onWiderspruch(text);
      setBegruendung("");
      setMeldestand("gemeldet");
    } catch {
      setMeldestand("fehler");
    }
  };
  const formularOffen =
    meldestand === "offen" || meldestand === "laeuft" || meldestand === "fehler";
  return (
    <div
      data-testid="lesevariante-hinweis"
      className="rounded-card border border-hairline bg-page px-3 py-2 text-[12px] text-muted"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-semibold text-text">
          <Languages size={14} aria-hidden="true" />
          {zeigtOriginal
            ? t("lesevariante.badge.original", { sprache: sprachname(variante.originalLanguage) })
            : t("lesevariante.badge.uebersetzung", {
                sprache: sprachname(variante.originalLanguage),
              })}
        </span>
        <button
          type="button"
          data-testid="lesevariante-umschalter"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onUmschalten();
          }}
          className="rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-text hover:bg-card"
        >
          {zeigtOriginal ? t("lesevariante.zeigeUebersetzung") : t("lesevariante.zeigeOriginal")}
        </button>
      </div>
      {zeigtOriginal ? null : (
        <p className="mt-1 text-[11.5px] text-muted-2">
          {t("lesevariante.keineFreigabe")} ·{" "}
          {t("lesevariante.herkunft", { herkunft: variante.herkunft })}
        </p>
      )}
      {/* Peter Nr. 20: die Art der Übersetzung, ihr Original und dessen Fassung — immer sichtbar,
          auch wenn gerade das Original gezeigt wird: die Bindung gilt für beide Ansichten. */}
      <p
        data-testid="lesevariante-maschinell"
        className="mt-1 text-[11.5px] font-semibold text-text"
      >
        {t("lesevariante.maschinell")}
      </p>
      {variante.originalquelle ? (
        <p data-testid="lesevariante-originalquelle" className="mt-1 text-[11.5px] text-muted-2">
          {t("lesevariante.originalquelle", { quelle: quellText(variante.originalquelle, t) })}
        </p>
      ) : (
        <p
          data-testid="lesevariante-originalquelle-fehlt"
          className="mt-1 text-[11.5px] font-semibold text-trust-warn-text"
        >
          {t("lesevariante.originalquelleFehlt")}
        </p>
      )}
      {variante.fassung ? (
        <p data-testid="lesevariante-fassung" className="mt-1 text-[11.5px] text-muted-2">
          {fassungText(variante.fassung, t)}
        </p>
      ) : (
        <p
          data-testid="lesevariante-fassung-fehlt"
          className="mt-1 text-[11.5px] font-semibold text-trust-warn-text"
        >
          {t("lesevariante.fassungFehlt")}
        </p>
      )}
      {variante.originalGeaendert ? (
        <p
          data-testid="lesevariante-veraltet"
          className="mt-1 text-[11.5px] font-semibold text-trust-warn-text"
        >
          {t("lesevariante.originalGeaendert")}
        </p>
      ) : null}
      {/* JOB 3326 R2 (Codex e4b79ac9): Fehlt der Beleg, dass diese Übersetzung zu genau diesem
          Originaltext gehört, steht das DA. Der Abdruck am Objekt belegt sonst nur „seit dem Laden
          unverändert" — und das ist eine schwächere Aussage, als der Leser ihm ansieht. */}
      {variante.quellabgleich === "unbestaetigt" ? (
        <p data-testid="lesevariante-unbestaetigt" className="mt-1 text-[11.5px] text-muted-2">
          {t("lesevariante.zuordnungUnbestaetigt")}
        </p>
      ) : null}
      {/* Peter Nr. 20: „Übersetzungswidersprüche melden". Das Formular steht in Karten, die selbst
          auf Klick und Tasten reagieren können (Prüfkarte, Bibliothek) — es hält seine Ereignisse
          deshalb bei sich. Nach dem Senden steht die Quittung da, und eine weitere Meldung bleibt
          möglich. */}
      {onWiderspruch && meldestand === "gemeldet" ? (
        <output
          data-testid="lesevariante-widerspruch-gemeldet"
          className="mt-2 block text-[11.5px] text-text"
        >
          {t("lesevariante.widerspruch.gemeldet")}
        </output>
      ) : null}
      {onWiderspruch && !formularOffen ? (
        <button
          type="button"
          data-testid="lesevariante-widerspruch-oeffnen"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setMeldestand("offen");
          }}
          className="mt-2 rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-text hover:bg-card"
        >
          {t("lesevariante.widerspruch.oeffnen")}
        </button>
      ) : null}
      {onWiderspruch && formularOffen ? (
        <div
          data-testid="lesevariante-widerspruch-formular"
          className="mt-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <label htmlFor={feldId} className="block text-[11.5px] font-semibold text-text">
            {t("lesevariante.widerspruch.label")}
          </label>
          <textarea
            id={feldId}
            data-testid="lesevariante-widerspruch-text"
            value={begruendung}
            onChange={(e) => setBegruendung(e.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-1 w-full rounded-btn border border-hairline bg-card px-2 py-1 text-[12px] text-text"
          />
          {begruendungFehlt ? (
            <p role="alert" className="mt-1 text-[11.5px] text-trust-warn-text">
              {t("lesevariante.widerspruch.leer")}
            </p>
          ) : null}
          {meldestand === "fehler" ? (
            <p
              data-testid="lesevariante-widerspruch-fehler"
              role="alert"
              className="mt-1 text-[11.5px] text-trust-warn-text"
            >
              {t("lesevariante.widerspruch.fehler")}
            </p>
          ) : null}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              data-testid="lesevariante-widerspruch-senden"
              disabled={meldestand === "laeuft"}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                void sendeWiderspruch();
              }}
              className="rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-text hover:bg-card"
            >
              {meldestand === "laeuft"
                ? t("lesevariante.widerspruch.laeuft")
                : t("lesevariante.widerspruch.senden")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setBegruendungFehlt(false);
                setMeldestand("zu");
              }}
              className="rounded-btn border border-hairline px-2 py-0.5 text-[11.5px] font-semibold text-text hover:bg-card"
            >
              {t("lesevariante.widerspruch.abbrechen")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Meldestand = "zu" | "offen" | "laeuft" | "gemeldet" | "fehler";

/** Peter Nr. 20: „Titel · Provider Kennung · Quellfassung n" — nur, was die Antwort wirklich trägt. */
function quellText(quelle: LesevarianteOriginalquelle, t: Uebersetze): string {
  const anker = [quelle.provider, quelle.kennung]
    .filter((teil): teil is string => typeof teil === "string" && teil.trim().length > 0)
    .join(" ");
  const teile = [
    quelle.titel.trim(),
    anker,
    quelle.quellfassung === null
      ? ""
      : t("lesevariante.quellfassung", { quellfassung: quelle.quellfassung }),
  ];
  return teile.filter((teil) => teil.length > 0).join(" · ");
}

/**
 * Peter Nr. 20: Originalquelle und Fassung als EIN Satz — für die Kurzformen (Bibliothekszeile,
 * Kurzvorschau), die keinen Platz für den ganzen Baustein haben und ihn als Werkzeugtipp tragen.
 * Dieselben Wortlaute wie oben, einschliesslich „nicht zugeordnet".
 */
export function bindungsText(variante: LesevarianteKennzeichnung, t: Uebersetze): string {
  const quelle = variante.originalquelle
    ? t("lesevariante.originalquelle", { quelle: quellText(variante.originalquelle, t) })
    : t("lesevariante.originalquelleFehlt");
  const fassung = variante.fassung
    ? fassungText(variante.fassung, t)
    : t("lesevariante.fassungFehlt");
  return `${t("lesevariante.maschinell")} · ${quelle} · ${fassung}`;
}

/** Peter Nr. 20: die belegte Fassung in Worten. */
function fassungText(fassung: LesevarianteFassung, t: Uebersetze): string {
  return fassung.art === "wissensobjekt"
    ? t("lesevariante.fassungWissensobjekt", {
        version: fassung.version,
        abdruck: fassung.abdruck,
      })
    : t("lesevariante.fassungQuelle", { quellfassung: fassung.quellfassung });
}
