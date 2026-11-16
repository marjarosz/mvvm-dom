import { ViewModel } from '@mvvm/viewModel';
import { propertyChange } from '@mvvm/propertyDecorators';
import { convert, registerConverter } from '@mvvm/valueConverter';
import { autoRegisterCommands, command } from '@mvvm/commandDecorators';
import type { ICommand } from '@mvvm/command';

// Global named converter: value -> CSS class, applied via the class binding.
registerConverter('statusClass', {
    convert: (value) => (value === 'done' ? 'chip-done' : value === 'active' ? 'chip-active' : 'chip-new'),
});

// Two-way converter: the View sees Fahrenheit, the ViewModel keeps Celsius.
registerConverter('celsiusToFahrenheit', {

    convert: (value) => (typeof value === 'number' ? Math.round(value * 9 / 5 + 32) : value),
    convertBack: (value) => {
        const n = parseFloat(String(value));
        return Number.isNaN(n) ? 0 : Math.round((n - 32) * 5 / 9);
    },

});

/** Converters: registerConverter + @convert on accessors (one-way and two-way flows). */
@autoRegisterCommands()
export class ConvertersDemoModel extends ViewModel {

    @propertyChange()
    @convert('statusClass')
    accessor status = 'new';

    @propertyChange()
    accessor statusRaw = 'new';

    @propertyChange()
    @convert('celsiusToFahrenheit')
    accessor temperatureC = 20;

    @propertyChange()
    accessor tempNote = 'model holds 20 °C';

    @command<ConvertersDemoModel>('syncTemp')
    private syncTemp(_command: ICommand): void {

        this.tempNote = `model holds ${this.temperatureC} °C`;
    }

    @command<ConvertersDemoModel>('cycleStatus')
    private cycleStatus(_command: ICommand): void {
        
        this.statusRaw = this.statusRaw === 'new' ? 'active' : this.statusRaw === 'active' ? 'done' : 'new';
        this.status = this.statusRaw;
    }
}
