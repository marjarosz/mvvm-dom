import { expect, it, vi } from 'vitest';
import { BindingFragment } from '@mvvm/bindingFragment';

it.each(['dispose', 'unmount', 'setChildren'] as const)('releases every child despite cleanup failures through %s', operation => {
 
  const anchor = document.createComment('fragment');
 
  const host = document.createElement('div');
  host.append(anchor);
  
  const fragment = new BindingFragment(anchor, () => { throw new Error('unused'); }, undefined);
  const firstError = new Error('first cleanup failed');
  
  const children = [firstError, new Error('second cleanup failed'), undefined].map(error => {

    const node = document.createElement('span');
    return {
      viewNodeList: [node],
      dispose: vi.fn(() => { node.remove(); if (error) throw error; })
    };

  });

  fragment.setChildren(children);
  const release = () => operation === 'setChildren' ? fragment.setChildren([]) : fragment[operation]();
  expect(release).toThrow(firstError);
  expect(fragment.nodes).toHaveLength(0);
  expect(() => fragment.dispose()).not.toThrow();
  expect(host.childNodes).toHaveLength(0);
  expect(fragment.nodes).toHaveLength(0);
  expect(() => fragment.dispose()).not.toThrow();

  for (const child of children) expect(child.dispose).toHaveBeenCalledTimes(1);
  
});
