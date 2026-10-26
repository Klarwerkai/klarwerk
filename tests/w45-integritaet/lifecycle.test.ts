import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { beobachtePoolFehler } from "../../services/app/src/db";
import {
  initialisiereMitPool,
  registriereServerSignale,
  serverLifecycle,
} from "../../services/app/src/server-lifecycle";
const offen = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
describe("W4.5 Pool und Serverabschluss ohne Produktstart/Netz", () => {
  it("Produktlistener überlebt Error und loggt weder Fehlertext noch URL/Token", () => {
    const pool = new EventEmitter();
    const log = vi.fn();
    beobachtePoolFehler(pool as unknown as Pick<Pool, "on">, log);
    expect(pool.listenerCount("error")).toBe(1);
    pool.emit("error", new Error("postgres://geheim:passwort@host?token=kundentext"));
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join(" ")).not.toMatch(
      /geheim|passwort|token|kundentext|postgres:/,
    );
  });
  it("wartet vorhandene Arbeit, HTTP-Abschluss und Worker vor genau einem Poolende ab", async () => {
    const arbeit = offen();
    const http = offen();
    const worker = offen();
    const folge: string[] = [];
    const lifecycle = serverLifecycle({
      closeApp: async () => {
        folge.push("http-start");
        await http.promise;
        folge.push("http-ende");
      },
      workerIdle: async () => {
        folge.push("worker-start");
        await worker.promise;
        folge.push("worker-ende");
      },
      closePool: async () => {
        folge.push("pool");
      },
    });
    lifecycle.takt({
      stop: () => {
        folge.push("takt-aus");
      },
    });
    const lauf = lifecycle.lauf(async () => {
      folge.push("arbeit-start");
      await arbeit.promise;
      folge.push("arbeit-ende");
    });
    const aktuell = lauf();
    await Promise.resolve();
    const a = lifecycle.beende();
    const b = lifecycle.beende();
    expect(a).toBe(b);
    expect(folge).toEqual(["arbeit-start", "takt-aus", "http-start"]);
    http.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(folge).not.toContain("worker-start");
    expect(folge).not.toContain("pool");
    arbeit.resolve();
    await aktuell;
    await Promise.resolve();
    await Promise.resolve();
    worker.resolve();
    await a;
    expect(folge.at(-1)).toBe("pool");
    expect(folge.indexOf("arbeit-ende")).toBeLessThan(folge.indexOf("pool"));
    await lifecycle.beende();
    expect(folge.filter((x) => x === "pool")).toHaveLength(1);
  });
  it("entfernt beide Signalhandler und beendet auch beim Close-Fehler den Pool", async () => {
    const emitter = new EventEmitter();
    const pool = vi.fn(async () => {});
    const fehler = vi.fn();
    const lifecycle = serverLifecycle({
      closeApp: async () => {
        throw new Error("close");
      },
      workerIdle: async () => {},
      closePool: pool,
    });
    const abmelden = registriereServerSignale(emitter, lifecycle.beende, fehler);
    emitter.emit("SIGTERM");
    emitter.emit("SIGINT");
    await expect(lifecycle.beende()).rejects.toThrow("close");
    await Promise.resolve();
    expect(pool).toHaveBeenCalledTimes(1);
    abmelden();
    expect(emitter.listenerCount("SIGINT") + emitter.listenerCount("SIGTERM")).toBe(0);
  });
  it("gibt den Pool bei einem kausalen Initialisierungsfehler frei", async () => {
    const end = vi.fn(async () => {});
    await expect(
      initialisiereMitPool({ end }, async () => {
        throw new Error("Startfehler");
      }),
    ).rejects.toThrow("Startfehler");
    expect(end).toHaveBeenCalledTimes(1);
  });
  it.each(["SIGTERM", "SIGINT"] as const)(
    "echter kontrollierter Node-Kindprozess beendet %s ohne Produkt-/Netzstart",
    async (signal) => {
      const datei = fileURLToPath(new URL("./signal-kind.mts", import.meta.url));
      const kind = spawn(process.execPath, ["--import", "tsx", datei], {
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let text = "";
      let fehler = "";
      let gesendet = false;
      kind.stdout.on("data", (chunk) => {
        text += String(chunk);
        if (!gesendet && text.includes("BEREIT")) {
          gesendet = true;
          kind.kill(signal);
        }
      });
      kind.stderr.on("data", (chunk) => {
        fehler += String(chunk);
      });
      const code = await new Promise<number | null>((resolve, reject) => {
        kind.once("error", reject);
        kind.once("close", resolve);
      });
      console.info(
        JSON.stringify({ kontrollierterNodeKindprozess: kind.pid, signal, exitCode: code }),
      );
      expect(code, fehler).toBe(0);
      expect(text.trim().split("\n")).toEqual([
        "BEREIT",
        "TAKT_AUS",
        "HTTP_ENDE",
        "ARBEIT_ENDE",
        "WORKER_ENDE",
        "POOL_ENDE",
      ]);
      expect(fehler).toBe("");
    },
  );
});
