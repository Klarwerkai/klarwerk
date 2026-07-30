// ================================================================================================
// AUFTRAG-mega61 BLOCK B + D — DER HINWEIS UNTEN, UND WAS EINE ABLEHNUNG WIRKLICH BEDEUTET.
// ================================================================================================
//
// ZWEI PFLICHTEN IN EINER FLÄCHE: der Hinweis auf die Speicherung im Endgerät (§ 25 TDDDG) und die
// Information nach Artikel 50 Absatz 1 der KI-Verordnung, dass man mit einem KI-System arbeitet.
// Beide müssen beim ersten Kontakt kommen, beide sind kurz, und niemand will zweimal etwas
// wegklicken.
//
// DER WORTLAUT IST RECHTLICH BINDEND, UND ZWAR AN EINER STELLE, DIE MAN LEICHT ÜBERSIEHT: Die
// Wörter „Zustimmung" und „Einwilligung" kommen hier NICHT vor. Eine Auswahl, die man nicht
// folgenlos verweigern kann, wäre als Einwilligung unwirksam — sie sähe nur aus wie eine
// Rechtsgrundlage. Was hier stattfindet, ist eine KENNTNISNAHME, und genau so heißt es auch.
// Der Sammler tests/legal/mega61-banner-wortlaut.test.ts hält das über alle drei Sprachen fest.
//
// WARUM ER KEINE SPERRE IST: Nach der Orientierungshilfe der Aufsichtsbehörden ist praktisch alles,
// was diese Anwendung speichert, einwilligungsfrei (Sitzungscookie = Authentifizierung,
// Ansichtseinstellungen = Werte ohne Kennung, Offline-Warteschlange = Warenkorbfall). Der Banner
// muss also gar keine Einwilligung einholen. Er informiert — deshalb darf er unten stehen.
//
// WARUM ER LAYOUT-PLATZ NIMMT UND NICHT ÜBER DEM INHALT SCHWEBT: Ein `fixed`-Balken verdeckt
// Bedienelemente, und zwar genau die unteren — Speichern-Knöpfe, letzte Listenzeilen. Als echtes
// Geschwister der Inhaltsfläche verdeckt er nichts, auf keinem Gerät, ohne Ausgleichs-Polsterung,
// die irgendwann jemand vergisst.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type NoticeAck, authApi } from "../api/auth";
import { useFeatures } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { Button } from "../components/ui";
import { LEGAL_PATHS, useRechtsseitenAn } from "./LegalPages";

/**
 * AUFTRAG-mega61 Block D: der Merker, der den Grund über die Abmeldung hinweg trägt.
 *
 * `signOut()` lädt die Seite hart neu (AuthContext) — ohne diesen Merker stünde die Nutzerin danach
 * vor einer Anmeldemaske ohne Erklärung, und das wäre genau die Sackgasse, die der Auftrag
 * ausschließt. BEWUSST `sessionStorage` und kein zweiter Abmeldeweg: Der Abmeldeweg bleibt der eine
 * vorhandene. Der Merker lebt nur bis zum Schließen des Tabs und wird beim Lesen sofort gelöscht.
 */
export const DECLINE_MARKER = "kw_notice_declined";

export function takeDeclineMarker(): boolean {
  try {
    if (window.sessionStorage.getItem(DECLINE_MARKER) === null) {
      return false;
    }
    window.sessionStorage.removeItem(DECLINE_MARKER);
    return true;
  } catch {
    // Speicher gesperrt (privater Modus, Richtlinie) — kein Grund, irgendetwas kaputtgehen zu
    // lassen. Dann fehlt eben der erklärende Satz; die Abmeldung selbst ist davon unberührt.
    return false;
  }
}

function setDeclineMarker(): void {
  try {
    window.sessionStorage.setItem(DECLINE_MARKER, "1");
  } catch {
    // s. o. — bewusst folgenlos.
  }
}

/**
 * AUFTRAG-mega62 Block C: den Merker wieder wegnehmen, wenn das Abmelden NICHT durchkam.
 *
 * Der Merker muss VOR dem Abmelden gesetzt werden — das Abmelden lädt die Seite hart neu, danach
 * kommt kein Code dieser Fläche mehr zum Zug. Scheitert es aber, bliebe er liegen und würde beim
 * nächsten ganz anderen Anmeldevorgang den Satz „Ihre Sitzung wurde beendet, weil Sie dem Hinweis
 * nicht zugestimmt haben" zeigen — eine Erklärung für etwas, das nicht stattgefunden hat.
 */
function clearDeclineMarker(): void {
  try {
    window.sessionStorage.removeItem(DECLINE_MARKER);
  } catch {
    // s. o. — bewusst folgenlos.
  }
}

/** Der Schalter dieser Fläche. Vorgabe AN (Server), fail-closed solange die Auskunft fehlt. */
export function useHinweisbannerAn(): boolean {
  return useFeatures().data?.features?.hinweisbanner ?? false;
}

// ------------------------------------------------------------------------------------------------
// Der reine Text — ohne Knöpfe. Er steht auf der Anmeldemaske: dort beginnt die Datenerhebung, aber
// es gibt noch kein Konto, an dem man eine Kenntnisnahme vermerken könnte. Ein Knopf, der nichts
// vermerken kann, wäre eine Geste ohne Wirkung.
//
// AUFTRAG-mega62 BLOCK A — WARUM DERSELBE SCHALTER AUCH HIER LIEGT.
//
// Bis mega61 las nur der Banner die Schalterauskunft; dieser Textabsatz wurde auf der Anmeldemaske
// UNBEDINGT gerendert. Nach `KLARWERK_HINWEISBANNER=0` blieb der Inhalt auf dem Login also stehen —
// der Schalter war ein Notausschalter für die Hälfte seiner Fläche, und die Registry-Beschreibung
// („der Hinweisbanner unten") sagte etwas anderes als der Code tat.
//
// GEWÄHLTER WEG: EIN Schalter für BEIDE Flächen, nicht zwei Verträge. Der Grund ist derselbe, aus
// dem mega46 das Registry überhaupt gebaut hat: ein zweiter Schalter für dieselbe Pflichtangabe
// wäre ein zweiter Hebel, und zwei Hebel für eine Pflicht driften auseinander — spätestens dann,
// wenn jemand im Betrieb „den Hinweis" abschaltet und nur einer der beiden gemeint war. Der
// Schalter steht auf Vorgabe AN und reagiert ausschließlich auf ein ausdrückliches `0`/`false`
// (feature-flags.ts): Wer ihn umlegt, entscheidet bewusst über den GANZEN Hinweis, nicht über eine
// Hälfte, von der er nichts weiß.
//
// Die fail-closed-Richtung ist dieselbe wie beim Banner (`?? false` in useHinweisbannerAn): Solange
// die Auskunft nicht da ist, erscheint der Text nicht. Das ist bewusst und unverändert aus mega61 —
// ein Hinweis, der wegen einer Netzstörung flackert, wäre Lärm; die Pflicht wird beim nächsten
// erfolgreichen Laden erfüllt.
// ------------------------------------------------------------------------------------------------
export function NoticeText(): JSX.Element | null {
  const { t } = useTranslation();
  const an = useHinweisbannerAn();
  if (!an) {
    return null;
  }
  return (
    <div data-testid="notice-text" className="space-y-1.5 text-[12px] leading-relaxed text-muted">
      <p className="font-semibold text-text">{t("notice.banner.title")}</p>
      <p>{t("notice.banner.ai")}</p>
      <p>{t("notice.banner.cookie")}</p>
    </div>
  );
}

function NoticeLinks(): JSX.Element | null {
  const { t } = useTranslation();
  const rechtsseiten = useRechtsseitenAn();
  if (!rechtsseiten) {
    return null;
  }
  const cls =
    "rounded-btn underline underline-offset-2 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  return (
    <p className="text-[12px] text-muted">
      <a className={cls} href={LEGAL_PATHS.privacy}>
        {t("legal.footer.privacy")}
      </a>
      <span aria-hidden="true"> · </span>
      <a className={cls} href={LEGAL_PATHS.imprint}>
        {t("legal.footer.imprint")}
      </a>
    </p>
  );
}

// ------------------------------------------------------------------------------------------------
// Der Banner in der Anwendungshülle.
// ------------------------------------------------------------------------------------------------
export function NoticeBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const an = useHinweisbannerAn();
  const [ablehnen, setAblehnen] = useState(false);

  // Der Vermerk am Konto. `retry: false`: Antwortet der Server nicht, erscheint kein Banner — ein
  // Hinweis, der wegen einer Netzstörung erscheint, wäre nur Lärm, und die Pflicht wird beim
  // nächsten erfolgreichen Laden erfüllt.
  const vermerk = useQuery({
    queryKey: ["auth", "notice"],
    queryFn: authApi.notice,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const quittieren = useMutation({
    mutationFn: authApi.acknowledgeNotice,
    onSuccess: (data: NoticeAck) => {
      // Direkt in den Zwischenspeicher schreiben statt neu zu laden: Der Banner verschwindet
      // sofort, ohne dass zwischendurch „unbekannt" gilt und er kurz wiederkäme.
      queryClient.setQueryData(["auth", "notice"], data);
    },
  });

  if (!an || !vermerk.isSuccess || !vermerk.data.due) {
    return null;
  }

  return (
    <section
      data-testid="notice-banner"
      // `region` + Beschriftung: mit der Tastatur und mit Vorlesesoftware ansteuerbar, ohne dass
      // der Fokus irgendwohin gerissen wird — es ist eine Information, kein Dialog.
      aria-label={t("notice.banner.aria")}
      className="border-t border-hairline bg-hairline-soft px-4 py-3 sm:px-6"
    >
      {/* Die Höhenbegrenzung ist die mobile Zusage: der Text kann lang sein, die Fläche nicht.
          Nie mehr als 40 % der Bildschirmhöhe; was darüber hinausgeht, wird gescrollt statt die
          Anwendung zu verdrängen. */}
      <div className="mx-auto max-h-[40vh] w-full max-w-[900px] overflow-y-auto">
        {ablehnen ? (
          <div data-testid="notice-decline">
            <p className="text-[13px] font-semibold text-text">{t("notice.decline.title")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {t("notice.decline.body")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                data-testid="notice-decline-confirm"
                // AUFTRAG-mega62 Block C: der STRENGE Abmeldeweg. Bestätigt der Server die
                // Beendigung nicht, wird NICHT geräumt und NICHT weitergeleitet — stattdessen
                // sperrt `Gate` die geschützte Nutzung (SignOutBlocked). Der Bestandsaufruf in der
                // Kopfzeile bleibt davon unberührt; er hat eine andere, ebenfalls richtige Zusage.
                onClick={() => {
                  setDeclineMarker();
                  void signOut({ strict: true }).catch(() => {
                    // Der Fehlerzustand liegt in der Sitzungshaltung und wirkt dort. Hier bleibt
                    // nur, den Grund-Merker zurückzunehmen: Es wurde nichts beendet, also gibt es
                    // auch nichts zu erklären.
                    clearDeclineMarker();
                  });
                }}
              >
                {t("notice.decline.confirm")}
              </Button>
              <Button
                variant="ghost"
                data-testid="notice-decline-cancel"
                onClick={() => setAblehnen(false)}
              >
                {t("notice.decline.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <NoticeText />
              <NoticeLinks />
            </div>
            {/* Die Knöpfe stehen NICHT allein über Farbe auseinander: „Verstanden — weiter" ist die
                gefüllte Hauptaktion, „Nicht einverstanden" die umrandete — Form UND Beschriftung
                unterscheiden sie, nicht der Farbton. */}
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="primary"
                data-testid="notice-ack"
                disabled={quittieren.isPending}
                onClick={() => quittieren.mutate()}
              >
                {t("notice.banner.ack")}
              </Button>
              <Button
                variant="outline"
                data-testid="notice-decline-open"
                onClick={() => setAblehnen(true)}
              >
                {t("notice.banner.decline")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
