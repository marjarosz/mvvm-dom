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

  it('continues releasing other resources when one teardown throws', () => {

    const owner = new CompositeDisposable();
    const release = vi.fn();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    owner.add(release);
    owner.add(() => { throw new Error('release failed'); });
    expect(() => owner.dispose()).not.toThrow();
    expect(release).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalled();

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
