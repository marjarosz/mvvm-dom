import { View } from '@mvvm/view';
import type { ViewModel } from '@mvvm/viewModel';

/**
 * Mounts one demo section: clones the `<template>` into a `View`,
 * binds it to the section's ViewModel and appends the nodes to the host.
 */
export function mountSection(tplId: string, hostId: string, context: ViewModel): View {

    const template = document.getElementById(tplId);

    if (!(template instanceof HTMLTemplateElement)) {
        throw new Error(`Missing <template id="${tplId}">`);
    }

    const host = document.getElementById(hostId);

    if (!host) {
        throw new Error(`Missing host #${hostId}`);
    }

    const view = new View(template, context);

    host.append(...view.viewNodeList);

    return view;
}

export function requireTemplate(id: string): HTMLTemplateElement {

    const template = document.getElementById(id);

    if (!(template instanceof HTMLTemplateElement)) {
        throw new Error(`Missing <template id="${id}">`);
    }
    
    return template;
}
