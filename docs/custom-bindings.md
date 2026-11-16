# MVVM - dodawanie własnych bindingów

Przykłady używają publicznego API pakietu `mvvm-dom`.

## Podział odpowiedzialności

Binding implementuje zachowanie elementu. `View` łączy go z kontekstem,
przekazuje wartości, stosuje konwertery dla zwykłych bindingów i zarządza
subskrypcjami. Dodanie bindingu nie wymaga gałęzi warunkowej w `View` ani
importowania `View` przez binding. Rejestruj fabrykę przed utworzeniem widoków.

## Binding zwykły - atrybut aria-label

Poniższy kompletny moduł dodaje binding działający z modelu do DOM.

```ts
import { Binding } from 'mvvm-dom';
import { BindingMode } from 'mvvm-dom';
import { BindingFactory } from 'mvvm-dom';

export class AriaLabelBinding extends Binding {
  constructor(element: HTMLElement, propertyName: string, args: string[]) {
    super(element, propertyName, args);
    if (this.mode !== BindingMode.OneWay) {
      throw new Error('ariaLabel supports only mode: oneWay');
    }
    if (Object.keys(this.args).length) {
      throw new Error('ariaLabel does not accept extra arguments');
    }
  }

  setValue(value: unknown): void {
    if (value == null) this.element.removeAttribute('aria-label');
    else this.element.setAttribute('aria-label', String(value));
  }
}

BindingFactory.registerBinding('ariaLabel', (element, name, args) =>
  new AriaLabelBinding(element, name, args));
```

```html
<button data-bind="{ariaLabel: accessibleName}">Zapisz</button>
```

Klasa bazowa zapewnia parsowanie `mode`, subskrypcje oraz idempotentne
sprzątanie własnych listenerów zdarzeń bindingu. Nie sprząta automatycznie
listenerów DOM ani observerów utworzonych przez klasę potomną.

Dla kierunku zwrotnego nasłuchuj odpowiedniego zdarzenia tylko w
`OneWayToSource`/`TwoWay` i wywołaj chronione `dispatchEvent(value)`.
Nie zapisuj samodzielnie do ViewModelu: koordynacja zapisu, konwersja wsteczna
i powiadomienia należą do istniejącej infrastruktury. `setValue` powinno
aktualizować DOM bez bezwarunkowego emitowania zdarzenia zwrotnego.

## Binding strukturalny - gałąź dla stanu ready

Binding strukturalny dostaje `IBindingFragment`, a nie instancję `View`.

```ts
import { BindingFactory } from 'mvvm-dom';
import type { IBindingFragment, IStructuralBinding } from 'mvvm-dom';

export class WhenReadyBinding implements IStructuralBinding {
  constructor(private readonly fragment: IBindingFragment, args: string[]) {
    if (args.length) throw new Error('whenReady does not accept arguments');
  }

  setValue(value: unknown): void {
    if (value === 'ready') this.fragment.mount();
    else this.fragment.unmount();
  }
}

BindingFactory.registerStructuralBinding('whenReady', (fragment, _name, args) =>
  new WhenReadyBinding(fragment, args));
```

```html
<section data-bind="{whenReady: status}">
  <span data-bind="{text: title}"></span>
  <button data-command="{click: save}">Zapisz</button>
</section>
```

Fragment zarządza kotwicą i instancją gałęzi. `unmount()` usuwa gałąź wraz
z jej bindingami i komendami; kolejne `mount()` tworzy nowy DOM. Model jest
pożyczony. Właścicielem fragmentu jest infrastruktura widoku, nie custom
binding. Opcjonalne `dispose()` bindingu służy jego własnym zasobom.

`setValue` otrzymuje surową wartość modelu: strukturalne bindingi nie korzystają
z automatycznych konwerterów zwykłych bindingów. Jeden element może mieć jeden
binding strukturalny i dodatkowe zwykłe bindingi. Oba rejestry współdzielą
przestrzeń nazw; powtórna rejestracja jest błędem, nie nadpisaniem.

Dla kolekcji fragment udostępnia opcjonalne `createChild` i `setChildren`.
Sprawdź ich dostępność przed użyciem. Dziecko utworzone, lecz nieprzekazane
fragmentowi z powodu błędu, musi zostać zwolnione przez tworzącego.
`setChildren` zachowuje przekazane instancje i zwalnia pominięte dzieci.

## Własny bind zdarzeń komendy - dwuklik

Typ bindu komend rejestruje się w `CommandBindingFactory`; korzysta z niego
atrybut `data-command`. Przestrzeń nazw rejestru komend jest oddzielna od
rejestrów bindingów.

```ts
import { CommandBindingFactory, EventCommandBinding } from 'mvvm-dom';
import type { ICommandActionEventTarget, IEventCommandBinding } from 'mvvm-dom';

export class DblClickCommandBinding extends EventCommandBinding implements IEventCommandBinding {
  private dblCallback = this.dblClickElement.bind(this);

  constructor(element: HTMLElement, commandName: string, argList: string[], eventTarget: ICommandActionEventTarget) {
    super(element, commandName, argList, eventTarget);
    this.element.addEventListener('dblclick', this.dblCallback);
  }

  private dblClickElement(event: Event): void {
    this.eventTarget.commandAction(this.commandName, this.element, event);
  }

  public override dispose(): void {
    this.element.removeEventListener('dblclick', this.dblCallback);
    super.dispose();
  }
}

CommandBindingFactory.registerCommandBinding('dblClick',
  (element, name, args, eventTarget) => new DblClickCommandBinding(element, name, args, eventTarget));
```

```html
<button data-command="{dblClick: save}">Edytuj</button>
```

Klasa bazowa `EventCommandBinding` parsuje argumenty `nazwa:wartość` do `args`,
zarządza subskrypcjami `command-action` i sprząta je w `dispose()`. Fabryka
dostaje zawsze podstawiony `eventTarget`. Bind ma tylko nasłuchiwać swojego
zdarzenia i wywołać `eventTarget.commandAction(...)`; wykonanie komendy,
`canExecute` i parametr `parameter` obsługuje nieświadomy typu
`CommandBindingCoordinator`.

## Własny bind błędu walidacji - aria-invalid

Typ bindu błędu rejestruje się w `ValidationErrorBindingFactory`; korzysta z
niego atrybut `data-validate-error`. Przestrzeń nazw tego rejestru jest
oddzielna; nazwy `class`, `message` i alias `click` są zajęte.

```ts
import { ValidationErrorBinding, ValidationErrorBindingFactory } from 'mvvm-dom';
import type { IValidationErrorBinding } from 'mvvm-dom';

export class AriaInvalidErrorBinding extends ValidationErrorBinding implements IValidationErrorBinding {
  setValid(isValid: boolean, message?: string): void {
    super.setValid(isValid, message);
    this.element.setAttribute('aria-invalid', isValid ? 'false' : 'true');
    this.element.title = isValid ? '' : (message ?? '');
  }

  reset(): void {
    super.reset();
    this.element.setAttribute('aria-invalid', 'false');
    this.element.title = '';
  }
}

ValidationErrorBindingFactory.registerValidationErrorBinding('ariaInvalid',
  (element, name, args, eventTarget) => new AriaInvalidErrorBinding(element, name, args, eventTarget));
```

```html
<input data-bind="{value: name}" data-validate-error="{ariaInvalid: name}">
```

Klasa bazowa zarządza subskrypcjami `error-change` i parsowaniem argumentów.
`setValid`/`reset` wywołuje `View` w reakcji na stan walidacji właściwości -
bind ma jedynie renderować DOM.

## Inicjalizacja i zasoby

`beginInitialization()` i `endInitialization()` należą do zwykłego `IBinding`.
Pierwsza metoda jest wywoływana po konstrukcji, przed ustawieniem wartości;
druga po przygotowaniu zwykłych bindingów i subskrypcji. Przy błędzie nie ma
gwarancji wywołania `endInitialization()` - `dispose()` musi działać także
przed nią.

Jeżeli konstruktor lub fabryka rzuci przed zwróceniem instancji, sama wycofuje
częściową inicjalizację. `View` nie ma jeszcze obiektu, który mógłby zwolnić.
Każdy nabyty zasób musi mieć symetryczne sprzątanie. Błąd rollbacku nie powinien
zasłonić pierwotnego błędu inicjalizacji. Przykładem produkcyjnym jest
binding `selectedValues`.

## Kryteria odbioru rozszerzenia

- Początkowa wartość i późniejsza zmiana dają oczekiwany DOM.
- Obsługiwane kierunki nie powodują pętli; nieobsługiwane są jawnie odrzucone.
- Brak lub niepoprawny argument ma określone zachowanie.
- `dispose()` odpina zasoby; powtórzenie jest bezpieczne.
- Błąd każdego etapu inicjalizacji pozwala ponowić tworzenie.
- Gałąź strukturalna zachowuje działanie zagnieżdżonych bindingów i komend
  po ponownym montażu oraz nie niszczy współdzielonego modelu.

Instrukcja uruchomienia: [testy MVVM](testing.md).

## Weryfikacja przykładów

Wszystkie kompletne moduły TypeScript sprawdzono w trybie strict bez błędów.
W Chrome sprawdzono wspólny scenariusz: brak gałęzi na początku, montaż,
ustawienie aria-label, aktualizacja tekstu, demontaż i ponowny montaż z
bieżącymi danymi. Było to izolowane wykonanie przykładów, nie pełna suita
Vitest ani projektowe Playwright. Przykłady `dblClick` i `ariaInvalid` mają odpowiednik w testach Vitest:
plik `tests/unit/integration/customRegistries.test.ts` rejestruje te same typy
i sprawdza je przez `View`.
