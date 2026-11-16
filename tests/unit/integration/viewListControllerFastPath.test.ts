import { describe, expect, it } from 'vitest';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { ViewListController } from '@mvvm/viewListController';

const el = (id: string): HTMLElement => {

    const e = document.createElement('i');
    e.id = id;
    return e;

};
const ids = (host: HTMLElement) => Array.from(host.children).map((c) => c.id).join(',');

describe('ViewListController – ścieżka przyrostowa', () => {

    it('push/unshift/splice/delete/sort dają poprawny DOM', () => {

        const host = document.createElement('div');
        const a = new ArrayObserver<HTMLElement>();
        const c = new ViewListController(host, 'end');
        c.setSource(a);
        const [x1, x2, x3, x4, x5] = ['1', '2', '3', '4', '5'].map(el);
        a.push(x2, x3);
        a.unshift(x1);
        a.push(x5);
        a.splice(3, 0, x4);
        expect(ids(host)).toBe('1,2,3,4,5');
        a.splice(1, 1);
        expect(ids(host)).toBe('1,3,4,5');
        a.reverse();
        expect(ids(host)).toBe('5,4,3,1');
        a.clear();
        expect(ids(host)).toBe('');

    });

    it('2000 push-y kończą się szybko (bez O(n²))', () => {

        const host = document.createElement('div');
        const a = new ArrayObserver<HTMLElement>();
        new ViewListController(host, 'end').setSource(a);
        const t = performance.now();
        for (let i = 0; i < 2000; i++) {
            a.push(el(String(i)));
        }
        expect(host.children.length).toBe(2000);
        // Budżet czasowy jest celowo hojny (wariant regression, nie benchmark):
        // wyłapuje tylko kwadratowy koszt wstawień, nie szum maszyny/CI.
        expect(performance.now() - t).toBeLessThan(1500);

    });

    it('uzgadnia DOM po bezposredniej zmianie indeksu, dopisaniu i skroceniu length', () => {

        const host = document.createElement('div');
        const a = new ArrayObserver<HTMLElement>();
        new ViewListController(host, 'end').setSource(a);
        const [first, second, replacement, appended] = ['1', '2', '3', '4'].map(el);
        a.push(first, second);

        a[0] = replacement;
        expect(ids(host)).toBe('3,2');

        a[a.length] = appended;
        expect(ids(host)).toBe('3,2,4');

        a.length = 1;
        expect(ids(host)).toBe('3');

    });
    
});
