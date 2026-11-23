import { describe, expect, it, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import { own } from '../helpers/resources';
import { mounted } from '../helpers/views';

function capture(action: () => void) {

  try { action(); return { thrown: false, error: undefined }; }
  catch (error) { return { thrown: true, error }; }

}

describe('command registry notification failures', () => {

  for (const operation of ['register', 'unregister'] as const) {

    it.each([new Error('first'), undefined])(`${operation}: notifies every listener and rethrows the first value %s`, failure => {
      const model = own(new ViewModel());
      const command = new Command(() => {});
      model.registerCommand('save', command);
      const calls: string[] = [];
      const releases = [
        model.subscribeCommands(name => { calls.push(`first:${name}`); throw failure; }),
        model.subscribeCommands(name => { calls.push(`second:${name}`); throw new Error('second'); }),
        model.subscribeCommands(name => { calls.push(`third:${name}`); }),
      ];

      try {

        const result = capture(() => operation === 'register'
          ? model.registerCommand('save', command) : model.unregisterCommand('save'));
        expect(result).toEqual({ thrown: true, error: failure });
        expect(calls).toEqual(['first:save', 'second:save', 'third:save']);
        expect(model.getCommand('save')).toBe(operation === 'register' ? command : undefined);
      } finally { 
        releases.forEach(release => release()); 
      }

    });

    it(`${operation}: keeps both shared views synchronized despite an earlier failing listener`, () => {

      const model = own(new ViewModel());
      const command = new Command(() => {});
      if (operation === 'unregister') model.registerCommand('save', command);
      const failure = new Error('subscriber');
      const release = model.subscribeCommands(() => { throw failure; });
      const a = mounted('<button data-command="{click: save}">Save</button>', model);
      const b = mounted('<button data-command="{click: save}">Save</button>', model);

      try {

        expect(capture(() => operation === 'register'
          ? model.registerCommand('save', command) : model.unregisterCommand('save')).error).toBe(failure);
        expect(a.host.querySelector('button')!.disabled).toBe(operation === 'unregister');
        expect(b.host.querySelector('button')!.disabled).toBe(operation === 'unregister');

      } finally { 
        release(); 
      }
    });
  }

  it('uses a snapshot when a listener removes another and adds a new listener', () => {

    const model = own(new ViewModel());
    const calls: string[] = [];
    const late = vi.fn();
    let removeSecond = () => {};

    const removeFirst = model.subscribeCommands(name => {
      calls.push(`first:${name}`);
      removeSecond();
      model.subscribeCommands(late);
      throw new Error('first');
    });

    removeSecond = model.subscribeCommands(name => calls.push(`second:${name}`));
    capture(() => model.registerCommand('save', new Command(() => {})));
    expect(calls).toEqual(['first:save', 'second:save']);
    expect(late).not.toHaveBeenCalled();
    removeFirst();
    model.unregisterCommand('save');
    expect(late).toHaveBeenCalledExactlyOnceWith('save');

  });

  it('retains synchronous nested notifications and propagates their original failure', () => {
    const model = own(new ViewModel());
    const calls: string[] = [];
    const failure = new Error('nested');

    const first = model.subscribeCommands(name => {
      calls.push(`first:${name}`);
      if (name === 'outer') model.registerCommand('inner', new Command(() => {}));
      else throw failure;
    });

    const second = model.subscribeCommands(name => calls.push(`second:${name}`));

    try {

      expect(capture(() => model.registerCommand('outer', new Command(() => {}))).error).toBe(failure);
      expect(calls).toEqual(['first:outer', 'first:inner', 'second:inner', 'second:outer']);
      expect(model.getCommand('inner')).toBeDefined();
      expect(model.getCommand('outer')).toBeDefined();

    } finally { 
      first(); 
      second(); 
    }

  });
  
});
