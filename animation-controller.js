export class AnimationController {
    constructor(frameManager, outputUpdater, playPauseBtn, fpsControl) {
        this.frameManager = frameManager;
        this.outputUpdater = outputUpdater;
        this.playPauseBtn = playPauseBtn;
        this.fpsControl = fpsControl;
        
        this.state = {
            isPlaying: false,
            intervalId: null,
            currentFrame: 0
        };

        this.playPauseBtn.addEventListener('click', () => this.toggle());
    }

    toggle() {
        if (this.state.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    start() {
        const frames = this.frameManager.getFramesData();
        if (frames.length <= 1) return;

        this.state.isPlaying = true;
        this.playPauseBtn.textContent = 'Pause';

        const fps = parseInt(this.fpsControl.value, 10);
        const delay = 1000 / fps;

        // Initial update to highlight first frame
        this.outputUpdater(this.state.currentFrame);

        this.state.intervalId = setInterval(() => {
            this.state.currentFrame = (this.state.currentFrame + 1) % frames.length;
            this.outputUpdater(this.state.currentFrame);
        }, delay);
    }

    stop() {
        if (this.state.intervalId) {
            clearInterval(this.state.intervalId);
        }
        this.state.isPlaying = false;
        this.state.currentFrame = 0;
        this.outputUpdater(0); // Reset to first frame and remove highlight
        this.playPauseBtn.textContent = 'Play';
    }

    getCurrentFrame() {
        return this.state.currentFrame;
    }

    isPlaying() {
        return this.state.isPlaying;
    }
}