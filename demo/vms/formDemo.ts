import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import { OptionValue } from '@mvvm/index';
import type { ICommand } from '@mvvm/command';

const IMAGES = [

    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' rx='10' fill='%234f8cff'/><circle cx='36' cy='30' r='12' fill='white'/><path d='M16 62 a20 14 0 0 1 40 0' fill='white'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' rx='10' fill='%23ff7a59'/><path d='M20 20 L52 52 M52 20 L20 52' stroke='white' stroke-width='8'/></svg>",
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' rx='10' fill='%2336b37e'/><path d='M18 40 L32 54 L56 26' stroke='white' stroke-width='8' fill='none'/></svg>",
];

/** Form controls: value, readonly, checked, radio, options, selectedValues, attribute, submit. */
@autoRegisterCommands()
export class FormDemoModel extends ViewModel {
    
    @propertyChange()
    accessor name = 'Anna';

    @propertyChange()
    accessor isReadonly = false;

    @propertyChange()
    accessor plan = 'basic';

    @propertyChange()
    accessor languages = [
        new OptionValue('pl', 'Polski', true),
        new OptionValue('en', 'English', false),
        new OptionValue('de', 'Deutsch', false),
    ];

    @propertyChange()
    accessor langInfo = 'Polski';

    @propertyChange()
    accessor frameworks = [
        new OptionValue('signals', 'Signals', false),
        new OptionValue('mvc', 'Classic MVC', false),
        new OptionValue('mvvm', 'MVVM', true),
        new OptionValue('none', 'None', false),
    ];

    @propertyChange()
    accessor chosenFrameworks = ['mvvm'];

    @propertyChange()
    accessor chosenFrameworkText = 'MVVM';

    @propertyChange()
    accessor imageSrc = IMAGES[0];

    @propertyChange()
    accessor submitInfo = 'form not submitted yet';

    private imageIndex = 0;

    @command<FormDemoModel>('nextImage')
    private nextImage(_command: ICommand): void {

        this.imageIndex = (this.imageIndex + 1) % IMAGES.length;
        this.imageSrc = IMAGES[this.imageIndex];
    }

    @command<FormDemoModel>('submitForm')
    private submitForm(_command: ICommand): void {

        this.submitInfo = `submitted: name='${this.name}', plan='${this.plan}'`;
    }

    @command<FormDemoModel>('langChanged')
    private langChanged(_command: ICommand): void {

        const selected = this.languages.find(option => option.isSelected);
        this.langInfo = selected ? `${selected.value} (${selected.label})` : 'none selected';
    }

    @command<FormDemoModel>('syncFrameworks')
    private syncFrameworks(_command: ICommand): void {

        const labels = this.frameworks
            .filter(option => this.chosenFrameworks.includes(option.value))
            .map(option => option.label);
        this.chosenFrameworkText = labels.length ? labels.join(', ') : '(nothing)';
        
    }
}
