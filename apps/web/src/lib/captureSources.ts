// SCRUM-408 (Pedi 03.07.): Externe Quellen schon beim ERFASSEN anhängen — Gleichstand mit dem
// Quellen-Panel des Prüfbereichs (SCRUM-118/129). Beim Erfassen existiert das KO noch nicht:
// Quellen werden als sichtbare Warteliste lokal gesammelt und erst beim Einreichen über die
// VORHANDENE add-source-Route ans gespeicherte KO gehängt. Regeln unverändert: Quellen sind
// Stufe 2, nie peer-validiert, keine automatische Übernahme; Teilfehler kippen den Save nicht
// (gleiches Muster wie Anhänge, SCRUM-374).
import type { ExternalResult } from "../api/types";
import { toSourcePayload as externalToSourcePayload } from "./externalSearch";
import { type SourceFormInput, isSourceFormValid, toSourcePayload } from "./koSource";

export interface PendingSource {
  label: string;
  url?: string;
  excerpt?: string;
  provider?: string;
}

// Gleiche Guard-Logik wie im Prüfbereich (KnowledgeDetail: canEdit = role !== "viewer").
export function canAttachCaptureSources(role: string | undefined): boolean {
  return role !== "viewer";
}

// Formular → Wartelisten-Eintrag. Label ist Pflicht (wie im Prüfbereich); sonst null.
export function pendingFromForm(input: SourceFormInput): PendingSource | null {
  return isSourceFormValid(input) ? toSourcePayload(input) : null;
}

// Externer Suchtreffer → Wartelisten-Eintrag (nur mit Titel anhängbar, SCRUM-118-Regel).
export function pendingFromResult(result: ExternalResult): PendingSource | null {
  const payload = externalToSourcePayload(result);
  return payload.label.length > 0 ? payload : null;
}

// Warteliste ergänzen — Doppelte vermeiden: gleiche URL (falls beide eine haben), sonst
// Label + Auszug. Der Auszug zählt mit, damit MEHRERE Belegstellen aus DERSELBEN Datei
// (SCRUM-405: „Aus Dokument ergänzen", Quelle je Punkt) nebeneinander bestehen können.
export function addPendingSource(
  list: readonly PendingSource[],
  next: PendingSource | null,
): PendingSource[] {
  if (!next) {
    return [...list];
  }
  const duplicate = list.some((s) =>
    next.url && s.url
      ? s.url === next.url
      : s.label === next.label && (s.excerpt ?? "") === (next.excerpt ?? ""),
  );
  return duplicate ? [...list] : [...list, next];
}

export function removePendingSource(
  list: readonly PendingSource[],
  index: number,
): PendingSource[] {
  return list.filter((_, i) => i !== index);
}

// Nach dem Speichern: jede Quelle EINZELN anhängen. Ein Teilfehler kippt NICHT den
// Gesamt-Save — fehlgeschlagene Quellen werden ehrlich (per Label) zurückgemeldet.
export async function attachPendingSources(
  koId: string,
  list: readonly PendingSource[],
  attach: (koId: string, source: PendingSource) => Promise<unknown>,
): Promise<{ attached: number; failed: string[] }> {
  let attached = 0;
  const failed: string[] = [];
  for (const source of list) {
    try {
      await attach(koId, source);
      attached += 1;
    } catch {
      failed.push(source.label);
    }
  }
  return { attached, failed };
}
