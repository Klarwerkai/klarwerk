import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../api/types";
import {
  type KiPruefzustand,
  aiCheckCoverageComplete,
  kiPruefzustand,
} from "../../lib/aiCheckStatusCard";
import type { NameResolver } from "../../lib/koAuthor";
import { formatKoTimestamp } from "../../lib/koDates";
import { Button } from "../ui";

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
  ko: Pick<KnowledgeObject, "verifizierung" | "aiCheck"> &
    Partial<Pick<KnowledgeObject, "weisung" | "externeFreigabe" | "version" | "geschlossen">>;
  nameOf: NameResolver;
  /**
   * Entscheidung 19: nur gesetzt, wenn die angemeldete Person die benannte Verantwortliche einer
   * noch offenen Sichtung ist — dann steht der Knopf „Als gesichtet bestätigen" an der Marke.
   * Ob sie es wirklich darf, entscheidet der Server (`weisung-sichten`).
   */
  aufSichten?: () => void;
  sichtenLaeuft?: boolean;
}

/** Ein reines Datum (`JJJJ-MM-TT`) ohne Uhrzeit anzeigen; sonst Datum + Uhrzeit. */
function datumOderZeit(iso: string, sprache: string, ersatz: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
      return ersatz;
    }
    // Dieselbe Form wie `formatKoTimestamp` (zweistellig), in UTC: ein Kalendertag hat keine Zone.
    return new Date(ms).toLocaleDateString(sprache, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return formatKoTimestamp(iso, sprache) ?? ersatz;
}

export function Verifizierungsmarke({
  ko,
  nameOf,
  aufSichten,
  sichtenLaeuft,
}: VerifizierungsmarkeProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const zeit = (iso: string | null | undefined): string =>
    formatKoTimestamp(iso, i18n.language) ?? t("verifizierung.zeitUnbekannt");
  const datum = (iso: string): string =>
    datumOderZeit(iso, i18n.language, t("verifizierung.zeitUnbekannt"));

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

  // --- Weisung (Entscheidungen 18/19) ------------------------------------------------------------
  // Die befugte Herkunft und die nachfolgende Sichtung stehen unmittelbar an der Marke — wer weisen
  // durfte, für welchen Bereich, und ob die zuständige Sichtung offen, überfällig oder erledigt ist.
  const w = ko.weisung;
  let sichtungOffen = false;
  if (w) {
    let gesetzt = t("weisung.marke.gesetzt", {
      name: nameOf(w.von),
      zeit: zeit(w.am),
      bereich: w.bereich,
    });
    if (ko.version !== undefined && w.fassung !== ko.version) {
      gesetzt += ` · ${t("weisung.marke.fruehereFassung", { fassung: w.fassung })}`;
    }
    if (w.bestehenGelassen.length > 0) {
      gesetzt += ` · ${t("weisung.marke.bestehenGelassen", { count: w.bestehenGelassen.length })}`;
    }
    zeilen.push({ schluessel: "weisung", text: gesetzt });
    const s = w.sichtung;
    if (s.gesichtetAm) {
      let text = t("weisung.marke.gesichtet", {
        name: nameOf(s.gesichtetVon ?? s.verantwortlich),
        zeit: zeit(s.gesichtetAm),
      });
      if (s.vermerk) {
        text += ` · ${t("weisung.marke.vermerk", { vermerk: s.vermerk })}`;
      }
      zeilen.push({ schluessel: "sichtung", text });
    } else {
      sichtungOffen = true;
      const fristMs = Date.parse(s.frist) + (/^\d{4}-\d{2}-\d{2}$/.test(s.frist) ? 86_400_000 : 0);
      const ueberfaellig = !Number.isNaN(fristMs) && fristMs <= Date.now();
      const satz = ueberfaellig
        ? "weisung.marke.sichtungUeberfaellig"
        : "weisung.marke.sichtungOffen";
      zeilen.push({
        schluessel: "sichtung",
        text: t(satz, { name: nameOf(s.verantwortlich), frist: datum(s.frist) }),
      });
    }
  }

  // --- Durch Weisung überstimmt (R-0573, Nacharbeit 11) -------------------------------------------
  if (ko.geschlossen) {
    zeilen.push({
      schluessel: "geschlossen",
      text: t("weisung.geschlossen.hinweis", { zeit: zeit(ko.geschlossen.am) }),
    });
  }

  // --- Externe Freigabe (Entscheidung 27) --------------------------------------------------------
  const e = ko.externeFreigabe;
  if (e) {
    const teile = [
      t("weisung.extern.freigabe", { herausgeber: e.herausgeber, datum: datum(e.freigegebenAm) }),
    ];
    if (e.freigegebenVon) {
      teile.push(t("weisung.extern.von", { von: e.freigegebenVon }));
    }
    if (e.freigabeKennung) {
      teile.push(t("weisung.extern.kennung", { kennung: e.freigabeKennung }));
    }
    if (e.nachweis) {
      teile.push(t("weisung.extern.nachweis", { nachweis: e.nachweis }));
    }
    if (e.art === "referenz") {
      teile.unshift(t("weisung.extern.referenz"));
    }
    zeilen.push({ schluessel: "extern", text: teile.join(" · ") });
    zeilen.push({
      schluessel: "extern_bestaetigt",
      text: t("weisung.extern.bestaetigt", {
        name: nameOf(e.bestaetigtVon),
        zeit: zeit(e.bestaetigtAm),
        geltung: e.geltung,
        zustaendig: nameOf(e.zustaendig),
      }),
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
      {sichtungOffen && aufSichten ? (
        <Button
          variant="outline"
          data-testid="ko-weisung-sichten"
          disabled={sichtenLaeuft === true}
          onClick={aufSichten}
          className="mt-1"
        >
          {t("weisung.marke.sichten")}
        </Button>
      ) : null}
    </section>
  );
}
