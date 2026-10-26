/** Kurze Antwortfrist; ein Haenger belegt dauerhaft hoechstens eine Abfrage dieses bestehenden Pools. */
export const READINESS_FRIST_MS = 1000;
export interface BereitschaftsPool {
  query(text: string): Promise<unknown>;
}
export function datenbankBereitschaft(
  pool: BereitschaftsPool,
  fristMs: number = READINESS_FRIST_MS,
): () => Promise<boolean> {
  let imFlug: Promise<boolean> | null = null;
  return async () => {
    if (imFlug === null) {
      const neu = Promise.resolve()
        .then(() => pool.query("SELECT 1"))
        .then(
          () => true,
          () => false,
        );
      imFlug = neu;
      void neu.then(() => {
        if (imFlug === neu) imFlug = null;
      });
    }
    let uhr: ReturnType<typeof setTimeout> | undefined;
    const frist = new Promise<boolean>((fertig) => {
      uhr = setTimeout(() => fertig(false), fristMs);
      uhr.unref?.();
    });
    try {
      return await Promise.race([imFlug, frist]);
    } finally {
      clearTimeout(uhr);
    }
  };
}
