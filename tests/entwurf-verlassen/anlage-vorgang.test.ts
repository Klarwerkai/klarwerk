// ================================================================================================
// R-0020 — DER AN DIE NUTZLAST GEBUNDENE WIEDERHOLSCHLÜSSEL (`lib/createOperation.ts`).
// ================================================================================================
//
// Derselbe Inhalt ⇒ derselbe Schlüssel (die Wiederholung nach verlorener Antwort legt nichts neu
// an); anderer Inhalt ⇒ neuer Schlüssel (kein Abdruckkonflikt ohne Ausweg). Und die Kennung
// entsteht auch dort, wo `crypto.randomUUID` fehlt (unsicherer Kontext, `http://<LAN-Adresse>`) —
// sonst scheiterte dort jedes Speichern eines Entwurfs an einem Schlüssel, den es vorher nicht gab.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  anlageVorgangFuer,
  anlageVorgangWiederholen,
} from "../../apps/web/src/lib/createOperation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R-0020 · anlageVorgangFuer", () => {
  it("derselbe Abdruck behält den Schlüssel, ein anderer bekommt einen neuen", () => {
    const erst = anlageVorgangFuer(null, '{"title":"A"}');
    expect(erst.id).toMatch(/^create-/);
    expect(anlageVorgangFuer(erst, '{"title":"A"}')).toBe(erst);
    const anders = anlageVorgangFuer(erst, '{"title":"B"}');
    expect(anders.id).not.toBe(erst.id);
    expect(anders.abdruck).toBe('{"title":"B"}');
  });

  it("entscheidung:14ce8681 · ein offener (unklarer) Vorgang behält seinen Schlüssel auch bei geändertem Inhalt und schreibt fort", () => {
    const erst = anlageVorgangWiederholen(null, '{"title":"A"}');
    expect(erst.fortschreiben).toBe(false);
    const geaendert = anlageVorgangWiederholen(erst.vorgang, '{"title":"B"}');
    expect(geaendert.vorgang.id).toBe(erst.vorgang.id);
    expect(geaendert.vorgang.abdruck).toBe('{"title":"B"}');
    expect(geaendert.fortschreiben).toBe(true);
  });

  it("ohne crypto.randomUUID (unsicherer Kontext) entsteht trotzdem eine gültige Kennung", () => {
    const echt = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: <T extends Uint8Array<ArrayBuffer>>(a: T): T => echt.getRandomValues(a),
    });
    const vorgang = anlageVorgangFuer(null, "{}");
    expect(vorgang.id).toMatch(/^create-[0-9a-f]{32}$/);
    expect(anlageVorgangFuer(null, "{}").id).not.toBe(vorgang.id);
  });
});
