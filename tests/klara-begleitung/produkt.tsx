// ================================================================================================
// BPA-05 · PRÜFGERÜST: der ECHTE Router (`AppRoutes`) in der ECHTEN Hülle (`AppShell`).
// ================================================================================================
//
// Anmeldung, Rollen, Meldungen und Navigationswächter wie im Produkt; das Netz läuft über das
// `fetch`-Double aus `tests/fe003-tutorial-fragen/huelle.tsx` (Rolle über `netz.lage.rolle`).
// Kein Formular wird eingefügt — was gemessen wird, ist die ausgelieferte Seite.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { AppRoutes } from "../../apps/web/src/routes";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { ruhe } from "../fe003-tutorial-fragen/huelle";

export interface Produkt {
  abbauen: () => void;
}

export async function montiereProdukt(route: string): Promise<Produkt> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [route] },
                  createElement(AppShell, null, createElement(AppRoutes)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  return {
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Ein Feld des Prüfformulars (`pages/BegleitungPruefformular.tsx`). */
export function pfFeld(name: string): HTMLInputElement {
  return document.getElementById(`pf-${name}`) as HTMLInputElement;
}

export function knopfMitText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((b) => b.textContent === text);
}
