import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import Width from '@mvvm/bindings/widthBinding';
import { CollectionObserver } from '@mvvm/collectionObserver';
import { ViewFactory } from '@mvvm/viewFactory';

const host = document.querySelector<HTMLElement>('#fixture')!;

const disposables: Array<() => void> = [];

const state = { widths: [] as number[], commands: 0, dropped: [] as string[], keys: [] as string[][] };

let model: ViewModel;

let collection: CollectionObserver<{ name: string }>;

function mount(html: string, values: Record<string, unknown>): void {

  const template = document.createElement('template'); template.innerHTML = html;
 
  model = new ViewModel(); model.registerProperties(values);
  model.registerCommand('submit', new Command(() => { state.commands++; }));
  
  model.registerCommand('drop', new Command(invocation => {
    state.dropped = Array.from((invocation.commandData.sourceEvent as DragEvent).dataTransfer!.files).map(file => file.name);
  }));

  const view = new View(template, model);
  disposables.push(() => { view.detach(); view.dispose(); });
  host.append(...view.viewNodeList);

}

const harness = {

  state,
  emptyDisplay(value: boolean | string | null | undefined) {
    mount('<style>.empty-display { display: grid; }</style>' +
      '<div id="empty-display" class="empty-display" style="display: flex; color: red" data-bind="{style: opacity, styleName: opacity}, {display: shown}">Panel</div>',
      { shown: value, opacity: 0.35 });
  },
  setDisplay(value: boolean | string | null | undefined) {
    model.setPropertyValueAndNotify('shown', value);
  },
  emptyStyle(value: string | null | undefined) {
    mount('<style>.empty-style { color: rgb(0, 128, 0); display: grid; }</style>' +
      '<div id="named-style" class="empty-style" style="color: red; opacity: 0.35" data-bind="{style: color, styleName: color}, {display: shown}">Named</div>' +
      '<div id="whole-style" class="empty-style" style="color: red; opacity: 0.35" data-bind="{style: whole}">Whole</div>',
      { color: value, whole: value, shown: null });
  },
  setStyle(value: string | null | undefined) {
    model.setPropertyValueAndNotify('color', value);
    model.setPropertyValueAndNotify('whole', value == null || value === '' ? value : 'color: ' + value);
  },
  factoryView() {

    const source = document.createElement('template');
    source.id = 'browser-factory-template';
    source.innerHTML = '<strong data-bind="{text: title}"></strong>';
    host.append(source);
    model = new ViewModel();
    model.registerProperty('title', 'Factory');
    const view = new ViewFactory().getViewById(source.id, model);
    host.append(...view.viewNodeList);
    disposables.push(() => { view.dispose(); source.remove(); });

  },
  focus() {

    mount('<label data-bind="{interpolate: title}"><input id="editor" value="abcdef">{{title}}</label>', { title: 'Before' });
  
  },
  setTitle() { 

    model.setPropertyValueAndNotify('title', 'After'); 
  },
  collection() {

    collection = new CollectionObserver({ name: 'A' }, { name: 'B' });
    mount('<ul><li data-bind="{collection: items}"><input value="abcdef"><span>{{object.name}}</span></li></ul>', { items: collection });
  
  },
  updateCollection() { 
    collection[1].name = 'Updated'; 
  },
  reverseCollection() { 
    collection.reverse(); 
  },
  commandAvailability() {

    collection = new CollectionObserver({ name: 'A' }, { name: 'B' });
    mount('<button data-bind="{collection: items}" data-command="{click: select, parameter: object.name}">{{object.name}}</button>', { items: collection });
   
    model.registerCommand('select', new Command(() => { state.commands++; }, undefined, {
      canExecute: parameter => parameter === 'B'
    }));
  },
  updateCommandRow() {
     collection[0].name = 'B'; 
  },
  resize() {

    const node = document.createElement('div'); node.id = 'measured'; node.style.cssText = 'width: 100px; height: 20px'; host.append(node);
    const binding = new Width(node, 'width', ['mode: twoWay']);
    binding.subscribe(event => state.widths.push((event as Event & { value: number }).value));
    disposables.push(() => binding.dispose());

  },
  scroll() {

    mount('<div id="scroll" style="height: 60px; overflow: auto" data-bind="{scrollTop: position, mode: twoWay}"><div style="height: 600px">Content</div></div>', { position: 0 });
  },
  position() { 
    return model.getPropertyValue('position');
   },
  multipleSelect() {

    mount('<select id="multiple-values" multiple data-bind="{options: options}, {selectedValues: selected, mode: twoWay}"></select>' +
      '<select id="multiple-options" multiple data-bind="{options: records, mode: twoWay}"></select>', {
      options: [
        { value: 'a', label: 'A', isSelected: false },
        { value: 'b', label: 'B', isSelected: false },
        { value: 'c', label: 'C', isSelected: false }
      ],
      selected: ['a', 'c'],
      records: [
        { value: 'a', label: 'A', isSelected: true },
        { value: 'b', label: 'B', isSelected: false },
        { value: 'c', label: 'C', isSelected: true }
      ]
    });

  },
  multipleState() {

    return { selected: model.getPropertyValue('selected'), records: model.getPropertyValue('records') };

  },
  replaceMultipleOptions() {
    
    model.setPropertyValueAndNotify('options', [
      { value: 'b', label: 'B', isSelected: false },
      { value: 'c', label: 'C', isSelected: false }
    ]);

  },
  submit() { 
    mount('<form action="/unexpected" data-command="{submit: submit}"><input id="field"><button type="submit">Save</button></form>', {}); 
  },
  keyboard() {

    mount('<form action="/unexpected"><input id="keyboard" data-command="{key: save, keys: Ctrl+S | Enter}"><button>Submit</button></form>', {});
    model.registerCommand('save', new Command(invocation => { state.keys.push([...invocation.commandData.args]); }));
  },
  drop() { 
    mount('<div id="drop" data-command="{dragover: drop}{drop: drop}">Drop</div>', {}); 
  },
  dispose() {
     for (const dispose of disposables.splice(0).reverse()) dispose(); 
  },
};

declare global { interface Window { mvvmHarness: typeof harness; } }
window.mvvmHarness = harness;
