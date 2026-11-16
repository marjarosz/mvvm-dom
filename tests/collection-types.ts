import { ArrayObserver, CollectionObserver } from '../src/index.js';

// Compile-only regressions, checked by npm run types.
function checkCollectionTypes(collection: ArrayObserver<string>): void {

  const value: string = collection[0];

  collection[0] = value;
  // @ts-expect-error Numeric index writes must preserve the element type.
  collection[0] = 123;
  // @ts-expect-error Indexed reads must not become any.
  const number: number = collection[0];

  collection.forEach(item => {
    item.toUpperCase();
    // @ts-expect-error Array callbacks must receive strings.
    item.doesNotExist();
  });
  
  const mapped: string[] = collection.map(item => item.toUpperCase());
  void number;
  void mapped;
}

checkCollectionTypes(new ArrayObserver<string>());
checkCollectionTypes(new CollectionObserver<string>());
