import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import nipplejs from 'nipplejs';
import { NoiseGenerator } from './noise-generator.js';
import { FrameManager } from './frame-manager.js';
import { AnimationController } from './animation-controller.js';
import { GifGenerator } from './gif-generator.js';
import { UIController } from './ui-controller.js';

class Game3D {
    constructor() {
        this.initElements();
        this.initThreeJS();
        this.initPostProcessing();
        this.initComponents();
        this.initControls();
        this.setupEventListeners();
        this.initialSetup();
        this.animate();
    }

    initElements() {
        this.canvas = document.getElementById('game-canvas');
        this.framesList = document.getElementById('frames-list');
        this.addFrameBtn = document.getElementById('add-frame-btn');
        this.generateGifBtn = document.getElementById('generate-gif-btn');
        this.gifStatusEl = document.getElementById('gif-status');
        this.playPauseBtn = document.getElementById('play-pause-animation');
        
        this.modelUpload = document.getElementById('model-upload');
        this.worldTextInput = document.getElementById('world-text-input');
        this.addWorldTextBtn = document.getElementById('add-world-text-btn');

        this.controls = {
            redChannelColor: document.getElementById('red-channel-color'),
            redChannelOffset: document.getElementById('red-channel-offset'),
            cyanChannelColor: document.getElementById('cyan-channel-color'),
            cyanChannelOffset: document.getElementById('cyan-channel-offset'),
            movementSpeed: document.getElementById('movement-speed'),
            mouseSensitivity: document.getElementById('mouse-sensitivity'),
            gifFps: document.getElementById('gif-fps'),
        };

        this.valueDisplays = {
            redChannelOffset: document.getElementById('red-channel-offset-value'),
            cyanChannelOffset: document.getElementById('cyan-channel-offset-value'),
            movementSpeed: document.getElementById('movement-speed-value'),
            mouseSensitivity: document.getElementById('mouse-sensitivity-value'),
            gifFps: document.getElementById('gif-fps-value'),
        };
    }

    initThreeJS() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.6, 5);
        
        // Create cameras for anaglyph effect
        this.cameraL = this.camera.clone();
        this.cameraR = this.camera.clone();
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(50, 50);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Asset arrays
        this.redChannelObjects = [];
        this.cyanChannelObjects = [];
        this.worldTexts = [];
        this.importedModels = [];
        
        // GLTF Loader
        this.gltfLoader = new GLTFLoader();
        
        // Raycaster for object interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    initPostProcessing() {
        // Create anaglyph shader
        const AnaglyphShader = {
            uniforms: {
                'mapLeft': { value: null },
                'mapRight': { value: null }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D mapLeft;
                uniform sampler2D mapRight;
                varying vec2 vUv;
                
                void main() {
                    vec4 colorL = texture2D(mapLeft, vUv);
                    vec4 colorR = texture2D(mapRight, vUv);
                    
                    // Red-cyan anaglyph
                    gl_FragColor = vec4(colorL.r, colorR.g, colorR.b, max(colorL.a, colorR.a));
                }
            `
        };

        // Create render targets
        this.renderTargetL = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.renderTargetR = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);

        // Create composer for final anaglyph effect
        this.composer = new EffectComposer(this.renderer);
        this.anaglyphPass = new ShaderPass(AnaglyphShader);
        this.composer.addPass(this.anaglyphPass);

        this.anaglyphEnabled = false;
    }

    initComponents() {
        this.frameManager = new FrameManager(this.framesList, () => this.updateScene());
        
        this.animationController = new AnimationController(
            this.frameManager, 
            (frameIndex) => this.updateScene(frameIndex),
            this.playPauseBtn,
            this.controls.gifFps
        );

        this.gifGenerator = new GifGenerator(
            this.frameManager,
            this.renderer,
            this.scene,
            this.camera,
            this.controls,
            this.gifStatusEl
        );

        this.uiController = new UIController(this.controls, this.valueDisplays);
        this.uiController.setOnSettingsChange(() => this.updateAnaglyphSettings());
    }

    initControls() {
        // Pointer lock controls
        this.pointerControls = new PointerLockControls(this.camera, document.body);
        
        // Movement state
        this.movement = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };
        
        // Mouse look
        this.mouseMovement = { x: 0, y: 0 };
        
        // Mobile detection
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            this.setupMobileControls();
        } else {
            this.setupDesktopControls();
        }
    }

    setupDesktopControls() {
        // Click to enable pointer lock
        this.canvas.addEventListener('click', () => {
            this.pointerControls.lock();
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'KeyW': this.movement.forward = true; break;
                case 'KeyS': this.movement.backward = true; break;
                case 'KeyA': this.movement.left = true; break;
                case 'KeyD': this.movement.right = true; break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch(event.code) {
                case 'KeyW': this.movement.forward = false; break;
                case 'KeyS': this.movement.backward = false; break;
                case 'KeyA': this.movement.left = false; break;
                case 'KeyD': this.movement.right = false; break;
            }
        });
    }

    setupMobileControls() {
        const mobileControls = document.getElementById('mobile-controls');
        mobileControls.style.display = 'block';
        
        // Movement joystick
        this.movementJoystick = nipplejs.create({
            zone: document.getElementById('movement-joystick'),
            mode: 'static',
            position: { left: '100px', bottom: '100px' },
            color: 'blue'
        });
        
        // Look joystick
        this.lookJoystick = nipplejs.create({
            zone: document.getElementById('look-joystick'),
            mode: 'static',
            position: { right: '100px', bottom: '100px' },
            color: 'red'
        });
        
        this.movementJoystick.on('move', (evt, data) => {
            const force = Math.min(data.force, 1);
            const angle = data.angle.radian;
            this.movement.forward = Math.cos(angle) * force > 0.5;
            this.movement.backward = Math.cos(angle) * force < -0.5;
            this.movement.left = Math.sin(angle) * force < -0.5;
            this.movement.right = Math.sin(angle) * force > 0.5;
        });
        
        this.movementJoystick.on('end', () => {
            this.movement = { forward: false, backward: false, left: false, right: false };
        });
        
        this.lookJoystick.on('move', (evt, data) => {
            const sensitivity = 0.05;
            this.mouseMovement.x = data.vector.x * sensitivity;
            this.mouseMovement.y = -data.vector.y * sensitivity;
        });
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Model upload
        this.modelUpload.addEventListener('change', (event) => {
            this.handleModelUpload(event);
        });
        
        // World text
        this.addWorldTextBtn.addEventListener('click', () => {
            this.addWorldText();
        });
        
        // Object interaction
        this.canvas.addEventListener('click', (event) => {
            this.handleObjectClick(event);
        });
        
        // Frame management
        this.addFrameBtn.addEventListener('click', () => {
            this.frameManager.createFrameInput();
        });
        
        // GIF generation
        this.generateGifBtn.addEventListener('click', async () => {
            await this.generateGif();
        });
    }

    handleModelUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            const url = URL.createObjectURL(file);
            this.gltfLoader.load(url, (gltf) => {
                const model = gltf.scene;
                model.position.set(Math.random() * 10 - 5, 0, Math.random() * 10 - 5);
                model.userData.isAnaglyph = false;
                model.userData.anaglyphChannel = 'red'; // Default to red channel
                this.scene.add(model);
                this.importedModels.push(model);
                URL.revokeObjectURL(url);
            });
        });
    }

    addWorldText() {
        const text = this.worldTextInput.value.trim();
        if (!text) return;
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 256;
        
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#000000';
        context.font = '48px Arial';
        context.textAlign = 'center';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const geometry = new THREE.PlaneGeometry(2, 1);
        const textMesh = new THREE.Mesh(geometry, material);
        
        textMesh.position.set(Math.random() * 10 - 5, 2, Math.random() * 10 - 5);
        textMesh.userData.isAnaglyph = false;
        textMesh.userData.anaglyphChannel = 'cyan'; // Default to cyan channel
        textMesh.userData.originalText = text;
        
        this.scene.add(textMesh);
        this.worldTexts.push(textMesh);
        this.worldTextInput.value = '';
    }

    handleObjectClick(event) {
        if (!this.pointerControls.isLocked) return;
        
        this.mouse.x = 0; // Center of screen when pointer locked
        this.mouse.y = 0;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects([...this.importedModels, ...this.worldTexts], true);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            const rootObject = this.getRootObject(object);
            this.toggleAnaglyphMode(rootObject);
        }
    }

    getRootObject(object) {
        while (object.parent && object.parent !== this.scene) {
            object = object.parent;
        }
        return object;
    }

    toggleAnaglyphMode(object) {
        if (object.userData.isAnaglyph) {
            // Toggle channel
            object.userData.anaglyphChannel = object.userData.anaglyphChannel === 'red' ? 'cyan' : 'red';
        } else {
            // Enable anaglyph mode
            object.userData.isAnaglyph = true;
        }
        this.updateAnaglyphSettings();
    }

    updateAnaglyphSettings() {
        // Clear existing anaglyph arrays
        this.redChannelObjects = [];
        this.cyanChannelObjects = [];
        
        // Sort objects into channels
        let hasAnaglyphObjects = false;
        [...this.importedModels, ...this.worldTexts].forEach(obj => {
            if (obj.userData.isAnaglyph) {
                hasAnaglyphObjects = true;
                if (obj.userData.anaglyphChannel === 'red') {
                    this.redChannelObjects.push(obj);
                } else {
                    this.cyanChannelObjects.push(obj);
                }
            }
            obj.visible = true;
        });
        
        this.anaglyphEnabled = hasAnaglyphObjects;
        this.updateCameraPositions();
    }

    updateCameraPositions() {
        if (!this.anaglyphEnabled) return;
        
        const redOffset = parseFloat(this.controls.redChannelOffset.value);
        const cyanOffset = parseFloat(this.controls.cyanChannelOffset.value);
        const eyeSeparation = 0.1; // Base eye separation
        
        // Update camera positions for stereoscopic effect
        this.cameraL.position.copy(this.camera.position);
        this.cameraR.position.copy(this.camera.position);
        
        this.cameraL.rotation.copy(this.camera.rotation);
        this.cameraR.rotation.copy(this.camera.rotation);
        
        // Apply horizontal offset for stereoscopic effect
        const offsetVector = new THREE.Vector3(eyeSeparation * redOffset, 0, 0);
        offsetVector.applyQuaternion(this.camera.quaternion);
        this.cameraL.position.add(offsetVector);
        
        const offsetVectorR = new THREE.Vector3(eyeSeparation * cyanOffset, 0, 0);
        offsetVectorR.applyQuaternion(this.camera.quaternion);
        this.cameraR.position.add(offsetVectorR);
    }

    updateMovement() {
        if (!this.pointerControls.isLocked) return;
        
        const speed = parseFloat(this.controls.movementSpeed.value) * 0.01;
        const velocity = new THREE.Vector3();
        
        if (this.movement.forward) velocity.z -= speed;
        if (this.movement.backward) velocity.z += speed;
        if (this.movement.left) velocity.x -= speed;
        if (this.movement.right) velocity.x += speed;
        
        // Apply movement relative to camera direction
        velocity.applyQuaternion(this.camera.quaternion);
        this.camera.position.add(velocity);
        
        // Handle mobile look
        if (this.mouseMovement.x !== 0 || this.mouseMovement.y !== 0) {
            const sensitivity = parseFloat(this.controls.mouseSensitivity.value);
            this.camera.rotation.y -= this.mouseMovement.x * sensitivity;
            this.camera.rotation.x -= this.mouseMovement.y * sensitivity;
            this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
            this.mouseMovement.x *= 0.9;
            this.mouseMovement.y *= 0.9;
        }
    }

    updateScene(frameIndex = null) {
        const frames = this.frameManager.getFramesData();
        if (frames.length > 0) {
            const currentFrameIndex = frameIndex !== null ? frameIndex : this.animationController.getCurrentFrame();
            const actualFrameIndex = currentFrameIndex % frames.length;
            // Scene state management based on frame data would go here
        }
    }

    async generateGif() {
        this.generateGifBtn.disabled = true;
        this.playPauseBtn.disabled = true;
        
        try {
            await this.gifGenerator.generate(this.animationController);
        } catch (error) {
            console.error('GIF generation failed:', error);
            this.gifStatusEl.textContent = 'Generation failed.';
        } finally {
            this.generateGifBtn.disabled = false;
            this.playPauseBtn.disabled = false;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateMovement();
        
        if (this.anaglyphEnabled) {
            this.renderAnaglyph();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    renderAnaglyph() {
        this.updateCameraPositions();
        
        // Show only red channel objects for left eye
        this.setObjectsVisibility(this.redChannelObjects, true);
        this.setObjectsVisibility(this.cyanChannelObjects, false);
        this.renderer.setRenderTarget(this.renderTargetL);
        this.renderer.render(this.scene, this.cameraL);
        
        // Show only cyan channel objects for right eye
        this.setObjectsVisibility(this.redChannelObjects, false);
        this.setObjectsVisibility(this.cyanChannelObjects, true);
        this.renderer.setRenderTarget(this.renderTargetR);
        this.renderer.render(this.scene, this.cameraR);
        
        // Show all objects for final render
        this.setObjectsVisibility(this.redChannelObjects, true);
        this.setObjectsVisibility(this.cyanChannelObjects, true);
        
        // Combine the two renders with anaglyph shader
        this.anaglyphPass.uniforms['mapLeft'].value = this.renderTargetL.texture;
        this.anaglyphPass.uniforms['mapRight'].value = this.renderTargetR.texture;
        
        this.renderer.setRenderTarget(null);
        this.composer.render();
    }

    setObjectsVisibility(objects, visible) {
        objects.forEach(obj => {
            obj.visible = visible;
        });
    }

    initialSetup() {
        // Create initial frame
        this.frameManager.createFrameInput();
        
        // Add some initial objects
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(2, 1, 0);
        cube.userData.isAnaglyph = true;
        cube.userData.anaglyphChannel = 'red';
        this.scene.add(cube);
        this.importedModels.push(cube);
        
        this.updateAnaglyphSettings();
        this.updateScene();
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game3D();
});