// ================================================================================================
// RECHERCHE:pmo-fea-0004 (aufnahme:20260922:gesamt-wochenupdate) — DAS WISSENSUPDATE FÜRS
// TEAMGESPRÄCH.
// ================================================================================================
//
// Originalwortlaut: „Ein wöchentliches Wissensupdate fasst neue Erkenntnisse für das Teamgespräch
// nachvollziehbar zusammen. Aufnahme und Ausgabeformat aus dem vorhandenen Nutzungskonzept
// konkretisieren; kein ungefragt eingerichteter Versand."
//
// PMO-FEA-0004 („Wissens-Update-Snippet") wurde am 02.07. in die Output Factory (T1-OUT-001)
// überführt (docs/qm/claude-after-report.md, KGURU-31). Deshalb wohnt das Update HIER und erbt
// deren Grenzen, statt eine zweite zu erfinden:
//   · nur VALIDIERTE Wissensobjekte (Anti-Fake-Guard wie `OutputService.generate`),
//   · nichts VERTRAULICHES (SCRUM-415, `isConfidential` wie `listEligible`),
//   · Herkunftsblock und Prüfhinweis aus `render.ts` — dieselben Sätze, kein zweiter Wortlaut.
//
// AUFNAHME — was als „neue Erkenntnis" zählt (Zeitraum = sieben Kalendertage bis einschließlich
// `bis`, UTC-Datum):
//   · NEU: das validierte Objekt wurde im Zeitraum erfasst (`createdAt`). Dieselbe Zeitachse wie
//     der Wochenverlauf der Analytics (`services/app/src/impact.ts`) und die Live-Wand.
//   · ÜBERARBEITET: vor dem Zeitraum erfasst, aber im Zeitraum eine neue Fassung (`history`,
//     Version > 1). Die jüngste Fassung im Zeitraum nennt das Datum.
// BENANNTE GRENZE: der Zeitpunkt der FREIGABE selbst steht nicht am Objekt. Ein Objekt, das vor
// dem Zeitraum erfasst und erst darin validiert wurde, ohne neue Fassung, erscheint deshalb nicht.
// Das Update behauptet keine Freigabezeit, die es nicht kennt.
//
// KEIN VERSAND: diese Datei kennt keinen Empfänger, keinen Zeitplan und keinen Seiteneffekt. Das
// Update entsteht nur, wenn jemand es abruft; teilen tut es der Mensch selbst (Kopieren/Download).
//
// PERSONEN: der Rumpf nennt keine Autorinnen und Autoren — ein wöchentlicher Überblick „wer hat wie
// viel beigetragen" wäre genau die Leistungsrangliste, die EK-19 ausschließt. Wer ein Objekt
// verantwortet, steht wie bei jedem Output nur im Herkunftsblock.
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import { OUTPUT_NO_CHECK_NOTE, renderProvenance, toProvenance } from "./render";
import { OutputError, type OutputProvenance, UNCERTAIN_TRUST_BELOW } from "./types";

/** Länge des Zeitraums in Kalendertagen (einschließlich `bis`). */
export const WOCHENUPDATE_TAGE = 7;

export const WOCHENUPDATE_TITEL = "Wissensupdate für das Teamgespräch";

/** Der Satz, der im Dokument selbst sagt, dass niemand es verschickt hat. */
export const WOCHENUPDATE_KEIN_VERSAND =
  "Auf Abruf erzeugt — Klarwerk verschickt dieses Update nicht. Ob und mit wem es geteilt wird, entscheidet, wer es abruft.";

export type WochenupdateArt = "neu" | "ueberarbeitet";

export interface WochenupdateEintrag {
  koId: string;
  title: string;
  art: WochenupdateArt;
  /** Erfassungstag (neu) bzw. Tag der jüngsten Fassung im Zeitraum (überarbeitet), YYYY-MM-DD. */
  am: string;
  version: number;
  uncertain: boolean;
}

export interface Wochenupdate {
  title: string;
  /** Erster und letzter Tag des Zeitraums (YYYY-MM-DD, beide einschließlich). */
  von: string;
  bis: string;
  generatedAt: string;
  eintraege: WochenupdateEintrag[];
  markdown: string;
  provenance: OutputProvenance[];
}

const TAG_MS = 24 * 60 * 60 * 1000;

/** Liest `bis` (YYYY-MM-DD) streng; ohne Angabe gilt der heutige UTC-Tag. */
export function leseWochenupdateBis(bis: unknown, jetzt: number): string {
  if (bis === undefined || bis === "") {
    return new Date(jetzt).toISOString().slice(0, 10);
  }
  if (typeof bis !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bis)) {
    throw new OutputError("BAD_REQUEST", "„bis“ muss ein Datum der Form JJJJ-MM-TT sein.");
  }
  const t = Date.parse(`${bis}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== bis) {
    throw new OutputError("BAD_REQUEST", `Kein gültiges Datum: ${bis}.`);
  }
  return bis;
}

function zeitraumVon(bis: string): string {
  return new Date(Date.parse(`${bis}T00:00:00Z`) - (WOCHENUPDATE_TAGE - 1) * TAG_MS)
    .toISOString()
    .slice(0, 10);
}

const tag = (iso: string): string => iso.slice(0, 10);

/** Reine Auswahl: welche Objekte gehören in das Update, und als was? */
export function waehleWochenupdate(
  kos: readonly KnowledgeObject[],
  von: string,
  bis: string,
): { ko: KnowledgeObject; eintrag: WochenupdateEintrag }[] {
  const imZeitraum = (iso: string): boolean => tag(iso) >= von && tag(iso) <= bis;
  const treffer: { ko: KnowledgeObject; eintrag: WochenupdateEintrag }[] = [];
  for (const ko of kos) {
    if (ko.status !== "validiert" || isConfidential(ko.confidentiality)) {
      continue;
    }
    const basis = {
      koId: ko.id,
      title: ko.title,
      version: ko.version,
      uncertain: ko.trust < UNCERTAIN_TRUST_BELOW,
    };
    if (imZeitraum(ko.createdAt)) {
      treffer.push({ ko, eintrag: { ...basis, art: "neu", am: tag(ko.createdAt) } });
      continue;
    }
    // Erfasst nach dem Zeitraum (bei einem `bis` in der Vergangenheit): gehört nicht hinein.
    if (tag(ko.createdAt) > bis) {
      continue;
    }
    const fassungen = (ko.history ?? [])
      .filter((h) => h.version > 1 && imZeitraum(h.at))
      .map((h) => tag(h.at))
      .sort();
    const juengste = fassungen[fassungen.length - 1];
    if (juengste) {
      treffer.push({ ko, eintrag: { ...basis, art: "ueberarbeitet", am: juengste } });
    }
  }
  // Je Abschnitt das Jüngste zuerst; bei gleichem Tag nach Titel — stabil und nachvollziehbar.
  return treffer.sort(
    (a, b) =>
      b.eintrag.am.localeCompare(a.eintrag.am) || a.eintrag.title.localeCompare(b.eintrag.title),
  );
}

function renderEintrag(ko: KnowledgeObject, e: WochenupdateEintrag, i: number): string {
  const kopf =
    e.art === "neu"
      ? `### ${i + 1}. ${ko.title}`
      : `### ${i + 1}. ${ko.title} (jetzt v${ko.version})`;
  const lines = [kopf, "", ko.statement];
  const punkte: string[] = [];
  if (ko.conditions.length > 0) {
    punkte.push(`- **Wann es gilt:** ${ko.conditions.join("; ")}`);
  }
  if (ko.measures.length > 0) {
    punkte.push(`- **Was zu tun ist:** ${ko.measures.join("; ")}`);
  }
  if (punkte.length > 0) {
    lines.push("", ...punkte);
  }
  const datum = e.art === "neu" ? `erfasst am ${e.am}` : `überarbeitet am ${e.am}`;
  const vorsicht = e.uncertain ? " · ⚠︎ niedriges Vertrauen" : "";
  lines.push("", `_${ko.category} · ${ko.type} · ${datum} · Trust ${ko.trust}${vorsicht}_`);
  return lines.join("\n");
}

export function renderWochenupdate(input: {
  von: string;
  bis: string;
  generatedAt: string;
  auswahl: readonly { ko: KnowledgeObject; eintrag: WochenupdateEintrag }[];
}): string {
  const neu = input.auswahl.filter((x) => x.eintrag.art === "neu");
  const ueberarbeitet = input.auswahl.filter((x) => x.eintrag.art === "ueberarbeitet");
  const parts = [
    `# ${WOCHENUPDATE_TITEL}`,
    "",
    `_Zeitraum: ${input.von} bis ${input.bis} · erzeugt am ${input.generatedAt} · ` +
      `${neu.length} neu validiert · ${ueberarbeitet.length} überarbeitet_`,
    "",
    OUTPUT_NO_CHECK_NOTE,
    "",
    `_${WOCHENUPDATE_KEIN_VERSAND}_`,
  ];
  if (input.auswahl.length === 0) {
    parts.push(
      "",
      "In diesem Zeitraum ist kein neues oder überarbeitetes validiertes Wissen hinzugekommen.",
    );
    return parts.join("\n");
  }
  if (neu.length > 0) {
    parts.push(
      "",
      "## Neu validiert",
      "",
      neu.map((x, i) => renderEintrag(x.ko, x.eintrag, i)).join("\n\n"),
    );
  }
  if (ueberarbeitet.length > 0) {
    parts.push(
      "",
      "## Überarbeitet",
      "",
      ueberarbeitet.map((x, i) => renderEintrag(x.ko, x.eintrag, i)).join("\n\n"),
    );
  }
  const offen = input.auswahl.filter((x) => x.eintrag.uncertain);
  if (offen.length > 0) {
    parts.push(
      "",
      "## Fürs Gespräch: noch unsicher",
      "",
      ...offen.map((x) => `- ${x.ko.title} (Trust ${x.ko.trust})`),
    );
  }
  parts.push("", renderProvenance(input.auswahl.map((x) => toProvenance(x.ko))));
  return parts.join("\n");
}

export interface WochenupdateServiceDeps {
  koService: KoService;
  now?: () => number;
}

/** Stateless wie `OutputService`: liest, schreibt nichts, verschickt nichts. */
export class WochenupdateService {
  private readonly koService: KoService;
  private readonly now: () => number;

  constructor(deps: WochenupdateServiceDeps) {
    this.koService = deps.koService;
    this.now = deps.now ?? (() => Date.now());
  }

  // R-1175: `sichtbar` ist die EINE Sichtbarkeitsentscheidung des Abrufenden
  // (`sichtbarkeitsfilterFuer`, von der Route über `OutputService.wochenupdate` gereicht). Sie
  // begrenzt die Grundmenge VOR der Auswahl — ein validiertes, nicht vertrauliches Objekt aus einem
  // fremden Space erscheint nicht mit Titel im Update. Ungesetzt (Dienstaufrufe ohne Betrachter)
  // bleibt die Auswahl die bisherige.
  async erzeuge(
    input: { bis?: unknown } = {},
    sichtbar: (ko: KnowledgeObject) => boolean = () => true,
  ): Promise<Wochenupdate> {
    const jetzt = this.now();
    const bis = leseWochenupdateBis(input.bis, jetzt);
    const von = zeitraumVon(bis);
    const generatedAt = new Date(jetzt).toISOString();
    const grundmenge = await this.koService.list({ status: "validiert" });
    const auswahl = waehleWochenupdate(
      grundmenge.filter((ko) => sichtbar(ko)),
      von,
      bis,
    );
    return {
      title: WOCHENUPDATE_TITEL,
      von,
      bis,
      generatedAt,
      eintraege: auswahl.map((x) => x.eintrag),
      markdown: renderWochenupdate({ von, bis, generatedAt, auswahl }),
      provenance: auswahl.map((x) => toProvenance(x.ko)),
    };
  }
}
