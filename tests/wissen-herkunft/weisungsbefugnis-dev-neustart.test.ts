// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidung 18 · Nacharbeit 9 — DIE BEFUGNIS ÜBERLEBT DEN
// DEV-NEUSTART.
// ================================================================================================
//
// Befund (Typprüfung): `AppRepos.weisungsbefugnisse` fehlte in `MUTATING_METHODS` der
// Dev-Persistenz. Ohne Eintrag würde die erteilte Weisungsbefugnis in der Desktop-App (Journal statt
// Datenbank) beim nächsten Start still verschwinden — und mit ihr die befugte Herkunft künftiger
// Weisungen. Gegenprobe: erteilen, neu starten, lesen; entziehen, neu starten, lesen.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";

function tmpJournal(): string {
  return join(mkdtempSync(join(tmpdir(), "kw-weisung-devpersist-")), "state.jsonl");
}

describe("Entscheidung 18 · die Weisungsbefugnis am Konto übersteht den Dev-Neustart", () => {
  it("erteilt bleibt erteilt, entzogen bleibt entzogen", async () => {
    const file = tmpJournal();
    const s1 = await buildDevPersistServices(file);
    const admin = await s1.auth.register({
      name: "Pia Admin",
      email: "pia@example.com",
      password: "geheim-123",
    });
    const gf = await s1.auth.register({
      name: "Gerd Führung",
      email: "gerd@example.com",
      password: "geheim-123",
    });
    const erteilt = await s1.auth.setzeWeisungsbefugnis(
      gf.id,
      { bereiche: ["Betrieb"], gesamt: false },
      admin.id,
    );

    const s2 = await buildDevPersistServices(file);
    expect(await s2.auth.weisungsbefugnisVon(gf.id)).toEqual(erteilt);
    expect(await s2.auth.weisungsbefugnisVon(admin.id)).toBeUndefined();

    await s2.auth.setzeWeisungsbefugnis(gf.id, null, admin.id);
    const s3 = await buildDevPersistServices(file);
    expect(await s3.auth.weisungsbefugnisVon(gf.id)).toBeUndefined();
  });
});
