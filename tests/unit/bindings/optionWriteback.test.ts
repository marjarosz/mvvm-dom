import { describe, expect, it } from 'vitest';
import Options from '@mvvm/bindings/optionsBinding';
import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { PropertyChangeEvent } from '@mvvm/propertyChangeEvent';

describe('option DOM writeback', () => {

  it('writes all static single-select options to the model without first rendering model data', () => {

    const model = new ViewModel();
    const original = [{ value: 'old', label: 'Old', isSelected: true }];
    model.registerProperty('options', original);
    const template = document.createElement('template');
    template.innerHTML = '<select data-bind="{options: options, mode: oneWayToSource}"><option value="a">A</option><option value="b">B</option></select>';
    const view = new View(template, model);

    try {

      const select = view.viewNodeList[0] as HTMLSelectElement;
      expect(select.options.length).toBe(2);
      expect(model.getPropertyValue('options')).toBe(original);
      let writes = 0;
      model.subscribeProperties(() => writes++);
      select.value = 'b';
      select.dispatchEvent(new Event('change'));

      expect(model.getPropertyValue('options')).toEqual([
        { value: 'a', label: 'A', isSelected: false },
        { value: 'b', label: 'B', isSelected: true },
      ]);
      
      expect(writes).toBe(1);
      expect(original).toEqual([{ value: 'old', label: 'Old', isSelected: true }]);

    } finally { 
      view.dispose(); model.dispose(); 
    }

  });

  for (const multiple of [false, true]) {

    it(`reads duplicates, empty values and current DOM order (multiple=${multiple})`, () => {

      const select = document.createElement('select');
      select.multiple = multiple;
      select.innerHTML = '<optgroup label="Group"><option value="">Empty</option><option value="b">First B</option><option value="b">Second B</option></optgroup>';
      const binding = new Options(select, 'options', ['mode: oneWayToSource']);
      const snapshots: unknown[] = [];
      binding.subscribe(event => snapshots.push((event as PropertyChangeEvent).value));

      try {
        select.selectedIndex = 2;
        select.dispatchEvent(new Event('change'));

        expect(snapshots[0]).toEqual([
          { value: '', label: 'Empty', isSelected: false },
          { value: 'b', label: 'First B', isSelected: false },
          { value: 'b', label: 'Second B', isSelected: true },
        ]);

        select.selectedIndex = 0;
        select.dispatchEvent(new Event('change'));

        expect(snapshots[1]).toEqual([
          { value: '', label: 'Empty', isSelected: true },
          { value: 'b', label: 'First B', isSelected: false },
          { value: 'b', label: 'Second B', isSelected: false },
        ]);

        select.innerHTML = '<option value="new">New label</option>';
        select.selectedIndex = 0;
        select.dispatchEvent(new Event('change'));

        expect(snapshots[2]).toEqual([{ value: 'new', label: 'New label', isSelected: true }]);
        // Later snapshots must not mutate earlier emitted records.
        expect((snapshots[0] as { isSelected: boolean }[])[2].isSelected).toBe(true);

      } finally { 
        binding.dispose(); 
      }

    });
  }

  it('distinguishes no selection from an empty list', () => {

    const select = document.createElement('select');
    select.innerHTML = '<option value="a">A</option>';
    const binding = new Options(select, 'options', ['mode: oneWayToSource']);
    const snapshots: unknown[] = [];
    binding.subscribe(event => snapshots.push((event as PropertyChangeEvent).value));

    try {
      select.selectedIndex = -1;
      select.dispatchEvent(new Event('change'));
      expect(snapshots[0]).toEqual([{ value: 'a', label: 'A', isSelected: false }]);
      select.replaceChildren();
      select.dispatchEvent(new Event('change'));
      expect(snapshots[1]).toEqual([]);
    } finally { 
      binding.dispose(); 
    }

  });

  it('reads edited DOM in both mode without mutating the supplied records', () => {
   
    const select = document.createElement('select');
    const binding = new Options(select, 'options', ['mode: twoWay']);
    
    const data = Object.freeze([
      Object.freeze({ value: 'a', label: 'A', isSelected: true }),
      Object.freeze({ value: 'b', label: 'B', isSelected: false }),
    ]);

    const snapshots: unknown[] = [];
    binding.subscribe(event => snapshots.push((event as PropertyChangeEvent).value));

    try {

      binding.setValue(data);
      select.options[1].value = 'changed';
      select.options[1].textContent = 'Changed label';
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change'));

      expect(snapshots[0]).toEqual([
        { value: 'a', label: 'A', isSelected: false },
        { value: 'changed', label: 'Changed label', isSelected: true },
      ]);

      expect(data).toEqual([
        { value: 'a', label: 'A', isSelected: true },
        { value: 'b', label: 'B', isSelected: false },
      ]);

    } finally { 
      binding.dispose(); 
    }

  });

  it('never publishes in oneWay mode and stops publishing after disposal', () => {

    const select = document.createElement('select');
    const outbound = new Options(select, 'options', ['mode: oneWay']);
    let writes = 0;

    outbound.subscribe(() => writes++);
    outbound.setValue([{ value: 'a', label: 'A', isSelected: true }]);
    select.dispatchEvent(new Event('change'));
    expect(writes).toBe(0);
    outbound.dispose();
    const inbound = new Options(select, 'options', ['mode: oneWayToSource']);
    inbound.subscribe(() => writes++);
    select.dispatchEvent(new Event('change'));
    expect(writes).toBe(1);
    inbound.dispose();
    select.dispatchEvent(new Event('change'));
    expect(writes).toBe(1);

  });
  
});
