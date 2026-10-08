import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../api/types";
import {
  type KiPruefzustand,
  aiCheckCoverageComplete,
  kiPruefzustand,
} from "../../lib/aiCheckStatusCard";
import type { NameResolver } from "../../lib/koAuthor";
import { formatKoTimestamp } from "../../lib/koDates";

// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-0228 — DIE VERIFIZIERUNGSMARKE AM WISSENSOBJEKT.
// ================================================================================================
//
// Eine Marke, zwei Zeilen, direkt unter dem Kopf des Eintrags — nicht in einem zugeklappten
// Abschnitt: wer prüfte fachlich und wann (aus dem Server, services/app/src/verifizierungsmarke.ts)
// und was der maschinelle Prüflauf geleistet hat (aus `aiCheck`, mit der vorhandenen Regel
// `kiPruefzustand` und `aiCheckCoverageComplete` — keine zweite Fassung davon).
//
// Präsentational wie die übrigen Bauteile unter `trust/`: Namen kommen als aufgelöster
// `NameResolver` herein (`useAuthorName`, dieselbe Leseregel wie jede Autorenzeile).
//
// FEHLT ETWAS, STEHT ES DA: kein Verweis → „Fachliche Prüfung nicht belegt" (Nacharbeit 5, Ben:
// Altbestand trägt keinen Verweis, auch wenn er validiert ist — fehlender Beleg ist nicht
// „nicht geprüft"; die Validierenden stehen getrennt daneben); Verweis ohne passenden
// Beleg → „nicht auffindbar"; Protokoll nicht lesbar → „nicht abrufbar"; Feld fehlt in dieser
// Antwort → „nicht geladen"; kein KI-Lauf → „keine erfasst"; Lauf ohne Abdeckungsprotokoll →
// „Umfang nicht protokolliert". Nie wird aus einem Fehlen ein „geprüft".

/** Die Texte der KI-Zustände — dieselben Schlüssel, die das Prüfbrett-Kennzeichen benutzt. */
const KI_TEXT: Record<KiPruefzustand, string> = {
  ausstehend: "pruefstatus.ki.ausstehend",
  laeuft: "val.aiCheck.pending",
  geprueft: "pruefstatus.ki.geprueft",
  konflikt: "pruefstatus.ki.konflikt",
  unsicher: "pruefstatus.ki.unsicher",
  nicht_verfuegbar: "pruefstatus.ki.nichtVerfuegbar",
  fehlgeschlagen: "val.aiCheck.failed",
  ueberholt: "pruefbasis.ueberholt",
};

export interface VerifizierungsmarkeProps {
  ko: Pick<KnowledgeObject, "verifizierung" | "aiCheck">;
  nameOf: NameResolver;
}

export function Verifizierungsmarke({ ko, nameOf }: VerifizierungsmarkeProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const zeit = (iso: string | null | undefined): string =>
    formatKoTimestamp(iso, i18n.language) ?? t("verifizierung.zeitUnbekannt");

  const zeilen: { schluessel: string; text: string }[] = [];

  // --- Mensch ------------------------------------------------------------------------------------
  const v = ko.verifizierung;
  if (!v) {
    zeilen.push({ schluessel: "nicht_erhoben", text: t("verifizierung.mensch.nichtErhoben") });
  } else if (v.mensch.stand === "belegt") {
    const m = v.mensch;
    let text = t(`verifizierung.mensch.${m.art}`, {
      name: nameOf(m.pruefer),
      zeit: zeit(m.zeitpunkt),
    });
    if (m.fassung === null) {
      text += ` ${t("verifizierung.mensch.fassungUnbekannt")}`;
    } else if (!m.aktuell) {
      text += ` ${t("verifizierung.mensch.fruehereFassung", { fassung: m.fassung })}`;
    }
    zeilen.push({ schluessel: "belegt", text });
  } else {
    const SCHLUESSEL = {
      nicht_belegt: "verifizierung.mensch.nichtBelegt",
      nicht_auffindbar: "verifizierung.mensch.nichtAuffindbar",
      nicht_abrufbar: "verifizierung.mensch.nichtAbrufbar",
    } as const;
    zeilen.push({ schluessel: v.mensch.stand, text: t(SCHLUESSEL[v.mensch.stand]) });
  }
  if (v && v.validiertVon.length > 0) {
    zeilen.push({
      schluessel: "validiert_von",
      text: t("verifizierung.validiertVon", { namen: v.validiertVon.map(nameOf).join(", ") }),
    });
  }

  // --- Maschine ----------------------------------------------------------------------------------
  const zustand = kiPruefzustand(ko.aiCheck);
  const ki: string[] = [];
  if (zustand === null || !ko.aiCheck) {
    ki.push(t("verifizierung.ki.keine"));
  } else {
    ki.push(t(KI_TEXT[zustand]));
    if (ko.aiCheck.status === "done") {
      if (ko.aiCheck.finishedAt) {
        ki.push(t("verifizierung.ki.am", { zeit: zeit(ko.aiCheck.finishedAt) }));
      }
      const deckung = ko.aiCheck.coverage;
      ki.push(
        !deckung
          ? t("verifizierung.ki.umfangUnbekannt")
          : aiCheckCoverageComplete(deckung)
            ? t("verifizierung.ki.vollstaendig")
            : t("verifizierung.ki.unvollstaendig", {
                completed: deckung.completed,
                available: deckung.available,
              }),
      );
    }
  }

  return (
    <section
      data-testid="ko-verifizierungsmarke"
      aria-label={t("verifizierung.titel")}
      className="text-[12px] text-muted"
    >
      {zeilen.map((z) => (
        <p key={z.schluessel} data-testid={`ko-verifizierung-${z.schluessel}`}>
          {z.text}
        </p>
      ))}
      <p data-testid="ko-verifizierung-ki" data-ki-pruefzustand={zustand ?? "keine"}>
        {`${t("verifizierung.ki.titel")}: ${ki.join(" · ")}`}
      </p>
    </section>
  );
}
