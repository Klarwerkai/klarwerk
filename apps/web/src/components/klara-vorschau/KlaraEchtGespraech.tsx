// ================================================================================================
// KLARA 01 (produkt:20261008:klara-basis) — das ECHTE Gespräch in Klaras Fläche.
// ================================================================================================
//
// Zeigt, was im echten Betrieb gilt, und zwar so, wie es TATSÄCHLICH ist:
//   · die Lage der KI (abgeschaltet, kein Modell, Status unbekannt) und den wirksamen Stand der
//     zentralen Freigabe für externe KI — dieselben Auskünfte wie Fragen-Seite und Kopfzeile;
//   · Beginn und Objektbezug des Gesprächs, den zuletzt bewusst begonnenen Schritt samt Stand;
//   · die Einwilligung dieses Gesprächs (ohne sie geht keine Frage los);
//   · jede Nachricht mit ihrer Herkunft („KI-Antwort" nur bei `demo: false`) und ihrem Speicherstand.
// Die Eingabe, der Stopp und die Figur stehen in `KlaraVorschau.tsx`.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useReasonerStatus } from "../../api/hooks";
import type { KlaraObjektbezug } from "../../api/klaraGespraech";
import type { KnowledgeClass } from "../../api/types";
import { HOME_ROUTE } from "../../app/navigation";
// produkt:20261010:assistenz-name-avatar: `t` mit dem persönlichen Namen (`{{assistenz}}`).
import { useAssistenzT } from "../../lib/assistenzProfil";
import { internerPfad } from "../../lib/internerPfad";
import { KNOWLEDGE_CLASS_META } from "../../lib/knowledgeClass";
import { leserHref } from "../../lib/objektbezug";
import { useAiAvailable } from "../../lib/useAiAvailable";
import { type ExternStand, externStand } from "../../shell/ExternStatus";
import { AnswerMarkdown } from "../AnswerMarkdown";
import { VorlesenKnopf } from "./KlaraSprache";
import {
  type EchtNachricht,
  einwilligen,
  loescheGespraech,
  neuesGespraech,
  nochmalSpeichern,
  schrittUnterbrochen,
  useEchtGespraech,
} from "./echt";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const SCHILD = "rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase";

export interface KiLage {
  /** Der Administrator hat die KI abgeschaltet (D5) — dann geht keine Frage los. */
  abgeschaltet: boolean;
  /** Kein nutzbares Modell für „answer": Antworten kommen dann ohne KI. */
  ohneModell: boolean;
  /** Der Status ist nicht abrufbar. */
  unbekannt: boolean;
  extern: ExternStand | null;
}

/** Die Lage der KI für Klaras Frageweg — aus demselben öffentlichen Status wie Fragen-Seite und Kopfzeile. */
export function useKlaraKiLage(): KiLage {
  const status = useReasonerStatus();
  const antwort = useAiAvailable("answer");
  const abgeschaltet = status.data?.kiAbgeschaltet === true;
  return {
    abgeschaltet,
    ohneModell: !abgeschaltet && !antwort.isLoading && !antwort.statusUnknown && !antwort.available,
    unbekannt: antwort.statusUnknown,
    extern: externStand(status.data),
  };
}

function bezugZeile(b: KlaraObjektbezug): { seite: string; objekt: string } {
  return { seite: b.seitenName, objekt: b.objekt };
}

/**
 * Klara 03 · K2: der Bezug, mit dem ein Schritt festgehalten wurde — Markierung oder frei, Fassung
 * und Absatz von DAMALS. Er kommt aus der Ablage und wird nie aus der aktuellen Seite ergänzt.
 */
function BezugVonDamals({ b }: { b: KlaraObjektbezug }): JSX.Element | null {
  const { t } = useAssistenzT();
  const teile: string[] = [];
  if (b.bezug === "frei") {
    teile.push(t("klarakontext.verlauf.frei"));
  } else if (b.bezug === "markierung") {
    teile.push(
      b.absatz
        ? t("klarakontext.verlauf.markierungAbsatz", { nr: b.absatz })
        : t("klarakontext.verlauf.markierung"),
    );
  }
  if (b.fassung) {
    teile.push(t("klarakontext.fassung", { nr: b.fassung }));
  }
  if (teile.length === 0) {
    return null;
  }
  return (
    <span data-testid="klara-nachricht-bezug" data-bezug={b.bezug ?? ""}>
      {teile.join(" · ")}
    </span>
  );
}

/** Klara 03 · K3: jede Quelle mit Titel, Fassung und Prüfstatus — oder ehrlich ohne Angabe. */
function QuellenZeile({ n }: { n: EchtNachricht }): JSX.Element {
  const { t } = useAssistenzT();
  const angaben = new Map((n.quellenAngaben ?? []).map((a) => [a.koId, a]));
  return (
    <ul className="mt-1 space-y-0.5 text-[11px]" data-testid="klara-quellen">
      <li className={KLEINTITEL}>{t("klaragespraech.quellen")}</li>
      {n.quellen.map((q, i) => {
        const a = angaben.get(q);
        const geprueft = a?.geprueft === true ? "ja" : a?.geprueft === false ? "nein" : "unbekannt";
        return (
          <li
            key={q}
            data-testid="klara-quelle"
            data-ko={q}
            data-fassung={a?.fassung ?? ""}
            data-geprueft={geprueft}
            className="flex flex-wrap items-center gap-1"
          >
            <Link
              to={leserHref({ koId: q, fassung: a?.fassung ?? null })}
              className="rounded-pill border border-hairline bg-surface px-1.5 py-0.5 font-semibold text-text hover:border-ink/30"
            >
              [{i + 1}] {a ? a.titel : t("klarakontext.quelle.ohneTitel")}
            </Link>
            {a ? (
              <span className="text-muted">
                {a.fassung
                  ? t("klarakontext.fassung", { nr: a.fassung })
                  : t("klarakontext.quelle.fassungUnbekannt")}
                {" · "}
                <span
                  className={
                    geprueft === "ja"
                      ? "font-semibold text-text"
                      : "font-semibold text-trust-warn-text"
                  }
                >
                  {t(`klarakontext.quelle.geprueft.${geprueft}`)}
                </span>
              </span>
            ) : (
              <span className="text-muted-2">{t("klarakontext.quelle.ohneAngaben")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NachrichtEcht({ n }: { n: EchtNachricht }): JSX.Element {
  const { t } = useAssistenzT();
  const klasse =
    n.wissensklasse && n.wissensklasse in KNOWLEDGE_CLASS_META
      ? KNOWLEDGE_CLASS_META[n.wissensklasse as KnowledgeClass]
      : null;
  const istAntwort = n.modus === "ki" || n.modus === "ohne_ki";
  // Klara 03 · K3: eine Antwort ohne jede Quelle hat keine Grundlage — das steht als Kennzeichen da.
  const ohneGrundlage = n.modus === "ohne_ki" && n.quellen.length === 0;
  return (
    <li
      data-testid="klara-nachricht"
      data-von={n.von}
      data-modus={n.modus}
      data-gespeichert={n.gespeichert}
      className={`rounded-card px-2.5 py-2 text-[12px] leading-relaxed ${
        n.von === "du"
          ? "ml-6 bg-ink/5 text-text"
          : n.modus === "fehler"
            ? "mr-2 border border-hairline bg-trust-crit-bg text-trust-crit-text"
            : "mr-2 border border-ai/30 bg-ai-surface-2 text-text"
      }`}
    >
      <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-2">
        <span className="font-semibold text-text">
          {n.von === "du" ? t("klaravorschau.verlauf.du") : t("klaravorschau.verlauf.klara")}
        </span>
        <span data-testid="klara-nachricht-herkunft">
          {t("klaravorschau.verlauf.auf", bezugZeile(n.objektbezug))}
        </span>
        <BezugVonDamals b={n.objektbezug} />
        {n.modus === "ki" ? (
          <>
            <span
              data-testid="klara-echt-kennzeichen"
              className={`${SCHILD} border border-ai bg-ai-surface-1 text-ai`}
            >
              {t("klaragespraech.label.ki")}
            </span>
            <span className={`${SCHILD} bg-trust-warn-bg text-trust-warn-text`}>
              {t("klaragespraech.label.kiHinweis")}
            </span>
          </>
        ) : n.modus === "ohne_ki" ? (
          <span
            data-testid="klara-echt-kennzeichen"
            className={`${SCHILD} border border-hairline bg-surface text-muted`}
          >
            {t("klaragespraech.label.ohneKi")}
          </span>
        ) : n.modus === "hilfetext" ? (
          <span
            data-testid="klara-echt-kennzeichen"
            className={`${SCHILD} border border-hairline bg-surface text-muted`}
          >
            {t("klaragespraech.label.hilfetext")}
          </span>
        ) : n.modus === "abgebrochen" ? (
          <span data-testid="klara-echt-kennzeichen" className={`${SCHILD} bg-ink/5 text-text`}>
            {t("klaragespraech.label.abgebrochen")}
          </span>
        ) : n.modus === "fehler" ? (
          <span
            data-testid="klara-echt-kennzeichen"
            className={`${SCHILD} border border-hairline bg-surface text-trust-crit-text`}
          >
            {t("klaragespraech.label.fehler")}
          </span>
        ) : null}
        {klasse ? (
          <span className={`${SCHILD} border border-hairline bg-surface text-muted`}>
            {t(klasse.labelKey)}
          </span>
        ) : null}
        {ohneGrundlage ? (
          <span
            data-testid="klara-grundlage-fehlt"
            className={`${SCHILD} bg-trust-warn-bg text-trust-warn-text`}
          >
            {t("klarakontext.grundlage.kennzeichen")}
          </span>
        ) : null}
      </div>
      {istAntwort ? (
        <AnswerMarkdown text={n.text} className="text-[12px] leading-relaxed text-text" />
      ) : (
        <p className="whitespace-pre-line">{n.text}</p>
      )}
      {/* Klara 03: Quellen mit Titel, Fassung und Prüfstatus (ersetzt die blossen [n]-Verweise). */}
      {istAntwort && n.quellen.length > 0 ? <QuellenZeile n={n} /> : null}
      {/* Klara 02: jede Antwort und jeder Hilfetext kann vorgelesen werden — nur auf Klick. */}
      {n.von === "klara" && n.text ? (
        <div className="mt-1">
          <VorlesenKnopf id={n.id} text={n.text} />
        </div>
      ) : null}
      {n.gespeichert === "laeuft" ? (
        <p data-testid="klara-speicherstand" className="mt-1 text-[10.5px] text-muted-2">
          {t("klaragespraech.gespeichert.laeuft")}
        </p>
      ) : n.gespeichert === "nein" ? (
        <p
          data-testid="klara-speicherstand"
          className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-trust-crit-text"
        >
          {n.ohneBeleg
            ? t("klaragespraech.gespeichert.ohneBeleg")
            : t("klaragespraech.gespeichert.nein")}
          {n.nochmal ? (
            <button
              type="button"
              data-testid="klara-nochmal-speichern"
              onClick={() => void nochmalSpeichern(n.id)}
              className={KNOPF}
            >
              {t("klaragespraech.gespeichert.nochmal")}
            </button>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

export function KlaraEchtGespraech({
  kontext,
  pfad,
  ki,
  onErneutFragen,
  onNeuLaden,
}: {
  kontext: KlaraObjektbezug;
  pfad: string;
  ki: KiLage;
  /** Klara 03: der gespeicherte Wortlaut UND der Bezug von damals — nichts wird neu zusammengesetzt. */
  onErneutFragen: (frage: string, bezug: KlaraObjektbezug) => void;
  onNeuLaden: () => void;
}): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const e = useEchtGespraech();
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const g = e.gespraech;
  const schritt = g?.letzterSchritt ?? null;
  const unterbrochen = schrittUnterbrochen(schritt, e.laeuftSeit);
  const schrittStand = unterbrochen ? "unterbrochen" : (schritt?.stand ?? null);

  return (
    <>
      <p
        data-testid="klara-echt-hinweis"
        data-laden={e.laden}
        className="rounded-btn bg-ai-surface-2 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-text"
      >
        {t("klaragespraech.hinweis")}
      </p>

      {/* Die Lage der KI — so, wie der Server sie meldet. */}
      {ki.abgeschaltet ? (
        <p
          data-testid="klara-ki-aus"
          className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-crit-text"
        >
          {t("d5kiaus.hinweis")}
        </p>
      ) : ki.ohneModell ? (
        <p
          data-testid="klara-ki-ohne-modell"
          className="rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[11.5px] leading-relaxed text-trust-warn-text"
        >
          {t("klaragespraech.ki.ohneModell")}
        </p>
      ) : ki.unbekannt ? (
        <p data-testid="klara-ki-unbekannt" className="text-[11.5px] text-muted-2">
          {t("klaragespraech.ki.unbekannt")}
        </p>
      ) : null}
      {ki.extern ? (
        <p
          data-testid="klara-extern"
          data-extern={ki.extern}
          title={t("topbar.extern.hinweis")}
          className="text-[11px] font-semibold text-muted"
        >
          {ki.extern === "blockiert"
            ? t("topbar.extern.blockiert")
            : ki.extern === "frei"
              ? t("topbar.extern.frei")
              : t("topbar.extern.freiVertraulich")}
        </p>
      ) : null}

      {e.laden === "laedt" ? (
        <p data-testid="klara-echt-laden" className="text-[11.5px] text-muted-2">
          {t("klaragespraech.laden")}
        </p>
      ) : e.laden === "fehler" ? (
        <div
          data-testid="klara-echt-ladefehler"
          className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] text-trust-crit-text"
        >
          <p>{t("klaragespraech.ladeFehler", { grund: e.ladeFehler ?? "" })}</p>
          <button
            type="button"
            data-testid="klara-echt-nochmal-laden"
            onClick={onNeuLaden}
            className={`${KNOPF} mt-1`}
          >
            {t("klaragespraech.ladenNochmal")}
          </button>
        </div>
      ) : null}

      {/* Beginn und letzter Schritt — mit dem Objektbezug von damals. */}
      {g ? (
        <section data-testid="klara-echt-stand" className="space-y-1">
          <p data-testid="klara-gespraech-beginn" className="text-[11.5px] text-muted">
            {t("klaragespraech.beginn", bezugZeile(g.objektbezug))}{" "}
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
          {schritt ? (
            <div
              data-testid="klara-letzter-schritt"
              data-stand={schrittStand ?? ""}
              className="rounded-card border border-hairline bg-page px-2.5 py-2"
            >
              <p className={KLEINTITEL}>{t("klaragespraech.schritt.titel")}</p>
              <p className="text-[12px] text-text">
                {schritt.art === "frage"
                  ? t("klaragespraech.schritt.frage", { text: schritt.text })
                  : t("klaragespraech.schritt.hilfe", { text: schritt.text })}
                {" · "}
                <span data-testid="klara-letzter-schritt-stand" className="font-semibold">
                  {t(`klaragespraech.schritt.stand.${schrittStand ?? "laeuft"}`)}
                </span>
              </p>
              <p data-testid="klara-letzter-schritt-ort" className="text-[11px] text-muted">
                {t("klaragespraech.schritt.ort", bezugZeile(schritt.objektbezug))}{" "}
                {schritt.objektbezug.pfad !== pfad ? (
                  <Link
                    to={internerPfad(schritt.objektbezug.pfad, HOME_ROUTE)}
                    className="font-semibold text-brand-text hover:underline"
                  >
                    {t("klaragespraech.zurueck")}
                  </Link>
                ) : null}
              </p>
              {schritt.art === "frage" &&
              schrittStand !== "beantwortet" &&
              schrittStand !== "laeuft" &&
              g.einwilligungAm &&
              !ki.abgeschaltet &&
              e.laeuftSeit === null ? (
                <button
                  type="button"
                  data-testid="klara-schritt-nochmal"
                  onClick={() => onErneutFragen(schritt.text, schritt.objektbezug)}
                  className={`${KNOPF_KI} mt-1`}
                >
                  {t("klaragespraech.schritt.nochmal")}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {!e.schrittGespeichert ? (
        <p
          data-testid="klara-schritt-nicht-gespeichert"
          className="text-[11px] font-semibold text-trust-crit-text"
        >
          {t("klaragespraech.schritt.nichtGespeichert")}
        </p>
      ) : null}

      {/* Einwilligung dieses Gesprächs — erst wenn das gespeicherte Gespräch gelesen ist, damit
          keine Zustimmung ein zweites, leeres Gespräch neben dem vorhandenen anlegt. */}
      {e.laden === "bereit" && !g?.einwilligungAm ? (
        <section
          data-testid="klara-einwilligung"
          className="rounded-card border border-ai/40 bg-surface px-3 py-2.5"
        >
          <h3 className="text-[12px] font-semibold text-ink">
            {t("klaragespraech.einwilligung.titel")}
          </h3>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-text">
            {t("klaragespraech.einwilligung.text")}
          </p>
          <button
            type="button"
            data-testid="klara-einwilligung-erteilen"
            onClick={() => void einwilligen(true, kontext, t)}
            className={`${KNOPF_KI} mt-1.5`}
          >
            {t("klaragespraech.einwilligung.erteilen")}
          </button>
        </section>
      ) : g?.einwilligungAm ? (
        <p
          data-testid="klara-einwilligung-erteilt"
          className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted"
        >
          {t("klaragespraech.einwilligung.erteilt", {
            zeit: new Date(g.einwilligungAm).toLocaleString(i18n.language),
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
      ) : null}

      {e.hinweis ? (
        <p
          role="alert"
          data-testid="klara-echt-fehlerhinweis"
          className="rounded-btn bg-trust-crit-bg px-2.5 py-1.5 text-[11.5px] text-trust-crit-text"
        >
          {e.hinweis}
        </p>
      ) : null}

      {/* Verlauf — jede Nachricht mit Herkunft und Speicherstand. */}
      <section data-testid="klara-verlauf" aria-label={t("klaravorschau.verlauf.titel")}>
        <p className={KLEINTITEL}>{t("klaravorschau.verlauf.titel")}</p>
        {e.nachrichten.length === 0 ? (
          <p data-testid="klara-echt-leer" className="mt-1 text-[11.5px] text-muted-2">
            {t("klaragespraech.leer")}
          </p>
        ) : (
          <ol className="mt-1 space-y-2">
            {e.nachrichten.map((n) => (
              <NachrichtEcht key={n.id} n={n} />
            ))}
          </ol>
        )}
      </section>

      {g ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-testid="klara-neues-gespraech"
            disabled={e.laeuftSeit !== null}
            onClick={() => {
              setLoeschenFragen(false);
              void neuesGespraech(kontext, t);
            }}
            className={KNOPF}
          >
            {t("klaragespraech.neu")}
          </button>
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
    </>
  );
}
