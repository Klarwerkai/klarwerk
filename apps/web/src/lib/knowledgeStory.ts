// SCRUM-377: DOM-freie, app-weite „Knowledge-Rescue"-Story für leere/erste Zustände. Erzählt über
// mehrere Kernflächen hinweg dieselbe ruhige Kernbotschaft — Klarwerk sichert Erfahrungswissen,
// bevor es verloren geht — und ordnet jede Fläche in den Knowledge-OS-Kreis (Erfassen → Validieren →
// Nutzen → Aktuell halten) ein, damit Capture → Review → Use verständlicher wird. Leere Zustände sind
// dadurch keine Sackgassen, sondern zeigen den nächsten sinnvollen Schritt (die echten Routen liefern
// die vorhandenen EmptyState-CTAs). Ehrlich: nichts wird automatisch validiert — Wissen gilt erst nach
// der Prüfung als gesichert. KEIN Score, KEINE Punkte/Gamification, KEIN Backend, kein DOM, keine
// Mutation. Reine Daten/i18n-Ableitung; wiederverwendet die vorhandene Kreissprache (phaseLabelKey).

import { type KnowledgeOsPhase, phaseLabelKey } from "./taskAction";

// Die Flächen mit echten leeren/ersten Zuständen. R-0956 („Jede leere Liste erklärt, warum es
// KLARWERK gibt, wo man gerade im Wissenskreis steht und was der nächste sinnvolle Schritt ist"):
// dazugekommen sind die Risikoseite, die Schlagwort-Nachbarschaft, das Audit-Protokoll, Lücken,
// Lebenszyklus, Dubletten und (Nacharbeit 7) JEDE weitere Liste — die Teillisten eines Beitrags,
// Entwürfe, Verwaltungs-, Import- und Auswertungslisten, Räume, Ausgangsprüfung, Wissensnetz,
// Meldungen, Ruhestandshorizont, Lernpfad, Seitenhilfe und Konflikte. Die ersten zehn sind zugleich
// `EmptyStateContext` (mit Schritt-Links); die übrigen nennen ihren nächsten Schritt im Satz.
export type StorySurface =
  | "start"
  | "tasks"
  | "library"
  | "validation"
  | "risk"
  | "neighborhood"
  | "audit"
  | "gaps"
  | "lifecycle"
  | "duplicates"
  | "objekt"
  | "entwuerfe"
  | "verwaltung"
  | "auswertung"
  | "import"
  | "anleitung"
  | "spaces"
  | "ausgang"
  | "wissensnetz"
  | "meldungen"
  | "horizont"
  | "lernpfad"
  | "hilfe"
  | "conflicts"
  | "gliederung";

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand die Liste `KNOWLEDGE_STORY_SURFACES`. Kein
// Produktweg las sie — die Leerzustände holen ihre Zeile je Kontext über `knowledgeStory(context)`
// (`components/EmptyStateCtas.tsx`, R-0991 Nr. 34). Die Liste war Prüfzeug und steht jetzt im Test
// (`tests/app/knowledge-story.test.ts`); die Menge der Flächen trägt der Typ oben.

// Jede Fläche steht für eine reale Phase im Knowledge-OS-Kreis — dieselbe Sprache wie Start/MyTasks.
const SURFACE_PHASE: Record<StorySurface, KnowledgeOsPhase> = {
  start: "capture", // Einstieg: den Kreis mit Erfassen starten.
  tasks: "validate", // persönliche Prüf-/Nacharbeits-Warteschlange.
  library: "use", // gesichertes Wissen quellengebunden nutzen.
  validation: "validate", // Team-Prüfung, bevor Wissen als gesichert gilt.
  risk: "capture", // ohne erfasstes Wissen je Bereich gibt es kein Risikobild.
  neighborhood: "use", // wer einen Beitrag liest, nutzt gesichertes Wissen.
  audit: "maintain", // das Protokoll macht nachvollziehbar, was im Kreis geschah.
  gaps: "use", // eine Lücke entsteht beim Nutzen: eine Frage findet keine gesicherte Antwort.
  lifecycle: "maintain", // Fälliges wird erneut geprüft, damit es aktuell bleibt.
  duplicates: "validate", // Überschneidungen klärt das Team beim Prüfen.
  objekt: "use", // die Teillisten eines Beitrags sieht, wer ihn liest.
  entwuerfe: "capture", // ein Entwurf ist Erfassen vor der Prüfung.
  verwaltung: "maintain", // Verwaltung hält den Bestand aktuell.
  auswertung: "maintain", // Auswertungen entstehen aus dem geprüften Bestand.
  import: "capture", // ein Import bringt vorhandenes Wissen in den Kreis.
  anleitung: "use", // Anleitungen bündeln geprüftes Wissen zum Nutzen.
  spaces: "use", // Räume ordnen den nutzbaren Bestand.
  ausgang: "validate", // die Ausgangsprüfung ist eine Prüfung vor der Weitergabe.
  wissensnetz: "use", // das Netz zeigt, wie der Bestand zusammenhängt.
  meldungen: "maintain", // Meldungen rufen zum Aktuellhalten.
  horizont: "maintain", // der Ruhestandsblick hält Wissen verfügbar.
  lernpfad: "use", // ein Lernpfad führt durch nutzbares Wissen.
  hilfe: "use", // die Hilfe erklärt das Nutzen.
  conflicts: "validate", // Konflikte klärt das Team beim Prüfen.
  gliederung: "capture", // Überschriften setzt, wer einen Beitrag schreibt.
};

export interface KnowledgeStory {
  // Geteilte Kernbotschaft (Rescue-Story) — auf allen Flächen gleich.
  titleKey: string;
  // Flächenspezifische, ehrliche Einordnung des leeren/ersten Zustands + nächster sinnvoller Sinn.
  leadKey: string;
  // Phase im Knowledge-OS-Kreis, für die diese Fläche steht.
  phase: KnowledgeOsPhase;
  // Kreis-Label der Phase (cycle.<phase>.label) — EINE Vokabel über die ganze App.
  phaseLabelKey: string;
  // Ehrlicher Dauerhinweis: nichts wird automatisch validiert.
  honestKey: string;
}

export function knowledgeStory(surface: StorySurface): KnowledgeStory {
  const phase = SURFACE_PHASE[surface];
  return {
    titleKey: "story.rescue.title",
    leadKey: `story.surface.${surface}.lead`,
    phase,
    phaseLabelKey: phaseLabelKey(phase),
    honestKey: "story.honest",
  };
}
