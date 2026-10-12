// produkt:20261010:assistenz-avatarzustaende — DIE BEWUSST GESTARTETE VORSCHAU DER NEUN ZUSTÄNDE.
//
// In der Avatar-Auswahl startet die Person je Motiv eine kurze Vorschau („Zustände ansehen“). Sie
// zeigt das Motiv nacheinander in allen neun Zuständen — mit derselben Darstellung wie die Figur
// (`.klara-figur` mit `data-stil`/`data-zustand`, Mimik nur für Motive mit Gesicht) und demselben
// Textstatus — und endet von selbst, per „Vorschau beenden“ (Fokus steht darauf; Enter oder
// Escape) oder sobald die Seite verborgen ist. Was sie zusichert:
//   · Sie ist als Vorschau erkennbar (Überschrift, gestrichelter Rahmen, Hinweis, `data-vorschau`).
//   · Sie meldet KEIN Ergebnis an die Figur (`meldeErgebnis` wird nicht gerufen), wählt kein Motiv,
//     speichert nichts und berührt weder Gespräch noch Aufgaben- oder Modellzustände.
//   · Bei reduzierter Bewegung (eigene Wahl oder System) bleibt jeder Zustand still; der Text bleibt.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type AssistenzAvatarMotiv, animationsStil } from "../../lib/assistenzAvatare";
import { AvatarBild } from "./AvatarBild";
import { AvatarMimik } from "./AvatarMimik";
import { ASSISTENZ_ZUSTAENDE, VORSCHAU_SCHRITT_MS, zustandsTextSchluessel } from "./ausdruck";

function systemReduziert(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AvatarZustandsVorschau({
  motiv,
  bewegungReduziert,
  onEnde,
}: {
  motiv: AssistenzAvatarMotiv;
  /** Die (noch ungespeicherte) Wahl „Bewegung reduzieren“ im Formular. */
  bewegungReduziert: boolean;
  /** Ende der Vorschau — `bewusst`: per Knopf oder Escape (dann kehrt der Fokus zurück). */
  onEnde: (bewusst: boolean) => void;
}): JSX.Element {
  const { t } = useTranslation();
  // Der Aufrufer montiert die Vorschau je Motiv neu (`key`) — sie beginnt dann von vorn.
  const [schritt, setSchritt] = useState(0);
  // Der jüngste Rückruf, ohne dass ein neues Rendern des Formulars den Takt zurücksetzt.
  const endeRef = useRef(onEnde);
  endeRef.current = onEnde;
  const beendenRef = useRef<HTMLButtonElement | null>(null);

  // Bewusst gestartet: der Fokus steht auf „Vorschau beenden“ — die Vorschau ist damit im Bild,
  // Enter oder Escape beenden sie, danach kehrt der Fokus zum Startknopf zurück.
  useEffect(() => {
    beendenRef.current?.focus();
  }, []);
  const zustand = ASSISTENZ_ZUSTAENDE[schritt] ?? "bereit";
  const gesamt = ASSISTENZ_ZUSTAENDE.length;
  const reduziert = bewegungReduziert || systemReduziert();
  const titel = t(`assistenz.avatar.name.${motiv.id}`);

  // Nächster Zustand nach VORSCHAU_SCHRITT_MS; nach dem neunten endet die Vorschau von selbst.
  useEffect(() => {
    const wecker = setTimeout(() => {
      if (schritt + 1 >= gesamt) {
        endeRef.current(false);
      } else {
        setSchritt(schritt + 1);
      }
    }, VORSCHAU_SCHRITT_MS);
    return () => clearTimeout(wecker);
  }, [schritt, gesamt]);

  // Verborgene Seite: keine unnötige Animation — die Vorschau endet.
  useEffect(() => {
    const beiSichtwechsel = (): void => {
      if (document.visibilityState === "hidden") {
        endeRef.current(false);
      }
    };
    document.addEventListener("visibilitychange", beiSichtwechsel);
    return () => document.removeEventListener("visibilitychange", beiSichtwechsel);
  }, []);

  const zustandText = t(zustandsTextSchluessel(zustand));
  return (
    <section
      data-testid="assistenz-zustandsvorschau"
      data-vorschau="true"
      data-avatar-vorschau={motiv.id}
      aria-label={t("assistenz.vorschau.titel", { motiv: titel })}
      className="flex flex-wrap items-center gap-3 rounded-card border-2 border-dashed border-hairline bg-surface p-2.5"
    >
      <span
        data-testid="assistenz-zustandsvorschau-figur"
        data-vorschau="true"
        data-zustand={zustand}
        data-fehlerart={zustand === "fehler" ? "technisch" : undefined}
        data-stil={animationsStil(motiv)}
        data-bewegung={bewegungReduziert ? "reduziert" : "standard"}
        className="klara-figur relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-hairline bg-page"
      >
        <AvatarBild
          motiv={motiv}
          alt=""
          ersatzBeschriftung=""
          width={96}
          height={96}
          className="klara-motiv pointer-events-none h-full w-full"
          ueberlagerung={
            <AvatarMimik
              motivId={motiv.id}
              zustand={zustand}
              bewegungReduziert={bewegungReduziert}
            />
          }
        />
      </span>
      <div className="min-w-0 flex-1 space-y-1 text-[12.5px] text-text">
        <p className="font-semibold">{t("assistenz.vorschau.titel", { motiv: titel })}</p>
        <output
          data-testid="assistenz-zustandsvorschau-text"
          data-zustand={zustand}
          className="block font-semibold"
        >
          {t("assistenz.vorschau.schritt", { nr: schritt + 1, gesamt, zustand: zustandText })}
        </output>
        <p className="text-[12px] text-muted">{t("assistenz.vorschau.hinweis")}</p>
        {reduziert ? (
          <p data-testid="assistenz-zustandsvorschau-ruhig" className="text-[12px] text-muted">
            {t("assistenz.vorschau.ruhig")}
          </p>
        ) : null}
        <button
          ref={beendenRef}
          type="button"
          data-testid="assistenz-zustandsvorschau-beenden"
          onClick={() => onEnde(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onEnde(true);
            }
          }}
          className="inline-flex h-8 items-center rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {t("assistenz.vorschau.beenden")}
        </button>
      </div>
    </section>
  );
}
