// ================================================================================================
// ASSISTENZ MINIMAL (produkt:20261011:assistenz-minimalistische-oberflaeche) — Menü, Unterseiten und
// der Steuerbereich laufender Vorgänge.
// ================================================================================================
//
// Die Grundansicht im Produktbetrieb hat vier Bereiche (Kopf, Kontextzeile, Gespräch, Eingabe; siehe
// `KlaraVorschau.tsx`). Was dort nicht dauerhaft steht, wohnt hier:
//   · das Menü mit genau fünf Einträgen und je einer Unterseite mit eindeutigem Rückweg;
//   · Verlauf, Meine Funktionen, Einstellungen (Sprache, Verbindungen, Darstellung, Daten &
//     Freigaben) und Hilfe — mit denselben Diensten wie bisher (`echt.ts`, `vorlesen.ts`);
//   · die Vorgangsleiste: jeder tatsächlich laufende Vorgang einzeln, mit seinem eigenen Stopp.
// Nichts hier simuliert einen Zustand; jede Zeile liest den echten Dienst.
import { type CSSProperties, type ReactNode, type RefObject, useState } from "react";
import { Link } from "react-router-dom";
import type { KlaraObjektbezug } from "../../api/klaraGespraech";
import { HOME_ROUTE } from "../../app/navigation";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { internerPfad } from "../../lib/internerPfad";
import { formatKoTimestamp } from "../../lib/koDates";
import type { KiLage } from "./KlaraEchtGespraech";
import { KlaraSprachausgabe } from "./KlaraSprache";
import { einwilligen, loescheGespraech, neuesGespraech, useEchtGespraech } from "./echt";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const ABSCHNITT = "text-[12.5px] font-semibold text-ink";

/** UI-MIN-16: die Systemabfrage für die dunkle Darstellung (Web-Assistenz und Mac-Begleiter). */
export const DUNKEL_ABFRAGE = "(prefers-color-scheme: dark)";

/**
 * produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-16): die Assistenz folgt der
 * Hell-/Dunkeleinstellung des Systems — im Web wie im Fenster des Mac-Begleiters. Nur die Farb-Token
 * aus `styles/themes.css` werden für die Fläche überschrieben (RGB-Kanäle, keine neuen Farbnamen);
 * der Rest der App bleibt, wie er ist. Text-Paarungen ≥ 4,5:1 auf Fläche (#1B2028) und Seite
 * (#12161C).
 */
export const DUNKLE_TOKEN = {
  "--kw-page": "18 22 28",
  "--kw-surface": "27 32 40",
  "--kw-ink": "236 239 243",
  "--kw-text": "226 230 235",
  "--kw-text-soft": "214 219 225",
  "--kw-muted": "170 178 189",
  "--kw-muted-2": "170 178 189",
  "--kw-hairline": "58 66 78",
  "--kw-hairline-soft": "40 46 56",
  "--kw-brand-text": "245 160 74",
  "--kw-trust-warn-text": "240 196 110",
  "--kw-trust-warn-bg": "58 46 20",
  "--kw-trust-crit-text": "245 165 158",
  "--kw-trust-crit-bg": "68 30 28",
  "--kw-trust-pos-text": "140 214 170",
  "--kw-trust-pos-bg": "24 52 38",
  "--kw-trust-info-text": "140 200 220",
  "--kw-trust-info-bg": "22 44 52",
  "--kw-ai": "184 176 255",
  "--kw-ai-surface-1": "48 44 92",
  "--kw-ai-surface-2": "36 34 66",
  "--kw-ai-dashed": "96 90 160",
  colorScheme: "dark",
} as CSSProperties;

export type MenueSeite = "neu" | "verlauf" | "funktionen" | "einstellungen" | "hilfe";

export const MENUE_EINTRAEGE: readonly MenueSeite[] = [
  "neu",
  "verlauf",
  "funktionen",
  "einstellungen",
  "hilfe",
];

const MENUE_TEXT: Record<MenueSeite, string> = {
  neu: "assistenzminimal.menue.neu",
  verlauf: "assistenzminimal.menue.verlauf",
  funktionen: "assistenzminimal.menue.funktionen",
  einstellungen: "assistenzminimal.menue.einstellungen",
  hilfe: "assistenzminimal.menue.hilfe",
};

// -------------------------------------------------------------------------------------------------
// Symbole — rein dekorativ; der Name steht immer am Knopf (aria-label/title).
// -------------------------------------------------------------------------------------------------
export function MenueSymbol(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function EinklappenSymbol(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function MikrofonSymbol(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// -------------------------------------------------------------------------------------------------
// Das Menü — fünf Einträge, als Liste aus Knöpfen (Tab/Umschalt+Tab, Eingabe, Escape).
// -------------------------------------------------------------------------------------------------
export function MenueListe({
  id,
  ersterRef,
  onWahl,
}: {
  id: string;
  ersterRef: RefObject<HTMLButtonElement>;
  onWahl: (seite: MenueSeite) => void;
}): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <nav
      id={id}
      data-testid="klara-menue"
      aria-label={t("assistenzminimal.menue.label")}
      className="border-b border-hairline bg-page px-2 py-1.5"
    >
      <ul className="grid gap-0.5">
        {MENUE_EINTRAEGE.map((seite, i) => (
          <li key={seite}>
            <button
              ref={i === 0 ? ersterRef : undefined}
              type="button"
              data-testid={`klara-menue-${seite}`}
              onClick={() => onWahl(seite)}
              className="w-full rounded-btn px-2.5 py-1.5 text-left text-[13px] font-semibold text-text hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {t(MENUE_TEXT[seite])}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Eine Unterseite: Titel, eindeutiger Rückweg, scrollbarer Inhalt. */
export function Unterseite({
  seite,
  zurueckRef,
  onZurueck,
  children,
  verborgen = false,
}: {
  seite: MenueSeite;
  zurueckRef: RefObject<HTMLButtonElement> | null;
  onZurueck: () => void;
  children: ReactNode;
  verborgen?: boolean;
}): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <div
      data-testid="klara-unterseite"
      data-seite={seite}
      hidden={verborgen}
      className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{t(MENUE_TEXT[seite])}</h3>
        <button
          ref={zurueckRef}
          type="button"
          data-testid="klara-unterseite-zurueck"
          onClick={onZurueck}
          className={KNOPF}
        >
          {t("assistenzminimal.zurueck")}
        </button>
      </div>
      {children}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Steuerbereich: jeder laufende Vorgang einzeln — identifizierbar und mit seiner eigenen Wirkung.
// -------------------------------------------------------------------------------------------------
export interface VorgangAktion {
  testId: string;
  label: string;
  onClick: () => void;
}

export interface Vorgang {
  /** aufnahme · anfrage · vorlesen · begleitung · arbeit · entscheidung */
  art: string;
  text: string;
  textTestId?: string;
  /** Genauere Art am Text, z. B. „diktat“ oder „auftrag“ bei der Aufnahme. */
  textArt?: string;
  aktionen: VorgangAktion[];
}

export function VorgangsLeiste({
  vorgaenge,
  testId,
  label,
  kompakt = false,
}: {
  vorgaenge: readonly Vorgang[];
  testId: string;
  label: string;
  /** An der eingeklappten Figur: nur die Stopp-/Pausenknöpfe, der Text als Name. */
  kompakt?: boolean;
}): JSX.Element | null {
  if (vorgaenge.length === 0) {
    return null;
  }
  if (kompakt) {
    return (
      <ul data-testid={testId} aria-label={label} className="mt-1 flex flex-col items-center gap-1">
        {vorgaenge.map((v) =>
          v.aktionen.map((a) => (
            <li key={`${v.art}-${a.testId}`}>
              <button
                type="button"
                data-testid={a.testId}
                data-vorgang={v.art}
                title={v.text}
                aria-label={`${v.text} – ${a.label}`}
                onClick={a.onClick}
                className="whitespace-nowrap rounded-pill border border-ink bg-surface px-2 py-0.5 text-klein font-semibold text-ink shadow-tile focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                {a.label}
              </button>
            </li>
          )),
        )}
      </ul>
    );
  }
  return (
    <section
      data-testid={testId}
      aria-label={label}
      aria-live="polite"
      className="space-y-1 border-b border-hairline bg-ai-surface-2 px-3 py-1.5"
    >
      {vorgaenge.map((v) => (
        <div
          key={v.art}
          data-testid="klara-vorgang"
          data-art={v.art}
          className="flex flex-wrap items-center justify-between gap-1.5"
        >
          <p
            data-testid={v.textTestId}
            data-art={v.textArt}
            className="min-w-0 flex-1 text-[11.5px] font-semibold text-ai"
          >
            {v.text}
          </p>
          {v.aktionen.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {v.aktionen.map((a) => (
                <button
                  key={a.testId}
                  type="button"
                  data-testid={a.testId}
                  onClick={a.onClick}
                  className={`${KNOPF} h-7 px-2 text-[11.5px]`}
                >
                  {a.label}
                </button>
              ))}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  );
}

// -------------------------------------------------------------------------------------------------
// Neues Gespräch — nur dort nachfragen, wo etwas tatsächlich unerreichbar würde.
// -------------------------------------------------------------------------------------------------
export function NeuSeite({
  kontext,
  onFertig,
}: {
  kontext: KlaraObjektbezug;
  onFertig: (erledigt: boolean) => void;
}): JSX.Element {
  const { t } = useAssistenzT();
  const e = useEchtGespraech();
  const [laeuft, setLaeuft] = useState(false);
  return (
    <div data-testid="klara-neu-frage" className="space-y-2">
      <p className="text-[12px] leading-relaxed text-text">{t("assistenzminimal.neu.frage")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-neues-gespraech"
          disabled={laeuft || e.laeuftSeit !== null}
          onClick={() => {
            setLaeuft(true);
            void neuesGespraech(kontext, t).finally(() => {
              setLaeuft(false);
              onFertig(true);
            });
          }}
          className={KNOPF_KI}
        >
          {t("assistenzminimal.neu.ja")}
        </button>
        <button
          type="button"
          data-testid="klara-neues-gespraech-abbrechen"
          onClick={() => onFertig(false)}
          className={KNOPF}
        >
          {t("assistenzminimal.neu.nein")}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Verlauf — das gespeicherte Gespräch: Beginn, letzter Schritt, Umfang. Der Inhalt selbst steht
// vollständig und ungekürzt im Gespräch.
// -------------------------------------------------------------------------------------------------
export function VerlaufSeite({
  pfad,
  onZumGespraech,
}: {
  pfad: string;
  onZumGespraech: () => void;
}): JSX.Element {
  const { t } = useAssistenzT();
  const e = useEchtGespraech();
  const g = e.gespraech;
  if (!g && e.nachrichten.length === 0) {
    return (
      <p data-testid="klara-verlauf-leer" className="text-[12px] text-muted">
        {t("assistenzminimal.verlauf.leer")}
      </p>
    );
  }
  return (
    <div className="space-y-2 text-[12px] text-text">
      {g ? (
        <p data-testid="klara-gespraech-beginn" className="text-muted">
          {t("klaragespraech.beginn", {
            seite: g.objektbezug.seitenName,
            objekt: g.objektbezug.objekt,
          })}{" "}
          {g.objektbezug.pfad !== pfad ? (
            <Link
              // R-1398: der Pfad kommt vom Server zurück — nur ein interner Pfad wird Ziel.
              to={internerPfad(g.objektbezug.pfad, HOME_ROUTE)}
              data-testid="klara-gespraech-beginn-link"
              className="font-semibold text-brand-text hover:underline"
            >
              {t("klaragespraech.zurueck")}
            </Link>
          ) : null}
        </p>
      ) : null}
      {g?.letzterSchritt ? (
        <p data-testid="klara-letzter-schritt-verlauf">
          <span className="font-semibold">{t("klaragespraech.schritt.titel")}: </span>
          {g.letzterSchritt.art === "frage"
            ? t("klaragespraech.schritt.frage", { text: g.letzterSchritt.text })
            : t("klaragespraech.schritt.hilfe", { text: g.letzterSchritt.text })}
        </p>
      ) : null}
      <p data-testid="klara-verlauf-anzahl">
        {t("assistenzminimal.verlauf.anzahl", { n: e.nachrichten.length })}
      </p>
      <button
        type="button"
        data-testid="klara-verlauf-zum-gespraech"
        onClick={onZumGespraech}
        className={KNOPF_KI}
      >
        {t("assistenzminimal.zumGespraech")}
      </button>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Meine Funktionen — was tatsächlich geliefert ist; Geplantes getrennt und ohne Knopf.
// -------------------------------------------------------------------------------------------------
export function FunktionenSeite({
  sprachMoeglich,
  onAuftragSprechen,
  vorschauLink,
  kiArbeitsweg = null,
  notizen = null,
  aufgaben = null,
  erinnerungen = null,
  arbeitsueberblick = null,
}: {
  sprachMoeglich: boolean;
  onAuftragSprechen: () => void;
  vorschauLink: ReactNode;
  /**
   * Integration main (BPA-13, assistenz-ki-arbeitsbegleitung): die vorhandene Fläche „mit einer
   * ausgewählten KI arbeiten“ (`KiArbeitsweg`) — eine gelieferte Funktion am eigenen Gespräch, darum
   * hier unter „Meine Funktionen“ und nicht als Block in der Grundansicht.
   */
  kiArbeitsweg?: ReactNode;
  /**
   * Integration main (Klara 06, klara-notizen-aufgaben): die vorhandene Liste der eigenen Notizen
   * (`KlaraNotizen`) — angelegt wird an der Nachricht, wiedergefunden hier.
   */
  notizen?: ReactNode;
  /**
   * Integration main (Klara 07, klara-aufgaben): die vorhandene Liste der eigenen Aufgaben
   * (`KlaraAufgaben`) — angelegt über den Ausführungsweg im Gespräch, wiedergefunden hier.
   */
  aufgaben?: ReactNode;
  /** Vorhandene Erinnerungsentwürfe und ihre Bedienung bleiben über „Meine Funktionen“ erreichbar. */
  erinnerungen?: ReactNode;
  /** Dieselben berechtigten Originalobjekte im persönlichen Überblick. */
  arbeitsueberblick?: ReactNode;
}): JSX.Element {
  const { t } = useAssistenzT();
  const geliefert = [
    "fragen",
    "markierung",
    "uebersetzen",
    "umformulieren",
    "notiz",
    "seitenhilfe",
    "vorlesen",
  ] as const;
  return (
    <div className="space-y-3">
      {arbeitsueberblick ? (
        <section data-testid="klara-funktion-arbeitsueberblick">{arbeitsueberblick}</section>
      ) : null}
      {erinnerungen ? (
        <section data-testid="klara-funktion-erinnerungen">{erinnerungen}</section>
      ) : null}
      <section
        data-testid="klara-funktionen"
        aria-label={t("assistenzminimal.funktionen.verfuegbar")}
      >
        <h4 className={ABSCHNITT}>{t("assistenzminimal.funktionen.verfuegbar")}</h4>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-text">
          {geliefert.map((f) => (
            <li key={f} data-testid={`klara-funktion-${f}`}>
              {t(`assistenzminimal.funktionen.${f}`)}
            </li>
          ))}
          <li data-testid="klara-funktion-sprechen">
            {sprachMoeglich
              ? t("assistenzminimal.funktionen.sprechen")
              : t("assistenzminimal.funktionen.sprechenNa")}
          </li>
          {sprachMoeglich ? (
            <li data-testid="klara-funktion-auftrag">
              {t("assistenzminimal.funktionen.auftrag")}{" "}
              <button
                type="button"
                data-testid="klara-auftrag-sprechen"
                onClick={onAuftragSprechen}
                className={`${KNOPF} mt-1`}
              >
                {t("klarasprache.auftragSprechen")}
              </button>
            </li>
          ) : null}
        </ul>
      </section>
      {notizen ? <section data-testid="klara-funktion-notizen">{notizen}</section> : null}
      {aufgaben ? <section data-testid="klara-funktion-aufgaben">{aufgaben}</section> : null}
      {kiArbeitsweg ? (
        <section data-testid="klara-funktion-ki-arbeitsweg">{kiArbeitsweg}</section>
      ) : null}
      <section
        data-testid="klara-offen"
        aria-label={t("assistenzminimal.funktionen.geplant")}
        className="rounded-card border border-dashed border-hairline px-3 py-2"
      >
        <h4 className={ABSCHNITT}>{t("assistenzminimal.funktionen.geplant")}</h4>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          {t("klaraprodukt.offen.text")}
        </p>
      </section>
      {vorschauLink}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Einstellungen — Sprache, Verbindungen, Darstellung, Daten & Freigaben.
// -------------------------------------------------------------------------------------------------
export function DatenFreigaben({ kontext }: { kontext: KlaraObjektbezug }): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const e = useEchtGespraech();
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const g = e.gespraech;
  return (
    <section
      data-testid="klara-daten"
      aria-label={t("assistenzminimal.einstellungen.daten")}
      className="space-y-1.5"
    >
      <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.daten")}</h4>
      <p className="text-[11.5px] leading-relaxed text-text">
        {t("klaragespraech.einwilligung.text")}
      </p>
      {g?.einwilligungAm ? (
        <>
          <p
            data-testid="klara-einwilligung-erteilt"
            className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-text"
          >
            {t("klaragespraech.einwilligung.erteilt", {
              zeit: formatKoTimestamp(g.einwilligungAm, i18n.language) ?? "—",
            })}
            <button
              type="button"
              data-testid="klara-einwilligung-widerrufen"
              disabled={e.laeuftSeit !== null}
              onClick={() => void einwilligen(false, kontext, t)}
              className={KNOPF}
            >
              {t("klaragespraech.einwilligung.widerrufen")}
            </button>
          </p>
          <p className="text-[11px] leading-relaxed text-muted">
            {t("assistenzminimal.einwilligung.wirkung")}
          </p>
        </>
      ) : (
        <p
          data-testid="klara-einwilligung-keine"
          className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-text"
        >
          {t("assistenzminimal.einwilligung.keine")}
          <button
            type="button"
            data-testid="klara-einwilligung-erteilen-einstellung"
            disabled={e.laden !== "bereit"}
            onClick={() => void einwilligen(true, kontext, t)}
            className={KNOPF_KI}
          >
            {t("assistenzminimal.einwilligung.erteilen")}
          </button>
        </p>
      )}
      <p className="text-[11px] leading-relaxed text-muted">
        {t("klaragespraech.bedienhilfe.speichern")}
      </p>
      {e.hinweis ? (
        <p
          role="alert"
          data-testid="klara-daten-fehlerhinweis"
          className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] text-trust-crit-text"
        >
          {e.hinweis}
        </p>
      ) : null}
      {g ? (
        <div className="flex flex-wrap gap-1.5">
          {loeschenFragen ? (
            <>
              <button
                type="button"
                data-testid="klara-gespraech-loeschen-bestaetigen"
                onClick={() => {
                  setLoeschenFragen(false);
                  void loescheGespraech(t);
                }}
                className={KNOPF}
              >
                {t("klaragespraech.loeschenBestaetigen")}
              </button>
              <button
                type="button"
                data-testid="klara-gespraech-loeschen-abbrechen"
                onClick={() => setLoeschenFragen(false)}
                className={KNOPF}
              >
                {t("klaragespraech.loeschenAbbrechen")}
              </button>
            </>
          ) : (
            <button
              type="button"
              data-testid="klara-gespraech-loeschen"
              disabled={e.laeuftSeit !== null}
              onClick={() => setLoeschenFragen(true)}
              className={KNOPF}
            >
              {t("klaragespraech.loeschen")}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function EinstellungenSeite({
  kontext,
  seitenName,
  ki,
  kiText,
  darstellung,
  unterstuetzung = null,
}: {
  kontext: KlaraObjektbezug;
  seitenName: string;
  ki: KiLage;
  /** Die Lage der KI als Satz — derselbe Wortlaut wie in den Kontextdetails. */
  kiText: string | null;
  darstellung: ReactNode;
  /**
   * Integration main (Klara 12, Eigeninitiative): die vorhandene persönliche Modus-Wahl
   * (`KlaraModusWahl`) — hier in den Einstellungen, nicht in der Grundansicht. Sie trägt ihren eigenen
   * Titel und speichert über denselben persönlichen Weg (`lib/klaraEigeninitiative.ts`).
   */
  unterstuetzung?: ReactNode;
}): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <div className="space-y-4">
      <section data-testid="klara-einstellung-sprache" className="space-y-1.5">
        <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.sprache")}</h4>
        <KlaraSprachausgabe />
      </section>
      {unterstuetzung ? (
        <section data-testid="klara-einstellung-unterstuetzung">{unterstuetzung}</section>
      ) : null}
      <section data-testid="klara-einstellung-verbindungen" className="space-y-1">
        <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.verbindungen")}</h4>
        <p className="text-[11.5px] leading-relaxed text-text">
          {t("assistenzminimal.verbindung.seite", { seite: seitenName })}
        </p>
        {kiText ? <p className="text-[11.5px] leading-relaxed text-text">{kiText}</p> : null}
        {ki.extern ? (
          <p className="text-[11px] text-muted">
            {ki.extern === "blockiert"
              ? t("topbar.extern.blockiert")
              : ki.extern === "frei"
                ? t("topbar.extern.frei")
                : t("topbar.extern.freiVertraulich")}
          </p>
        ) : null}
      </section>
      <section data-testid="klara-einstellung-darstellung" className="space-y-1.5">
        <h4 className={ABSCHNITT}>{t("assistenzminimal.einstellungen.darstellung")}</h4>
        <div className="flex flex-wrap gap-1.5">{darstellung}</div>
      </section>
      <DatenFreigaben kontext={kontext} />
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Hilfe — die Hilfe zu dieser Seite (vorhandene Tutorials) und die Bedienung in kurzen Sätzen.
// -------------------------------------------------------------------------------------------------
export function HilfeSeite({ seitenHilfe }: { seitenHilfe: ReactNode }): JSX.Element {
  const { t } = useAssistenzT();
  return (
    <div className="space-y-3">
      <section aria-label={t("assistenzminimal.hilfe.seite")} className="space-y-1">
        <h4 className={ABSCHNITT}>{t("assistenzminimal.hilfe.seite")}</h4>
        {seitenHilfe}
      </section>
      <section data-testid="klara-bedienhilfe" className="space-y-1">
        <h4 className={ABSCHNITT}>{t("assistenzminimal.hilfe.bedienung")}</h4>
        <ul className="list-disc space-y-1 pl-5 text-[11.5px] leading-relaxed text-text">
          <li>{t("assistenzminimal.hilfe.grundansicht")}</li>
          <li>{t("klaragespraech.bedienhilfe.fragen")}</li>
          <li data-testid="klara-bedienhilfe-bezug">{t("klarakontext.bedienhilfe.bezug")}</li>
          <li>{t("klarakontext.bedienhilfe.markierung")}</li>
          <li>{t("klarakontext.bedienhilfe.quellen")}</li>
          <li>{t("klarakontext.bedienhilfe.uebersetzen")}</li>
          <li>{t("klarakontext.bedienhilfe.tutorial")}</li>
          <li data-testid="klara-bedienhilfe-vorschlag">
            {t("klaravorschlag.bedienhilfe.umformulieren")}
          </li>
          <li>{t("klaravorschlag.bedienhilfe.uebernehmen")}</li>
          <li>{t("klaravorschlag.bedienhilfe.rueckfrage")}</li>
          <li>{t("klaravorschlag.bedienhilfe.notiz")}</li>
          <li>{t("assistenzminimal.hilfe.vorgaenge")}</li>
          <li>{t("klaragespraech.bedienhilfe.speichern")}</li>
          <li>{t("assistenzminimal.hilfe.menue")}</li>
          <li data-testid="klara-bedienhilfe-sprache">{t("assistenzminimal.hilfe.sprechen")}</li>
          <li>{t("klarasprache.bedienhilfe.datenschutz")}</li>
          <li>{t("klaraprodukt.vorschau.hinweis")}</li>
        </ul>
      </section>
    </div>
  );
}
