// JOB 3065 H6 R2 — DER LADE-, FEHLER- UND STALE-VERTRAG DER DETAILKARTEN.
//
// BENs Befund aus Runde 1 (Korrekturpflicht 2): Die Zeile sagte bei einem gescheiterten Abruf
// ehrlich „nicht abrufbar" — die Detailkarte dahinter zeigte danach DAUERHAFT „Wird geladen …".
// Ein injizierter 503 auf `/api/reasoner/config` ergab `{ laden: true, erneut: false }`. Das ist
// genau die zweite Unwahrheit statt der ersten: die Karte behauptet fortgesetzte Arbeit, obwohl
// der Abruf gescheitert ist, und bietet keinen Weg zurück.
//
// Diese Hülle ist die EINE Stelle, an der eine Detailkarte ihren Zustand rendert. Sie bildet
// dasselbe Modell ab wie der Zeilenwert (`zeilenWert.ts`, REGELN §7, Auftrag §9):
//
//   lädt ....................... „Wird geladen …"
//   Fehler ohne Daten .......... „nicht abrufbar" + „Erneut versuchen" (ruft wirklich neu ab)
//   offline ohne Daten ......... ehrliche Offline-Auskunft + „Erneut versuchen"
//   Daten + laufende Auffrischung  Daten BLEIBEN sichtbar, darüber „Stand von <Zeit>"
//   Daten + gestörte Auffrischung  Daten BLEIBEN sichtbar, darüber „Stand von <Zeit> ·
//                                  nicht aktualisiert" mit Wiederholen
//   Daten ...................... der Inhalt
//
// Der Offline-Zustand wird reaktiv aus dem `onlineManager` gelesen (LEHREN 3037 R5, 3044 R2), nicht
// allein aus `fetchStatus === "paused"`.
//
// JOB 3135 H6-D1 — DER STAND STEHT JETZT DABEI, IM WORTLAUT DER ÜBERSICHT.
// Bis hierher rendert die Hülle bei gestörter Auffrischung den `StaleMarker` („Veraltet –
// Aktualisierung fehlgeschlagen") OHNE Zeitangabe. Die Zeile eine Ebene höher sagt für denselben
// Zustand „Stand von 07:24 · nicht aktualisiert" (`Zeilenkarte.tsx:34-47`, live gesehen in
// R-1563 :56). Derselbe Zustand hatte damit zwei Wortlaute, und der jüngere davon verschwieg, WIE
// alt der Bestand ist. Die Hülle setzt den Zusatz deshalb aus denselben zwei Schlüsseln zusammen
// wie die Übersicht (`einst.wert.stand` · `einst.wert.nichtAktualisiert`).
import { AlertTriangle, RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cx } from "../ui";
import { abfragelage, useIstOnline, wertBefund } from "./zeilenWert";

/** Die Minimalsicht auf eine react-query-Abfrage, die die Hülle braucht. */
export interface Abfrage<T> {
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: string;
  dataUpdatedAt: number;
  refetch: () => unknown;
}

/**
 * Der Fehlerzustand als eigenes Bauteil — EINE Fassung für alle Einstellungen.
 *
 * JOB 3065 R3 (BENs Korrekturpflicht 1: „sämtliche querygestützten Detailkarten an denselben
 * Zustandsvertrag"): Die Bereitschaft ist die einzige Karte mit einer GRUPPE von sechs Quellen; sie
 * kann die Hülle nicht verwenden, weil ihre Zeilen im Ladezustand einzeln „wird geladen" sagen
 * (mega2/mega3, von `readiness-loading-mounted` gepinnt). Ihren FEHLERZUSTAND teilt sie sich jetzt
 * aber mit allen anderen: derselbe Wortlaut, derselbe Ausweg.
 */
export function Fehlerbox({
  label,
  offline = false,
  onErneut,
}: {
  /**
   * JOB 3065 R4: Auf einer FLÄCHE (Konten) tritt die Box an die Stelle einer Zeile — dort sagt erst
   * das Label, WORÜBER die Auskunft geht. In einer Detailkarte trägt die Karte den Titel schon; dann
   * bleibt das Label weg, statt ihn zu wiederholen.
   */
  label?: string;
  offline?: boolean;
  onErneut: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      data-einst="abfrage-fehler"
      className="flex flex-wrap items-center gap-3 rounded-card border border-trust-crit-bg bg-trust-crit-bg px-3 py-2.5 text-[13px] text-trust-crit-text"
    >
      <AlertTriangle size={16} className="shrink-0" />
      {label === undefined ? null : (
        <span data-einst="label" className="font-semibold">
          {label}
        </span>
      )}
      <span className="flex-1">
        {offline ? t("einst.detail.offline") : t("einst.wert.nichtAbrufbar")}
      </span>
      <button
        type="button"
        onClick={onErneut}
        className="inline-flex items-center gap-1.5 rounded-btn border border-trust-crit-text/40 px-2.5 py-1 font-semibold hover:bg-trust-crit-text/10"
      >
        <RefreshCw size={13} />
        {t("loadstate.error.retry")}
      </button>
    </div>
  );
}

// ================================================================================================
// JOB 3135 H6-D1 · DIE STANDZEILE — EIN ZUSTAND, EIN WORTLAUT.
// ================================================================================================
// Vier flache Konstanten statt eines Objekts: der Klassenbindungs-Sammler
// (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) löst einen lokalen Bezeichner mit literalem
// Wert auf, einen Eigenschaftszugriff `X.y` aber nicht (dieselbe Begründung wie in
// `Zeilenkarte.tsx:100-105`).
/** Der Träger der Zeile: bricht um, trägt Text und Wiederholen nebeneinander. */
const STAND_ZEILE = "flex flex-wrap items-center gap-2 rounded-btn px-2.5 py-1.5 text-[11.5px]";
/** Gestört (Fehler oder offline): die Warnfarbe, dieselbe wie am `StaleMarker`. */
const STAND_GESTOERT = "bg-trust-warn-bg font-semibold text-trust-warn-text";
/** Nur „Stand von …": die Auffrischung läuft noch — das ist keine Störung und trägt keine Warnfarbe. */
const STAND_RUHIG = "text-muted-2";
/** Der Wiederholen-Knopf in der Zeile (Fokus kommt aus der globalen `:focus-visible`-Regel). */
const STAND_KNOPF =
  "inline-flex items-center gap-1 rounded-btn px-2 py-0.5 hover:bg-trust-warn-text/10";

export function Abfragehuelle<T>({
  abfrage,
  children,
  testId,
}: {
  abfrage: Abfrage<T>;
  children: (daten: T) => ReactNode;
  testId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  const online = useIstOnline();
  const [standBeiStoerung, setStandBeiStoerung] = useState<number | null>(null);
  const befund = wertBefund(abfragelage(abfrage, online), null, false, standBeiStoerung);
  // JOB 3180: genau hier wohnt das Gedächtnis. Der reine Befund entscheidet, ob die
  // Episode noch offen ist. Synchron vor dem Rendern nachführen, damit kein Effekt erst
  // nach einem unmarkierten Bild die Störung merkt (auch unter StrictMode).
  const gemerkterStand = befund.nichtAktualisiert
    ? (standBeiStoerung ?? abfrage.dataUpdatedAt)
    : null;
  if (gemerkterStand !== standBeiStoerung) {
    setStandBeiStoerung(gemerkterStand);
  }
  const erneut = (): void => void abfrage.refetch();

  if (befund.art === "laedt") {
    return (
      <p data-einst="laedt" data-testid={testId} className="text-[12.5px] text-muted-2">
        {t("state.loading")}
      </p>
    );
  }
  if (befund.art === "fehler" || befund.art === "offline") {
    return (
      <div data-testid={testId}>
        <Fehlerbox offline={befund.art === "offline"} onErneut={erneut} />
      </div>
    );
  }
  // Daten sind da — sie bleiben SICHTBAR, auch wenn die Auffrischung scheitert oder ruht.
  //
  // Der Zusatz entsteht aus DENSELBEN zwei Schlüsseln und in DERSELBEN Reihenfolge wie in der
  // Übersicht (`Zeilenkarte.tsx:34-47`), damit ein Zustand nicht zwei Wortlaute bekommt:
  //   Auffrischung läuft ..... „Stand von 07:24"
  //   Auffrischung gestört ... „Stand von 07:24 · nicht aktualisiert" + Wiederholen
  // Ohne laufende Auffrischung oder offene Störung ist `standMs` 0 — nach einem erfolgreich
  // nachgeholten Abruf steht hier wie beim Erstabruf also gar nichts.
  const zusatz: string[] = [];
  if (befund.standMs > 0) {
    zusatz.push(
      t("einst.wert.stand", {
        zeit: new Date(befund.standMs).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    );
  }
  if (befund.nichtAktualisiert) {
    zusatz.push(t("einst.wert.nichtAktualisiert"));
  }
  return (
    <div data-testid={testId} className="space-y-4">
      {zusatz.length > 0 ? (
        // <output> trägt implizit role="status" (biome useSemanticElements) — dieselbe Wahl wie am
        // `StaleMarker`: eine Statusregion, keine Alarmregion (JOB 2064 A18).
        <output
          data-einst="stand"
          className={cx(STAND_ZEILE, befund.nichtAktualisiert ? STAND_GESTOERT : STAND_RUHIG)}
        >
          {befund.nichtAktualisiert ? <AlertTriangle size={13} className="shrink-0" /> : null}
          <span className="flex-1">{zusatz.join(" · ")}</span>
          {befund.nichtAktualisiert ? (
            <button type="button" onClick={erneut} className={STAND_KNOPF}>
              <RefreshCw size={12} />
              {t("loadstate.error.retry")}
            </button>
          ) : null}
        </output>
      ) : null}
      {children(abfrage.data as T)}
    </div>
  );
}
