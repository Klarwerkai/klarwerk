// ================================================================================================
// BD12-02-K06 — DIE NEUBEWERTUNG NACH EINER QUELLENÄNDERUNG, EIN WEG FÜR ALLE AUSLÖSER.
// ================================================================================================
//
// Hängt an einem Wissensobjekt eine menschlich ENTSCHIEDENE Konfliktentscheidung, galt sie für die
// damalige Beleggrundlage. Ändert sich eine Quelle des Objekts — über die Bearbeitung (Quelle
// ergänzen/entfernen, Dokument übernehmen) oder weil der Quellabgleich sie im Ursprung als gelöscht
// vorfindet —, dann
//   (1) bekommt jede solche Entscheidung den Vermerk „erneut zu prüfen"
//       (`ConflictService.vermerkeNeupruefung`; die Entscheidung selbst bleibt unverändert), und
//   (2) das Objekt den vorhandenen Merker „Stimmt das noch?" mit Grund „konflikt"
//       (`LifecycleService.konfliktgrundlageGeaendert`).
// Ohne entschiedenen Konflikt geschieht nichts. Beide Schritte sind wiederholbar, ohne doppelt zu
// vermerken (gleiche Seite, Art und Quellen → derselbe Vermerk; gleiche Änderung → derselbe Anlass).
// Ein Fehler wird GEWORFEN — der Aufrufer entscheidet, wie er ihn sichtbar meldet.
import type { ConflictService } from "../../conflicts";
import type { LifecycleService } from "../../lifecycle";

export type QuellenAenderung = "quelle_hinzugefuegt" | "quelle_entfernt";

export interface QuellenNeubewertungDeps {
  conflicts: Pick<ConflictService, "vermerkeNeupruefung">;
  lifecycle: Pick<LifecycleService, "konfliktgrundlageGeaendert">;
}

/** Liefert die Zahl der betroffenen Entscheidungen (0 = nichts zu tun). */
export async function quellenNeubewertung(
  deps: QuellenNeubewertungDeps,
  koId: string,
  actor: string,
  art: QuellenAenderung,
  sourceIds: readonly string[],
): Promise<number> {
  const vermerkt = await deps.conflicts.vermerkeNeupruefung(koId, actor, {
    art,
    sourceIds: [...sourceIds],
  });
  if (vermerkt.length > 0) {
    const mehr = sourceIds.length > 1 ? `+${sourceIds.length - 1}` : "";
    const kennung = art === "quelle_hinzugefuegt" ? "quelle-hinzugefuegt" : "quelle-entfernt";
    await deps.lifecycle.konfliktgrundlageGeaendert(
      koId,
      actor,
      `${kennung}:${sourceIds[0] ?? ""}${mehr}`,
    );
  }
  return vermerkt.length;
}
