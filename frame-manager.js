import { generateScrambledText } from './text-scrambler.js';

export class FrameManager {
    constructor(framesList, onFrameChange) {
        this.framesList = framesList;
        this.onFrameChange = onFrameChange;
    }

    getFramesData() {
        return Array.from(this.framesList.querySelectorAll('.frame-item')).map(item => {
            const objectStates = [];
            // Collect any specific object states for this frame
            return {
                objectStates: objectStates,
                timestamp: Date.now()
            };
        });
    }

    updateFrameNumbers() {
        const frameItems = this.framesList.querySelectorAll('.frame-item');
        frameItems.forEach((item, index) => {
            const header = item.querySelector('h4');
            if (header) {
                header.textContent = `Scene Frame ${index + 1}`;
            }
        });
    }

    createFrameInput() {
        const item = document.createElement('div');
        item.className = 'frame-item';

        const header = document.createElement('div');
        header.className = 'frame-item-header';

        const title = document.createElement('h4');
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-frame-btn';
        removeBtn.textContent = 'Remove Scene';
        removeBtn.addEventListener('click', () => {
            item.remove();
            this.onFrameChange('remove');
            this.updateFrameNumbers();
        });
        
        header.appendChild(title);
        header.appendChild(removeBtn);

        const description = document.createElement('div');
        description.className = 'frame-description';
        description.textContent = 'Scene state will be captured automatically';

        item.appendChild(header);
        item.appendChild(description);
        
        this.framesList.appendChild(item);
        this.updateFrameNumbers();
        this.onFrameChange('add');
    }
}

