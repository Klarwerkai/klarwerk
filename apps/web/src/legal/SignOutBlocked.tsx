// ================================================================================================
// AUFTRAG-mega62 BLOCK C — WAS PASSIERT, WENN DIE ABLEHNUNG NICHT DURCHKOMMT.
// ================================================================================================
//
// Der Klick auf „Sitzung jetzt beenden" benutzt den strengen Abmeldeweg (AuthContext). Bestätigt
// der Server die Beendigung nicht — Netzstörung, 500, Zeitüberschreitung —, dann ist die Sitzung
// womöglich noch da. Bis mega61 wurde in genau diesem Fall trotzdem geräumt und hart neu geladen;
// nach dem Neuladen stand die Nutzerin wieder angemeldet in der Anwendung, obwohl sie gerade „Nicht
// einverstanden" bestätigt hatte. Eine Ablehnung, die nichts bewirkt, ist schlimmer als keine
// Ablehnungsmöglichkeit.
//
// DIESE FLÄCHE IST DIE EHRLICHE ANTWORT DARAUF, und sie tut genau zwei Dinge:
//   1. Sie sagt, was WIRKLICH ist — die Sitzung ist nicht bestätigt beendet.
//   2. Sie lässt nichts Geschütztes mehr durch, bis der Server die Beendigung bestätigt.
//
// AUFTRAG-mega64 BLOCK B — KORREKTUR EINER BEGRÜNDUNG, NICHT NUR EINES FEHLERS.
//
// Hier stand bis mega63: „SIE IST AUSDRÜCKLICH KEIN WIEDERHOLUNGSMECHANISMUS. Kein Zeitgeber, kein
// Hintergrundversuch, keine Warteschlange — nur ein Knopf, den die Nutzerin drückt, und die Wahrheit
// dazwischen. Ein automatischer Nachholer wäre wieder eine Zusage, die niemand beobachtet."
//
// Für eine TAB-LOKALE Sperre war das vertretbar: sie endete mit dem Tab, also endete auch das
// Warten. Seit mega64 überdauert der Zustand Tabs und Neuladen — er ist eine SCHULD gegenüber dem
// Server, nicht eine Eigenschaft dieses Tabs. Damit kippt die Begründung: Ohne Nachholer hinge das
// Ende einer tabübergreifenden, neuladefesten Sperre daran, dass jemand diesen Knopf findet und
// drückt. Ein Vorgang, dessen Ende von einem Zufall abhängt, ist keiner.
//
// Der Nachholer lebt deshalb ab mega64 in `app/AuthContext.tsx` — bei den zwei Ereignissen, die
// „der Server ist vielleicht wieder da" bedeuten (Netz zurück, Tab wieder sichtbar), und
// zusätzlich beim bewiesenen 401 auf `/auth/me`. Kein Zeitgeber; der Teil des alten Satzes gilt
// weiter. Dieser Knopf bleibt der Weg für die Nutzerin, die nicht warten will.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "../app/AuthContext";
import { Button } from "../components/ui";

export function SignOutBlocked(): JSX.Element {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const [laeuft, setLaeuft] = useState(false);
  const [erneutGescheitert, setErneutGescheitert] = useState(false);

  const nochmal = (): void => {
    setLaeuft(true);
    setErneutGescheitert(false);
    void signOut({ strict: true })
      .catch(() => {
        // Der Sperrzustand liegt schon in der Sitzungshaltung; hier bleibt nur die Rückmeldung,
        // dass auch dieser Versuch nichts geändert hat. Ohne sie wirkte der Knopf tot.
        setErneutGescheitert(true);
      })
      .finally(() => setLaeuft(false));
  };

  return (
    <div
      data-testid="signout-blocked"
      // `alert`: Vorlesesoftware meldet die Fläche von selbst — sie erscheint, ohne dass die
      // Nutzerin irgendwohin navigiert wäre, und sie ist der einzige Inhalt der Seite.
      role="alert"
      className="grid h-full place-items-center bg-page p-6"
    >
      <div className="w-full max-w-[520px] rounded-card border border-trust-warn-fill/30 bg-trust-warn-bg p-5 text-trust-warn-text">
        <h1 className="text-[17px] font-semibold">{t("notice.signOutFailed.title")}</h1>
        <p className="mt-2 text-[13px] leading-relaxed">{t("notice.signOutFailed.body")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            data-testid="signout-blocked-retry"
            disabled={laeuft}
            onClick={nochmal}
          >
            {t("notice.signOutFailed.retry")}
          </Button>
          {erneutGescheitert ? (
            <span data-testid="signout-blocked-again" className="text-[12.5px]">
              {t("notice.signOutFailed.again")}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
