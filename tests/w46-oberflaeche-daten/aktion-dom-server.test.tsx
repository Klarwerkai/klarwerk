// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import type { BrowserAuftragSicht } from "../../services/app/src/klara-browser-aktion-dienst";
import type { BrowserBefehl } from "../../services/app/src/klara-browser-relais";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import {
  BETREFF,
  EMPFAENGER,
  NACHRICHT,
  ORIGIN,
  PFAD,
  seitenHtml,
} from "../klara-browser-aktionen/testseite";
type Adapter = Record<string, (args: Record<string, unknown>) => Record<string, unknown>>;
let g: { KlaraBrowserAktion?: Adapter } = {};
const API = "/api/me/klara/browser-auftraege";
const wortlaut = `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“, Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}“ und speichere ihn als Entwurf.`;
function lade(variante: "standard" | "mfa" = "standard") {
  document.documentElement.innerHTML = seitenHtml(variante).replace(
    /<script>[\s\S]*?<\/script>/g,
    "",
  );
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 100, height: 20 },
  ] as unknown as DOMRectList);
  g = {};
  new Function(
    "globalThis",
    "location",
    readFileSync(`${process.cwd()}/extensions/klara-browser/aktion.js`, "utf8"),
  )(g, new URL(ORIGIN + PFAD));
  const adapter = g.KlaraBrowserAktion;
  if (!adapter) throw new Error("Ausgelieferter Adapter fehlt");
  return adapter;
}
afterEach(async () => {
  await schliesseBuehnen();
  g = {};
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
async function folge(adapter: Adapter) {
  const w = await baueFrischeBuehne();
  const headers = { authorization: `Bearer ${w.sitzung.experte}` };
  const start = await w.app.inject({
    method: "POST",
    url: API,
    headers,
    payload: {
      vorgang: `vorgang-${crypto.randomUUID()}`,
      quelle: "getippt",
      wortlaut,
      ziel: { tabId: 7, url: ORIGIN + PFAD },
      host: { browser: "Chromium", version: "130.0", erweiterung: "1.0.0" },
    },
  });
  expect(start.statusCode, start.body).toBe(201);
  let { auftrag, befehl } = start.json() as {
    auftrag: BrowserAuftragSicht;
    befehl: BrowserBefehl | null;
  };
  let nr = 0;
  const done = new Set<number>();
  const wires: string[] = [];
  const commands: string[] = [];
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (!befehl && !auftrag.laeuft) return { auftrag, wires, commands };
    let extra = {};
    if (befehl && !done.has(befehl.nr)) {
      done.add(befehl.nr);
      commands.push(befehl.art);
      const fn = adapter[befehl.art];
      if (!fn) throw new Error("Unbekannter tatsächlicher Befehl");
      const ergebnis = fn(befehl.args as Record<string, unknown>);
      extra = {
        antwort: {
          nr: befehl.nr,
          ergebnis: befehl.art === "lage" ? { ...ergebnis, tabId: 7 } : ergebnis,
        },
        seite: { adapter: "aktion.js@1.0.0" },
      };
    } else await new Promise((r) => setTimeout(r, 20));
    const payload = { folge: ++nr, ...extra };
    wires.push(JSON.stringify(payload));
    const res = await w.app.inject({
      method: "POST",
      url: `${API}/${auftrag.id}/takt`,
      headers,
      payload,
    });
    expect(res.statusCode, res.body).toBe(200);
    ({ auftrag, befehl } = res.json());
  }
  throw new Error("Echte Adapter-/Serverfolge kam nicht zur Ruhe");
}
it("echte JS-/DOM-/Auth-Schrittfolge überträgt keine Vorbelegung und erfüllt den freigegebenen Entwurf mit nachgelesenen Werten", async () => {
  const adapter = lade();
  const input = document.querySelector<HTMLInputElement>("#a-betreff");
  if (!input) throw new Error("Feld fehlt");
  input.value = "PRIVATE-VORBELEGUNG";
  let saved = 0;
  document.querySelector("#a-speichern")?.addEventListener("click", () => {
    saved++;
    const li = document.createElement("li");
    li.setAttribute("data-entwurf-id", `E-${saved}`);
    li.textContent = `Angebotsentwurf: ${input.value}`;
    document.querySelector("#liste")?.appendChild(li);
  });
  const { auftrag, wires, commands } = await folge(adapter);
  expect(wires.join("")).not.toContain("PRIVATE-VORBELEGUNG");
  expect(auftrag.stand, JSON.stringify(auftrag)).toBe("fertig");
  expect(auftrag.erfolg).toBe(true);
  expect(saved).toBe(1);
  expect(commands).toContain("fuelle");
  expect(commands).toContain("klicke");
  expect(input.value).toBe(BETREFF);
  expect(document.querySelector<HTMLTextAreaElement>("#a-nachricht")?.value).toBe(NACHRICHT);
});
it("Kartennummer, CVC, Textkennwort und OTP verlassen in der echten Folge den DOM nicht; Login-/MFA-Schranke verhindert Schreiben", async () => {
  const adapter = lade("mfa");
  const form = document.querySelector("form");
  if (!form) throw new Error("Formular fehlt");
  const secrets = ["4111111111111111", "983", "TEXT-KENNWORT-VERTRAULICH", "791428"];
  for (const [i, label] of ["Kartennummer", "CVC", "Kennwort", "Einmalcode"].entries()) {
    const field = document.createElement("input");
    field.type = "text";
    field.setAttribute("aria-label", label);
    field.value = secrets[i] ?? "";
    if (i === 3) field.autocomplete = "one-time-code";
    form.appendChild(field);
  }
  const result = await folge(adapter);
  for (const secret of secrets) expect(result.wires.join("")).not.toContain(secret);
  expect(result.commands).not.toContain("fuelle");
  expect(result.commands).not.toContain("klicke");
  expect(document.querySelector<HTMLInputElement>("#a-betreff")?.value).toBe("");
  expect(result.auftrag.erfolg).not.toBe(true);
});
it("lokaler DOM-CAS und gesperrte Textkennwörter bleiben trotz redigierter Lage wirksam", () => {
  const adapter = lade();
  const input = document.querySelector<HTMLInputElement>("#a-betreff");
  if (!input) throw new Error("Feld fehlt");
  input.value = "lokaler Anfang";
  const lage = adapter.lage?.({ formular: "Angebotsentwurf" }) as {
    formular: { fingerabdruck: string; felder: { wert: string }[] };
  };
  expect(lage.formular.felder.every((f) => f.wert === "")).toBe(true);
  input.value = "zwischenzeitliche Nutzereingabe";
  const a = {
    formular: "Angebotsentwurf",
    fingerabdruck: lage.formular.fingerabdruck,
    label: "Betreff",
    erwartet: "",
    wert: BETREFF,
  };
  expect(adapter.fuelle?.(a)).toEqual({ ok: false, grund: "wert_geaendert" });
  expect(input.value).toBe("zwischenzeitliche Nutzereingabe");
  input.setAttribute("aria-label", "Kennwort");
  const neu = adapter.lage?.({ formular: "Angebotsentwurf" }) as typeof lage;
  expect(
    adapter.fuelle?.({ ...a, label: "Kennwort", fingerabdruck: neu.formular.fingerabdruck }),
  ).toEqual({ ok: false, grund: "feld_gesperrt" });
});
