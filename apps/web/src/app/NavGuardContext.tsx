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
  // AUFTRAG-mega5 Block A (bens Ship-Gate 1): Inhalte, die der Entwurf NICHT sichern kann, werden vor
  // dem Wechsel einzeln und verständlich benannt. Liefert die Liste dieser Inhalte (leer/fehlend =
  // alles sicherbar). Nicht leer ⇒ der Dialog bietet KEIN „Entwurf speichern und wechseln" an —
  // ein Speichern, das erfolgreich wegnavigiert und dabei Benanntes verliert, wäre eine Lüge.
  unsavableDirtyReasons?: () => string[];
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
  // AUFTRAG-mega5 Block A: beim Öffnen des Dialogs EINMAL eingefroren — die Liste ändert sich nicht
  // mitten im offenen Dialog (kein Knopf, der unter dem Zeiger erscheint/verschwindet).
  const [unsavable, setUnsavable] = useState<string[]>([]);

  const setGuard = useCallback((guard: DirtyGuard | null): void => {
    guardRef.current = guard;
  }, []);

  const guard = useCallback((proceed: () => void): void => {
    if (guardRef.current?.isDirty()) {
      setUnsavable(guardRef.current.unsavableDirtyReasons?.() ?? []);
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
      <Modal
        open={pending !== null}
        onClose={close}
        title={unsavable.length > 0 ? t("nav.guard.unsavableTitle") : t("nav.guard.title")}
      >
        {/* AUFTRAG-mega5 Block A (bens Ship-Gate 1): sind nicht sicherbare Inhalte im Spiel, sagt der
            Dialog VOR dem Wechsel ausdrücklich und einzeln, WAS verloren ginge — und bietet nur
            „Hier bleiben" oder bewusstes Verwerfen an. Ein „Speichern", das erfolgreich wegnavigiert
            und die benannten Inhalte dabei still fallen lässt, gibt es hier nicht. */}
        {unsavable.length > 0 ? (
          <>
            <p className="text-[13px] leading-relaxed text-text">{t("nav.guard.unsavableLead")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-text">
              {unsavable.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              {t("nav.guard.unsavableHint")}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="primary" onClick={close}>
                {t("nav.guard.stay")}
              </Button>
              <Button variant="ghost" onClick={runPending}>
                {t("nav.guard.discard")}
              </Button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </Modal>
    </NavGuardCtx.Provider>
  );
}
