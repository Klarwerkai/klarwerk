// ================================================================================================
// WISSENS-VERMÄCHTNIS-BUCH — die Beiträge EINER Person als Buch (R-1642 / R-2175).
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensvermaechtnis`. Originalwortlaut (Funktions-Roadmap 5.4):
// „Wenn jemand in Rente geht, generiert KLARWERK auf Knopfdruck ein gedrucktes oder digitales
// Wissens-Vermächtnis-Buch mit allen seinen Beiträgen — als Würdigung."
//
// WAS HIER ENTSTEHT. Ein Markdown-Buch: Vorwort mit Namen, Inhaltsverzeichnis nach Themen, eine
// Zeitleiste je Jahr (der biografische Weg) und je Thema ein Kapitel mit den Beiträgen in der
// Reihenfolge, in der die Person sie festgehalten hat (der thematische Weg). Darunter der
// Herkunftsblock mit Kennung, Fassung und Autor je Beitrag. Gedruckt wird es über den Druckdialog
// des Browsers, digital als `.md`-Datei — beides in der Kontokarte (`VermaechtnisBuch.tsx`).
//
// WAS EIN BEITRAG IST: jedes Wissensobjekt, dessen ursprünglicher ODER heutiger Autor die Person
// ist. Eine Autorenübergabe (`transfer-author`) nimmt der Person ihren Beitrag also nicht aus dem
// Buch; die Hauptverantwortung (`ownership.owner`) spielt hier keine Rolle — wer verantwortet, hat
// den Beitrag nicht geschrieben.
//
// WAS NICHT HINEINGEHT, und warum — gezählt, nie still verschluckt (`ausgelassen`):
//   · im Papierkorb        — gelöschtes Wissen ist kein Vermächtnis;
//   · nicht einsehbar      — der Handelnde darf es nicht lesen (`darfSehen` des Aufrufers);
//   · vertraulich          — ein Buch wird gedruckt und weitergegeben, wie jeder Output
//                            (SCRUM-415, `service.ts`);
//   · nicht validiert      — dieselbe Quellenregel wie die Output Factory: nur geprüftes Wissen.
// Jeder Beitrag zählt genau einmal, in dieser Reihenfolge.
//
// REIN: keine Persistenz, keine KO-Mutation, kein Zugriff auf Konten. Namen und Sichtbarkeit
// reicht der Aufrufer herein (`services/app/src/routes/verantwortung-routes.ts`).
import { type KnowledgeObject, isConfidential } from "../../knowledge-object";
import { OUTPUT_NO_CHECK_NOTE, toProvenance } from "./render";
import type { OutputProvenance } from "./types";

export const VERMAECHTNIS_OHNE_THEMA = "Ohne Kategorie";

const WUERDIGUNG =
  "Es bleibt im Unternehmen und wirkt weiter — und jeder Beitrag trägt den Namen der Person, die ihn geschrieben hat.";

export interface VermaechtnisEingabe {
  person: { id: string; name: string | null };
  /** Der ganze Bestand, einschliesslich Papierkorb — gefiltert wird hier. */
  bestand: readonly KnowledgeObject[];
  /** Darf der Handelnde diesen Beitrag lesen? */
  darfSehen: (ko: KnowledgeObject) => boolean;
  /** Anzeigename zu einer Konto-Kennung, `null` für ein unbekanntes oder gelöschtes Konto. */
  name: (id: string) => string | null;
  jetzt: number;
}

export interface VermaechtnisAusgelassen {
  papierkorb: number;
  nichtEinsehbar: number;
  vertraulich: number;
  nichtValidiert: number;
}

export interface VermaechtnisBuch {
  person: { id: string; name: string | null };
  titel: string;
  erzeugtAm: string;
  dateiname: string;
  /** Anzahl der Beiträge im Buch. */
  aufgenommen: number;
  /** Erster und letzter Beitrag im Buch (Datum `JJJJ-MM-TT`), `null` ohne Beitrag. */
  zeitraum: { von: string; bis: string } | null;
  themen: { thema: string; anzahl: number }[];
  ausgelassen: VermaechtnisAusgelassen;
  markdown: string;
  provenance: OutputProvenance[];
}

/** Gehört dieser Beitrag zur Person — als ursprünglicher oder heutiger Autor? */
export function istBeitragVon(ko: KnowledgeObject, personId: string): boolean {
  return ko.originalAuthor === personId || ko.author === personId;
}

function datum(iso: string): string {
  return iso.slice(0, 10);
}

function themaVon(ko: KnowledgeObject): string {
  const kategorie = ko.category.trim();
  return kategorie.length > 0 ? kategorie : VERMAECHTNIS_OHNE_THEMA;
}

/** Dateiname ohne Sonderzeichen: Name (oder Kennung) und Datum. */
function dateinameFuer(anzeige: string, erzeugtAm: string): string {
  const teil =
    anzeige
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "person";
  return `klarwerk-vermaechtnis-${teil}-${datum(erzeugtAm)}.md`;
}

export function erstelleVermaechtnisBuch(e: VermaechtnisEingabe): VermaechtnisBuch {
  const ausgelassen: VermaechtnisAusgelassen = {
    papierkorb: 0,
    nichtEinsehbar: 0,
    vertraulich: 0,
    nichtValidiert: 0,
  };
  const beitraege: KnowledgeObject[] = [];
  for (const ko of e.bestand) {
    if (!istBeitragVon(ko, e.person.id)) {
      continue;
    }
    if (ko.deletedAt) {
      ausgelassen.papierkorb += 1;
    } else if (!e.darfSehen(ko)) {
      ausgelassen.nichtEinsehbar += 1;
    } else if (isConfidential(ko.confidentiality)) {
      ausgelassen.vertraulich += 1;
    } else if (ko.status !== "validiert") {
      ausgelassen.nichtValidiert += 1;
    } else {
      beitraege.push(ko);
    }
  }
  // Innerhalb eines Kapitels in der Reihenfolge, in der die Person festgehalten hat.
  beitraege.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  const kapitel = new Map<string, KnowledgeObject[]>();
  for (const ko of beitraege) {
    const thema = themaVon(ko);
    kapitel.set(thema, [...(kapitel.get(thema) ?? []), ko]);
  }
  const themen = [...kapitel.keys()].sort((a, b) => a.localeCompare(b, "de"));

  const erzeugtAm = new Date(e.jetzt).toISOString();
  const anzeige = e.person.name ?? `Konto ${e.person.id}`;
  const titel = `Wissens-Vermächtnis von ${anzeige}`;
  const erster = beitraege[0];
  const letzter = beitraege[beitraege.length - 1];
  const zeitraum =
    erster && letzter ? { von: datum(erster.createdAt), bis: datum(letzter.createdAt) } : null;
  const autorName = (id: string): string => e.name(id) ?? `Konto ${id}`;
  const autorZeile = (ko: KnowledgeObject): string =>
    ko.author === ko.originalAuthor
      ? autorName(ko.author)
      : `${autorName(ko.originalAuthor)} (heute bei ${autorName(ko.author)})`;

  const spanne = zeitraum ? ` · festgehalten von ${zeitraum.von} bis ${zeitraum.bis}` : "";

  const kopf = [
    `# ${titel}`,
    "",
    `_Eine Würdigung · erzeugt am ${erzeugtAm} · ${beitraege.length} validierte Beiträge${spanne}_`,
    "",
    OUTPUT_NO_CHECK_NOTE,
    "",
    "## Vorwort",
    "",
    `Dieses Buch versammelt das Wissen, das ${anzeige} in KLARWERK festgehalten hat. ${WUERDIGUNG}`,
  ];

  const teile: string[] = [kopf.join("\n")];
  if (beitraege.length === 0) {
    teile.push(
      [
        "## Noch keine aufgenommenen Beiträge",
        "",
        `Von ${anzeige} liegt derzeit kein validierter, einsehbarer und nicht vertraulicher Beitrag vor.`,
      ].join("\n"),
    );
  } else {
    teile.push(
      [
        "## Inhalt",
        "",
        ...themen.map((t, i) => `${i + 1}. ${t} (${kapitel.get(t)?.length ?? 0})`),
      ].join("\n"),
    );

    // Der biografische Weg: was in welchem Jahr dazukam.
    const jahre = new Map<string, string[]>();
    for (const ko of beitraege) {
      const jahr = ko.createdAt.slice(0, 4);
      jahre.set(jahr, [...(jahre.get(jahr) ?? []), ko.title]);
    }
    teile.push(
      [
        "## Zeitleiste",
        "",
        ...[...jahre].map(
          ([jahr, titelListe]) => `- **${jahr}** — ${titelListe.length}: ${titelListe.join("; ")}`,
        ),
      ].join("\n"),
    );

    // Der thematische Weg: je Thema ein Kapitel.
    for (const [i, thema] of themen.entries()) {
      const zeilen = [`## Kapitel ${i + 1}: ${thema}`];
      for (const ko of kapitel.get(thema) ?? []) {
        zeilen.push("", `### ${ko.title}`, "", ko.statement);
        if (ko.conditions.length > 0) {
          zeilen.push("", "**Wann es gilt**", ...ko.conditions.map((c) => `- ${c}`));
        }
        if (ko.measures.length > 0) {
          zeilen.push("", "**Vorgehen**", ...ko.measures.map((m, k) => `${k + 1}. ${m}`));
        }
        zeilen.push(
          "",
          `_Festgehalten am ${datum(ko.createdAt)} · Fassung v${ko.version} · ${autorZeile(ko)}_`,
        );
      }
      teile.push(zeilen.join("\n"));
    }
  }

  const offen = [
    [ausgelassen.nichtValidiert, "noch nicht validiert"],
    [ausgelassen.vertraulich, "vertraulich — gehört in kein weitergegebenes Dokument"],
    [ausgelassen.nichtEinsehbar, "für die erzeugende Person nicht einsehbar"],
    [ausgelassen.papierkorb, "im Papierkorb"],
  ] as const;
  if (offen.some(([n]) => n > 0)) {
    teile.push(
      [
        "## Nicht aufgenommen",
        "",
        ...offen.filter(([n]) => n > 0).map(([n, grund]) => `- ${n} Beiträge: ${grund}`),
      ].join("\n"),
    );
  }

  const provenance = beitraege.map(toProvenance);
  const herkunft = ["## Herkunft & Nachweis", ""];
  for (const ko of beitraege) {
    herkunft.push(
      `- **${ko.title}** (\`${ko.id}\`) — ${ko.type} · ${themaVon(ko)} · Status ${ko.status} · ` +
        `Fassung v${ko.version} · festgehalten ${datum(ko.createdAt)} · Autor: ${autorZeile(ko)}`,
    );
  }
  herkunft.push("", OUTPUT_NO_CHECK_NOTE);
  if (beitraege.length > 0) {
    teile.push(herkunft.join("\n"));
  }

  return {
    person: e.person,
    titel,
    erzeugtAm,
    dateiname: dateinameFuer(e.person.name ?? e.person.id, erzeugtAm),
    aufgenommen: beitraege.length,
    zeitraum,
    themen: themen.map((thema) => ({ thema, anzahl: kapitel.get(thema)?.length ?? 0 })),
    ausgelassen,
    markdown: teile.join("\n\n"),
    provenance,
  };
}
