# MVVM - podręcznik użytkownika

Ten dokument opisuje bibliotekę `mvvm-dom`.
Obejmuje nie tylko składnię `data-bind`, `data-command` i `data-validate-error`,
ale również pełny przepływ danych, tworzenie widoków, walidacje, listy
dynamiczne, cykl życia obiektów oraz zasady zapobiegania wyciekom pamięci.



### Dokumentacja towarzysząca

- [Referencja API](api.md).
- [Tworzenie własnych bindingów](custom-bindings.md).
- [Instalacja i uruchamianie testów](testing.md).
- [Licencja MIT biblioteki](../LICENSE).

Przykłady z urwanym kontekstem (np. sama metoda klasy) są fragmentami do
wstawienia w odpowiednie miejsce. Importy pochodzą z pakietu `mvvm-dom`.

### Wymagania i importy
Biblioteka nie wymaga zewnętrznych zależności.
Nie dostarcza implementacji walidatorów ani nie wymaga
zewnętrznej biblioteki walidacyjnej.

Dekoratory używają standardowej składni ECMAScript (TypeScript 5.2 lub
nowszy). Własności reaktywne muszą być deklarowane jako auto-accessory:

```ts
@propertyChange()
accessor name = 'Anna';
```

Opcja `experimentalDecorators` nie może być włączona, ponieważ wybiera niezgodny,
starszy protokół dekoratorów. Dekoratory korzystają z metadanych ECMAScript;
nie wymagają `reflect-metadata` ani `emitDecoratorMetadata`. Widoki wymagają
przeglądarkowego DOM; bindingi rozmiarów i atrybutów w kierunku View →
ViewModel wymagają odpowiednio `ResizeObserver` i `MutationObserver`.

## 1. Model mentalny

Biblioteka składa się z czterech głównych elementów:

```text
template HTML
  |
  | data-bind / data-command / data-validate-error
  v
View
  |
  | subskrybuje zmiany i tworzy elementy obsługi
  v
Binding / EventCommandBinding / ValidationErrorBinding
  |
  v
ViewModel
  |
  | properties, commands, validators, eventy
  v
stan aplikacji i logika biznesowa
```

### ViewModel

`ViewModel` przechowuje stan i logikę. Nie powinien bezpośrednio manipulować
DOM-em. Zmiany stanu publikuje przez event `property-change`, a komendy są
udostępniane pod nazwami.

### View

`View` importuje template, wyszukuje atrybuty `data-*`, tworzy odpowiednie
obiekty obsługujące bindy i commandy, a następnie łączy je z `ViewModel`.

`View` przechowuje również listę swoich węzłów w `viewNodeList`. Dzięki temu
widok może być wstawiany do różnych kontenerów bez tworzenia go ponownie.

### Elementy infrastruktury

- `Binding` synchronizuje konkretną własność z elementem DOM.
- `EventCommandBinding` zamienia zdarzenie DOM na nazwaną komendę.
- `ValidationErrorBinding` prezentuje stan i komunikat walidacji.
- `ArrayObserver` publikuje zmiany tablicy.
- `CollectionObserver` obserwuje kolekcje danych oraz obiekty dostępne przez nią.
- `CompositeDisposable` przechowuje operacje sprzątające.
- `ViewFactory` tworzy instancje `View` z template i dataContext.
- `ViewModelFactoryBase` abstrakcyjna fabryka instancji ViewModel wybieranych po nazwie.

## 2. Minimalny przepływ

Typowy przypadek wygląda tak:

```ts
import { View } from 'mvvm-dom';
import { ViewModel } from 'mvvm-dom';

class UserFormViewModel extends ViewModel {
  constructor() {
    super();
    this.registerProperty('name', 'Anna');
  }
}

const viewModel = new UserFormViewModel();
const source = document.getElementById('userFormTemplate');
if (!(source instanceof HTMLElement)) throw new Error('Brak szablonu userFormTemplate');
const view = new View(source, viewModel);

document.body.append(...view.viewNodeList);
```

Przed wykonaniem kodu umieścić w dokumencie:

```html
<template id="userFormTemplate">
  <input data-bind="{value: name, mode: twoWay, triggerType: input}">
</template>
```

Po zakończeniu użycia wywołaj `view.detach()`, a następnie `view.dispose()`.
Domyślnie dispose widoku niszczy także jego ViewModel (sekcja 12).

Konstruktor `View` przyjmuje:

```ts
constructor(
  template: HTMLElement,
  context?: IBindingContext,
  id?: number,
  options?: IViewOptions
)
```

`IViewOptions.ownsDataContext` (domyślnie `true`) steruje, czy `dispose()`
niszczy przekazany dataContext - to samo, co pole `ownsDataContext`.

- `template` - element `<template>` lub inny `HTMLElement`, a nie jego ID ani tekst HTML.
- `context` - opcjonalny `ViewModel` (dataContext).
- `id` - opcjonalny identyfikator widoku (domyślnie `null`).

`View` ma także publiczne pole `name: string` (domyślnie `''`).

Widok klonuje zawartość `<template>` lub cały przekazany element. Nie wyszukuje źródła w dokumencie i nie parsuje tekstu HTML. `viewNodeList` zachowuje również tekst, odstępy i komentarze na poziomie korzenia. Dla korzeniowego `if` zawiera również
kotwicę warunku i aktualnie zamontowaną gałąź. Pobieraj `view.viewNodeList`
bezpośrednio przed dołączeniem widoku.

Kolejność działania konstruktora `View` jest następująca:

1. Zapisywany jest `dataContext`, czyli przekazany `ViewModel`.
2. Template jest klonowany przez `document.importNode`.
3. `View` subskrybuje `property-change`, `error-change` i `error-reset`.
4. Elementy z bindingami strukturalnymi, np. `if` i `collection`, są wydzielane jako osobne szablony.
5. View przygotowuje zwykłe bindingi, walidację, a następnie komendy.
6. Bindingi strukturalne otrzymują bieżące wartości modelu i zarządzają swoimi fragmentami.

Po utworzeniu widoku wartość może popłynąć w dwie strony:

```text
ViewModel property
  -> property-change
  -> View.propertyChange
  -> Binding.setValue
  -> DOM

DOM event
  -> Binding / EventCommandBinding
  -> View
  -> ViewModel.setPropertyValueFromView albo ICommand.execute
```

## 3. ViewModel

### 3.1 Rejestrowanie property

Property można zarejestrować ręcznie:

```ts
export class UserViewModel extends ViewModel {
  constructor() {
    super();

    this.registerProperty('name', '');
    this.registerProperty('isActive', false);
  }
}
```

Odczyt i zapis przez API:

```ts
const name = viewModel.getPropertyValue('name');

viewModel.setPropertyValue('name', 'Anna');
viewModel.setPropertyValueAndNotify('name', 'Anna');
```

Różnica:

- `setPropertyValue` ustawia wartość i opcjonalnie uruchamia callback property,
  ale nie emituje `property-change`; jeżeli dla property zarejestrowane są
  walidatory, wywołuje także `validateProperty`;
- `setPropertyValueAndNotify` ustawia wartość, a następnie emituje zmianę do View;
- trzeci parametr `callbackExecute` domyślnie ma wartość `false` w
  `setPropertyValueAndNotify`.

W praktyce do odświeżenia widoku najczęściej używa się:

```ts
this.setPropertyValueAndNotify('name', newName);
```

Zmiana z DOM po konwersji trafia do `setPropertyValueFromView`. Dla zmienionej
wartości model zapisuje pole, waliduje je, wykonuje callback i rozsyła końcową
wartość do wszystkich widoków. Powtórzenie tej samej wartości według `Object.is`
pomija zapis. Kontrolka źródłowa zachowuje kursor. Jeśli callback normalizuje
dane, również ta kontrolka otrzymuje poprawioną wartość. Powiadomienia tego
samego pola podczas callbacku są scalane. Komenda zdarzenia widzi wynik zapisu.
Własny kontekst implementujący `IBindingContext` może dodać tę metodę.
Starsze konteksty korzystają z dotychczasowego `setPropertyValue`.
`setPropertyValue` i `setPropertyValueAndNotify` nie rejestrują brakującej property;
najpierw użyj `registerProperty` albo inicjalizatora dekorowanego pola. Metody te
nie pomijają też zmian o tej samej wartości.

### 3.2 Callback property

Property może mieć callback wykonywany przez `setPropertyValue`:

```ts
this.registerProperty(
  'scrollTopList',
  0,
  this.scrollChange.bind(this)
);
```

Nie używaj callbacku jako zamiennika `property-change`. Callback może służyć
do lokalnej reakcji ViewModelu, a `setPropertyValueAndNotify` jest mechanizmem
komunikacji z View.

**Ważne:** Callback jest wywoływany tylko wtedy, gdy `setPropertyValue` został
wywołany z `callbackExecute = true` (domyślnie). Dekoratory `@propertyChange` i
`@validate` używają `setPropertyValueAndNotify`, które domyślnie przekazuje
`callbackExecute = false`, więc callback zarejestrowany przez dekorator
**nie zostaje wywołany** przy ustawianiu property przez setter.
Zostaje natomiast wywołany przy zapisie z View - `setPropertyValueFromView`
przekazuje `callbackExecute = true`. To celowe rozdzielenie: callback służyć
ma jako hook na zmiany przychodzące z View/DOM (np. `ResizeObserver`), a nie
na każdy programowy zapis z kodu.

Przykład dla zarejestrowanego dekorowanego akcesora `width` z callbackiem:

```ts
this.width = 100;                               // bez callbacku
this.setPropertyValue('width', 100);             // callback, nawet dla tej samej wartości
this.setPropertyValueAndNotify('width', 100);    // bez callbacku
this.setPropertyValueAndNotify('width', 100, true); // callback
this.setPropertyValueFromView('width', 120);     // callback, bo wartość się zmieniła
this.setPropertyValueFromView('width', 120);     // bez zapisu i callbacku (Object.is)
```

Reguła dotyczy `@propertyChange`, `@validate` i `@propertyAlias`.
Inicjalizacja nie wywołuje callbacku. Callback nie jest subskrypcją wszystkich
powiadomień `property-change`.

### 3.3 Eventy ViewModelu

ViewModel udostępnia:

- `subscribeProperties` / `unsubscribeProperties`;
- `subscribeValidationState` / `unsubscribeValidationState`;
- `subscribeValidationReset` / `unsubscribeValidationReset`.

Każdy ręcznie dodany listener musi być później odpięty z tą samą referencją
funkcji:

```ts
const callback = (event: Event) => {
  // reakcja
};

viewModel.subscribeProperties(callback);
viewModel.unsubscribeProperties(callback);
```

Nie używaj tego wzorca:

```ts
viewModel.subscribeProperties(this.onChange.bind(this));
viewModel.unsubscribeProperties(this.onChange.bind(this));
```

Każde `bind(this)` tworzy nową funkcję. Druga funkcja nie jest równa pierwszej,
więc obserwator pozostanie podpięty.

Powyższe dotyczy subskrypcji ViewModelu. W bazowej klasie `Binding`,
`EventCommandBinding` i `ValidationErrorBinding` `unsubscribe(callback)` usuwa
dokładnie przekazany callback, a `dispose()` odpina wszystkich zapisanych
subskrybentów - można więc podpiąć wielu słuchaczy i odpinać ich po nazwie.
ArrayObserver ma osobny mechanizm wielu subskrybentów (sekcja 11.3).

Po `dispose()` elementu wywołanie `subscribe()` rzuci błędem, więc sprzątanie
jest jednoznaczne i nie można przypadkowo podpiąć słuchacza do umarłego obiektu.

## 4. Dekoratory property

### 4.1 `@propertyChange`

`@propertyChange()` tworzy getter i setter podłączony do mapy property ViewModelu.

```ts
export class PanelViewModel extends ViewModel {
  @propertyChange()
  accessor title = '';

  @propertyChange()
  accessor visible = true;
}
```

Inicjalizator accessora rejestruje właściwość w ViewModelu. Przy
kolejnych ustawieniach korzysta z `setPropertyValueAndNotify`.

### 4.2 `@propertyChange(callback)`

Można wskazać metodę callbacku:

```ts
@propertyChange('onWidthChanged')
accessor width = 0;

private onWidthChanged(value: unknown, propertyName: string) {
  // lokalna reakcja ViewModelu
}
```

Callback jest wyszukiwany na prototypie obiektu. Nazwa musi być poprawna.

**Uwaga:** Jak opisano w sekcji 3.2, callback zarejestrowany przez dekorator
zostaje wywołany przy zapisie z View (`setPropertyValueFromView`), a nie przy
programowym ustawieniu przez setter, ponieważ `setPropertyValueAndNotify`
domyślnie przekazuje `callbackExecute = false`.

### 4.3 `@propertyAlias`

`@propertyAlias('realProperty')` pozwala wystawić kilka nazw, które wskazują
na tę samą property ViewModelu:

```ts
@propertyAlias('displayValue')
accessor aliasValue = '';
```

Używaj tego ostrożnie, bo nazwa w HTML może sugerować inny stan niż faktycznie
przechowywany w ViewModelu.

### 4.4 Dziedziczenie reaktywnych accessorów

Ponowna dekorowana deklaracja tego samego accessora, pod tą samą nazwą
właściwości modelu, zastępuje jego wartość początkową, walidator i callback:

```ts
class Base extends ViewModel {
  @propertyChange()
  @validate({ isValid: value => value === 'base' })
  accessor name = 'base';
}

class Child extends Base {
  @propertyChange()
  @validate({ isValid: value => value === 'child' })
  accessor name = 'child';
}
```

`new Child().name` zwraca `'child'` i jest sprawdzane walidatorem dziecka.
Inicjalizatory wykonują się w kolejności baza → dziecko; każda deklaracja
rejestruje własną wartość i waliduje ją raz, jeśli ma walidator. Złożenie
`@validate` i `@propertyChange` nie dodaje drugiego zapisu ani drugiej walidacji.
Po inicjalizacji używany jest wyłącznie walidator deklaracji dziecka.

Nowa deklaracja bez `@validate` usuwa walidator odziedziczonej deklaracji;
analogicznie pominięcie callbacku usuwa callback bazy. Sama klasa pochodna
bez ponownej deklaracji zachowuje właściwość i konfigurację bazy.
Reguły dotyczą również `@propertyAlias`, gdy publiczna nazwa właściwości
pozostaje taka sama. Inne accessory wskazujące na wspólny alias nie są
traktowane jako nadpisanie tej samej deklaracji.

Inicjalizacja nie wywołuje callbacku zmiany. Callback działa przy zapisie
z widoku według zasad sekcji 3.2; getter od razu odczytuje nową wartość modelu.
W konstruktorze bazy nie należy wywoływać setterów accessorów zadeklarowanych
ponownie w dziecku: ich prywatne pola zaplecza nie są jeszcze zainicjalizowane.
Do zapisu na tym etapie można użyć API modelu; późniejszy inicjalizator dziecka
zastąpi taką wartość swoją wartością początkową.

## 5. Template i parser `data-*`

### 5.1 Podstawowa składnia

```html
<template id="userFormTemplate">
  <section data-bind="{class: panelClass}, {display: visible, trueVal: flex}">
    <h2 data-bind="{text: title}"></h2>
    <input data-bind="{value: name, mode: twoWay, triggerType: input}">
    <button data-command="{click: save}">Zapisz</button>
  </section>
</template>
```

Nazwy typów są case-sensitive. Kanoniczna nazwa binda HTML to `innerHTML`.

### 5.2 Wiele bindów

Deklaracje można oddzielać przecinkiem lub zapisywać obok siebie, np. `{click: save}{resize: refresh}`. Dopuszczalny jest jeden przecinek po ostatniej deklaracji.

```html
<div data-bind="{class: stateClass}, {display: isVisible, trueVal: flex}"></div>
```

Parser uwzględnia cudzysłowy, znaki ucieczki i zagnieżdżenia przy dzieleniu
argumentów. Cudzysłowy i sekwencje ucieczki nie są jednak usuwane ani dekodowane.
Na przykład komunikat ze spacją nie wymaga dodatkowych cudzysłowów:

```html
<span data-validate-error="{message: email, defaultMessage: Niepoprawny email}"></span>
```

Nie należy jednak traktować tego formatu jako pełnego JSON-a. To lekka składnia
konfiguracyjna, a wartości są ostatecznie przekazywane jako tekst argumentu.
`defaultMessage: 'Niepoprawny email'` wyświetli także apostrofy. Argumenty
interpretuje konkretny binding; `attribute` pobiera wartość z property, nie z argumentu
`value`. Tekst poza klamrami, niedomknięte lub niedopasowane nawiasy, brak nazwy i powtórzony argument powodują błąd składni. Komunikat wskazuje atrybut, pozycję znaku liczoną od 1 i ID szablonu, jeśli jest dostępne.

### 5.3 Argumenty

Argument ma postać:

```text
argName: argValue
```

Dwukropek dzieli argument tylko na pierwszym poziomie. Warto to wykorzystać
dla adresów URL, ale nie należy wpisywać niepotrzebnie skomplikowanych struktur do
atrybutu. Gdy konfiguracja staje się duża, lepiej przenieść logikę do osobnego
ViewModelu albo custom bindu.

### 5.4 Fabryki działają w trybie fail-fast

Fabryki nie używają domyślnych fallbacków. Nieznany typ jest błędem:

- `BindingFactory` rzuca wyjątek dla nieznanego bindu;
- `CommandBindingFactory` rzuca wyjątek dla nieznanego commandu;
- `ValidationErrorBindingFactory` rzuca wyjątek dla nieznanego typu błędu.

Przykład błędu:

```text
CommandBindingFactory: unknown command type 'mousenter' for command 'hover'
```

Taki błąd jest celowy. Literówka nie zostanie po cichu potraktowana jako
`click`, `class` albo inny domyślny element. Dzięki temu problem widać podczas
tworzenia `View`, a nie dopiero po kliknięciu lub zmianie property.

Typy są case-sensitive. `innerHTML` jest zarejestrowanym typem binda, ale
przypadkowe, niepełne lub błędnie zapisane warianty już nie.

Jeśli tworzysz własny binding, bind komendy albo bind błędu walidacji, rejestruj go tylko raz. Poniższy fragment zakłada istniejącą klasę CurrencyBinding implementującą IBinding; kompletne przykłady zawiera [instrukcja rozszerzania](custom-bindings.md):

```ts
BindingFactory.registerBinding(
  'currency',
  (element, name, args) => new CurrencyBinding(element, name, args)
);
```

Te same zasady dotyczą rejestrów typów komend i błędów walidacji:
`CommandBindingFactory.registerCommandBinding` oraz
`ValidationErrorBindingFactory.registerValidationErrorBinding`. Każdy rejestr ma
własną przestrzeń nazw, zgodną z atrybutem (`data-bind`, `data-command`,
`data-validate-error`).

Ponowna rejestracja tej samej nazwy również rzuca wyjątek. Zapobiega to ukrytym
konfliktom zależnym od kolejności importów.

Opcjonalne metody `beginInitialization()` i `endInitialization()` pozwalają
bindowi odroczyć działania do zakończenia inicjalizacji widoku.
`beginInitialization()` jest wywoływane po utworzeniu binda, przed ustawieniem
wartości; `endInitialization()` po ustawieniu wartości początkowych i założeniu
subskrypcji wszystkich zwykłych bindów widoku. W przypadku błędu tworzenia
widoku wywoływane jest `dispose()`, bez gwarancji `endInitialization()`.

Bind zarządzający całym elementem i jego potomkami rejestruj przez
`registerStructuralBinding`. Przykładowo `data-bind="{whenReady: status}"`
może montować element tylko dla jednego stanu modelu:

```ts
BindingFactory.registerStructuralBinding('whenReady', fragment => ({
  setValue(status) {
    if (status === 'ready') fragment.mount();
    else fragment.unmount();
  }
}));
```

Fabryka otrzymuje fragment, nazwę właściwości i argumenty deklaracji. Metoda
`setValue` dostaje surową wartość pola. Fragment obsługuje kotwicę, wielokrotny
montaż, bindingi potomków i sprzątanie DOM. Opcjonalne `dispose()` bindu służy
do zwalniania jego własnych zasobów. Jeden element może mieć jeden bind
strukturalny i wiele zwykłych. Oba rodzaje bindów współdzielą przestrzeń nazw.

Po błędzie konstrukcji `View` odłącza własne subskrypcje i zwalnia zasoby zwrócone przez fabryki, również w aktywnych gałęziach `if`. Wywołujący otrzymuje pierwotny wyjątek i może ponownie użyć modelu. Jeśli fabryka zgłasza wyjątek przed zwróceniem obiektu, sama odpowiada za zwolnienie wcześniej nabytych zasobów.

Fabryki sprawdzają typ, nie istnienie nazwanej property lub komendy w modelu.
Brak komendy w modelu jest ignorowany przy zdarzeniu, bo szablony mogą być
współdzielone między widokami z różnymi ViewModelami. **Nieznany typ**
(literówka w `data-command`) **jest błędem** - fail-fast dotyczy typów,
nie nazw komend. Nazwy `constructor`, `toString` i `__proto__` można jawnie rejestrować jak pozostałe nazwy. Fabryki zgłaszają błąd dla nieznanego typu. Metoda `registerProperties` pobiera wyłącznie własne wyliczalne pola przekazanego obiektu.

## 6. Tryby `mode`

Wspólny argument `mode` kontroluje kierunek danych:

| Wartość | Znaczenie |
|---|---|
| `oneWay` | ViewModel → View, wartość domyślna |
| `oneWayToSource` | View → ViewModel |
| `twoWay` | ViewModel ↔ View |

Przykład pola dwukierunkowego:

```html
<input data-bind="{value: email, mode: twoWay, triggerType: input}">
```

Przy `oneWay` wartość jest ustawiana z ViewModelu, ale zdarzenie elementu nie
powinno zmieniać ViewModelu. Przy `oneWayToSource` View nie pobiera wartości początkowej
z ViewModelu w taki sam sposób jak bind dwukierunkowy, dlatego ten tryb jest
przydatny dla elementów sterowanych wyłącznie z DOM. Konkretnie `oneWayToSource` pomija
początkowe setValue i kolejne aktualizacje z modelu. Nie każdy typ binda
obsługuje kierunek zwrotny; np. `text`, `class` i `disabled` tylko ustawiają DOM.
Pominięcie `mode` oznacza `oneWay`. Jawnie pusta lub nieznana wartość jest
błędem; dopuszczalne zapisy `oneWay`, `oneWayToSource` i `twoWay` rozróżniają wielkość
liter, a otaczające białe znaki są pomijane. Błąd w `data-bind` wskazuje
kontekst szablonu, pozycję i wartość. Także bezpośrednia konstrukcja binda
dziedziczącego po `Binding` odrzuca błędną wartość zamiast cichego
fallbacku. **Nieznany typ binda** również jest błędem.

## 7. Wbudowane bindy

### `innerHTML`

Wstawia do elementu:

- string jako `innerHTML`;
- `HTMLElement`;
- `View` przez jego `viewNodeList`;
- tablice `HTMLElement`/`View`;
- `ArrayObserver` z migawkowym uzgadnianiem wstawień, usunięć i kolejności.

```html
<div data-bind="{innerHTML: contentView}"></div>
<div data-bind="{innerHTML: itemsView, place: start}"></div>
```

`place` ustawia cały zarządzany zakres na początku (`start`) albo na końcu
(`end`, domyślnie) hosta. Kolejność elementów w kolekcji jest zachowana dla obu
wartości.

Przypisanie nowego View, HTMLElement, tablicy lub ArrayObserver zastępuje
poprzednia zawartość zarządzana przez ten bind. Ponowne przypisanie tego samego
ArrayObserver podpina subskrypcje bez duplikowania jej i uzgadnia jego bieżącą
migawkę. Zmiany kolekcji są również uzgadniane z migawki, dlatego sort,
reverse, fill i copyWithin zachowują tożsamość i kolejność węzłów.

Element tablicy musi być `HTMLElement` albo View zawierającym wyrenderowane węzły.
Nie wstawiaj tej samej pozycji więcej niż raz ani nie nakładaj na siebie
korzeni różnych pozycji. Zwykła tablica nie jest obserwowana po pierwszym
renderze; do reaktywnych zmian użyj `ArrayObserver`.

Usuniecie View z kolekcji albo zmiana źródła odpina jego węzły, ale ich nie
niszczy. Właściciel View odpowiada za `dispose()`. Zmiana
wartości na string najpierw odpina zarządzane View, a następnie ustawia string
jako HTML.

**Ograniczenia:**

- Tablica stringów nie jest listą tekstów - elementy listy muszą być
  wyrenderowanymi widokami albo elementami DOM. Do bezpiecznego tekstu użyj
  binda `text`.
- Bezpośrednie zmiany indeksowe `ArrayObserver` są obserwowane; dla zwykłych
  tablic nie ma takiej gwarancji (sekcja 11).

### `text`

Ustawia tekst elementu:

```html
<span data-bind="{text: title}"></span>
<span data-bind="{text: description}"></span>
```

Używaj `text`, gdy dane pochodzą od użytkownika i nie powinny być
interpretowane jako HTML. `innerHTML` jest przeznaczony dla zaufanej zawartości
HTML albo zarządzanych widoków.

`text`, `value` i tekstowa ścieżka `innerHTML` korzystają z `prepareValue`:
`null` i `undefined` dają pusty tekst, a pozostałe wartości są konwertowane
przez `String(...)`. Na przykład zwykły obiekt `{}` daje `[object Object]`.
Bind `interpolate` stosuje taką samą normalizację. Nie trzeba wcześniej
zamieniać `null` na pusty string.

### `interpolate`

Reaktywna interpolacja tekstowa: podstawia token `{{nazwa}}` w treści
tekstowej elementu (i jego potomstwie) na wartość property.

```html
<label data-bind="{interpolate: behaviorSkipLabel}">
  <input type="radio" name="behavior" value="skip" checked>
  {{behaviorSkipLabel}}
</label>
```

Nazwa w `data-bind` musi być identyczna z nazwa tokena w podwójnych klamrach.
Podstawiane są tylko tokeny o tej nazwie, a inne tokeny `{{...}}` zostają
bez zmian:

```html
<span data-bind="{interpolate: title}">{{title}} ({{otherProperty}})</span>
```

Właściwości i zachowanie:

- Reaktywny: tokeny zostają w szablonie (zamienione na puste sloty tekstowe),
  więc każde przypisanie property aktualizuje wszystkie miejsca naraz.
- Tylko tekst: wartość trafia do DOM jako tekst (`Text.data`), nigdy przez
  `innerHTML`. Wartości zawierające `<b>`, `<img>`, `<script>` itp. są
  renderowane dosłownie - to eliminuje wektor XSS.
- Bezpieczny dla potomków: aktualizacja nie przepisuje innerHTML, więc
  istniejące elementy, ich atrybuty, wartości (np. w inputach) i obsługa
  zdarzeń zostają nietknięte.
- Zakres: tokeny są podstawiane tylko w tekstowych potomstwach elementu.
  Tokeny w atrybutach oraz w treści `script`, `style` i `template` są
  ignorowane.
- Null-safe: `null` i `undefined` są renderowane jako pusty tekst.

Dla zmiennego tekstu obok inputa można już używać `interpolate` bezpośrednio
w etykiecie - nie trzeba umieszczać osobnego `<span data-bind="{text: ...}">`.

### `value`

Obsługuje inputy, textarea oraz input typu file.

```html
<input data-bind="{value: name, mode: twoWay, triggerType: input}">
<input type="file" data-bind="{value: files, mode: oneWayToSource}">
```

`triggerType`:

- `input` nasłuchuje na bieżąco;
- brak argumentu lub inna wartość używa `change`.

`triggerType` dotyczy tylko binda `value`; nie jest ustawieniem zdarzeń
commandu.

### `visibility`

Ustawia `style.visibility` na podstawie wartości logicznej.

```html
<div data-bind="{visibility: isVisible}"></div>
```

### `if` - warunkowe renderowanie

```html
<div data-bind="{if: exportDisplayButton}" data-command="{click: exportMaterialsCommand}">
    <span data-bind="{text: exportMaterialsBtText}"></span>
</div>
```

Zadeklaruj w ViewModelu np. `@propertyChange() accessor exportDisplayButton: boolean = false;`.
Przy `true` powstaje element wraz z potomkami. Bindingi odczytują bieżące dane,
a komendy działają również na elemencie z samym warunkiem. Przy `false`,
`null` lub `undefined` pozostaje komentarz wyznaczający pozycję. Demontaż
zwalnia subskrypcje gałęzi. Model pozostaje własnością dotychczasowego właściciela.
Kolejne `true` po demontażu tworzy świeży DOM. Dla zachowania fokusu
i lokalnego stanu kontrolki podczas ukrywania użyj `display`.

`if` odczytuje surową wartość pola w kierunku model → widok.
Wartości innych typów (również napis `"false"`) powodują błąd.
Na element przypada jeden warunek bez argumentów. Można go łączyć z innymi
deklaracjami, np. `data-bind="{if: canExport}, {text: label}"`,
stosować na korzeniu widoku i zagnieżdżać. Samo przełączenie warunku
nie emituje `ready`. Układ widocznego elementu określa CSS.

### `display`

Dla boolean ustawia `style.display`:

```html
<div data-bind="{display: isOpen, trueVal: flex, falseVal: none}"></div>
```

Argumenty:

- `trueVal`, domyślnie `block`;
- `falseVal`, domyślnie `none`.

Dla string ustawiany jest bezpośrednio tryb display:

```html
<div data-bind="{display: displayMode}"></div>
```

`null` i `undefined` działają jak `false`: ustawiają `falseVal`, domyślnie
`none`. Dotyczy to również pierwszego renderowania i zastępuje wtedy inline
`display` wpisany w szablonie. Pusty string `''` ma inne znaczenie: usuwa
deklarację inline `display`, pozwalając decydować regułom CSS.
Binding zmienia wyłącznie `display`; pozostałe style, np. `opacity`, pozostają.
Inne typy (np. liczby, obiekty i tablice) są nadal ignorowane.

### `attribute`

Ustawia atrybut wskazany przez `attributeName`:

```html
<img data-bind="{attribute: imageUrl, attributeName: src}">
<label data-bind="{attribute: inputId, attributeName: for}"></label>
```

Wartość pochodzi z własności nazwanej w `attribute` (`imageUrl`);
`attributeName` tylko wskazuje docelowy atrybut DOM (`src`).

Wartości boolean dodają albo usuwają atrybut.

**Uwagi:**
- Gdy `mode` nie jest `oneWay`, do binda podpięty zostaje `MutationObserver` do
  monitorowania zmian atrybutu i emituje zmiany do ViewModelu.
- Obserwator śledzi atrybut samego elementu, pomija echo zapisu z modelu
  i jest odłączany przez `dispose()`.

### `class`

Ustawia zestaw klas CSS z tekstu:

```html
<div data-bind="{class: stateClass}"></div>
```

ViewModel powinien zwracać tekst klas, na przykład:

```ts
this.buttonClass = isLocked ? 'button-lock' : 'button-active';
```

Binding zapamiętuje klasy obecne przy jego tworzeniu i zachowuje je jako
statyczne. Przy zmianie usuwa nieaktualne klasy dynamiczne i dodaje nowe.
`null`, `undefined` i pusty string usuwają klasy dynamiczne, lecz zachowują
klasy statyczne, także gdy wcześniej wystąpiły również w wartości bindingu.
Przy pierwszym renderze nullish pozostawia klasy z szablonu. Późniejsze
przypisanie tekstu ponownie ustawia klasy dynamiczne. Pozostałe typy wartości
(np. liczby, obiekty i tablice) są ignorowane i nie zmieniają klas.

### `style`

Argument `styleName` ustawia pojedynczą własność CSS:

```html
<div data-bind="{style: color, styleName: color}"></div>
```

Bez `styleName` bind ustawia cały tekst stylu.

`null`, `undefined` i `''` czyszczą styl. Ze `styleName` usuwana jest
wyłącznie wskazana deklaracja CSS; pozostałe deklaracje pozostają. Bez
`styleName` czyszczony jest cały styl inline, a element zachowuje `style=""`.
Późniejsza wartość ponownie ustawia styl. Liczby nadal są konwertowane na tekst,
a pozostałe typy (np. obiekty, tablice i wartości boolean) są ignorowane.

Dotyczy to również pierwszego renderowania: niezainicjalizowana właściwość
modelu usuwa odpowiedni styl inline wpisany w szablonie. Binding bez
`styleName` zarządza całym atrybutem i może nadpisać deklaracje ustawione przez
inne bindingi, np. `display` lub `width`. Do współpracy z nimi używaj
`styleName` wskazującego inną właściwość CSS.

### `height` i `width`

```html
<aside data-bind="{height: asideHeight, unit: px}"></aside>
<div data-bind="{width: panelWidth, unit: rem}"></div>
```

Dla number dodawana jest jednostka. Dla string ustawiana jest wartość CSS
bezpośrednio.

**Uwaga:** Gdy `mode` nie jest `oneWay`, do binda podpięty zostaje `ResizeObserver` do
monitorowania rozmiaru elementu i emituje zmiany do ViewModelu.
`dispose()` odłącza podpiętego `ResizeObserver`.
Wartości zwrotne pochodzą z contentRect i są wymiarami w pikselach,
niezależnie od argumentu `unit`.

### `size`

`size` obsługuje `[width, height]` w obie strony. Dla pojedynczego wymiaru
użyj `height`/`width`.

**Uwagi:**
- W kierunku View → ViewModel wartość to `[width, height]` z
  `ResizeObserver` (contentRect, piksele), niezależnie od argumentu `unit`.
- `dispose()` odłącza podpiętego `ResizeObserver`.

### `scrollTop` i `scrollLeft`

Synchronizuje `element.scrollTop`:

```html
<div data-bind="{scrollTop: scrollPosition, mode: twoWay}"></div>
<div data-bind="{scrollLeft: horizontalPosition, mode: twoWay}"></div>
```

Przy `twoWay` scroll DOM-u aktualizuje ViewModel, a zmiana property ustawia
pozycje przewijania.
`scrollLeft` działa analogicznie dla osi poziomej. Oba bindingi przyjmują number
i nasłuchują zdarzenia `scroll`, gdy kierunek pozwala na zapis do modelu.

### `checked`

Obsługuje checkbox:

```html
<input type="checkbox" data-bind="{checked: enabled, mode: twoWay}">
```

Akceptowane są boolean, string `true` oraz dodatnia liczba (number lub bigint).
Kierunek zwrotny nasłuchuje `click`, nie `change`.

### `radio`

Property przechowuje wartość wybranej opcji, nie boolean:

```html
<input type="radio" name="behavior" value="skip"
  data-bind="{radio: behavior, mode: twoWay}">
<input type="radio" name="behavior" value="update"
  data-bind="{radio: behavior, mode: twoWay}">
```

Zarejestruj `behavior`, np. z wartością `'skip'`. setValue porównuje tekstowa
wartość property z input.value i ustawia checked. Zdarzenie `change` zapisuje
input.value tylko dla zaznaczonego inputa. null/undefined są tu traktowane
jako pusty string. Aktualizacja innych bindingów property wymaga osobnego
powiadomienia zgodnie z sekcją 3.1.

### `options`

Buduje opcje selecta z tablicy `OptionValue`:

```ts
import { OptionValue } from 'mvvm-dom';

const options = [
  new OptionValue('pl', 'Polski', true),
  new OptionValue('en', 'English', false)
];

this.registerProperty('languages', options);
```

```html
<select data-bind="{options: languages, mode: twoWay}"></select>
```

**Uwagi:**
- Akceptowana jest tablica obiektów `IOptionValue` ze stringami `value` i
  `label` oraz booleanem `isSelected`; instancja klasy nie jest wymagana.
- Pusta tablica usuwa opcje; pusta wartość `''` jest poprawna.
- Dla pojedynczego selecta zaznaczana jest pierwsza opcja z `isSelected: true`.
  Dla `<select multiple>` zaznaczane są wszystkie takie opcje.
- Przy `twoWay` i `oneWayToSource` zmiana użytkownika publikuje nową tablicę rekordów
  z aktualnym `isSelected`. Binding nie mutuje przekazanych obiektów; `oneWay`
  nie zapisuje zmian do modelu.
- Zapis po `change` odczytuje wszystkie aktualne opcje z DOM, także wewnątrz
  `optgroup`, w ich kolejności. Dotyczy pojedynczego i wielokrotnego wyboru.
  Każdy rekord zawiera `value`, `label` (tekst opcji) i `isSelected`;
  dodatkowe pola danych modelu nie są przenoszone do wyniku.
- W `oneWayToSource` można używać statycznych opcji HTML bez wcześniejszego `setValue`.
  Inicjalizacja nie zastępuje ich danymi modelu ani nie zapisuje do modelu.
  Zmiana listy, tekstu lub wartości opcji jest uwzględniana przy następnym
  `change`; sama zmiana DOM nie wywołuje zapisu przez ten binding.
- Duplikaty `value` pozostają osobnymi rekordami ze stanem zaznaczenia
  konkretnej opcji. Brak zaznaczenia daje rekordy z `isSelected: false`;
  pusta tablica wyniku oznacza brak opcji.

### `selectedValues`

Wielokrotny wybór można też zapisać jako `string[]`, osobno od listy opcji:

```html
<select multiple data-bind="{options: languages}, {selectedValues: selectedLanguages, mode: twoWay}"></select>
```

`languages` to `IOptionValue[]`, a `selectedLanguages` to np. `['pl', 'en']`.
Gdy oba bindingi występują razem, `options` musi być `oneWay` (domyślnie) i
dostarcza tylko opcje; `selectedValues` steruje wyborem. W trybie `oneWayToSource`
`selectedValues` nie steruje DOM, więc początkowe `isSelected` pochodzi z
`options`. Binding działa też ze statycznymi opcjami, bez `options`.

Wynikiem jest unikalna tablica wartości w kolejności opcji DOM; `[]` oznacza
brak wyboru, a `''` jest poprawną wartością. Jeżeli kilka opcji ma tę samą
wartość, wybierane są wszystkie. W `twoWay` brakujące wartości są usuwane z
modelu po inicjalizacji i zmianie listy opcji w DOM, ich tekstu lub atrybutów
`value` i `selected`. Obserwacja DOM jest asynchroniczna; programowy zapis
własności `option.selected` sam w sobie nie wywołuje synchronizacji.
`oneWay` nigdy nie zapisuje do modelu, a `oneWayToSource` emituje tylko po `change`.
Niepoprawny element lub wartość inna niż tablica stringów powoduje błąd.

### `readonly` i `disabled`

```html
<input data-bind="{readonly: readonly}">
<button data-bind="{disabled: saving}">Zapisz</button>
```

Są to bindy ViewModel → View. Stan przycisku powinien być sterowany przez
property, a nie przez ręczne manipulowanie DOM-em w metodzie commandu.

**Uwaga:** Bind reaguje tylko na strict `true` (boolean). Inne wartości
prawdziwe (np. `1`, `'true'`) nie ustawia atrybutu.

## 8. Konwertery wartości (IValueConverter)

Biblioteka udostępnia system konwerterów wartości - odpowiednik klasycznego
`IValueConverter` z WPF/WinUI. Pozwala on na automatyczna transformacje wartości
między ViewModel a View bez ręcznego przeliczania w kodzie binda.

Konwertery są dostępne z głównego eksportu pakietu.

### 8.1 Interfejs `IValueConverter`

```ts
export interface IValueConverter {
    /**
     * ViewModel -> View
     * @param value       surowa wartość z ViewModel
     * @param parameter   opcjonalny parametr (np. nazwa klasy CSS, mapa enum)
     */
    convert(value: unknown, parameter?: unknown): unknown;

    /**
     * View -> ViewModel (opcjonalne - używane gdy mode: twoWay / oneWayToSource)
     */
    convertBack?(value: unknown, parameter?: unknown): unknown;
}
```

- `convert` - obowiązkowy. Wywoływany przy przepływie ViewModel → View.
- `convertBack` - opcjonalny. Wywoływany przy przepływie View → ViewModel
  (tylko gdy `mode` jest `oneWayToSource` lub `twoWay`).

### 8.2 Rejestracja konwertera

Konwertery są przechowywane w globalnym rejestrze nazwanym:

```ts
import { registerConverter } from 'mvvm-dom';

registerConverter('numberToPercent', {
    convert: (value) => (typeof value === 'number' ? value + '%' : ''),
    convertBack: (value) => {
        const n = parseFloat(String(value).replace('%', ''));
        return isNaN(n) ? 0 : n;
    },
});
```

Dostępne funkcje:

| Funkcja | Opis |
|---|---|
| `registerConverter(name, converter)` | Rejestruje konwerter pod nazwą. Ponowna rejestracja nadpisuje. |
| `unregisterConverter(name)` | Usunięty konwerter z rejestru. |
| `getConverter(name)` | Zwraca konwerter; rzuca wyjątek, jeśli nazwa nie istnieje. |

**Ważne:** Konwerter musi być zarejestrowany **przed** utworzeniem `View`,
który z niego korzysta. W przeciwnym razie `getConverter` rzuci wyjątek
`ValueConverter: "nazwa" is not registered. Use registerConverter() first.`

### 8.3 Dekorator `@convert`

Dekorator przypisuje konwerter do konkretnej własności ViewModelu:

```ts
import { convert } from 'mvvm-dom';
import { propertyChange } from 'mvvm-dom';

export class PanelViewModel extends ViewModel {
    @propertyChange()
    @convert('boolToClass', 'dis_ctr_opc_act')
    public accessor isActive: boolean = false;
}
```

Argumenty dekoratora:

| Argument | Opis |
|---|---|
| `converterName` | Nazwa zarejestrowanego konwertera (klucz w rejestrze). |
| `parameter` | Opcjonalny parametr przekazywany do `convert` / `convertBack`. |

Dekoratory `@propertyChange` i `@convert` są niezależne - kolejność stosowania
nie ma znaczenia dla działania.

### 8.4 Przepływ danych z konwerterem

```text
ViewModel.setPropertyValueAndNotify('isActive', true)
  -> property-change
  -> View.propertyChange
  -> convertToView(true, 'isActive', viewModel)
  -> IValueConverter.convert(true, 'dis_ctr_opc_act')
  -> zwraca np. 'dis_ctr_opc_act'
  -> Binding.setValue('dis_ctr_opc_act')
  -> DOM (klasa CSS została dodana)

DOM (zmiana w input)
  -> View.propertyElementChange
  -> convertToViewModel('dis_ctr_opc_act', 'isActive', viewModel)
  -> IValueConverter.convertBack('dis_ctr_opc_act', 'dis_ctr_opc_act')
  -> zwraca np. true
  -> ViewModel.setPropertyValueFromView('isActive', true)
```

Gdy własność **nie** ma dekoratora `@convert`, wartość przechodzi bez
zmian (przejrzysty passthrough).

### 8.5 Funkcje pomocnicze (używane wewnętrznie przez `view.ts`)

| Funkcja | Opis |
|---|---|
| `hasConverterFor(propertyName, vm)` | Zwraca `true`, jeśli własność ma przypisany konwerter. |
| `getConverterMetadataFor(propertyName, vm)` | Zwraca metadane (nazwa konwertera + parametr) lub `undefined`. |
| `convertToView(value, propertyName, vm)` | Przepuszcza wartość przez `convert`. Bez `@convert` - zwraca wartość bez zmian. |
| `convertToViewModel(value, propertyName, vm)` | Przepuszcza wartość przez `convertBack`. Bez `@convert` lub bez `convertBack` - zwraca wartość bez zmian. |

Te funkcje są wywoływane automatycznie przez `View` w metodach
`propertyChange` (ViewModel → View) i `propertyElementChange`
(View → ViewModel). Nie trzeba ich wywoływać ręcznie.

### 8.6 Przykład pełnego użycia

```ts
// 1. Zdefiniuj i zarejestruj konwerter (np. w pliku initConverters.ts)
import { registerConverter } from 'mvvm-dom';

registerConverter('boolToClass', {
    convert: (value: unknown, param?: unknown) =>
        (value === true ? String(param ?? '') : ''),
    convertBack: (value: unknown, param?: unknown) =>
        (value !== '' && value !== undefined ? true : false),
});

// 2. Użyj dekoratora w ViewModel
import { convert } from 'mvvm-dom';
import { propertyChange } from 'mvvm-dom';

export class ButtonViewModel extends ViewModel {
    @propertyChange()
    @convert('boolToClass', 'btn-active')
    public accessor isActive: boolean = false;
}
```

3. Bind w template dostanie już przetworzoną wartość:

```html
<template id="btnTemplate">
    <button data-bind="{class: isActive}">Przycisk</button>
</template>
```

Przy `isActive = true` bind `class` dostanie `'btn-active'`.
Przy `isActive = false` bind `class` dostanie `''` (pusty string - klasa zostaje usunięta).

### 8.7 Metadane i dziedziczenie

Dekorator `@convert` przypisuje konwerter do pola o tekstowej nazwie. Klasa pochodna dziedziczy konwertery i może zastąpić konwerter wybranego pola. W obu kierunkach konwersji obowiązuje deklaracja najbliższa klasie instancji. Dwa dekoratory `@convert` na tym samym polu jednej klasy zgłaszają błąd podczas definiowania klasy.

Przy `@propertyAlias` konwerter jest dostępny pod publiczną nazwą właściwości
modelu, używaną w bindingu. Kolejność tych dwóch dekoratorów nie ma znaczenia:

```ts
@propertyAlias('canonical')
@convert('myConverter', 'parameter')
accessor label = 'hello';
```

```html
<input data-bind="{value: canonical, mode: twoWay}">
```

Binding wywołuje `convert` przy odczycie i opcjonalne `convertBack` przy zapisie
do `canonical`. Getter `label` od razu widzi zapisaną wartość modelu. Funkcje
`hasConverterFor`, `getConverterMetadataFor`, `convertToView` i `convertToViewModel`
również przyjmują publiczną nazwę `canonical`, a nie nazwę accessora `label`.
Pole `propertyName` zwracanych metadanych zawiera tę publiczną nazwę.

Dziedziczony konwerter podąża za aliasem accessora obowiązującym w klasie
pochodnej. Własne `@convert` dziecka zastępuje konwerter bazy; brak własnego
`@convert` zachowuje konwerter dziedziczony. Zmiana aliasu lub konwertera
w dziecku nie zmienia metadanych bazy ani klas siostrzanych.

Zwykłe rekordy bez metadanych konwertera przekazują wartości bez zmian,
również jako elementy `collection`. Dotyczy to obiektów utworzonych przez
`Object.create(null)` i rekordów z własnym polem `constructor`. To pole danych
nie jest odczytywane podczas wyszukiwania konwertera; również getter tego pola
nie jest wywoływany. Metadane klasy są rozpoznawane po jej prototypie.
Własne pole `constructor` nie wyłącza konwerterów rzeczywistej klasy modelu
ani nie pozwala przypisać rekordowi konwerterów innej klasy.

### 8.8 Zasady i ograniczenia

- Konwerter działa **tylko** dla property, które mają dekorator `@convert`.
  Inne property przechodzą bez zmian.
- `convertBack` jest opcjonalny. Gdy nie istnieje, wartość View → ViewModel
  przechodzi bez zmian.
- Parametr konwertera jest statyczny (ustalony w dekoratorze). Nie da się go
  zmienić w locie bez ponownej deklaracji property.
- Rejestr jest globalny (modułowy). Konwertery zarejestrowane w jednym module
  są widoczne w całym aplikacji.
- Nie ma wbudowanych konwerterów - każdy trzeba zarejestrować ręcznie.
- Nazwy konwerterów są case-sensitive.

## 9. Commandy

### 9.1 Składnia i typy

```html
<button data-command="{click: save}">Zapisz</button>
<div data-command="{mouseInOut: hover, trigger: both}"></div>
```

| Typ | Zdarzenie |
|---|---|
| `click` | `element.click` |
| `mouseInOut` | `mouseenter` i `mouseleave` |
| `mousedown` | `element.mousedown` |
| `mouseup` | `element.mouseup` |
| `mousemove` | `element.mousemove`, bez zatrzymywania propagacji |
| `ready` | własne zdarzenie `ready` emitowane przy wstawianiu przez bind `innerHTML` |
| `change` | `element.change` |
| `input` | `element.input` |
| `focusout` | `element.focusout` |
| `resize` | `window.resize` |
| `animationend` | `element.animationend` |
| `key` | lokalne `element.keydown` dla skonfigurowanych skrótów |
| `enter` | `element.keydown` (tylko klawisz Enter, wywołuje `preventDefault()`) |
| `submit` | `element.submit` (dla `<form>`, blokuje domyślne przeładowanie strony) |
| `dragover` | `element.dragover` (blokuje domyślne zachowanie, ustawia `dropEffect = 'copy'`) |
| `dragleave` | `element.dragleave` |
| `drop` | `element.drop` (blokuje domyślne otwarcie pliku w przeglądarce) |

### Skróty klawiaturowe

```html
<div data-command="{key: select, keys: Ctrl+S | Enter, parameter: object.id}">
  <input>
</div>
```

Wymagane `keys` zawiera alternatywy oddzielone `|`. Każda kombinacja ma
jeden `KeyboardEvent.key` i opcjonalne modyfikatory `Ctrl`, `Alt`, `Shift`,
`Meta`, oddzielone `+`. Modyfikatory i pojedyncze litery są porównywane bez
uwzględniania wielkości; inne nazwy klawiszy, np. `Enter`, `Escape`,
`ArrowDown`, `F1`, są case-sensitive. Użyj `Plus`, `Pipe` i `Space` dla
klawiszy `+`, `|` i spacji. Niepoprawna konfiguracja zgłasza błąd.
Domyślnie wymagane jest dokładne dopasowanie modyfikatorów; Ctrl i Meta są
odrębne. `KeyboardEvent.key` zależy od układu klawiatury i Shift.

Opcjonalne wartości boolean (`true`/`false`):

- `preventDefault: false` nie blokuje domyślnej akcji dopasowanego skrótu.
  Domyślnie jest ona blokowana również przy `canExecute=false` lub braku komendy.
- `allowRepeat: true` dopuszcza powtarzanie przy przytrzymanym klawiszu.
- `allowComposition: true` dopuszcza zdarzenia podczas kompozycji IME.
- `allowExtraModifiers: true` dopuszcza dodatkowe modyfikatory.

Ostatnie trzy opcje domyślnie są `false`. Ignorowane zdarzenia nie są
anulowane. Listener obejmuje element i zdarzenia bąbelkujące z jego potomków;
nie jest globalny i nie zatrzymuje propagacji. Zagnieżdżone bindingi mogą
więc wykonać kilka komend. Skróty systemowe lub przeglądarki mogą nie zostać
dostarczone albo nie pozwalać na anulowanie.

`commandData.args` zawiera klawisz dokładnie jak w zdarzeniu, a następnie
aktywne modyfikatory w kolejności `Ctrl`, `Alt`, `Shift`, `Meta`, np.
`['s', 'Ctrl']`. Parametr trafia osobno do `commandData.parameter`, a
oryginalny `KeyboardEvent` do `sourceEvent`.

Stare `enter` pozostaje zgodne: reaguje na Enter z dowolnymi dodatkowymi
modyfikatorami, repeat i IME, wywołuje `preventDefault` i przekazuje puste
`args`. Do nowych deklaracji używaj `key`.

`ready` nie jest natywnym zdarzeniem przeglądarki i nie uruchamia się przy
samym utworzeniu `View`. Bind `innerHTML` emituje je dla korzenia i potomków
zarządzanego elementu (View, HTMLElement albo tablicy) podczas pierwszego
wstawienia; dla wartości stringowej ustawianej jako HTML nie jest emitowane.
W commandzie `objectSender` wskazuje element, który otrzymał zdarzenie:

```html
<div data-command="{ready: onReady}"></div>
```

Zdarzenie emitowane przez bind trafia do każdego elementu osobno, nie
bąbelkuje i jest emitowane najwyżej raz na element w czasie życia kontrolera
listy. Przeniesienie już wstawionego elementu w inne miejsce nie emituje go
ponownie. Listener na elemencie nadrzędnym nie odbierze `ready` potomka -
podepnij command bezpośrednio do elementu, który ma zareagować. Kod aplikacji
może niezależnie jawnie emitować własne zdarzenia `ready` z bubblingiem.

`mouseInOut` przyjmuje argument `trigger`: `mouseIn`, `mouseOut` albo `both`
(domyślnie `both`). Podanie nieobsługiwanej wartości `trigger` oznacza, że
komenda nie podpina żadnego obserwatora.

```html
<div data-command="{mouseInOut: hover, trigger: mouseIn}"></div>
<div data-command="{mouseInOut: hover, trigger: mouseOut}"></div>
```

Trio `dragover`, `dragleave` i `drop` jest przeznaczone do drag & drop plików.
Wszystkie trzy przekazują do commandu element `HTMLElement` jako
`commandData.objectSender`, a natywny `DragEvent` jest dostępny przez
`commandData.sourceEvent`. `dragover` i `drop` wywołują `preventDefault()`.
Bez niego przeglądarka nie pozwoliłaby na drop i otworzyłaby plik
w nowej karcie.

```html
<div
  data-command="{dragover: onDragOver}, {dragleave: onDragLeave}, {drop: onDrop}">
</div>
```

```ts
@command('onDrop')
private onDrop(command: ICommand) {
  const sender = command.commandData.objectSender as HTMLElement;
  const event = command.commandData.sourceEvent as DragEvent;
  const files = event.dataTransfer?.files;
}
```

### 9.2 Rejestracja ręczna

```ts
import { Command, type ICommand } from 'mvvm-dom';

this.registerCommand('save', new Command((command: ICommand) => {
  const data = command.commandData;
  this.save(data.objectSender);
}));
```

`commandData` zawiera `commandName`, `objectSender`, `args`, `sourceEvent`
(oryginalne zdarzenie DOM) i opcjonalny `parameter`
(rozwiązany parametr komendy). Każde wywołanie dostaje osobny snapshot; sam obiekt
`commandData` i skopiowana tablica `args` są zamrożone. `args` nie jest mapa argumentów z HTML:
`mouseInOut` przekazuje `['mouseIn']` lub `['mouseOut']`, `key` przekazuje
klawisz i modyfikatory, a pozostałe wbudowane komendy przekazują pustą tablicę.

Wszystkie wbudowane komendy przekazują jako objectSender element, do którego
przypięto handler `data-command` (this.element). Kliknięcie ikony w przycisku
zwraca przycisk jako objectSender, a ikona pozostaje w
`command.commandData.sourceEvent.target` (oryginalne zdarzenie DOM).

`Command` daje każdemu wywołaniu osobny, zamrożony snapshot `commandData`;
tablica `args` jest kopiowana i zamrażana. Dla operacji async
skopiuj potrzebne dane przed await, np. `const sender = command.commandData.objectSender`.
callback może zwracać Promise, a `command.isExecuting` jest prawdziwe, dopóki
trwa przynajmniej jedno wywołanie. `command.subscribeExecutionState(obserwator)`
pozwala reagować na przejścia stanu i zwraca funkcję, która odpina obserwatora.
Równoległe wywołania są dozwolone. Drugi
argument konstruktora może obsłużyć błąd; bez `onError` `View` raportuje
odrzuconą Promise do `console.error`, a wywołujący `execute` bezpośrednio
powinien obsłużyć zwróconą Promise. Pełna sygnatura konstruktora
(`executeCallback`, `onError?`, `options?`) znajduje się w
[referencji API](./api.md#command). Snapshot jest płytki - sender i sourceEvent
pozostają referencjami do oryginalnych obiektów DOM.

Błąd synchroniczny callbacku lub odczytu jego wyniku (np. rzucający getter
`then`) jest ponownie rzucany przez `execute`, po zakończeniu tego wykonania.
Nie jest przekazywany do `onError`. Odrzucenie obietnicy trafia do `onError`,
jeśli go podano; wyjątek z samego `onError` odrzuca obietnicę zwracaną przez
`execute`. Również wtedy stan wykonania jest zwalniany. Błąd jednej próby
nie kończy innych trwających wykonań. Po zakończeniu ostatniej próby
`isExecuting` wraca do `false`, a blokada `blockWhileExecuting` jest zdejmowana.

### CanExecute i parametr komendy

```html
<ul>
  <li data-bind="{collection: items}">
    <button data-command="{click: select, parameter: object.id}">{{object.name}}</button>
  </li>
</ul>
```

```ts
const select = new Command(
  cmd => this.selectItem(cmd.commandData.parameter),
  undefined,
  { canExecute: id => typeof id === 'number' && id > 0, blockWhileExecuting: true }
);
this.registerCommand('select', select);
// Po zmianie zewnętrznego stanu, od którego zależy warunek:
select.notifyCanExecuteChanged();
```

Parametr jest surową wartością właściwości ViewModelu albo ścieżki `object`
/ `parent` w wierszu, bez konwertera i bez wyrażeń JavaScript. Brakująca
wartość daje `undefined`. Jest odczytywana ponownie przy każdym zdarzeniu;
zmiany obserwowanego parametru odświeżają stan kontrolki. Snapshot jest
płytki: obiekt parametru nie jest kopiowany ani zamrażany.

Bez predykatu komenda może się wykonać. `canExecute(parameter)` blokuje
również bezpośrednie `execute`. Po zmianie niezależnego stanu predykatu
wywołaj `notifyCanExecuteChanged()`; biblioteka nie śledzi automatycznie
wszystkich jego zależności. `blockWhileExecuting` jest opcjonalny i blokuje
kolejne wywołania aż do zakończenia operacji, także przy błędzie. Domyślnie
równoległe operacje pozostają dozwolone.

Natywne kontrolki obsługujące `disabled` są blokowane, gdy dowolna przypięta
komenda nie może się wykonać lub jest niezarejestrowana. Ten stan jest łączony
z bindem `disabled`; bez takiego binda zachowywany jest początkowy atrybut.
Inne elementy nie dostają atrybutu, ale komenda nadal jest sprawdzana.
`ViewModel` powiadamia widoki o rejestracji, wymianie i usunięciu komendy;
niestandardowy kontekst może udostępnić opcjonalne `subscribeCommands`.

Predykat i opcję blokady można także przekazać dekoratorowi:

```ts
@command<MyViewModel>('select', {
  canExecute(this: MyViewModel, id) { return this.canSelect(id); },
  blockWhileExecuting: true
})
private selectCommand(cmd: ICommand) { /* ... */ }
```

### 9.3 Dekoratory command

```ts
import type { ICommand } from 'mvvm-dom';
import {
  autoRegisterCommands,
  command
} from 'mvvm-dom';

@autoRegisterCommands()
export class FormViewModel extends ViewModel {
  @command('save')
  private saveCommand(command: ICommand) {
    // logika zapisu
  }
}
```

`@command` zapisuje metadane. Rejestracje wykonuje `@autoRegisterCommands()`.
Argument `@command('save')` musi odpowiadać nazwie w `data-command="{click: save}"`. Nazwa metody TypeScript może być inna.

Klasa pochodna może przypisać odziedziczoną nazwę komendy do innej metody przez `@command`. Może również nadpisać samą metodę pod dotychczasową nazwą, bez ponownego dekorowania. Przypisanie tej samej nazwy komendy dwukrotnie w jednej klasie zgłasza błąd podczas definiowania klasy.

### 9.4 Cykl życia commandu

`EventCommandBinding` podpina obserwator DOM w konstruktorze. Warstwa komend
wiąże go z kontekstem, wyszukuje command i wywołuje `command.execute(...)`.

Przy `View.dispose()` command:

- usuwa obserwator DOM;
- usuwa `window.resize`, jeśli był użyty;
- odpina callback od `CommandActionEventTarget`.

`View.detach()` nie usuwa commandu.

### 9.5 Propagacja zdarzeń i kolejność z bindingiem

Wbudowane komendy nie wywołują `stopImmediatePropagation()`. Nie blokują
kolejnych obserwatorów tego samego zdarzenia ani dalszej propagacji, a komendy
resize podpięte do window nie przesłaniają się wzajemnie - każdy aktywny
widok otrzymuje zdarzenie.

View podpina bindingi przed komendami (kolejność konstruktora:
`prepareProperties` → `prepareValidateError` → `prepareCommands`). Przy tym
samym zdarzeniu najpierw zapisuje się wartość pola i walidacja (binding),
następnie wykonuje komenda. Możesz więc bezpiecznie łączyć na jednym elemencie
komendę input z bindingiem value o triggerType input, komendę change z
bindingiem change albo komendę click z checked. Do reakcji na zmianę pola
użyj callbacku property; zapis formularza może być osobna komenda submit.

Komendy `submit`, `enter`, `dragover` i `drop` wywołują `preventDefault()`,
bo jest to uzasadnione zachowaniem kontrolki (blokadę przeładowania,
otwarcia pliku). `key` domyślnie anuluje dopasowane skróty, chyba że podano
`preventDefault: false`. Pozostałe komendy nie modyfikują zdarzenia.

## 10. Walidacja

Przepływ walidacji:

```text
property setter / validateProperty() / validate()
  -> validator Set
  -> zapis stanu pola i error-change z wynikiem walidacji
  -> View
  -> data-validate-error
```

`error-reset` jest emitowane osobno przez `resetPropertyValidationState(name)`.

### 10.1 Dekoratory

Dostępny jest uniwersalny dekorator:

- `@validate(providerOrProviders, callback?)`.

Reguły zapisuje się jako provider pojedynczego walidatora albo tablica
providerów. Stare specjalizowane dekoratory walidatorów zostały usunięte, aby
uniknąć dwóch różnych mechanizmów rejestracji walidacji.

Przykład własnej reguły, bez klasy bazowej ani dodatkowej biblioteki:

```ts
import type { IViewModelValidator } from 'mvvm-dom';
import { validate } from 'mvvm-dom';
import { ViewModel } from 'mvvm-dom';

class NotEmpty implements IViewModelValidator {
  isValid(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  getMessage(): string {
    return 'Pole jest wymagane';
  }
}

class FormViewModel extends ViewModel {
  @validate(() => new NotEmpty())
  accessor label = '';
}
```

Reguła przyjmuje tylko niepusty tekst po usunięciu białych znaków na jego
początku i końcu. Provider może zwracać nowa instancje dla konkretnego ViewModelu.

**Uwagi:**
- Drugi argument `callback` działa tak jak callback `@propertyChange` (patrz sekcja 3.2).
- Inicjalizacja, przypisanie w kodzie i zapis z bindingu uruchamiają jedną
  walidację pola. Obie kolejności `@validate` i `@propertyChange` korzystają
  z tej samej wartości. Komenda `input` odczytuje ją od razu przez getter.
- Można przekazać instancje IViewModelValidator zamiast funkcji dostawcy,
  ale taka instancja będzie współdzielona przez modele korzystające z dekoratora.

### 10.2 Rejestracja reguł

Validator z dekoratora jest rejestrowany podczas inicjalizacji auto-accessora.

Walidacja pola iteruje po zarejestrowanych regułach i zatrzymuje się na pierwszym błędzie. Publiczne wywołanie to `validateProperty(name)`; `validate()` sprawdza wszystkie pola z walidatorami.
Dlatego reguły ogólne warto rejestrować przed szczegółowymi.

### 10.3 Klasy błędu

```html
<input
  data-bind="{value: email, mode: twoWay, triggerType: input}"
  data-validate-error="{class: email, errorClass: input-error, noErrorClass: input-ok, focusIn: true, focusOut: true}">
```

Argumenty typu `class`:

- `errorClass` - klasa dla błędu;
- `noErrorClass` - klasa dla poprawnej wartości;
- `focusOut: true` - reakcja na `blur`;
- `focusIn: true` - reakcja na `focus`.

**Uwaga:** `View` dodaje także obserwator `focusin` do każdego elementu
`data-validate-error`, który wywołuje `validateProperty` na dataContext.

Element komunikatu:

```html
<span
  data-validate-error="{message: email, defaultMessage: Niepoprawny email, hideClass: hidden, showClass: visible}">
</span>
```

`message` używa komunikatu z walidatora, a gdy go brak, `defaultMessage`.

**Uwaga:** Gdy nie podano `showClass`/`hideClass`, element używa
`style.display` (`''` / `'none'`) do przełączania widoczności.

### 10.4 Submit

```ts
public save() {
  if (!this.validate()) {
    return;
  }

  // wysyłka poprawnych danych
}
```

Walidacja przy `input` poprawia UX, ale `validate()` powinno być wywołane
zawsze przed wysłaniem danych.

`validate()` sprawdza wszystkie pola z walidatorami. W obrębie pola zatrzymuje
się na pierwszej niespełnionej regule. Zwraca `true`, gdy wszystkie pola
przeszły walidację. Każde sprawdzone pole publikuje wynik przez `error-change`.

### 10.5 Odczyt stanu walidacji

`ViewModel` udostępnia stan walidacji pojedynczej property:

```ts
viewModel.isPropertyValid('email');
viewModel.getPropertyValidationMessage('email');
viewModel.hasPropertyBeenValidated('email');
viewModel.getPropertyValidationState('email');
```

`getPropertyValidationState` zwraca obiekt `{ isValid, message, validated }`.
Jeśli property nie ma jeszcze zapisanego stanu, wartości domyślne to
`isValid: true`, brak `message` i `validated: false`.

`validateProperty(name)`, `validate()` i ręczne zgłoszenie przez
`setPropertyValidationState` zapisują wynik przed powiadomieniem widoku.
Sukces usuwa poprzedni komunikat i ustawia `validated: true`.
`resetPropertyValidationState` przywraca stan początkowy i emituje `error-reset`.
`getPropertyValidationState` zwraca kopię. Nowy widok, także po ponownym
montażu przez `if`, odtwarza ten stan bez ponownego uruchamiania reguł.

### 10.6 Kontrakt walidatora

`IViewModelValidator` wymaga synchronicznej metody `isValid(value: unknown)`:
`true` oznacza poprawna wartość, `false` błąd. Opcjonalna metoda
`getMessage(value: unknown)` zwraca komunikat błędu. Biblioteka nie narzuca
klasy bazowej ani nie zawiera gotowych reguł - własne walidatory
implementują ten interfejs i są podpinane przez dekorator `@validate`
(patrz sekcja 10.1).
Biblioteka nie zawiera wbudowanych walidatorów.
IViewModelValidator to kontrakt - implementacje (np. NoEmpty, Length, Email)
są częścią aplikacji, nie biblioteki.

## 11. Kolekcje i ArrayObserver

### 11.1 CollectionObserver i binding `collection`

`collection` powiela element, na którym jest zadeklarowany, dla każdego
elementu źródła. Tekstowe tokeny `{{object.sciezka}}` w wierszu są
interpolowane automatycznie:

```ts
import { CollectionObserver } from 'mvvm-dom';

const items = new CollectionObserver(
  { name: 'Anna', description: 'Projekt', details: { status: 'Aktywny' } },
  { name: 'Jan', description: 'Testy', details: { status: 'Nowy' } }
);
viewModel.registerProperty('items', items);

items[0].name = 'Maria';
items[0].details.status = 'Gotowy';
items.push({ name: 'Ola', description: 'Projekt', details: { status: 'Nowy' } });
```

```html
<ul>
  <li data-bind="{collection: items}">
    <span>{{object.name}}</span>
    <span>{{object.description}}</span>
    <span>{{object.details.status}}</span>
  </li>
</ul>
```

`object` oznacza element bieżącego wiersza, a `parent` element bezpośredniej
nadrzędnej kolekcji. Zagnieżdżone kolekcje mają własny zakres:

```html
<section data-bind="{collection: groups}">
  <h2>{{object.name}}</h2>
  <p data-bind="{collection: object.members}">{{parent.name}}: {{object.name}}</p>
</section>
```

Ścieżki składają się z identyfikatorów oddzielonych kropkami. Nie są
wyrażeniami JavaScript; nie obsługują wywołań ani indeksowania nawiasami.
Brakująca lub `null` wartość daje pusty tekst. Dane są wstawiane jako tekst,
nie HTML; atrybuty oraz zawartość `script`, `style` i `template` nie są
automatycznie interpolowane. Inne bindy i komendy nadrzędnego ViewModelu
pozostają dostępne. Bindy w wierszu są tylko model → widok; `mode: twoWay`
i `mode: oneWayToSource` są odrzucane.

Zapisuj dane przez referencje pobrane z `CollectionObserver`, np.
`items[0].details.status = 'Gotowy'`. Ich Proxy są stabilne dla danego
obserwatora, także dla współdzielonych obiektów i cykli. Wcześniejsze surowe
referencje nie przechwytują zapisów. Metody i zdarzenia zmian struktury
działają jak w `ArrayObserver`; rekordy zmian zawierają migawki elementów
przechowywanych w tablicy, które mogą być surowymi referencjami. Do dalszej
obserwowanej edycji pobierz element ponownie przez kolekcje.

Zwykle zagnieżdżone obiekty i instancje ViewModel są obserwowane. ViewModel zachowuje
poprawny dostęp do pól prywatnych: jego metody działają na oryginale, a
dekorowane accessory publikują zmiany przez `property-change`. Zmiany
niedekorowanych pól wykonywane wewnątrz takich metod nie są automatycznie
obserwowane; bezpośredni zapis przez Proxy jest obserwowany. Zwykle tablice
wewnątrz obiektów i inne instancje klas, np. `Date`, `Map` lub elementy DOM,
nie są głęboko obserwowane. Użyj osobnego `CollectionObserver` dla
zagnieżdżonej reaktywnej listy. Niekonfigurowalna, niezapisywalna własność
obiektu jest zwracana bez owijania, zgodnie z wymaganiami Proxy.

Zwykła tablica jako źródło jest migawka: jej mutacje nie są śledzone.
Ponownie opublikuj własność ViewModelu po zmianie tablicy lub elementów.
`null` i `undefined` oznaczają pusta listę; inny typ zgłasza błąd bez
usuwania poprzednio wyrenderowanych wierszy. Usuwanie wierszy, zmiana źródła
i `dispose()` zwalniają powiązane widoki oraz subskrypcje, ale nie niszczą
dostarczonych obiektów ani instancji ViewModel.

Opcjonalnie można obserwować zmiany elementów niezależnie od widoku:

```ts
const onItemChange = () => console.log('Zmieniono element');
items.subscribeItemChanges(onItemChange);
items.unsubscribeItemChanges(onItemChange);
```

Callback jest sygnałem zmiany, nie rekordem zmiany ani identyfikatorem
elementu. Wyjątki odbiorców są logowane, a pozostali odbiorcy nadal
otrzymują powiadomienie. `subscribeChanges` obserwuje zmiany struktury.

### 11.2 ArrayObserver

`ArrayObserver<T>` dziedziczy po `Array` i pozwala aktualizować widok bez
ustawiania całej tablicy ponownie:

Poniższe wywołania przedstawiają dostępne operacje, nie sekwencje wstawiania
tych samych instancji View do renderowanej listy:

```ts
const items = new ArrayObserver<IView>();

items.push(view);
items.unshift(view);
items.pop();
items.shift();
items.deleteItem(view);
items.splice(1, 0, anotherView);
items.insertAfter(0, anotherView);
items.clear();
```

`subscribeChanges` publikuje typ `CollectionChange<T>`:

```ts
type CollectionChange<T> =
  | { type: 'splice'; index: number; removed: readonly T[]; added: readonly T[] }
  | { type: 'reset'; previous: readonly T[]; current: readonly T[] };
```

Każda logiczna mutacja emituje jeden rekord. `push`, `unshift`, `pop`, `shift`,
`splice`, `clear`, `deleteItem` oraz bezpośrednie zapisy indeksowe i skrócenie
`length` emitują `splice` z indeksem i migawkami elementów. `sort`, `reverse`,
`fill` i `copyWithin` emitują `reset` z migawkami przed i po zmianie.
`ViewListController` aktualizuje bezpieczne wstawienia/usunięcia przyrostowo,
a pozostałe zmiany uzgadnia z DOM przez migawkę.

Przestawienie zachowanych elementów przez `ViewListController` zachowuje fokus
kontrolki oraz zakres i kierunek zaznaczenia tekstu w obsługujących je inputach
i textarea. Dotyczy też potomków widoku wielowęzłowego, `start`/`end` oraz
zmian źródła `ArrayObserver`. Przywrócenie używa `preventScroll` i następuje
przed zdarzeniami `ready`, których obsługa może celowo przenieść fokus.
Kontrolka usunięta z listy nie jest ponownie aktywowana. Renderer nie odbiera
fokusu innej aktywnej kontrolce ani nie wywołuje ponownie `focus`, jeśli
przestawiany element nadal jest aktywny. Nie jest to gwarancja braku zdarzeń
blur/focus podczas przenoszenia ani zachowania zaznaczenia w `contenteditable`.

Semantyka mutacji (zgodna z natywnym Array):

- Indeksy są obcinane zgodnie z ToInteger: NaN → 0, ułamki → Math.trunc,
  ±Infinity pozostaje bez zmian; ujemne indeksy liczą od końca.
- `splice()` bez argumentów to no-op; `splice(start)` usuwa od startu do
  końca; `splice(start, undefined, item)` i `splice(start, NaN, item)` nic
  nie usuwają, tylko wstawiają; `splice(start, undefined)` niczego nie zmienia.
  Rekord splice opisuje usunięcie i wstawienie atomowo jednym indeksem.
- pop/shift emitują rekord usunięcia zawsze, gdy tablica nie jest pusta -
  również dla elementu o wartości undefined.
- `insertAfter(index, ...items)` wymaga całkowitego indeksu z zakresu
  -1 .. length - 1 (index = -1 wstawia na początku); inne wartości
  (NaN, ±Infinity, ułamki, length) rzucają RangeError. Pusta lista
  elementów to no-op bez wyjątku.
- Bezpośrednie przypisanie do istniejącego indeksu, przypisanie pod
  `items.length` oraz skrócenie `items.length` emitują rekord `splice`.
- Zapis tworzący lukę (`items[index] = value` dla `index > length`),
  zwiększenie `length` i `delete items[index]` dla istniejącego elementu
  rzucają błąd bez zmiany kolekcji. Używaj push/splice/deleteItem, aby
  zachować gęsty układ elementów.
- Typ zdarzeń jest tylko do odczytu, a każdy callback otrzymuje własne kopie
  migawek. Reentrant mutacje są dostarczane wszystkim subskrybentom bieżącego
  rekordu przed dostarczeniem kolejnego zdarzenia.

### 11.3 Wielu subskrybentów

```ts
const callback = (change: CollectionChange<IView>) => handleChange(change);

items.subscribeChanges(callback);
items.unsubscribeChanges(callback);
```

Ponowne dodanie tej samej funkcji nie tworzy duplikatu. Wyjątki odbiorcy są
logowane i nie przerywają powiadamiania pozostałych. Stare API `subscribe`,
`unsubscribe`, `changeCallback` i `ChangeType` zostało zastąpione przez ten
protokół.

### 11.4 Tablica widoków

```ts
@propertyChange()
accessor itemsView = new ArrayObserver<IView>();
```

```html
<div data-bind="{innerHTML: itemsView}"></div>
```

Rozróżniaj:

```text
items.deleteItem(view) -> widok jest odpinany z DOM
view.dispose()         -> widok przestaje istnieć
```

Usuniecie z kolekcji odpina widok, ale pozostawia decyzje o dispose aplikacji.
Zmiana lub dispose bindingu `innerHTML` również odpina zarządzane widoki bez
niszczenia ich (sekcja 7).

## 12. Cykl życia i pamięć

### Odporność na błędy inicjalizacji i sprzątania

`SelectedValuesBinding` wycofuje rejestrację, obserwator `change` i obserwator,
jeśli inicjalizacja nie powiedzie się. Zgłasza pierwotny wyjątek również wtedy,
gdy odłączanie obserwatora rzuci kolejny błąd. Ponowna próba dla tego samego
select jest możliwa; konflikt z już istniejącym bindingiem nie usuwa jego
rejestracji ani obserwatora. Kod zakłada działające natywne mechanizmy odpinania
obserwatorów; po błędzie zależności każda operacja sprzątania jest podejmowana
niezależnie od pozostałych.

`ViewModel.dispose()` najpierw usuwa właściwości, komendy, walidatory, stan
walidacji i dotychczasowe subskrypcje. Następnie powiadamia odbiorców
`subscribeCommands` o usuniętych komendach, korzystając z migawki odbiorców
z początku sprzątania. Każdy odbiorca otrzymuje każdą usuniętą nazwę komendy,
nawet jeśli wcześniejszy odbiorca rzuci wyjątek lub wypisze się podczas
powiadomienia. Odbiorcy widzą już wyczyszczony model.

Błędy tych callbacków są zbierane i zgłaszane na końcu jako
`ViewModelDisposalError` (eksport z `viewModel.ts`). Jego niemodyfikowalna
tablica `errors` zachowuje oryginalne rzucane wartości i kolejność ich
wystąpienia. Dotyczy to również pojedynczego błędu oraz wartości innych niż
`Error`. Bez błędów `dispose()` kończy się normalnie. Powtórne i zagnieżdżone
wywołanie nie wykonuje ponownie sprzątania ani powiadomień.

Ten kontrakt dotyczy bezpośredniego `ViewModel.dispose()`; nadrzędny mechanizm
sprzątający może obsłużyć wyjątek według własnych zasad. Nie zmienia to
`ownsDataContext`: widok współdzielący model nie przejmuje jego własności.
Po `dispose()` model zakończył cykl życia - nie należy go ponownie rejestrować
ani dodawać mu subskrypcji, także wewnątrz callbacków sprzątania.

### 12.1 `detach()`

```ts
view.detach();
```

Usuwa węzły z DOM-u, ale zachowuje ViewModel, bindy, commandy, walidatory i
subskrypcje `ArrayObserver`. Używaj przy przejściach, ukrywaniu i ponownym
wstawianiu widoku.

### 12.2 `dispose()` View

```ts
view.detach();
view.dispose();
```

Oznacza koniec życia widoku. `View` najpierw odpina węzły z DOM (`detach()`),
następnie uruchamia teardown bindingów, komend, obserwatorów walidacji, eventów
ViewModelu i subskrypcji ArrayObserver. W końcu czyści `viewNodeList` oraz
mapy `properties` i `errors`, a pole `_dataContext` zostaje
ustawione na `undefined` - po dispose nie ma już żadnych aktywnych subskrypcji
ani odniesień do danych.

`ownsDataContext` domyślnie wynosi **true**, więc niszczy też dataContext
dokładnie raz (nawet przy ponownym wywołaniu dispose). Możesz to ustawić
w konstruktorze przez `options.ownsDataContext` lub jako pole
`view.ownsDataContext`. Dla współdzielonego modelu ustaw **false** i
sprzątaj model u jego właściciela, po zakończeniu pracy wszystkich widoków -
takie View nie niszczą współdzielonego modelu.

Dispose jest idempotentne - powtórna wywołanie nic nie robi. Ponieważ dispose
odpina węzły, nie musisz wywołać `detach()` wcześniej, ale detach pozostaje
przydatny przy ponownym wstawianiu widoku przed jego zniszczeniem.

Nie wolno po tym ponownie wstawiać tego samego View, ponieważ jego aktywne
subskrypcje zostały usunięte.

### 12.3 `ViewModel.dispose()`

Bazowy ViewModel jest idempotentny i czyści `properties`, `commands`,
`validators` oraz stare event targety. Po dispose nie należy go ponownie używać.
Usunięcie walidatorów pola czyści jego zapisany wynik i resetuje prezentację.
`dispose()` zwalnia wszystkie zapisane stany walidacji.

Klasa potomna musi czyścić własne pola przed `super.dispose()`:

```ts
public dispose(): void {
  this.items?.clear();
  this.childViewModel?.dispose();
  super.dispose();
}
```

Nie rób:

```ts
super.dispose();
this.items.clear();
```

Po `super.dispose()` dekorowane property może zwracać `undefined`.

### 12.4 CompositeDisposable

```ts
private readonly disposables = new CompositeDisposable();

constructor() {
  super();
  const callback = this.onExternalChange.bind(this);
  externalSource.subscribe(callback);
  this.disposables.add(() => externalSource.unsubscribe(callback));
}

public dispose(): void {
  this.disposables.dispose();
  super.dispose();
}
```

Teardowny są wykonywane w odwrotnej kolejności rejestracji, a kolejne dispose
nie wykonuje ich ponownie.

**Uwaga:** Gdy `CompositeDisposable` już został zwolniony, kolejne wywołanie
`add(teardown)` **natychmiast wykonuje** teardown (zamiast go przechowywać).
Zapobiega to wyciekowi, gdy sprzątanie jest dodane zbyt późno.

## 13. Fabryki i widgety

### 13.1 ViewFactory

`ViewFactory` to prosta fabryka tworząca `View`:

```ts
import { ViewFactory } from 'mvvm-dom';

const viewFactory = new ViewFactory();
const view = viewFactory.getViewById('templateId', viewModel);
const source = viewFactory.getTemplateById('templateId');
const anotherView = viewFactory.getView(source, viewModel, { ownsDataContext: false });
```

`getViewById` wyszukuje element po ID i tworzy widok; `getTemplateById`
zwraca sam element, np. dla konstruktora klasy dziedziczącej po `View`.
Obie metody wyszukiwania zgłaszają błąd z ID, gdy element nie istnieje lub
nie jest `HTMLElement`. `getView` przyjmuje wyłącznie element, a kontekst
i opcje są opcjonalne. Niepoprawne źródło jest odrzucane również w runtime.

Zmiana API: dawne `new View('templateId', model)` zastąp przez
`new View(viewFactory.getTemplateById('templateId'), model)` albo
`viewFactory.getViewById('templateId', model)`. Dawne
`viewFactory.getView('templateId', model)` zastąp `getViewById`.
String nie jest interpretowany jako ID ani kod HTML przez `View` lub `getView`.

### 13.2 ViewModelFactoryBase

`ViewModelFactoryBase` to abstrakcyjna fabryka instancji ViewModel wybieranych po nazwie:

```ts
import { ViewModelFactoryBase } from 'mvvm-dom';

class MyViewModelFactory extends ViewModelFactoryBase {
  protected getViewModelHandler() {
    return {
      'myViewModel': MyViewModel,
      'otherViewModel': OtherViewModel
    };
  }
}

const factory = new MyViewModelFactory();
const vm = factory.getViewModel('myViewModel', ...args);
```

Gdy nazwa nie istnieje w mapie, fabryka rzuca wyjątek.

## 14. Właściciel widoku

Obiekt, który tworzy ViewModel/View, powinien wiedzieć, kiedy je niszczyć.
ArrayObserver sam nie niszczy swoich elementów. Ścieżka resetu bindingu
innerHTML też nie niszczy widoków: odpina węzły z DOM i zwalnia kontroler
listy, ale `dispose()` widoku wywołuje jego właściciel. Przyjmij tę zasadę w
zarządzaniu własnością - każde odpięcie zachowuje widok. Poniższy przykład
montuje pojedynczy View bezpośrednio w DOM:

```ts
private formViewModel = new FormViewModel();
private formView = new ViewFactory().getViewById('formTemplate', this.formViewModel);

showForm(container: HTMLElement) {
  container.append(...this.formView.viewNodeList);
}

hideForm() {
  this.formView.detach();
}

destroyForm() {
  this.formView.detach();
  this.formView.dispose();
}
```

Przy domyślnym ownsDataContext model jest niszczony przez View. Gdy ustawisz
false, właściciel musi dodatkowo zniszczyć model po odpięciu wszystkich widoków.

## 15. Dynamiczne formularze

Trzymaj osobno obserwowana kolekcje widoków i dane formularzy:

```ts
@propertyChange()
accessor formsView = new ArrayObserver<IView>();

formViewModels: FormItemViewModel[] = [];
```

Przy całkowitej przebudowie najpierw wyczyść obserwowana kolekcje, aby renderer
odpiął widoki. Potem dispose'uj elementy, które nie będą ponownie użyte,
wyczyść listę modeli i dopiero twórz nowe obiekty.

```ts
const oldViews = this.formsView.clear(); // Najpierw renderer odpina węzły.
for (const oldView of oldViews) {
  oldView.detach();
  oldView.dispose();
}

this.formViewModels = [];
```

Jeśli elementy są współdzielone, usuń je z kolekcji bez dispose i pozostaw
niszczenie właścicielowi. Gdy ownsDataContext=false, samo wyczyszczenie
formViewModels nie niszczy modeli - trzeba zrobić to oddzielnie.

## 16. Dobre praktyki

- Trzymaj stan w ViewModelu, a DOM w View.
- Używaj `setPropertyValueAndNotify`, gdy zmiana ma trafić do View.
- Używaj `text` dla danych użytkownika; `innerHTML` tylko dla zaufanego HTML.
- Zapisuj callbacki jako pola i używaj tej samej referencji przy usuwaniu.
- Każdy obserwator `window`, `document` i `MediaQueryList` musi mieć teardown.
- Nie twórz nowych instancji ViewModel przy każdym renderze, jeśli widok jest tylko przełączany.
- Waliduj ponownie przez `validate()` tuż przed submit.
- Nie dispose'uj widoku tylko dlatego, że został wyjęty z DOM.
- Jedno miejsce powinno być właścicielem danego ViewModelu i jego View.
- Rejestruj konwertery wartości przed utworzeniem View, który z nich korzysta.

## 17. Typowe błędy

### Widok przestał reagować

Prawdopodobnie wykonano `dispose()` zamiast `detach()` przy ponownym użyciu.

### `Cannot read properties of undefined` w dispose

Sprawdź, czy klasa potomna nie używa dekorowanego property po `super.dispose()`.
Kolejność musi być: dzieci i kolekcje, potem `super.dispose()`.

### Lista duplikuje elementy

Bind `innerHTML` uzgadnia pełną migawkę i odpina poprzednie źródło przy jego
zmianie. Sprawdź, czy w kolekcji nie ma powtórzonej referencji albo węzłów
nakładających się między pozycjami. Szczegóły w sekcjach 7 i 11.

### Command wykonuje się wielokrotnie

Sprawdź duplikaty View, brak dispose starego View oraz różne referencje
`bind(this)` w subscribe/unsubscribe.
Dla ready pamiętaj, że zdarzenie nie bąbelkuje i jest emitowane raz na element
na kontroler (sekcja 9.1).

### Pole nie zapisuje wartości po dodaniu komendy

Sprawdź, czy binding value/checked ma ustawiony `mode` (`twoWay` lub `oneWayToSource`) i
triggerType zgodny z komendą (`input`/`change`/`click`). Bindingi są podpinane przed
komendami, więc wartość powinna zostać zapisana przed wykonaniem komendy
(sekcja 9.5).

### Walidator nie działa

Sprawdź dekorator, nazwę property, wspólny `dataContext`, wykonanie setteru i
wywołanie `validate()` przed submit.

Jeśli pojawia się błąd fabryki, sprawdź również typ w `data-validate-error`.
Fabryka obsługuje typy `class`, `message` oraz zachowany ze względów kompatybilności
alias `click`. Nieznany typ nie zostanie zamieniony na domyślny element.

### View nie tworzy się po zmianie template

Sprawdź konsolę. Przy fail-fast komunikat zawiera typ oraz nazwę property albo
commandu. Najczęstsze przyczyny to:

- literówka w nazwie typu;
- inna wielkość liter;
- command nieobsługiwany przez `CommandBindingFactory`;
- custom bind, który nie został zarejestrowany przed utworzeniem View;
- dwukrotna rejestracja tej samej nazwy custom bindu.

### Konwerter nie działa

- Sprawdź, czy konwerter został zarejestrowany (`registerConverter`) przed
  utworzeniem View.
- Sprawdź, czy property ma dekorator `@convert` z poprawną nazwą konwertera.
- Sprawdź, czy `mode` pozwala na kierunek, w którym oczekujesz konwersji
  (`convertBack` działa tylko przy `oneWayToSource` / `twoWay`).
- Nazwy konwerterów są case-sensitive.

## 18. Debugowanie

Gdy wartość nie trafia do DOM:

1. Sprawdź template i `data-bind`.
2. Sprawdź nazwę property w ViewModelu.
3. Sprawdź `setPropertyValueAndNotify` albo setter dekoratora.
4. Sprawdź `mode`.
5. Sprawdź factory i wielkość liter.
6. Sprawdź, czy View nie został zwolniony.
7. Dla list sprawdź subskrypcje `ArrayObserver`.
8. Jeśli property ma `@convert`, sprawdź, czy konwerter jest zarejestrowany
   i czy `convert` zwraca oczekiwaną wartość.

Gdy command nie działa:

1. Sprawdź nazwę w `data-command` i ViewModelu.
2. Sprawdź typ eventu.
3. Sprawdź, czy View nie został zwolniony.
4. Sprawdź, czy obserwator globalny został poprawnie podpięty.

## 19. Checklista przed usunięciem

```text
Czy ten View będzie jeszcze kiedyś użyty?
```

Jeśli tak:

```ts
view.detach();
```

Jeśli nie:

```ts
view.detach();
view.dispose();
```

Najważniejsza zasada:

```text
detach = czasowo odczep
dispose = zakończ życie
```
