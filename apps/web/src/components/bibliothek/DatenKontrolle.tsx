// ================================================================================================
// KLARA POWERPOINT · PP-03 — PRÜFSTAND UND KONTROLLEN EINER ZAHL IM DETAILBEREICH.
// ================================================================================================
//
// Auftrag `produkt:20261015:klara-powerpoint-validierung`. Zeigt für die gewählte Zahl bzw. Aussage
// (UI-03): den Zustand der konkreten Datenfassung mit Grund, was ihn ändert, je Prüfdimension Stand
// und Herkunft (geprüft von einer Person bzw. einem Weg oder von Klarwerk kontrolliert) und die
// konkreten Kontrollen — bei einer möglichen Abweichung beide Angaben mit ihren Fundstellen.
//
// Die Fläche ist reine Anzeige im vorhandenen Detailbereich der PP-02-Herkunft (`FolienDaten`,
// `Herkunft`); sie bringt keine eigene Navigation, keinen eigenen Abruf und keinen Schreibweg mit.
// Prüfen und Korrigieren bleiben die PP-02-Wege. Die Datenform ist `Datenkontrolle` aus
// `services/app/src/praesentation-pruefung.ts`.
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OffenePunkteWahl } from "../../lib/datenkontrolleEinstellung";

export type KontrollZustand =
  | "erfasst"
  | "in_pruefung"
  | "klaerung"
  | "validiert"
  | "ueberpruefung_noetig";

export type KontrollDimensionName =
  | "erkennung"
  | "struktur"
  | "berechnung"
  | "konsistenz"
  | "aktualitaet"
  | "fachliche_freigabe";

export type KontrollStand = "bestanden" | "klaerung" | "offen" | "ueberholt" | "nicht_zutreffend";

export interface KontrollbefundSicht {
  readonly id: string;
  readonly dimension: KontrollDimensionName;
  readonly ergebnis: "klaerung" | "bestanden" | "offen" | "hinweis";
  readonly titel: string;
  readonly grund: string;
  readonly naechsteArbeit?: string;
  readonly regel: string;
  readonly hier?: string;
  readonly gegenstellen?: readonly {
    readonly datenpunktId: string;
    readonly wert: string;
    readonly fundstelle: string;
  }[];
}

export interface DatenkontrolleSicht {
  readonly datenpunktId: string;
  readonly datenFassung: number;
  readonly zustand: KontrollZustand;
  readonly grund: string;
  readonly naechsteArbeit: readonly string[];
  readonly dimensionen: readonly {
    readonly dimension: KontrollDimensionName;
    readonly stand: KontrollStand;
    readonly grund: string;
    readonly herkunft: "pruefung" | "kontrolle" | "keine";
    /** Die Prüfung, auf der der Stand beruht: Person bzw. Weg (`klarwerk:<weg>`) und Zeitpunkt. */
    readonly pruefung?: {
      readonly von: string;
      readonly am: string;
      readonly name?: string;
      readonly datenFassung?: number;
    };
    readonly befunde: readonly KontrollbefundSicht[];
  }[];
  readonly prognose: boolean;
  readonly gepruefAm: string;
}

const ZUSTANDSFARBE: Record<KontrollZustand, string> = {
  erfasst: "text-muted",
  in_pruefung: "text-muted",
  klaerung: "text-trust-crit-text",
  validiert: "text-text",
  ueberpruefung_noetig: "text-trust-crit-text",
};

const STANDFARBE: Record<KontrollStand, string> = {
  bestanden: "text-text",
  klaerung: "text-trust-crit-text",
  offen: "text-muted",
  ueberholt: "text-trust-crit-text",
  nicht_zutreffend: "text-muted",
};

const ERGEBNISFARBE: Record<KontrollbefundSicht["ergebnis"], string> = {
  klaerung: "text-trust-crit-text",
  bestanden: "text-text",
  offen: "text-muted",
  hinweis: "text-muted",
};

function Befund({ b }: { b: KontrollbefundSicht }): JSX.Element {
  const { t } = useTranslation();
  return (
    <li data-befund={b.id} data-ergebnis={b.ergebnis} className="mt-1">
      <p className={`text-[12px] ${ERGEBNISFARBE[b.ergebnis]}`}>
        <span className="font-semibold">{t(`datenkontrolle.ergebnis.${b.ergebnis}`)}</span>
        {": "}
        {b.titel}
      </p>
      <p className="text-[12px] text-text">{b.grund}</p>
      {b.gegenstellen && b.gegenstellen.length > 0 ? (
        <dl data-gegenueberstellung="" className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2">
          {b.hier ? (
            <>
              <dt className="text-[12px] text-muted">{t("datenkontrolle.hier")}</dt>
              <dd className="text-[12px] text-text">{b.hier}</dd>
            </>
          ) : null}
          {b.gegenstellen.map((g) => (
            <div key={g.datenpunktId} className="contents" data-gegenstelle={g.datenpunktId}>
              <dt className="text-[12px] text-muted">{t("datenkontrolle.dort")}</dt>
              <dd className="text-[12px] text-text">{`„${g.wert}“ — ${g.fundstelle}`}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-[11.5px] text-muted">
        {t("datenkontrolle.regel")}
        {": "}
        {b.regel}
      </p>
    </li>
  );
}

type Pruefung = NonNullable<DatenkontrolleSicht["dimensionen"][number]["pruefung"]>;

/**
 * Wer bzw. welcher Weg geprüft hat und wann — die tatsächliche Prüfung, getrennt vom Zeitpunkt, zu
 * dem Klarwerk die Kontrollen berechnet hat (`gepruefAm`).
 */
function Pruefvermerk({ pruefung }: { pruefung: Pruefung }): JSX.Element {
  const { t, i18n } = useTranslation();
  const zeit = new Date(pruefung.am).toLocaleString(i18n.language);
  const weg = pruefung.von.startsWith("klarwerk:") ? pruefung.von.slice(9) : undefined;
  const text =
    weg !== undefined
      ? t("datenkontrolle.pruefung.weg", { weg, zeit })
      : t("datenkontrolle.pruefung.person", { wer: pruefung.name ?? pruefung.von, zeit });
  return (
    <p data-pruefvermerk={pruefung.von} className="text-[11.5px] text-muted">
      <time dateTime={pruefung.am}>{text}</time>
      {pruefung.datenFassung === undefined
        ? null
        : ` (${t("datenkontrolle.fassung", { fassung: pruefung.datenFassung })})`}
    </p>
  );
}

/**
 * `eingebettet` (UI-06, Risiko R14 der UI-Vorbereitung): im Detailbereich der Herkunft steht der
 * Baustein unter dem Abschnitt „Prüfstand“ — dann ohne eigene Überschrift und ohne eigene benannte
 * Region, sondern als benannte Gruppe. Allein gezeigt bleibt er eine Region mit Überschrift.
 */
export function DatenKontrolle({
  kontrolle,
  eingebettet = false,
}: {
  kontrolle: DatenkontrolleSicht;
  eingebettet?: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const titelId = useId();
  const zeit = new Date(kontrolle.gepruefAm).toLocaleString(i18n.language);
  const Huelle = eingebettet ? "div" : "section";
  return (
    <Huelle
      data-datenkontrolle={kontrolle.datenpunktId}
      {...(eingebettet
        ? { role: "group", "aria-label": t("datenkontrolle.titel") }
        : { "aria-labelledby": titelId })}
      className="mt-2"
    >
      {eingebettet ? null : (
        <h6 id={titelId} className="text-[12px] font-semibold text-text">
          {t("datenkontrolle.titel")}
        </h6>
      )}
      <p
        data-zustand={kontrolle.zustand}
        className={`text-[12.5px] font-semibold ${ZUSTANDSFARBE[kontrolle.zustand]}`}
      >
        {t(`datenkontrolle.zustand.${kontrolle.zustand}`)}
        {" · "}
        {t("datenkontrolle.fassung", { fassung: kontrolle.datenFassung })}
      </p>
      <p className="text-[12px] text-text">{kontrolle.grund}</p>
      {kontrolle.prognose ? (
        <p className="text-[12px] text-muted">{t("datenkontrolle.prognose")}</p>
      ) : null}
      {kontrolle.naechsteArbeit.length > 0 ? (
        <div data-naechste-arbeit="" className="mt-1">
          <p className="text-[12px] font-semibold text-text">
            {t("datenkontrolle.naechsteArbeit")}
          </p>
          <ul className="list-disc pl-4">
            {kontrolle.naechsteArbeit.map((a) => (
              <li key={a} className="text-[12px] text-text">
                {a}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ul aria-label={t("datenkontrolle.dimensionen")} className="mt-1 space-y-1">
        {kontrolle.dimensionen.map((d) => (
          <li key={d.dimension} data-dimension={d.dimension} data-stand={d.stand}>
            <p className="text-[12px]">
              <span className="font-semibold text-text">
                {t(`datenkontrolle.dimension.${d.dimension}`)}
              </span>
              {": "}
              <span className={STANDFARBE[d.stand]}>{t(`datenkontrolle.stand.${d.stand}`)}</span>
              {d.herkunft === "keine" ? null : (
                <span className="text-muted">
                  {" · "}
                  {t(`datenkontrolle.herkunft.${d.herkunft}`)}
                </span>
              )}
            </p>
            {d.stand === "nicht_zutreffend" ? null : (
              <p className="text-[12px] text-muted">{d.grund}</p>
            )}
            {d.pruefung ? <Pruefvermerk pruefung={d.pruefung} /> : null}
            {d.befunde.length > 0 ? (
              <ul className="pl-3">
                {d.befunde.map((b) => (
                  <Befund key={b.id} b={b} />
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11.5px] text-muted">{t("datenkontrolle.geprueftAm", { zeit })}</p>
    </Huelle>
  );
}

/** Die Datenlage einer Präsentation: Zustände und offene Klärungen (`datenlage` am Server). */
export interface DatenlageSicht {
  readonly anzahl: number;
  readonly jeZustand: Readonly<Record<KontrollZustand, number>>;
  /** Je Datenpunkt jede nicht bestandene erforderliche Dimension mit Grund und Arbeit. */
  readonly offenePunkte: readonly {
    readonly datenpunktId: string;
    readonly zustand: KontrollZustand;
    readonly dimension: KontrollDimensionName;
    readonly stand: "klaerung" | "offen" | "ueberholt";
    readonly titel: string;
    readonly grund: string;
    readonly naechsteArbeit: string;
    /** Eine früher bestandene, von einer Kontrolle wieder geöffnete Prüfung (Regel 5). */
    readonly wiedergeoeffnet?: true;
  }[];
}

const ZUSTAENDE: readonly KontrollZustand[] = [
  "validiert",
  "in_pruefung",
  "erfasst",
  "klaerung",
  "ueberpruefung_noetig",
];

/**
 * `wahl` — Setup › Klara „Offene Datenpunkte in der Datenlage“ (Paket Abschnitt 7): `alle`
 * (Voreinstellung) listet jede nicht bestandene erforderliche Prüfung; `nur_klaerung` listet
 * Klärungen, überholte und wieder geöffnete Prüfungen einzeln und fasst die übrigen offenen
 * Prüfungen (noch nie geprüft) zu einer einblendbaren Anzahl zusammen. Eine Anzeigeregel umgeht
 * keine Prüfung: Zustände, Zählung und Zustand an der Zahl bleiben gleich; Klärungen, überholte und
 * wieder geöffnete Prüfungen stehen immer einzeln da.
 */
export function DatenLage({
  lage,
  oeffne,
  wahl = "alle",
}: {
  lage: DatenlageSicht;
  /** Öffnet die Herkunft des Datenpunkts im Detailbereich (PP-02). */
  oeffne?: (datenpunktId: string, ausloeser: HTMLButtonElement) => void;
  wahl?: OffenePunkteWahl;
}): JSX.Element {
  const { t } = useTranslation();
  const titelId = useId();
  const listeId = useId();
  const [alleZeigen, setAlleZeigen] = useState(false);
  const einzeln = (p: DatenlageSicht["offenePunkte"][number]) =>
    p.stand !== "offen" || p.wiedergeoeffnet === true;
  // Nur unter „nur Klärungen einzeln“ und nur, wenn es etwas zusammenzufassen gibt, steht der
  // Umschalter da — mit `aria-expanded` und in beide Richtungen (UI-06, Risiko R12).
  const umschaltbar = wahl === "nur_klaerung" && lage.offenePunkte.some((p) => !einzeln(p));
  const verdichtet = umschaltbar && !alleZeigen;
  const sichtbar = verdichtet ? lage.offenePunkte.filter(einzeln) : lage.offenePunkte;
  const zusammengefasst = lage.offenePunkte.length - sichtbar.length;
  return (
    <section data-datenlage="" aria-labelledby={titelId} className="mt-2">
      <h6 id={titelId} className="text-[12px] font-semibold text-text">
        {t("datenkontrolle.lage.titel")}
        {" · "}
        {t("datenkontrolle.lage.anzahl", { anzahl: lage.anzahl })}
      </h6>
      <ul className="flex flex-wrap gap-x-3 text-[12px]">
        {ZUSTAENDE.filter((z) => lage.jeZustand[z] > 0).map((z) => (
          <li key={z} data-lage-zustand={z} className={ZUSTANDSFARBE[z]}>
            {`${t(`datenkontrolle.zustand.${z}`)}: ${lage.jeZustand[z]}`}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] font-semibold text-text">{t("datenkontrolle.lage.offen")}</p>
      {lage.offenePunkte.length === 0 ? (
        <p className="text-[12px] text-muted">{t("datenkontrolle.lage.keineOffenen")}</p>
      ) : (
        <ul id={listeId} className="space-y-0.5">
          {sichtbar.map((p) => (
            <li
              key={`${p.datenpunktId}:${p.naechsteArbeit}`}
              data-offener-punkt={p.datenpunktId}
              data-dimension={p.dimension}
              data-stand={p.stand}
              className="text-[12px] text-text"
            >
              <p data-aufgabe="">
                {oeffne ? (
                  <button
                    type="button"
                    className="text-left underline decoration-dotted"
                    onClick={(e) => oeffne(p.datenpunktId, e.currentTarget)}
                  >
                    {p.titel}
                  </button>
                ) : (
                  p.titel
                )}
                <span className="text-muted">{` — ${p.naechsteArbeit}`}</span>
              </p>
              <p className="text-muted">
                {`${t(`datenkontrolle.dimension.${p.dimension}`)}: ${t(`datenkontrolle.stand.${p.stand}`)} · ${p.grund}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      {umschaltbar && verdichtet ? (
        <p data-offene-zusammengefasst={zusammengefasst} className="mt-0.5 text-[12px] text-muted">
          {t("datenkontrolle.lage.zusammengefasst", { anzahl: zusammengefasst })}{" "}
          <button
            type="button"
            data-offene-einblenden=""
            aria-expanded={false}
            aria-controls={listeId}
            className="underline decoration-dotted"
            onClick={() => setAlleZeigen(true)}
          >
            {t("datenkontrolle.lage.alleZeigen")}
          </button>
        </p>
      ) : null}
      {umschaltbar && !verdichtet ? (
        <p data-offene-eingeblendet="" className="mt-0.5 text-[12px] text-muted">
          <button
            type="button"
            data-offene-zusammenfassen=""
            aria-expanded={true}
            aria-controls={listeId}
            className="underline decoration-dotted"
            onClick={() => setAlleZeigen(false)}
          >
            {t("datenkontrolle.lage.zusammenfassen")}
          </button>
        </p>
      ) : null}
    </section>
  );
}
