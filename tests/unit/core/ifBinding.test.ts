import { expect, it, vi } from 'vitest';
import IfBinding from '@mvvm/bindings/ifBinding';

it('maps raw boolean values to fragment operations without a View or DOM', () => {

  const fragment = { nodes: [], mount: vi.fn(), unmount: vi.fn() };
  const binding = new IfBinding(fragment, 'visible', []);
  binding.setValue(true);
  for (const value of [false, null, undefined]) binding.setValue(value);
  expect(() => binding.setValue('false')).toThrow(/visible/);
  expect(fragment.mount).toHaveBeenCalledTimes(1);
  expect(fragment.unmount).toHaveBeenCalledTimes(3);
  
});
