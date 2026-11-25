import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useKiLage } from "../api/hooks";
import { useRoleOptional } from "../app/RoleContext";
import { kiLageAnzeige } from "../lib/kiLageAnzeige";
import { formatKoTimestamp } from "../lib/koDates";

// ================================================================================================
// R-0599 (Ben nacharbeit-2) · DIE KI-LAGE IN DER KOPFZEILE — DAUERHAFT, FÜR JEDE ROLLE.
// ================================================================================================
//
// WO SIE STEHT, UND WARUM GENAU DORT. Die Zeile des Kopfbands ist an ihren engen Breiten
// ausgemessen (JOB 3641: 0,0 px frei bei 1000 px; `kopfbandStufe.ts` stuft die rechte Gruppe nach
// Messung zurück). Ein weiteres Flex-Kind nähme Breite UND eine Fuge weg und schöbe genau die
// gemessenen Griffe hinaus. Diese Anzeige liegt deshalb NICHT im Fluss der Zeile, sondern absolut
// im unteren Rand des Kopfbands (rechts, unter Zahnrad und Konto): dort ist das 56 px hohe Band
// frei, weil alle Griffe vertikal mittig stehen und höchstens 36 px hoch sind. Sie kostet die Zeile
// keine Breite, ist in ihrer eigenen Breite begrenzt (`max-w-[45%]`, gekürzt mit „…") und kann
// deshalb nichts aus dem Band schieben.
//
// WAS SIE SAGT: sichtbar Modus und Anbieter („KI: extern · ChatGPT (OpenAI)" / „KI: Server des
// Betreibers" / „Keine KI · regelbasiert"); im Zeigehinweis und für Vorlesewerkzeuge zusätzlich
// Betriebsort und Datenfluss, Herkunft mit Nachweisstufe und die offenen Prüfungen.
export function KiLageZeile(): JSX.Element {
  const { t, i18n } = useTranslation();
  const rolle = useRoleOptional();
  const { data: letzteLage, isError } = useKiLage();
  const data = isError ? undefined : letzteLage;
  const darfPruefen = rolle?.isSessionRole && rolle.role === "admin" && data?.anbieter;
  const anzeige = kiLageAnzeige(data);
  // Ben nacharbeit-7: die bekannte Erreichbarkeit gehört zum sichtbaren Satz, nicht nur in den
  // Zeigehinweis — „KI: extern · ChatGPT (OpenAI) · antwortet" ist eine andere Auskunft als
  // „… · Erreichbarkeit noch nicht bestätigt".
  const zeit = formatKoTimestamp(
    data?.zuletztBestaetigtAm,
    i18n.language === "en" ? "en-GB" : i18n.language,
  );
  const verfuegbarkeit =
    zeit && data?.verfuegbarkeit !== "unerreichbar"
      ? t("kilage.verbindung.bestaetigt", { zeit })
      : anzeige.verfuegbarkeitKey && t(anzeige.verfuegbarkeitKey);
  const kurz = [t(anzeige.textKey, anzeige.params), verfuegbarkeit].filter(Boolean).join(" · ");
  const herkunft = anzeige.herkunft
    ? t(anzeige.herkunft.key, {
        land: anzeige.herkunft.landKey ? t(anzeige.herkunft.landKey) : anzeige.herkunft.landCode,
      })
    : null;
  const hinweis = [kurz, ...anzeige.hinweisKeys.map((key) => t(key)), herkunft]
    .filter(Boolean)
    .join(" — ");
  return (
    <div className="kw-kopfband-ki-lage absolute bottom-px right-8 flex max-w-[45%] items-center gap-2 whitespace-nowrap text-klein leading-[10px] text-hairline">
      <output
        data-testid="kopfband-ki-lage"
        aria-label={hinweis}
        title={hinweis}
        className="flex min-w-0 items-center gap-1"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            anzeige.ton === "warn" ? "bg-trust-warn-fill" : "bg-muted-2"
          }`}
        />
        {/* `min-w-0`: der Satz schrumpft und kürzt mit „…" IN seinem Kasten — so ragt die Zeile nie
          über ihren eigenen Rand, den `kopfbandStufe.ts` an jedem Kind des Bands nachmisst. */}
        <span className="min-w-0 truncate">{kurz}</span>
      </output>
      {darfPruefen && <Verbindungstest key={darfPruefen} />}
    </div>
  );
}

function Verbindungstest(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const test = useMutation({
    mutationFn: () => endpoints.reasoner.test("antwort"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["reasoner", "status", "kiLage"] }),
  });
  return (
    <>
      <button
        type="button"
        className="shrink-0 underline underline-offset-2 focus-visible:outline"
        disabled={test.isPending}
        onClick={() => test.mutate()}
      >
        {t(test.isPending ? "kilage.verbindung.laufend" : "kilage.verbindung.test")}
      </button>
      {test.isError && (
        <span role="alert" className="min-w-0 truncate" title={t("kilage.verbindung.fehler")}>
          {t("kilage.verbindung.fehler")}
        </span>
      )}
    </>
  );
}
