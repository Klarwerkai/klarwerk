// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, Ben nacharbeit-3) — DAS PRÜFERGEBNIS AN DER ANTWORT.
// ================================================================================================
//
// Eine zweite KI prüft, ob die genannten Fundstellen die Aussagen der Antwort tragen. Dieser Baustein
// zeigt GENAU das, was der Server dazu liefert (`referenzpruefung`, Spiegel von `ReferenzPruefSicht`):
//   · den Gesamtstand — geprüft oder sichtbar „nicht prüfbar" mit Grund (Ausfall, Zeitlimit,
//     verweigerte externe Verarbeitung, keine erlaubte Referenz-KI …), nie still;
//   · je Aussage GENAU EINEN Zustand mit Fundstelle (Rückweg zur Quelle in ihrer Fassung) und
//     Begründung, je Teilaussage aufgeschlüsselt;
//   · GETRENNT davon die Aktualitäts- und Konflikthinweise — sie sagen nichts über die Unterstützung;
//   · den Satz, dass keine allgemeine Wahrheit oder Aktualität behauptet wird;
//   · den Versuch (Nummer/Höchstzahl) und, solange erlaubt, die erneute Prüfung.
//
// Anbieter- und Modellnamen erscheinen nicht — der Server liefert nur die Stufe (WP-VIP2-GATE-2).
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type {
  ReferenzAussageErgebnis,
  ReferenzFundstelle,
  ReferenzHinweis,
  ReferenzPruefung,
  ReferenzZustand,
} from "../../api/types";

/** Gründe, an denen eine erneute Prüfung nichts ändert — dort wird sie nicht angeboten. */
const DAUERHAFTE_GRUENDE = new Set([
  "pruefer_nicht_eingerichtet",
  "keine_aussage",
  "modellaufruf_ausgeschlossen",
  "keine_fundstelle",
]);

const ZUSTAND_FARBE: Record<ReferenzZustand, string> = {
  belegt: "bg-trust-ok-bg text-trust-ok-text",
  teilweise_belegt: "bg-trust-warn-bg text-trust-warn-text",
  widersprochen: "bg-trust-crit-bg text-trust-crit-text",
  nicht_pruefbar: "bg-surface-2 text-muted",
};

/** Ist eine erneute Prüfung erlaubt UND sinnvoll? */
export function erneutAngeboten(e: ReferenzPruefung): boolean {
  return (
    e.versuch.nummer < e.versuch.hoechstens &&
    e.status === "nicht_pruefbar" &&
    !DAUERHAFTE_GRUENDE.has(e.grund ?? "")
  );
}

function Grund({ grund }: { grund: string | undefined }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  if (!grund) {
    return null;
  }
  const schluessel = `referenzpruefung.grund.${grund}`;
  return <>{i18n.exists(schluessel) ? t(schluessel) : t("referenzpruefung.grund.unbekannt")}</>;
}

function FundstellenLink({
  f,
  titelVon,
  wissenHref,
}: {
  f: ReferenzFundstelle;
  titelVon: (id: string) => string | undefined;
  wissenHref: (koId: string, fassung: number) => string;
}): JSX.Element {
  const { t } = useTranslation();
  const titel = titelVon(f.koId) ?? t("referenzpruefung.quelleOhneTitel");
  return (
    <Link
      to={wissenHref(f.koId, f.koVersion)}
      data-testid="referenzpruefung-fundstelle"
      className="break-words text-accent underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {t("referenzpruefung.fundstelle", { titel, fassung: f.koVersion })}
    </Link>
  );
}

function Aussage({
  a,
  text,
  titelVon,
  wissenHref,
}: {
  a: ReferenzAussageErgebnis;
  text: string | undefined;
  titelVon: (id: string) => string | undefined;
  wissenHref: (koId: string, fassung: number) => string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      data-testid="referenzpruefung-aussage"
      data-zustand={a.zustand}
      className="min-w-0 rounded-[10px] border border-hairline p-3"
    >
      <div className="flex flex-wrap items-start gap-2">
        <span
          data-testid="referenzpruefung-zustand"
          className={`shrink-0 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${ZUSTAND_FARBE[a.zustand]}`}
        >
          {t(`referenzpruefung.zustand.${a.zustand}`)}
        </span>
        {text ? <p className="min-w-0 flex-1 break-words text-[13px] text-text">{text}</p> : null}
      </div>
      <p data-testid="referenzpruefung-begruendung" className="mt-1.5 text-[12.5px] text-muted">
        {a.begruendung}
      </p>
      {a.zustand === "nicht_pruefbar" && a.grund ? (
        <p className="mt-1 text-[12px] text-muted-2">
          <Grund grund={a.grund} />
        </p>
      ) : null}
      {a.fundstellen.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-[12px]">
          {a.fundstellen.map((f) => (
            <li key={f.fundstelleId}>
              <FundstellenLink f={f} titelVon={titelVon} wissenHref={wissenHref} />
            </li>
          ))}
        </ul>
      ) : null}
      {a.teile.length > 1 ? (
        <details className="mt-1.5 text-[12px] text-muted-2">
          <summary className="cursor-pointer focus-visible:outline focus-visible:outline-2">
            {t("referenzpruefung.teile", { anzahl: a.teile.length })}
          </summary>
          <ul className="mt-1 space-y-1">
            {a.teile.map((teil) => (
              <li key={teil.teilId} data-testid="referenzpruefung-teil" className="break-words">
                <span className="font-semibold">
                  {t(`referenzpruefung.zustand.${teil.zustand}`)}
                </span>
                {" — "}
                {teil.begruendung}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function Hinweis({ h }: { h: ReferenzHinweis }): JSX.Element {
  const { t } = useTranslation();
  return (
    <li data-testid="referenzpruefung-hinweis" data-art={h.art} className="break-words">
      {t(`referenzpruefung.hinweis.${h.art}`, {
        gebunden: h.fassung?.gebunden ?? "",
        aktuell: h.fassung?.aktuell ?? "",
        wert: h.wert ?? "",
      })}
    </li>
  );
}

export function Referenzpruefung({
  ergebnis,
  aussageTexte,
  titelVon,
  wissenHref,
  onErneut,
  erneutLaeuft = false,
  testId = "referenzpruefung",
  ueberschrift,
}: {
  ergebnis: ReferenzPruefung;
  /** Der Text je Aussage (REF-01-Bindung der Antwort) — ohne ihn steht nur der Zustand. */
  aussageTexte?: ReadonlyMap<string, string> | undefined;
  titelVon: (id: string) => string | undefined;
  /** Rückweg zur Quelle in genau der geprüften Fassung. */
  wissenHref: (koId: string, fassung: number) => string;
  /** Die ausdrücklich angestoßene erneute Prüfung; fehlt sie, gibt es keinen Knopf. */
  onErneut?: (() => void) | undefined;
  erneutLaeuft?: boolean;
  testId?: string;
  ueberschrift?: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const titelId = `${testId}-titel`;
  const aktualitaet = ergebnis.hinweise.filter((h) =>
    ["neuere_fassung", "abruf_nicht_belegt", "bekannter_konflikt", "gegenpassage"].includes(h.art),
  );
  const technisch = ergebnis.hinweise.filter((h) => !aktualitaet.includes(h));
  return (
    <section
      data-testid={testId}
      data-status={ergebnis.status}
      aria-labelledby={titelId}
      className="min-w-0 space-y-2.5 rounded-card border border-hairline bg-surface p-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={titelId} className="text-[13.5px] font-semibold text-text">
          {ueberschrift ?? t("referenzpruefung.titel")}
        </h3>
        <span data-testid={`${testId}-versuch`} className="text-[11.5px] text-muted-2">
          {t("referenzpruefung.versuch", {
            nummer: ergebnis.versuch.nummer,
            hoechstens: ergebnis.versuch.hoechstens,
          })}
        </span>
      </div>
      <p
        data-testid={`${testId}-status`}
        role={ergebnis.status === "nicht_pruefbar" ? "status" : undefined}
        className={
          ergebnis.status === "nicht_pruefbar"
            ? "rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12.5px] text-trust-warn-text"
            : "text-[12.5px] text-muted"
        }
      >
        {ergebnis.status === "geprueft"
          ? t("referenzpruefung.status.geprueft", {
              pruefer: t(`referenzpruefung.stufe.${ergebnis.rollen.pruefer ?? "unbekannt"}`),
            })
          : t("referenzpruefung.status.nicht_pruefbar")}{" "}
        {ergebnis.status === "nicht_pruefbar" ? <Grund grund={ergebnis.grund} /> : null}
      </p>
      {ergebnis.aussagen.length > 0 ? (
        <ul className="space-y-2">
          {ergebnis.aussagen.map((a) => (
            <Aussage
              key={a.aussageId}
              a={a}
              text={aussageTexte?.get(a.aussageId)}
              titelVon={titelVon}
              wissenHref={wissenHref}
            />
          ))}
        </ul>
      ) : null}
      {aktualitaet.length > 0 ? (
        <div data-testid={`${testId}-aktualitaet`}>
          <p className="text-[12px] font-semibold text-text">
            {t("referenzpruefung.aktualitaet.titel")}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-muted">
            {aktualitaet.map((h, i) => (
              <Hinweis key={`${h.art}-${h.fundstelleId ?? h.konfliktId ?? i}`} h={h} />
            ))}
          </ul>
        </div>
      ) : null}
      {technisch.length > 0 ? (
        <div data-testid={`${testId}-technisch`}>
          <p className="text-[12px] font-semibold text-text">
            {t("referenzpruefung.technisch.titel")}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] text-muted">
            {technisch.map((h, i) => (
              <Hinweis key={`${h.art}-${h.fundstelleId ?? h.aussageId ?? i}`} h={h} />
            ))}
          </ul>
        </div>
      ) : null}
      <p data-testid={`${testId}-grenze`} className="text-[11.5px] text-muted-2">
        {t("referenzpruefung.grenze")}
      </p>
      {onErneut && erneutAngeboten(ergebnis) ? (
        <button
          type="button"
          data-testid={`${testId}-erneut`}
          onClick={onErneut}
          disabled={erneutLaeuft}
          className="min-h-[36px] rounded-btn border border-hairline px-3 text-[12.5px] font-semibold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {erneutLaeuft ? t("referenzpruefung.erneut.laeuft") : t("referenzpruefung.erneut.knopf")}
        </button>
      ) : null}
    </section>
  );
}
