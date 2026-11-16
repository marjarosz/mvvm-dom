import { describe, expect, it, vi } from 'vitest';
import Interpolate from '@mvvm/bindings/interpolationBinding';
import { own } from '../helpers/resources';

describe('interpolate - reactive text without reconstructing children', () => {

  it('ignores attributes and script, style and template content', () => {

    const host = document.createElement('div');
    host.innerHTML = '<span title="{{title}}">{{title}}</span><script type="application/json">"{{title}}"</script><style>/* {{title}} */</style><template>{{title}}</template>';
    own(new Interpolate(host, 'title', [])).setValue('visible');
    expect(host.querySelector('span')!.textContent).toBe('visible');
    expect(host.querySelector('span')!.getAttribute('title')).toBe('{{title}}');
    expect(host.querySelector('script')!.textContent).toBe('"{{title}}"');
    expect(host.querySelector('style')!.textContent).toBe('/* {{title}} */');
    expect(host.querySelector('template')!.content.textContent).toBe('{{title}}');

  });

  it('updates every occurrence on every assignment', () => {

    const host = document.createElement('label');
    host.innerHTML = '{{title}} / {{title}}';
    const binding = own(new Interpolate(host, 'title', []));
    binding.setValue('A');
    expect(host.textContent).toBe('A / A');
    binding.setValue('B');
    expect(host.textContent).toBe('B / B');

  });

  it('inserts markup as literal text, not executable or styled HTML', () => {

    const host = document.createElement('span');
    host.textContent = '{{title}}';

    const binding = own(new Interpolate(host, 'title', []));
    binding.setValue('<b data-injected>untrusted</b>');
    expect(host.querySelector('[data-injected]')).toBeNull();
    expect(host.textContent).toBe('<b data-injected>untrusted</b>');

  });

  it('preserves existing child node identity, value and event handlers', () => {

    const host = document.createElement('label');
    host.innerHTML = '<input>{{title}}';
    const input = host.querySelector('input')!;
    input.value = 'user input';
    const clicked = vi.fn();
    input.addEventListener('click', clicked);
    const binding = own(new Interpolate(host, 'title', []));
    binding.setValue('Title');
    binding.setValue('Another');
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('user input');
    host.querySelector('input')!.click();
    expect(clicked).toHaveBeenCalledTimes(1);

  });

  it('updates independently bound tokens without overwriting another binding', () => {

    const host = document.createElement('span');
    host.textContent = '{{first}} / {{second}}';
    const first = own(new Interpolate(host, 'first', []));
    const second = own(new Interpolate(host, 'second', []));
    first.setValue('A'); second.setValue('B'); first.setValue('C');
    expect(host.textContent).toBe('C / B');

  });

  it('renders null as empty text', () => {

    const host = document.createElement('span');
    host.textContent = '[{{title}}]';
    own(new Interpolate(host, 'title', [])).setValue(null);
    expect(host.textContent).toBe('[]');

  });
  
});
