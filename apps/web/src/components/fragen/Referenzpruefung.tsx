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
//
// produkt:20261009:referenzki-antwortstatus (REF-04) ergänzt:
//   · die zusammenfassende Kennzeichnung (`referenzGesamt`): „Quellen geprüft" NUR, wenn jede Aussage
//     mit Fundstelle belegt und unabhängig geprüft ist; sonst ein Entwurfsstand mit Grund — auch
//     „Prüfung läuft" und „Prüfung nicht abgeschlossen" (K2–K4);
//   · je Zustand ein Zeichen neben dem Wort — der Zustand hängt nie allein an der Farbe (K2);
//   · je Aussage der direkte Wechsel zu Fundstelle, Passage und kurzer Begründung und der Rückweg
//     zur Aussage, mit Fokusführung (K5);
//   · zu jedem „nicht prüfbar" eine konkrete Ursache UND ein sinnvoller nächster Schritt (K8).
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type {
  ReferenzAussageErgebnis,
  ReferenzFundstelle,
  ReferenzHinweis,
  ReferenzPruefung,
  ReferenzZustand,
} from "../../api/types";

/**
 * REF-04: der Gesamtstand einer Antwort in Bezug auf ihre Quellen. Nur `quellen_geprueft` ist eine
 * Bestätigung; jeder andere Stand ist ein Entwurf ohne Quellenfreigabe (`keine_aussage` ausgenommen:
 * dort gibt es nichts zu belegen, und es wird auch nichts erfunden).
 */
export type ReferenzGesamt =
  | "quellen_geprueft"
  | "gemischt"
  | "nicht_pruefbar"
  | "nicht_abgeschlossen"
  | "laeuft"
  | "offen"
  | "fremde_fassung"
  | "keine_aussage";

/** Gründe, aus denen ein Prüflauf nicht zu Ende kam (Ausfall, Abbruch, Grenze, verworfene Ausgabe). */
const NICHT_ABGESCHLOSSEN = new Set([
  "abgebrochen",
  "zeitlimit",
  "pruefer_fehler",
  "ungueltige_pruefausgabe",
  "budget_erschoepft",
  "ki_abgeschaltet",
  "bestaetigung_abgelaufen",
]);

/**
 * REF-04 (K2/K3/K4/K7): die zusammenfassende Kennzeichnung. Eine Bestätigung gibt es nur, wenn
 *   · ein unabhängiger Prüfer tatsächlich geurteilt hat (`status: "geprueft"`),
 *   · JEDE Aussage `belegt` ist und eine Fundstelle trägt,
 *   · kein Lauf gerade läuft oder gescheitert ist, und
 *   · das Ergebnis an GENAU diese Antwortfassung gebunden ist (sofern beide Fingerabdrücke bekannt
 *     sind) — ein anderer Antworttext erbt keine Bestätigung.
 */
export function referenzGesamt(
  ergebnis: ReferenzPruefung | null | undefined,
  lage: { laeuft?: boolean; fehler?: boolean; antwortFingerabdruck?: string | null } = {},
): ReferenzGesamt {
  if (lage.laeuft === true) {
    return "laeuft";
  }
  if (lage.fehler === true) {
    return "nicht_abgeschlossen";
  }
  if (!ergebnis) {
    return "offen";
  }
  const gebunden = ergebnis.bindung?.antwortFingerabdruck;
  if (lage.antwortFingerabdruck && gebunden && gebunden !== lage.antwortFingerabdruck) {
    return "fremde_fassung";
  }
  if (ergebnis.status !== "geprueft") {
    if (ergebnis.grund === "keine_aussage") {
      return "keine_aussage";
    }
    return NICHT_ABGESCHLOSSEN.has(ergebnis.grund ?? "") ? "nicht_abgeschlossen" : "nicht_pruefbar";
  }
  const alleBelegt =
    ergebnis.aussagen.length > 0 &&
    ergebnis.aussagen.every((a) => a.zustand === "belegt" && a.fundstellen.length > 0);
  return alleBelegt ? "quellen_geprueft" : "gemischt";
}

/** Das Zeichen je Zustand — zusätzlich zum Wort, damit der Zustand nicht nur an der Farbe hängt. */
const ZUSTAND_ZEICHEN: Record<ReferenzZustand, string> = {
  belegt: "✓",
  teilweise_belegt: "◐",
  widersprochen: "✕",
  nicht_pruefbar: "?",
};

const GESAMT_ZEICHEN: Record<ReferenzGesamt, string> = {
  quellen_geprueft: "✓",
  gemischt: "◐",
  nicht_pruefbar: "?",
  nicht_abgeschlossen: "!",
  laeuft: "…",
  offen: "…",
  fremde_fassung: "!",
  keine_aussage: "–",
};

const GESAMT_FARBE: Record<ReferenzGesamt, string> = {
  quellen_geprueft: "bg-trust-ok-bg text-trust-ok-text",
  gemischt: "bg-trust-warn-bg text-trust-warn-text",
  nicht_pruefbar: "bg-trust-warn-bg text-trust-warn-text",
  nicht_abgeschlossen: "bg-trust-warn-bg text-trust-warn-text",
  laeuft: "bg-surface-2 text-muted",
  offen: "bg-surface-2 text-muted",
  fremde_fassung: "bg-trust-warn-bg text-trust-warn-text",
  keine_aussage: "bg-surface-2 text-muted",
};

/**
 * REF-04 (K3/K4): die Quellenkennzeichnung DIREKT an der Antwort. „Quellen geprüft" steht nur bei
 * vollständiger, unabhängiger Bestätigung; sonst heißt die Antwort sichtbar „Entwurf" mit dem Stand
 * der Prüfung — ein sichtbarer Entwurf ist keine Quellenfreigabe.
 */
export function QuellenStatusMarke({
  gesamt,
  testId = "quellenstatus-marke",
}: {
  gesamt: ReferenzGesamt;
  testId?: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      data-testid={testId}
      data-gesamt={gesamt}
      {...(gesamt === "laeuft" ? { "aria-busy": true } : {})}
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${GESAMT_FARBE[gesamt]}`}
    >
      <span aria-hidden="true">{GESAMT_ZEICHEN[gesamt]}</span>
      {t(`referenzpruefung.gesamt.${gesamt}`)}
    </span>
  );
}

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

/**
 * REF-04 (K8): der sinnvolle nächste Schritt zu einem benannten Grund. Wo eine erneute Prüfung
 * angeboten wird, nennt der Satz sie; sonst den Weg, der die Ursache tatsächlich behebt.
 */
function NaechsterSchritt({
  grund,
  erneutMoeglich,
}: {
  grund: string;
  erneutMoeglich: boolean;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const schluessel = `referenzpruefung.naechster.${grund}`;
  const satz = i18n.exists(schluessel) ? t(schluessel) : t("referenzpruefung.naechster.unbekannt");
  return (
    <>
      {satz}
      {erneutMoeglich ? ` ${t("referenzpruefung.naechster.erneut")}` : null}
    </>
  );
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

/**
 * REF-04 (K5): der direkte Wechsel von einer Aussage zu ihrer Fundstelle — Passage (soweit diese
 * Antwort sie mitgeliefert hat), Fundstelle in ihrer Fassung und kurze Prüfbegründung — und der
 * Rückweg zur Aussage. Öffnen setzt den Fokus in den Bereich, „Zurück" und Escape setzen ihn auf
 * den auslösenden Knopf zurück.
 */
function FundstellenDetail({
  a,
  titelVon,
  wissenHref,
  auszugVon,
}: {
  a: ReferenzAussageErgebnis;
  titelVon: (id: string) => string | undefined;
  wissenHref: (koId: string, fassung: number) => string;
  auszugVon: ((fundstelleId: string) => string | undefined) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const knopf = useRef<HTMLButtonElement>(null);
  const bereich = useRef<HTMLElement>(null);
  const bereichId = useId();
  useEffect(() => {
    if (offen) {
      bereich.current?.focus();
    }
  }, [offen]);
  const zurueck = (): void => {
    setOffen(false);
    knopf.current?.focus();
  };
  return (
    <div className="mt-1.5">
      <button
        ref={knopf}
        type="button"
        data-testid="referenzpruefung-zur-fundstelle"
        aria-expanded={offen}
        aria-controls={bereichId}
        onClick={() => setOffen((v) => !v)}
        className="min-h-[32px] rounded-btn border border-hairline px-2.5 text-[12px] font-semibold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {offen ? t("referenzpruefung.detail.schliessen") : t("referenzpruefung.detail.oeffnen")}
      </button>
      {offen ? (
        // `<section>` mit Namen ist die Landmarke „region" (a11y/useSemanticElements).
        <section
          id={bereichId}
          ref={bereich}
          tabIndex={-1}
          aria-label={t("referenzpruefung.detail.titel")}
          data-testid="referenzpruefung-fundstelle-detail"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              zurueck();
            }
          }}
          className="mt-2 min-w-0 space-y-2 rounded-[10px] bg-surface-2 p-3 text-[12.5px] focus-visible:outline focus-visible:outline-2"
        >
          <p className="font-semibold text-text">{t("referenzpruefung.detail.titel")}</p>
          {a.fundstellen.length > 0 ? (
            <ul className="space-y-2">
              {a.fundstellen.map((f) => {
                const auszug = auszugVon?.(f.fundstelleId);
                return (
                  <li key={f.fundstelleId} className="min-w-0 space-y-1">
                    {auszug ? (
                      <blockquote
                        data-testid="referenzpruefung-passage"
                        className="break-words border-l-2 border-hairline pl-2 text-text"
                      >
                        {auszug}
                      </blockquote>
                    ) : (
                      <p className="text-muted-2">{t("referenzpruefung.detail.passageOhne")}</p>
                    )}
                    <FundstellenLink f={f} titelVon={titelVon} wissenHref={wissenHref} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p data-testid="referenzpruefung-keine-fundstelle" className="text-muted">
              {t("referenzpruefung.detail.keineFundstelle")}
            </p>
          )}
          <p data-testid="referenzpruefung-detail-begruendung" className="break-words text-muted">
            <span className="font-semibold text-text">
              {t("referenzpruefung.detail.begruendung")}
            </span>{" "}
            {a.begruendung}
          </p>
          <p className="text-[11.5px] text-muted-2">{t("referenzpruefung.bedeutung")}</p>
          <button
            type="button"
            data-testid="referenzpruefung-zurueck"
            onClick={zurueck}
            className="min-h-[32px] rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t("referenzpruefung.detail.zurueck")}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function Aussage({
  a,
  text,
  titelVon,
  wissenHref,
  auszugVon,
}: {
  a: ReferenzAussageErgebnis;
  text: string | undefined;
  titelVon: (id: string) => string | undefined;
  wissenHref: (koId: string, fassung: number) => string;
  auszugVon: ((fundstelleId: string) => string | undefined) | undefined;
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
          className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[11.5px] font-semibold ${ZUSTAND_FARBE[a.zustand]}`}
        >
          <span aria-hidden="true" data-testid="referenzpruefung-zeichen">
            {ZUSTAND_ZEICHEN[a.zustand]}
          </span>
          <span data-testid="referenzpruefung-zustand">
            {t(`referenzpruefung.zustand.${a.zustand}`)}
          </span>
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
      <FundstellenDetail a={a} titelVon={titelVon} wissenHref={wissenHref} auszugVon={auszugVon} />
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
  laeuft = false,
  fehler = false,
  antwortFingerabdruck,
  auszugVon,
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
  /** REF-04 (K2): ein Prüflauf zu dieser Antwort läuft gerade (erneute Prüfung, Bestätigung). */
  laeuft?: boolean;
  /** REF-04 (K2): der letzte angestoßene Lauf kam nicht zu Ende (Netz, Ablehnung). */
  fehler?: boolean;
  /** REF-04 (K7): der Fingerabdruck der angezeigten Antwortfassung, soweit bekannt. */
  antwortFingerabdruck?: string | null | undefined;
  /** REF-04 (K5): die Passage je Fundstelle, wie die Antwort sie mitgeliefert hat. */
  auszugVon?: ((fundstelleId: string) => string | undefined) | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const titelId = `${testId}-titel`;
  const aktualitaet = ergebnis.hinweise.filter((h) =>
    ["neuere_fassung", "abruf_nicht_belegt", "bekannter_konflikt", "gegenpassage"].includes(h.art),
  );
  const technisch = ergebnis.hinweise.filter((h) => !aktualitaet.includes(h));
  const gesamt = referenzGesamt(ergebnis, {
    laeuft: laeuft || erneutLaeuft,
    fehler,
    antwortFingerabdruck: antwortFingerabdruck ?? null,
  });
  // K8: der nächste Schritt zum benannten Grund — „Erneut prüfen" nur, wo der Knopf auch steht.
  const naechsterGrund =
    ergebnis.status === "nicht_pruefbar" && ergebnis.grund ? ergebnis.grund : undefined;
  return (
    <section
      data-testid={testId}
      data-status={ergebnis.status}
      data-gesamt={gesamt}
      aria-labelledby={titelId}
      aria-busy={gesamt === "laeuft"}
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
      {/* REF-04 (K3/K4): die zusammenfassende Kennzeichnung und, für jeden Entwurfsstand, dass er
          keine Quellenfreigabe ist. `<output>` trägt implizit role="status". */}
      <output data-testid={`${testId}-gesamt`} data-gesamt={gesamt} className="block">
        <QuellenStatusMarke gesamt={gesamt} testId={`${testId}-gesamt-marke`} />
        {gesamt !== "quellen_geprueft" && gesamt !== "keine_aussage" ? (
          <span className="mt-1 block text-[12px] text-muted">
            {t("referenzpruefung.entwurfHinweis")}
          </span>
        ) : null}
      </output>
      <p data-testid={`${testId}-bedeutung`} className="text-[12px] text-muted">
        {t("referenzpruefung.bedeutung")}
      </p>
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
      {naechsterGrund ? (
        <p data-testid={`${testId}-naechster`} className="text-[12.5px] text-text">
          <span className="font-semibold">{t("referenzpruefung.naechster.label")}</span>{" "}
          <NaechsterSchritt
            grund={naechsterGrund}
            erneutMoeglich={Boolean(onErneut) && erneutAngeboten(ergebnis)}
          />
        </p>
      ) : null}
      {ergebnis.aussagen.length > 0 ? (
        <ul className="space-y-2">
          {ergebnis.aussagen.map((a) => (
            <Aussage
              key={a.aussageId}
              a={a}
              text={aussageTexte?.get(a.aussageId)}
              titelVon={titelVon}
              wissenHref={wissenHref}
              auszugVon={auszugVon}
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
          disabled={erneutLaeuft || laeuft}
          className="min-h-[36px] rounded-btn border border-hairline px-3 text-[12.5px] font-semibold text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          {erneutLaeuft ? t("referenzpruefung.erneut.laeuft") : t("referenzpruefung.erneut.knopf")}
        </button>
      ) : null}
    </section>
  );
}
