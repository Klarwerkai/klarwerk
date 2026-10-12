// produkt:20261010:assistenz-name-avatar — DIE ERSTEINRICHTUNG NACH DER ANMELDUNG.
//
// Erscheint, solange der SERVER für das angemeldete Konto keine abgeschlossene Einrichtung kennt
// (`einrichtungOffen`) — beim neuen Konto nach der ersten Anmeldung ebenso wie beim Bestandskonto
// beim ersten Einstieg nach Einführung. Der Abschluss steht am Konto, nicht in einem Cookie.
//
// BEWUSST KEIN MODALER DIALOG: die Fläche liegt wie der Nutzungshinweis als GESCHWISTER des
// Inhalts (`AppShell`), nimmt echten Platz und verdeckt kein Bedienelement. Sie beginnt als schmales
// Band mit der Frage „Wie soll deine Assistenz heißen?" und „Jetzt einrichten"; aufgeklappt zeigt sie
// Name, die dreizehn Motive und die Vorschau (höchstens 60 % der Höhe, darin scrollbar). Weder sie
// noch ein Speicherfehler machen die Anwendung unbenutzbar.
// „Später" blendet sie für diese Sitzung aus; abgeschlossen ist damit nichts — bei der nächsten
// Anmeldung wird sie wieder angeboten.
//
// EINE FLÄCHE NACH DER ANDEREN: Steht der Nutzungshinweis noch offen (`/api/auth/notice`, `due`),
// wartet die Einrichtung, bis er bestätigt ist — zwei Bänder übereinander nähmen gerade auf
// 390 × 844 dem Inhalt zu viel Platz. Dieselbe Abfrage wie der Hinweis, kein zweiter Abruf.
import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useFeatures } from "../../api/hooks";
import { useSession } from "../../app/AuthContext";
import {
  einrichtungSpaeter,
  ladeAssistenzProfil,
  merkeEinrichtungSpaeter,
  useAssistenzStand,
  verwerfeAssistenzProfil,
} from "../../lib/assistenzProfil";
import { Button } from "../ui";
import { AssistenzFormular } from "./AssistenzFormular";

/**
 * Hält den bestätigten Assistenzstand am angemeldeten Konto. Wechselt das Konto, wird der alte
 * Stand verworfen, BEVOR gezeichnet wird (Layout-Effekt) — kein fremder Name blitzt auf.
 */
export function AssistenzProfilLader(): null {
  const { user } = useSession();
  const kontoId = user?.id ?? null;
  useLayoutEffect(() => {
    if (kontoId === null) {
      verwerfeAssistenzProfil();
      return;
    }
    void ladeAssistenzProfil(kontoId);
  }, [kontoId]);
  return null;
}

/** `true`, solange der Nutzungshinweis Vorrang hat (Auskunft fehlt noch, oder er ist offen). */
function useHinweisHatVorrang(): boolean {
  const features = useFeatures();
  const an = features.data?.features?.hinweisbanner ?? false;
  const vermerk = useQuery({
    queryKey: ["auth", "notice"],
    queryFn: authApi.notice,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    enabled: an,
  });
  if (features.data === undefined && !features.isError) {
    return true;
  }
  if (!an) {
    return false;
  }
  return vermerk.isPending ? !vermerk.isError : vermerk.data?.due === true;
}

export function AssistenzEinrichtung(): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const stand = useAssistenzStand();
  const hinweisZuerst = useHinweisHatVorrang();
  // Auf der Profilseite steht dasselbe Formular unter „Meine Assistenz" — dort kein zweites.
  const aufProfil = useLocation().pathname === "/profil";
  const kontoId = user?.id ?? null;
  const [spaeter, setSpaeter] = useState(() => (kontoId ? einrichtungSpaeter(kontoId) : false));
  const [fertig, setFertig] = useState<string | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  // Zuerst ein schmales Band mit der Frage und „Jetzt einrichten" — es verdrängt den Inhalt kaum.
  // Ein Klick klappt Name, Motivauswahl und Vorschau an derselben Stelle auf.
  const [aufgeklappt, setAufgeklappt] = useState(false);

  const zuDiesemKonto = kontoId !== null && stand.kontoId === kontoId;
  const offen = zuDiesemKonto && stand.status === "bereit" && stand.antwort?.einrichtungOffen;

  if (kontoId === null || geschlossen || (spaeter && fertig === null)) {
    return null;
  }
  if (fertig === null && (!offen || hinweisZuerst || aufProfil)) {
    return null;
  }

  const ueberschriftId = "assistenz-einrichtung-titel";
  return (
    <section
      data-testid="assistenz-einrichtung"
      aria-labelledby={ueberschriftId}
      className="border-t border-hairline bg-hairline-soft px-4 py-3 sm:px-6"
    >
      <div
        className={`mx-auto w-full max-w-[900px] overflow-y-auto ${
          aufgeklappt && fertig === null ? "max-h-[60vh]" : "max-h-[40vh]"
        }`}
      >
        {fertig !== null ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id={ueberschriftId} className="sr-only">
              {t("assistenz.einrichtung.region")}
            </h2>
            {/* `<output>` trägt die Rolle „status“ von Haus aus: die Bestätigung wird angesagt. */}
            <output
              data-testid="assistenz-einrichtung-fertig"
              className="block text-[13px] text-text"
            >
              {fertig}
            </output>
            <Button
              variant="outline"
              data-testid="assistenz-einrichtung-schliessen"
              onClick={() => setGeschlossen(true)}
            >
              {t("assistenz.einrichtung.schliessen")}
            </Button>
          </div>
        ) : !aufgeklappt ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 id={ueberschriftId} className="text-[14px] font-semibold text-ink">
                {t("assistenz.einrichtung.frage")}
              </h2>
              <p className="text-[12.5px] leading-relaxed text-muted">
                {t("assistenz.einrichtung.kurz")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="primary"
                data-testid="assistenz-einrichtung-starten"
                onClick={() => setAufgeklappt(true)}
              >
                {t("assistenz.einrichtung.starten")}
              </Button>
              <Button
                variant="ghost"
                data-testid="assistenz-einrichtung-spaeter"
                title={t("assistenz.einrichtung.spaeterHinweis")}
                onClick={() => {
                  merkeEinrichtungSpaeter(kontoId);
                  setSpaeter(true);
                }}
              >
                {t("assistenz.einrichtung.spaeter")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h2 id={ueberschriftId} className="text-[15px] font-semibold text-ink">
                {t("assistenz.einrichtung.frage")}
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {t("assistenz.einrichtung.intro")}
              </p>
            </div>
            <AssistenzFormular
              autoFokus
              modus="einrichtung"
              onGespeichert={(antwort) =>
                setFertig(
                  t("assistenz.einrichtung.fertig", {
                    name: antwort.profil?.name ?? t("assistenz.neutral.name"),
                  }),
                )
              }
              onAbbrechen={() => {
                merkeEinrichtungSpaeter(kontoId);
                setSpaeter(true);
              }}
              zusatzKnoepfe={
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="assistenz-einrichtung-spaeter"
                  title={t("assistenz.einrichtung.spaeterHinweis")}
                  onClick={() => {
                    merkeEinrichtungSpaeter(kontoId);
                    setSpaeter(true);
                  }}
                >
                  {t("assistenz.einrichtung.spaeter")}
                </Button>
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
