// ================================================================================================
// Aufnahme `gesamt-hilfen` · P-HILFE-ANWENDERSPRACHE — DIE WORTWAHL DER NEUEN HILFETEXTE.
// ================================================================================================
//
// Gemeinsame Regeln für die FAQ-Lesefassung (`lib/hilfeFaq.ts`) und die Bibliotheksartikel
// (`lib/hilfeBibliothek.ts`). Die Verbotsliste übernimmt die von JOB 4067
// (`tests/hilfe-anwendersprache/wortwahl-waechter.test.ts`, Bedienbefund 18:16) und ergänzt die
// Begriffe, die Bens Befund (Nacharbeit 3) an der wörtlich eingeblendeten FAQ fand: „Admins",
// „Prüf-Board", „Bus-Faktor" sowie Rollennamen außerhalb der Export-Rollenausnahme.
//
// ECHTE BESCHRIFTUNGEN BLEIBEN ERLAUBT: Ein Text darf eine Fläche bei ihrem angezeigten Namen
// nennen („Admin" ist der Menüpunkt, „In review" der englische Status). Deshalb wird ein
// Anführungs-Abschnitt nur dann aus der Prüfung genommen, wenn sein Inhalt WÖRTLICH ein Wert des
// Sprachbestands derselben Sprache ist — ein erfundenes Zitat bleibt geprüft.
import i18n from "../../apps/web/src/i18n";

export type Sprache = "de" | "en" | "nl";
export const SPRACHEN: readonly Sprache[] = ["de", "en", "nl"];

export type Verbot = { muster: RegExp; grund: string };

const GEMEINSAM: Verbot[] = [
  { muster: /pilot/i, grund: "Bedienbefund 18:16: Pilotbegriffe" },
  { muster: /stage[-\s]?1/i, grund: "Bedienbefund 18:16: „Stage-1“" },
  { muster: /\bpeers?\b|\bpeer-/i, grund: "Bedienbefund 18:16: „Peers“" },
  { muster: /\breviews?\b/i, grund: "Bedienbefund 18:16: „Review/Entscheidung“" },
  { muster: /\bUX\b/, grund: "Bedienbefund 18:16: interne UX-Prüferansprache" },
  { muster: /workflow/i, grund: "Wortwahl: die Oberfläche kennt keinen „Workflow“" },
  { muster: /\bflows?\b/i, grund: "Wortwahl: die Ziele heissen „Bereich“" },
  { muster: /KO-Detail/i, grund: "Wortwahl: keine Fläche dieses Namens" },
  { muster: /\btrust\b/i, grund: "Wortwahl: „Vertrauen“/„betrouwbaar“" },
  { muster: /\badmins\b|\badmin-/i, grund: "Ben NA3: „Admins“ als Rollenwort" },
  { muster: /prüf-?board|review-?board|controlebord/i, grund: "Ben NA3: „Prüf-Board“" },
  { muster: /bus-?fa[ck]tor|bus factor/i, grund: "Ben NA3 / JOB 4071: „Bus-Faktor“" },
  { muster: /quorum/i, grund: "Prüfbegriff ohne Anwendersprache" },
];

export const VERBOTEN: Record<Sprache, Verbot[]> = {
  de: [
    ...GEMEINSAM,
    { muster: /\bfl(uss|üsse)\b/i, grund: "Wortwahl: „Bereich öffnen“" },
    { muster: /reibung/i, grund: "Bedienbefund 18:16: Prüfersprache" },
  ],
  en: [...GEMEINSAM, { muster: /friction/i, grund: "Bedienbefund 18:16: Prüfersprache" }],
  nl: [...GEMEINSAM, { muster: /wrijving/i, grund: "Bedienbefund 18:16: Prüfersprache" }],
};

function sprachwerte(sprache: Sprache): Set<string> {
  const bestand = i18n.getResourceBundle(sprache, "translation") as
    | Record<string, unknown>
    | undefined;
  if (!bestand || Object.keys(bestand).length === 0) {
    throw new Error(`Sprachbestand fehlt: ${sprache}`);
  }
  return new Set(
    Object.values(bestand)
      .filter((wert): wert is string => typeof wert === "string")
      .map((wert) => wert.trim()),
  );
}

/** Der Text ohne die Anführungs-Abschnitte, die wörtlich eine echte Beschriftung sind. */
export function ohneEchteBeschriftungen(text: string, sprache: Sprache): string {
  const werte = sprachwerte(sprache);
  return text.replace(/[„“"]([^„“”"]{1,60})[“”"]/g, (ganz, innen: string) =>
    werte.has(innen.trim()) ? " " : ganz,
  );
}

export type Rolle = "viewer" | "experte" | "controller" | "admin";

/** Die angezeigten Rollennamen einer Sprache — aus dem Sprachbestand, nicht von Hand. */
export function rollennamen(sprache: Sprache): Record<Rolle, string> {
  const t = i18n.getFixedT(sprache);
  return {
    viewer: t("role.name.viewer"),
    experte: t("role.name.experte"),
    controller: t("role.name.controller"),
    admin: t("role.name.admin"),
  };
}

/** Steht `wort` als ganzes Wort im Text (Unicode-Buchstabengrenzen, ohne Groß/Klein)? */
export function enthaeltWort(text: string, wort: string): boolean {
  const maskiert = wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${maskiert}(?=$|[^\\p{L}])`, "iu").test(text);
}

/** Alle Wortwahl-Funde eines Textes; Rollennamen nur, wenn `rollenErlaubt` falsch ist. */
export function funde(text: string, sprache: Sprache, rollenErlaubt: boolean): string[] {
  const geprueft = ohneEchteBeschriftungen(text, sprache);
  const treffer: string[] = [];
  for (const verbot of VERBOTEN[sprache]) {
    const fund = geprueft.match(verbot.muster);
    if (fund) treffer.push(`„${fund[0]}“ — ${verbot.grund}`);
  }
  if (!rollenErlaubt) {
    for (const name of Object.values(rollennamen(sprache))) {
      if (enthaeltWort(geprueft, name)) {
        treffer.push(`Rollenname „${name}“ außerhalb der Rollenausnahme`);
      }
    }
  }
  return treffer;
}
