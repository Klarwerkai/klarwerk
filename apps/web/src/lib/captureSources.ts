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
  // AUFTRAG-mega17 Block A-2: der lokale Schlüssel des Dokuments, aus dem diese Belegstelle stammt.
  // Beim Erfassen existiert das Wissensobjekt noch nicht, also kann es zum Zeitpunkt des Übernehmens
  // auch keine objectId geben. Statt den Anker deshalb wegzulassen (bis mega16: adressloser Vermerk,
  // auf der Vorgabestufe stumm mit 403 abgewiesen — Inhalt ohne Herkunft) merkt sich die Warteliste
  // hier, WELCHES mitgeführte Dokument der Anker ist. Aufgelöst wird er beim Einreichen, wenn der
  // Anhang wirklich am neuen Wissensobjekt liegt. Rein lokal — geht nie an den Server.
  anchorKey?: string;
  // Ein bereits BEKANNTER Anker (das Dokument liegt schon als Anhang am Ziel). Dieser Wert geht als
  // `objectId` mit; der Server glaubt ihn nicht, er schlägt ihn in der eigenen Anhangsliste nach.
  objectId?: string;
}

// AUFTRAG-mega5 Block C (bens Vorschlag): im PERSISTIERTEN Draft-Vertrag heißt das Feld
// `sourceProvider` — auf einen Blick die Such-/Herkunftsquelle des Treffers, nicht ein KI-Anbieter.
// Der KO-add-source-Vertrag (`provider`, bestehendes KO-Datenmodell) bleibt unverändert; diese
// beiden reinen Mapper übersetzen an der Draft-Grenze in beide Richtungen.
export interface DraftPendingSource {
  label: string;
  url?: string;
  excerpt?: string;
  sourceProvider?: string;
  // AUFTRAG-mega20 Block D: die Referenz reist jetzt MIT (s. unten).
  anchorKey?: string;
  objectId?: string;
}

// ==============================================================================================
// AUFTRAG-mega20 Block D — DIE REFERENZ REIST MIT.
// ==============================================================================================
//
// WAS HIER BIS mega19 STAND, im Wortlaut: „`anchorKey` und `objectId` reisen bewusst NICHT in den
// persistierten Entwurf. Der Schlüssel zeigt auf ein mitgeführtes Dokument, dessen Bytes der
// Entwurf ohnehin nicht trägt; ein wiederhergestellter Anker ohne Anhang wäre eine Behauptung ohne
// Deckung."
//
// Die Beobachtung war richtig, der Schluss falsch — und zwar SEIT mega18 nachweislich. Denn seit
// mega18 wird das Original beim Übernehmen SOFORT im Objektspeicher gesichert
// (`secureAnchorDocument`), bevor auch nur ein Zeichen Inhalt in den Entwurf wandert. Die
// `objectId` ist also KEINE Behauptung mehr: sie zeigt auf ein serverseitig existierendes Objekt,
// und der Server kann das jederzeit nachprüfen. Der Kommentar beschrieb einen Zustand, den es zum
// Zeitpunkt seines Schreibens schon nicht mehr gab.
//
// WAS DIE ALTE FASSUNG KOSTETE. Speichern und Fortsetzen strichen die Referenz — der übernommene
// TEXT blieb im Body, sein Beleg verschwand. Der Einreich-Weg sah danach keine verankerten Quellen
// mehr und wählte den einfachen Promote-Pfad. Ergebnis: ein Wissensobjekt mit Dokumentinhalt ohne
// Herkunft, erzeugt über den Umweg eines Zwischenspeicherns — genau der Zustand, den mega18 und
// mega19 an jeder anderen Stelle geschlossen haben.
//
// WAS JETZT GILT. Beide Felder werden persistiert. Der SERVER prüft sie beim Fortsetzen und beim
// Einreichen gegen den Objektspeicher (services/capture/src/service.ts, `verifyDraftAnchors`):
// fehlt das Original, kommt der Body NICHT zurück und das Einreichen bricht ehrlich ab. Der
// `anchorKey` bleibt dabei reine Formular-Innensicht — er wird mitgeführt, damit die Zuordnung
// „welche Belegstelle gehört zu welchem Dokument" das Fortsetzen übersteht, aber NICHTS wird ihm
// geglaubt: geprüft wird ausschliesslich die `objectId`.
export function toDraftSources(list: readonly PendingSource[]): DraftPendingSource[] {
  return list.map((s) => ({
    label: s.label,
    ...(s.url !== undefined ? { url: s.url } : {}),
    ...(s.excerpt !== undefined ? { excerpt: s.excerpt } : {}),
    ...(s.provider !== undefined ? { sourceProvider: s.provider } : {}),
    // Nur GEMEINSAM sinnvoll: ein Schlüssel ohne gesichertes Original wäre wieder die Behauptung
    // ohne Deckung, die der alte Kommentar zu Recht fürchtete. Fehlt die `objectId`, reist auch
    // der Schlüssel nicht mit.
    ...(s.anchorKey && s.objectId ? { anchorKey: s.anchorKey, objectId: s.objectId } : {}),
  }));
}

export function fromDraftSources(list: readonly DraftPendingSource[]): PendingSource[] {
  return list
    .filter((s) => typeof s?.label === "string" && s.label.length > 0)
    .map((s) => ({
      label: s.label,
      ...(typeof s.url === "string" ? { url: s.url } : {}),
      ...(typeof s.excerpt === "string" ? { excerpt: s.excerpt } : {}),
      ...(typeof s.sourceProvider === "string" ? { provider: s.sourceProvider } : {}),
      // Dieselbe Paarungsregel beim Zurücklesen: eine halbe Referenz ist keine.
      ...(typeof s.anchorKey === "string" && typeof s.objectId === "string"
        ? { anchorKey: s.anchorKey, objectId: s.objectId }
        : {}),
    }));
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

// AUFTRAG-mega17 Block A-2: den Anker AUFLÖSEN, bevor die Quelle hinausgeht. `anchorKey` ist ein
// lokaler Merker; was der Server sehen darf, ist die echte `objectId` des Anhangs, den derselbe
// Submit unmittelbar vorher an DIESES Wissensobjekt gehängt hat. Findet sich kein Anker (der Anhang
// scheiterte, oder der Entwurf wurde ohne das Dokument fortgesetzt), geht die Quelle bewusst OHNE
// Anker hinaus: auf einer erlaubenden Stufe ist sie dann korrekt, auf der restriktiven wird sie
// abgewiesen — und diese Abweisung wird oben ehrlich als fehlende Herkunft gemeldet, nicht als
// „Anhang fehlgeschlagen". Kein Erfinden einer objectId, nie.
export function resolvePendingAnchor(
  source: PendingSource,
  anchors: ReadonlyMap<string, string>,
): PendingSource {
  const { anchorKey, objectId, ...rest } = source;
  const resolved = (anchorKey ? anchors.get(anchorKey) : undefined) ?? objectId;
  return resolved ? { ...rest, objectId: resolved } : { ...rest };
}

// Nach dem Speichern: jede Quelle EINZELN anhängen. Ein Teilfehler kippt NICHT den
// Gesamt-Save — fehlgeschlagene Quellen werden ehrlich (per Label) zurückgemeldet.
// AUFTRAG-mega17 Block A-2: die Rückmeldung ist jetzt ZWEIGETEILT. `unanchored` sind die Quellen,
// die zu einem aus einem Dokument ÜBERNOMMENEN Inhalt gehören (sie tragen einen `anchorKey`) — hier
// bedeutet ein Fehlschlag: der Text steht im Wissensobjekt, sein Beleg nicht. Das ist ein Bruch des
// belegorientierten Kernvertrags und wird als solcher benannt, nicht in `failed` mitgezählt.
export async function attachPendingSources(
  koId: string,
  list: readonly PendingSource[],
  attach: (koId: string, source: PendingSource) => Promise<unknown>,
  anchors: ReadonlyMap<string, string> = new Map(),
): Promise<{ attached: number; failed: string[]; unanchored: string[] }> {
  let attached = 0;
  const failed: string[] = [];
  const unanchored: string[] = [];
  for (const source of list) {
    try {
      await attach(koId, resolvePendingAnchor(source, anchors));
      attached += 1;
    } catch {
      // Ein Anker (aufzulösender oder bereits bekannter) bedeutet: diese Quelle gehört zu einem aus
      // einem Dokument ÜBERNOMMENEN Inhalt. Ihr Fehlschlag ist deshalb ein Herkunfts-, kein
      // Anhangsfehler — und wird getrennt zurückgemeldet.
      (source.anchorKey || source.objectId ? unanchored : failed).push(source.label);
    }
  }
  return { attached, failed, unanchored };
}
