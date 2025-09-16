export class NoiseGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    generate(scale = 1, type = 'color') {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        for (let y = 0; y < h; y += scale) {
            for (let x = 0; x < w; x += scale) {
                let r, g, b;
                if (type === 'color') {
                    r = Math.floor(Math.random() * 256);
                    g = Math.floor(Math.random() * 256);
                    b = Math.floor(Math.random() * 256);
                } else { // grayscale
                    const val = Math.floor(Math.random() * 256);
                    r = g = b = val;
                }
                this.ctx.fillStyle = `rgb(${r},${g},${b})`;
                this.ctx.fillRect(x, y, scale, scale);
            }
        }
    }
}

