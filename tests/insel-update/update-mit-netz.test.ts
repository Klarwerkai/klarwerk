// ================================================================================================
// JOB 4012 — UPDATE MIT NETZ: die Sicherung ist die Bedingung, nicht die Beigabe.
// ================================================================================================
//
// WAS HIER GEMESSEN WIRD, und zwar am echten Skript gegen einen echten Release-Ordner: dass ein
// gelungenes Update mit EINER Ergebniszeile endet, die den Sicherungspfad nennt; dass diese
// Sicherung wirklich existiert, wirklich denselben Inhalt hat und eine Pruefsumme traegt; dass
// `/health` danach die NEUE Version meldet; und — die Gegenprobe aus Auftrag §7 — dass ohne
// gelungene Sicherung GAR NICHT umgeschaltet wird.
//
// „Nicht umgeschaltet" wird nicht am Text abgelesen, sondern am Bestand: `current` zeigt unveraendert
// auf die alte Fassung, und das neue Release ist nicht einmal nach `releases/` ausgepackt worden.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  aktivesRelease,
  fahreUpdate,
  feldAus,
  gesundheit,
  legeInselAn,
  legeJournalAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
  standtext,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Das neue Release liegt AUSSERHALB von `releases/` — wie ein frisch uebertragenes Paket. */
function paket(insel: Insel, wunsch: Parameters<typeof schreibeRelease>[1]): string {
  const ordner = join(insel.wurzel, "eingang");
  mkdirSync(ordner, { recursive: true });
  return schreibeRelease(ordner, wunsch);
}

async function inselMitVorversion(): Promise<Insel> {
  const neue = await legeInselAn();
  schreibeRelease(neue.releases, { name: ALT, appVersion: "1.0.0" });
  setzeCurrent(neue, ALT);
  legeJournalAn(neue);
  return neue;
}

describe("JOB 4012 · das gelungene Update", () => {
  it("U1 · Ergebniszeile, Sicherung mit Pruefsumme, neue Version im Health", async () => {
    insel = await inselMitVorversion();
    const journal = join(insel.daten, "state.jsonl");
    const neu = paket(insel, { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdate(insel, neu);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    const treffer = /^Update auf 1\.1\.0 aktiv, Sicherung (.+)$/.exec(lauf.ergebnis);
    expect(treffer, `Ergebniszeile war: ${lauf.ergebnis}`).not.toBeNull();

    const sicherung = treffer?.[1] ?? "";
    expect(existsSync(sicherung)).toBe(true);
    expect(readFileSync(sicherung, "utf8")).toBe(readFileSync(journal, "utf8"));
    expect(existsSync(`${sicherung}.sha256`), "eine Sicherung ohne Pruefsumme ist eine Datei").toBe(
      true,
    );

    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
    expect(feldAus(standtext(insel), "bestaetigt")).toBe("ja");
    // Der Sicherungslauf wird angesagt, bevor er laeuft — Auftrag §9, Zustand „laden".
    expect(lauf.ausgabe).toContain("Sicherung läuft …");
  });

  // Das echte Paket der Insel ist ein Zip (`build-current-release.mjs` ruft `zip`), und auf dem Mac
  // Studio liegen `zip` und `unzip` im System. In diesem Prüfstand sind sie NICHT zugesagt — gemessen
  // am Cloud-Läufer 8b610ee9 (14.09.), dort fehlt `zip` (`spawnSync`-Status `null`). Ein stiller Skip
  // sähe aus wie ein bestandener Lauf; deshalb steht der Grund auf stderr und in der Rückgabe.
  it("U2 · dasselbe aus einem Zip-Paket", async (ctx) => {
    const fehlend = ["zip", "unzip"].filter(
      (werkzeug) => spawnSync(werkzeug, ["-v"], { encoding: "utf8" }).error !== undefined,
    );
    if (fehlend.length > 0) {
      process.stderr.write(
        `[KLARWERK] JOB 4012 U2 ÜBERSPRUNGEN: ${fehlend.join(", ")} nicht vorhanden — der Zip-Weg ist hier nicht messbar.\n`,
      );
      ctx.skip();
      return;
    }
    insel = await inselMitVorversion();
    const eingang = join(insel.wurzel, "eingang");
    mkdirSync(eingang, { recursive: true });
    schreibeRelease(eingang, { name: NEU, appVersion: "1.1.0" });
    const gepackt = spawnSync("zip", ["-qr", join(insel.wurzel, "paket.zip"), NEU], {
      cwd: eingang,
      encoding: "utf8",
    });
    expect(gepackt.status, gepackt.stderr ?? "").toBe(0);

    const lauf = fahreUpdate(insel, join(insel.wurzel, "paket.zip"));

    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ergebnis).toContain("Update auf 1.1.0 aktiv");
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });

  it("U3 · Erstinstallation: ohne Daten wird nichts gesichert und nichts behauptet", async () => {
    insel = await legeInselAn();
    const neu = paket(insel, { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdate(insel, neu);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ergebnis).toBe(
      "Update auf 1.1.0 aktiv, Sicherung (keine — Erstinstallation, es gibt noch keine Daten)",
    );
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });
});

describe("JOB 4012 · ohne gelungene Sicherung wird nicht umgeschaltet (Auftrag §7)", () => {
  it("U4 · das Sicherungsverzeichnis laesst sich nicht anlegen: Exit 2, current unveraendert", async () => {
    insel = await inselMitVorversion();
    // `backups` ist eine DATEI — `mkdir -p` kann dort kein Verzeichnis anlegen. Das ist eine echte
    // Verstellung am Bestand, kein Stub im Update-Weg.
    writeFileSync(insel.backups, "hier steht eine Datei, wo ein Verzeichnis hingehoert");
    const neu = paket(insel, { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdate(insel, neu);

    expect(lauf.code, lauf.ausgabe).toBe(2);
    expect(lauf.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: sicherung",
    );
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(
      existsSync(join(insel.releases, NEU)),
      "ein abgebrochenes Update darf das neue Release nicht einmal ausgepackt haben",
    ).toBe(false);
  });

  it("U5 · eine laufende Fassung ohne auffindbare Daten ist ein Befund, kein Erstlauf", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0" });
    setzeCurrent(insel, ALT);
    // kein Journal, keine Datenbank-URL
    const neu = paket(insel, { name: NEU, appVersion: "1.1.0" });

    const lauf = fahreUpdate(insel, neu);

    expect(lauf.code, lauf.ausgabe).toBe(2);
    expect(lauf.ergebnis).toContain("Grund: sicherung");
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("U6 · ein Paket ohne SCHEMA-VERTRAG wird nicht eingespielt", async () => {
    insel = await inselMitVorversion();
    const ordner = join(insel.wurzel, "eingang", "fremdpaket");
    mkdirSync(ordner, { recursive: true });
    writeFileSync(join(ordner, "BUILD_INFO"), "version=fremd\n");

    const lauf = fahreUpdate(insel, ordner);

    expect(lauf.code, lauf.ausgabe).toBe(5);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: vertrag");
    expect(aktivesRelease(insel)).toBe(ALT);
  });
});
