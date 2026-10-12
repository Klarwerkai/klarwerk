import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  type KiCodexAenderung,
  type KiCodexAuftrag,
  type KiCodexPruefung,
  pruefeCodexErgebnis,
} from "./ki-arbeitsbegleitung";

// ================================================================================================
// BPA-13 · AC06 — DIE TATSÄCHLICHE, BEGRENZTE DATEIWIRKUNG EINES PROGRAMMIERAUFTRAGS
// (Nacharbeit 2, Ben: „bisher ist nur die Prüfung übergebener Pfadlisten belegt")
// ================================================================================================
//
// `pruefeCodexErgebnis` entscheidet über PFADE. Diese Datei setzt die Entscheidung im Dateisystem
// um — und prüft dabei, was die Pfadprüfung nicht sehen kann: wohin ein Pfad nach dem Auflösen von
// Symlinks WIRKLICH zeigt. Geschrieben wird ausschliesslich
//   · in die per `realpath` aufgelöste Wurzel des Auftrags (je Auftrag ein eigener Ordner),
//   · unter einem erlaubten Präfix, als Anlegen oder Ändern einer regulären Datei,
//   · nie durch einen Symlink, nie über die Wurzel hinaus, nie mehr als die Grenzen unten.
// Gelöscht, installiert, deployt oder ausgeführt wird NICHTS: angeforderte Aktionen werden
// abgelehnt und nur als abgelehnt vermerkt. Es gibt in dieser Datei keinen Prozessstart.

export const KI_CODEX_MAX_DATEIEN = 50;
export const KI_CODEX_MAX_BYTES = 512 * 1024;

export interface KiCodexDatei extends KiCodexAenderung {
  /** Neuer vollständiger Inhalt (UTF-8). Für `loeschen` ohne Bedeutung — Löschen wird abgelehnt. */
  readonly inhalt?: string | undefined;
}

export type KiCodexWirkungsGrund =
  | KiCodexPruefung["abgelehnt"][number]["grund"]
  | "symlink"
  | "ausserhalb_nach_aufloesung"
  | "existiert_bereits"
  | "existiert_nicht"
  | "keine_datei"
  | "inhalt_fehlt"
  | "zu_gross"
  | "zu_viele_dateien";

export interface KiCodexWirkung {
  /** Tatsächlich geschriebene Dateien, relativ zur Wurzel, mit Prüfsumme des Inhalts. */
  readonly geschrieben: ReadonlyArray<{
    readonly pfad: string;
    readonly art: "anlegen" | "aendern";
    readonly bytes: number;
    readonly sha256: string;
  }>;
  readonly abgelehnt: ReadonlyArray<{
    readonly pfad: string;
    readonly grund: KiCodexWirkungsGrund;
  }>;
  /** Angeforderte Betriebsaktionen — abgelehnt, nicht ausgeführt. */
  readonly abgelehnteAktionen: readonly string[];
}

function liegtIn(wurzel: string, pfad: string): boolean {
  return pfad === wurzel || pfad.startsWith(`${wurzel}${sep}`);
}

async function existiert(pfad: string): Promise<Stats | null> {
  try {
    return await lstat(pfad);
  } catch {
    return null;
  }
}

/** Der nächste existierende Vorfahr — aufgelöst, damit ein Symlink im Weg erkannt wird. */
async function aufgeloesterVorfahr(pfad: string): Promise<string> {
  let p = pfad;
  for (;;) {
    if (await existiert(p)) return realpath(p);
    const oben = dirname(p);
    if (oben === p) return p;
    p = oben;
  }
}

/**
 * AC06 — die angenommenen Änderungen eines Programmierauftrags im synthetischen Arbeitsbereich
 * WIRKLICH schreiben. Jede Datei wird einzeln geprüft (Pfadregel aus `pruefeCodexErgebnis`, dann
 * die aufgelösten Pfade); eine abgelehnte Datei hält die übrigen nicht auf.
 */
export async function wendeCodexAenderungenAn(
  auftrag: KiCodexAuftrag,
  dateien: readonly KiCodexDatei[],
  angeforderteAktionen: readonly string[] = [],
): Promise<KiCodexWirkung> {
  const wurzel = await realpath(auftrag.wurzel);
  const geschrieben: Array<KiCodexWirkung["geschrieben"][number]> = [];
  const abgelehnt: Array<{ pfad: string; grund: KiCodexWirkungsGrund }> = [];
  const abgelehnteAktionen = pruefeCodexErgebnis(
    auftrag,
    [],
    angeforderteAktionen,
  ).abgelehnteAktionen;

  for (const [i, d] of dateien.entries()) {
    if (i >= KI_CODEX_MAX_DATEIEN) {
      abgelehnt.push({ pfad: d.pfad, grund: "zu_viele_dateien" });
      continue;
    }
    const regel = pruefeCodexErgebnis(auftrag, [{ pfad: d.pfad, art: d.art }]);
    const abgewiesen = regel.abgelehnt[0];
    const angenommen = regel.angenommen[0];
    if (abgewiesen || !angenommen || angenommen.art === "loeschen") {
      abgelehnt.push({ pfad: d.pfad, grund: abgewiesen?.grund ?? "loeschen_nicht_erlaubt" });
      continue;
    }
    if (typeof d.inhalt !== "string") {
      abgelehnt.push({ pfad: d.pfad, grund: "inhalt_fehlt" });
      continue;
    }
    const bytes = Buffer.byteLength(d.inhalt, "utf8");
    if (bytes > KI_CODEX_MAX_BYTES) {
      abgelehnt.push({ pfad: d.pfad, grund: "zu_gross" });
      continue;
    }
    const ziel = resolve(wurzel, angenommen.pfad);
    if (!liegtIn(wurzel, ziel)) {
      abgelehnt.push({ pfad: d.pfad, grund: "ausserhalb_nach_aufloesung" });
      continue;
    }
    // Ein Symlink irgendwo auf dem Weg könnte aus der Wurzel herausführen.
    if (!liegtIn(wurzel, await aufgeloesterVorfahr(dirname(ziel)))) {
      abgelehnt.push({ pfad: d.pfad, grund: "ausserhalb_nach_aufloesung" });
      continue;
    }
    const vorhanden = await existiert(ziel);
    if (vorhanden?.isSymbolicLink()) {
      abgelehnt.push({ pfad: d.pfad, grund: "symlink" });
      continue;
    }
    if (angenommen.art === "anlegen" && vorhanden) {
      abgelehnt.push({ pfad: d.pfad, grund: "existiert_bereits" });
      continue;
    }
    if (angenommen.art === "aendern" && !vorhanden) {
      abgelehnt.push({ pfad: d.pfad, grund: "existiert_nicht" });
      continue;
    }
    if (vorhanden && !vorhanden.isFile()) {
      abgelehnt.push({ pfad: d.pfad, grund: "keine_datei" });
      continue;
    }
    await mkdir(dirname(ziel), { recursive: true });
    // Nach dem Anlegen der Ordner noch einmal auflösen — ein zwischenzeitlich gesetzter Symlink
    // darf den Schreibvorgang nicht umlenken.
    if (!liegtIn(wurzel, await realpath(dirname(ziel)))) {
      abgelehnt.push({ pfad: d.pfad, grund: "ausserhalb_nach_aufloesung" });
      continue;
    }
    await writeFile(ziel, d.inhalt, {
      encoding: "utf8",
      flag: angenommen.art === "anlegen" ? "wx" : "w",
    });
    geschrieben.push({
      pfad: angenommen.pfad,
      art: angenommen.art,
      bytes,
      sha256: createHash("sha256").update(d.inhalt, "utf8").digest("hex"),
    });
  }
  return { geschrieben, abgelehnt, abgelehnteAktionen };
}
