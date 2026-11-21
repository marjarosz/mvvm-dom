import { describe, expect, it, vi } from 'vitest';
import { CompositeDisposable } from '@mvvm/compositeDisposable';

describe('CompositeDisposable - resource ownership', () => {

  it('releases resources in reverse order exactly once', () => {

    const calls: string[] = [];
    const owner = new CompositeDisposable();

    owner.add(() => calls.push('first'));
    owner.add(() => calls.push('second'));
    owner.dispose();
    owner.dispose();
    expect(calls).toEqual(['second', 'first']);

  });

  it('releases a resource acquired after the owner ended its life', () => {

    const owner = new CompositeDisposable();
    const release = vi.fn();
    owner.dispose();
    owner.add(release);
    expect(release).toHaveBeenCalledTimes(1);

  });

  it.each([new Error('release failed'), undefined, 'failure'])('preserves the thrown value %s and continues cleanup exactly once', failure => {

    const owner = new CompositeDisposable();
    const release = vi.fn();
    const calls: string[] = [];
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    owner.add(() => { calls.push('first'); release(); });
    owner.add(() => { calls.push('second'); throw failure; });
    owner.add(() => { calls.push('third'); });
    expect(() => owner.dispose()).not.toThrow();
    expect(() => owner.dispose()).not.toThrow();
    expect(calls).toEqual(['third', 'second', 'first']);
    expect(release).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledExactlyOnceWith('Error during teardown in CompositeDisposable', failure);
    expect(warning.mock.calls[0][1]).toBe(failure);

  });

  it('owns disposables through the same lifetime boundary', () => {

    const owner = new CompositeDisposable();
    const child = { dispose: vi.fn() };
    owner.addDisposable(child);
    expect(child.dispose).not.toHaveBeenCalled();
    owner.dispose();
    owner.dispose();
    expect(child.dispose).toHaveBeenCalledTimes(1);

  });
  
});
