import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { poolAbschluss } from "./pool-abschluss";

function kontrollierterPool(beenden: () => Promise<void> = () => Promise.resolve()) {
  return Object.assign(new EventEmitter(), { end: beenden });
}

describe("Poolabschluss wartet auf tatsächliche Clientenden", () => {
  it("bleibt nach Pool.end offen, bis beide Clients ihr end gemeldet haben", async () => {
    const poolEnde = Promise.resolve();
    const pool = kontrollierterPool(() => poolEnde);
    const schliessen = poolAbschluss(pool);
    const eins = new EventEmitter();
    const zwei = new EventEmitter();
    pool.emit("connect", eins);
    pool.emit("connect", zwei);
    const abschluss = schliessen();
    await poolEnde;
    const offen = Symbol("offen");
    expect(await Promise.race([abschluss, Promise.resolve(offen)])).toBe(offen);
    eins.emit("end");
    expect(await Promise.race([abschluss, Promise.resolve(offen)])).toBe(offen);
    zwei.emit("end");
    await expect(abschluss).resolves.toBeUndefined();
  });

  it("hängt bei bereits beendeten oder fehlenden Clients nicht", async () => {
    const pool = kontrollierterPool();
    const schliessen = poolAbschluss(pool);
    const client = new EventEmitter();
    pool.emit("connect", client);
    client.emit("end");
    await expect(schliessen()).resolves.toBeUndefined();

    // Der SELECT-Fehlerpfad kann schon vor afterAll schließen.
    let aufrufe = 0;
    const leer = kontrollierterPool(() => {
      aufrufe += 1;
      return aufrufe === 1 ? Promise.resolve() : Promise.reject(new Error("Pool.end doppelt"));
    });
    const leerSchliessen = poolAbschluss(leer);
    await expect(leerSchliessen()).resolves.toBeUndefined();
    await expect(leerSchliessen()).resolves.toBeUndefined();
    expect(aufrufe).toBe(1);
  });

  it("gibt die tatsächliche Pool-Endablehnung weiter", async () => {
    const fehler = new Error("Pool-Ende abgelehnt");
    const pool = kontrollierterPool(() => Promise.reject(fehler));
    const schliessen = poolAbschluss(pool);
    await expect(schliessen()).rejects.toBe(fehler);
  });
});
