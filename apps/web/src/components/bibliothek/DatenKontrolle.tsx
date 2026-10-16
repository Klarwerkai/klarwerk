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
import { useId } from "react";
import { useTranslation } from "react-i18next";

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
    readonly pruefung?: { readonly von: string; readonly am: string };
    readonly befunde: readonly KontrollbefundSicht[];
  }[];
  readonly prognose: boolean;
  readonly gepruefAm: string;
}

const ZUSTANDSFARBE: Record<KontrollZustand, string> = {
  erfasst: "text-muted",
  in_pruefung: "text-muted",
  klaerung: "text-danger",
  validiert: "text-text",
  ueberpruefung_noetig: "text-danger",
};

const STANDFARBE: Record<KontrollStand, string> = {
  bestanden: "text-text",
  klaerung: "text-danger",
  offen: "text-muted",
  ueberholt: "text-danger",
  nicht_zutreffend: "text-muted",
};

const ERGEBNISFARBE: Record<KontrollbefundSicht["ergebnis"], string> = {
  klaerung: "text-danger",
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

export function DatenKontrolle({ kontrolle }: { kontrolle: DatenkontrolleSicht }): JSX.Element {
  const { t, i18n } = useTranslation();
  const titelId = useId();
  const zeit = new Date(kontrolle.gepruefAm).toLocaleString(i18n.language);
  return (
    <section
      data-datenkontrolle={kontrolle.datenpunktId}
      aria-labelledby={titelId}
      className="mt-2"
    >
      <h6 id={titelId} className="text-[12px] font-semibold text-text">
        {t("datenkontrolle.titel")}
      </h6>
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
    </section>
  );
}

/** Die Datenlage einer Präsentation: Zustände und offene Klärungen (`datenlage` am Server). */
export interface DatenlageSicht {
  readonly anzahl: number;
  readonly jeZustand: Readonly<Record<KontrollZustand, number>>;
  readonly offenePunkte: readonly {
    readonly datenpunktId: string;
    readonly zustand: KontrollZustand;
    readonly titel: string;
    readonly naechsteArbeit?: string;
  }[];
}

const ZUSTAENDE: readonly KontrollZustand[] = [
  "validiert",
  "in_pruefung",
  "erfasst",
  "klaerung",
  "ueberpruefung_noetig",
];

export function DatenLage({
  lage,
  oeffne,
}: {
  lage: DatenlageSicht;
  /** Öffnet die Herkunft des Datenpunkts im Detailbereich (PP-02). */
  oeffne?: (datenpunktId: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const titelId = useId();
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
        <ul className="space-y-0.5">
          {lage.offenePunkte.map((p) => (
            <li
              key={`${p.datenpunktId}:${p.titel}`}
              data-offener-punkt={p.datenpunktId}
              className="text-[12px] text-text"
            >
              {oeffne ? (
                <button
                  type="button"
                  className="text-left underline decoration-dotted"
                  onClick={() => oeffne(p.datenpunktId)}
                >
                  {p.titel}
                </button>
              ) : (
                p.titel
              )}
              {p.naechsteArbeit ? (
                <span className="text-muted">{` — ${p.naechsteArbeit}`}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
