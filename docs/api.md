# mvvm-dom - referencja API

Polska referencja publicznej interfejsu pakietu `mvvm-dom` - czyli wszystkiego,
co można zaimportować z głównego eksportu pakietu. Kolejność sekcji odpowiada
kolejności eksportów w `src/index.ts`.

Podpisy typów, właściwości i metod odpowiadają w pełni deklaracjom TypeScript
pakietu. Niniejszy dokument celowo nie zawiera przykładów kodu - przykłady
użycia znajdują się w [podręczniku użytkownika](guide.md).

## Terminologia

| Termin | Znaczenie w tym dokumencie |
|---|---|
| **binding** | reaktywne połączenie właściwości ViewModel z elementem DOM (`Binding` i jego specjalizacje); w podręczniku potocznie „bind" |
| **komenda** | nazwana akcja ViewModel wywoływana ze zdarzenia DOM (`Command`, `EventCommandBinding`) |
| **konwerter** | transformacja wartości między ViewModel a View (`IValueConverter` i wbudowane konwertery) |
| **walidacja** | reguły poprawności danych i prezentacja ich błędów (`ViewModelValidator`, `ValidationErrorBinding`) |
| **fabryka** | klasa tworząca instancje (`BindingFactory`, `ViewFactory`, `ViewModelFactoryBase`) |
| **subskrybent** | odbiorca zdarzeń rejestrowany przez metody `subscribe*`; zwrot z rejestracji anuluje subskrypcję |
| **szablon / template** | element `<template>` stanowiący strukturę widoku |
| **widok** | instancja `View` utworzona ze szablonu |
| **kolekcja** | `CollectionObserver` (kolekcja obiektów) oraz `ArrayObserver` (reaktywna tablica) |
| **zdarzenie** | obiekt `Event` emitowany przez bibliotekę, np. `PropertyChangeEvent`, `CommandActionEvent`, `ValidationStateEvent` |
| **właściwość** | zarejestrowana i obserwowalna wartość w ViewModel (`registerProperty`) |

## Spis sekcji

Sekcje odpowiadają kolejności eksportów w `src/index.ts`:

1. [arrayObserver](#arrayobserver)
2. [binding](#binding)
3. [bindingFactory](#bindingfactory)
4. [bindingFragment](#bindingfragment)
5. [bindingMode](#bindingmode)
6. [collectionObserver](#collectionobserver)
7. [command](#command)
8. [commandActionEvent](#commandactionevent)
9. [commandActionEventTarget](#commandactioneventtarget)
10. [commandBindingFactory](#commandbindingfactory)
11. [commandDecorators](#commanddecorators)
12. [compositeDisposable](#compositedisposable)
13. [disposable](#disposable)
14. [eventCommandBinding](#eventcommandbinding)
15. [propertyChangeEvent](#propertychangeevent)
16. [propertyChangeEventTarget](#propertychangeeventtarget)
17. [propertyDecorators](#propertydecorators)
18. [validationErrorBinding](#validationerrorbinding)
19. [validationErrorBindingFactory](#validationerrorbindingfactory)
20. [validationStateEvent](#validationstateevent)
21. [validationStateEventTarget](#validationstateeventtarget)
22. [valueConverter](#valueconverter)
23. [view](#view)
24. [viewFactory](#viewfactory)
25. [viewListController](#viewlistcontroller)
26. [viewModel](#viewmodel)
27. [viewModelFactoryBase](#viewmodelfactorybase)
28. [viewModelValidator](#viewmodelvalidator)
29. [optionsBinding](#optionsbinding)

## arrayObserver

Zawartość publiczna modułu: typ `CollectionChange<T>`, klasa `ArrayObserver<T>`.

### `CollectionChange<T>`

Pojedyncza logiczna zmiana kolekcji. Typ unii z dwoma wariantami:

```ts
type CollectionChange<T> =
    | {
        readonly type: 'splice';
        readonly index: number;
        readonly removed: readonly T[];
        readonly added: readonly T[];
      }
    | {
        readonly type: 'reset';
        readonly previous: readonly T[];
        readonly current: readonly T[];
      };
```

- wariant `splice` opisuje zmianę w miejscu: indeks, usunięte i dodane elementy;
- wariant `reset` opisuje całkowitą wymianę zawartości: poprzedni i obecny stan.

### `ArrayObserver<T>`

Podklasa `Array`, która powiadamia subskrybentów o modyfikacjach
(`push` / `unshift` / `pop` / `shift` / `splice` / `clear` / `sort` /
`reverse` / `fill` / `copyWithin` / `deleteItem`, a także zapisach indeksów
i `length`). Subskrybenci otrzymują po jednym opisie zmiany opartym o indeksy
na każdą logiczną modyfikację.

Nieudane wywołania zwrotne subskrybentów są izolowane; rekurencyjne zmiany
są kolejkowane, dopóki każdy subskrybent nie otrzyma bieżącego opisu zmiany.

- **`constructor(...items: T[])`**
  Elementy początkowe albo pojedyncza liczba traktowana jako początkowa
  długość (jak w `Array`).
- **`subscribeChanges(callback: (change: CollectionChange<T>) => void): void`**
  Rejestruje subskrybenta zmian. Wywoływany dla każdej logicznej modyfikacji
  z opisem zmiany - zawsze kopią, nigdy nie modyfikowaną przez późniejsze
  zmiany.
- **`unsubscribeChanges(callback: (change: CollectionChange<T>) => void): void`**
  Usuwa wcześniej zarejestrowanego subskrybenta.
- **`push(...items: T[]): number`**
  Dodaje elementy na końcu i powiadamia jednym opisem `splice`.
- **`unshift(...items: T[]): number`**
  Dodaje elementy na początku i powiadamia jednym opisem `splice`.
- **`pop(): T | undefined`**
  Usuwa ostatni element i powiadamia opisem `splice`.
- **`shift(): T | undefined`**
  Usuwa pierwszy element i powiadamia opisem `splice`.
- **`splice(): T[]`** / **`splice(start: number): T[]`** /
  **`splice(start: number, deleteCount: number | undefined, ...items: T[]): T[]`**
  Semantyka native `Array.splice`; powiadamia jednym opisem `splice`, gdy
  modyfikacja jest niepusta.
- **`insertAfter(index: number, ...item: T[]): void`**
  Wstawia elementy po podanym indeksie (`index` = -1 oznacza początek).
  Umowa: `index` musi być liczbą całkowitą z zakresu -1 .. length - 1,
  inaczej rzucany jest `RangeError` (bez cichego ograniczania wartości).
  Pusta lista elementów to no-op (bez wyjątku).
- **`clear(): T[]`**
  Usuwa wszystkie elementy, powiadamia jednym opisem `splice` i zwraca
  usunięte elementy.
- **`deleteItem(item: T): number`**
  Usuwa pierwszy element równy `item` (porównanie jak w
  `Array.prototype.indexOf`) i powiadamia opisem `splice`. Zwraca indeks
  usuniętego elementu albo -1, gdy nie znaleziono.
- **`sort(compareFn?: (a: T, b: T) => number): this`**
  Sortuje w miejscu i powiadamia jednym opisem `reset`, gdy zmieniła się
  kolejność.
- **`reverse(): this`**
  Odwraca w miejscu i powiadamia jednym opisem `reset`.
- **`fill(value: T, start?: number, end?: number): this`**
  Wypełnia zakres wartością i powiadamia jednym opisem `reset`.
- **`copyWithin(target: number, start: number, end?: number): this`**
  Kopiuje zakres w miejscu i powiadamia jednym opisem `reset`.

Indeksy są konwertowane do liczb całkowitych wg reguł ECMAScript ToInteger
(NaN → 0, ±Infinity bez zmiany, inne wartości → `Math.trunc`) i normalizowane
do zakresu [0, length] (ujemne indeksy liczone od końca).

## binding

Zawartość publiczna modułu: interfejs `IBinding`, abstrakcyjna klasa `Binding`.

### `IBinding`

Połączenie między właściwością elementu widoku a właściwością kontekstu danych.

Implementacje tworzy `BindingFactory` (albo rejestracja własnego bindingu)
i właścicielem bindingów jest `View`.

- **`mode: BindingMode`** (readonly)
  Kierunek bindingu rozwiązany z argumentu `mode` (domyślnie OneWay).
- **`beginInitialization?(): void`**
  Opcjonalny cykl życia wokół wartości początkowych i subskrypcji wszystkich
  bindingów w widoku.
- **`endInitialization?(): void`**
  Opcjonalny cykl życia (faza kończąca inicjalizację).
- **`setValue(value: unknown): void`**
  Ustawia wiązaną wartość na elemencie widoku; `value` jest wartością już
  skonwertowaną dla widoku.
- **`subscribe(propertyChangeEvent: (event: Event) => void): void`**
  Rejestruje nasłuch zdarzeń `property-change` bindingu; wywoływany dla
  każdej zmiany.
- **`unsubscribe(propertyChangeEvent: (event: Event) => void): void`**
  Usuwa wcześniej zarejestrowany nasłuch.
- **`dispose(): void`**
  Zwala binding wraz ze wszystkimi jego subskrypcjami. Idempotentne.

### `Binding`

Klasa bazowa wszystkich bindingów.

Analizuje argument `mode` oraz pozostałe argumenty `nazwa: wartość`
z deklaracji bindingu. Zmiany właściwości są rozsyłane jako zdarzenia
`property-change` (`PropertyChangeEvent`); to `View` ustawia wartość
początkową i łączy propagację zwrotną z kontekstem danych.

- **`constructor(element: HTMLElement, propertyName: string, argList: string[])`**
  `element` - element hosta, do którego binding jest przypięty;
  `propertyName` - właściwość kontekstu danych, którą się wiąże;
  `argList` - surowe argumenty `nazwa: wartość` deklaracji bindingu.
  @throws {SyntaxError} gdy argument używa nieobsługiwanej nazwy `bindWay`
  albo argument `mode` nie jest znanym `BindingMode`.
- **`element: HTMLElement`** (protected) - element hosta.
- **`propertyName: string`** (protected) - nazwa właściwości kontekstu danych.
- **`valueChangeCallback: (value: any) => void`**
  Opcjonalne wywołanie zwrotne wywoływane z wartością ustawioną na bindingu.
- **`args: { [argName: string]: string }`** (protected)
  Argumenty sparsowane z deklaracji bindingu.
- **`mode: BindingMode`** (readonly)
  Kierunek bindingu rozwiązany z argumentu `mode` (domyślnie OneWay).
- **`prepareValue(value: unknown): string`** (protected)
  Konwertuje wartość dla DOM: `null`/`undefined` staje się pustym ciągiem.
- **`dispatchEvent(value: unknown): void`** (protected)
  Emituje zdarzenie `property-change` niosące `value` dla `propertyName`.
- **`subscribe(propertyChangeEvent: (event: Event) => void): void`**
  Rejestruje nasłuch zdarzeń `property-change` bindingu.
  @throws {Error} gdy binding został już zwolniony.
- **`unsubscribe(propertyChangeEvent: (event: Event) => void): void`**
  Usuwa wcześniej zarejestrowany nasłuch.
- **`dispose(): void`**
  Usuwa wszystkie nasłuchy `property-change`. Idempotentne.

## bindingFactory

Zawartość publiczna modułu: klasa `BindingFactory` (wyłącznie metody statyczne).

Rejestr i fabryka wszystkich typów bindingów. Bindy właściwości (np. `text`,
`value`) tworzy `createBinding`; bindy strukturalne (np. `if`, `collection`)
pobiera `getStructuralBindingFactory`. Nowe typy można dodać przez
`registerBinding` i `registerStructuralBinding`.

- **`createBinding(type: string, element: HTMLElement, name: string, argList: string[]): IBinding`** (statyczna)
  Tworzy binding podanego typu. `type` - typ bindingu (np. `text`, `value`);
  `element` - element hosta; `name` - właściwość kontekstu danych do
  powiązania; `argList` - surowe argumenty `nazwa: wartość` deklaracji.
  @throws {Error} gdy `type` nie jest zarejestrowanym typem bindingu.
- **`registerBinding(name: string, bindElement: (element: HTMLElement, name: string, argList: string[]) => IBinding): void`** (statyczna)
  Rejestruje nowy typ binda właściwości. `bindElement` - fabryka wywoływana
  z elementem, nazwą właściwości i argumentami.
  @throws {Error} gdy nazwa jest już zarejestrowana.
- **`getStructuralBindingFactory(name: string): StructuralBindingFactory | undefined`** (statyczna)
  Zwraca fabrykę podanego typu binda strukturalnego. `name` - typ binda
  strukturalnego (np. `if`, `collection`). Zwraca fabrykę albo `undefined`,
  gdy typ nie jest strukturalny.
- **`registerStructuralBinding(name: string, create: StructuralBindingFactory): void`** (statyczna)
  Rejestruje nowy typ binda strukturalnego. `create` - fabryka wywoływana
  z fragmentem, właściwością i argumentami.
  @throws {Error} gdy nazwa jest już zarejestrowana.

## bindingFragment

Zawartość publiczna modułu: interfejsy `IBindingFragment`, `MountedFragment`,
`IStructuralBinding`, typ `StructuralBindingFactory`, klasa `BindingFragment`.

### `IBindingFragment`

Strukturalny placehorder w widoku: kotwica komentarza plus leniwie tworzona
potomność. Bindy strukturalne (`if`, `collection`) montują i demontują
fragmenty, aby dodawać lub usuwać widoki potomne.

- **`nodes: readonly ChildNode[]`** (readonly)
  Wszystkie obecnie zamontowane węzły potomne, w kolejności DOM.
- **`context?: IBindingContext`** (readonly)
  Kontekst danych używany do tworzenia potomnych.
- **`mount(): void`** - montuje fragment (tworzy potomnego, jeśli potrzeba).
- **`unmount(): void`** - demontuje fragment (zwala wszystkich potomnych).
- **`createChild?(context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void): MountedFragment`**
  Tworzy potomny fragment dla `context`, opcjonalnie najpierw przygotowując
  jego szablon.
- **`setChildren?(children: readonly MountedFragment[]): void`**
  Zamienia zamontowanych potomnych na `children`, zwalniając usuwane.

### `MountedFragment`

Utworzony potomny `BindingFragment`: jego węzły DOM oraz zwolnienie zasobów.

- **`viewNodeList: ChildNode[]`** (readonly)
  Węzły DOM potomnego, w kolejności.
- **`dispose(): void`** - odczepia węzły potomnego i zwalnia jego zasoby.

### `IStructuralBinding`

Strona bindingu deklaracji strukturalnej (np. `if: visible`).

- **`setValue(value: unknown): void`**
  Stosuje bieżącą wartość źródła do fragmentu (montowanie/demontowanie).
- **`dispose?(): void`** - zwalnia zasoby bindingu strukturalnego.

### `StructuralBindingFactory`

Typ tworzący `IStructuralBinding` dla sparsowanej deklaracji strukturalnej:

```ts
type StructuralBindingFactory =
    (fragment: IBindingFragment, property: string, args: string[]) => IStructuralBinding;
```

### `BindingFragment`

Domyślna implementacja `IBindingFragment`.

Owinia kotwicę komentarza: podczas montowania trzyma dokładnie jeden fragment
potomny (widok wyrenderowany dla `context`); demontowanie go zwalnia.
`setChildren` poprawia DOM inkrementalnie i zachowuje fokus oraz zaznaczenie
tekstu dla węzłów, które przetrwały.

- **`constructor(anchor: Comment, create: (context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void) => MountedFragment, context: IBindingContext | undefined)`**
  `anchor` - węzeł komentarza oznaczający pozycję fragmentu;
  `create` - fabryka tworząca potomny fragment dla kontekstu;
  `context` - kontekst danych używany do tworzenia potomnych.
- **`context: IBindingContext | undefined`** (readonly)
  Kontekst danych używany do tworzenia potomnych.
- **`get nodes(): ChildNode[]`**
  Wszystkie obecnie zamontowane węzły potomne, w kolejności DOM.
- **`createChild(context: IBindingContext | undefined, prepare?: (template: HTMLTemplateElement) => void): MountedFragment`**
  Tworzy potomny fragment, używając fabryki `create` fragmentu.
  `context` - kontekst danych potomnego; `prepare` - opcjonalny hak
  przygotowania szablonu. Zwraca utworzony fragment potomny.
  @throws {Error} gdy fragment został już zwolniony.
- **`setChildren(children: readonly MountedFragment[]): void`**
  Zamienia zamontowanych potomnych na `children`: zachowane węzły są
  wstawiane ponownie w swoich miejscach, usunięte potomne są zwalniane, a
  fokus / zaznaczenie tekstu węzłów, które przetrwały, jest zachowywane.
  `children` - nowe fragmenty potomne (muszą być unikalne).
  @throws {Error} gdy fragment został zwolniony albo `children` zawiera
  duplikaty.
- **`mount(): void`** - montuje fragment: tworzy pojedynczego potomnego, jeśli potrzeba.
- **`unmount(): void`** - demontuje fragment: zwalnia wszystkich potomnych.
- **`dispose(): void`**
  Zwalnia wszystkich aktualnych potomnych i usuwa komentarz-kotwicę.
  Idempotentne.

## bindingMode

Zawartość publiczna modułu: wyliczenie `BindingMode`, funkcja `parseBindingMode`.

### `BindingMode`

Kierunek, w którym binding przepływa między właściwością ViewModel a elementem
DOM.

| Wartość | Znaczenie |
|---|---|
| `BindingMode.TwoWay` (= 0) | ViewModel → View oraz View → ViewModel |
| `BindingMode.OneWay` (= 1) | tylko ViewModel → View |
| `BindingMode.OneWayToSource` (= 2) | tylko View → ViewModel: DOM zapisuje wartość z powrotem do właściwości |

### `parseBindingMode`

```ts
function parseBindingMode(value: string): BindingMode | undefined;
```

Analizuje argument `mode` fragmentu bindingu i zwraca odpowiadające
`BindingMode`.

`value` - surowy ciąg trybu zapisany w fragmencie bindingu; dopasowanie
jest wrażliwe na wielkość liter (`twoWay`, `oneWay`, `oneWayToSource`).
Zwraca pasujący tryb albo `undefined`, gdy wartość nie jest rozpoznana.

## collectionObserver

Zawartość publiczna modułu: klasa `CollectionObserver<T>`.

### `CollectionObserver<T>`

`ArrayObserver`, który dodatkowo obserwuje same elementy.

Odczyty indeksów zwracają proxy elementów: modyfikacja zwykłego obiektu lub
elementu `ViewModel` pod proxy - łącznie ze zmianami właściwości `ViewModel` -
powiadamia wszystkich subskrybentów zmian elementów.

`Symbol.species` jest `Array`, dlatego metody tablicy dające pochodne
(np. `slice`, `filter`) zwracają zwykłe tablice.

- **`static get [Symbol.species](): ArrayConstructor`**
  Konstruktor species: zwykła `Array`.
- **`constructor(...items: T[])`**
  Elementy początkowe; podane elementy są dodawane (i obserwowane).
- **`subscribeItemChanges(callback: () => void): void`**
  Rejestruje subskrybenta zmian wewnątrz elementów (zapisy właściwości na
  elementach pod proxy, łącznie ze zmianami właściwości `ViewModel`).
  Wywoływane bez argumentów dla każdej logicznej zmiany elementu.
- **`unsubscribeItemChanges(callback: () => void): void`**
  Usuwa wcześniej zarejestrowanego subskrybenta. Gdy nie zostaje żaden
  subskrybent, obserwacja elementów `ViewModel` jest zwalniana.
- **`deleteItem(item: T): number`**
  Usuwa pierwszy element pasujący do `item` - porównując proxy z ich
  oryginałami - i powiadamia opisem `splice`. Zwraca indeks usuniętego
  elementu albo -1, gdy nie znaleziono.

Klasa dziedziczy wszystkie człony `ArrayObserver` (m.in.
`subscribeChanges`, `push`, `splice`, `insertAfter`, `clear`, `sort`).

## command

Zawartość publiczna modułu: interfejsy `CommandData`, `ICommand`,
`CommandOptions`, klasa `Command`.

### `CommandData`

Niemutowalne dane opisujące kontekst wywołania wykonania komendy.

- **`commandName: string`** (readonly) - nazwa komendy.
- **`objectSender: object`** (readonly)
  Obiekt, który wywołał komendę (zwykle element źródłowy).
- **`args: readonly string[]`** (readonly)
  Surowe argumenty tekstowe fragmentu bindingu, który wywołał komendę.
- **`sourceEvent: Event`** (readonly)
  Oryginalne zdarzenie DOM, które wywołało komendę.
- **`parameter?: unknown`** (readonly) - opcjonalny rozwiązany parametr komendy.

### `ICommand`

Komenda ViewModel: wykonywalna jednostka logiki biznesowej, którą widoki
wywołują przez bindy komend. Komendy wspierają opcjonalną bramkę
`canExecute`, śledzenie stanu wykonywania oraz blokowanie wejścia
rekurencyjnego.

- **`commandData: CommandData`** (readonly)
  Dane wywołania najnowszego (lub oczekującego) wykonania.
- **`isExecuting?: boolean`** (readonly)
  Czy przynajmniej jedno wykonanie jest obecnie w toku.
- **`subscribeExecutionState?(listener: (isExecuting: boolean) => void): () => void`**
  Subskrypcja zmian stanu wykonywania (wejście/wyjście ze stanu
  „wykonywanie"). Zwraca funkcję usuwającą subskrypcję.
- **`canExecute?(parameter?: unknown): boolean`**
  Sprawdza, czy komendę można wykonać z podanym parametrem.
- **`subscribeCanExecuteChanged?(listener: () => void): () => void`**
  Subskrypcja zmian stanu `canExecute` (możliwość wykonania mogła się
  zmienić). Zwraca funkcję usuwającą subskrypcję.
- **`notifyCanExecuteChanged?(): void`**
  Powiadamia subskrybentów, że stan `canExecute` mógł się zmienić.
- **`execute(event: CommandActionEvent): void | Promise<void>`**
  Wykonuje komendę. Zwraca promise, gdy wykonanie jest asynchroniczne,
  w przeciwnym razie `undefined`.

### `CommandOptions`

Opcje sterujące instancją `Command`.

- **`canExecute?: (parameter: unknown) => boolean`**
  Opcjonalna bramka sprawdzana przed każdym wykonaniem. Zwraca `true`, gdy
  wykonanie jest dozwolone.
- **`blockWhileExecuting?: boolean`**
  Gdy `true`, komenda zgłasza `canExecute` jako `false`, podczas gdy
  wykonanie jest w toku (blokowanie wejścia rekurencyjnego).

### `Command`

Domyślna implementacja `ICommand`.

Konstruktor przyjmuje wywołanie zwrotne, które otrzymuje zamrożony proxy
wywołania `ICommand` związany z tą instancją - dzięki temu wywołania
zwrotne mogą inspektować bieżące dane wywołania i nawet ponownie wywołać
komendę. Liczba wykonań jest liczona przez odwołania: nakładające się
wykonania asynchroniczne utrzymują `isExecuting` na `true`, dopóki wszystkie
nie zakończą.

- **`constructor(executeCallback: (command: ICommand) => unknown, onError?: ((error: unknown) => void) | undefined, options?: CommandOptions)`**
  `executeCallback` - wywoływane dla każdego wykonania z zamrożonym proxy
  wywołania `ICommand`; może zwrócić wartość albo promise - promise utrzymuje
  komendę w stanie „wykonywanie" do jego zakończenia.
  `onError` - opcjonalne wywołanie zwrotne odbierające odrzucone wykonania
  asynchroniczne; gdy pominięte, odrzucenia są ponownie rzucane na zwracanym
  promise.
  `options` - opcjonalne opcje bramkowania wykonania.
- **`get commandData(): CommandData`**
  Dane wywołania najnowszego (lub oczekującego) wykonania.
- **`get isExecuting(): boolean`**
  Czy przynajmniej jedno wykonanie jest obecnie w toku.
- **`subscribeExecutionState(listener: (isExecuting: boolean) => void): () => void`**
  Subskrypcja zmian stanu wykonywania. Zwraca funkcję usuwającą subskrypcję.
- **`canExecute(parameter?: unknown): boolean`**
  Sprawdza, czy komendę można wykonać z podanym parametrem. Zwraca `false`,
  gdy ustawiono `blockWhileExecuting` i wykonanie jest w toku, albo gdy
  skonfigurowana bramka zwróci `false`.
- **`subscribeCanExecuteChanged(listener: () => void): () => void`**
  Subskrypcja zmian stanu `canExecute`. Zwraca funkcję usuwającą subskrypcję.
- **`notifyCanExecuteChanged(): void`**
  Powiadamia subskrybentów, że stan `canExecute` mógł się zmienić.
- **`execute(event: CommandActionEvent): void | Promise<void>`**
  Wykonuje komendę z podanym zdarzeniem wywołania. No-op, gdy `canExecute`
  odrzuci wywołanie. Wyniki synchronicznego wywołania zwrotnego kończą się
  natychmiast; wyniki typu promise utrzymują stan „wykonywanie" do ich
  zakończenia. Zwraca rozliczony łańcuch promise dla wykonań asynchronicznych.
  @throws Wyjątki rzucane synchronicznie przez wywołanie zwrotne propagują
  bez zmian.

## commandActionEvent

Zawartość publiczna modułu: interfejs `ICommandActionEvent`, klasa
`CommandActionEvent`.

### `ICommandActionEvent`

Zdarzenie niosące pełny kontekst wywołania akcji komendy: która komenda
została wyzwolona, przez jaki obiekt, z którego zdarzenia DOM, z jakimi
argumentami i parametrem. Rozszerza `Event`.

- **`commandName: string`** (readonly) - nazwa wyzwolonej komendy.
- **`objectSender: object`** (readonly)
  Obiekt, który wyzwolił komendę (zwykle element źródłowy).
- **`args: string[]`** (readonly) - surowe argumenty tekstowe fragmentu bindingu.
- **`parameter?: unknown`** (readonly) - opcjonalny rozwiązany parametr komendy.

### `CommandActionEvent`

Standardowa implementacja `ICommandActionEvent` oparta na DOM `Event`.

- **`commandName: string`** (readonly) - nazwa wyzwolonej komendy.
- **`objectSender: object`** (readonly)
  Obiekt, który wyzwolił komendę (zwykle element źródłowy).
- **`sourceEvent: Event`** (readonly)
  Oryginalne zdarzenie DOM, które wyzwoliło komendę.
- **`args: string[]`** (readonly) - surowe argumenty tekstowe fragmentu bindingu.
- **`parameter?: unknown`** (readonly) - opcjonalny rozwiązany parametr komendy.
- **`constructor(type: string, commandName: string, objectSender: object, sourceEvent: Event, args: string[], parameter?: unknown)`**
  `type` - typ zdarzenia (konwencjonalnie `command-action`);
  `commandName` - nazwa wyzwolonej komendy;
  `objectSender` - obiekt, który wyzwolił komendę;
  `sourceEvent` - oryginalne zdarzenie DOM, które wyzwoliło komendę;
  `args` - surowe argumenty tekstowe fragmentu bindingu;
  `parameter` - opcjonalny rozwiązany parametr komendy.

## commandActionEventTarget

Zawartość publiczna modułu: interfejs `ICommandActionEventTarget`, klasa
`CommandActionEventTarget`.

### `ICommandActionEventTarget`

`EventTarget`, który może wyzwalać zdarzenia akcji komend.

- **`commandAction(commandName: string, objectSender: object, sourceEvent: Event, ...args: string[]): void`**
  Wyzwala zdarzenie `command-action` dla podanego wywołania komendy.
  `commandName` - nazwa wyzwolonej komendy;
  `objectSender` - obiekt, który wyzwolił komendę;
  `sourceEvent` - oryginalne zdarzenie DOM, które wyzwoliło komendę;
  `args` - surowe argumenty tekstowe fragmentu bindingu.

### `CommandActionEventTarget`

Domyślna implementacja `ICommandActionEventTarget` zbudowana na standardowym
`EventTarget`.

- **`commandAction(commandName: string, objectSender: object, sourceEvent: Event, ...args: string[]): void`**
  Wyzwala `CommandActionEvent` dla podanego wywołania komendy. Argumenty jak
  w `ICommandActionEventTarget.commandAction`.

## commandBindingFactory

Zawartość publiczna modułu: klasa `CommandBindingFactory` (wyłącznie metody
statyczne) oraz typ `CommandBindingCreate`.

Tworzy bindy zdarzeń komend według nazwy.

Zarejestrowane typy: `click`, `mouseInOut`, `change`, `input`, `focusout`,
`resize`, `animationend`, `enter`, `key`, `submit`, `dragover`, `dragleave`,
`drop`, `ready`, `mousedown`, `mouseup`, `mousemove`.

### `CommandBindingCreate`

`(element: HTMLElement, name: string, argList: string[], eventTarget: ICommandActionEventTarget) => IEventCommandBinding`

Fabryka rejestrowanego typu bindu zdarzeń komendy; `element` - element do
nasłuchiwania, `name` - nazwa komendy, `argList` - surowe argumenty
`nazwa:wartość`, `eventTarget` - cel zdarzeń `command-action` (zawsze
podstawiony).

- **`createCommandBinding(type: string, element: HTMLElement, name: string, argList: string[], eventTarget?: ICommandActionEventTarget): IEventCommandBinding`** (statyczna)
  Tworzy bind zdarzenia komendy podanego typu.
  `type` - typ binda (np. `click`, `input`, `key`);
  `element` - element DOM, na którym nasłuchiwane są zdarzenia;
  `name` - nazwa komendy do wyzwolenia;
  `argList` - surowe ciągi argumentów `nazwa:wartość` fragmentu bindingu;
  `eventTarget` - cel odbierający zdarzenia `command-action`; gdy pominięty,
  tworzony jest nowy cel.
  Zwraca utworzony bind.
  @throws {Error} gdy typ nie jest zarejestrowany.
- **`registerCommandBinding(name: string, create: CommandBindingCreate): void`** (statyczna)
  Rejestruje nowy typ bindu zdarzeń komendy. Rejestr jest globalny (per kopia
  pakietu); rejestruj przed utworzeniem widoków, pojedynczo na nazwę.
  @throws {Error} gdy nazwa jest już zajęta (typ wbudowany lub wcześniejsza
  rejestracja).

## commandDecorators

Zawartość publiczna modułu: interfejs `DecoratedCommandOptions` oraz
dekoratory `command` i `autoRegisterCommands`.

Dekoratory rejestrują komendy deklaratywnie na klasie ViewModel. Komendy są
rejestrowane per instancja (w inicjalizatorze), gdy hierarchia klasy jest
oznaczona `@autoRegisterCommands`.

### `DecoratedCommandOptions`

Opcje dekoratora `command`; interfejs generyczny - parametr typu `This`
(domyślnie `IViewModel`) ogranicza typ instancji ViewModel, do której
dekorator jest stosowany.

- **`canExecute?: (this: This, parameter: unknown) => boolean`**
  Opcjonalna brama sprawdzana przed każdym wykonaniem, wywoływana z
  instancją ViewModel jako `this`.
  `parameter` - parametr, z którym miało się rozpocząć wykonanie.
  Zwraca `true`, gdy wykonanie jest dozwolone.
- **`blockWhileExecuting?: boolean`**
  Gdy `true`, komenda zgłasza `canExecute` jako `false`, dopóki trwa
  wykonanie (blokada wejścia rekurencyjnego).

### `command`

Dekorator metody rejestrujący dekorowaną metodę jako komendę ViewModel.

```ts
function command(commandName: string, options?: DecoratedCommandOptions): ...
```

- `commandName` - nazwa, pod którą komenda jest rejestrowana.
- `options` - opcje sterowania wykonaniem (`canExecute`, `blockWhileExecuting`).
- Zwraca standardowy dekorator metody.
- @throws {Error} gdy zastosowany do czegoś innego niż metoda albo gdy pod
  tą nazwą jest już zadeklarowana komenda w tej samej klasie.

### `autoRegisterCommands`

Dekorator klasy oznaczający hierarchię klasy do automatycznej rejestracji
zdekorowanych komend.

```ts
function autoRegisterCommands(): ...
```

- Zwraca standardowy dekorator klasy.
- @throws {Error} gdy zastosowany do czegoś innego niż klasa.

## compositeDisposable

`dispose()` loguje błędy sprzątania przez `console.warn(message, error)` i kontynuuje zwalnianie zasobów. Log zawiera oryginalną rzuconą wartość. Błąd natychmiastowego wykonania teardownu w `add()` po zwolnieniu trafia do wywołującego.

Zawartość publiczna modułu: klasa `CompositeDisposable`.

Zbiera wywołania zwrotne zwalniania zasobów oraz obiekty `IDisposable` i
zwalnia je
wszystkie naraz w kolejności odwrotnej do rejestracji.

Zwalnianie jest idempotentne: po zwolnieniu dalsze wywołania `add()` wykonują
podany teardown natychmiast zamiast go przechowywać.

- **`add(teardown: Teardown): void`**
  Rejestruje wywołanie zwrotne zwalniania, które zostanie uruchomione przy
  zwolnieniu tego kompozytu. Gdy kompozyt jest już zwolniony, wywołanie
  zwrotne zostaje wykonane natychmiast. `teardown` - wywołanie zwalniające
  pojedynczy zasób.
- **`addDisposable(disposable: IDisposable): void`**
  Rejestruje kolejny obiekt `IDisposable`, który zostanie zwolniony razem z tym
  kompozytem. `disposable` - obiekt do zwolnienia, gdy ten kompozyt zostanie
  zwolniony.
- **`dispose(): void`**
  Uruchamia wszystkie zarejestrowane teardowny w kolejności odwrotnej do
  rejestracji i oznacza ten kompozyt jako zwolniony. Błąd rzucany przez
  pojedynczy teardown jest raportowany na konsolę i nie zatrzymuje pozostałych
  teardownów.

## disposable

Zawartość publiczna modułu: interfejs `IDisposable`, typ `Teardown`.

### `IDisposable`

Umowa dla obiektów, które posiadają zasoby i potrafią je zwolnić w sposób
deterministyczny.

- **`dispose(): void`**
  Zwalnia zasoby posiadane przez ten obiekt. Implementacje muszą czynić tę
  metodę idempotentną, tak aby powtórzone wywołania były no-ops.

### `Teardown`

Wywołanie zwrotne zwalniające pojedynczy zasób (subskrypcja, nasłuch, ...).

```ts
type Teardown = () => void;
```

## eventCommandBinding

Zawartość publiczna modułu: interfejs `IEventCommandBinding`, abstrakcyjna
klasa `EventCommandBinding`.

### `IEventCommandBinding`

Umowa dla bindingów, które przekazują zdarzenia elementu DOM do celu akcji
komend. Implementacje nasłuchują konkretnego zdarzenia DOM na elemencie i
wyzwalają zdarzenia `command-action`.

- **`subscribe(functionEvent: (event: Event) => void): void`**
  Rejestruje nasłuch zdarzeń `command-action`.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Usuwa wcześniej zarejestrowany nasłuch.
- **`dispose(): void`** - zwalnia bind.

### `EventCommandBinding`

Klasa bazowa bindingów komend: przechowuje nasłuchy `command-action`,
parsuje pary argumentów `nazwa:wartość` fragmentu bindingu do `args` dla
konkretnych implementacji oraz śledzi zwolnienie.

- **`element: HTMLElement`** (protected) - element DOM, na którym nasłuchiwane
  są zdarzenia.
- **`commandName: string`** (protected) - nazwa komendy do wyzwolenia.
- **`eventTarget: ICommandActionEventTarget`** (protected)
  Cel odbierający zdarzenia `command-action`.
- **`args: { [argName: string]: string }`** (protected)
  Argumenty sparsowane z fragmentu bindingu.
- **`commandListeners: Set<(event: Event) => void>`** (protected, readonly)
  Rejestr nasłuchów `command-action`.
- **`disposed: boolean`** (protected) - czy bind został zwolniony.
- **`constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget)`**
  `element` - element DOM, na którym nasłuchiwane są zdarzenia;
  `commandName` - nazwa komendy do wyzwolenia;
  `argList` - surowe ciągi argumentów `nazwa:wartość` fragmentu bindingu;
  `eventTarget` - cel odbierający zdarzenia `command-action`.
- **`subscribe(functionEvent: (event: Event) => void): void`**
  Rejestruje nasłuch `command-action` na podlegającym celu zdarzeń.
  `functionEvent` - nasłuch do zarejestrowania.
  @throws {Error} gdy wywołano na zwolnionym bindzie.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Usuwa wcześniej zarejestrowany nasłuch `command-action`.
- **`dispose(): void`**
  Usuwa wszystkie nasłuchy i oznacza bind jako zwolniony. Idempotentne.

## propertyChangeEvent

Zawartość publiczna modułu: interfejs `IPropertyChangeEvent`, klasa
`PropertyChangeEvent`.

### `IPropertyChangeEvent`

Zdarzenie zmiany niosące nazwę zmienionej właściwości i jej nową wartość.
Rozszerza `Event`.

- **`propertyName: string`** - nazwa zmienionej właściwości.
- **`value: unknown`** - nowa wartość właściwości.

### `PropertyChangeEvent`

Standardowa implementacja `IPropertyChangeEvent` oparta na DOM `Event`.

- **`propertyName: string`** (readonly) - nazwa zmienionej właściwości.
- **`value: unknown`** (readonly) - nowa wartość właściwości.
- **`constructor(type: string, propertyName: string, value: unknown)`**
  `type` - typ zdarzenia (konwencjonalnie `property-change`);
  `propertyName` - nazwa zmienionej właściwości;
  `value` - nowa wartość właściwości.

## propertyChangeEventTarget

Zawartość publiczna modułu: interfejs `IPropertyChangeEventTarget`, klasa
`PropertyChangeEventTarget`.

### `IPropertyChangeEventTarget`

`EventTarget`, który może wyzwalać powiadomienia o zmianach właściwości.
Rozszerza `EventTarget`.

- **`notifyPropertyChanged<T>(propertyName: string, value: T): void`**
  Wyzwala zdarzenie `property-change` niosące nową wartość właściwości.
  `propertyName` - nazwa zmienionej właściwości;
  `value` - nowa wartość właściwości.

### `PropertyChangeEventTarget`

Domyślna implementacja `IPropertyChangeEventTarget` zbudowana na standardowym
`EventTarget`.

- **`notifyPropertyChanged<T>(propertyName: string, value: T): void`**
  Wyzwala `PropertyChangeEvent` dla podanej wartości właściwości.
  `propertyName` - nazwa zmienionej właściwości;
  `value` - nowa wartość właściwości.

## propertyDecorators

Zawartość publiczna modułu: dekoratory akcesorów `validate`, `propertyChange`,
`propertyAlias`.

### `validate`

Dekorator akcesora rejestrujący właściwość z walidatorem (lub tablicą
walidatorów). Walidatorem może być instancja albo funkcja-fabryka.
Sączenie `@validate` z `@propertyChange` na jednym akcesorze jest wspierane.

```ts
function validate(input: ValidatorInput, callback?: string): ...
```

- `input` - instancja walidatora, fabryka walidatora albo tablica tych elementów.
- `callback` - opcjonalna nazwa metody związanej z instancją ViewModelu.
  Wykonuje się po walidacji przy zapisie z `callbackExecute = true`:
  `setPropertyValue` (domyślnie), `setPropertyValueAndNotify` (jawnie)
  oraz `setPropertyValueFromView` dla zmienionej wartości.
  Zwykłe przypisanie akcesora ani inicjalizacja nie uruchamiają callbacku.
  Zapis z widoku pomija wartości równe według `Object.is`; jawne API zapisu ich nie pomija.
- @throws {Error} gdy zastosowany do czegoś innego niż nazwany akcesor.

### `propertyChange`

Dekorator akcesora rejestrujący reaktywną właściwość na ViewModel. Odczyt
przebiega przez zarejestrowany magazyn właściwości, a zapis wyzwala
powiadomienie `property-change`.

```ts
function propertyChange(callback?: string): ...
```

- `callback` - opcjonalna nazwa metody związanej z instancją ViewModelu.
  Wykonuje się po walidacji przy zapisie z `callbackExecute = true`:
  `setPropertyValue` (domyślnie), `setPropertyValueAndNotify` (jawnie)
  oraz `setPropertyValueFromView` dla zmienionej wartości.
  Zwykłe przypisanie akcesora ani inicjalizacja nie uruchamiają callbacku.
  Zapis z widoku pomija wartości równe według `Object.is`; jawne API zapisu ich nie pomija.
- @throws {Error} gdy zastosowany do czegoś innego niż nazwany akcesor.
- @throws {TypeError} gdy rozwiązany callback nie jest funkcją.

### `propertyAlias`

Dekorator akcesora rejestrujący reaktywną właściwość pod aliasem. Nazwa
akcesora różni się od nazwy właściwości udostępnianej bindingom.

```ts
function propertyAlias(propertyName: string, callback?: string): ...
```

- `propertyName` - nazwa właściwości udostępniana ViewModel i bindingom.
- `callback` - opcjonalna nazwa metody związanej z instancją ViewModelu.
  Wykonuje się po walidacji przy zapisie z `callbackExecute = true`:
  `setPropertyValue` (domyślnie), `setPropertyValueAndNotify` (jawnie)
  oraz `setPropertyValueFromView` dla zmienionej wartości.
  Zwykłe przypisanie akcesora ani inicjalizacja nie uruchamiają callbacku.
  Zapis z widoku pomija wartości równe według `Object.is`; jawne API zapisu ich nie pomija.
- @throws {Error} gdy zastosowany do czegoś innego niż nazwany akcesor.

## validationErrorBinding

Zawartość publiczna modułu: interfejs `IValidationErrorBinding`, abstrakcyjna
klasa `ValidationErrorBinding`.

### `IValidationErrorBinding`

Umowa dla bindingów, które odzwierciedlają stan walidacji właściwości w DOM.
Implementacje reagują na zdarzenia `error-change` publikowane przez
`IValidationStateChangeEventTarget`.

- **`subscribe(functionEvent: (event: Event) => void): void`**
  Rejestruje nasłuch `error-change` na podlegającym celu zdarzeń.
  @throws {Error} gdy wywołano na zwolnionym bindzie.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Usuwa wcześniej zarejestrowany nasłuch `error-change`.
- **`dispose(): void`**
  Zwalnia wszystkie subskrypcje. Idempotentne.
- **`setValid(isValid: boolean, message?: string): void`**
  Stosuje wynik walidacji do elementu DOM. `isValid` - czy wartość
  właściwości jest ważna; `message` - komunikat błędu, gdy nieważna.
- **`reset(): void`**
  Czyści prezentację walidacji (stan błędu jest usuwany).

### `ValidationErrorBinding`

Klasa bazowa bindingów błędów walidacji: śledzi ważność, przechowuje
nasłuchy `error-change` oraz parsuje pary argumentów `nazwa:wartość` do
`argsList` dla konkretnych implementacji.

- **`element: HTMLElement`** (protected) - element DOM, do którego bind
  renderuje prezentację.
- **`propertyName: string`** (protected) - nazwa walidowanej właściwości
  ViewModel.
- **`eventTarget: IValidationStateChangeEventTarget`** (protected)
  Cel publikujący zdarzenia `error-change`.
- **`errorListeners: Set<(event: Event) => void>`** (protected, readonly)
  Rejestr nasłuchów `error-change`.
- **`disposed: boolean`** (protected) - czy bind został zwolniony.
- **`isValid: boolean`** (protected)
  Bieżący flaga ważności; aktualizowana przez `setValid` / `reset`.
- **`argsList: { [argName: string]: string }`** (protected)
  Argumenty `nazwa:wartość` sparsowane z fragmentu bindingu.
- **`constructor(element: HTMLElement, propertyName: string, argList: string[], eventTarget: IValidationStateChangeEventTarget)`**
  `element` - element DOM, do którego bind renderuje;
  `propertyName` - nazwa walidowanej właściwości ViewModel;
  `argList` - surowe ciągi argumentów `nazwa:wartość` fragmentu bindingu;
  `eventTarget` - cel publikujący zdarzenia `error-change`.
- **`subscribe(functionEvent: (event: Event) => void): void`**
  Rejestruje nasłuch `error-change` na podlegającym celu zdarzeń.
  @throws {Error} gdy wywołano na zwolnionym bindzie.
- **`unsubscribe(functionEvent: (event: Event) => void): void`**
  Usuwa wcześniej zarejestrowany nasłuch `error-change`.
- **`dispose(): void`**
  Usuwa wszystkie nasłuchy i oznacza bind jako zwolniony. Idempotentne.
- **`setValid(isValid: boolean, message?: string): void`**
  Zapisuje wynik walidacji bez dotykania DOM. Konkretne implementacje
  nadpisują tę metodę, aby zaktualizować również element.
- **`reset(): void`**
  Oznacza właściwość jako znowu ważną bez dotykania DOM.
- **`prepareArgs(argList: string[]): void`** (protected)
  Parsuje surowe argumenty `nazwa:wartość` do `argsList`.

## validationErrorBindingFactory

Zawartość publiczna modułu: klasa `ValidationErrorBindingFactory` (wyłącznie
metody statyczne) oraz typ `ValidationErrorBindingCreate`.

Tworzy bindy błędów walidacji według nazwy.

Zarejestrowane typy: `class` (przełącza klasy CSS na elemencie), `message`
(renderuje element komunikatu błędu) oraz `click` (alias `class`).

### `ValidationErrorBindingCreate`

`(element: HTMLElement, name: string, argList: string[], eventTarget: IValidationStateChangeEventTarget) => IValidationErrorBinding`

Fabryka rejestrowanego typu bindu błędu walidacji; `element` - element docelowy,
`name` - nazwa walidowanej właściwości, `argList` - surowe argumenty
`nazwa:wartość`, `eventTarget` - cel zdarzeń `error-change` (zawsze podstawiony).

- **`createValidationErrorBinding(type: string, element: HTMLElement, name: string, argList: string[], eventTarget?: IValidationStateChangeEventTarget): IValidationErrorBinding`** (statyczna)
  Tworzy bind błędu walidacji podanego typu.
  `type` - typ bindu: `class`, `message` albo `click` (alias `class`);
  `element` - element DOM, do którego bind renderuje;
  `name` - nazwa walidowanej właściwości ViewModel;
  `argList` - surowe ciągi argumentów `nazwa:wartość` fragmentu bindingu;
  `eventTarget` - cel publikujący zdarzenia `error-change`; gdy pominięty,
  tworzony jest nowy cel.
  Zwraca utworzony bind.
  @throws {Error} gdy typ nie jest zarejestrowany.
- **`registerValidationErrorBinding(name: string, create: ValidationErrorBindingCreate): void`** (statyczna)
  Rejestruje nowy typ bindu błędu walidacji. Rejestr jest globalny (per kopia
  pakietu); rejestruj przed utworzeniem widoków, pojedynczo na nazwę.
  @throws {Error} gdy nazwa jest już zajęta (typ wbudowany, alias `click` lub
  wcześniejsza rejestracja).

## validationStateEvent

Zawartość publiczna modułu: interfejsy `IValidationStateChangeEvent`,
`IValidationStateResetEvent`; klasy `ValidationStateChangeEvent`,
`ValidationStateResetEvent`.

### `IValidationStateChangeEvent`

Zdarzenie wyzwolone, gdy zmienia się stan walidacji właściwości. Rozszerza
`Event`.

- **`propertyName: string`** - nazwa walidowanej właściwości.
- **`isValid: boolean`** - czy wartość właściwości jest ważna.
- **`message?: string`** - komunikat błędu; obecny tylko, gdy `isValid` jest
  `false`.

### `ValidationStateChangeEvent`

Standardowa implementacja `IValidationStateChangeEvent` oparta na DOM `Event`.

- **`propertyName: string`** (readonly) - nazwa walidowanej właściwości.
- **`isValid: boolean`** (readonly) - czy wartość właściwości jest ważna.
- **`message?: string`** (readonly) - komunikat błędu; obecny tylko, gdy
  nieważny.
- **`constructor(type: string, propertyName: string, isValid: boolean, message?: string)`**
  `type` - typ zdarzenia (konwencjonalnie `error-change`);
  `propertyName` - nazwa walidowanej właściwości;
  `isValid` - czy wartość właściwości jest ważna;
  `message` - komunikat błędu, obecny tylko, gdy nieważny.

### `IValidationStateResetEvent`

Zdarzenie wyzwolone, gdy zresetowany jest zapisany stan walidacji
właściwości. Rozszerza `Event`.

- **`propertyName: string`** - nazwa właściwości, której stan walidacji
  został zresetowany.

### `ValidationStateResetEvent`

Standardowa implementacja `IValidationStateResetEvent` oparta na DOM `Event`.

- **`propertyName: string`** (readonly) - nazwa właściwości, której stan
  walidacji został zresetowany.
- **`constructor(type: string, propertyName: string)`**
  `type` - typ zdarzenia (konwencjonalnie `error-reset`);
  `propertyName` - nazwa właściwości, której stan walidacji został zresetowany.

## validationStateEventTarget

Zawartość publiczna modułu: interfejsy `IValidationStateChangeEventTarget`,
`IValidationStateResetEventTarget`; klasy `ValidationStateChangeEventTarget`,
`ValidationStateResetEventTarget`.

### `IValidationStateChangeEventTarget`

`EventTarget`, który może wyzwalać zdarzenia `error-change` walidacji.
Rozszerza `EventTarget`.

- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Wyzwala zdarzenie `error-change` dla podanego wyniku walidacji.
  `propertyName` - nazwa walidowanej właściwości;
  `isValid` - czy wartość właściwości jest ważna;
  `message` - komunikat błędu, obecny tylko, gdy nieważny.

### `ValidationStateChangeEventTarget`

Domyślna implementacja `IValidationStateChangeEventTarget` zbudowana na
standardowym `EventTarget`.

- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Wyzwala `ValidationStateChangeEvent` dla podanego wyniku walidacji.
  Argumenty jak w interfejsie.

### `IValidationStateResetEventTarget`

`EventTarget`, który może wyzwalać zdarzenia `error-reset` walidacji.
Rozszerza `EventTarget`.

- **`notifyValidationStateReset(propertyName: string): void`**
  Wyzwala zdarzenie `error-reset` dla podanej właściwości.
  `propertyName` - nazwa właściwości, której stan walidacji został zresetowany.

### `ValidationStateResetEventTarget`

Domyślna implementacja `IValidationStateResetEventTarget` zbudowana na
standardowym `EventTarget`.

- **`notifyValidationStateReset(propertyName: string): void`**
  Wyzwala `ValidationStateResetEvent` dla podanej właściwości.
  `propertyName` - nazwa właściwości, której stan walidacji został zresetowany.

## valueConverter

Zawartość publiczna modułu: interfejs `IValueConverter`, interfejs
`ConverterTargetProvider`, dekorator `convert`, funkcje `registerConverter`,
`unregisterConverter`, `getConverter`, `hasConverterFor`,
`getConverterMetadataFor`, `convertToView`, `convertToViewModel`.

### `IValueConverter`

Konwerter wartości między ViewModel a View.

Odpowiednik `IValueConverter` w klasycznych frameworkach MVVM.

Konwertery są rejestrowane według nazwy i przyłączane do właściwości
dekoratorem `@convert`.

- **`convert(value: unknown, parameter?: unknown): unknown`**
  Konwertuje wartość z ViewModel do View.
  `value` - surowa wartość odczytana z ViewModel;
  `parameter` - opcjonalny parametr podany w `@convert` (np. nazwa klasy CSS
  lub mapa enum).
  Zwraca wartość do zastosowania w View.
- **`convertBack?(value: unknown, parameter?: unknown): unknown`**
  Konwertuje wartość z View do ViewModel.
  Stosowany tylko, gdy tryb bindingu to `twoWay` albo `oneWayToSource`.
  `value` - surowa wartość odczytana z DOM;
  `parameter` - parametr podany w `@convert`.
  Zwraca wartość do zapisania w ViewModel.

### `ConverterTargetProvider`

Opcjonalna umowa, którą ViewModel może zaimplementować, aby przekierować
szukanie konwetera dla właściwości do zagnieżdżonego kontekstu (np. modelu
dzieci).

- **`getConverterTarget(propertyName: string): { context: object; propertyName: string } | undefined`**
  Rozwiązuje obiekt, który faktycznie deklaruje konwerter dla podanej
  właściwości.
  `propertyName` - właściwość do odszukania.
  Zwraca cel szukania `{ context, propertyName }` albo `undefined`, gdy
  właściwość nie ma konwetera.

### `convert`

Dekorator akcesora przyłączający nazwany konwerter wartości do właściwości
ViewModel.

```ts
function convert(converterName: string, parameter?: unknown): ...
```

- `converterName` - nazwa, pod którą konwerter jest zarejestrowany w
  `registerConverter`.
- `parameter` - opcjonalny parametr przekazywany do `convert` / `convertBack`.
- @throws {Error} gdy zastosowany do czegoś innego niż nazwany akcesor albo
  gdy dla tej właściwości jest już deklarowany inny konwerter.

### `registerConverter`

```ts
function registerConverter(name: string, converter: IValueConverter): void;
```

Rejestruje konwerter wartości pod nazwą, aby mógł być referowany z dekoratora
`@convert`.

- `name` - klucz rejestru używany przez `@convert` i `getConverter`.
- `converter` - instancja konwetera do przechowania.

### `unregisterConverter`

```ts
function unregisterConverter(name: string): void;
```

Usuwa konwerter z rejestru.

- `name` - klucz rejestru wcześniej przekazany do `registerConverter`.

### `getConverter`

```ts
function getConverter(name: string): IValueConverter;
```

Zwraca konwerter zarejestrowany pod podaną nazwą.

- `name` - klucz rejestru.
- @throws {Error} gdy pod podaną nazwą nie jest zarejestrowany żaden konwerter.

### `hasConverterFor`

```ts
function hasConverterFor(propertyName: string, vm: object): boolean;
```

Sprawdza, czy właściwość ViewModel ma konwerter przyłączony przez `@convert`.

- `propertyName` - nazwa właściwości tak, jak jest udostępniona bindingom.
- `vm` - instancja ViewModel (lub obiekt) do zbadania.
- Zwraca `true`, gdy właściwość ma przyłączony konwerter.

### `getConverterMetadataFor`

```ts
function getConverterMetadataFor(propertyName: string, vm: object): ConverterMetadata | undefined;
```

Rozwiązuje metadane konwetera właściwości ViewModel, respektując
`ConverterTargetProvider`, tak aby zagnieżdżone konteksty mogły deklarować
własne konwertery.

- `propertyName` - nazwa właściwości tak, jak jest udostępniona bindingom.
- `vm` - instancja ViewModel (lub obiekt) do zbadania.
- Zwraca metadane konwetera albo `undefined`, gdy właściwość nie ma
  konwetera.

Metadane to obiekt `{ propertyName: string; converterName: string; parameter?: unknown }`.

### `convertToView`

```ts
function convertToView(value: unknown, propertyName: string, vm: object): unknown;
```

Przepuszcza wartość przez konwerter przyłączony do właściwości (kierunek
ViewModel → View). Zwraca wartość bez zmian, gdy właściwość nie ma dekoratora
`@convert`.

- `value` - surowa wartość właściwości.
- `propertyName` - nazwa właściwości tak, jak jest udostępniona bindingom.
- `vm` - instancja ViewModel (lub obiekt), która deklaruje konwerter.
- Zwraca skonwertowaną wartość albo wartość wejściową, gdy nie ma
  stosownego konwetera.

### `convertToViewModel`

```ts
function convertToViewModel(value: unknown, propertyName: string, vm: object): unknown;
```

Przepuszcza wartość przez konwerter przyłączony do właściwości (kierunek
View → ViewModel). Zwraca wartość bez zmian, gdy właściwość nie ma dekoratora
`@convert` albo gdy konwerter nie implementuje `convertBack`.

- `value` - surowa wartość odczytana z DOM.
- `propertyName` - nazwa właściwości tak, jak jest udostępniona bindingom.
- `vm` - instancja ViewModel (lub obiekt), która deklaruje konwerter.
- Zwraca skonwertowaną wartość albo wartość wejściową, gdy nie ma
  stosownej konwersji.

## view

Zawartość publiczna modułu: interfejs `IView`, interfejs `IViewOptions`,
klasa `View`.

### `IView`

Wyrenderowana instancja szablonu: węzły DOM, które posiada, kontekst danych,
do którego jest związany, oraz jego cykl życia.

- **`id: number | null`** (readonly)
  Unikalne id widoku albo `null`, gdy nieprzypisane.
- **`viewNodeList: ChildNode[]`** (readonly)
  Wszystkie węzły DOM widoku, łącznie z zamontowanymi dziećmi strukturalnymi.
- **`name: string`**
  Nazwa widoku (domyślnie pusty ciąg).
- **`ownsDataContext: boolean`**
  Czy widok posiada (i zwalnia przy zwalnianiu) swój kontekst danych.
- **`dataContext: IBindingContext | undefined`** (readonly)
  Powiązany kontekst danych, jeśli jest.
- **`detach(): void`**
  Usuwa wszystkie węzły widoku z DOM (bez zwalniania).
- **`dispose(): void`**
  Odczepia węzły, zwalnia wszystkie bindy oraz - gdy posiada - kontekst
  danych.
- **`isDisposed: boolean`** (readonly) - czy widok został zwolniony.

### `IViewOptions`

Opcje konstruktora `View`.

- **`ownsDataContext?: boolean`**
  Czy widok posiada (i zwalnia przy zwalnianiu) przekazany kontekst danych.
  Domyślnie `true`, co zachowuje domyślne zachowanie. Dla wspólnego modelu
  ustaw `false` i sprzątaj model u jego właściciela.

### `View`

Konkretne `IView`: renderuje szablon do węzłów DOM i łączy deklaracje
`data-bind`, `data-command` i `data-validate-error` z kontekstem danych.

Widok subskrybuje zmiany właściwości i stanu walidacji kontekstu danych oraz
aktualizuje powiązany DOM; zmiany elementów są propagowane z powrotem
(chyba że tryb bindingu jest jednokierunkowy). Bindy strukturalne (`if`,
`collection`) montują i demontują widoki dzieci przez fragmenty `BindingFragment`.

- **`id: number | null`** (readonly)
  Unikalne id widoku albo `null`, gdy nieprzypisane.
- **`ownsDataContext: boolean`**
  Czy widok posiada (i zwalnia przy zwalnianiu) swój kontekst danych.
- **`dataContext: IBindingContext | undefined`** (readonly, getter)
  Powiązany kontekst danych, jeśli jest.
- **`viewNodeList: ChildNode[]`** (readonly, getter)
  Wszystkie węzły DOM widoku, łącznie z zamontowanymi dziećmi strukturalnymi.
- **`name: string`**
  Nazwa widoku (domyślnie pusty ciąg).
- **`isDisposed: boolean`** (readonly, getter) - czy widok został zwolniony.
- **`constructor(template: HTMLElement, context?: IBindingContext, id?: number, options?: IViewOptions)`**
  `template` - element szablonu (albo dowolny element, którego zawartość
  jest używana) do renderowania;
  `context` - kontekst danych do powiązania, jeśli jest;
  `id` - opcjonalne unikalne id widoku;
  `options` - opcjonalne opcje konstruktora.
  @throws {TypeError} gdy `template` nie jest `HTMLElement`.
- **`detach(): void`**
  Usuwa wszystkie węzły widoku z DOM (bez zwalniania).
- **`dispose(): void`**
  Odczepia węzły, zwalnia wszystkie bindy, fragmenty i koordynatory komend
  oraz - gdy `ownsDataContext` - zwalnia kontekst danych. Idempotentne.

## viewFactory

Zawartość publiczna modułu: interfejs `IViewFactory`, klasa `ViewFactory`.

### `IViewFactory`

Tworzy `View` ze szablonów.

- **`getView(template: HTMLElement, dataContext?: IBindingContext, options?: IViewOptions): IView`**
  Tworzy widok z jawnego elementu szablonu.
- **`getViewById(id: string, dataContext?: IBindingContext, options?: IViewOptions): IView`**
  Tworzy widok ze szablonu o podanym `id`.
- **`getTemplateById(id: string): HTMLElement`**
  Zwraca element szablonu o podanym `id`.

### `ViewFactory`

Domyślna `IViewFactory`: rozwiązuje szablony według `id` z dokumentu.

- **`getView(template: HTMLElement, dataContext?: IBindingContext, options?: IViewOptions): View`**
  Tworzy widok z jawnego elementu szablonu.
  `template` - element szablonu do renderowania;
  `dataContext` - kontekst danych do powiązania, jeśli jest;
  `options` - opcjonalne opcje konstruktora.
  Zwraca utworzony widok.
- **`getViewById(id: string, dataContext?: IBindingContext, options?: IViewOptions): View`**
  Tworzy widok ze szablonu o podanym `id`.
  `id` - `id` elementu szablonu w dokumentzie;
  `dataContext` - kontekst danych do powiązania, jeśli jest;
  `options` - opcjonalne opcje konstruktora.
  Zwraca utworzony widok.
  @throws {Error} gdy nie istnieje szablon o `id`.
  @throws {TypeError} gdy element o `id` nie jest `HTMLElement`.
- **`getTemplateById(id: string): HTMLElement`**
  Zwraca element szablonu o podanym `id`.
  `id` - `id` elementu szablonu w dokumentzie.
  Zwraca element szablonu.
  @throws {Error} gdy nie istnieje element o `id`.
  @throws {TypeError} gdy element o `id` nie jest `HTMLElement`.

## viewListController

Zawartość publiczna modułu: typ `ViewListPlace`, klasa `ViewListController`.

### `ViewListPlace`

Umiejscowienie wyrenderowanej listy wewnątrz elementu hosta.

```ts
type ViewListPlace = 'start' | 'end';
```

### `ViewListController`

Kontroler listy widoków/elementów wewnątrz elementu hosta.

Semantyka: pojednanie oparte o migawkę (snapshot). Po każdej zmianie źródła
renderowana jest BIEŻĄCA migawka kolekcji, a kontroler oblicza minimalną
liczbę operacji wstawiania/usuwania/przesuwania względem bieżącego DOM
(tożsamość pozycji = tożsamość referencji).

Zasada własności: kontroler pożycza widoki - odczepia DOM, ale NIE niszcz
widoków.

- **`place: ViewListPlace`**
  Miejsce listy wewnątrz hosta: `'start'` albo `'end'`.
- **`constructor(host: HTMLElement, place?: ViewListPlace)`**
  `host` - element, który otrzymuje wyrenderowane elementy listy;
  `place` - gdzie lista jest umieszczana wewnątrz hosta (domyślnie `'end'`).
- **`setSource(source: unknown[] | ArrayObserver<unknown> | undefined): void`**
  Przyłącza źródło (zwykłą tablicę albo `ArrayObserver`) i renderuje
  bieżącą migawkę. Obserwacja następuje PRZED renderowaniem (bezpieczeństwo
  przed wejrzeniem rekurencyjnym - zmiana źródła podczas renderowania nie
  jest gubiona).
  `source` - nowe źródło; `undefined` czyści listę.
- **`refresh(): void`**
  Ponownie renderuje bieżącą migawkę źródła.
- **`dispose(): void`**
  Zwalnia źródło i odczepia wszystkie elementy z hosta (widoki NIE są
  niszczone - zasada własności). Idempotentne.
- **`static longestCommonSubsequence(a: unknown[], b: unknown[]): number[]`**
  Najdłuższa wspólna podciąg (tożsamość referencji) - zwraca indeksy
  elementów `a`, które zachowują swoją względną kolejność w `b`.
  `a` - pierwsza lista (bieżący stan DOM);
  `b` - druga lista (pożądany stan).
  Zwraca indeksy `a` tworzące wspólny podciąg, w kolejności.

## viewModel

Zawartość publiczna modułu: interfejs `IBindingContext`, interfejs `IViewModel`,
klasa `ViewModelDisposalError` oraz klasa `ViewModel`.

### `IBindingContext`

Umowa po stronie bindingu, której View używa do komunikacji z ViewModel:
dostęp do właściwości, subskrypcje zmian/walidacji, komendy i zwalnianie.

- **`getPropertyValue(name: string): unknown`**
  Zwraca wartość zarejestrowanej właściwości.
  `name` - nazwa właściwości; `undefined` dla niezarejestrowanej.
- **`setPropertyValue(name: string, value: unknown, callbackExecute?: boolean): void`**
  Ustawia wartość właściwości bez wyzwolenia `property-change`.
  Najpierw uruchamia zarejestrowane walidatory, potem callback zmiany.
  `callbackExecute` - czy uruchomić callback zmiany (domyślnie `true`).
- **`setPropertyValueFromView?(name: string, value: unknown): void`**
  Zapis wartości zainicjowany z widoku, używany przez dwustronne bindingi.
  `name` - nazwa właściwości; `value` - nowa wartość odczytana z DOM.
  (Opcjonalna w interfejsie; klasa `ViewModel` ją implementuje.)
- **`subscribeProperties(eventCallback: (event: Event) => void): void`**
  Subskrybuje zdarzenia `property-change`.
- **`unsubscribeProperties(eventCallback: (event: Event) => void): void`**
  Usuwa subskrypcję zarejestrowaną przez `subscribeProperties`.
- **`subscribeValidationState(eventCallback: (event: Event) => void): void`**
  Subskrybuje zdarzenia `error-change` walidacji.
- **`unsubscribeValidationState(eventCallback: (event: Event) => void): void`**
  Usuwa subskrypcję zarejestrowaną przez `subscribeValidationState`.
- **`subscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Subskrybuje zdarzenia `error-reset` walidacji.
- **`unsubscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Usuwa subskrypcję zarejestrowaną przez `subscribeValidationReset`.
- **`getCommand(name: string): ICommand | undefined`**
  Zwraca komendę zarejestrowaną pod podaną nazwą albo `undefined`.
- **`subscribeCommands?(callback: (name: string) => void): () => void`**
  Subskrybuje zmiany rejestracji komend; callback jest wywoływany przy każdej
  rejestracji i odrejestrowaniu komendy.
  Zwraca funkcję usuwającą tę subskrypcję.
- **`subscribeContextChanges?(callback: () => void): () => void`**
  Subskrybuje zmiany kontekstu (View odświeża dzięki temu bindingi).
  Zwraca funkcję usuwającą tę subskrypcję.
- **`validateProperty(name: string): void`**
  Waliduje właściwość względem jej zarejestrowanych walidatorów i
  publikuje wynikowy stan. Bezczynne, gdy właściwość nie ma walidatorów.
- **`getPropertyValidationState?(name: string): PropertyValidationState`**
  Zwraca migawkę stanu walidacji właściwości (patrz
  `PropertyValidationState` niżej).
- **`dispose(): void`**
  Zwalnia zasoby ViewModel.

### `IViewModel`

Pełna umowa ViewModel: wszystko z `IBindingContext` plus API rejestracji,
powiadamiania i walidacji po stronie modelu.

Oprócz członków odziedziczonych z `IBindingContext` dodaje:

- **`notifyPropertyChanged(propertyName: string, value: unknown): void`**
  Wyzwala zdarzenie `property-change` niosące podaną wartość.
  Powiadomienie jest tłumione, gdy właściwość jest zapisywana z widoku
  (po ustaleniu zapisu publikowane jest pojedyncze powiadomienie).
- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Aktualizuje stan walidacji właściwości i wyzwala zdarzenie `error-change`.
  Dla stanów ważnych komunikat błędu jest czyszczony.
- **`setPropertyValueAndNotify(name: string, value: unknown): void`**
  Ustawia wartość właściwości i wyzwala zdarzenie `property-change`.
- **`registerProperty(name: string, value?: unknown, changeCallback?: (value: unknown) => void): void`**
  Rejestruje reaktywną właściwość pod nazwą.
  `changeCallback` - opcjonalny callback wykonywany po walidacji przy zapisie
  z `callbackExecute = true`, nie podczas rejestracji. Zapis z widoku pomija
  wartości równe według `Object.is`; `setPropertyValue` nie pomija takich zapisów.
  Przypisanie dekorowanego akcesora nie uruchamia callbacku.
- **`unregisterProperty(name: string): void`**
  Usuwa właściwość z rejestru. Walidatory i stan walidacji zarejestrowane
  dla właściwości pozostają nietknięte.
- **`hasRegisteredProperty(name: string): boolean`**
  Zwraca `true`, gdy właściwość jest zarejestrowana.
- **`registerCommand(name: string, command: ICommand): void`**
  Zmienia rejestr, powiadamia wszystkich listenerów z migawki, następnie rzuca pierwszy pierwotny błąd. Powiadomienia zagnieżdżone są synchroniczne; błędy nie cofają zmiany.
  Rejestruje komendę i powiadamia nasłuchiwaczy komend.
- **`unregisterCommand(name: string): void`**
  Zmienia rejestr, powiadamia wszystkich listenerów z migawki, następnie rzuca pierwszy pierwotny błąd. Powiadomienia zagnieżdżone są synchroniczne; błędy nie cofają zmiany.
  Odrejestrowuje komendę i powiadamia nasłuchiwaczy komend.
- **`registerProperties(properties: { [propertyName: string]: unknown }): void`**
  Rejestruje wiele właściwości z literalu obiektu.
- **`hasPropertyValidator(name: string): boolean`**
  Zwraca `true`, gdy właściwość ma zarejestrowane walidatory.
- **`registerPropertyValidator(name: string, validators: IViewModelValidator[]): void`**
  Rejestruje walidatory właściwości, scalając z ewentualnie już
  zarejestrowanymi.
- **`unregisterPropertyValidator(name: string): void`**
  Usuwa wszystkie walidatory właściwości. Gdy właściwość była zwalidowana,
  jej stan walidacji jest resetowany.
- **`setPropertyValidationState(name: string, isValid: boolean, message?: string): void`**
  Ustawia stan walidacji właściwości i wyzwala zdarzenie `error-change`
  (alias `notifyValidationStateChanged`).
- **`resetPropertyValidationState(name: string): void`**
  Usuwa zapisany stan walidacji właściwości i wyzwala zdarzenie `error-reset`.
- **`validate(): boolean`**
  Waliduje wszystkie właściwości mające zarejestrowane walidatory.
  Zwraca `true`, gdy wszystkie zwalidowane właściwości są ważne.
- **`isPropertyValid(name: string): boolean`**
  Zwraca `true`, gdy właściwość jest obecnie ważna (lub nigdy
  nie była walidowana).
- **`getPropertyValidationMessage(name: string): string | undefined`**
  Zwraca ostatni komunikat błędu walidacji właściwości albo `undefined`,
  gdy właściwość jest ważna albo nigdy nie była walidowana.
- **`hasPropertyBeenValidated(name: string): boolean`**
  Zwraca `true`, gdy właściwość została przynajmniej raz zwalidowana.
- **`getPropertyValidationState(name: string): PropertyValidationState`**
  Zwraca migawkę stanu walidacji właściwości; gdy brak zapisanego stanu,
  zwraca stan domyślny (ważne, bez komunikatu, niewalidowane).

Interfejs ponownie deklaruje również `validateProperty` i `dispose`
z `IBindingContext` z tymi samymi sygnaturami.

### `PropertyValidationState` (typ wewnętrzny)

Nie jest eksportowany z modułu; referowany strukturalnie przez sygnatury
`IBindingContext` i `IViewModel`.

```ts
type PropertyValidationState = {
    isValid: boolean;
    message?: string;
    validated: boolean;
};
```

- `isValid` - czy wartość jest ważna.
- `message` - komunikat błędu (dla stanu nieważnego).
- `validated` - czy właściwość została przynajmniej raz zwalidowana.

### `ViewModelDisposalError`

Rzucana, gdy podczas `ViewModel.dispose` zawiedzie któryś z nasłuchiwaczy
komend. Wszystkie zasoby są już zwolnione, gdy wyjątek jest rzucany;
poszczególne błędy nasłuchiwaczy są dostępne w `errors`.

- **`errors: readonly unknown[]`** (readonly)
  Wyjątki rzucone przez nasłuchiwaczy komend podczas zwalniania.
- **`constructor(errors: unknown[])`**

### `ViewModel`

Bazowy ViewModel: nazwany rejestr właściwości z powiadomieniami o zmianach,
stanami walidacji, rejestrem komend i deterministycznym zwalnianiem zasobów.
Implementuje `IViewModel` i `IBindingContext`; konstruktor nie przyjmuje
argumentów.

Członki chronione (dla podklas):

- **`propertyChange: IPropertyChangeEventTarget`**
  Cel zdarzeń wyzwolający zdarzenia `property-change`.
- **`validationStateChanged: IValidationStateChangeEventTarget`**
  Cel zdarzeń wyzwolający zdarzenia `error-change` walidacji.
- **`validationStateReset: IValidationStateResetEventTarget`**
  Cel zdarzeń wyzwolający zdarzenia `error-reset` walidacji.
- **`properties: { [prop: string]: ViewModelProperty }`**
  Rejestr reaktywnych właściwości. `ViewModelProperty` to typ wewnętrzny:
  `{ value: unknown; changeCallback?: (value: unknown, propertyKey: string) => void }`.
- **`commands: { [command: string]: ICommand }`**
  Rejestr zarejestrowanych komend.
- **`validators: { [prop: string]: PropertyValidationEntry }`**
  Rejestr walidatorów per właściwość. `PropertyValidationEntry` to typ
  wewnętrzny: `{ validators: Set<IViewModelValidator> }`.
- **`validationStates: { [prop: string]: PropertyValidationState }`**
  Rejestr stanów walidacji per właściwość.

Metody:

- **`notifyPropertyChanged(propertyName: string, value: unknown): void`**
  Wyzwala zdarzenie `property-change` niosące podaną wartość.
- **`notifyValidationStateChanged(propertyName: string, isValid: boolean, message?: string): void`**
  Aktualizuje stan walidacji właściwości i wyzwala zdarzenie `error-change`;
  dla stanów ważnych komunikat błędu jest czyszczony.
- **`setPropertyValue(name: string, value: unknown, callbackExecute?: boolean): boolean`**
  Ustawia wartość właściwości bez wyzwolenia `property-change`; najpierw
  uruchamia zarejestrowane walidatory, potem callback zmiany.
  `callbackExecute` - czy uruchomić callback zmiany (domyślnie `true`).
  Zwraca `true`, gdy właściwość istnieje, inaczej `false`.
- **`setPropertyValueAndNotify(name: string, value: unknown, callbackExecute?: boolean): void`**
  Obie metody zapisu z powiadomieniem publikują zachowaną wartość końcową po wyjątku walidatora/callbacku, następnie rzucają pierwotny błąd. Zapisy z View zachowują Object.is i scalanie zapisów zagnieżdżonych. Zwolnienie modelu lub usunięcie/ponowna rejestracja property anuluje powiadomienie końcowe. setPropertyValue pozostaje ciche. Zobacz [callback property](guide.md#32-callback-property).
  Ustawia wartość właściwości i wyzwala zdarzenie `property-change`.
  `callbackExecute` - czy uruchomić callback zmiany (domyślnie `false`).
- **`setPropertyValueFromView(name: string, value: unknown): void`**
  Zapis wartości zainicjowany z widoku, używany przez dwustronne bindingi.
  Po zakończeniu callbacków publikowane jest pojedyncze zdarzenie
  `property-change` z wartością końcową; bezczynne, gdy wartość się nie
  zmieniła.
  @throws {Error} gdy właściwość nie jest zarejestrowana.
- **`getPropertyValue(name: string): unknown`**
  Zwraca wartość właściwości albo `undefined`, gdy właściwość nie istnieje.
- **`subscribeProperties(eventCallback: (event: Event) => void): void`**
  Subskrybuje zdarzenia `property-change`.
- **`unsubscribeProperties(eventCallback: (event: Event) => void): void`**
  Usuwa subskrypcję zdarzeń `property-change`.
- **`subscribeValidationState(eventCallback: (event: Event) => void): void`**
  Subskrybuje zdarzenia `error-change` walidacji.
- **`unsubscribeValidationState(eventCallback: (event: Event) => void): void`**
  Usuwa subskrypcję zdarzeń `error-change` walidacji.
- **`subscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Subskrybuje zdarzenia `error-reset` walidacji.
- **`unsubscribeValidationReset(eventCallback: (event: Event) => void): void`**
  Usuwa subskrypcję zdarzeń `error-reset` walidacji.
- **`getCommand(name: string): ICommand | undefined`**
  Zwraca komendę zarejestrowaną pod podaną nazwą albo `undefined`.
- **`subscribeCommands(callback: (name: string) => void): () => void`**
  Subskrybuje zmiany rejestracji komend; callback jest wywoływany przy każdej
  rejestracji i odrejestrowaniu komendy.
  Zwraca funkcję usuwającą tę subskrypcję.
- **`registerProperty(name: string, value?: unknown, changeCallback?: (value: unknown) => void): void`**
  Rejestruje reaktywną właściwość pod nazwą.
  `changeCallback` - opcjonalny callback wykonywany po walidacji przy zapisie
  z `callbackExecute = true`, nie podczas rejestracji. Zapis z widoku pomija
  wartości równe według `Object.is`; `setPropertyValue` nie pomija takich zapisów.
  Przypisanie dekorowanego akcesora nie uruchamia callbacku.
- **`hasRegisteredProperty(name: string): boolean`**
  Zwraca `true`, gdy właściwość jest zarejestrowana.
- **`registerProperties(properties: { [propertyName: string]: unknown }): void`**
  Rejestruje wiele właściwości z literalu obiektu.
- **`unregisterProperty(name: string): void`**
  Usuwa właściwość z rejestru; walidatory i stan walidacji pozostają
  nietknięte.
- **`registerCommand(name: string, command: ICommand): void`**
  Zmienia rejestr, powiadamia wszystkich listenerów z migawki, następnie rzuca pierwszy pierwotny błąd. Powiadomienia zagnieżdżone są synchroniczne; błędy nie cofają zmiany.
  Rejestruje komendę i powiadamia nasłuchiwaczy komend.
- **`unregisterCommand(name: string): void`**
  Zmienia rejestr, powiadamia wszystkich listenerów z migawki, następnie rzuca pierwszy pierwotny błąd. Powiadomienia zagnieżdżone są synchroniczne; błędy nie cofają zmiany.
  Odrejestrowuje komendę i powiadamia nasłuchiwaczy komend.
- **`hasPropertyValidator(name: string): boolean`**
  Zwraca `true`, gdy właściwość ma zarejestrowane walidatory.
- **`registerPropertyValidator(name: string, validators: IViewModelValidator[]): void`**
  Rejestruje walidatory właściwości, scalając z ewentualnie już
  zarejestrowanymi.
- **`unregisterPropertyValidator(name: string): void`**
  Usuwa wszystkie walidatory właściwości; gdy właściwość była zwalidowana,
  jej stan walidacji jest resetowany.
- **`validateProperty(name: string): void`**
  Waliduje właściwość względem jej zarejestrowanych walidatorów i publikuje
  wynikowy stan; bezczynne, gdy właściwość nie ma walidatorów.
- **`setPropertyValidationState(name: string, isValid: boolean, message?: string): void`**
  Ustawia stan walidacji właściwości i wyzwala zdarzenie `error-change`
  (alias `notifyValidationStateChanged`).
- **`resetPropertyValidationState(name: string): void`**
  Usuwa zapisany stan walidacji właściwości i wyzwala zdarzenie `error-reset`.
- **`validate(): boolean`**
  Waliduje wszystkie właściwości mające zarejestrowane walidatory.
  Zwraca `true`, gdy wszystkie zwalidowane właściwości są ważne.
- **`dispose(): void`**
  Zwalnia wszystkie zasoby: właściwości, komendy, walidatory, stany walidacji
  i cele zdarzeń są czyszczone, a nasłuchiwacze komend powiadamiani o każdej
  odrejestrowanej komendzie. Idempotentne.
  @throws {ViewModelDisposalError} gdy podczas zwalniania rzuca wyjątek
  któryś z nasłuchiwaczy komend (zasoby są już zwolnione).
- **`isPropertyValid(name: string): boolean`**
  Zwraca `true`, gdy właściwość jest obecnie ważna; właściwość jeszcze
  nie walidowana jest traktowana jako ważna.
- **`getPropertyValidationMessage(name: string): string | undefined`**
  Zwraca ostatni komunikat błędu walidacji właściwości albo `undefined`,
  gdy właściwość jest ważna albo nigdy nie była walidowana.
- **`hasPropertyBeenValidated(name: string): boolean`**
  Zwraca `true`, gdy właściwość została przynajmniej raz zwalidowana.
- **`getPropertyValidationState(name: string): PropertyValidationState`**
  Zwraca migawkę stanu walidacji właściwości; gdy brak zapisanego stanu,
  zwraca stan domyślny (ważne, bez komunikatu, niewalidowane).

## viewModelFactoryBase

Zawartość publiczna modułu: interfejs `IViewModelFactoryBase` oraz
abstrakcyjna klasa `ViewModelFactoryBase`.

### `IViewModelFactoryBase`

Umowa dla fabryki tworzącej instancje `IViewModel` według nazwy.

- **`getViewModel(viewModelName: string, ...args: any[]): IViewModel`**
  Tworzy instancję ViewModel według nazwy.
  `viewModelName` - klucz żądanego ViewModel w mapie handlerów;
  `args` - argumenty przekazywane do konstruktora ViewModel.
  Zwraca utworzoną instancję ViewModel.
  @throws {Error} gdy nazwa nie istnieje w mapie handlerów albo gdy
  konstruktor rzuca wyjątek.

### `ViewModelFactoryBase`

Abstrakcyjna klasa bazowa fabryki ViewModel opartej o nazwy. Podklasy
dostarczają mapę nazwa→konstruktor przez metodę `getViewModelHandler()`.

- **`protected abstract getViewModelHandler(): ViewModelHandlerMap`**
  Zwraca mapę nazw ViewModel do konstruktorów.
  `ViewModelHandlerMap` to typ wewnętrzny: `Record<string, ViewModelConstructor>`,
  gdzie `ViewModelConstructor` to `new (...args: any[]) => IViewModel`.
- **`getViewModel(viewModelName: string, ...args: any[]): IViewModel`**
  Tworzy instancję ViewModel według nazwy, przekazując `args`
  do konstruktora.
  @throws {Error} gdy nazwa nie istnieje w mapie handlerów albo gdy
  konstruktor rzuca wyjątek (oryginalny błąd jest raportowany wewnątrz
  komunikatu wyjątku).

## viewModelValidator

Zawartość publiczna modułu: interfejs `IViewModelValidator`.

### `IViewModelValidator`

Waliduje pojedynczą wartość właściwości ViewModel.

Walidatory są przyłączane do właściwości dekoratorem `@validate`.

- **`isValid(value: unknown): boolean`**
  Sprawdza, czy wartość jest ważna. `value` - wartość do zwalidowania.
  Zwraca `true`, gdy wartość jest ważna.
- **`getMessage?(value: unknown): string`**
  Opcjonalnie zwraca komunikat błędu dla nieważnej wartości; gdy brak,
  stan walidacji nie niesie komunikatu. `value` - wartość, która nie
  przeszła walidacji. Zwraca komunikat błędu.

## optionsBinding

Zawartość publiczna modułu: interfejs `IOptionValue` oraz klasa `OptionValue`.

Uwaga: moduł zawiera ponadto klasę `OptionsBinding` (eksport domyślny;
specjalizacja `Binding` wiążąca opcje elementu `select` z tablicą wartości
`IOptionValue`), jednak `src/index.ts` eksportuje tylko `IOptionValue` i
`OptionValue` - klasa `OptionsBinding` jest szczegółem wewnętrznym
implementacji i nie wchodzi w publiczny interfejs pakietu.

### `IOptionValue`

Wartość, etykieta i stan zaznaczenia jednej opcji elementu `select`.

- **`value: string`** - wartość opcji.
- **`label: string`** - etykieta (tekst wyświetlany) opcji.
- **`isSelected: boolean`** - czy opcja jest zaznaczona.

### `OptionValue`

Konkretna implementacja interfejsu `IOptionValue`.

- **`constructor(value: string, label: string, isSelected: boolean)`**
  `value` - wartość opcji; `label` - etykieta opcji; `isSelected` -
  początkowy stan zaznaczenia.
- **`value: string`**, **`label: string`**, **`isSelected: boolean`**
  Właściwości jak w `IOptionValue`.
