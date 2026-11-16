import { CollectionObserver, ViewModel } from '../dist/index.js';
import assert from 'node:assert/strict';

class Child extends ViewModel {
  constructor() { super(); this.registerProperty('name', 'before'); }
  get name() { return this.getPropertyValue('name'); }
  rename(value) { this.setPropertyValueAndNotify('name', value); }
}
const child = new Child();
const items = new CollectionObserver({ child });
let changes = 0;
const callback = () => changes++;
items.subscribeItemChanges(callback);
const cached = items[0].child;
cached.rename('first');
console.log('Initial nested ViewModel notification:', changes);
assert.equal(changes, 1);
items.unsubscribeItemChanges(callback);
items.subscribeItemChanges(callback);
cached.rename('second');
console.log('After unsubscribe/resubscribe, expected 2:', changes);
assert.equal(changes, 2);
items[0].child.rename('third');
console.log('Fresh nested lookup resumes notifications, expected 3:', changes);
assert.equal(changes, 3);
items.unsubscribeItemChanges(callback);
child.dispose();
