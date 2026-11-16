# Budowanie i testowanie

Do pracy ze źródłami potrzebne są Git, Node.js 24 i npm. Node jest narzędziem
developerskim; działanie widoków wymaga DOM w przeglądarce. Pakiety
developerskie są określone w `package-lock.json`; biblioteka nie ma
zależności wykonawczych.

W katalogu głównym projektu:

```sh
npm ci
npm run types
npm test
npm run coverage
npm run build
```

`npm run test:watch` uruchamia testy w trybie obserwacji. Raport pokrycia
znajduje się w `coverage/`. Same zielone testy nie stanowią gwarancji
pełnego pokrycia.

## Prawdziwa przeglądarka

```sh
npx playwright install chromium
npm run test:browser
```

Playwright uruchamia tymczasowy serwer Vite na `127.0.0.1:4179`, więc port
musi być wolny. Testy obejmują Chromium; nie deklarują zgodności z innymi
przeglądarkami. Raport HTML znajduje się w `playwright-report/`, a ślady
błędów w `test-results/`.

`npm run test:package` instaluje tarball w tymczasowym projekcie i sprawdza
import ESM w Node, deklaracje TypeScript oraz przykład w przeglądarce z Vite.
Wymaga wcześniej wykonanego builda i zainstalowanego Chromium.

```sh
npm run test:package
```

`npm run check` wykonuje kontrolę typów, testy jednostkowe, build, testy
przeglądarkowe i test paczki. Na Windows, gdy PowerShell blokuje `npm.ps1`, użyj
`npm.cmd` i `npx.cmd` zamiast `npm` i `npx`.

Nie włączaj `experimentalDecorators`: biblioteka korzysta ze standardowych
dekoratorów i auto-accessorów. Przy błędach instalacji najpierw sprawdź wersję
Node i wynik `npm ci`; nie osłabiaj asercji testów, aby uzyskać zielony wynik.

## Demo i GitHub Pages

```sh
npm run demo:dev
npx playwright install chromium firefox webkit
npm run test:demo
```

`test:demo` sprawdza typy dema, buduje samodzielny `docs-demo/index.html`,
a następnie testuje gotową stronę w Chromium, Firefox i WebKit, również
w emulowanym widoku mobilnym. Serwer testowy używa portu 4180 i ścieżki
`/mvvm-dom/`. Testy obejmują edycję zadań, walidację, zapis asynchroniczny
i jego anulowanie, reset, źródła przykładów, współdzielenie modeli, motyw,
odnośniki do sekcji oraz przepełnienie układu. Emulacja nie zastępuje testu
na fizycznym urządzeniu.

`npm run demo:build` tworzy jeden plik HTML działający także bez serwera.
Konfiguracja publikacji w GitHub jest utrzymywana poza tym repozytorium.
Do publikacji służy katalog `docs-demo`; wcześniej należy sprawdzić typy,
uruchomić testy jednostkowe i `npm run test:demo`. Dane dema istnieją tylko
w bieżącej sesji; localStorage przechowuje wyłącznie wybrany motyw.
