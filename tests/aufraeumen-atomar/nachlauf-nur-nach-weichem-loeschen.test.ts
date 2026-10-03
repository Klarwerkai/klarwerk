import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 3066 R4 · F7 — DIE WACHE ÜBER DER BEDINGUNG, DIE DIE ZWEI AUSGÄNGE TRENNT.
// ================================================================================================
//
// `DELETE /api/kos/:id` muss wissen, welchen der zwei Ausgänge `ko.delete` genommen hat: für ein
// Demo-Seed-Objekt kippt der Aufruf intern in die harte Endlöschung (`purgeKo`), die selbst und in
// ihrer Transaktion aufräumt; sonst wandert das Objekt in den Papierkorb, und dann — und nur dann
// — ist der Nachlauf der Route der Aufräumweg. Die Route liest das an `demoSeed` des bereits
// geladenen Zielobjekts ab.
//
// DAS IST EINE GESPIEGELTE BEDINGUNG, und gespiegelte Bedingungen laufen auseinander. Der
// Chokepoint könnte morgen einen weiteren Hart-Auslöser bekommen; dann liefe der Nachlauf wieder
// zusätzlich zum Haken, und niemand merkte es — der Fehler ist ja wirkungslos, bis er es nicht
// mehr ist. Dieser Test liest deshalb den Chokepoint selbst und hält fest, WAS dort hart löscht.
// Wird die Bedingung dort geändert, wird er rot und zeigt auf die Route, die nachzuziehen ist.
//
// Auftrag gesamt-dubletten-rueckzug (R-1547): Nachlauf und gespiegelte Bedingung sind entfernt;
// die ersten beiden Absätze beschreiben den Stand bis dahin. Der erste Fall bleibt als Pin auf den
// Chokepoint stehen, die beiden anderen halten die Entfernung fest.
//
// Er ersetzt keinen Verhaltenstest: dass auf beiden Ausgängen genau EIN Ruf je Aufräumdienst
// steht, misst demo-endloeschung-laeuft-genau-einmal.test.ts an der laufenden App. Dieser hier
// deckt den Fall ab, den ein Verhaltenstest nicht sehen kann — den künftigen dritten Auslöser.
describe("JOB 3066 R4 · F7: die Route spiegelt den Hart-Auslöser des Chokepoints nicht mehr", () => {
  async function quelle(pfad: string): Promise<string> {
    return readFile(new URL(pfad, import.meta.url), "utf8");
  }

  it("der Chokepoint löscht hart bei genau zwei Auslösern: opts.hard und demoSeed", async () => {
    const ko = await quelle("../../services/knowledge-object/src/service.ts");
    // Die eine Verzweigung in `delete`, wörtlich. `forceTrash` schlägt beide Auslöser und erzwingt
    // den Papierkorb — die Route übergibt es nicht, also kann sie es auch nicht spiegeln müssen.
    const zeilen = ko.split("\n").filter((z) => z.includes("opts?.hard") && z.includes("demoSeed"));
    expect(zeilen, "Hart-Auslöser in KoService.delete nicht mehr an einer Stelle").toHaveLength(1);
    expect(zeilen[0]?.replace(/\s+/g, " ").trim()).toBe(
      "if (!opts?.forceTrash && (opts?.hard || ko.demoSeed)) {",
    );
  });

  // Auftrag gesamt-dubletten-rueckzug (R-1547): die gespiegelte Bedingung `endgeloescht` ist mit dem
  // Nachlauf ENTFERNT — beide Ausgänge räumen im Dienst auf, die Route muss nicht mehr wissen,
  // welcher genommen wurde. Die zwei Fälle hier halten fest, dass sie auch nicht zurückkommt.
  it("die Route übergibt keinen der beiden Auslöser und spiegelt keinen Ausgang mehr", async () => {
    const route = await quelle("../../services/app/src/routes/ko-routes.ts");
    const zeilen = route.split("\n");

    // Der eine `ko.delete`-Aufruf dieser Route, ohne Optionen.
    const loeschrufe = zeilen.filter(
      (z) => z.includes("await ko.delete(") && !z.trimStart().startsWith("//"),
    );
    expect(loeschrufe).toHaveLength(1);
    expect(loeschrufe[0]?.trim()).toBe("await ko.delete(request.params.id, user.id);");

    // Keine gespiegelte Ausgangsbedingung mehr.
    const bedingung = zeilen.filter(
      (z) => z.includes("endgeloescht") && !z.trimStart().startsWith("//"),
    );
    expect(bedingung).toEqual([]);
  });

  it("kein Löschweg der Route räumt selbst Befunde auf", async () => {
    const route = await quelle("../../services/app/src/routes/ko-routes.ts");
    const aufraeumrufe = route
      .split("\n")
      .filter((z) => z.includes(".onKoRemoved(") && !z.trimStart().startsWith("//"));
    // Null — der Papierkorb räumt über `setRuecknahmeTxCleanup`, die Endlöschung (auch
    // /api/kos/trash/:id über purgeTrashed) über `setPurgeTxCleanup` auf, beide in build-app.ts.
    expect(aufraeumrufe).toEqual([]);
  });
});
