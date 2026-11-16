import { describe, expect, it } from 'vitest';
import { extractBindings, parseBindings, splitFirstTopLevel, splitTopLevel } from '@mvvm/bindingParser';
import { View } from '@mvvm/view';

describe('binding grammar', () => {

  it('extracts multiple complete bindings in their original order', () => {
    expect(extractBindings('{text: title}, {class: state}')).toEqual(['text: title', 'class: state']);
  });

  it('does not split quoted commas or nested delimiters', () => {
    expect(splitTopLevel('text: name, message: "a,b:c", data: {x: [1,2]}', ','))
      .toEqual(['text: name', 'message: "a,b:c"', 'data: {x: [1,2]}']);
  });

  it('preserves colons in an argument value', () => {
    expect(splitFirstTopLevel('url: https://example.test/a:b', ':'))
      .toEqual(['url', 'https://example.test/a:b']);
  });

  it('accepts adjacent declarations and a trailing comma', () => {
    expect(extractBindings('{click: save}{resize: refresh}, ')).toEqual(['click: save', 'resize: refresh']);
  });

  it('keeps quoted arguments, escaped quotes and nested values intact', () => {
    const arg = String.raw`message: "a\"b,c}"`;
    expect(parseBindings(`{custom: field, ${arg}, options: [{x: (1,2)}]}`)[0].args)
      .toEqual([arg, 'options: [{x: (1,2)}]']);
  });

  it.each([
    ['{text: a} junk {text: b}', 11],
    ['{text: a},, {text: b}', 11],
    ['{text: a, x: ([)]}', 16],
    ['{text: a, x: 1, x: 2}', 17],
    ['{text: a, : 2}', 11],
    ['{text: a, x}', 12],
  ] as const)('reports the position of invalid syntax in %s', (source, position) => {
    expect(() => parseBindings(source)).toThrow(`position ${position}:`);
  });

  it.each(['data-bind', 'data-command', 'data-validate-error'])('identifies the template and %s on construction', attribute => {
    const source = document.createElement('template');
    source.id = 'user-form';
    source.innerHTML = `<div ${attribute}="{text: }"></div>`;
    expect(() => new View(source)).toThrow(`#user-form ${attribute} at position 8: missing property name after 'text:'`);
  });

  it('reports an unknown mode on a data binding', () => {
    const source = document.createElement('template');
    source.innerHTML = '<input data-bind="{value: name, mode: typo}">';
    expect(() => new View(source)).toThrow(/unknown mode 'typo'/);
  });

  it('accepts an empty attribute as an empty binding list', () => {
    expect(extractBindings('   ')).toEqual([]);
  });

  it.each(['text: title', '{text: title', '{text: title}}', 'junk {text: title}', '{text: title} junk', '{text: "unfinished}'])
    ('rejects malformed input %s instead of silently dropping it', source => {
      expect(() => extractBindings(source)).toThrow();
    });
    
});
