import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ==================================================================================================
// B3 — DIE NUTZLAST DES COMPOSE-DRILLS GEGEN DIE ECHTE ANWENDUNG (HTTP, In-Memory-Datenhaltung).
// ==================================================================================================
//
// `scripts/backup/compose/nutzlast.mjs` legt auf dem Prüfplatz den Kundenbestand an und vergleicht
// ihn nach Wiederherstellung, Aktualisierung und Rückweg. Es spricht die Anwendung nur über HTTP an
// — Ersteinrichtung, Wissensobjekt, Upload, Anhang, Belegliste, Rohinhalt, Auditkette. Dieser Test
// fährt GENAU diese Routen gegen die echte Anwendung, damit eine Umbenennung (Feld, Route, Status)
// hier auffällt und nicht erst auf dem Prüfplatz.
//
// Und die Gegenprobe: Ein Vergleich, der immer „gleich" sagt, wäre wertlos. Eine erwartete
// Prüfsumme, die nicht zum Anhang passt, muss ein BEFUND (1) sein; ein falsches Kennwort ein
// AUFBAUFEHLER (2) — nie dasselbe.
const root = resolve(import.meta.dirname, "../..");
const NUTZLAST = join(root, "scripts/backup/compose/nutzlast.mjs");
const PASSWORT = "b3-nutzlast-test-kennwort-123";

const KANN_HORCHEN = await new Promise<boolean>((fertig) => {
  const probe = createServer();
  probe.on("error", () => fertig(false));
  probe.listen(0, "127.0.0.1", () => probe.close(() => fertig(true)));
});
if (!KANN_HORCHEN) {
  process.stderr.write(
    "[KLARWERK] B3 nutzlast ÜBERSPRUNGEN: diese Umgebung erlaubt kein Horchen auf 127.0.0.1.\n",
  );
}

function lauf(args: string[], passwort = PASSWORT) {
  return new Promise<{ code: number | null; ausgabe: string }>((fertig) => {
    const kind = spawn(process.execPath, [NUTZLAST, ...args], {
      env: { ...process.env, DRILL_LOGIN_PASSWORT: passwort },
    });
    let ausgabe = "";
    kind.stdout.on("data", (d) => {
      ausgabe += d;
    });
    kind.stderr.on("data", (d) => {
      ausgabe += d;
    });
    kind.on("close", (code) => fertig({ code, ausgabe }));
  });
}

describe.skipIf(!KANN_HORCHEN)("B3 · nutzlast.mjs gegen die laufende Anwendung", () => {
  const app = buildApp(buildServices());
  let basis = "";
  let ordner = "";

  beforeAll(async () => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const { port } = app.server.address() as { port: number };
    basis = `http://127.0.0.1:${port}`;
    ordner = mkdtempSync(join(tmpdir(), "klarwerk-b3-nutzlast-"));
  });
  afterAll(async () => {
    await app.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it("N1 · anlegen über Ersteinrichtung, danach vergleichen: alles gleich, Byte für Byte", async () => {
    const bestand = join(ordner, "bestand.json");
    const angelegt = await lauf(["anlegen", basis, bestand]);
    expect(angelegt.code, angelegt.ausgabe).toBe(0);
    const b = JSON.parse(readFileSync(bestand, "utf8"));
    expect(b.ersteinrichtung).toBe(true);
    expect(b.anhangBytes).toBe(512);
    expect(b.anhangSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(b)).not.toContain(PASSWORT);

    const ergebnis = join(ordner, "vergleich.json");
    const verglichen = await lauf(["vergleichen", basis, bestand, ergebnis]);
    expect(verglichen.code, verglichen.ausgabe).toBe(0);
    const e = JSON.parse(readFileSync(ergebnis, "utf8"));
    expect(e.ergebnis).toBe("gleich");
    const namen = (e.pruefungen as { name: string; gleich: boolean }[]).map((p) => p.name);
    for (const n of [
      "wissensobjekt.titel",
      "beleg.objectId",
      "anhang.sha256",
      "audit.linkageBreaks",
    ]) {
      expect(namen).toContain(n);
    }
    expect(verglichen.ausgabe).not.toContain(PASSWORT);

    // Ein zweites `anlegen` auf derselben (schon eingerichteten) Instanz meldet sich an.
    const zweit = await lauf(["anlegen", basis, join(ordner, "bestand2.json")]);
    expect(zweit.code, zweit.ausgabe).toBe(0);
    expect(JSON.parse(readFileSync(join(ordner, "bestand2.json"), "utf8")).ersteinrichtung).toBe(
      false,
    );
  }, 60_000);

  it("N2 · Gegenprobe: eine abweichende Prüfsumme ist ein BEFUND (1), ein falsches Kennwort ein AUFBAUFEHLER (2)", async () => {
    const bestand = join(ordner, "bestand.json");
    const b = JSON.parse(readFileSync(bestand, "utf8"));
    const verfaelscht = join(ordner, "verfaelscht.json");
    writeFileSync(verfaelscht, JSON.stringify({ ...b, anhangSha256: "0".repeat(64) }));
    const rot = await lauf(["vergleichen", basis, verfaelscht]);
    expect(rot.code, rot.ausgabe).toBe(1);
    expect(rot.ausgabe).toContain("ABWEICHUNG anhang.sha256");

    const aufbau = await lauf(["vergleichen", basis, bestand], "falsches-kennwort-xyz");
    expect(aufbau.code, aufbau.ausgabe).toBe(2);
    expect(aufbau.ausgabe).toContain("AUFBAUFEHLER");
  }, 60_000);
});
