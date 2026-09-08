// ================================================================================================
// JOB 3338 · ISO-HILFE — die vier ISO-Kapitel der Hilfe, DE/EN im Modul.
// ================================================================================================
//
// WOHER DIE TEXTE STAMMEN. Sie sind die redaktionelle Lieferung
// `gespraech/advisor-freitag/hilfe/ISO-HILFE-DE-EN.json` (Stand der Quellenprüfung 08.09.2026) und
// stehen hier WÖRTLICH, nicht umformuliert. Wer sie ändert, ändert eine abgenommene Lieferung.
//
// WARUM EIN EIGENES MODUL UND NICHT `i18n.ts`. Dort ist `en: typeof de` (i18n.ts:5595) — jeder neue
// Schlüssel zwingt drei Sprachblöcke in einer 15 000-Zeilen-Datei, an der parallel gearbeitet wird
// (3323/Admin-Nav). Das Themenmodell der Hilfe trägt den Umweg: `Help.tsx` löst i18n-Schlüssel zu
// Texten auf und sucht DOM-frei auf dem AUFGELÖSTEN Text (`helpTopics.ts:96`). Ein Kapitel, das
// seinen Text schon fertig mitbringt, passt in denselben Suchraum, ohne ihn zu verändern.
//
// WAS DIESE TEXTE NICHT TUN. Sie versprechen keine Konformität und keine Zertifizierung. Jede
// Aussage über Klarwerk steht neben ihrer Grenze („allein“, „weder … noch“, „keine“). Der Wächter
// `tests/iso-hilfe/iso-wortlaut.test.ts` misst genau das — an diesem Modul und an der Fläche.
//
// `2701` IST EIN SUCHALIAS, KEINE NORMBEZEICHNUNG. Pedi tippt ihn (Freigabe 08.09.), also findet er.
// Er steht deshalb ausschliesslich in `tags` — sichtbare Titel und Fliesstexte nennen „ISO/IEC 27001“.

/** Die beiden Sprachen der Lieferung. `nl` fällt auf `de` zurück — wie `fallbackLng` in i18n.ts. */
export type IsoHelpSprache = "de" | "en";

export interface IsoHelpTopicDef {
  id: string;
  /** Sichtbarer Titel je Sprache — nennt IMMER die richtige Normbezeichnung. */
  title: Readonly<Record<IsoHelpSprache, string>>;
  /** Fliesstext je Sprache. Absätze sind durch eine Leerzeile getrennt (`\n\n`). */
  body: Readonly<Record<IsoHelpSprache, string>>;
  /** Interner Handlungslink — eine echte App-Route, wie bei den bestehenden Kapiteln. */
  to: string;
  /** Suchbegriffe (sprachunabhängig, deshalb wirkt der Alias in DE und EN gleich). */
  tags: readonly string[];
  /** EXTERNE Quellen. Getrennt vom Handlungslink: sie verlassen die App. */
  sources: readonly string[];
}

export const ISO_HELP_TOPICS: readonly IsoHelpTopicDef[] = [
  {
    id: "iso-overview",
    title: {
      de: "ISO 9001 und ISO 27001: Was bedeutet ISO?",
      en: "ISO 9001 and ISO 27001: what does ISO mean?",
    },
    body: {
      de: "ISO ist der internationale Kurzname der International Organization for Standardization, der Internationalen Organisation für Normung. Eine Norm beschreibt gemeinsam vereinbarte Anforderungen oder Vorgehensweisen.\n\nISO 9001 behandelt Qualitätsmanagement: Wie organisiert ein Unternehmen seine Arbeit, erfüllt Anforderungen und verbessert seine Abläufe? ISO/IEC 27001 behandelt Informationssicherheitsmanagement: Wie erkennt und behandelt ein Unternehmen Risiken für seine Informationen?\n\nKlarwerk kann helfen, das dafür benötigte Wissen und zugehörige Belege auffindbar und nachvollziehbar zu halten. Die Nutzung einer Software allein erfüllt jedoch keine dieser Normen. Zertifiziert wird das Managementsystem des Unternehmens im festgelegten Geltungsbereich durch eine externe Zertifizierungsstelle. ISO selbst stellt keine Zertifikate aus.",
      en: "ISO is the international short name of the International Organization for Standardization. A standard describes agreed requirements or ways of working.\n\nISO 9001 concerns quality management: how does an organization organize its work, meet requirements and improve its processes? ISO/IEC 27001 concerns information security management: how does an organization identify and treat risks to its information?\n\nKlarwerk can help keep the necessary knowledge and supporting evidence accessible and traceable. Using software alone does not meet either standard. An external certification body assesses the organization's management system within its defined scope. ISO itself does not issue certificates.",
    },
    to: "/bibliothek",
    tags: [
      "iso",
      "9001",
      "iso9001",
      "ISO 9001",
      "27001",
      "2701",
      "iso27001",
      "iso2701",
      "ISO 2701",
      "ISO/IEC 27001",
      "norm",
      "standard",
      "zertifizierung",
      "certification",
    ],
    sources: ["https://www.iso.org/about", "https://www.iso.org/certification.html"],
  },
  {
    id: "iso-9001",
    title: {
      de: "ISO 9001: Wie unterstützt Klarwerk die Qualitätsarbeit?",
      en: "ISO 9001: how can Klarwerk support quality management?",
    },
    body: {
      de: "ISO 9001 legt Anforderungen an ein Qualitätsmanagementsystem fest. Dazu gehören geregelte Abläufe, Verantwortung, der Umgang mit benötigtem Wissen und dokumentierten Informationen sowie fortlaufende Verbesserung.\n\nKlarwerk kann dabei unterstützen, Arbeitsanweisungen und Erfahrungen zu erfassen, Quellen wiederzufinden und Wissen fachlich prüfen zu lassen. Der Nutzen entsteht im Alltag: Mitarbeiter müssen eine Regel nicht immer wieder neu suchen oder aus dem Gedächtnis rekonstruieren.\n\nBeispiel: Eine Arbeitsanweisung wird zusammen mit ihrer Quelle geprüft. Für eine spätere Prüfung muss zusätzlich nachvollziehbar sein, welche Fassung galt, wer zuständig war und ob der beschriebene Arbeitsschritt tatsächlich ausgeführt wurde. Eine freigegebene Anweisung allein beweist die Ausführung nicht.\n\nOb damit eine konkrete Normanforderung erfüllt ist, hängt von den tatsächlich eingesetzten Funktionen, den Unternehmensprozessen und ihren Nachweisen ab. Klarwerk unterstützt diese Arbeit; es garantiert weder die Erstzertifizierung noch deren Erhalt.",
      en: "ISO 9001 sets requirements for a quality management system. These include defined processes, responsibilities, necessary organizational knowledge, documented information and continual improvement.\n\nKlarwerk can support this work by helping people capture instructions and experience, find sources and have knowledge reviewed by a responsible person. The everyday benefit is that employees do not have to keep searching for a rule or reconstructing it from memory.\n\nFor example, an instruction is reviewed with its source. A later assessment also needs evidence of which version applied, who was responsible and whether the work was actually carried out. Approval of an instruction alone does not prove execution.\n\nWhether a specific requirement is met depends on the functions actually in use, the organization's processes and their evidence. Klarwerk supports this work; it does not guarantee initial or continued certification.",
    },
    to: "/validierung",
    tags: [
      "9001",
      "iso9001",
      "ISO 9001",
      "qualitätsmanagement",
      "qualitaetsmanagement",
      "quality",
      "qm",
      "qms",
      "arbeitsanweisung",
      "dokumentation",
      "wissen",
      "knowledge",
      "zertifizierung",
      "certification",
    ],
    sources: [
      "https://www.iso.org/standard/9001",
      "https://www.iso.org/files/live/sites/isoorg/files/standards/docs/en/iso_9001_2015_guidance_documented_information.pdf",
    ],
  },
  {
    id: "iso-27001",
    title: {
      de: "ISO/IEC 27001: Wie unterstützt Klarwerk Informationssicherheit?",
      en: "ISO/IEC 27001: how can Klarwerk support information security?",
    },
    body: {
      de: "ISO/IEC 27001 beschreibt Anforderungen an ein Managementsystem für Informationssicherheit, kurz ISMS. Es soll Risiken für Vertraulichkeit, Integrität und Verfügbarkeit systematisch behandeln: Wer darf Informationen sehen? Sind sie korrekt und vor unbefugten Änderungen geschützt? Sind sie verfügbar, wenn sie benötigt werden?\n\nKlarwerk kann die zugehörige Wissensarbeit unterstützen, etwa Sicherheitsanweisungen, Herkunft, fachliche Prüfungen und offene Widersprüche nachvollziehbar zusammenzuführen. Zugriffsregeln und Vertraulichkeit müssen dazu passend eingerichtet und ihre tatsächliche Wirkung geprüft werden.\n\nBeispiel: Eine neue Router-Anleitung widerspricht einer internen Regel. Der Widerspruch wird geprüft und die Regel korrigiert. Ob der Router anschließend wirklich sicher konfiguriert wurde, braucht einen eigenen Nachweis.\n\nRisikoanalyse, geeignete Sicherheitsmaßnahmen und ihre Wirksamkeitsprüfung bleiben Aufgaben des Unternehmens. Eine gespeicherte Sicherheitsanweisung, ein KI-Urteil oder der Einsatz von Klarwerk allein belegen keine ISO-27001-Konformität.",
      en: "ISO/IEC 27001 defines requirements for an information security management system, or ISMS. It addresses risks to confidentiality, integrity and availability: who may see information, is it accurate and protected against unauthorized changes, and is it available when needed?\n\nKlarwerk can support the associated knowledge work by bringing security instructions, provenance, human reviews and unresolved contradictions together. Access rules and confidentiality settings must be configured appropriately and their actual effectiveness verified.\n\nFor example, a new router instruction contradicts an internal policy. The conflict is reviewed and the policy corrected. Whether the router was then configured securely requires separate evidence.\n\nRisk assessment, suitable security controls and verification of their effectiveness remain the organization's responsibilities. A stored security instruction, an AI judgment or using Klarwerk alone does not establish conformity with ISO 27001.",
    },
    to: "/bibliothek",
    tags: [
      "27001",
      "2701",
      "iso27001",
      "iso2701",
      "ISO 27001",
      "ISO 2701",
      "ISO/IEC 27001",
      "isms",
      "informationssicherheit",
      "information security",
      "vertraulichkeit",
      "confidentiality",
      "risiko",
      "risk",
      "zertifizierung",
      "certification",
    ],
    sources: ["https://www.iso.org/standard/27001"],
  },
  {
    id: "iso-maintain",
    title: {
      de: "Zertifizierung vorbereiten, erhalten und Nachweise pflegen",
      en: "Prepare for certification, maintain it and keep evidence current",
    },
    body: {
      de: "Der positive Beitrag von Klarwerk liegt in besser zugänglichem Wissen und nachvollziehbaren Belegen. Das kann die Vorbereitung auf eine Zertifizierung und die laufende Arbeit nach ISO 9001 oder ISO 27001 erleichtern — sofern die Abläufe tatsächlich gelebt und überprüft werden.\n\nFür jeden wichtigen Vorgang sollten Sie beantworten können: Welche Regel und Fassung gilt? Woher stammt sie? Wer hat sie geprüft oder freigegeben? Welcher Beleg zeigt die Durchführung? Was ist noch offen, und wer kümmert sich darum? Halten Sie diese Angaben aktuell und überprüfen Sie sie nach Änderungen.\n\nEin Audit ist eine systematische Prüfung anhand festgelegter Kriterien. Fehlende oder veraltete Belege müssen dabei als Lücke erkennbar bleiben. Eine KI-Antwort ist kein Ersatz für einen Nachweis. Welche weiteren Unterlagen und Kontrollen notwendig sind, richtet sich nach der geltenden Normfassung, dem Geltungsbereich und den Risiken Ihres Unternehmens.",
      en: "Klarwerk's positive contribution is more accessible knowledge and traceable evidence. This can make certification preparation and ongoing work under ISO 9001 or ISO 27001 easier, provided the processes are actually followed and reviewed.\n\nFor each important activity, ask: which policy and version applies, where did it come from, who reviewed or approved it, what evidence shows execution, what remains open and who owns the next action? Keep these details current and review them after changes.\n\nAn audit is a systematic assessment against defined criteria. Missing or outdated evidence must remain visible as a gap. An AI answer does not replace evidence. Additional documents and controls depend on the applicable edition of the standard, your organization's scope and its risks.",
    },
    to: "/aufgaben",
    tags: [
      "9001",
      "27001",
      "2701",
      "iso9001",
      "iso27001",
      "iso2701",
      "ISO 2701",
      "audit",
      "nachweis",
      "evidence",
      "zertifizierung",
      "certification",
      "rezertifizierung",
      "recertification",
      "aufrechterhalten",
      "maintain",
      "nachhalten",
    ],
    sources: [
      "https://www.iso.org/certification.html",
      "https://www.iso.org/standard/9001",
      "https://www.iso.org/standard/27001",
    ],
  },
];

/**
 * Die wenigen Beschriftungen, die der Quellenblock braucht. Sie liegen HIER und nicht in `i18n.ts`
 * — aus demselben Grund wie die Kapiteltexte (siehe Kopf). Es sind KEINE Aussagen über ISO.
 */
export const ISO_HELP_LABELS = {
  /** Überschrift des Quellenblocks. Das Wort „extern" steht darin, nicht nur im Kleingedruckten. */
  sources: { de: "Offizielle Quellen (extern)", en: "Official sources (external)" },
  /** Ankündigung AM LINK — der Nutzer weiss vor dem Klick, dass die App verlassen wird. */
  newTab: { de: "öffnet neuen Tab", en: "opens in a new tab" },
  /** Die Merkmalsleiste heisst bei ISO-Kapiteln ausdrücklich „Suchbegriffe": `2701` ist einer. */
  searchTerms: { de: "Suchbegriffe", en: "Search terms" },
} as const;

/**
 * i18n-Sprachcode → Sprache der Lieferung. Alles ausser `en*` (also `de`, `nl`, Unbekanntes) fällt
 * auf `de` — dieselbe Regel wie `fallbackLng: "de"` in `i18n.ts:15001`.
 */
export function isoHelpSprache(lng: string | undefined | null): IsoHelpSprache {
  return typeof lng === "string" && lng.toLowerCase().startsWith("en") ? "en" : "de";
}

/**
 * Fliesstext → Absätze. Die Lieferung trennt Absätze durch eine Leerzeile; ohne diese Zerlegung
 * stünde ein 1500-Zeichen-Block in einer Karte („unlesbarer Textblock", ISO-HILFE-AUFTRAG.md §17).
 * Ein Text ohne Leerzeile ergibt genau einen Absatz — die bestehenden Kapitel ändern sich nicht.
 */
export function helpAbsaetze(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((absatz) => absatz.trim())
    .filter((absatz) => absatz.length > 0);
}

/** Anzeigeform einer Quell-URL: ohne Schema, ohne Schlussstrich — lesbar, aber vollständig. */
export function isoQuellenAnzeige(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
