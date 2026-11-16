import { describe, expect, it } from 'vitest';
import { Command } from '@mvvm/command';
import { CommandActionEvent } from '@mvvm/commandActionEvent';

const event = () => new CommandActionEvent('command-action', 'run', {}, new Event('click'), []);

describe('command execution cleanup', () => {

  it('rethrows a failing then getter synchronously and permits the next execution', () => {

    const failure = new Error('then getter failed');
    const errors: unknown[] = [], states: boolean[] = [], availability: boolean[] = [];
    let calls = 0;

    const command = new Command(() => {
      calls++;
      if (calls === 1) return Object.defineProperty({}, 'then', { get() { throw failure; } });
      return 42;
    }, error => errors.push(error), { blockWhileExecuting: true });

    const offState = command.subscribeExecutionState(state => states.push(state));
    const offAvailability = command.subscribeCanExecuteChanged(() => availability.push(command.canExecute()));

    try {

      let thrown: unknown;
      try { command.execute(event()); } catch (error) { thrown = error; }
      expect(thrown).toBe(failure);
      expect(command.isExecuting).toBe(false);
      expect(command.canExecute()).toBe(true);
      expect(errors).toEqual([]);
      expect(states).toEqual([true, false]);
      expect(availability).toEqual([false, true]);
      expect(command.execute(event())).toBe(undefined);
      expect(calls).toBe(2);
      expect(states).toEqual([true, false, true, false]);
    } finally { 
      offState(); 
      offAvailability(); 
    }

  });

  it('does not finish another pending execution when inspecting a result throws', async () => {

    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const failure = new Error('inspection failed');
    let calls = 0;

    const command = new Command(() => ++calls === 1 ? pending : Object.defineProperty({}, 'then', {
      get() { throw failure; },
    }));

    const states: boolean[] = [];
    const off = command.subscribeExecutionState(state => states.push(state));
    const first = command.execute(event());

    try {

      let thrown: unknown;
      try { command.execute(event()); } catch (error) { thrown = error; }
      expect(thrown).toBe(failure);
      expect(command.isExecuting).toBe(true);
      expect(states).toEqual([true]);
    } finally { 

      finish(); 
      await first; 
      off(); 
    }

    expect(command.isExecuting).toBe(false);
    expect(states).toEqual([true, false]);

  });

  it('restores execution state when Promise assimilation throws synchronously', () => {

    const failure = new Error('constructor getter failed');
    const promise = Promise.resolve();
    Object.defineProperty(promise, 'constructor', { get() { throw failure; } });
    const command = new Command(() => promise);
    let thrown: unknown;

    try { 
      command.execute(event()); 
    } catch (error) { 
      thrown = error; 
    }

    expect(thrown).toBe(failure);
    expect(command.isExecuting).toBe(false);

  });

  it('keeps synchronous callback failures synchronous and clears state', () => {

    const failure = new Error('callback failed');
    const errors: unknown[] = [];
    const command = new Command(() => { throw failure; }, error => errors.push(error));

    let thrown: unknown;

    try { 
      command.execute(event()); 
    } catch (error) { 
      thrown = error; 
    }

    expect(thrown).toBe(failure);
    expect(command.isExecuting).toBe(false);
    expect(errors).toEqual([]);

  });

  it('awaits a normal thenable and ignores repeated settlement', async () => {

    const states: boolean[] = [];
    const command = new Command(() => ({ then(resolve: (value?: unknown) => void) { resolve(); resolve(); } }));
    const off = command.subscribeExecutionState(state => states.push(state));

    try {

      const execution = command.execute(event());
      expect(command.isExecuting).toBe(true);
      await execution;
      expect(command.isExecuting).toBe(false);
      expect(states).toEqual([true, false]);

    } finally { 

      off(); 
    }
  });

  it('clears state when an asynchronous error handler throws', async () => {

    const failure = new Error('rejection'), handlerFailure = new Error('handler failed');
    const errors: unknown[] = [], states: boolean[] = [];

    const command = new Command(() => Promise.reject(failure), error => {
      errors.push(error); throw handlerFailure;
    }, { blockWhileExecuting: true });

    const off = command.subscribeExecutionState(state => states.push(state));

    try {

      let thrown: unknown;
      try { await command.execute(event()); } catch (error) { thrown = error; }
      expect(thrown).toBe(handlerFailure);
      expect(errors).toEqual([failure]);
      expect(command.isExecuting).toBe(false);
      expect(command.canExecute()).toBe(true);
      expect(states).toEqual([true, false]);

    } finally { 
      off(); 
    }
  });

  it('rejects with the original asynchronous failure without an error handler', async () => {

    const failure = new Error('rejection');
    const command = new Command(() => Promise.reject(failure));
    let thrown: unknown;
    try { 
      await command.execute(event()); 
    } catch (error) { 
      thrown = error; 
    }

    expect(thrown).toBe(failure);
    expect(command.isExecuting).toBe(false);

  });
  
});
