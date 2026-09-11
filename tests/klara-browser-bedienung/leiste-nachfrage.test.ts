// ==================================================================================================
// JOB 3606 — WAS PEDI SIEHT. Dieselben drei Befunde, eine Ebene höher: an der gemounteten Leiste.
// ==================================================================================================
//
// `uebernahme-nachfrage.test.ts` misst den ZUSTAND, aus dem die Fläche entsteht. Diese Datei misst
// die FLÄCHE selbst — echtes `panel.html`, echtes `i18n.js`, echtes `panel.js`, echter Worker
// dahinter (`tests/klara-browser/panel-dom.ts`, derselbe Prüfstand wie die älteren Leistenfälle;
// kein zweiter Aufbau). Ohne diese Ebene wäre „der Grund kommt beim Menschen an" eine Behauptung
// über ein Feld im Zustand, nicht über einen Satz auf dem Schirm.
import { afterEach, describe, expect, it } from "vitest";
import { harness, plainVariants } from "../klara-browser/harness";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";

afterEach(schliesseFenster);

const ADVISOR = {
  url: "https://chatgpt.com/c/advisor-nl",
  title: "advisor.nl — Verlauf",
  text: "Der alte Verlauf über advisor.nl.",
};
const CISCO = {
  url: "https://www.manageengine.com/network-configuration-manager/configure-cisco-router.html",
  title: "Configure Cisco router",
  text: "So wird ein Cisco-Router konfiguriert.",
};

describe("JOB 3606 · die Nachfrage steht auf dem Schirm und ist mit einem Griff entscheidbar", () => {
  it("benennt die wartende Seite und bietet beide Wege an", async () => {
    const h = harness(async () => Response.json(null, { status: 200 }));
    h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
    const leiste = await mount({ an: h });

    // Ruhe: solange nichts wartet, ist der ganze Block weg — er drängt nichts nach unten.
    expect(leiste.el("pending-capture").hidden).toBe(true);

    h.setSelected({ ...CISCO, variants: plainVariants(CISCO.text) });
    await h.listeners.action?.({ id: 7, url: CISCO.url, title: CISCO.title });
    await leiste.settle();

    expect(leiste.el("pending-capture").hidden).toBe(false);
    // Die wartende Seite wird BENANNT — vorher stand dort ein Satz über nichts Greifbares.
    expect(leiste.el("pending-source").hidden).toBe(false);
    expect(leiste.el("pending-source").textContent).toContain(CISCO.title);
    expect(leiste.el("pending-source").textContent).toContain(CISCO.url);
    // Beide Wege sind da und beschriftet — keine leere Taste, kein Schlüsselname.
    expect(leiste.el("pending-replace").textContent).toBe("Neue Auswahl übernehmen und ersetzen");
    expect(leiste.el("pending-keep").textContent).toBe("Offene Übernahme behalten");
  });

  it("„übernehmen und ersetzen“ bringt die WARTENDE Seite in die Leiste", async () => {
    const h = harness(async () => Response.json(null, { status: 200 }));
    h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
    const leiste = await mount({ an: h });
    h.setSelected({ ...CISCO, variants: plainVariants(CISCO.text) });
    await h.listeners.action?.({ id: 7, url: CISCO.url, title: CISCO.title });
    await leiste.settle();

    // GENAU Pedis Bildbeleg 14:20: Chrome auf der Cisco-Seite, die Leiste auf advisor.nl.
    expect(leiste.el("page").textContent).toBe(ADVISOR.title);
    leiste.el("pending-replace").click();
    await leiste.settle();

    expect(leiste.el("page").textContent).toBe(CISCO.title);
    expect(leiste.el("source").textContent).toBe(CISCO.url);
    // Und Befund 14:23: die Markierung dieser Seite ist da, nicht „nicht vorhanden".
    expect(leiste.el("info-selection").textContent).toContain("Zeichen");
    expect(leiste.el("info-selection").textContent).not.toContain("nicht vorhanden");
    expect(leiste.el("pending-capture").hidden).toBe(true);
  });

  it("„offene Übernahme behalten“ legt nur die Nachfrage weg", async () => {
    const h = harness(async () => Response.json(null, { status: 200 }));
    h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
    const leiste = await mount({ an: h });
    h.setSelected({ ...CISCO, variants: plainVariants(CISCO.text) });
    await h.listeners.action?.({ id: 7, url: CISCO.url, title: CISCO.title });
    await leiste.settle();

    leiste.el("pending-keep").click();
    await leiste.settle();

    expect(leiste.el("pending-capture").hidden).toBe(true);
    expect(leiste.el("page").textContent).toBe(ADVISOR.title);
  });
});

describe("JOB 3606 (c) · der Grund des Servers steht in der Zustandszeile", () => {
  it("hängt die Meldung hinter den eigenen Satz, statt sie zu verschlucken", async () => {
    const h = harness(async (url, options) => {
      if (String(url).endsWith("/login"))
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      if (options?.method === "POST")
        return Response.json(
          { error: "BAD_REQUEST", message: "bodyHtml muss Text sein" },
          { status: 400 },
        );
      return Response.json(null, { status: 200 });
    });
    h.setSelected({ ...ADVISOR, variants: plainVariants(ADVISOR.text) });
    const leiste = await mount({ an: h });
    await leiste.login();
    leiste.input("title", "Ein Titel");
    leiste.el("confirm").checked = true;
    leiste.el("confirm").dispatchEvent(new leiste.win.Event("change"));
    await leiste.settle();
    expect(leiste.el("save").disabled).toBe(false);
    leiste.el("save").click();
    await leiste.settle();

    const zeile = leiste.el("status").textContent ?? "";
    // Der eigene Satz bleibt — er sagt, dass die Auswahl erhalten ist. Der fremde kommt DAZU.
    expect(zeile).toContain("Server lehnt die Anfrage ab");
    expect(zeile).toContain("bodyHtml muss Text sein");
    // Rot, wie jedes gescheiterte Speichern (`TON.crit` enthält `rejected`).
    expect(leiste.el("status").className).toBe("crit");
  });
});
