import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { LiveWall } from "../../api/types";
import { RoleLink } from "../RoleLink";
import {
  FUER_DICH_ZEILEN,
  type ForYouSeverity,
  type ForYouZeile,
  type Kartenlage,
  datenlageKey,
  entwarnungErlaubt,
  wiederholenSinnvoll,
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

/**
 * JOB 3118 · UX-17 — DER TITEL BRICHT UM, STATT ZU VERSCHWINDEN (Nutzerproblem N-0034).
 *
 * Bis hierher stand hier `truncate` (einzeilig, harter Schnitt mit Auslassung). Auf dem Telefon
 * (320/390 px) lagen die zwei Karten nebeneinander in je rund 150 px, und die Messung
 * (`belege/mobil-20260906-011638/25-start-390-geladen.json`) fand sichtbare Beschriftungen wie
 * „N…" und „Ko…": zwei verschiedene Berichte, ein einziges Bild. Der zugängliche Name war
 * vollständig, der sichtbare nicht — also konnte nur wählen, wer die Liste schon kannte.
 *
 * DER TITEL WIRD NICHT MEHR GEKÜRZT — und das ist eine begründete Abkehr vom Wortlaut des
 * Auftrags („mehrzeiliger Umbruch mit HARTER Zeilengrenze", §5 Lieferung 6). Runde 1 hatte die
 * harte Grenze als `line-clamp-2`. Ben hat sie widerlegt, mit einem Gegenbeispiel und einer
 * Messung: „Notfallplan Standort mit Anlagen Fluchtwegen Sammelplätzen und Meldeketten Ausgabe
 * Nord 2026" und „… Süd 2026" zeigen bei 320 px BEIDE „Notfallplan Standort mit Anlagen
 * Fluchtwegen Sammelplätzen und" — wieder zwei Berichte, ein Bild. Die zwei Zusagen desselben
 * Lieferpunkts stehen gegeneinander:
 *   · „zwei verschiedene Titel dürfen nicht dieselbe sichtbare Beschriftung ergeben" und
 *     „sichtbarer Text und zugänglicher Name bleiben deckungsgleich" — und
 *   · eine harte Zeilengrenze.
 * Eine Grenze in Zeilen kann die erste Zusage NICHT halten: wo der Unterschied zweier Titel liegt,
 * weiß das Layout nicht, und jede feste Grenze hat ein Titelpaar, das erst dahinter auseinandergeht.
 * Die erste Zusage ist die Aussage über die Sache (welchen Bericht öffne ich?), die zweite eine über
 * die Form. Ehrlichkeit vor Optik (REGELN §7): die Form gibt nach.
 *
 * WAS DAS KOSTET, offen gesagt: eine Zeile mit sehr langem Titel wird höher, und bei drei solchen
 * Einträgen wächst die Karte. Begrenzt bleibt sie durch die Zahl der Zeilen (`FUER_DICH_ZEILEN`,
 * `ZULETZT_ZEILEN`: je drei), nicht durch das Abschneiden ihrer Titel. Gemessen in Chromium bei
 * 320/390 px: `tests/start-karten-schmal/` (voller Titel sichtbar, kein waagerechter Überlauf).
 *
 * `break-words` bricht auch ein überlanges Einzelwort. Die zweite Hälfte der Behebung ist das
 * Raster (`pages/Start.tsx`), das unterhalb des Bruchpunkts stapelt: in 150 px halber Spaltenbreite
 * würde selbst ein unbegrenzter Umbruch eine Buchstabensäule ergeben.
 *
 * `min-w-0` BLEIBT: ohne es wächst ein Flex-Kind über seinen Inhalt hinaus und die Karte schiebt
 * waagerecht über den Fensterrand (Lehre JOB 3103 R3, dort gegen den horizontalen Überlauf).
 */
const ZEILEN_TITEL = "min-w-0 flex-1 break-words text-[14px] text-text";

/**
 * Der Satz über die Datenlage und der Wiederholen-Knopf — EIN Ort für beide Karten (JOB 3118 §7).
 *
 * Vorher entschied jede Karte zweimal selbst (`lage === "veraltet" ? …`), und beide antworteten
 * offline falsch. Was hier steht, entscheiden ausschließlich `datenlageKey()` und
 * `wiederholenSinnvoll()` in `forYou.ts`; diese Komponente zeichnet nur noch.
 */
function Datenlagezeile({
  karte,
  kartenlage,
  hatStand,
  onWiederholen,
}: {
  /** Testanker-Präfix der Karte („fuerdich" / „zuletzt") — die Namen sind seit JOB 3064 in Gebrauch. */
  karte: "fuerdich" | "zuletzt";
  /** Lage, Netz und laufender Abruf in EINEM Griff (`forYou.ts`, `Kartenlage`). */
  kartenlage: Kartenlage;
  /** Stehen Werte von vorhin auf DIESER Karte? Entscheidet zwischen „Stand von zuletzt" und ohne. */
  hatStand: boolean;
  onWiederholen: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  const satzKey = datenlageKey(kartenlage, hatStand);
  const knopf = wiederholenSinnvoll(kartenlage);
  if (satzKey === null && !knopf) {
    return null;
  }
  return (
    <div className={ZEILE}>
      {satzKey === null ? null : (
        /* <output> trägt implizit role="status" — dieselbe Störungsmarkierung wie überall sonst im
           Haus (components/LoadState.tsx), nur in der Zeilenform dieser Karte. Der Testanker heisst
           seit JOB 3064 „…-veraltet"; er trägt seit JOB 3118 jeden Datenlagesatz, auch den
           Offline-Satz. Der Name bleibt, damit die bestehenden Messungen weiter dieselbe Stelle
           treffen. */
        <output
          data-testid={`h5-${karte}-veraltet`}
          className="flex-1 text-[12.5px] text-trust-warn-text"
        >
          {t(satzKey)}
        </output>
      )}
      {knopf ? (
        <button
          type="button"
          data-testid={`h5-${karte}-wiederholen`}
          onClick={onWiederholen}
          className={
            satzKey === null
              ? "inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-text"
              : "inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-text"
          }
        >
          <RefreshCw size={satzKey === null ? 13 : 12} aria-hidden="true" />
          {t("loadstate.error.retry")}
        </button>
      ) : null}
    </div>
  );
}

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
 *
 * JOB 3118 · Q6e: WAS die Markierung sagt und OB der Knopf dasteht, entscheidet die Karte nicht
 * mehr selbst — das tun `entwarnungErlaubt()`, `datenlageKey()` und `wiederholenSinnvoll()` in
 * `forYou.ts`, für beide Karten dieselben.
 */
export function FuerDichKarte({
  kartenlage,
  zeilen,
  gesamt,
  onWiederholen,
}: {
  /**
   * Lage, Onlinezustand und laufender Abruf in EINEM Griff (`forYou.ts`, `Kartenlage`) — als
   * Pflichtparameter ohne Vorgabewert, nach dem Muster von `forYouLage` (`forYou.ts:97-99`): ein
   * Vorgabewert wäre die Erlaubnis, einen Eingang zu vergessen, und genau das war drei Aufträge
   * lang der Fehler auf `pages/Start.tsx`. Seit Runde 3 stehen die drei Angaben zusammen, weil ein
   * einzeln nachgereichter Eingang in Runde 2 an zwei von drei Entscheidungen vorbeilief.
   */
  kartenlage: Kartenlage;
  zeilen: readonly ForYouZeile[];
  gesamt: number;
  onWiederholen: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const bestand = zeigtBestand(kartenlage.lage);
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
        {/* Die VERNEINUNG hängt an `entwarnungErlaubt()`, nicht mehr an `bestand`: „Nichts offen."
            ist eine Aussage über JETZT und braucht einen frischen, ABGESCHLOSSENEN Abruf. Die WERTE
            oben hängen weiter an `bestand` — REGELN §7, sie werden nie geleert. */}
        {entwarnungErlaubt(kartenlage) && sichtbar.length === 0 ? (
          <div className={ZEILE}>
            <span data-h5-zeile="true" className="flex-1 text-[14px] text-text">
              {t("task.none")}
            </span>
          </div>
        ) : null}
        <Datenlagezeile
          karte="fuerdich"
          kartenlage={kartenlage}
          hatStand={sichtbar.length > 0}
          onWiederholen={onWiederholen}
        />
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
      <span data-h5-zeile="true" className={ZEILEN_TITEL}>
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
  kartenlage,
  daten,
  jetzt,
  onWiederholen,
}: {
  /** Wie bei `FuerDichKarte`: Pflichtbündel ohne Vorgabewert, über die Quelle DIESER Karte. */
  kartenlage: Kartenlage;
  daten: LiveWall | undefined;
  /** Ausdrücklich hereingereicht, damit „heute/gestern" ohne Uhrzeit-Zufall prüfbar ist. */
  jetzt: Date;
  onWiederholen: () => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const bestand = zeigtBestand(kartenlage.lage) && daten !== undefined;
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
                  <span data-h5-zeile="true" className={ZEILEN_TITEL}>
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
        {/* Bewusst NICHT „Nichts offen." wie in der linken Karte: hier ist nichts offen, sondern
            nichts erfasst. Derselbe Satz an zwei Stellen mit zwei Bedeutungen wäre eine falsche
            Auskunft in der einen von beiden. ZWEI SÄTZE, EINE REGEL (JOB 3118): „nichts erfasst"
            ist genauso eine Verneinung wie „Nichts offen." und hängt an derselben Bedingung. */}
        {entwarnungErlaubt(kartenlage) && daten !== undefined && eintraege.length === 0 ? (
          <div className={ZEILE}>
            <span data-h5-zeile="true" className="flex-1 text-[14px] text-text">
              {t("start.zuletzt.leer")}
            </span>
          </div>
        ) : null}
        {/* KORREKTURPFLICHT 4 (Ben, JOB 3064 Runde 3): bis dahin sah ein GESCHEITERTER Abruf hier
            genau aus wie „lädt" und wie „nichts erfasst" — drei verschiedene Lagen, ein einziges
            Bild. Das verletzt REGELN §7 („eine Störung darf nicht wie Leere aussehen") und §9. Die
            Karte trägt DIESELBE Störungsform wie „FÜR DICH" nebenan — seit JOB 3118 wörtlich
            dasselbe Bauteil, nicht nur denselben Wortlaut. */}
        <Datenlagezeile
          karte="zuletzt"
          kartenlage={kartenlage}
          hatStand={eintraege.length > 0}
          onWiederholen={onWiederholen}
        />
      </div>
    </div>
  );
}
