export class GifGenerator {
    constructor(frameManager, renderer, scene, camera, controls, statusEl) {
        this.frameManager = frameManager;
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.statusEl = statusEl;
    }

    async generate(animationController) {
        const frames = this.frameManager.getFramesData();
        if (frames.length === 0) {
            this.statusEl.textContent = 'Add at least one frame.';
            return;
        }
        
        const wasPlaying = animationController.isPlaying();
        if (wasPlaying) animationController.stop();

        const width = this.renderer.domElement.width;
        const height = this.renderer.domElement.height;
        const fps = parseInt(this.controls.gifFps.value, 10);
        const delay = 1000 / fps;

        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: width,
            height: height
        });

        for (let i = 0; i < frames.length; i++) {
            this.statusEl.textContent = `Rendering frame ${i + 1}/${frames.length}...`;
            
            // Update scene based on frame data if needed
            // This would modify scene objects based on frame[i] data
            
            // Render the 3D scene
            this.renderer.render(this.scene, this.camera);
            
            // Get the rendered frame
            const canvas = this.renderer.domElement;
            gif.addFrame(canvas, { delay: delay, copy: true });
        }

        gif.on('finished', (blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'secret-message-3d.gif';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.statusEl.textContent = 'Done!';
            if (wasPlaying) animationController.start();
        });
        
        gif.on('progress', (p) => {
            this.statusEl.textContent = `Building GIF... ${Math.round(p * 100)}%`;
        });

        gif.render();
    }
}