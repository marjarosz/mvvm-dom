import { describe, expect, it } from 'vitest';
import { ViewListController } from '@mvvm/viewListController';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';

describe('ViewListController focus preservation', () => {

  for (const place of ['start', 'end'] as const) {

    for (const focusedIndex of [0, 1]) {

      it(`preserves input focus and backward selection during ${place} reorder, item ${focusedIndex}`, () => {

        const host = document.createElement('div');
        const marker = document.createElement('span');
        host.append(marker); document.body.append(host);
        const controller = new ViewListController(host, place);
        const a = document.createElement('input'), b = document.createElement('input');

        try {
          controller.setSource([a, b]);
          const input = [a, b][focusedIndex];
          input.value = 'abcdef'; input.focus(); input.setSelectionRange(1, 4, 'backward');
          expect(document.activeElement).toBe(input);
          controller.setSource([b, a]);
          expect(document.activeElement).toBe(input);
          expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([1, 4, 'backward']);
          expect(input.value).toBe('abcdef');
          expect(Array.from(host.children)).toEqual(place === 'start' ? [b, a, marker] : [marker, b, a]);

        } finally { 
          controller.dispose(); 
          host.remove(); 
        }

      });
    }
  }

  it('preserves a nested textarea in a multi-root View when an observed source reverses', () => {

    const host = document.createElement('div'); document.body.append(host);
    const controller = new ViewListController(host);
    const template = document.createElement('template');
    template.innerHTML = '<span>Label</span><section><textarea></textarea></section>';
    const model = new ViewModel(), view = new View(template, model);
    const other = document.createElement('div');
    const source = new ArrayObserver<unknown>(view, other);

    try {
      controller.setSource(source);
      const input = host.querySelector('textarea')!;
      input.value = 'abcdef'; input.focus(); input.setSelectionRange(2, 5, 'forward');
      source.reverse();
      expect(document.activeElement).toBe(input);
      expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([2, 5, 'forward']);
      expect(host.firstChild).toBe(other);
    } finally { 
      controller.dispose(); 
      view.dispose(); 
      model.dispose(); 
      host.remove(); 
    }

  });

  it('does not restore an input removed from the desired list', () => {

    const host = document.createElement('div'); document.body.append(host);
    const controller = new ViewListController(host);
    const a = document.createElement('input'), b = document.createElement('input');

    try {

      controller.setSource([a, b]); a.focus();
      let refocused = 0; a.addEventListener('focus', () => refocused++);
      controller.setSource([b]);
      expect(a.isConnected).toBe(false);
      expect(document.activeElement === a).toBe(false);
      expect(refocused).toBe(0);

    } finally { 
      controller.dispose(); 
      host.remove(); 
    }

  });

  it('lets ready handlers intentionally focus a newly inserted control', () => {

    const host = document.createElement('div'); document.body.append(host);
    const controller = new ViewListController(host);
    const a = document.createElement('input'), b = document.createElement('input'), added = document.createElement('input');
    
    try {

      controller.setSource([a, b]); a.focus();
      added.addEventListener('ready', () => added.focus());
      controller.setSource([b, a, added]);
      expect(document.activeElement).toBe(added);

    } finally { 
      controller.dispose(); 
      host.remove();
    }

  });

  it('does not steal focus from a control outside the list', () => {

    const host = document.createElement('div'), outside = document.createElement('input');
    document.body.append(host, outside);
    const controller = new ViewListController(host);
    const a = document.createElement('input'), b = document.createElement('input');

    try {

      controller.setSource([a, b]); outside.focus();
      controller.setSource([b, a]);
      expect(document.activeElement).toBe(outside);

    } finally { 
      controller.dispose(); 
      host.remove();
      outside.remove(); 
    }

  });

  it('does not refocus an unchanged control or change its selection', () => {

    const host = document.createElement('div'); document.body.append(host);
    const controller = new ViewListController(host), input = document.createElement('input');

    try {

      controller.setSource([input]); input.value = 'abc'; input.focus(); input.setSelectionRange(1, 1);
      let focused = 0; input.addEventListener('focus', () => focused++);
      controller.refresh();
      expect(document.activeElement).toBe(input);
      expect(focused).toBe(0);
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);

    } finally { 
      controller.dispose(); 
      host.remove(); 
    }

  });
  
});
