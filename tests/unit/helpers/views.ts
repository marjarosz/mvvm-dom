import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import type { IBindingContext } from '@mvvm/viewModel';
import { cleanup, own } from './resources';

/** Builds a detached <template>; the caller (usually View) consumes its content. */
export function template(html: string): HTMLTemplateElement {

  const result = document.createElement('template');
  result.innerHTML = html;
  return result;

}

/**
 * Mounts a view into a body-attached host and schedules full teardown
 * (detach + dispose + host removal) in afterEach. The model is NOT disposed
 * here - the caller owns it (see ownsDataContext = false below).
 */
export function mounted(html: string, model: IBindingContext): { view: View; host: HTMLElement } {

  const host = document.createElement('section');
  document.body.append(host);
  const view = new View(template(html), model);
  // The caller owns the model; this also makes sharing explicit.
  view.ownsDataContext = false;
  cleanup(() => { view.detach(); view.dispose(); host.remove(); });
  host.append(...view.viewNodeList);
  return { view, host };

}

/**
 * Single <input> bound to a `label` property - the standard list item used by
 * renderer/integration tests. `node` is the input itself, so tests can assert
 * on DOM without querying; drive it through `model.setPropertyValueAndNotify`.
 */
export function item(label: string): { view: View; model: ViewModel; node: HTMLInputElement } {

  const model = own(new ViewModel());
  model.registerProperty('label', label);
  const view = new View(template('<input data-bind="{value: label}">'), model);
  view.ownsDataContext = false;
  cleanup(() => { view.detach(); view.dispose(); });
  return { view, model, node: view.viewNodeList[0] as HTMLInputElement };
  
}
