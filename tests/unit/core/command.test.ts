import { describe, expect, it } from 'vitest';
import { Command, type ICommand } from '@mvvm/command';
import { CommandActionEvent } from '@mvvm/commandActionEvent';

describe('command invocation data', () => {

  it('keeps each invocation data stable across an asynchronous boundary', async () => {

    const pending: Promise<void>[] = [];
    const results: string[] = [];
    const command = new Command(invocation => {

      pending.push((async () => {
        await Promise.resolve();
        results.push(invocation.commandData.args[0]);
      })());

    });

    command.execute(new CommandActionEvent('command-action', 'save', {}, new Event('click'), ['first']));
    command.execute(new CommandActionEvent('command-action', 'save', {}, new Event('click'), ['second']));
    await Promise.all(pending);
    expect(results).toEqual(['first', 'second']);

  });

  it('does not expose the caller-owned argument array as mutable invocation state', () => {

    const captured: ICommand['commandData'][] = [];
    const command = new Command(invocation => { captured.push(invocation.commandData); });
    const args = ['original'];

    command.execute(new CommandActionEvent('command-action', 'save', {}, new Event('click'), args));
    args[0] = 'changed outside';
    expect(captured[0].args).toEqual(['original']);
    expect(Object.isFrozen(captured[0])).toBe(true);
    expect(Object.isFrozen(captured[0].args)).toBe(true);

  });

  it('tracks overlapping asynchronous executions and reports rejected callbacks', async () => {
    const failure = new Error('save failed');
    const errors: unknown[] = [];
    const executionStates: boolean[] = [];

    let finish!: () => void;

    const command = new Command(async () => {
      await new Promise<void>(resolve => { finish = resolve; });
      throw failure;
    }, error => errors.push(error));

    const unsubscribe = command.subscribeExecutionState(state => executionStates.push(state));
    const execution = command.execute(
      new CommandActionEvent('command-action', 'save', {}, new Event('click'), [])
    );

    expect(command.isExecuting).toBe(true);
    finish();
    await execution;
    expect(errors).toEqual([failure]);
    expect(command.isExecuting).toBe(false);
    expect(executionStates).toEqual([true, false]);
    unsubscribe();

  });

  it('allows independent overlapping invocations', async () => {

    const seen: string[] = [];
    const command = new Command(async invocation => {
      const arg = invocation.commandData.args[0];
      await Promise.resolve();
      seen.push(arg);
    });

    const first = command.execute(
      new CommandActionEvent('command-action', 'save', {}, new Event('click'), ['first'])
    );

    const second = command.execute(
      new CommandActionEvent('command-action', 'save', {}, new Event('click'), ['second'])
    );

    await Promise.all([first, second]);
    expect(seen).toEqual(['first', 'second']);
    expect(command.isExecuting).toBe(false);

  });
  
});
