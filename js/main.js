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
const infoModal          = document.getElementById('info-modal');
const infoModalTitle     = document.getElementById('info-modal-title');
const topicTabsContainer = document.getElementById('topic-tabs-container');
const infoModalBody      = document.getElementById('info-modal-body');
const hudInstruction    = document.getElementById('hud-instruction');
const hudInfoBtn         = document.getElementById('hud-info-btn');
const closeInfoBtn       = document.getElementById('close-info-btn');

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

/* ── 3D Celestial Information Menu Controller ───────────────── */
let currentCelestialKey = 'earth';
let currentTopicId      = 'overview';
let lastDetectedKey     = 'earth';

const CELESTIAL_DATA = {
  earth: {
    name: "Earth",
    icon: "🌍",
    tagline: "Third Planet · Electromagnetism & Geophysics",
    topics: [
      {
        id: "overview",
        title: "📋 Overview & Stats",
        html: `
          <div class="info-badge-grid">
            <div class="info-stat-card"><div class="stat-label">Mean Radius</div><div class="stat-val">~6,371 km</div></div>
            <div class="info-stat-card"><div class="stat-label">Total Mass</div><div class="stat-val">5.97 × 10²⁴ kg</div></div>
            <div class="info-stat-card"><div class="stat-label">Orbital Order</div><div class="stat-val">3rd from Sun</div></div>
            <div class="info-stat-card"><div class="stat-label">Physics Focus</div><div class="stat-val">Electromagnetism & Dynamo</div></div>
          </div>
          <div class="info-section">
            <div class="info-section-title">🌍 Planetary Overview</div>
            <p>The Earth is the third planet from the Sun and the only known planet that supports life. It is a nearly spherical terrestrial planet with a mean radius of 6,371 km and a mass of 5.97 × 10²⁴ kg.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">💡 Why Study Earth in AR?</div>
            <p>Earth acts as our home and provides a natural shield against harmful solar radiation through its magnetic field. In our WebAR model, the animated magnetic field loop allows you to directly explore this invisible field in 3D space.</p>
          </div>
        `
      },
      {
        id: "structure",
        title: "🌐 Internal Layers",
        html: `
          <div class="info-section">
            <div class="info-section-title">1. Crust (5 to 70 km)</div>
            <p>Thin, solid, rocky outer shell. Oceanic crust (5–10 km) is thinner and denser than continental crust (30–70 km). All terrestrial life exists on this thin outer skin.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">2. Mantle (~2,900 km thick)</div>
            <p>Hot, dense semi-solid silicate rock that flows via extremely slow convection currents. This thermal circulation drives continental drift and plate tectonics.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">3. Outer Core (~2,200 km thick)</div>
            <p>Composed of swirling liquid iron and nickel. Moving, electrically conducting molten metal acts as a planetary geodynamo, generating Earth's magnetic field.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">4. Inner Core (radius ~1,220 km)</div>
            <p>Solid iron-nickel metallic sphere. Temperatures exceed 5,000 K, but immense gravitational pressure prevents the metals from melting.</p>
          </div>
        `
      },
      {
        id: "magnetic",
        title: "🧲 Magnetic Field",
        html: `
          <div class="info-section">
            <div class="info-section-title">🧲 Geodynamo & Dipole Field</div>
            <p>Moving, electrically conducting liquid iron in the outer core acts as a dynamo and produces a magnetic field that extends far into space. It resembles the field of a giant bar magnet (dipole).</p>
            <div class="formula-box">Lorentz Force: F = q(v × B)</div>
            <p>A moving charged particle in a magnetic field experiences a deflecting force perpendicular to both its velocity and field lines, causing solar particles to spiral safely along field lines.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">🛡️ Critical Roles of the Field</div>
            <ul style="padding-left: 18px; margin: 0;">
              <li><strong>Atmospheric Shield:</strong> Deflects high-speed charged solar wind, preventing it from stripping away our atmosphere.</li>
              <li><strong>Auroras:</strong> Funneled energetic particles collide with oxygen and nitrogen in the upper atmosphere, creating the northern and southern lights.</li>
              <li><strong>Navigation:</strong> Standard compass needles align with Earth's magnetic dipole toward the magnetic north.</li>
            </ul>
          </div>
        `
      }
    ]
  },
  sun: {
    name: "The Sun",
    icon: "☀",
    tagline: "G-Type Star · Nuclear Fusion & Plasma Physics",
    topics: [
      {
        id: "overview",
        title: "📋 Overview & Stats",
        html: `
          <div class="info-badge-grid">
            <div class="info-stat-card"><div class="stat-label">Mass Share</div><div class="stat-val">99.8% of Solar System</div></div>
            <div class="info-stat-card"><div class="stat-label">Solar Radius</div><div class="stat-val">~6.96 × 10⁸ m</div></div>
            <div class="info-stat-card"><div class="stat-label">Surface Temp</div><div class="stat-val">~5,800 K</div></div>
            <div class="info-stat-card"><div class="stat-label">Spectral Class</div><div class="stat-val">G-type Main-Sequence</div></div>
          </div>
          <div class="info-section">
            <div class="info-section-title">☀ The Heart of the Solar System</div>
            <p>The Sun is a G-type main-sequence star containing about 99.8% of the total mass of the solar system. It shines by converting hydrogen nuclei into helium through sustained nuclear fusion in its dense core.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">⚡ Nuclear Fusion Energy</div>
            <p>Through Einstein's mass-energy equivalence (E = mc²), mass lost during fusion is released as radiant energy, traveling to the surface and illuminating the planets.</p>
          </div>
        `
      },
      {
        id: "interior",
        title: "🔥 Interior Layers",
        html: `
          <div class="info-section">
            <div class="info-section-title">1. Core (~15,000,000 K)</div>
            <p>The central and hottest engine of the Sun. Immense pressure and temperature drive hydrogen fusion into helium, generating vast amounts of energy.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">2. Radiative Zone</div>
            <p>Surrounds the core and transfers energy outward primarily through photon radiation. Due to extreme plasma density, photons bounce for over 100,000 years to escape this zone.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">3. Convection Zone</div>
            <p>Hot plasma boils upward toward the surface while cooler plasma sinks inward, establishing giant convection currents that carry thermal energy to the photosphere.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">4. Subsurface Flows</div>
            <p>Large-scale circulating plasma streams beneath the surface linked directly to solar rotation and the 11-year magnetic cycle.</p>
          </div>
        `
      },
      {
        id: "surface",
        title: "☀️ Surface & Corona",
        html: `
          <div class="info-section">
            <div class="info-section-title">5. Photosphere</div>
            <p>The visible surface layer (~5,800 K) emitting the light that reaches Earth. Displays a bright bubbling granular appearance.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">6. Sunspots & Solar Flares</div>
            <p><strong>Sunspots:</strong> Dark, relatively cooler regions (~3,800 K) caused by intense concentrated magnetic flux.<br><strong>Flares:</strong> Violent sudden releases of magnetic energy erupting into space.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">7. Chromosphere & Prominences</div>
            <p><strong>Chromosphere:</strong> Reddish atmospheric layer above the photosphere visible during solar eclipses.<br><strong>Prominences:</strong> Giant glowing loops of hot plasma anchored to the surface by magnetic arches.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">8. Corona & Coronal Holes</div>
            <p>The blisteringly hot outermost layer (>1,000,000 K) extending millions of kilometers into space. Coronal holes are cooler regions that launch the high-speed solar wind.</p>
          </div>
        `
      }
    ]
  },
  blackhole: {
    name: "Black Hole",
    icon: "🕳️",
    tagline: "Extreme Gravity · General Relativity & Spacetime",
    topics: [
      {
        id: "overview",
        title: "📋 Overview & Gravity",
        html: `
          <div class="info-badge-grid">
            <div class="info-stat-card"><div class="stat-label">Escape Velocity</div><div class="stat-val">> Speed of Light (c)</div></div>
            <div class="info-stat-card"><div class="stat-label">Key Physics</div><div class="stat-val">General Relativity</div></div>
            <div class="info-stat-card"><div class="stat-label">Formation</div><div class="stat-val">Stellar Core Collapse</div></div>
            <div class="info-stat-card"><div class="stat-label">Boundary</div><div class="stat-val">Event Horizon</div></div>
          </div>
          <div class="info-section">
            <div class="info-section-title">🕳️ What is a Black Hole?</div>
            <p>A black hole is a region of spacetime where gravitational acceleration is so extreme that nothing—not even electromagnetic radiation such as light—can escape once it crosses the event horizon.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">🌌 Origin</div>
            <p>Stellar black holes form when massive stars collapse at the end of their lives. Supermassive black holes (millions to billions of solar masses) sit anchored at the centers of most galaxies.</p>
          </div>
        `
      },
      {
        id: "anatomy",
        title: "🌀 Anatomy & Structure",
        html: `
          <div class="info-section">
            <div class="info-section-title">1. Accretion Disc</div>
            <p>Superheated gas and dust spiralling around the black hole at relativistic velocities. Strong friction heats matter to millions of degrees, radiating intense X-rays.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">2. Relativistic Jets</div>
            <p>Collimated streams of ionizing particles and radiation ejected from the rotational poles at velocities close to the speed of light.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">3. Photon Sphere & ISCO</div>
            <p><strong>Photon Sphere:</strong> Region where gravity is strong enough to bend light into unstable circular orbits.<br><strong>ISCO:</strong> Innermost Stable Circular Orbit; inside it, matter must spiral directly inward.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">4. Event Horizon & Singularity</div>
            <p><strong>Event Horizon:</strong> The point of no return where escape speed equals c.<br><strong>Singularity:</strong> The theoretical central point where matter is crushed to infinitesimal volume and infinite density.</p>
          </div>
        `
      },
      {
        id: "schwarzschild",
        title: "📐 Schwarzschild Radius",
        html: `
          <div class="info-section">
            <div class="info-section-title">📐 The Gravitational Radius Formula</div>
            <p>For a non-rotating black hole of mass M, the Schwarzschild radius Rs is given by:</p>
            <div class="formula-box">Rs = 2GM / c²</div>
            <p style="font-size: 11.5px; color: #94a3b8;">Where G = 6.67 × 10⁻¹¹ N·m²/kg² and c = 3 × 10⁸ m/s. The radius grows in direct proportion to mass M.</p>
          </div>
          <div class="info-section">
            <div class="info-section-title">📊 If Objects Were Squeezed Into Black Holes:</div>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse; margin-top: 6px;">
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.15); text-align: left; color: #f59e0b;">
                <th style="padding: 4px;">Object</th><th style="padding: 4px;">Mass</th><th style="padding: 4px;">Rs (Radius)</th>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 5px;">🌍 Earth</td><td style="padding: 5px;">5.97 × 10²⁴ kg</td><td style="padding: 5px; color: #38bdf8;">about 9 mm (marble)</td>
              </tr>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                <td style="padding: 5px;">☀ Sun</td><td style="padding: 5px;">1.99 × 10³⁰ kg</td><td style="padding: 5px; color: #38bdf8;">about 2.95 km (~3 km)</td>
              </tr>
              <tr>
                <td style="padding: 5px;">10× Solar Mass</td><td style="padding: 5px;">2 × 10³¹ kg</td><td style="padding: 5px; color: #38bdf8;">about 30 km</td>
              </tr>
            </table>
          </div>
        `
      }
    ]
  }
};

function renderInfoModal() {
  const data = CELESTIAL_DATA[currentCelestialKey];
  if (!data) return;

  if (infoModalTitle) {
    infoModalTitle.innerHTML = `<span>${data.icon}</span> <span>${data.name} · Physics Guide</span>`;
  }

  ['sun', 'earth', 'blackhole'].forEach((key) => {
    const tabBtn = document.getElementById(`obj-tab-${key}`);
    if (tabBtn) {
      if (key === currentCelestialKey) tabBtn.classList.add('active');
      else tabBtn.classList.remove('active');
    }
  });

  if (topicTabsContainer) {
    topicTabsContainer.innerHTML = data.topics.map((t) => `
      <button class="topic-tab-btn ${t.id === currentTopicId ? 'active' : ''}" onclick="selectTopic('${t.id}')">
        ${t.title}
      </button>
    `).join('');
  }

  if (infoModalBody) {
    const activeTopic = data.topics.find((t) => t.id === currentTopicId) || data.topics[0];
    infoModalBody.innerHTML = activeTopic.html;
    infoModalBody.scrollTop = 0;
  }
}

function openInfoModal(objKey, topicId) {
  if (objKey && CELESTIAL_DATA[objKey]) {
    currentCelestialKey = objKey;
  }
  if (topicId) {
    currentTopicId = topicId;
  } else if (!CELESTIAL_DATA[currentCelestialKey].topics.find((t) => t.id === currentTopicId)) {
    currentTopicId = 'overview';
  }
  renderInfoModal();
  infoModal?.classList.add('active');
  markersModal?.classList.remove('active');
  teamModal?.classList.remove('active');
}

function closeInfoModal() {
  infoModal?.classList.remove('active');
}

function selectCelestialObject(objKey) {
  if (CELESTIAL_DATA[objKey]) {
    currentCelestialKey = objKey;
    currentTopicId = 'overview';
    renderInfoModal();
  }
}

function selectTopic(topicId) {
  currentTopicId = topicId;
  renderInfoModal();
}

function openCurrentInfoModal() {
  openInfoModal(lastDetectedKey || 'earth');
}

function openInfoFor(objKey) {
  openInfoModal(objKey);
}

closeInfoBtn?.addEventListener('click', closeInfoModal);
infoModal?.addEventListener('click', (e) => {
  if (e.target === infoModal) closeInfoModal();
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

    // Helper to add invisible hit proxy sphere for easy tap/click detection
    function addHitProxy(group, radius, key) {
      const geo = new THREE.SphereGeometry(radius, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ visible: false, wireframe: false });
      const proxy = new THREE.Mesh(geo, mat);
      proxy.userData.celestialKey = key;
      group.add(proxy);
      group.userData.celestialKey = key;
    }

    addHitProxy(sun.group, 2.0, 'sun');
    addHitProxy(earth.group, 1.8, 'earth');
    addHitProxy(blackhole.group, 2.2, 'blackhole');

    // Register models for zoom scaling
    activeModelGroups = [sun.group, earth.group, blackhole.group];
    applyZoom(currentZoom);

    // 5. Track Detection Events
    sunAnchor.onTargetFound = () => {
      badgeSun.classList.add('active');
      badgeSun.querySelector('span:last-child').textContent = '☀ Sun: Detected!';
      lastDetectedKey = 'sun';
      if (hudInstruction) hudInstruction.textContent = '☀ Sun detected! Tap 3D model for physics info';
    };
    sunAnchor.onTargetLost = () => {
      badgeSun.classList.remove('active');
      badgeSun.querySelector('span:last-child').textContent = '☀ Sun: Searching';
      if (hudInstruction) hudInstruction.textContent = 'Point camera at Sun, Earth, or Black Hole marker image';
    };

    earthAnchor.onTargetFound = () => {
      badgeEarth.classList.add('active');
      badgeEarth.querySelector('span:last-child').textContent = '🌍 Earth: Detected!';
      lastDetectedKey = 'earth';
      if (hudInstruction) hudInstruction.textContent = '🌍 Earth detected! Tap 3D model for physics info';
    };
    earthAnchor.onTargetLost = () => {
      badgeEarth.classList.remove('active');
      badgeEarth.querySelector('span:last-child').textContent = '🌍 Earth: Searching';
      if (hudInstruction) hudInstruction.textContent = 'Point camera at Sun, Earth, or Black Hole marker image';
    };

    blackholeAnchor.onTargetFound = () => {
      badgeBlackhole.classList.add('active');
      badgeBlackhole.querySelector('span:last-child').textContent = '🕳️ Black Hole: Detected!';
      lastDetectedKey = 'blackhole';
      if (hudInstruction) hudInstruction.textContent = '🕳️ Black Hole detected! Tap 3D model for physics info';
    };
    blackholeAnchor.onTargetLost = () => {
      badgeBlackhole.classList.remove('active');
      badgeBlackhole.querySelector('span:last-child').textContent = '🕳️ Black Hole: Searching';
      if (hudInstruction) hudInstruction.textContent = 'Point camera at Sun, Earth, or Black Hole marker image';
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
window.startARExperience       = startARExperience;
window.openMarkersModal        = openMarkersModal;
window.closeMarkersModal       = closeMarkersModal;
window.openTeamModal           = openTeamModal;
window.closeTeamModal          = closeTeamModal;
window.openInfoModal           = openInfoModal;
window.closeInfoModal          = closeInfoModal;
window.selectCelestialObject   = selectCelestialObject;
window.selectTopic             = selectTopic;
window.openCurrentInfoModal    = openCurrentInfoModal;
window.openInfoFor             = openInfoFor;
window.showCelestialInfo       = openInfoModal;
window.switchCelestialObject   = selectCelestialObject;
window.showCurrentDetectedInfo = openCurrentInfoModal;

startBtn?.addEventListener('click', startARExperience);
hudInfoBtn?.addEventListener('click', openCurrentInfoModal);

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
  if (infoModal?.classList.contains('active') || markersModal?.classList.contains('active') || teamModal?.classList.contains('active') || errorModal?.classList.contains('active')) return;
  const delta = -Math.sign(e.deltaY) * 0.15;
  applyZoom(currentZoom + delta);
}, { passive: true });

/* ── 3D Model Tap Raycasting ─────────────────────────────────── */
let pointerStartX = 0;
let pointerStartY = 0;
let pointerStartTime = 0;

function handleModelRaycastTap(clientX, clientY) {
  if (!isStarted || !mindarInstance || !mindarInstance.camera) return;
  // Don't raycast if any modal is currently visible
  if (infoModal?.classList.contains('active') || markersModal?.classList.contains('active') || teamModal?.classList.contains('active') || errorModal?.classList.contains('active')) return;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, mindarInstance.camera);
  const targets = activeModelGroups.filter(Boolean);
  const intersects = raycaster.intersectObjects(targets, true);

  if (intersects && intersects.length > 0) {
    let hitObj = intersects[0].object;
    let targetKey = hitObj.userData?.celestialKey;
    if (!targetKey) {
      let curr = hitObj;
      while (curr) {
        if (curr.userData?.celestialKey) {
          targetKey = curr.userData.celestialKey;
          break;
        }
        curr = curr.parent;
      }
    }
    if (targetKey) {
      console.log(`✔ Tapped 3D celestial model: ${targetKey}`);
      openInfoModal(targetKey);
    }
  }
}

window.addEventListener('pointerdown', (e) => {
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;
  pointerStartTime = performance.now();
}, { passive: true });

window.addEventListener('pointerup', (e) => {
  const dist = Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY);
  const elapsed = performance.now() - pointerStartTime;
  // Accept genuine short taps / clicks (ignore drags and multi-touch gestures)
  if (dist < 20 && elapsed < 450) {
    // Ignore taps on UI controls, zoom bar, badges, and modals
    if (e.target.closest && (
      e.target.closest('.hud-controls') ||
      e.target.closest('.hud-zoom-bar') ||
      e.target.closest('.target-badges') ||
      e.target.closest('.modal-card') ||
      e.target.closest('.info-card') ||
      e.target.closest('#splash-screen')
    )) {
      return;
    }
    handleModelRaycastTap(e.clientX, e.clientY);
  }
}, { passive: true });

console.log('✔ AR Application script ready.');