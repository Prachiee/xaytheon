/**
 * Time Travel Debugger - 4D Visualization
 */

class TimeTravelDebugger {
    constructor() {
        this.container = document.getElementById('archaeology-viewport');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.timeline = [];
        this.currentCommitIndex = 0;
        this.fileMeshes = new Map(); // path -> mesh
        this.isPlaying = false;
        this.playInterval = null;

        this.init();
    }

    async init() {
        this.setupScene();
        this.setupLighting();
        this.setupHelpers();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());

        await this.loadTimeline();
        await this.loadHotspots();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0b0b14);
        this.scene.fog = new THREE.FogExp2(0x0b0b14, 0.002);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(100, 80, 100);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambient);
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(50, 100, 50);
        this.scene.add(directional);
    }

    setupHelpers() {
        const grid = new THREE.GridHelper(500, 50, 0x1e1e24, 0x1e1e24);
        this.scene.add(grid);
    }

    async loadTimeline() {
        try {
            const res = await fetch('/api/time-travel/timeline');
            const data = await res.json();
            if (data.success) {
                this.timeline = data.data;
                this.setupSlider();
                this.renderCommit(0); // Start at beginning
            }
        } catch (e) {
            console.error(e);
        }
    }

    async loadHotspots() {
        try {
            const res = await fetch('/api/time-travel/blame-analysis');
            const data = await res.json();
            if (data.success) {
                this.renderHotspots(data.data.hotspots);
            }
        } catch (e) {
            console.error(e);
        }
    }

    setupSlider() {
        const slider = document.getElementById('timeline-slider');
        slider.max = this.timeline.length - 1;
        slider.addEventListener('input', (e) => {
            this.currentCommitIndex = parseInt(e.target.value);
            this.renderCommit(this.currentCommitIndex);
            this.updateUI(this.timeline[this.currentCommitIndex]);
        });
    }

    renderHotspots(hotspots) {
        const list = document.getElementById('hotspot-list');
        list.innerHTML = hotspots.slice(0, 5).map(h => `
            <li class="hotspot-item">
                <span>${h.file.split('/').pop()}</span>
                <span class="count">${h.count} Fixes</span>
            </li>
        `).join('');
    }

    renderCommit(index) {
        const commit = this.timeline[index];
        if (!commit) return;

        // Process changes to update 3D scene
        commit.changes.forEach((change, i) => {
            if (change.type === 'add' || change.type === 'modify') {
                this.addOrUpdateFile(change.file, index);
            } else if (change.type === 'delete') {
                this.removeFile(change.file);
            }
        });

        this.updateUI(commit);
    }

    addOrUpdateFile(filePath, commitIndex) {
        if (this.fileMeshes.has(filePath)) {
            // "Grow" effect on modify
            const mesh = this.fileMeshes.get(filePath);
            gsap.to(mesh.scale, { y: 1.5, duration: 0.2, yoyo: true, repeat: 1 });
            mesh.material.color.setHex(0xfacc15); // Flash yellow
            setTimeout(() => mesh.material.color.setHex(0x3b82f6), 500);
        } else {
            // Create new block
            const geometry = new THREE.BoxGeometry(5, 5, 5);
            geometry.translate(0, 2.5, 0);
            const material = new THREE.MeshPhongMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.8 });
            const mesh = new THREE.Mesh(geometry, material);

            // Random position based on hash of filename for consistency
            const hash = filePath.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const x = (hash % 20) * 10 - 100;
            const z = ((hash * 3) % 20) * 10 - 100;

            mesh.position.set(x, 0, z);
            mesh.scale.set(0, 0, 0);

            this.scene.add(mesh);
            this.fileMeshes.set(filePath, mesh);

            gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out' });
        }
    }

    removeFile(filePath) {
        if (this.fileMeshes.has(filePath)) {
            const mesh = this.fileMeshes.get(filePath);
            gsap.to(mesh.scale, {
                x: 0, y: 0, z: 0,
                duration: 0.5,
                onComplete: () => {
                    this.scene.remove(mesh);
                    this.fileMeshes.delete(filePath);
                }
            });
        }
    }

    updateUI(commit) {
        document.getElementById('current-date').textContent = new Date(commit.date).toLocaleDateString();
        document.querySelector('.commit-msg').textContent = commit.message;
        document.getElementById('commit-author').textContent = commit.author;
        document.getElementById('commit-hash').textContent = commit.hash;
    }

    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.playInterval = setInterval(() => {
            if (this.currentCommitIndex < this.timeline.length - 1) {
                this.currentCommitIndex++;
                document.getElementById('timeline-slider').value = this.currentCommitIndex;
                this.renderCommit(this.currentCommitIndex);
            } else {
                this.pause();
            }
        }, 1500); // 1.5s per commit
    }

    pause() {
        this.isPlaying = false;
        clearInterval(this.playInterval);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TimeTravelDebugger();
});

function playTimeline() {
    app.controls.autoRotate = false; // Stop rotating when playing
    app.play();
}

function pauseTimeline() {
    app.pause();
}

async function findBugGenesis() {
    const hash = document.getElementById('commit-hash').textContent;
    if (hash === '---') return;

    alert(`Analyzing regressions for commit ${hash}...`);
    try {
        const res = await fetch(`/api/time-travel/trace/${hash}`);
        const data = await res.json();
        if (data.success) {
            alert(`🚨 Potential Regression Found!\n\nConfidence: ${data.data.confidence}\nSuspect Commit: ${data.data.suspectCommit}\nReason: ${data.data.reason}`);
        }
    } catch (e) {
        console.error(e);
    }
}
