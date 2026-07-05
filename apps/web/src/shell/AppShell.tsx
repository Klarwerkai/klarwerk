import type { ReactNode } from "react";
// Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — schwebender ?-Knopf, nie aufdringlich.
import { KlaraAssistant } from "../components/KlaraAssistant";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { ToastViewport } from "./ToastViewport";
import { Topbar } from "./Topbar";

// App-Chrome (eingeloggt): Sidebar 252px + Topbar 60px + scrollbarer Content.
// Vollbild-Modus (Auth/Mobile) wird später ohne diese Hülle gerendert.
export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-9 py-7">{children}</main>
      </div>
      <CommandPalette />
      <ToastViewport />
      <KlaraAssistant />
    </div>
  );
}
