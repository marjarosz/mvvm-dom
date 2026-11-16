import { parseBindingMode } from './bindingMode.js';

/** A single parsed `{type: property, arg: value, ...}` binding declaration. */
export interface ParsedBinding {
    /** The binding type name (e.g. `text`, `value`, `if`). */
    bindingType: string;

    /** The data-context property the binding is bound to. */
    propertyName: string;

    /** Raw `name: value` argument declarations, in source order. */
    args: string[];

    /** The declaration text without the surrounding braces. */
    declaration: string;
}

function fail(context: string, index: number, message: string): never {

    throw new SyntaxError(`BindingParser: ${context} at position ${index + 1}: ${message}`);
}

// Return the index of the first top-level separator (or the end of the input).
function scan(value: string, start: number, separator: string, context: string): number {

    const stack: string[] = [];
    let quote = '';

    for (let index = start; index < value.length; index++) {
        const ch = value[index];

        if (quote) {
            if (ch === '\\') index++;
            else if (ch === quote) quote = '';
        } else if (!stack.length && ch === separator) {
            return index;
        } else if (ch === '"' || ch === "'") {
            quote = ch;
        } else if (ch === '{' || ch === '[' || ch === '(') {
            stack.push(ch === '{' ? '}' : ch === '[' ? ']' : ')');
        } else if (ch === '}' || ch === ']' || ch === ')') {
            if (stack.pop() !== ch) fail(context, index, `unexpected '${ch}'`);
        }

    }

    if (quote || stack.length) fail(context, value.length, `expected '${quote || stack[stack.length - 1]}'`);
    return value.length;
}

/**
 * Splits a string on top-level occurrences of a separator - separators
 * inside quotes or nested `()` / `[]` / `{}` groups do not split.
 *
 * @param value The string to split.
 * @param separator The single-character separator.
 * @returns Trimmed parts, in source order.
 */
export function splitTopLevel(value: string, separator: string): string[] {

    const parts: string[] = [];
    let start = 0;

    while (start <= value.length) {
        const end = scan(value, start, separator, 'argument');
        parts.push(value.slice(start, end).trim());
        start = end + 1;
    }

    return parts;
}

/**
 * Splits a string at the first top-level occurrence of a separator.
 *
 * @param value The string to split.
 * @param separator The single-character separator.
 * @returns The trimmed `[before, after]` pair, or `undefined` when the
 *   separator does not occur at the top level.
 */
export function splitFirstTopLevel(value: string, separator: string): [string, string] | undefined {

    const end = scan(value, 0, separator, 'argument');
    if (end === value.length) return undefined;

    return [value.slice(0, end).trim(), value.slice(end + 1).trim()];
}

function skipSpaces(value: string, index: number): number {

    while (index < value.length && /\s/.test(value[index])) index++;

    return index;
}

/**
 * Parses a `data-bind`-style declaration such as
 * `{text: name, value: age, mode: twoWay}` into individual bindings.
 *
 * @param value The declaration string.
 * @param context Label used in error messages.
 * @param checkBindingMode When true, rejects the unsupported `bindWay`
 *   argument and validates the `mode` argument.
 * @returns The parsed bindings, in source order.
 * @throws {SyntaxError} When the declaration is malformed.
 */
export function parseBindings(value: string, context = 'binding', checkBindingMode = false): ParsedBinding[] {

    const bindings: ParsedBinding[] = [];
    let index = skipSpaces(value, 0);

    while (index < value.length) {

        if (value[index] !== '{') fail(context, index, "expected '{'");

        const start = index + 1;
        const end = scan(value, start, '}', context);

        if (end === value.length) fail(context, end, "expected '}'");
        const declaration = value.slice(start, end);
        const args: string[] = [];
        const names = new Set<string>();

        let bindingType = '';
        let propertyName = '';
        let offset = 0;

        while (offset <= declaration.length) {
            const next = scan(declaration, offset, ',', context);
            const field = declaration.slice(offset, next);
            const colon = scan(field, 0, ':', context);
            const name = field.slice(0, colon).trim();
            const location = start + skipSpaces(declaration, offset);

            if (!name) fail(context, location, offset ? 'missing argument name' : 'missing binding type');

            if (colon === field.length) fail(context, start + next, `expected ':' after '${name}'`);

            const argument = field.slice(colon + 1).trim();

            if (!offset) {

                if (!argument) fail(context, start + next, `missing property name after '${name}:'`);
                bindingType = name;
                propertyName = argument;

            } else {

                if (checkBindingMode && name === 'bindWay') {
                    fail(context, location, 'unsupported argument bindWay; use mode');
                }
                if (names.has(name)) fail(context, location, `duplicate argument '${name}' in '${bindingType}: ${propertyName}'`);

                if (checkBindingMode && name === 'mode' && parseBindingMode(argument) === undefined) {
                    fail(context, location, `unknown mode '${argument}' in '${bindingType}: ${propertyName}'`);
                }

                names.add(name);
                args.push(field.trim());
            }

            offset = next + 1;
        }

        bindings.push({ bindingType, propertyName, args, declaration });
        index = skipSpaces(value, end + 1);

        if (value[index] === ',') {
            index = skipSpaces(value, index + 1);
        }
    }

    return bindings;
}

/**
 * Extracts the individual `{...}` declaration texts from a
 * `data-bind`-style string.
 *
 * @param value The declaration string.
 * @returns The declaration texts, in source order.
 * @throws {SyntaxError} When the declaration is malformed.
 */
export function extractBindings(value: string): string[] {
    
    return parseBindings(value).map(bind => bind.declaration);
}
