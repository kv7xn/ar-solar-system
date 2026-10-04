/**
 * Wonders of the Universe — MindAR.js + Three.js
 *
 * Image Targets:
 *   Index 0: Sun marker   → 3D Sun with corona & self-rotation
 *   Index 1: Earth marker → 3D Earth with 23.5° axial tilt, self-rotation, & orbiting Moon
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.153.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.153.0/examples/jsm/loaders/GLTFLoader.js';
import { MindARThree } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';

// Polyfill outputEncoding to eliminate Three.js r153 console warnings caused by MindAR internals
if (!('outputEncoding' in THREE.WebGLRenderer.prototype)) {
  Object.defineProperty(THREE.WebGLRenderer.prototype, 'outputEncoding', {
    get() { return this.outputColorSpace === THREE.SRGBColorSpace ? 3001 : 3000; },
    set(val) { this.outputColorSpace = (val === 3001 ? THREE.SRGBColorSpace : THREE.NoColorSpace); },
    configurable: true
  });
}

/* ── DOM References ─────────────────────────────────────────── */
const splashScreen    = document.getElementById('splash-screen');
const startBtn        = document.getElementById('start-btn');
const loadingOverlay  = document.getElementById('loading-overlay');
const loadingText     = document.getElementById('loading-text');
const hud             = document.getElementById('hud');
const badgeSun        = document.getElementById('badge-sun');
const badgeEarth      = document.getElementById('badge-earth');
const badgeBlackhole  = document.getElementById('badge-blackhole');
const markersModal    = document.getElementById('markers-modal');
const viewMarkersBtn  = document.getElementById('view-markers-btn');
const hudMarkersBtn   = document.getElementById('hud-markers-btn');
const closeMarkersBtn = document.getElementById('close-markers-btn');
const teamModal       = document.getElementById('team-modal');
const teamBtn         = document.getElementById('team-btn');
const hudTeamBtn      = document.getElementById('hud-team-btn');
const closeTeamBtn    = document.getElementById('close-team-btn');
const errorModal      = document.getElementById('error-modal');
const errorTitle      = document.getElementById('error-modal-title');
const errorMsg        = document.getElementById('error-modal-msg');
const errorRetryBtn   = document.getElementById('error-retry-btn');
const rotationToggleBtn = document.getElementById('rotation-toggle-btn');
const rotationIcon      = document.getElementById('rotation-icon');
const rotationText      = document.getElementById('rotation-text');
const zoomInBtn         = document.getElementById('zoom-in-btn');
const zoomOutBtn        = document.getElementById('zoom-out-btn');
const zoomIndicator     = document.getElementById('zoom-indicator');
const zoomText          = document.getElementById('zoom-text');

/* ── App State ──────────────────────────────────────────────── */
let mindarInstance = null;
let isStarting     = false;
let isStarted      = false;
let isRotating     = true;

let currentZoom       = 1.0;
const MIN_ZOOM        = 0.35;
const MAX_ZOOM        = 3.5;
let activeModelGroups = [];

function applyZoom(newZoom) {
  currentZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM);
  const rounded = Math.round(currentZoom * 100) / 100;
  activeModelGroups.forEach((grp) => {
    if (grp) grp.scale.setScalar(rounded);
  });
  if (zoomText) {
    zoomText.textContent = `${rounded.toFixed(1)}x`;
  }
}

zoomInBtn?.addEventListener('click', () => {
  applyZoom(currentZoom + 0.25);
});

zoomOutBtn?.addEventListener('click', () => {
  applyZoom(currentZoom - 0.25);
});

zoomIndicator?.addEventListener('click', () => {
  applyZoom(1.0);
});

rotationToggleBtn?.addEventListener('click', () => {
  isRotating = !isRotating;
  if (isRotating) {
    rotationIcon.textContent = '⏸️';
    rotationText.textContent = 'Pause';
  } else {
    rotationIcon.textContent = '▶️';
    rotationText.textContent = 'Rotate';
  }
});

/* ── Modal Event Handlers ───────────────────────────────────── */
function openMarkersModal() {
  markersModal.classList.add('active');
}
function closeMarkersModal() {
  markersModal.classList.remove('active');
}
function openTeamModal() {
  teamModal?.classList.add('active');
}
function closeTeamModal() {
  teamModal?.classList.remove('active');
}

viewMarkersBtn?.addEventListener('click', openMarkersModal);
hudMarkersBtn?.addEventListener('click', openMarkersModal);
closeMarkersBtn?.addEventListener('click', closeMarkersModal);
markersModal?.addEventListener('click', (e) => {
  if (e.target === markersModal) closeMarkersModal();
});

teamBtn?.addEventListener('click', openTeamModal);
hudTeamBtn?.addEventListener('click', openTeamModal);
closeTeamBtn?.addEventListener('click', closeTeamModal);
teamModal?.addEventListener('click', (e) => {
  if (e.target === teamModal) closeTeamModal();
});

errorRetryBtn?.addEventListener('click', () => {
  errorModal.classList.remove('active');
  startARExperience();
});

/* ── GLTF Model Loader Helper ───────────────────────────────── */
function loadGLB(url, retries = 2) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    function attempt(remaining) {
      loader.load(
        url,
        (gltf) => {
          gltf.scene.userData.animations = gltf.animations || [];
          resolve(gltf.scene);
        },
        undefined,
        (err) => {
          if (remaining > 0) {
            console.warn(`Retrying download for ${url} (${remaining} attempt remaining)...`);
            setTimeout(() => attempt(remaining - 1), 1000);
          } else {
            reject(err);
          }
        }
      );
    }
    attempt(retries);
  });
}

/* ── Sun Model Builder ──────────────────────────────────────── */
async function createSunModel() {
  const root = new THREE.Group();
  let sunMesh = null;

  try {
    const model = await loadGLB('./assets/sun.glb');

    // 1. Calculate unscaled bounding box
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 2. Scale factor so the Sun and its labels fit nicely (~2.2 units)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 2.2;
    const scale = targetSize / maxDim;
    model.scale.setScalar(scale);

    // 3. Center the model at (0, 0, 0)
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    // 4. Ensure double-sided materials so all layers and labels are visible
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => { m.side = THREE.DoubleSide; });
        } else {
          child.material.side = THREE.DoubleSide;
        }
      }
    });

    root.add(model);
    sunMesh = model;
    console.log(`✔ Custom Sun model loaded & scaled (factor: ${scale.toExponential(2)})`);
  } catch (e) {
    console.warn('Fallback to procedural sun:', e);
    const geo = new THREE.SphereGeometry(0.25, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffbb00,
      emissive: 0xff6600,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });
    sunMesh = new THREE.Mesh(geo, mat);
    root.add(sunMesh);
  }

  // Float in front of the marker surface
  root.position.set(0, 0, 0.3);

  return {
    group: root,
    animate: (elapsed, delta) => {
      root.rotation.y += 0.20 * (delta || 0.016);
    },
  };
}

/* ── Earth Model Builder ────────────────────────────────────── */
async function createEarthModel() {
  const root = new THREE.Group();
  let earthMesh = null;
  let mixer = null;

  try {
    const model = await loadGLB('./assets/earth.glb');

    // 1. Calculate unscaled bounding box
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 2. Scale factor so the model and its magnetic field fit nicely (~2.2 units)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 2.2;
    const scale = targetSize / maxDim;
    model.scale.setScalar(scale);

    // 3. Center the model at (0, 0, 0)
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    // 4. Ensure double-sided materials
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => { m.side = THREE.DoubleSide; });
        } else {
          child.material.side = THREE.DoubleSide;
        }
      }
    });

    // 5. Setup AnimationMixer for 150-frame MagneticFieldFlow animation
    if (model.userData.animations && model.userData.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      model.userData.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
      });
      console.log('✔ Playing Earth 150-frame animation:', model.userData.animations[0].name);
    }

    root.add(model);
    earthMesh = model;
    console.log(`✔ Custom Earth model loaded & scaled (factor: ${scale.toExponential(2)})`);
  } catch (e) {
    console.warn('Fallback to procedural earth:', e);
    const geo = new THREE.SphereGeometry(0.20, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e88e5,
      emissive: 0x0d47a1,
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.1,
    });
    earthMesh = new THREE.Mesh(geo, mat);
    root.add(earthMesh);
  }

  // Float in front of the marker surface
  root.position.set(0, 0, 0.3);

  return {
    group: root,
    animate: (elapsed, delta) => {
      const dt = delta || 0.016;
      if (mixer) mixer.update(Math.min(dt, 0.04));
      root.rotation.y += 0.20 * dt;
    },
  };
}

/* ── Black Hole Model Builder ───────────────────────────────── */
async function createBlackholeModel() {
  const root = new THREE.Group();
  let blackholeMesh = null;

  try {
    const model = await loadGLB('./assets/blackhole.glb');

    // 1. Calculate unscaled bounding box
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 2. Scale factor to make the model larger than the phone (~2.4 units, 3x bigger)
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 2.4;
    const scale = targetSize / maxDim;
    model.scale.setScalar(scale);

    // 3. Center the model at (0, 0, 0) — offset MUST be scaled!
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    // 4. Configure materials to match authentic Blender black hole appearance
    model.traverse((child) => {
      if (!child.isMesh) return;

      const name = child.name.toLowerCase();

      // Center Singularity and Event Horizon: PURE PITCH BLACK
      if (name.includes('center') || name.includes('blackoutside')) {
        child.material = new THREE.MeshBasicMaterial({
          color: 0x000000,
          side: THREE.DoubleSide,
          transparent: false,
          opacity: 1.0,
          depthWrite: true,
        });
      }
      // Hide the opaque blue/white lens disc that was covering the center hole
      else if (name.includes('light1') || name.includes('distortion')) {
        child.visible = false;
      }
      // Accretion disk glow arcs: soft additive transparency
      else if (name.includes('light2') || name.includes('light3')) {
        if (child.material) {
          child.material.transparent = true;
          child.material.blending = THREE.AdditiveBlending;
          child.material.depthWrite = false;
          child.material.side = THREE.DoubleSide;
        }
      }
      // All other meshes (colorful rings, leader lines, annotations)
      else if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => { m.side = THREE.DoubleSide; });
        } else {
          child.material.side = THREE.DoubleSide;
        }
      }
    });

    root.add(model);
    blackholeMesh = model;
    console.log(`✔ Custom black hole centered and scaled (factor: ${scale.toExponential(2)})`);
  } catch (e) {
    console.warn('Fallback to procedural blackhole:', e);
    const coreGeo = new THREE.SphereGeometry(0.12, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    root.add(new THREE.Mesh(coreGeo, coreMat));

    const diskGeo = new THREE.TorusGeometry(0.28, 0.05, 16, 64);
    const diskMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff3300,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = Math.PI * 0.4;
    root.add(disk);
    blackholeMesh = root;
  }

  // Float in front of the marker surface
  root.position.set(0, 0, 0.3);

  return {
    group: root,
    animate: (elapsed, delta) => {
      root.rotation.y += 0.15 * (delta || 0.016);
    },
  };
}

/* ── Main Start AR Controller ───────────────────────────────── */
async function startARExperience() {
  if (isStarting || isStarted) return;
  isStarting = true;
  if (startBtn) startBtn.disabled = true;

  const container = document.getElementById('ar-container');
  if (container) container.innerHTML = '';

  loadingOverlay.classList.add('active');
  loadingText.textContent = 'Preparing AR engine & camera…';

  try {
    // 1. Initialize MindARThree with optimized mobile tracking parameters
    loadingText.textContent = 'Initializing AR Tracking Engine…';
    mindarInstance = new MindARThree({
      container:      document.getElementById('ar-container'),
      imageTargetSrc: './assets/targets.mind',
      maxTrack:       2,
      missTolerance:  8,
      warmupTolerance: 5,
      filterMinCF:    0.001,
      filterBeta:     1000,
      uiLoading:      'no',
      uiScanning:     'no',
    });

    const { renderer, scene, camera } = mindarInstance;

    // Mobile GPU Optimization: Cap pixel ratio to 1.5 (prevents rendering 20M+ pixels on 3x high-DPI screens)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    // Ensure transparent background for camera feed
    renderer.setClearColor(0x000000, 0);
    scene.background = null;

    // 2. Add Three.js lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(1.5, 3, 3);
    scene.add(dirLight);

    // 3. Load 3D Models in parallel for fast loading
    loadingText.textContent = 'Loading 3D Models…';
    const [sun, earth, blackhole] = await Promise.all([
      createSunModel(),
      createEarthModel(),
      createBlackholeModel()
    ]);

    // 4. Attach to Anchor Targets
    // Target 0 = Sun, Target 1 = Earth, Target 2 = Black Hole
    const sunAnchor = mindarInstance.addAnchor(0);
    sunAnchor.group.add(sun.group);

    const earthAnchor = mindarInstance.addAnchor(1);
    earthAnchor.group.add(earth.group);

    const blackholeAnchor = mindarInstance.addAnchor(2);
    blackholeAnchor.group.add(blackhole.group);

    // Register models for zoom scaling
    activeModelGroups = [sun.group, earth.group, blackhole.group];
    applyZoom(currentZoom);

    // 5. Track Detection Events
    sunAnchor.onTargetFound = () => {
      badgeSun.classList.add('active');
      badgeSun.querySelector('span:last-child').textContent = '☀ Sun: Detected!';
    };
    sunAnchor.onTargetLost = () => {
      badgeSun.classList.remove('active');
      badgeSun.querySelector('span:last-child').textContent = '☀ Sun: Searching';
    };

    earthAnchor.onTargetFound = () => {
      badgeEarth.classList.add('active');
      badgeEarth.querySelector('span:last-child').textContent = '🌍 Earth: Detected!';
    };
    earthAnchor.onTargetLost = () => {
      badgeEarth.classList.remove('active');
      badgeEarth.querySelector('span:last-child').textContent = '🌍 Earth: Searching';
    };

    blackholeAnchor.onTargetFound = () => {
      badgeBlackhole.classList.add('active');
      badgeBlackhole.querySelector('span:last-child').textContent = '🕳️ Black Hole: Detected!';
    };
    blackholeAnchor.onTargetLost = () => {
      badgeBlackhole.classList.remove('active');
      badgeBlackhole.querySelector('span:last-child').textContent = '🕳️ Black Hole: Searching';
    };

    // 6. Request camera and start tracking
    loadingText.textContent = 'Starting camera stream… Please click Allow when prompted.';
    await mindarInstance.start();

    // 7. Explicitly ensure camera video is in front of background and visible
    if (mindarInstance.video) {
      mindarInstance.video.style.position = 'absolute';
      mindarInstance.video.style.zIndex = '1';
      mindarInstance.video.style.display = 'block';
      mindarInstance.video.style.visibility = 'visible';
    }
    if (renderer && renderer.domElement) {
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.zIndex = '2';
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.background = 'transparent';
    }

    // 8. Transition UI
    isStarted = true;
    isStarting = false;
    loadingOverlay.classList.remove('active');
    splashScreen.classList.add('hidden');
    hud.style.display = 'flex';

    // 9. Animation & Render Loop
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      if (isRotating) {
        if (sunAnchor.group.visible) sun.animate(elapsed, delta);
        if (earthAnchor.group.visible) earth.animate(elapsed, delta);
        if (blackholeAnchor.group.visible) blackhole.animate(elapsed, delta);
      }
      renderer.render(scene, camera);
    });

    console.log('🚀 AR Engine running smoothly. Camera feed and 3D overlays active.');

  } catch (err) {
    console.error('AR Initialization error:', err);
    isStarting = false;
    if (startBtn) startBtn.disabled = false;
    loadingOverlay.classList.remove('active');

    let title = 'Could Not Start Camera';
    let message = err.message || String(err);

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      title = 'Camera Permission Blocked';
      message = 'Your browser blocked camera access. Please click the camera or shield icon in the browser address bar, set Camera to "Allow", and click Try Again.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      title = 'No Camera Found';
      message = 'No video camera was found on your device. Please connect a webcam and try again.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      title = 'Camera In Use';
      message = 'Your camera may be in use by another app (Zoom, Teams, Discord, etc.). Please close other applications using the camera and click Try Again.';
    }

    errorTitle.textContent = title;
    errorMsg.innerHTML = message;
    errorModal.classList.add('active');
  }
}

/* ── Expose globally for inline and mobile triggers ─────────── */
window.startARExperience = startARExperience;
window.openMarkersModal  = openMarkersModal;
window.closeMarkersModal = closeMarkersModal;
window.openTeamModal     = openTeamModal;
window.closeTeamModal    = closeTeamModal;

startBtn?.addEventListener('click', startARExperience);

/* ── Interactive Zoom Gestures ───────────────────────────────── */
// 1. Mobile Multi-Touch Pinch-to-Zoom
let initialPinchDist = null;
let initialPinchZoom = 1.0;

window.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2 && isStarted) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialPinchDist = Math.hypot(dx, dy);
    initialPinchZoom = currentZoom;
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && initialPinchDist && isStarted) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      const scaleFactor = dist / initialPinchDist;
      applyZoom(initialPinchZoom * scaleFactor);
    }
  }
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) {
    initialPinchDist = null;
  }
}, { passive: true });

// 2. Desktop Mouse Wheel Zoom
window.addEventListener('wheel', (e) => {
  if (!isStarted) return;
  // Ignore scrolling inside open modals
  if (markersModal?.classList.contains('active') || teamModal?.classList.contains('active') || errorModal?.classList.contains('active')) return;
  const delta = -Math.sign(e.deltaY) * 0.15;
  applyZoom(currentZoom + delta);
}, { passive: true });

console.log('✔ AR Application script ready.');