
```javascript
export class UIController {
    constructor(controls, valueDisplays) {
        this.controls = controls;
        this.valueDisplays = valueDisplays;

        this.setupEventListeners();
    }

    setupEventListeners() {
        for (const key in this.controls) {
            this.controls[key].addEventListener('input', () => {
                this.updateValueDisplays();
                if (this.onSettingsChange) {
                    this.onSettingsChange();
                }
            });
        }
    }

    setOnSettingsChange(callback) {
        this.onSettingsChange = callback;
    }

    updateValueDisplays() {
        for (const key in this.valueDisplays) {
            if (this.valueDisplays[key] && this.controls[key]) {
                this.valueDisplays[key].textContent = this.controls[key].value;
            }
        }
    }
}