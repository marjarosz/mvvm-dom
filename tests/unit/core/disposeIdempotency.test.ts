import { describe, it, expect, vi } from 'vitest';
import { ViewModel } from '@mvvm/viewModel';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { View, type IView } from '@mvvm/view';
import { propertyChange } from '@mvvm/propertyDecorators';
import { template } from '../helpers/views';
import { own, cleanup } from '../helpers/resources';

function makeView(): IView {

  const view = new View(template('<div></div>'));
  cleanup(() => view.dispose());
  return view;

}

class TableLikeModel extends ViewModel {

  @propertyChange()
  accessor itemsView = new ArrayObserver<IView>();

  private _disposed = false;

  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;

    const views = this.itemsView;

    if (views) {
      for (const view of views) {
        view.dispose();
      }
      views.clear();
    }
    super.dispose();
  }
}

describe('ViewModel dispose idempotency', () => {

  it('exposes the disposed state through IView', () => {
    const view = makeView();
    expect(view.isDisposed).toBe(false);

    view.dispose();
    expect(view.isDisposed).toBe(true);

  });

  it('second dispose does not throw when @propertyChange property is undefined', () => {

    const model = new TableLikeModel();
    const view = makeView();
    model.itemsView.push(view);

    model.dispose();
    expect(model.itemsView).toBeUndefined();

    expect(() => model.dispose()).not.toThrow();
  });

  it('double dispose is a no-op: no double dispose of child view, no observer error', () => {

    const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const model = new TableLikeModel();
    const child = own(new View(template('<div></div>')));
    const disposeSpy = vi.spyOn(child, 'dispose');
    model.itemsView.push(child);

    model.dispose();
    model.dispose();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('view whose dataContext is disposed by external owner survives parent dispose', () => {

    const model = new TableLikeModel();
    const childModel = new ViewModel();
    const view = own(new View(template('<div></div>'), childModel));
    model.itemsView.push(view);

    model.dispose();
    childModel.dispose();
    expect(() => model.dispose()).not.toThrow();

  });
  
});
