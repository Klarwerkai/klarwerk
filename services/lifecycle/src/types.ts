export interface LearningStep {
  id: string;
  title: string;
}

export interface LearningPath {
  id: string;
  role: string;
  steps: LearningStep[];
}

// R-1349: Die Fehlerklasse `LifecycleError` (Code NOT_FOUND) warf kein Produktweg; der Lebenszyklus
// meldet über die Fehler seiner Nachbardienste. Sie ist entfernt.
