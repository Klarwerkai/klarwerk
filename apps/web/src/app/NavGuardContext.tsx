import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../components/Modal";
import { Button } from "../components/ui";

// Bug (Pedi 04.07.): Seitenwechsel während des Erfassens hat den Inhalt verloren. Der
// `beforeunload`-Schutz greift nur beim Neuladen/Schließen des Browsers, NICHT beim
// clientseitigen Seitenwechsel (React Router). Dieser Wächter fängt den In-App-Wechsel ab:
// Eine Seite meldet „ungespeicherte Eingabe" an, die Navigation fragt vorher nach
// (Bleiben · Verwerfen · Entwurf speichern). Der Router ist ein klassischer BrowserRouter,
// daher kein useBlocker — die Navigationsquellen (Sidebar, Command-Palette) rufen `guard()`.

export interface DirtyGuard {
  isDirty: () => boolean;
  save: () => Promise<void>;
}

interface NavGuardValue {
  // Eine Seite registriert (oder entfernt mit null) ihren Ungespeichert-Wächter.
  setGuard: (guard: DirtyGuard | null) => void;
  // Navigationsquellen leiten den Wechsel hier durch; bei „dirty" wird erst gefragt.
  guard: (proceed: () => void) => void;
}

const NavGuardCtx = createContext<NavGuardValue | null>(null);

export function useNavGuard(): NavGuardValue {
  const value = useContext(NavGuardCtx);
  if (!value) {
    throw new Error("useNavGuard must be used within NavGuardProvider");
  }
  return value;
}

export function NavGuardProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const guardRef = useRef<DirtyGuard | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const setGuard = useCallback((guard: DirtyGuard | null): void => {
    guardRef.current = guard;
  }, []);

  const guard = useCallback((proceed: () => void): void => {
    if (guardRef.current?.isDirty()) {
      setPending(() => proceed);
    } else {
      proceed();
    }
  }, []);

  const close = (): void => setPending(null);

  const runPending = (): void => {
    const proceed = pending;
    setPending(null);
    proceed?.();
  };

  const saveAndGo = async (): Promise<void> => {
    const active = guardRef.current;
    if (!active) {
      runPending();
      return;
    }
    setSaving(true);
    try {
      await active.save();
      runPending();
    } catch {
      // Speichern fehlgeschlagen: Dialog offen lassen — die Seite zeigt die Fehlermeldung.
      // Nicht wechseln, damit nichts verloren geht.
    } finally {
      setSaving(false);
    }
  };

  return (
    <NavGuardCtx.Provider value={{ setGuard, guard }}>
      {children}
      <Modal open={pending !== null} onClose={close} title={t("nav.guard.title")}>
        <p className="text-[13px] leading-relaxed text-text">{t("nav.guard.body")}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {t("nav.guard.stay")}
          </Button>
          <Button variant="ghost" onClick={runPending}>
            {t("nav.guard.discard")}
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => void saveAndGo()}>
            {t("nav.guard.save")}
          </Button>
        </div>
      </Modal>
    </NavGuardCtx.Provider>
  );
}
