import { View } from '@mvvm/view';
import { ViewModel } from '@mvvm/viewModel';
import { Command } from '@mvvm/command';
import { ArrayObserver } from '@mvvm/arrayObserver';
import { mountSection, requireTemplate } from './mount';
import { FormDemoModel } from './vms/formDemo';
import { TextDemoModel, ReadySubModel } from './vms/textDemo';
import { CollectionsDemoModel, ArrayDemoModel } from './vms/collectionsDemo';
import { ViewPanelsDemoModel } from './vms/viewPanelsDemo';
import { CommandsDemoModel } from './vms/commandsDemo';
import { ValidationDemoModel } from './vms/validationDemo';
import { ConvertersDemoModel } from './vms/convertersDemo';
import { CustomDemoModel } from './vms/customDemo';
import { DragDemoModel } from './vms/dragDemo';
import { ProjectDemoModel } from './vms/projectDemo';
import { LabDemoModel } from './vms/labDemo';
import { mountLifecycle } from './vms/lifecycleDemo';
import projectTemplate from './project.html?raw';
import labTemplate from './lab.html?raw';
import mainSource from './main.ts?raw';
import './workspaceBindings';
import './taskReorderBinding';
import taskReorderBindingSource from './taskReorderBinding.ts?raw';
import workspaceBindingsSource from './workspaceBindings.ts?raw';

const sourceFiles = import.meta.glob<string>('./vms/*.ts', { query: '?raw', import: 'default', eager: true });
const cleanups: (() => void)[] = [];

requireTemplate('projectTpl').innerHTML = projectTemplate;

requireTemplate('labTpl').innerHTML = labTemplate;

// Show the actual templates and model files rather than hand-maintained snippets.
for (const card of document.querySelectorAll<HTMLElement>('[data-example]')) {

    const details = document.createElement('details'); details.className = 'source-panel';
    const summary = document.createElement('summary'); summary.textContent = 'View source · HTML + TypeScript'; details.append(summary);
    const sources: [string, string][] = Array.from(card.querySelectorAll('template'), template => [`HTML · ${template.id}`, template.innerHTML.trim()]);
    
    for (const filename of (card.dataset.source ?? '').split(' ').filter(Boolean)) sources.push([`TypeScript · ${filename}`, sourceFiles[`./vms/${filename}.ts`] ?? '']);
    
    if (card.dataset.example === 'collections') sources.push(['TypeScript · viewPanelsDemo', sourceFiles['./vms/viewPanelsDemo.ts']]);
    
    if (card.dataset.example === 'project') sources.push(['TypeScript · custom modal and tab bindings', workspaceBindingsSource], ['TypeScript · task reorder command binding', taskReorderBindingSource]);
    
    if (['lifecycle', 'collections', 'text', 'drag'].includes(card.dataset.example ?? '')) sources.push(['TypeScript · mounting and ownership (main.ts)', mainSource]);
    
    for (const [label, source] of sources) {

        const heading = document.createElement('h4'); heading.textContent = label;
        const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = source;
        pre.append(code); details.append(heading, pre);
    }
    card.append(details);
}

type Example = { id: string; create: () => () => void };

const simple = (id: string, template: string, host: string, createModel: () => ViewModel): Example => ({

    id, create: () => { const view = mountSection(template, host, createModel()); return () => view.dispose(); }

});
const examples: Example[] = [
    
    simple('project', 'projectTpl', 'projectHost', () => new ProjectDemoModel()),

    simple('forms', 'formTpl', 'formHost', () => new FormDemoModel()),

    simple('commands', 'cmdsTpl', 'cmdsHost', () => new CommandsDemoModel()),

    simple('validation', 'validTpl', 'validHost', () => new ValidationDemoModel()),

    simple('converters', 'convTpl', 'convHost', () => new ConvertersDemoModel()),

    simple('extensions', 'customTpl', 'customHost', () => new CustomDemoModel()),

    simple('lab', 'labTpl', 'labHost', () => new LabDemoModel()),

    { id: 'text', create: () => {

        const model = new TextDemoModel(); const ready = model.readyModel;
        const child = new View(requireTemplate('readyTpl'), new ReadySubModel());
        model.registerProperty('subView', child);
        const view = mountSection('textTpl', 'textHost', model);
        return () => { view.dispose(); child.dispose(); ready.dispose(); };
    } },
    { id: 'collections', create: () => {

        const list = mountSection('tasksTpl', 'tasksHost', new CollectionsDemoModel());
        const tags = new ArrayDemoModel();
        const makeTag = (text: string) => { const span = document.createElement('span'); span.className = 'chip'; span.textContent = text; return span; };
        const items = new ArrayObserver<HTMLElement>(...['mvvm', 'dom', 'binding'].map(makeTag));
        tags.registerProperty('tagEls', items); let serial = 3;
        tags.registerCommand('addTag', new Command(() => { items.push(makeTag(`tag-${++serial}`)); tags.tagInfo = `${items.length} tags · incremental push`; }));
        tags.registerCommand('removeTag', new Command(() => { items.splice(0, 1); tags.tagInfo = `${items.length} tags · incremental splice`; }));
        const view = mountSection('tagsTpl', 'tagsHost', tags);
        const panels = mountSection('workPanelsTpl', 'workPanelsHost', new ViewPanelsDemoModel());
        return () => { panels.dispose(); view.dispose(); list.dispose(); };

    } },
    { id: 'drag', create: () => {

        const model = new DragDemoModel();
        model.registerProperties({ chipOne: 'chip one', chipTwo: 'chip two' });
        model.registerCommand('addAccessible', new Command(command => {
            model.received.push({ label: String(command.commandData.parameter) });
            model.dropNote = `${model.received.length} items received via accessible action`;
        }));
        const view = mountSection('dragTpl', 'dragHost', model); return () => view.dispose();

    } },
    { id: 'lifecycle', create: () => mountLifecycle(document.getElementById('lifeHost')!) }
];
for (const example of examples) {

    let release = example.create();
    const button = document.querySelector<HTMLButtonElement>(`[data-reset="${example.id}"]`)!;
    const reset = () => { release(); release = example.create(); };
    button.addEventListener('click', reset);
    cleanups.push(() => { button.removeEventListener('click', reset); release(); });

}

// Native dragstart supplies DataTransfer; mvvm-dom handles dragover/leave/drop.
const dragHost = document.getElementById('dragHost')!;
const dragStart = (event: DragEvent) => {

    const source = (event.target as HTMLElement).closest<HTMLElement>('[data-draglabel]');
    if (!source || !event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('text/plain', source.dataset.draglabel ?? '');

};

dragHost.addEventListener('dragstart', dragStart);
cleanups.push(() => dragHost.removeEventListener('dragstart', dragStart));

// Page controls are themselves a View with commands and reactive state.
const shell = new ViewModel();

let dark = matchMedia('(prefers-color-scheme: dark)').matches;

try { 
    const saved = localStorage.getItem('mvvm-demo-theme'); 
    if (saved) dark = saved === 'dark'; 
} catch { /* Storage is optional. */ }

const applyTheme = () => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; shell.setPropertyValueAndNotify('themeLabel', dark ? 'Light mode ☀' : 'Dark mode ◐'); };

shell.registerProperties({ themeLabel: '', copyLabel: 'Copy install command', menuExpanded: 'false' });

shell.registerCommand('theme', new Command(() => { dark = !dark; applyTheme(); try { localStorage.setItem('mvvm-demo-theme', dark ? 'dark' : 'light'); } catch { /* Storage is optional. */ } }));

shell.registerCommand('menu', new Command(() => { const open = document.body.classList.toggle('nav-open'); shell.setPropertyValueAndNotify('menuExpanded', String(open)); }));

shell.registerCommand('copy', new Command(async () => {
    try { 
        await navigator.clipboard.writeText('npm install mvvm-dom'); 
        shell.setPropertyValueAndNotify('copyLabel', 'Copied!'); 
    } catch { 
        shell.setPropertyValueAndNotify('copyLabel', 'Select the command to copy'); 
    }
}));

applyTheme();

const shellView = mountSection('shellTpl', 'shellHost', shell); cleanups.push(() => shellView.dispose());
const nav = document.getElementById('section-nav')!;

const closeMenu = () => { document.body.classList.remove('nav-open'); shell.setPropertyValueAndNotify('menuExpanded', 'false'); };
nav.addEventListener('click', closeMenu);

const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenu(); };
document.addEventListener('keydown', escape);
const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a'));

const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    for (const link of links) { if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); }
}, { rootMargin: '-15% 0px -65% 0px' });

for (const section of document.querySelectorAll('[data-example], #getting-started')) observer.observe(section);

cleanups.push(() => { observer.disconnect(); nav.removeEventListener('click', closeMenu); document.removeEventListener('keydown', escape); });

const dispose = () => { for (const release of cleanups.splice(0).reverse()) release(); };

window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });

if (import.meta.hot) import.meta.hot.dispose(dispose);
// Native fragment scrolling may run before template views have their final height.

requestAnimationFrame(() => {
    if (location.hash) {

        try { 
            document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' }); 
        } catch { /* Ignore malformed incoming fragment identifiers. */ }

    }
});
