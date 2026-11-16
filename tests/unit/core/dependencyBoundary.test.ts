import { readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ESTree, parseSync } from 'vite';

// Architecture guard: the library in src/ must depend only on relative paths
// inside src/ - no npm packages, no absolute escapes, no triple-slash
// references. Any violation is collected and reported as one readable list.
const root = resolve('src');

function sourceFiles(directory: string): string[] {

  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });

}

// Typescript 7 dropped the old ts.createSourceFile / ts.forEachChild API, so the
// AST here comes from the parser that Vite 8 and Rolldown are built on (oxc).
// Its nodes are plain objects; the `seen` set keeps the walk safe against back
// references such as `parent`.
function walk(node: unknown, seen: Set<unknown>, visit: (node: ESTree.Node) => void): void {

  if (typeof node !== 'object' || node === null || seen.has(node)) {
    return;
  }

  seen.add(node);

  if (typeof (node as ESTree.Node).type === 'string') {
    visit(node as ESTree.Node);
  }

  for (const value of Object.values(node)) {

    if (Array.isArray(value)) {

      for (const item of value) {
        walk(item, seen, visit);
      }

    } else {

      walk(value, seen, visit);

    }
  }
}

// Minimal shape shared by every node that could hold a module specifier.
type NodeLike = { type: string; value?: unknown } | null | undefined;

function literalText(node: NodeLike): string | null {

  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null;

}

describe('MVVM dependency boundary', () => {

  it('uses only relative imports within the library', () => {

    const violations: string[] = [];

    for (const file of sourceFiles(root)) {
      const code = readFileSync(file, 'utf8');
      const parsed = parseSync(file, code, { lang: 'ts' });

      if (parsed.errors.length) {
        violations.push(`${file}: parse error`);
        continue;
      }

      function check(specifier: string | null) {

        if (!specifier?.startsWith('.')) {
          violations.push(`${file}: external or non-literal module`);
          return;
        }

        const target = relative(root, resolve(dirname(file), specifier));

        if (target === '..' || target.startsWith(`..${sep}`) || isAbsolute(target)) {
          violations.push(`${file}: ${specifier}`);
        }

      }
      walk(parsed.program, new Set(), node => {

        if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') {

          check(node.source.value);

        } else if (node.type === 'ExportNamedDeclaration' && node.source) {

          check(node.source.value);

        } else if (node.type === 'TSImportEqualsDeclaration' && node.moduleReference.type === 'TSExternalModuleReference') {
          
          check(node.moduleReference.expression.value);

        } else if (node.type === 'ImportExpression') {
          
          check(literalText(node.source));

        } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
          
          check(literalText(node.arguments[0]));
          
        }

      });

      if (/^\/\/\/\s*<reference\s/m.test(code)) {
        violations.push(`${file}: reference directive`);
      }

    }

    expect(violations).toEqual([]);

  });

});
