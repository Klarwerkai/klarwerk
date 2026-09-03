import { useTranslation } from "react-i18next";
import { type CaptureHelpId, captureHelp } from "../lib/captureHelp";

// ================================================================================================
// JOB 3029 (U1) — DER UNTERSCHIED DER ZWEI KNÖPFE STEHT AUF DER FLÄCHE, NICHT IM FRAGEZEICHEN.
// ================================================================================================
//
// DER BEFUND (Natascha, Erstnutzerlauf, `OFFEN.md:124`): „nicht ersichtlich warum es die Trennung
// gibt … was mit dem Objekt danach möglich ist, blieb unklar." Die Auskunft war da — dreisprachig
// und von Pedi abgenommen (SCRUM-407) — aber nur hinter `<HelpTip>`. Ein Fragezeichen erreicht nur,
// wer die Frage schon hat; wer nicht weiß, dass es einen Unterschied gibt, klickt es nie.
//
// DIE BAUFORM IST NICHT NEU. Genau dieselbe Hürde hat AUFTRAG-BASIC-u2 an der Bibliothekssuche
// geschlossen: nicht mit einem Popover, sondern mit sichtbarem Text DIREKT an der Fläche
// (`pages/Library.tsx:741-754`). Dieser Block überträgt sie auf die Erfassen-Entscheidung.
//
// ES ENTSTEHT KEIN EINZIGER NEUER SATZ. Titel und Text kommen unverändert und vollständig aus
// `lib/captureHelp` → `i18n` (`chelp.saveDraftHelp.*`, `chelp.submitReview.*`). Keine Kürzung,
// keine Zusammenfassung, kein Zerschneiden — jede eigene Formulierung wäre ein Satz ohne
// Übersetzung. Damit trägt der Block auch keine Aussage über Daten: keine Query, kein Serverwert,
// kein Zeitbezug. Er steht in jeder Lage gleich und wartet auf nichts.
//
// ER LÖST DIE POPOVER AB, er steht nicht daneben: die vier `<HelpTip>` an genau diesen Knöpfen
// (`pages/Capture.tsx`, Erzähl-Schritt, Expertenkarte, Aktionsleiste) sind entfernt. Es darf keinen
// zweiten Weg zu derselben Auskunft geben.

export interface KnopfUnterschiedEintrag {
  /** Das Hilfe-Thema, aus dem Titel und Text kommen. */
  readonly id: CaptureHelpId;
  /**
   * Der i18n-Schlüssel des Knopfes, zu dem diese Erklärung gehört.
   *
   * Er steht hier, weil die Zuordnung „welcher Knopf wird hier erklärt" sonst nirgends geschrieben
   * stünde — sie läge allein in der Reihenfolge zweier Absätze. So ist sie eine prüfbare Zusage
   * (`tests/erstnutzer-u1/knopf-unterschied.test.tsx`, U1(1)): der erklärte Knopf muss in jeder
   * Sprache beschriftet sein, in der der Block läuft.
   */
  readonly knopfKey: string;
}

/** Erst der Entwurf, dann das Einreichen — dieselbe Reihenfolge wie die Entscheidung selbst. */
export const KNOPF_UNTERSCHIED: readonly KnopfUnterschiedEintrag[] = [
  { id: "saveDraftHelp", knopfKey: "capture.saveDraft" },
  { id: "submitReview", knopfKey: "capture.submit" },
];

export function KnopfUnterschied(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="u1-knopfunterschied"
      className="mb-3 space-y-2 rounded-card border border-hairline bg-page p-3 text-[12px] leading-relaxed text-muted"
    >
      {KNOPF_UNTERSCHIED.map(({ id }) => {
        const topic = captureHelp(id);
        return (
          <p key={id} data-testid={`u1-knopfunterschied-${id}`}>
            <span className="font-semibold text-ink">{t(topic.titleKey)}</span> {t(topic.bodyKey)}
          </p>
        );
      })}
    </div>
  );
}
