// ================================================================================================
// KLARA-VORSCHAU · KLARA BEGLEITET DAS TUTORIAL „FRAGEN“ — Zeiger, Schrittstand, Steuerung.
// ================================================================================================
//
// Klara steuert das VORHANDENE Tutorial (FE-003) über dessen Fernsteuerung (`tutorial/fernsteuerung.ts`)
// — dieselben Handlungen wie die Knöpfe im Tutorialbereich, kein zweiter Zähler.
//
// DER ZEIGER zeigt auf das TATSÄCHLICHE Bedienelement des aktuellen Teils: zuerst auf der echten
// Seite (dasselbe `data-tutorial-ziel`, das die echten Bausteine tragen), sonst in der Demo. Fehlt es
// an beiden Orten, sagt Klara das in Worten (Fehlziel) — der Zeiger zeigt nie ins Leere.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TutorialFernLage } from "../../tutorial/fernsteuerung";
import { ZIEL_ATTRIBUT } from "../fragen/ziele";

export type ZielOrt = "echt" | "demo";

export interface ZielTreffer {
  el: HTMLElement;
  ort: ZielOrt;
}

function sichtbar(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** Sucht das Bedienelement: erst auf der echten Seite, dann in der Tutorial-Demo. */
export function findeZiel(zielName: string | null, doc: Document = document): ZielTreffer | null {
  if (!zielName) {
    const demo = doc.querySelector<HTMLElement>("[data-tutorial-demo]");
    return demo && sichtbar(demo) ? { el: demo, ort: "demo" } : null;
  }
  const alle = Array.from(doc.querySelectorAll<HTMLElement>(`[${ZIEL_ATTRIBUT}="${zielName}"]`));
  const echt = alle.find((el) => !el.closest("[data-tutorial-demo]") && sichtbar(el));
  if (echt) {
    return { el: echt, ort: "echt" };
  }
  const demo = alle.find((el) => Boolean(el.closest("[data-tutorial-demo]")) && sichtbar(el));
  return demo ? { el: demo, ort: "demo" } : null;
}

/** Der Rahmen um das gezeigte Element — folgt ihm beim Scrollen und bei Grössenänderung. */
export function KlaraZeiger({ treffer }: { treffer: ZielTreffer | null }): JSX.Element | null {
  const { t } = useTranslation();
  const [rahmen, setRahmen] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!treffer) {
      setRahmen(null);
      return;
    }
    const messen = (): void => setRahmen(treffer.el.getBoundingClientRect());
    messen();
    const uhr = window.setInterval(messen, 250);
    document.addEventListener("scroll", messen, true);
    window.addEventListener("resize", messen);
    return () => {
      window.clearInterval(uhr);
      document.removeEventListener("scroll", messen, true);
      window.removeEventListener("resize", messen);
    };
  }, [treffer]);
  if (!treffer || !rahmen) {
    return null;
  }
  return (
    <div
      data-klara="1"
      data-testid="klara-zeiger"
      data-ort={treffer.ort}
      aria-hidden="true"
      title={t("klaravorschau.zeiger.label")}
      className="klara-zeiger pointer-events-none fixed z-[58]"
      style={{
        left: rahmen.left,
        top: rahmen.top,
        width: rahmen.width,
        height: rahmen.height,
      }}
    />
  );
}

const KNOPF =
  "inline-flex h-8 items-center rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Die Begleitkarte im Gespräch: Schritt, gerade gezeigter Teil, Steuerung, Fehlziel. */
export function KlaraTutorialKarte({
  lage,
  treffer,
  hinweis,
  onPause,
  onFortsetzen,
  onBeenden,
}: {
  lage: TutorialFernLage;
  treffer: ZielTreffer | null;
  hinweis: string | null;
  onPause: () => void;
  onFortsetzen: () => void;
  onBeenden: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const teil = lage.teilText ?? t("klaravorschau.tutorial.flaeche");
  const zielName = lage.zielName ?? t("klaravorschau.tutorial.flaeche");
  return (
    <section
      data-testid="klara-tutorial"
      data-schritt={lage.schrittId}
      aria-label={t("klaravorschau.tutorial.titel")}
      className="rounded-card border-2 border-brand/60 bg-page px-3 py-2.5"
    >
      <div className="text-[12px] font-semibold text-ink">{t("klaravorschau.tutorial.titel")}</div>
      <p
        data-testid="klara-tutorial-schritt"
        className="mt-1 text-[12.5px] font-semibold text-text"
      >
        {t("klaravorschau.tutorial.schritt", {
          nr: lage.schrittIndex + 1,
          gesamt: lage.schrittAnzahl,
          titel: lage.schrittTitel,
        })}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
        <span className="font-semibold">
          {lage.spielt ? t("klaravorschau.tutorial.laeuft") : t("klaravorschau.tutorial.steht")}
        </span>
        {" · "}
        {t("klaravorschau.tutorial.gerade", { teil })}
      </p>
      {treffer ? (
        <p data-testid="klara-tutorial-zeigt" className="mt-1 text-[12px] text-text">
          {t("klaravorschau.tutorial.zeigt", {
            teil,
            ort:
              treffer.ort === "echt"
                ? t("klaravorschau.tutorial.ortEcht")
                : t("klaravorschau.tutorial.ortDemo"),
          })}
        </p>
      ) : null}
      {treffer?.ort === "demo" && lage.zielName ? (
        <p
          data-testid="klara-tutorial-fehlziel"
          data-art="demo"
          className="mt-1 rounded-btn bg-ai-surface-2 px-2 py-1 text-[11.5px] leading-relaxed text-ai"
        >
          {t("klaravorschau.tutorial.fehlzielDemo", { ziel: teil })}
        </p>
      ) : null}
      {!treffer ? (
        <p
          data-testid="klara-tutorial-fehlziel"
          data-art="ganz"
          className="mt-1 rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] leading-relaxed text-trust-warn-text"
        >
          {t("klaravorschau.tutorial.fehlzielGanz", { ziel: zielName })}
        </p>
      ) : null}
      {hinweis ? (
        <output
          data-testid="klara-tutorial-hinweis"
          className="mt-1 block text-[11.5px] leading-relaxed text-muted-2"
        >
          {hinweis}
        </output>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {lage.spielt ? (
          <button
            type="button"
            data-testid="klara-tutorial-pause"
            onClick={onPause}
            className={KNOPF}
          >
            {t("klaravorschau.tutorial.pause")}
          </button>
        ) : (
          <button
            type="button"
            data-testid="klara-tutorial-fortsetzen"
            onClick={onFortsetzen}
            className={KNOPF}
          >
            {t("klaravorschau.tutorial.fortsetzen")}
          </button>
        )}
        <button
          type="button"
          data-testid="klara-tutorial-zurueck"
          disabled={lage.schrittIndex === 0}
          onClick={lage.zurueck}
          className={KNOPF}
        >
          {t("klaravorschau.tutorial.zurueck")}
        </button>
        <button
          type="button"
          data-testid="klara-tutorial-weiter"
          disabled={lage.schrittIndex >= lage.schrittAnzahl - 1}
          onClick={lage.weiter}
          className={KNOPF}
        >
          {t("klaravorschau.tutorial.weiter")}
        </button>
        <button
          type="button"
          data-testid="klara-tutorial-ende"
          onClick={onBeenden}
          className={KNOPF}
        >
          {t("klaravorschau.tutorial.begleitungEnde")}
        </button>
      </div>
    </section>
  );
}
