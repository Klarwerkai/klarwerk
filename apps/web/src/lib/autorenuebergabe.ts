// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG (R-0961, Teil Autorenübergabe) — WANN EINE ÜBERGABE ANSTEHT.
// ================================================================================================
//
// Reine, DOM-freie Regel. Der Server rechnet mit ihr die wartenden Übergaben
// (`services/app/src/routes/aufgaben-zaehler-routes.ts`); die Aufgabenseite und das Kopfband zeigen
// nur, was er liefert. Eine zweite Fassung der Regel gibt es nicht.
//
// QUELLE: Peters Entscheidungen vom 11.10.2026 (QUELLEN-FACHHILFE-PETER-ENTSCHEIDUNGEN-20261011,
// Fragen 23 und 24):
//   · 23: „das wissen gehoert der firma, nicht der person". Die Verantwortung wird übertragen;
//     gemeinsam genutztes Wissen soll einen ERREICHBAREN Verantwortlichen behalten.
//   · 24: Eine wartende Autorenübergabe entsteht bei gelöschten oder dauerhaft ausgeschiedenen
//     Autoren sowie auf ausdrückliche Anforderung von Autor oder zuständiger Verwaltungsrolle.
//     Standardpriorität „Heute", bei kritischem Wissen höher.
//
// WIE DIE ENTSCHEIDUNG AUF DEN BESTAND ABGEBILDET IST (je Grund EIN vorhandener Systemzustand):
//   · `konto-geloescht`: Der Autor des Objekts hat kein Konto mehr (`AuthService.deleteUser`
//     lässt `author` unverändert stehen).
//   · `angefordert`: Autor oder Admin haben die Übergabe ausdrücklich verlangt (Protokoll
//     `ko.author-transfer-requested`), und seitdem gab es keine Übergabe (`ko.author-transferred`).
//
// NICHT ABGEBILDET: „dauerhaft ausgeschieden" (Ben, Nacharbeit 9). Ein abgelaufener Zugang
// (`accessExpiresAt`) ist eine aufhebbare Befristung und kein belegtes Ausscheiden. Frage 24
// setzt beides nicht gleich, deshalb löst er hier NICHTS aus. Welcher Zustand als Ausscheiden
// gilt, ist als offene Frage an Pedi festgehalten
// (`docs/aufnahme/20260922-gesamt-aufgabenansicht-autorenuebergabe.md`).
// Bis zur Antwort entsteht für einen ausgeschiedenen Autor mit bestehendem Konto die Aufgabe nur
// über den ausdrücklichen Antrag.
//
// ERLEDIGT ist die Aufgabe durch die vorhandene Admin-Handlung `setAuthor` (FR-LIF-02):
//   · Danach zeigt `author` auf ein bestehendes Konto, sodass der erste Grund entfällt.
//   · `ko.author-transferred` steht nach dem Antrag, sodass der zweite Grund entfällt.
//
// PRIORITÄT: „Heute". „Kritisch", wenn der Wissensbereich (Kategorie) des Objekts im gepflegten
// Bereichsprofil die Kritikalität „hoch" trägt (`management/src/profiles.ts`, Faktor
// `criticality`, Pflege nur mit `users.manage`). Das ist die vorhandene, ausdrückliche Einschätzung
// „kritisches Wissen" im Produkt. Ist für den Bereich nichts gepflegt, gilt „Heute"; eine geratene
// Kritikalität entsteht hier nicht.
import type { AuditEntry, KnowledgeObject } from "../api/types";

/** Protokollaktion: Autor oder Admin verlangen die Übergabe ausdrücklich. */
export const UEBERGABE_ANGEFORDERT = "ko.author-transfer-requested";
/** Protokollaktion der vorhandenen Admin-Handlung `setAuthor` (FR-LIF-02). */
export const UEBERGABE_AUSGEFUEHRT = "ko.author-transferred";
/** Die Protokollaktionen, aus denen die Regel rechnet — und nur diese. */
export const UEBERGABE_REGEL_AKTIONEN: readonly string[] = [
  UEBERGABE_ANGEFORDERT,
  UEBERGABE_AUSGEFUEHRT,
];

export type UebergabeGrund = "konto-geloescht" | "angefordert";

export interface AnstehendeUebergabe {
  koId: string;
  grund: UebergabeGrund;
  kritisch: boolean;
}

/** Was die Regel über ein Konto wissen muss. */
export interface UebergabeKonto {
  id: string;
}

/** Was die Regel über einen Wissensbereich wissen muss (gepflegtes Bereichsprofil). */
export interface UebergabeBereich {
  category: string;
  criticality: "niedrig" | "mittel" | "hoch" | null;
}

type UebergabeObjekt = Pick<KnowledgeObject, "id" | "author" | "category">;

/** Ist für dieses Objekt eine Übergabe ausdrücklich verlangt und seitdem nicht ausgeführt? */
function angefordert(
  protokoll: readonly Pick<AuditEntry, "seq" | "action" | "target">[],
  koId: string,
): boolean {
  const letzter = protokoll
    .filter((e) => e.target === koId && UEBERGABE_REGEL_AKTIONEN.includes(e.action))
    .sort((a, b) => a.seq - b.seq)
    .at(-1);
  return letzter?.action === UEBERGABE_ANGEFORDERT;
}

export function anstehendeUebergaben(eingabe: {
  kos: readonly UebergabeObjekt[];
  konten: readonly UebergabeKonto[];
  protokoll: readonly Pick<AuditEntry, "seq" | "action" | "target">[];
  bereiche: readonly UebergabeBereich[];
}): AnstehendeUebergabe[] {
  const konten = new Set(eingabe.konten.map((k) => k.id));
  const kritischeBereiche = new Set(
    eingabe.bereiche.filter((b) => b.criticality === "hoch").map((b) => b.category),
  );
  const out: AnstehendeUebergabe[] = [];
  for (const ko of eingabe.kos) {
    const grund: UebergabeGrund | null = !konten.has(ko.author)
      ? "konto-geloescht"
      : angefordert(eingabe.protokoll, ko.id)
        ? "angefordert"
        : null;
    if (grund) {
      out.push({ koId: ko.id, grund, kritisch: kritischeBereiche.has(ko.category) });
    }
  }
  return out;
}
