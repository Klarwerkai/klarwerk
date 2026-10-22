import ts from "typescript";

// Gleicher Pfad mit anderem Text bekommt einen eigenen Baum; Kalibrierungen bleiben getrennt.
const quellen = new Map<string, Map<string, ts.SourceFile>>();

/** Eindeutige ausführbare Deklaration oder ein benannter Aufruf in genau diesem Rumpf. */
export function ankerBereich(text: string, pfad: string, anker: string): [number, number] {
  let fassungen = quellen.get(pfad);
  if (!fassungen) {
    fassungen = new Map();
    quellen.set(pfad, fassungen);
  }
  let source = fassungen.get(text);
  if (!source) {
    source = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    fassungen.set(text, source);
  }
  const [owner, call] = anker.split(">");
  const declarations: (ts.FunctionDeclaration | ts.MethodDeclaration)[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && node.body && node.name.text === owner) {
      declarations.push(node);
    }
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.body) {
      const parent = node.parent;
      if (
        ts.isClassDeclaration(parent) &&
        parent.name &&
        `${parent.name.text}.${node.name.text}` === owner
      ) {
        declarations.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const declaration = declarations[0];
  if (declarations.length !== 1 || !declaration) {
    throw new Error(`${pfad}#${anker}: ausführbarer Anker fehlt oder ist mehrdeutig`);
  }
  let target: ts.Node = declaration;
  if (call) {
    const calls: ts.CallExpression[] = [];
    const find = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const name = ts.isIdentifier(expression)
          ? expression.text
          : ts.isPropertyAccessExpression(expression)
            ? expression.name.text
            : undefined;
        if (name === call) calls.push(node);
      }
      ts.forEachChild(node, find);
    };
    if (declaration.body) find(declaration.body);
    const actual = calls[0];
    if (calls.length !== 1 || !actual)
      throw new Error(`${pfad}#${anker}: Aufruf fehlt oder ist mehrdeutig`);
    target = actual.expression;
  }
  return [
    source.getLineAndCharacterOfPosition(target.getStart(source)).line + 1,
    source.getLineAndCharacterOfPosition(target.getEnd()).line + 1,
  ];
}
