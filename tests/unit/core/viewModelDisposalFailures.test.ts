import { describe, expect, it } from 'vitest';
import { ViewModel, ViewModelDisposalError } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import { View } from '@mvvm/view';

function capture(action: () => void): unknown {

  try { action(); } catch (error) { return error; }
  return undefined;

}

function modelWithResources(): ViewModel {

  const model = new ViewModel();
  model.registerProperty('name', 'value');
  model.registerPropertyValidator('name', [{ isValid: () => false }]);
  model.setPropertyValidationState('name', false, 'invalid');
  model.registerCommand('save', new Command(() => {}));
  model.registerCommand('cancel', new Command(() => {}));
  return model;

}

describe('ViewModel disposal despite notification failures', () => {

  for (const failingIndex of [0, 1]) {

    it(`cleans before notification and continues after subscriber ${failingIndex} throws`, () => {

      const model = modelWithResources();
      const calls: string[] = [], failures = [new Error('first'), new Error('second')];
      let failureIndex = 0;

      for (let index = 0; index < 3; index++) model.subscribeCommands(name => {

        calls.push(`${index}:${name}`);
        expect(model.hasRegisteredProperty('name')).toBe(false);
        expect(model.hasPropertyValidator('name')).toBe(false);
        expect(model.hasPropertyBeenValidated('name')).toBe(false);
        expect(model.getCommand(name)).toBe(undefined);
        model.dispose(); // Reentrancy must not recurse or notify twice.
        if (index === failingIndex) throw failures[failureIndex++];

      });

      const error = capture(() => model.dispose());
      expect(model.hasPropertyValidator('name')).toBe(false);
      expect(calls).toEqual(['0:save', '1:save', '2:save', '0:cancel', '1:cancel', '2:cancel']);
      expect(error instanceof ViewModelDisposalError).toBe(true);
      expect((error as ViewModelDisposalError).errors).toEqual(failures);
      expect(capture(() => model.dispose())).toBe(undefined);
      model.unregisterCommand('save');
      expect(calls.length).toBe(6);

    });
  }

  it('drops property and validation subscriptions even when notification throws a non-Error', () => {

    const model = modelWithResources(); let events = 0;
    model.subscribeProperties(() => events++);
    model.subscribeValidationState(() => events++);
    model.subscribeValidationReset(() => events++);
    model.subscribeCommands(() => { throw undefined; });

    const error = capture(() => model.dispose()) as ViewModelDisposalError;
    model.notifyPropertyChanged('name', 'later');
    model.notifyValidationStateChanged('name', true);
    model.resetPropertyValidationState('name');

    expect(events).toBe(0);
    expect(error.errors).toEqual([undefined, undefined]);

  });

  it('disconnects command execution in a shared view despite another failing subscriber', () => {

    const model = new ViewModel(); let executions = 0;
    model.registerCommand('save', new Command(() => executions++));
    model.subscribeCommands(() => { throw new Error('subscriber'); });

    const template = document.createElement('template');
    template.innerHTML = '<button data-command="{click: save}">Save</button>';
    const view = new View(template, model, undefined, { ownsDataContext: false });
    const button = view.viewNodeList[0] as HTMLButtonElement;
    try {

      button.click(); expect(executions).toBe(1);
      const error = capture(() => model.dispose());
      expect(button.disabled).toBe(true);
      expect(error instanceof ViewModelDisposalError).toBe(true);
      button.dispatchEvent(new Event('click')); expect(executions).toBe(1);
      view.dispose(); model.dispose();

    } finally { 
      view.dispose(); 
      model.dispose(); 
    }

  });

  it('does not dispose a shared model when its view is disposed', () => {

    const model = modelWithResources();
    const template = document.createElement('template'); template.innerHTML = '<span data-bind="{text: name}"></span>';
    const view = new View(template, model, undefined, { ownsDataContext: false });

    view.dispose();
    expect(model.hasRegisteredProperty('name')).toBe(true);
    expect(model.hasPropertyValidator('name')).toBe(true);
    model.dispose();

  });
  
});
