// Zusätzlicher Reporter: ein eigener --reporter darf die Gesamtsumme nicht ausblenden.
import { writeFileSync } from "node:fs";
export default class TestZahl {
  onInit() {
    // Vitest 2 beendet eine leere Filtergruppe vor onFinished, aber nach onInit.
    // Nur ein tatsächlich geladener Reporter darf die explizite Null schreiben.
    writeFileSync(process.env.KLARWERK_TEST_ZAHL_DATEI, JSON.stringify({ count: 0 }));
  }
  onFinished(files = []) {
    let count = 0;
    const visit = (task) => {
      if (task.tasks) task.tasks.forEach(visit);
      else if (["pass", "fail"].includes(task.result?.state)) count++;
    };
    files.forEach(visit);
    writeFileSync(process.env.KLARWERK_TEST_ZAHL_DATEI, JSON.stringify({ count }));
  }
}
