import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LiveWall } from "../../api/types";
import { RoleLink } from "../RoleLink";
import {
  FUER_DICH_ZEILEN,
  type ForYouLage,
  type ForYouSeverity,
  type ForYouZeile,
  zeigtBestand,
} from "./forYou";
import { ZULETZT_ZEILEN, wochentagKurz, zuletztTag } from "./zuletzt";

// ================================================================================================
// JOB 3064 H5 — DIE ZWEI KARTEN DES ZIELBILDS (`design/klarwerk/Main.dc.html`, Z.43–87).
// ================================================================================================
// Jeder tragende Wert steht hier als Token, nicht als Hexwert: das moderne Thema führt exakt die
// Werkbank-Palette des Zielbilds (`styles/themes.css`) — Linie #E9E5DE = `hairline`, Zeilenlinie
// #F2EFEA = `hairline-soft`, Meta #525B6B = `muted-2`, die drei Zustandspunkte #A12626/#8A5A00/
// #116B3C = `trust-crit-fill`/`trust-warn-fill`/`trust-pos-fill`, Pille #8A5A00 auf #FDF1D7 =
// `trust-warn-text` auf `trust-warn-bg`, der Schatten = `shadow-tile`.
// Gemessen an der in Chromium gemounteten echten Seite: `tests/design/zielbild-h5-start.test.ts`.

const PUNKT_TON: Record<ForYouSeverity, string> = {
  critical: "bg-trust-crit-fill",
  today: "bg-trust-warn-fill",
  later: "bg-trust-pos-fill",
};

const KARTE = "overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-tile";
const ZEILE = "flex items-center gap-3 border-b border-hairline-soft px-4 py-3";

/** Kicker links, optional eine Pille rechts (Zielbild Z.45). */
function KartenKopf({
  kicker,
  to,
  pille,
}: {
  kicker: string;
  /**
   * Ist der Kicker ein Weg (z. B. „FÜR DICH" → /aufgaben), wird er klickbar.
   * Die Eigenschaft heisst bewusst `to`: der Sammler
   * `tests/app/mega51-startziele-erreichbar-sammler.test.ts` erhebt die Ziele der Startseite über
   * genau dieses Attribut. Ein eigener Name („zu") liesse dieses Ziel lautlos aus der Erhebung
   * fallen — dieselbe Klasse von Blindheit, gegen die der Sammler gebaut ist.
   */
  to?: string;
  pille?: ReactNode;
}): JSX.Element {
  const beschriftung = (
    <span data-h5-kicker="true" className="text-[11px] tracking-[0.5px] text-muted-2">
      {kicker}
    </span>
  );
  return (
    <div className="flex items-center justify-between px-1">
      {to ? (
        <RoleLink to={to} className="inline-flex items-center" hoverClassName="hover:text-text">
          {() => beschriftung}
        </RoleLink>
      ) : (
        beschriftung
      )}
      {pille ?? null}
    </div>
  );
}

/**
 * „FÜR DICH" — bis zu drei Zeilen aus den drei bestehenden Quellen, gereiht nach Dringlichkeit.
 *
 * DIE LAGE ENTSCHEIDET, OB HIER ÜBERHAUPT ETWAS STEHT (§9): Zeilen und Pille erst nach einem
 * erfolgreichen frischen Abruf. `laedt` zeigt NICHTS — kein „lädt", keine leere Behauptung.
 * `gescheitert` zeigt ebenfalls keine Zahl, aber den Wiederholen-Knopf: eine Störung darf nicht
 * wie Leere aussehen (REGELN §7), und eine Knopfbeschriftung ist kein Erklärtext.
 * `veraltet` behält die zuletzt geholten Werte und markiert sie.
 */
export function FuerDichKarte({
  lage,
  zeilen,
  gesamt,
  onWiederholen,
}: {
  lage: ForYouLage;
  zeilen: readonly ForYouZeile[];
  gesamt: number;
  onWiederholen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const bestand = zeigtBestand(lage);
  const sichtbar = bestand ? zeilen.slice(0, FUER_DICH_ZEILEN) : [];
  return (
    <div className="flex flex-col gap-2.5">
      <KartenKopf
        kicker={t("start.fuerdich.kicker")}
        to="/aufgaben"
        pille={
          bestand && gesamt > 0 ? (
            <span
              data-testid="h5-fuerdich-pille"
              className="rounded-[999px] bg-trust-warn-bg px-2.5 py-[3px] text-[11px] font-bold tracking-[0.3px] text-trust-warn-text"
            >
              {gesamt}
            </span>
          ) : null
        }
      />
      <div className={KARTE} data-testid="h5-fuerdich">
        {sichtbar.map((z) => (
          <FuerDichZeile key={z.id} zeile={z} />
        ))}
        {bestand && sichtbar.length === 0 ? (
          <div className={ZEILE}>
            <span data-h5-zeile="true" className="flex-1 text-[14px] text-text">
              {t("task.none")}
            </span>
          </div>
        ) : null}
        {lage === "gescheitert" ? (
          <div className={ZEILE}>
            <button
              type="button"
              data-testid="h5-fuerdich-wiederholen"
              onClick={onWiederholen}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-text"
            >
              <RefreshCw size={13} aria-hidden="true" />
              {t("loadstate.error.retry")}
            </button>
          </div>
        ) : null}
        {lage === "veraltet" ? (
          <div className={ZEILE}>
            {/* <output> trägt implizit role="status" — dieselbe Störungsmarkierung wie überall
                sonst im Haus (components/LoadState.tsx), nur in der Zeilenform dieser Karte. */}
            <output
              data-testid="h5-fuerdich-veraltet"
              className="flex-1 text-[12.5px] text-trust-warn-text"
            >
              {t("loadstate.stale")}
            </output>
            <button
              type="button"
              data-testid="h5-fuerdich-wiederholen"
              onClick={onWiederholen}
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-text"
            >
              <RefreshCw size={12} aria-hidden="true" />
              {t("loadstate.error.retry")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FuerDichZeile({ zeile }: { zeile: ForYouZeile }): JSX.Element {
  const { t } = useTranslation();
  const text = zeile.textKey ? t(zeile.textKey, zeile.textWerte ?? {}) : (zeile.text ?? "");
  const meta = zeile.metaKey ? t(zeile.metaKey) : (zeile.meta ?? "");
  const inhalt = (erreichbar: boolean): ReactNode => (
    <>
      {/* `rounded-[50%]` und nicht `rounded-full`: das Zielbild schreibt `border-radius: 50%`
          (Z.48), und die Messung vergleicht den Wert, nicht seine Wirkung. Beide ergeben an einem
          8×8-Quadrat denselben Kreis — nur einer von beiden ist der Wert des Zielbilds. */}
      <span className={`h-2 w-2 shrink-0 rounded-[50%] ${PUNKT_TON[zeile.severity]}`} />
      <span data-h5-zeile="true" className="min-w-0 flex-1 truncate text-[14px] text-text">
        {text}
      </span>
      <span data-h5-zeile="true" className="shrink-0 text-[12.5px] text-muted-2">
        {meta}
      </span>
      {erreichbar ? (
        <ChevronRight
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className="shrink-0 text-muted-2"
        />
      ) : null}
    </>
  );
  if (zeile.to === null) {
    // Kein erfundenes Ziel: die Auskunft steht, der Weg fehlt (dieselbe Regel wie
    // `lib/notificationTarget.ts` — nur eindeutige Ziele werden zu Wegen).
    return (
      <div className={ZEILE} data-testid="h5-fuerdich-zeile">
        {inhalt(false)}
      </div>
    );
  }
  return (
    <RoleLink
      to={zeile.to}
      testId="h5-fuerdich-zeile"
      className={ZEILE}
      hoverClassName="hover:bg-hairline-soft"
    >
      {inhalt}
    </RoleLink>
  );
}

/**
 * „ZULETZT" — die drei zuletzt gesicherten Wissensobjekte aus derselben Quelle wie die bisherige
 * Live-Wall (`useLiveWall().saved`). Dieselbe Lage-Regel wie oben: ohne frischen Abruf steht hier
 * nichts, und ein unlesbares Datum bleibt leer statt erfunden.
 */
export function ZuletztKarte({
  lage,
  daten,
  jetzt,
  onWiederholen,
}: {
  lage: ForYouLage;
  daten: LiveWall | undefined;
  /** Ausdrücklich hereingereicht, damit „heute/gestern" ohne Uhrzeit-Zufall prüfbar ist. */
  jetzt: Date;
  onWiederholen: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const bestand = zeigtBestand(lage) && daten !== undefined;
  const eintraege = bestand ? (daten?.saved ?? []).slice(0, ZULETZT_ZEILEN) : [];
  return (
    <div className="flex flex-col gap-2.5">
      <KartenKopf kicker={t("start.zuletzt.kicker")} />
      <div className={KARTE} data-testid="h5-zuletzt">
        {eintraege.map((e) => {
          const art = zuletztTag(e.at, jetzt);
          const datum =
            art === "heute"
              ? t("start.zuletzt.heute")
              : art === "gestern"
                ? t("start.zuletzt.gestern")
                : art === "wochentag"
                  ? wochentagKurz(e.at, i18n.language)
                  : "";
          return (
            <RoleLink
              key={e.koId}
              to={`/wissen/${e.koId}`}
              testId="h5-zuletzt-zeile"
              className={ZEILE}
              hoverClassName="hover:bg-hairline-soft"
            >
              {() => (
                <>
                  <FileText
                    size={15}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="shrink-0 text-muted-2"
                  />
                  <span
                    data-h5-zeile="true"
                    className="min-w-0 flex-1 truncate text-[14px] text-text"
                  >
                    {e.title}
                  </span>
                  <span data-h5-zeile="true" className="shrink-0 text-[12.5px] text-muted-2">
                    {datum}
                  </span>
                </>
              )}
            </RoleLink>
          );
        })}
        {bestand && eintraege.length === 0 ? (
          // Bewusst NICHT „Nichts offen." wie in der linken Karte: hier ist nichts offen, sondern
          // nichts erfasst. Derselbe Satz an zwei Stellen mit zwei Bedeutungen wäre eine falsche
          // Auskunft in der einen von beiden.
          <div className={ZEILE}>
            <span data-h5-zeile="true" className="flex-1 text-[14px] text-text">
              {t("start.zuletzt.leer")}
            </span>
          </div>
        ) : null}
        {/* KORREKTURPFLICHT 4 (Ben, Runde 3): bis hierher sah ein GESCHEITERTER Abruf hier genau
            aus wie „lädt" und wie „nichts erfasst" — drei verschiedene Lagen, ein einziges Bild.
            Das verletzt REGELN §7 („eine Störung darf nicht wie Leere aussehen") und §9. Die Karte
            trägt jetzt DIESELBE Störungsform wie „FÜR DICH" nebenan: derselbe Wortlaut, dasselbe
            Bauteil, derselbe Wiederholen-Weg — kein zweites Verfahren für dieselbe Sache. */}
        {lage === "gescheitert" ? (
          <div className={ZEILE}>
            <button
              type="button"
              data-testid="h5-zuletzt-wiederholen"
              onClick={onWiederholen}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-text"
            >
              <RefreshCw size={13} aria-hidden="true" />
              {t("loadstate.error.retry")}
            </button>
          </div>
        ) : null}
        {lage === "veraltet" ? (
          <div className={ZEILE}>
            <output
              data-testid="h5-zuletzt-veraltet"
              className="flex-1 text-[12.5px] text-trust-warn-text"
            >
              {t("loadstate.stale")}
            </output>
            <button
              type="button"
              data-testid="h5-zuletzt-wiederholen"
              onClick={onWiederholen}
              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-text"
            >
              <RefreshCw size={12} aria-hidden="true" />
              {t("loadstate.error.retry")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
