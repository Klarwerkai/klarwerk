import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  FELD_ARTEN,
  type FeldArt,
  type StrukturFeld,
  type StrukturVorlage,
  fehlendePflichtfelder,
  normiere,
} from "../../../apps/web/src/lib/vorlagenStruktur";
import type { AuditService } from "../../audit";
import type { Role } from "../../auth";
import type { KnowledgeObject } from "../../knowledge-object";
import { can } from "../../rbac";
import {
  type SpaceFassung,
  darfInSpaceSchreiben,
  darfSpaceBearbeiten,
  darfSpaceInhalteLesen,
  istArchiviert,
} from "./spaces";

// ================================================================================================
// VORLAGEN — STANDARD, PERSÖNLICH, SPACE-GETEILT, UNTERNEHMENSWEIT; PERSÖNLICHER STANDARD;
// SPACE-VORGABEN; NUTZUNG JE BEITRAG; BEGRIFFSPFLEGE (produkt:20261007:templates-default, ADMIN-08).
// ================================================================================================
//
// Eine Vorlage ist eine Liste von Feldern (`vorlagenStruktur.ts`, dieselbe Datei liest der Editor).
// Jede Änderung ist eine neue, unveränderliche FASSUNG — wie bei Spaces und Teams. Ein Beitrag
// merkt sich beim Einreichen Vorlage UND Fassung (`NutzungsEintrag`); spätere Fassungen ändern ihn
// nicht, und seine Ausgangsstruktur bleibt über die gespeicherte Fassung nachvollziehbar.
//
// RECHTE über die bestehenden Regeln, kein zweites Rechtemodell:
//   · persönlich    — nur die Eigentümerin sieht, nutzt und ändert sie;
//   · space         — wer die Spaceinhalte lesen darf, nutzt sie; anlegen/teilen braucht Schreibrecht
//                     im Space; ändern: Eigentümerin mit Schreibrecht oder wer den Space verwaltet;
//   · unternehmen   — alle mit `ko.read` nutzen sie; anlegen und ändern nur `users.manage`;
//   · standard      — eingebaut, unveränderlich.
//
// VORRANG beim Beginn einer Eingabe: eine im Space verbindliche Vorlage vor dem persönlichen
// Standard; ist der Standard nicht mehr verfügbar, gilt freie Eingabe mit Begründung — es wird nie
// etwas aus einem Inhalt entfernt.

export const VORLAGEN_GELTUNGEN = ["persoenlich", "space", "unternehmen"] as const;
export type EigeneGeltung = (typeof VORLAGEN_GELTUNGEN)[number];
export type VorlagenGeltung = EigeneGeltung | "standard";

export type VorlageFeld = StrukturFeld;

export interface VorlageEingabe {
  name: string;
  beschreibung: string;
  geltung: EigeneGeltung;
  /** Nur bei `space`: der Space, in dem die Vorlage geteilt ist. */
  spaceId?: string;
  felder: VorlageFeld[];
}

export type VorlagenVorgang = "angelegt" | "geaendert" | "geteilt" | "ausgemustert";

export interface VorlageFassung extends StrukturVorlage {
  id: string;
  version: number;
  name: string;
  beschreibung: string;
  geltung: VorlagenGeltung;
  spaceId?: string;
  felder: VorlageFeld[];
  eigentuemer: string;
  angelegtAm: string;
  geaendertVon: string;
  geaendertAm: string;
  vorgang: VorlagenVorgang;
  /** Ausgemustert: wird nicht mehr angeboten; bestehende Beiträge behalten ihren Bezug. */
  ausgemustert?: boolean;
  begruendung?: string;
}

export const VORLAGEN_GRENZEN = {
  name: 80,
  beschreibung: 500,
  felder: 20,
  feldTitel: 80,
  feldHinweis: 300,
  begruendung: 1_000,
  begriff: 80,
  kategorien: 50,
  tags: 50,
  mindestensTags: 5,
  hinweis: 1_000,
} as const;

export class VorlagenFehler extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "VorlagenFehler";
  }
}

// ------------------------------------------------------------------------------------------------
// DIE STANDARDVORLAGEN — die sechs bestellten (Regel, Arbeitsanleitung, Übergabe, Projektentscheidung,
// Besprechungsnotiz, FAQ) und die übernommenen Startstrukturen des Editors (`lib/bodyTemplates.ts`:
// Vorgehen → Arbeitsanleitung, Übergabe/Schulung → Übergabe, dazu Störung, Sicherheit, Checkliste,
// Entscheidungshilfe). Feldtitel in DE/EN/NL, damit die Pflichtprüfung jede Sprachfassung erkennt.
// ------------------------------------------------------------------------------------------------

type T3 = [string, string, string];

function feld(id: string, art: FeldArt, pflicht: boolean, titel: T3, hinweis: T3): VorlageFeld {
  return {
    id,
    art,
    pflicht,
    titel: titel[0],
    hinweis: hinweis[0],
    sprachen: {
      en: { titel: titel[1], hinweis: hinweis[1] },
      nl: { titel: titel[2], hinweis: hinweis[2] },
    },
  };
}

const STANDARD_AM = "2026-10-09T00:00:00.000Z";

function standard(id: string, name: T3, beschreibung: T3, felder: VorlageFeld[]): VorlageFassung {
  return {
    id: `std-${id}`,
    version: 1,
    name: name[0],
    beschreibung: beschreibung[0],
    sprachen: {
      en: { name: name[1], beschreibung: beschreibung[1] },
      nl: { name: name[2], beschreibung: beschreibung[2] },
    },
    geltung: "standard",
    felder,
    eigentuemer: "system",
    angelegtAm: STANDARD_AM,
    geaendertVon: "system",
    geaendertAm: STANDARD_AM,
    vorgang: "angelegt",
  };
}

export const STANDARD_VORLAGEN: readonly VorlageFassung[] = [
  standard(
    "regel",
    ["Regel", "Rule", "Regel"],
    [
      "Eine verbindliche Regel mit Geltung, Begründung und Ausnahmen.",
      "A binding rule with scope, reason and exceptions.",
      "Een bindende regel met toepassingsgebied, reden en uitzonderingen.",
    ],
    [
      feld(
        "geltung",
        "absatz",
        true,
        ["Wofür gilt die Regel?", "Where does the rule apply?", "Waarvoor geldt de regel?"],
        [
          "Bereich, Anlage oder Situation ergänzen …",
          "Add area, asset or situation …",
          "Gebied, installatie of situatie aanvullen …",
        ],
      ),
      feld(
        "regel",
        "absatz",
        true,
        ["Die Regel", "The rule", "De regel"],
        [
          "Die Regel in einem klaren Satz …",
          "The rule in one clear sentence …",
          "De regel in één duidelijke zin …",
        ],
      ),
      feld(
        "begruendung",
        "absatz",
        false,
        ["Begründung", "Reason", "Reden"],
        [
          "Warum gilt sie? Quelle oder Erfahrung …",
          "Why does it apply? Source or experience …",
          "Waarom geldt ze? Bron of ervaring …",
        ],
      ),
      feld(
        "ausnahmen",
        "liste",
        false,
        ["Ausnahmen", "Exceptions", "Uitzonderingen"],
        ["Ausnahme ergänzen …", "Add exception …", "Uitzondering aanvullen …"],
      ),
    ],
  ),
  standard(
    "procedure",
    ["Arbeitsanleitung", "Work instruction", "Werkinstructie"],
    [
      "Schritt für Schritt, mit Bedingungen und Beleg (bisher „Vorgehen“).",
      "Step by step, with conditions and evidence (formerly “Procedure”).",
      "Stap voor stap, met voorwaarden en bewijs (voorheen „Werkwijze“).",
    ],
    [
      feld(
        "anwendung",
        "absatz",
        false,
        ["Wann gilt die Anleitung?", "When does it apply?", "Wanneer geldt de instructie?"],
        [
          "Beschreibe kurz, wann dieses Wissen gilt …",
          "Briefly describe when this knowledge applies …",
          "Beschrijf kort wanneer deze kennis geldt …",
        ],
      ),
      feld(
        "bedingungen",
        "liste",
        false,
        ["Bedingungen", "Conditions", "Voorwaarden"],
        ["Bedingung ergänzen …", "Add condition …", "Voorwaarde aanvullen …"],
      ),
      feld(
        "schritte",
        "schritte",
        true,
        ["Schritte", "Steps", "Stappen"],
        ["Ersten Schritt ergänzen …", "Add first step …", "Eerste stap aanvullen …"],
      ),
      feld(
        "quelle",
        "hinweis",
        false,
        ["Quelle oder Erfahrungsbeleg", "Source or evidence", "Bron of ervaringsbewijs"],
        [
          "Quelle oder Erfahrungsbeleg ergänzen …",
          "Add source or experience evidence …",
          "Bron of ervaringsbewijs aanvullen …",
        ],
      ),
    ],
  ),
  standard(
    "handover",
    ["Übergabe", "Handover", "Overdracht"],
    [
      "Was die nächste Person wissen muss, um zu übernehmen.",
      "What the next person needs to know to take over.",
      "Wat de volgende persoon moet weten om over te nemen.",
    ],
    [
      feld(
        "wichtigste",
        "liste",
        true,
        ["Das Wichtigste zuerst", "Most important first", "Het belangrijkste eerst"],
        ["Kernpunkt ergänzen …", "Add key point …", "Kernpunt aanvullen …"],
      ),
      feld(
        "offen",
        "liste",
        false,
        ["Offene Punkte", "Open items", "Openstaande punten"],
        ["Offenen Punkt ergänzen …", "Add open item …", "Openstaand punt aanvullen …"],
      ),
      feld(
        "fehler",
        "liste",
        false,
        ["Typische Anfängerfehler", "Typical beginner mistakes", "Typische beginnersfouten"],
        [
          "Fehler und wie man ihn vermeidet …",
          "Mistake and how to avoid it …",
          "Fout en hoe je die vermijdt …",
        ],
      ),
      feld(
        "kontakt",
        "hinweis",
        false,
        [
          "Ansprechpartner und Unterlagen",
          "Contacts and material",
          "Contactpersonen en documenten",
        ],
        [
          "Ansprechpartner / weiterführende Unterlagen ergänzen …",
          "Add contact person / further material …",
          "Contactpersoon / verdere documenten aanvullen …",
        ],
      ),
    ],
  ),
  standard(
    "projektentscheidung",
    ["Projektentscheidung", "Project decision", "Projectbesluit"],
    [
      "Eine getroffene Entscheidung mit Ausgangslage, Alternativen und Folgen.",
      "A decision taken, with context, alternatives and consequences.",
      "Een genomen besluit met uitgangssituatie, alternatieven en gevolgen.",
    ],
    [
      feld(
        "ausgangslage",
        "absatz",
        true,
        ["Ausgangslage", "Context", "Uitgangssituatie"],
        [
          "Welche Frage stand an? …",
          "What question had to be decided? …",
          "Welke vraag lag er voor? …",
        ],
      ),
      feld(
        "entscheidung",
        "absatz",
        true,
        ["Entscheidung", "Decision", "Besluit"],
        [
          "Was wurde entschieden, von wem, wann? …",
          "What was decided, by whom, when? …",
          "Wat is besloten, door wie, wanneer? …",
        ],
      ),
      feld(
        "alternativen",
        "liste",
        false,
        ["Geprüfte Alternativen", "Alternatives considered", "Onderzochte alternatieven"],
        ["Alternative ergänzen …", "Add alternative …", "Alternatief aanvullen …"],
      ),
      feld(
        "begruendung",
        "absatz",
        true,
        ["Begründung", "Reason", "Reden"],
        ["Warum diese Entscheidung? …", "Why this decision? …", "Waarom dit besluit? …"],
      ),
      feld(
        "folgen",
        "liste",
        false,
        [
          "Folgen und nächste Schritte",
          "Consequences and next steps",
          "Gevolgen en volgende stappen",
        ],
        ["Folge ergänzen …", "Add consequence …", "Gevolg aanvullen …"],
      ),
    ],
  ),
  standard(
    "besprechungsnotiz",
    ["Besprechungsnotiz", "Meeting note", "Vergadernotitie"],
    [
      "Ergebnisse und Aufgaben einer Besprechung festhalten.",
      "Record the results and tasks of a meeting.",
      "Resultaten en taken van een overleg vastleggen.",
    ],
    [
      feld(
        "anlass",
        "absatz",
        true,
        ["Anlass und Teilnehmende", "Occasion and participants", "Aanleiding en deelnemers"],
        [
          "Worum ging es, wer war dabei? …",
          "What was it about, who attended? …",
          "Waar ging het over, wie was erbij? …",
        ],
      ),
      feld(
        "ergebnisse",
        "liste",
        true,
        ["Ergebnisse", "Results", "Resultaten"],
        ["Ergebnis ergänzen …", "Add result …", "Resultaat aanvullen …"],
      ),
      feld(
        "aufgaben",
        "liste",
        false,
        [
          "Aufgaben (wer, was, bis wann)",
          "Tasks (who, what, by when)",
          "Taken (wie, wat, wanneer)",
        ],
        ["Aufgabe ergänzen …", "Add task …", "Taak aanvullen …"],
      ),
      feld(
        "offen",
        "liste",
        false,
        ["Offene Fragen", "Open questions", "Open vragen"],
        ["Frage ergänzen …", "Add question …", "Vraag aanvullen …"],
      ),
    ],
  ),
  standard(
    "faq",
    ["FAQ", "FAQ", "FAQ"],
    [
      "Eine häufige Frage mit kurzer, belastbarer Antwort.",
      "A frequent question with a short, reliable answer.",
      "Een veelgestelde vraag met een kort, betrouwbaar antwoord.",
    ],
    [
      feld(
        "frage",
        "absatz",
        true,
        ["Frage", "Question", "Vraag"],
        [
          "Die Frage, wie sie gestellt wird …",
          "The question as people ask it …",
          "De vraag zoals die gesteld wordt …",
        ],
      ),
      feld(
        "antwort",
        "absatz",
        true,
        ["Antwort", "Answer", "Antwoord"],
        ["Kurze, belastbare Antwort …", "Short, reliable answer …", "Kort, betrouwbaar antwoord …"],
      ),
      feld(
        "grenzen",
        "hinweis",
        false,
        ["Hinweise und Grenzen", "Notes and limits", "Opmerkingen en grenzen"],
        [
          "Wann passt die Antwort nicht? …",
          "When does the answer not fit? …",
          "Wanneer past het antwoord niet? …",
        ],
      ),
    ],
  ),
  standard(
    "troubleshooting",
    ["Störung beheben", "Troubleshooting", "Storing verhelpen"],
    [
      "Symptom, mögliche Ursache, Maßnahme und Abbruchkriterium.",
      "Symptom, possible cause, action and stop criterion.",
      "Symptoom, mogelijke oorzaak, maatregel en stopcriterium.",
    ],
    [
      feld(
        "symptom",
        "absatz",
        true,
        ["Störung / Symptom", "Issue / symptom", "Storing / symptoom"],
        [
          "Was ist sichtbar oder messbar? …",
          "What is visible or measurable? …",
          "Wat is zichtbaar of meetbaar? …",
        ],
      ),
      feld(
        "ursache",
        "liste",
        false,
        ["Mögliche Ursache", "Possible cause", "Mogelijke oorzaak"],
        ["Ursache ergänzen …", "Add cause …", "Oorzaak aanvullen …"],
      ),
      feld(
        "massnahme",
        "schritte",
        true,
        ["Maßnahme", "Action", "Maatregel"],
        ["Prüfschritt ergänzen …", "Add check …", "Controlestap aanvullen …"],
      ),
      feld(
        "grenze",
        "warnung",
        false,
        ["Grenze / Abbruchkriterium", "Limit / stop criterion", "Grens / stopcriterium"],
        [
          "Grenze / Abbruchkriterium ergänzen …",
          "Add limit / stop criterion …",
          "Grens / stopcriterium aanvullen …",
        ],
      ),
    ],
  ),
  standard(
    "safety",
    ["Sicherheitsrelevantes Wissen", "Safety-relevant knowledge", "Veiligheidsrelevante kennis"],
    [
      "Situation, Gefahr, sichere Prüfung und gewünschter Zustand.",
      "Situation, hazard, safe check and desired state.",
      "Situatie, gevaar, veilige controle en gewenste toestand.",
    ],
    [
      feld(
        "situation",
        "absatz",
        true,
        ["Situation und Risiko", "Situation and risk", "Situatie en risico"],
        [
          "Beschreibe die Situation und das Risiko …",
          "Describe the situation and the risk …",
          "Beschrijf de situatie en het risico …",
        ],
      ),
      feld(
        "gefahr",
        "warnung",
        true,
        ["Warnung oder Gefahr", "Warning or hazard", "Waarschuwing of gevaar"],
        [
          "Warnung oder Gefahr ergänzen …",
          "Add warning or hazard …",
          "Waarschuwing of gevaar aanvullen …",
        ],
      ),
      feld(
        "pruefen",
        "schritte",
        false,
        ["Sicher prüfen", "Safe check", "Veilig controleren"],
        ["Prüfschritt ergänzen …", "Add check …", "Controlestap aanvullen …"],
      ),
      feld(
        "zustand",
        "hinweis",
        false,
        ["Sicherer Zustand", "Safe state", "Veilige toestand"],
        [
          "Sichere Maßnahme / gewünschter Zustand …",
          "Safe action / desired state …",
          "Veilige maatregel / gewenste toestand …",
        ],
      ),
    ],
  ),
  standard(
    "checklist",
    ["Checkliste", "Checklist", "Checklist"],
    [
      "Prüfpunkte und was bei einer Abweichung zu tun ist.",
      "Check items and what to do if one is not met.",
      "Controlepunten en wat te doen bij een afwijking.",
    ],
    [
      feld(
        "zweck",
        "absatz",
        false,
        [
          "Wofür gilt die Checkliste?",
          "What is the checklist for?",
          "Waarvoor dient de checklist?",
        ],
        ["Wann wird sie benutzt? …", "When is it used? …", "Wanneer wordt ze gebruikt? …"],
      ),
      feld(
        "punkte",
        "liste",
        true,
        ["Prüfpunkte", "Check items", "Controlepunten"],
        ["Prüfpunkt ergänzen …", "Add check item …", "Controlepunt aanvullen …"],
      ),
      feld(
        "abweichung",
        "hinweis",
        false,
        ["Bei Abweichung", "If an item is not met", "Bij afwijking"],
        [
          "Was tun, wenn ein Punkt nicht erfüllt ist? …",
          "What to do if an item is not met? …",
          "Wat te doen als een punt niet is vervuld? …",
        ],
      ),
    ],
  ),
  standard(
    "decision",
    ["Entscheidungshilfe", "Decision aid", "Beslishulp"],
    [
      "Wenn-dann-Regeln für eine wiederkehrende Entscheidung.",
      "If-then rules for a recurring decision.",
      "Als-dan-regels voor een terugkerende beslissing.",
    ],
    [
      feld(
        "situation",
        "absatz",
        false,
        [
          "Woran erkennt man die Situation?",
          "How do you recognise the situation?",
          "Hoe herken je de situatie?",
        ],
        [
          "Welche Entscheidung steht an? …",
          "Which decision is at hand? …",
          "Welke beslissing ligt voor? …",
        ],
      ),
      feld(
        "regeln",
        "liste",
        true,
        ["Wenn … dann …", "If … then …", "Als … dan …"],
        [
          "Wenn [Bedingung], dann [Entscheidung] …",
          "If [condition], then [decision] …",
          "Als [voorwaarde], dan [beslissing] …",
        ],
      ),
      feld(
        "eskalation",
        "warnung",
        false,
        ["Wann eskalieren?", "When to escalate?", "Wanneer escaleren?"],
        [
          "Wann unbedingt Rücksprache halten? …",
          "When to check back without fail? …",
          "Wanneer zeker overleggen? …",
        ],
      ),
    ],
  ),
];

export function istStandard(id: string): boolean {
  return STANDARD_VORLAGEN.some((v) => v.id === id);
}

// ------------------------------------------------------------------------------------------------
// EINGABEN PRÜFEN
// ------------------------------------------------------------------------------------------------

function text(wert: unknown): string {
  return typeof wert === "string" ? wert.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

function feldId(titel: string, vergeben: ReadonlySet<string>): string {
  const basis =
    titel
      .toLocaleLowerCase("de")
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "feld";
  let id = basis;
  for (let n = 2; vergeben.has(id); n += 1) {
    id = `${basis}-${n}`;
  }
  return id;
}

/** Prüft eine eigene Vorlage und gibt sie bereinigt zurück — oder wirft `VorlagenFehler`. */
export function pruefeVorlageEingabe(roh: unknown): VorlageEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new VorlagenFehler("VORLAGE_UNGUELTIG", "Erwartet wird eine Vorlage als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const name = text(r.name);
  if (!name || name.length > VORLAGEN_GRENZEN.name) {
    throw new VorlagenFehler("VORLAGE_UNGUELTIG", "Der Name fehlt oder ist zu lang.");
  }
  const beschreibung = text(r.beschreibung);
  if (beschreibung.length > VORLAGEN_GRENZEN.beschreibung) {
    throw new VorlagenFehler("VORLAGE_UNGUELTIG", "Die Beschreibung ist zu lang.");
  }
  const geltung = r.geltung ?? "persoenlich";
  if (!VORLAGEN_GELTUNGEN.includes(geltung as EigeneGeltung)) {
    throw new VorlagenFehler(
      "VORLAGE_UNGUELTIG",
      "Die Geltung ist „persoenlich“, „space“ oder „unternehmen“.",
    );
  }
  const spaceId = text(r.spaceId);
  if (geltung === "space" && !spaceId) {
    throw new VorlagenFehler("VORLAGE_UNGUELTIG", "Eine Space-Vorlage nennt ihren Space.");
  }
  const rohFelder = r.felder;
  if (
    !Array.isArray(rohFelder) ||
    rohFelder.length === 0 ||
    rohFelder.length > VORLAGEN_GRENZEN.felder
  ) {
    throw new VorlagenFehler(
      "VORLAGE_UNGUELTIG",
      `Eine Vorlage hat 1 bis ${VORLAGEN_GRENZEN.felder} Felder.`,
    );
  }
  const felder: VorlageFeld[] = [];
  const ids = new Set<string>();
  const titel = new Set<string>();
  for (const eintrag of rohFelder) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const t = text(e.titel);
    const h = text(e.hinweis);
    if (!t || t.length > VORLAGEN_GRENZEN.feldTitel) {
      throw new VorlagenFehler("VORLAGE_UNGUELTIG", "Jedes Feld braucht einen kurzen Titel.");
    }
    if (h.length > VORLAGEN_GRENZEN.feldHinweis) {
      throw new VorlagenFehler("VORLAGE_UNGUELTIG", `Der Hinweis zu „${t}“ ist zu lang.`);
    }
    // Felder werden im Inhalt über ihre Überschrift erkannt — zwei gleiche Titel wären mehrdeutig.
    if (titel.has(normiere(t))) {
      throw new VorlagenFehler("VORLAGE_UNGUELTIG", `Der Feldtitel „${t}“ kommt doppelt vor.`);
    }
    titel.add(normiere(t));
    const art = e.art ?? "absatz";
    if (!FELD_ARTEN.includes(art as FeldArt)) {
      throw new VorlagenFehler("VORLAGE_UNGUELTIG", `Unbekannte Feldart bei „${t}“.`);
    }
    const gewuenscht = text(e.id);
    const id =
      gewuenscht && !ids.has(gewuenscht) && /^[\p{L}\p{N}-]{1,48}$/u.test(gewuenscht)
        ? gewuenscht
        : feldId(t, ids);
    ids.add(id);
    felder.push({ id, titel: t, hinweis: h, art: art as FeldArt, pflicht: e.pflicht === true });
  }
  return {
    name,
    beschreibung,
    geltung: geltung as EigeneGeltung,
    ...(geltung === "space" ? { spaceId } : {}),
    felder,
  };
}

export function pruefeBegruendung(roh: unknown): string {
  const b = text(roh);
  if (!b || b.length > VORLAGEN_GRENZEN.begruendung) {
    throw new VorlagenFehler("BEGRUENDUNG_FEHLT", "Bitte kurz begründen.");
  }
  return b;
}

// ------------------------------------------------------------------------------------------------
// RECHTE
// ------------------------------------------------------------------------------------------------

export interface VorlagenNutzer {
  id: string;
  role: Role;
}

function spaceVon(
  v: Pick<VorlageFassung, "spaceId">,
  spaces: readonly SpaceFassung[],
): SpaceFassung | undefined {
  return v.spaceId ? spaces.find((s) => s.id === v.spaceId) : undefined;
}

/** Sehen: Standard/Unternehmen alle Lesenden; Space die Leser des Space und die Spaceverwaltung. */
export function darfVorlageSehen(
  v: VorlageFassung,
  nutzer: VorlagenNutzer,
  spaces: readonly SpaceFassung[],
): boolean {
  switch (v.geltung) {
    case "standard":
    case "unternehmen":
      return can(nutzer.role, "ko.read");
    case "persoenlich":
      return v.eigentuemer === nutzer.id;
    case "space": {
      const s = spaceVon(v, spaces);
      return (
        s !== undefined && (darfSpaceInhalteLesen(s, nutzer.id) || darfSpaceBearbeiten(s, nutzer))
      );
    }
  }
}

/** Anwenden: sehen, nicht ausgemustert, Space nicht archiviert, und überhaupt Wissen anlegen dürfen. */
export function darfVorlageAnwenden(
  v: VorlageFassung,
  nutzer: VorlagenNutzer,
  spaces: readonly SpaceFassung[],
): boolean {
  if (v.ausgemustert || !can(nutzer.role, "ko.create") || !darfVorlageSehen(v, nutzer, spaces)) {
    return false;
  }
  if (v.geltung === "space") {
    const s = spaceVon(v, spaces);
    return s !== undefined && !istArchiviert(s) && darfSpaceInhalteLesen(s, nutzer.id);
  }
  return true;
}

/** Wer darf in dieser Geltung eine Vorlage ablegen (anlegen oder dorthin teilen)? */
export function darfInGeltungAblegen(
  geltung: EigeneGeltung,
  spaceId: string | undefined,
  nutzer: VorlagenNutzer,
  spaces: readonly SpaceFassung[],
): boolean {
  switch (geltung) {
    case "persoenlich":
      return can(nutzer.role, "ko.create");
    case "unternehmen":
      return can(nutzer.role, "users.manage");
    case "space": {
      const s = spaceId ? spaces.find((x) => x.id === spaceId) : undefined;
      return s !== undefined && darfInSpaceSchreiben(s, nutzer);
    }
  }
}

/** Ändern (neue Fassung, teilen, ausmustern). Standardvorlagen ändert niemand. */
export function darfVorlageBearbeiten(
  v: VorlageFassung,
  nutzer: VorlagenNutzer,
  spaces: readonly SpaceFassung[],
): boolean {
  switch (v.geltung) {
    case "standard":
      return false;
    case "persoenlich":
      return v.eigentuemer === nutzer.id;
    case "unternehmen":
      return can(nutzer.role, "users.manage");
    case "space": {
      const s = spaceVon(v, spaces);
      if (!s) {
        return false;
      }
      return (
        (v.eigentuemer === nutzer.id && darfInSpaceSchreiben(s, nutzer)) ||
        darfSpaceBearbeiten(s, nutzer)
      );
    }
  }
}

// ------------------------------------------------------------------------------------------------
// SPACE-VORGABEN — was eine Eingabe für diesen Space mitbringen muss.
// ------------------------------------------------------------------------------------------------

export interface SpaceVorgabeEingabe {
  /** Verbindliche Vorlage dieses Space — ihre Pflichtfelder gelten für jede Eingabe hier. */
  verbindlicheVorlageId: string | null;
  /** Erlaubte Kategorien; leer = jede Kategorie. */
  kategorien: string[];
  /** Eine Kategorie ist anzugeben („Allgemein“ zählt nicht als Angabe). */
  pflichtKategorie: boolean;
  /** Mindestzahl an Tags (0 = keine Vorgabe). */
  mindestensTags: number;
  /** Vorgeschlagene Tags dieses Space. */
  tags: string[];
  /** Erklärung in Worten, die bei der Auswahl gezeigt wird. */
  hinweis: string;
}

export interface SpaceVorgabe extends SpaceVorgabeEingabe {
  spaceId: string;
  version: number;
  geaendertVon: string;
  geaendertAm: string;
}

export const KEINE_VORGABE: SpaceVorgabeEingabe = {
  verbindlicheVorlageId: null,
  kategorien: [],
  pflichtKategorie: false,
  mindestensTags: 0,
  tags: [],
  hinweis: "",
};

/** Die Kategorie, die die Erfassung einsetzt, wenn niemand eine wählt — sie ist keine Angabe. */
export const RUECKFALL_KATEGORIE = "Allgemein";

function begriffsListe(roh: unknown, max: number, was: string): string[] {
  if (roh === undefined) {
    return [];
  }
  if (!Array.isArray(roh) || roh.length > max) {
    throw new VorlagenFehler("VORGABE_UNGUELTIG", `${was} sind keine gültige Liste.`);
  }
  const raus: string[] = [];
  for (const e of roh) {
    const t = text(e);
    if (!t || t.length > VORLAGEN_GRENZEN.begriff) {
      throw new VorlagenFehler("VORGABE_UNGUELTIG", `${was}: ein Eintrag ist leer oder zu lang.`);
    }
    if (!raus.some((x) => normiere(x) === normiere(t))) {
      raus.push(t);
    }
  }
  return raus;
}

export function pruefeSpaceVorgabe(roh: unknown): SpaceVorgabeEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new VorlagenFehler("VORGABE_UNGUELTIG", "Erwartet wird eine Vorgabe als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const vorlage = r.verbindlicheVorlageId;
  const verbindlicheVorlageId =
    typeof vorlage === "string" && vorlage.trim() ? vorlage.trim() : null;
  const mindestensTags = r.mindestensTags ?? 0;
  if (
    typeof mindestensTags !== "number" ||
    !Number.isInteger(mindestensTags) ||
    mindestensTags < 0 ||
    mindestensTags > VORLAGEN_GRENZEN.mindestensTags
  ) {
    throw new VorlagenFehler(
      "VORGABE_UNGUELTIG",
      `Die Mindestzahl an Tags liegt zwischen 0 und ${VORLAGEN_GRENZEN.mindestensTags}.`,
    );
  }
  const hinweis = typeof r.hinweis === "string" ? r.hinweis.normalize("NFC").trim() : "";
  if (hinweis.length > VORLAGEN_GRENZEN.hinweis) {
    throw new VorlagenFehler("VORGABE_UNGUELTIG", "Der Hinweis ist zu lang.");
  }
  return {
    verbindlicheVorlageId,
    kategorien: begriffsListe(r.kategorien, VORLAGEN_GRENZEN.kategorien, "Die Kategorien"),
    pflichtKategorie: r.pflichtKategorie === true,
    mindestensTags,
    tags: begriffsListe(r.tags, VORLAGEN_GRENZEN.tags, "Die Tags"),
    hinweis,
  };
}

// ------------------------------------------------------------------------------------------------
// VORRANG: WELCHE VORLAGE FINDET EINE NEUE EINGABE VOR?
// ------------------------------------------------------------------------------------------------

export type StartQuelle = "space" | "persoenlich" | "frei";
export type ErsatzGrund = "ausgemustert" | "nicht_verfuegbar";

export interface StartWahl {
  vorlage: VorlageFassung | null;
  quelle: StartQuelle;
  /** Ein Satz, der die Vorrangregel für genau diesen Fall erklärt. */
  grund: string;
  /** Der persönliche Standard, der ersetzt werden musste — mit Grund. */
  ersatzFuer: { id: string; name: string | null; grund: ErsatzGrund } | null;
  /** Ist der persönliche Standard verfügbar, aber vom Space verdrängt? */
  verdraengt: { id: string; name: string } | null;
}

/**
 * DIE VORRANGREGEL, an einer Stelle:
 *   1. Nennt der gewählte Space eine verbindliche, anwendbare Vorlage, gilt sie — der persönliche
 *      Standard tritt dahinter zurück (und das wird gesagt).
 *   2. Sonst gilt der persönliche Standard, wenn er noch anwendbar ist.
 *   3. Sonst freie Eingabe. War ein Standard gesetzt, der nicht mehr verfügbar ist (ausgemustert,
 *      kein Zugriff mehr, nicht mehr vorhanden), steht das mit Grund dabei; bestehende Inhalte
 *      bleiben unverändert.
 */
export function waehleStartvorlage(e: {
  spaceName: string | null;
  vorgabe: SpaceVorgabeEingabe | null;
  standardId: string | null;
  /** Alle Fassungen (aktuell), auch nicht sichtbare — für die Ersatzbegründung. */
  alle: readonly VorlageFassung[];
  anwendbar: (v: VorlageFassung) => boolean;
}): StartWahl {
  const finde = (id: string | null) => (id ? e.alle.find((v) => v.id === id) : undefined);
  const standardVorlage = finde(e.standardId);
  const standardOk = standardVorlage !== undefined && e.anwendbar(standardVorlage);
  let ersatzFuer: StartWahl["ersatzFuer"] = null;
  if (e.standardId && !standardOk) {
    ersatzFuer = {
      id: e.standardId,
      // Der Name nur, wenn diese Person die Vorlage überhaupt kennen darf (sie war ihr Standard).
      name: standardVorlage?.name ?? null,
      grund: standardVorlage?.ausgemustert ? "ausgemustert" : "nicht_verfuegbar",
    };
  }
  const verbindlich = finde(e.vorgabe?.verbindlicheVorlageId ?? null);
  if (verbindlich && e.anwendbar(verbindlich)) {
    return {
      vorlage: verbindlich,
      quelle: "space",
      grund: `Im Space „${e.spaceName ?? ""}“ ist „${verbindlich.name}“ verbindlich vorgegeben; ein persönlicher Standard tritt dahinter zurück.`,
      ersatzFuer,
      verdraengt:
        standardOk && standardVorlage && standardVorlage.id !== verbindlich.id
          ? { id: standardVorlage.id, name: standardVorlage.name }
          : null,
    };
  }
  if (standardOk && standardVorlage) {
    return {
      vorlage: standardVorlage,
      quelle: "persoenlich",
      grund: `Ihr persönlicher Standard „${standardVorlage.name}“.`,
      ersatzFuer: null,
      verdraengt: null,
    };
  }
  return {
    vorlage: null,
    quelle: "frei",
    grund: ersatzFuer
      ? `Ihr Standard „${ersatzFuer.name ?? ersatzFuer.id}“ ist ${
          ersatzFuer.grund === "ausgemustert" ? "ausgemustert" : "nicht mehr verfügbar"
        }. Es gilt freie Eingabe; bitte einen neuen Standard wählen. Bestehende Inhalte bleiben unverändert.`
      : "Kein Standard gewählt: freie Eingabe.",
    ersatzFuer,
    verdraengt: null,
  };
}

// ------------------------------------------------------------------------------------------------
// BEGRIFFE — umbenannte, zusammengeführte oder ausgemusterte Kategorien und Tags.
// ------------------------------------------------------------------------------------------------

export type BegriffsArt = "tag" | "kategorie";
export type BegriffsVorgang = "umbenennen" | "zusammenfuehren" | "ausmustern";

export interface BegriffEintrag {
  schluessel: string;
  version: number;
  art: BegriffsArt;
  name: string;
  /** `ersetzt`: umbenannt oder zusammengeführt → `ersatz`; `ausgemustert`: nicht mehr anbieten. */
  status: "ersetzt" | "ausgemustert";
  ersatz: string | null;
  /** Geltungsbereich: ein Space oder `null` = alle Spaces und Beiträge ohne Space. */
  spaceId: string | null;
  vorgang: BegriffsVorgang;
  begruendung: string;
  geaendertVon: string;
  geaendertAm: string;
}

export function begriffSchluessel(art: BegriffsArt, name: string, spaceId: string | null): string {
  return `${art}:${spaceId ?? "*"}:${normiere(name)}`;
}

function gleich(a: string, b: string): boolean {
  return normiere(a) === normiere(b);
}

// ------------------------------------------------------------------------------------------------
// DIE PRÜFUNG BEIM EINREICHEN (und als Vorschau im Editor)
// ------------------------------------------------------------------------------------------------

export type BefundArt =
  | "vorlagenfeld"
  | "kategorie_fehlt"
  | "kategorie_nicht_erlaubt"
  | "tags_fehlen"
  | "begriff_ersetzt"
  | "begriff_ausgemustert";

export interface PflichtBefund {
  art: BefundArt;
  /** Feldtitel oder Begriff, um den es geht. */
  wert: string;
  meldung: string;
}

export function pruefeAngaben(e: {
  bodyHtml: string;
  category: string;
  tags: readonly string[];
  vorlage: VorlageFassung | null;
  verbindlich: VorlageFassung | null;
  vorgabe: SpaceVorgabeEingabe | null;
  spaceId: string | null;
  spaceName: string | null;
  begriffe: readonly BegriffEintrag[];
}): PflichtBefund[] {
  const befunde: PflichtBefund[] = [];
  const geprueft = new Set<string>();
  for (const [v, quelle] of [
    [e.vorlage, "Vorlage"],
    [e.verbindlich, `Space „${e.spaceName ?? ""}“`],
  ] as const) {
    if (!v) {
      continue;
    }
    for (const f of fehlendePflichtfelder(e.bodyHtml, v)) {
      const k = normiere(f.titel);
      if (geprueft.has(k)) {
        continue;
      }
      geprueft.add(k);
      befunde.push({
        art: "vorlagenfeld",
        wert: f.titel,
        meldung: `Pflichtfeld „${f.titel}“ (${quelle} „${v.name}“) ist noch leer.`,
      });
    }
  }
  const kategorie = e.category.trim();
  const vg = e.vorgabe;
  if (vg) {
    const angegeben = kategorie.length > 0 && !gleich(kategorie, RUECKFALL_KATEGORIE);
    if (vg.kategorien.length > 0 && !vg.kategorien.some((k) => gleich(k, kategorie))) {
      befunde.push({
        art: "kategorie_nicht_erlaubt",
        wert: kategorie,
        meldung: `Im Space „${e.spaceName ?? ""}“ ist die Kategorie eine von: ${vg.kategorien.join(", ")}.`,
      });
    } else if (vg.pflichtKategorie && !angegeben) {
      befunde.push({
        art: "kategorie_fehlt",
        wert: kategorie,
        meldung: `Im Space „${e.spaceName ?? ""}“ ist eine Kategorie anzugeben.`,
      });
    }
    const tags = e.tags.filter((t) => t.trim().length > 0);
    if (tags.length < vg.mindestensTags) {
      befunde.push({
        art: "tags_fehlen",
        wert: String(vg.mindestensTags),
        meldung: `Im Space „${e.spaceName ?? ""}“ sind mindestens ${vg.mindestensTags} Tags anzugeben.`,
      });
    }
  }
  const imBereich = (b: BegriffEintrag) => b.spaceId === null || b.spaceId === e.spaceId;
  const pruefeBegriff = (art: BegriffsArt, name: string) => {
    const b = e.begriffe.find((x) => x.art === art && imBereich(x) && gleich(x.name, name));
    if (!b) {
      return;
    }
    const was = art === "tag" ? "Tag" : "Kategorie";
    befunde.push(
      b.status === "ersetzt"
        ? {
            art: "begriff_ersetzt",
            wert: name,
            meldung: `${was} „${name}“ heisst jetzt „${b.ersatz ?? ""}“ — bitte den neuen Begriff verwenden.`,
          }
        : {
            art: "begriff_ausgemustert",
            wert: name,
            meldung: `${was} „${name}“ ist ausgemustert${b.begruendung ? ` (${b.begruendung})` : ""} und wird für neue Beiträge nicht mehr verwendet.`,
          },
    );
  };
  if (kategorie && !gleich(kategorie, RUECKFALL_KATEGORIE)) {
    pruefeBegriff("kategorie", kategorie);
  }
  for (const t of e.tags) {
    if (t.trim()) {
      pruefeBegriff("tag", t);
    }
  }
  return befunde;
}

// ------------------------------------------------------------------------------------------------
// NUTZUNG — welcher Beitrag mit welcher Vorlagenfassung entstand.
// ------------------------------------------------------------------------------------------------

export interface VorlagenBezug {
  id: string;
  version: number;
  /** Der Space, für den die Eingabe gemacht wurde (Space-Vorgaben, Ablage in diesem Space). */
  spaceId: string | null;
}

/** Gestalt eines mitgeschickten Bezugs — `null` heisst „freie Eingabe“. */
export function bezugAus(roh: unknown): VorlagenBezug | null | "ungueltig" {
  if (roh === undefined || roh === null) {
    return null;
  }
  if (typeof roh !== "object" || Array.isArray(roh)) {
    return "ungueltig";
  }
  const r = roh as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const version = r.version;
  const spaceId = r.spaceId === undefined || r.spaceId === null ? null : r.spaceId;
  if (
    !id ||
    id.length > 100 ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1 ||
    (spaceId !== null && (typeof spaceId !== "string" || spaceId.length > 100))
  ) {
    return "ungueltig";
  }
  return { id, version, spaceId: spaceId as string | null };
}

export interface NutzungsEintrag {
  koId: string;
  version: 1;
  vorlageId: string;
  vorlagenVersion: number;
  vorlagenName: string;
  spaceId: string | null;
  geaendertVon: string;
  geaendertAm: string;
}

// ------------------------------------------------------------------------------------------------
// AUSWIRKUNGEN EINER ÄNDERUNG — vor der neuen Fassung gezeigt.
// ------------------------------------------------------------------------------------------------

export interface Aenderungswirkung {
  vorlageId: string;
  version: number;
  felder: {
    neu: string[];
    entfernt: string[];
    umbenannt: { vorher: string; nachher: string }[];
    pflichtNeu: string[];
    pflichtEntfallen: string[];
  };
  geltung: {
    vorher: VorlagenGeltung;
    nachher: VorlagenGeltung;
    spaceVorher: string | null;
    spaceNachher: string | null;
  };
  nutzung: NutzungsUmfang;
  /** So viele Konten haben die Vorlage als persönlichen Standard. */
  standardBei: number;
  /** Spaces, in denen sie verbindlich ist. */
  verbindlichIn: { spaceId: string; name: string }[];
  /** Was mit bestehenden Beiträgen geschieht — immer dasselbe, und genau deshalb gesagt. */
  bestand: string;
}

export interface NutzungsUmfang {
  gesamt: number;
  jeVersion: { version: number; anzahl: number }[];
  jeSpace: { spaceId: string | null; name: string | null; anzahl: number }[];
}

export function nutzungsUmfang(
  vorlageId: string,
  nutzung: readonly NutzungsEintrag[],
  kos: ReadonlyMap<string, Pick<KnowledgeObject, "spaceId">>,
  spaces: readonly SpaceFassung[],
): NutzungsUmfang {
  const eigene = nutzung.filter((n) => n.vorlageId === vorlageId && kos.has(n.koId));
  const jeVersion = new Map<number, number>();
  const jeSpace = new Map<string | null, number>();
  for (const n of eigene) {
    jeVersion.set(n.vorlagenVersion, (jeVersion.get(n.vorlagenVersion) ?? 0) + 1);
    const s = kos.get(n.koId)?.spaceId;
    const key = typeof s === "string" ? s : null;
    jeSpace.set(key, (jeSpace.get(key) ?? 0) + 1);
  }
  return {
    gesamt: eigene.length,
    jeVersion: [...jeVersion]
      .sort((a, b) => a[0] - b[0])
      .map(([version, anzahl]) => ({ version, anzahl })),
    jeSpace: [...jeSpace].map(([spaceId, anzahl]) => ({
      spaceId,
      name: spaceId ? (spaces.find((s) => s.id === spaceId)?.name ?? null) : null,
      anzahl,
    })),
  };
}

export function aenderungswirkung(
  vorher: VorlageFassung,
  nachher: VorlageEingabe,
  umfang: NutzungsUmfang,
  standardBei: number,
  verbindlichIn: { spaceId: string; name: string }[],
): Aenderungswirkung {
  const alt = new Map(vorher.felder.map((f) => [f.id, f]));
  const neu = new Map(nachher.felder.map((f) => [f.id, f]));
  return {
    vorlageId: vorher.id,
    version: vorher.version,
    felder: {
      neu: nachher.felder.filter((f) => !alt.has(f.id)).map((f) => f.titel),
      entfernt: vorher.felder.filter((f) => !neu.has(f.id)).map((f) => f.titel),
      umbenannt: nachher.felder
        .filter((f) => alt.has(f.id) && alt.get(f.id)?.titel !== f.titel)
        .map((f) => ({ vorher: alt.get(f.id)?.titel ?? "", nachher: f.titel })),
      pflichtNeu: nachher.felder
        .filter((f) => f.pflicht && !alt.get(f.id)?.pflicht)
        .map((f) => f.titel),
      pflichtEntfallen: vorher.felder
        .filter((f) => f.pflicht && !neu.get(f.id)?.pflicht)
        .map((f) => f.titel),
    },
    geltung: {
      vorher: vorher.geltung,
      nachher: nachher.geltung,
      spaceVorher: vorher.spaceId ?? null,
      spaceNachher: nachher.spaceId ?? null,
    },
    nutzung: umfang,
    standardBei,
    verbindlichIn,
    bestand:
      "Bestehende Beiträge behalten ihre Werte und ihren Bezug auf die Fassung, mit der sie entstanden sind. Neue Pflichtfelder gelten nur für neue Einreichungen; alte Artikel werden nicht umformatiert.",
  };
}

// ------------------------------------------------------------------------------------------------
// BEGRIFFSPFLEGE — Vorschau auf den betroffenen Bestand, getrennt nach Space.
// ------------------------------------------------------------------------------------------------

export interface BegriffsAuftrag {
  art: BegriffsArt;
  vorgang: BegriffsVorgang;
  name: string;
  ziel: string | null;
  spaceId: string | null;
  begruendung: string;
}

export function pruefeBegriffsAuftrag(
  roh: unknown,
  spaces: readonly SpaceFassung[],
): BegriffsAuftrag {
  const r = (typeof roh === "object" && roh !== null ? roh : {}) as Record<string, unknown>;
  const art = r.art;
  const vorgang = r.vorgang;
  if (art !== "tag" && art !== "kategorie") {
    throw new VorlagenFehler("BEGRIFF_UNGUELTIG", "Art ist „tag“ oder „kategorie“.");
  }
  if (vorgang !== "umbenennen" && vorgang !== "zusammenfuehren" && vorgang !== "ausmustern") {
    throw new VorlagenFehler(
      "BEGRIFF_UNGUELTIG",
      "Vorgang ist „umbenennen“, „zusammenfuehren“ oder „ausmustern“.",
    );
  }
  const name = text(r.name);
  if (!name || name.length > VORLAGEN_GRENZEN.begriff) {
    throw new VorlagenFehler("BEGRIFF_UNGUELTIG", "Der Begriff fehlt oder ist zu lang.");
  }
  const ziel = text(r.ziel);
  if (vorgang !== "ausmustern") {
    if (!ziel || ziel.length > VORLAGEN_GRENZEN.begriff) {
      throw new VorlagenFehler("BEGRIFF_UNGUELTIG", "Der neue Begriff fehlt oder ist zu lang.");
    }
    if (gleich(ziel, name)) {
      throw new VorlagenFehler("BEGRIFF_UNGUELTIG", "Neuer und alter Begriff sind gleich.");
    }
  }
  const spaceId = text(r.spaceId) || null;
  if (spaceId && !spaces.some((s) => s.id === spaceId)) {
    throw new VorlagenFehler("BEGRIFF_UNGUELTIG", "Der Space ist unbekannt.");
  }
  return {
    art,
    vorgang,
    name,
    ziel: vorgang === "ausmustern" ? null : ziel,
    spaceId,
    begruendung: pruefeBegruendung(r.begruendung),
  };
}

function traegt(ko: KnowledgeObject, art: BegriffsArt, name: string): boolean {
  return art === "tag" ? ko.tags.some((t) => gleich(t, name)) : gleich(ko.category ?? "", name);
}

/** Die Ansichten eines Space nach Umbenennen/Zusammenführen eines Tags — andere bleiben, wie sie sind. */
export function ansichtenNachher(
  ansichten: readonly SpaceFassung["ansichten"][number][],
  a: BegriffsAuftrag,
): SpaceFassung["ansichten"] {
  return ansichten.map((x) =>
    a.art === "tag" && a.ziel !== null && gleich(x.tag, a.name) ? { ...x, tag: a.ziel } : { ...x },
  );
}

/**
 * Eine Space-Vorgabe nach Umbenennen/Zusammenführen: erlaubte Kategorien bzw. vorgeschlagene Tags
 * tragen den neuen Begriff (ohne Doppel), damit Einreichungen mit dem neuen Begriff gelten.
 */
export function vorgabeNachher(v: SpaceVorgabeEingabe, a: BegriffsAuftrag): SpaceVorgabeEingabe {
  const ersetze = (liste: readonly string[]) => {
    const raus: string[] = [];
    for (const t of liste) {
      const n = a.ziel !== null && gleich(t, a.name) ? a.ziel : t;
      if (!raus.some((x) => gleich(x, n))) {
        raus.push(n);
      }
    }
    return raus;
  };
  if (a.vorgang === "ausmustern" || a.ziel === null) {
    return { ...v, kategorien: [...v.kategorien], tags: [...v.tags] };
  }
  return a.art === "kategorie"
    ? { ...v, kategorien: ersetze(v.kategorien), tags: [...v.tags] }
    : { ...v, kategorien: [...v.kategorien], tags: ersetze(v.tags) };
}

/** Nennt die Vorgabe den Begriff (Kategorie: erlaubte Kategorien; Tag: vorgeschlagene Tags)? */
export function vorgabeNennt(v: SpaceVorgabeEingabe, art: BegriffsArt, name: string): boolean {
  return (art === "kategorie" ? v.kategorien : v.tags).some((x) => gleich(x, name));
}

export function begriffNachher(
  ko: KnowledgeObject,
  a: BegriffsAuftrag,
): { tags: string[]; category: string } {
  if (a.vorgang === "ausmustern" || a.ziel === null) {
    return { tags: ko.tags, category: ko.category };
  }
  if (a.art === "kategorie") {
    return { tags: ko.tags, category: gleich(ko.category ?? "", a.name) ? a.ziel : ko.category };
  }
  const tags: string[] = [];
  for (const t of ko.tags) {
    const n = gleich(t, a.name) ? a.ziel : t;
    if (!tags.some((x) => gleich(x, n))) {
      tags.push(n);
    }
  }
  return { tags, category: ko.category };
}

export interface BegriffsPlan {
  auftrag: BegriffsAuftrag;
  /** Beim Zusammenführen: trägt der Bestand den Zielbegriff schon? Beim Umbenennen: darf er nicht. */
  zielVorhanden: boolean;
  betroffen: {
    koId: string;
    version: number;
    title: string | null;
    spaceId: string | null;
    vorher: string[];
    nachher: string[];
  }[];
  jeSpace: { spaceId: string | null; name: string | null; betroffen: number; ausserhalb: number }[];
  /** Beiträge AUSSERHALB des Geltungsbereichs, die den Begriff tragen — sie bleiben unverändert. */
  unberuehrt: number;
  /**
   * Gespeicherte Space-Ansichten (Tag-Filter) im Geltungsbereich, die den Tag nennen. Beim
   * Umbenennen/Zusammenführen ziehen sie mit (neue Spacefassung), damit die Zuordnung erhalten
   * bleibt; ein archivierter Space wird nicht geändert und so benannt.
   */
  ansichten: { spaceId: string; spaceName: string; ansicht: string; archiviert: boolean }[];
  /**
   * Space-Vorgaben im Geltungsbereich, die den Begriff nennen (erlaubte Kategorien bzw.
   * vorgeschlagene Tags). Beim Umbenennen/Zusammenführen erhalten sie eine neue Fassung mit dem
   * neuen Begriff; Vorgaben anderer Spaces bleiben unverändert.
   */
  vorgaben: {
    spaceId: string;
    spaceName: string | null;
    version: number;
    vorher: string[];
    nachher: string[];
  }[];
  /** Ausmustern ändert keinen Inhalt; Umbenennen/Zusammenführen ändern nur die genannten Beiträge. */
  wirkung: string;
  grundlage: string;
}

export function begriffsPlan(
  a: BegriffsAuftrag,
  alle: readonly KnowledgeObject[],
  spaces: readonly SpaceFassung[],
  sieht: (ko: KnowledgeObject) => boolean,
  spaceVorgaben: readonly SpaceVorgabe[] = [],
): BegriffsPlan {
  const name = (id: string | null) => (id ? (spaces.find((s) => s.id === id)?.name ?? null) : null);
  const imBereich = (ko: KnowledgeObject) =>
    a.spaceId === null || (typeof ko.spaceId === "string" && ko.spaceId === a.spaceId);
  const tragend = [...alle]
    .filter((ko) => traegt(ko, a.art, a.name))
    .sort((x, y) => x.id.localeCompare(y.id));
  const betroffen = tragend.filter(imBereich);
  const zaehler = new Map<string | null, { betroffen: number; ausserhalb: number }>();
  for (const ko of tragend) {
    const key = typeof ko.spaceId === "string" ? ko.spaceId : null;
    const z = zaehler.get(key) ?? { betroffen: 0, ausserhalb: 0 };
    if (imBereich(ko)) {
      z.betroffen += 1;
    } else {
      z.ausserhalb += 1;
    }
    zaehler.set(key, z);
  }
  const zielVorhanden =
    a.ziel !== null && alle.some((ko) => imBereich(ko) && traegt(ko, a.art, a.ziel as string));
  const zeilen = betroffen.map((ko) => {
    const nach = begriffNachher(ko, a);
    return {
      koId: ko.id,
      version: ko.version,
      title: sieht(ko) ? ko.title : null,
      spaceId: typeof ko.spaceId === "string" ? ko.spaceId : null,
      vorher: a.art === "tag" ? ko.tags : [ko.category],
      nachher: a.art === "tag" ? nach.tags : [nach.category],
    };
  });
  const ansichten =
    a.art === "tag"
      ? spaces
          .filter((s) => a.spaceId === null || s.id === a.spaceId)
          .flatMap((s) =>
            s.ansichten
              .filter((x) => gleich(x.tag, a.name))
              .map((x) => ({
                spaceId: s.id,
                spaceName: s.name,
                ansicht: x.name,
                archiviert: istArchiviert(s),
              })),
          )
      : [];
  const liste = (v: SpaceVorgabeEingabe) => [...(a.art === "kategorie" ? v.kategorien : v.tags)];
  const vorgaben = [...spaceVorgaben]
    .filter(
      (v) => (a.spaceId === null || v.spaceId === a.spaceId) && vorgabeNennt(v, a.art, a.name),
    )
    .sort((x, y) => x.spaceId.localeCompare(y.spaceId))
    .map((v) => ({
      spaceId: v.spaceId,
      spaceName: name(v.spaceId),
      version: v.version,
      vorher: liste(v),
      nachher: liste(vorgabeNachher(v, a)),
    }));
  return {
    auftrag: a,
    zielVorhanden,
    betroffen: zeilen,
    jeSpace: [...zaehler].map(([spaceId, z]) => ({ spaceId, name: name(spaceId), ...z })),
    unberuehrt: tragend.length - betroffen.length,
    ansichten,
    vorgaben,
    wirkung:
      a.vorgang === "ausmustern"
        ? "Ausmustern entfernt den Begriff aus keinem Beitrag. Neue Eingaben im Geltungsbereich werden auf den ausgemusterten Begriff hingewiesen."
        : `Die ${zeilen.length} genannten Beiträge tragen danach „${a.ziel ?? ""}“ statt „${a.name}“; ihre Inhalte und Fassungen bleiben unverändert. Suche und Filter finden sie unter dem neuen Begriff; der alte Begriff verweist bei neuen Eingaben auf den neuen.`,
    grundlage: createHash("sha256")
      .update(
        JSON.stringify({
          a,
          zeilen: zeilen.map((z) => [z.koId, z.version, z.vorher]),
          ausserhalb: tragend.length - betroffen.length,
          ansichten: ansichten.map((x) => [x.spaceId, x.ansicht, x.archiviert]),
          vorgaben: vorgaben.map((x) => [x.spaceId, x.version, x.vorher]),
        }),
      )
      .digest("hex")
      .slice(0, 32),
  };
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE — eine Tabelle, jede Änderung eine neue, unveränderliche Fassung.
// ------------------------------------------------------------------------------------------------
//
// `art` trennt die fünf Bestände: `vorlage` (Schlüssel = Vorlagenkennung), `standard` (Schlüssel =
// Konto), `space-vorgabe` (Schlüssel = Space), `nutzung` (Schlüssel = Wissensobjekt, nur Version 1)
// und `begriff` (Schlüssel = `begriffSchluessel`). Der zusammengesetzte Primärschlüssel ist die
// Nebenläufigkeitsregel: ein zweiter Schreiber derselben Version verliert (→ 409).

export type AblageArt = "vorlage" | "standard" | "space-vorgabe" | "nutzung" | "begriff";

export interface AblageFassung {
  version: number;
  geaendertVon: string;
  geaendertAm: string;
}

export interface StandardEintrag extends AblageFassung {
  nutzer: string;
  vorlageId: string | null;
}

export interface VorlagenAblage {
  /** Je Schlüssel die jüngste Fassung. */
  aktuelle<T extends AblageFassung>(art: AblageArt): Promise<T[]>;
  /** Alle Fassungen eines Schlüssels, aufsteigend — leer, wenn es ihn nicht gibt. */
  fassungen<T extends AblageFassung>(art: AblageArt, schluessel: string): Promise<T[]>;
  /** `false`, wenn es diese Version schon gibt (paralleler Schreiber). */
  lege(art: AblageArt, schluessel: string, fassung: AblageFassung): Promise<boolean>;
}

export class InMemoryVorlagenAblage implements VorlagenAblage {
  private readonly zeilen = new Map<string, AblageFassung[]>();

  private key(art: AblageArt, schluessel: string): string {
    return `${art}\u0000${schluessel}`;
  }

  aktuelle<T extends AblageFassung>(art: AblageArt): Promise<T[]> {
    const raus: T[] = [];
    for (const [k, liste] of this.zeilen) {
      const letzte = liste[liste.length - 1];
      if (k.startsWith(`${art}\u0000`) && letzte) {
        raus.push(structuredClone(letzte) as T);
      }
    }
    return Promise.resolve(raus);
  }

  fassungen<T extends AblageFassung>(art: AblageArt, schluessel: string): Promise<T[]> {
    return Promise.resolve(
      (this.zeilen.get(this.key(art, schluessel)) ?? []).map((f) => structuredClone(f) as T),
    );
  }

  lege(art: AblageArt, schluessel: string, fassung: AblageFassung): Promise<boolean> {
    const k = this.key(art, schluessel);
    const liste = this.zeilen.get(k) ?? [];
    if (liste.some((f) => f.version === fassung.version)) {
      return Promise.resolve(false);
    }
    liste.push(structuredClone(fassung));
    liste.sort((a, b) => a.version - b.version);
    this.zeilen.set(k, liste);
    return Promise.resolve(true);
  }
}

/**
 * Rein additiv und wiederholbar: `CREATE TABLE IF NOT EXISTS`, kein DROP, kein DELETE, kein UPDATE,
 * kein Fremdschlüssel, kein Seed. Die Standardvorlagen stehen im Code, nicht in der Tabelle.
 */
export const VORLAGEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS vorlagen_fassungen (
  art text NOT NULL,
  schluessel text NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  PRIMARY KEY (art, schluessel, version)
);
`;

export class PgVorlagenAblage implements VorlagenAblage {
  constructor(private readonly pool: Pool) {}

  async aktuelle<T extends AblageFassung>(art: AblageArt): Promise<T[]> {
    const res = await this.pool.query<{ data: T }>(
      `SELECT DISTINCT ON (schluessel) data
         FROM vorlagen_fassungen
        WHERE art=$1
        ORDER BY schluessel, version DESC`,
      [art],
    );
    return res.rows.map((z) => z.data);
  }

  async fassungen<T extends AblageFassung>(art: AblageArt, schluessel: string): Promise<T[]> {
    const res = await this.pool.query<{ data: T }>(
      "SELECT data FROM vorlagen_fassungen WHERE art=$1 AND schluessel=$2 ORDER BY version ASC",
      [art, schluessel],
    );
    return res.rows.map((z) => z.data);
  }

  async lege(art: AblageArt, schluessel: string, fassung: AblageFassung): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO vorlagen_fassungen(art, schluessel, version, data, geaendert_von, geaendert_am)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT (art, schluessel, version) DO NOTHING`,
      [
        art,
        schluessel,
        fassung.version,
        JSON.stringify(fassung),
        fassung.geaendertVon,
        fassung.geaendertAm,
      ],
    );
    return (res.rowCount ?? 0) === 1;
  }
}

// ------------------------------------------------------------------------------------------------
// DER EINREICHWEG — dieselbe Prüfung an `POST /api/kos`, `/api/kos/from-document` und am Promote.
// ------------------------------------------------------------------------------------------------

export type EinreichEntscheid =
  | { ok: true; bezug: VorlagenBezug | null }
  | {
      ok: false;
      status: 400 | 403 | 404 | 409;
      error: string;
      message: string;
      befunde?: PflichtBefund[];
    };

export interface EinreichInhalt {
  bodyHtml?: string | null | undefined;
  category?: string | undefined;
  tags?: readonly string[] | undefined;
}

export interface VorlagenEinreichungPort {
  pruefe(
    bezug: unknown,
    inhalt: EinreichInhalt,
    nutzer: VorlagenNutzer,
  ): Promise<EinreichEntscheid>;
  /** Nach der Anlage: Bezug vermerken und — bei einem gewählten Space — dort ablegen. */
  vermerke(koId: string, bezug: VorlagenBezug | null, nutzer: VorlagenNutzer): Promise<void>;
}

export interface VorlagenDienstDeps {
  ablage: VorlagenAblage;
  spaces: { aktuelle(): Promise<SpaceFassung[]> };
  /** Legt das frische Objekt in den gewählten Space (`KoService.setLeadingSpace`, erwartet: ohne). */
  inSpaceLegen?: (koId: string, spaceId: string, akteur: string) => Promise<void>;
  /** Derselbe Prüfprotokolldienst wie an den übrigen Routen — kein nachgebauter Typ. */
  audit?: AuditService;
  jetzt?: () => Date;
}

/** Alle Vorlagen in ihrer jüngsten Fassung: die eingebauten und die abgelegten. */
export async function alleVorlagen(ablage: VorlagenAblage): Promise<VorlageFassung[]> {
  return [...STANDARD_VORLAGEN, ...(await ablage.aktuelle<VorlageFassung>("vorlage"))];
}

export async function vorlagenFassungen(
  ablage: VorlagenAblage,
  id: string,
): Promise<VorlageFassung[]> {
  const std = STANDARD_VORLAGEN.find((v) => v.id === id);
  return std ? [std] : ablage.fassungen<VorlageFassung>("vorlage", id);
}

export async function spaceVorgabe(
  ablage: VorlagenAblage,
  spaceId: string,
): Promise<SpaceVorgabe | undefined> {
  return (await ablage.fassungen<SpaceVorgabe>("space-vorgabe", spaceId)).at(-1);
}

export function vorlagenEinreichung(deps: VorlagenDienstDeps): VorlagenEinreichungPort {
  const jetzt = deps.jetzt ?? (() => new Date());
  return {
    async pruefe(roh, inhalt, nutzer) {
      const bezug = bezugAus(roh);
      if (bezug === "ungueltig") {
        return {
          ok: false,
          status: 400,
          error: "VORLAGE_BEZUG_UNGUELTIG",
          message: "Der Vorlagenbezug ist { id, version, spaceId? } oder null (freie Eingabe).",
        };
      }
      const spaces = await deps.spaces.aktuelle();
      let vorlage: VorlageFassung | null = null;
      if (bezug) {
        const fassungen = await vorlagenFassungen(deps.ablage, bezug.id);
        const aktuell = fassungen.at(-1);
        // Eine ältere Fassung bleibt gültig (begonnen vor einer Änderung), eine ausgemusterte auch —
        // nichts, was schon eingegeben ist, scheitert daran. Sehen muss man die Vorlage aber.
        vorlage = fassungen.find((f) => f.version === bezug.version) ?? null;
        if (!vorlage || !aktuell || !darfVorlageSehen(aktuell, nutzer, spaces)) {
          return {
            ok: false,
            status: 404,
            error: "VORLAGE_UNBEKANNT",
            message: "Diese Vorlage oder Fassung ist nicht (mehr) verfügbar.",
          };
        }
      }
      let space: SpaceFassung | undefined;
      if (bezug?.spaceId) {
        space = spaces.find((s) => s.id === bezug.spaceId);
        if (
          !space ||
          !(darfSpaceInhalteLesen(space, nutzer.id) || darfSpaceBearbeiten(space, nutzer))
        ) {
          return { ok: false, status: 404, error: "NOT_FOUND", message: "Space nicht gefunden." };
        }
        if (istArchiviert(space)) {
          return {
            ok: false,
            status: 409,
            error: "SPACE_ARCHIVIERT",
            message: "Dieser Space ist archiviert und nimmt keine Beiträge auf.",
          };
        }
        if (!darfInSpaceSchreiben(space, nutzer)) {
          return {
            ok: false,
            status: 403,
            error: "FORBIDDEN",
            message: "Für diesen Space fehlt das Schreibrecht.",
          };
        }
      }
      const vorgabe = space ? ((await spaceVorgabe(deps.ablage, space.id)) ?? null) : null;
      const verbindlichId = vorgabe?.verbindlicheVorlageId ?? null;
      const verbindlich = verbindlichId
        ? ((await vorlagenFassungen(deps.ablage, verbindlichId)).at(-1) ?? null)
        : null;
      const befunde = pruefeAngaben({
        bodyHtml: inhalt.bodyHtml ?? "",
        category: inhalt.category ?? "",
        tags: inhalt.tags ?? [],
        vorlage,
        // Ausgemustert oder verschwunden: die Pflicht fällt weg statt die Eingabe zu blockieren.
        verbindlich: verbindlich && !verbindlich.ausgemustert ? verbindlich : null,
        vorgabe,
        spaceId: space?.id ?? null,
        spaceName: space?.name ?? null,
        begriffe: await deps.ablage.aktuelle<BegriffEintrag>("begriff"),
      });
      if (befunde.length > 0) {
        return {
          ok: false,
          status: 400,
          error: "PFLICHTANGABEN_FEHLEN",
          message: befunde.map((b) => b.meldung).join(" "),
          befunde,
        };
      }
      return { ok: true, bezug };
    },

    async vermerke(koId, bezug, nutzer) {
      if (!bezug) {
        return;
      }
      const vorlage = (await vorlagenFassungen(deps.ablage, bezug.id)).find(
        (f) => f.version === bezug.version,
      );
      const am = jetzt().toISOString();
      const eintrag: NutzungsEintrag = {
        koId,
        version: 1,
        vorlageId: bezug.id,
        vorlagenVersion: bezug.version,
        vorlagenName: vorlage?.name ?? bezug.id,
        spaceId: bezug.spaceId,
        geaendertVon: nutzer.id,
        geaendertAm: am,
      };
      // Eine Wiederholung desselben Vorgangs findet den Eintrag schon vor — er bleibt, wie er ist.
      await deps.ablage.lege("nutzung", koId, eintrag);
      if (bezug.spaceId && deps.inSpaceLegen) {
        await deps.inSpaceLegen(koId, bezug.spaceId, nutzer.id);
      }
      await deps.audit?.record({
        actor: nutzer.id,
        action: "vorlage.verwendet",
        target: koId,
        payload: { vorlageId: bezug.id, version: bezug.version, spaceId: bezug.spaceId },
      });
    },
  };
}
