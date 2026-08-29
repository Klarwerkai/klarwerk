// @vitest-environment jsdom
// ================================================================================================
// JOB 2693 D1 — DIE STELLE, AN DER DER MENSCH HANDELT: DIE SSO-CALLBACK-SEITE
// ================================================================================================
//
// Der Server antwortet mit `{error, message}`; `SsoCallback.tsx` zeigt `e.message` eines ApiError
// (Z.33). Dieser Fall mountet die echte Seite und laesst den Anmelde-Aufruf so scheitern, wie die
// Route es seit 2693 tut — der Mensch liest „Anmeldedienst antwortet nicht." und nicht
// „SSO-Status ungueltig". Die Seite gehoert PRO (2686 D3) und wird hier NICHT veraendert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  fehler: undefined as undefined | Error,
  aufrufe: [] as Array<{ code: string; state: string }>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    oidc: (code: string, state: string) => {
      lage.aufrufe.push({ code, state });
      return lage.fehler ? Promise.reject(lage.fehler) : Promise.resolve({ user: {} });
    },
  },
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { SsoCallback } from "../../apps/web/src/auth/SsoCallback";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  lage.aufrufe = [];
  window.history.replaceState({}, "", "/sso/callback?code=code-vom-idp&state=s1");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function mountUndWarte(): Promise<void> {
  await act(async () => {
    root.render(createElement(SsoCallback));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

describe("JOB 2693 D1 · SSO-Callback-Seite", () => {
  it("S1 · der Mensch liest „Anmeldedienst antwortet nicht.“ und bekommt den Weg zurueck zur Anmeldung", async () => {
    lage.fehler = new ApiError(401, "INVALID_CREDENTIALS", "Anmeldedienst antwortet nicht.");
    await mountUndWarte();
    expect(lage.aufrufe).toEqual([{ code: "code-vom-idp", state: "s1" }]);
    const text = container.textContent ?? "";
    expect(text).toContain("Anmeldedienst antwortet nicht.");
    expect(text).not.toContain("SSO-Status");
    expect(container.querySelector("button")?.textContent).toBe(i18n.t("auth.toSignIn"));
  });

  it("S2 · Gegenprobe: ohne Fehler bleibt die Seite beim „Anmeldung laeuft“-Text", async () => {
    lage.fehler = undefined;
    // jsdom laesst `location.assign` nicht ersetzen; die Weiterleitung selbst meldet jsdom als
    // „not implemented" — gemessen wird hier nur, dass KEIN Fehlertext erscheint.
    await mountUndWarte();
    expect(lage.aufrufe).toHaveLength(1);
    expect(container.textContent).not.toContain("Anmeldedienst antwortet nicht.");
    expect(container.textContent).toContain(i18n.t("auth.ssoBusy"));
  });
});
