import * as THREE from '../vendor/three.module.js';

import {
  getScene, getObjects, getVisibility
} from './api_client.js';

import {renderObject} from './object_renderer.js';
import {WindowRenderer} from './window_renderer.js';
import {VisibilityView} from './visibility_view.js';
import {SceneLabels} from './scene_labels.js';
import {createObstacleControls} from './obstacle_controls.js';
import {initializeInvestigationTools} from './investigation_tools.js';
import {initializeSmartInvestigation} from './smart_investigation.js';

// ============================================================
// Three.js scene
// ============================================================

const container = document.getElementById('viewer');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x142439);

const camera = new THREE.PerspectiveCamera(
  55,
  container.clientWidth / container.clientHeight,
  0.1,
  500
);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio || 1, 2)
);

renderer.setSize(
  container.clientWidth,
  container.clientHeight
);

container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(
  0xffffff, 0x334455, 2
));

const sunlight = new THREE.DirectionalLight(
  0xffffff, 2
);

sunlight.position.set(30, 70, 25);
scene.add(sunlight);

// ============================================================
// Scene managers
// ============================================================

const sceneLabels = new SceneLabels(scene);
const windowRenderer = new WindowRenderer(scene);
const windowMarkers = new Map();

const visibilityView = new VisibilityView(
  scene,
  windowMarkers
);

const sceneObjectMeshes = new Map();
const buildingMaterials = [];

let incident = {x: 0, y: 0, z: 1.5};
let incidentMarker = null;
let moveMode = false;

// ============================================================
// Custom camera navigation (no OrbitControls.js)
// ============================================================

const cameraTarget = new THREE.Vector3(0, 8, 0);

let cameraRadius = 100;
let cameraTheta = 0;
let cameraPhi = Math.PI / 3;

function updateCamera() {
  cameraRadius = THREE.MathUtils.clamp(
    cameraRadius, 8, 200
  );

  cameraPhi = THREE.MathUtils.clamp(
    cameraPhi, 0.02, Math.PI / 2 - 0.01
  );

  camera.position.set(
    cameraTarget.x +
      cameraRadius * Math.sin(cameraPhi) *
      Math.sin(cameraTheta),

    cameraTarget.y +
      cameraRadius * Math.cos(cameraPhi),

    cameraTarget.z +
      cameraRadius * Math.sin(cameraPhi) *
      Math.cos(cameraTheta)
  );

  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld();
}

function setCameraView(position, target) {
  cameraTarget.set(...target);

  const offset = new THREE.Vector3(
    ...position
  ).sub(cameraTarget);

  cameraRadius = Math.max(offset.length(), 0.01);

  cameraTheta = Math.atan2(
    offset.x, offset.z
  );

  cameraPhi = Math.acos(
    THREE.MathUtils.clamp(
      offset.y / cameraRadius, -1, 1
    )
  );

  updateCamera();
}

setCameraView([65, 55, 70], [0, 8, 0]);

// ============================================================
// Mouse rotation, zoom, pan and incident placement
// ============================================================

const canvas = renderer.domElement;
canvas.style.touchAction = 'none';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const groundPlane = new THREE.Plane(
  new THREE.Vector3(0, 1, 0), 0
);

let activePointer = null;

canvas.addEventListener('contextmenu', event => {
  event.preventDefault();
});

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 && event.button !== 2) return;
  if (activePointer) return;

  activePointer = {
    id: event.pointerId,
    button: event.button,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };

  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (!activePointer ||
      activePointer.id !== event.pointerId) return;

  const dx = event.clientX - activePointer.x;
  const dy = event.clientY - activePointer.y;

  const travel = Math.hypot(
    event.clientX - activePointer.startX,
    event.clientY - activePointer.startY
  );

  if (travel > 5) activePointer.moved = true;

  activePointer.x = event.clientX;
  activePointer.y = event.clientY;

  if (!activePointer.moved) return;

  if (activePointer.button === 0) {
    cameraTheta -= dx * 0.006;
    cameraPhi -= dy * 0.006;
  }

  if (activePointer.button === 2) {
    camera.updateMatrixWorld();

    const right = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrixWorld, 0);

    const up = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrixWorld, 1);

    const scale = cameraRadius * 0.0015;

    cameraTarget.addScaledVector(right, -dx * scale);
    cameraTarget.addScaledVector(up, dy * scale);
  }

  updateCamera();
});

canvas.addEventListener('pointerup', event => {
  if (!activePointer ||
      activePointer.id !== event.pointerId) return;

  const wasClick =
    activePointer.button === 0 &&
    event.button === 0 &&
    !activePointer.moved &&
    Math.hypot(
      event.clientX - activePointer.startX,
      event.clientY - activePointer.startY
    ) <= 5;

  activePointer = null;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }

  if (wasClick && moveMode) {
    moveIncidentFromClick(event);
  }
});

canvas.addEventListener('pointercancel', event => {
  activePointer = null;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});

canvas.addEventListener('wheel', event => {
  event.preventDefault();

  cameraRadius *= Math.exp(event.deltaY * 0.001);
  updateCamera();
}, {passive: false});

// ============================================================
// Camera presets
// ============================================================

document.getElementById('overviewView').onclick = () => {
  setCameraView([65, 55, 70], [0, 8, 0]);
};

document.getElementById('topView').onclick = () => {
  setCameraView([0, 110, 0.01], [0, 0, 0]);
};

document.getElementById('incidentView').onclick = () => {
  setCameraView(
    [incident.x + 35, incident.z + 18, incident.y + 35],
    [incident.x, incident.z, incident.y]
  );
};

// ============================================================
// Ground and roads
// ============================================================

function createBox(x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({color})
  );

  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

createBox(0, -0.3, 0, 110, 0.5, 110, 0x435465);
createBox(0, 0, 0, 14, 0.1, 110, 0x202a35);
createBox(0, 0, 0, 110, 0.1, 14, 0x202a35);

// ============================================================
// Incident marker
// ============================================================

function createMarker(x, y, z, color, radius) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false
    })
  );

  mesh.position.set(x, y, z);
  mesh.renderOrder = 90;
  scene.add(mesh);

  return mesh;
}

function updateIncidentLabel() {
  sceneLabels.move(
    'incident',
    incident.x,
    incident.y,
    incident.z + 4
  );
}

// ============================================================
// Building transparency
// ============================================================

document.getElementById('buildingOpacity')
  .addEventListener('input', event => {
    const opacity = Number(event.target.value) / 100;

    document.getElementById('opacityValue')
      .textContent =
      `${Math.round(opacity * 100)}%`;

    for (const material of buildingMaterials) {
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.depthWrite = opacity >= 1;
      material.needsUpdate = true;
    }
  });

// ============================================================
// Visibility-ray toggle
// ============================================================

document.getElementById('showVisibilityRays')
  .addEventListener('change', event => {
    visibilityView.setVisible(event.target.checked);
  });

// ============================================================
// Scene object refresh and CCTV labels
// ============================================================

function disposeSceneObject(group) {
  scene.remove(group);

  group.traverse(child => {
    if (child.geometry) child.geometry.dispose();

    if (child.material) {
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

async function refreshSceneObjects() {
  const data = await getObjects();

  for (const group of sceneObjectMeshes.values()) {
    disposeSceneObject(group);
  }

  sceneObjectMeshes.clear();
  sceneLabels.clearPrefix('cctv-');

  for (const obj of data.objects) {
    if (!obj.enabled) continue;

    const mesh = renderObject(scene, obj);

    // Metadata used by the clickable object inspector.
    mesh.userData.object_type = obj.object_type;
    mesh.userData.objectInfo = {
      id: obj.id,
      name: obj.name,
      object_type: obj.object_type,
      x: obj.x,
      y: obj.y,
      z: obj.z,
      dimensions: obj.dimensions
    };

    sceneObjectMeshes.set(obj.id, mesh);

    if (obj.object_type === 'camera') {
      sceneLabels.add(
        `cctv-${obj.id}`,
        obj.name,
        obj.x,
        obj.y,
        obj.z + 4,
        {
          color: '#67e8f9',
          background: '#102d42',
          scale: 11,
          marker: true,
          markerZ: obj.z,
          markerColor: 0x67e8f9
        }
      );
    }
  }

  return data.objects;
}

// ============================================================
// Load buildings, windows and labels
// ============================================================

async function initializeScene() {
  const data = await getScene();

  for (const building of data.buildings) {
    const geo = typeof building.geometry === 'string'
      ? JSON.parse(building.geometry)
      : building.geometry;

    const points = geo.coordinates[0];

    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const geometry = new THREE.BoxGeometry(
      maxX - minX,
      building.height_m,
      maxY - minY
    );

    const material = new THREE.MeshStandardMaterial({
      color: 0x83b6da,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    buildingMaterials.push(material);

    const mesh = new THREE.Mesh(geometry, material);

    // PostgreSQL-backed building inspection metadata.
    mesh.userData.buildingInfo = {
      type: 'building',
      id: building.id,
      name: building.name,
      height_m: building.height_m
    };

    mesh.position.set(
      (minX + maxX) / 2,
      building.height_m / 2,
      (minY + maxY) / 2
    );

    scene.add(mesh);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0xa8cde8,
        transparent: true,
        opacity: 0.85
      })
    );

    outline.position.copy(mesh.position);
    scene.add(outline);

    sceneLabels.add(
      `building-${building.id}`,
      building.name,
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      building.height_m + 5,
      {
        color: '#ffffff',
        background: '#17314b',
        scale: 16
      }
    );
  }

  for (const windowData of data.windows) {
    const mesh = windowRenderer.add(windowData);

    mesh.userData.inspection = {
      type: 'window',
      id: windowData.id
    };

    windowMarkers.set(windowData.id, mesh);
  }

  if (data.incidents.length) {
    const i = data.incidents[0];

    incident = {
      x: i.x,
      y: i.y,
      z: i.z
    };
  }

  incidentMarker = createMarker(
    incident.x,
    incident.z,
    incident.y,
    0xffba42,
    1.1
  );

  sceneLabels.add(
    'incident',
    'INCIDENT',
    incident.x,
    incident.y,
    incident.z + 4,
    {
      color: '#ffba42',
      background: '#3b2a13',
      scale: 12
    }
  );

  const objects = await refreshSceneObjects();

  document.getElementById('summary').textContent =
    `${data.buildings.length} buildings | ` +
    `${data.windows.length} windows | ` +
    `${objects.length} scene objects`;

  document.getElementById('status').textContent =
    'Scene loaded from Tanzu PostgreSQL';
}

// ============================================================
// Move incident on street
// ============================================================

function moveIncidentFromClick(event) {
  if (!incidentMarker) return;

  const rect = canvas.getBoundingClientRect();

  pointer.x =
    (event.clientX - rect.left) / rect.width * 2 - 1;

  pointer.y =
    -(event.clientY - rect.top) / rect.height * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const hit = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(
    groundPlane, hit
  )) return;

  if (Math.abs(hit.x) > 55 ||
      Math.abs(hit.z) > 55) return;

  if (Math.abs(hit.x) > 7 &&
      Math.abs(hit.z) > 7) return;

  incident = {
    x: hit.x,
    y: hit.z,
    z: 1.5
  };

  incidentMarker.position.set(
    incident.x,
    incident.z,
    incident.y
  );

  updateIncidentLabel();
  visibilityView.clear();

  document.getElementById('status').textContent =
    `Incident moved to (${incident.x.toFixed(1)}, ` +
    `${incident.y.toFixed(1)}). Run analysis again.`;
}

document.getElementById('moveIncident')
  .addEventListener('click', () => {
    moveMode = !moveMode;

    document.getElementById('moveIncident')
      .textContent =
      `Move Incident: ${moveMode ? 'ON' : 'OFF'}`;
  });

// ============================================================
// Existing visibility analysis
// ============================================================

async function analyzeVisibility() {
  const k = Number(
    document.getElementById('k').value
  );

  const result = await getVisibility(
    incident.x,
    incident.y,
    incident.z,
    k
  );

  visibilityView.draw(incident, result);

  document.getElementById('status').textContent =
    `${result.visible_count} visible, ` +
    `${result.blocked_count} blocked`;

  const performance =
    document.getElementById('performanceMetrics');

  performance.textContent =
    `Database round-trip: ${result.database_ms} ms\n` +
    `Python visibility: ${result.python_visibility_ms} ms\n` +
    `Total analysis: ${result.total_elapsed_ms} ms\n` +
    `Candidates: ${result.candidate_count}\n` +
    `Objects examined: ${result.objects_examined}\n` +
    `Buildings examined: ${result.buildings_examined}`;

  performance.style.whiteSpace = 'pre-line';

  document.getElementById('sql').textContent =
    result.sql + '\nParameters: ' +
    JSON.stringify(result.parameters);

  const output = document.getElementById('results');
  output.replaceChildren();

  const heading = document.createElement('p');

  heading.textContent =
    `Nearest ${result.visible_windows.length} visible windows`;

  output.appendChild(heading);

  for (const w of result.visible_windows) {
    const row = document.createElement('p');

    row.textContent =
      `${w.building} | Floor ${w.floor_no} | ` +
      `${w.facade} | ` +
      `${Number(w.distance_m).toFixed(2)} m`;

    output.appendChild(row);
  }

  const blocked = document.createElement('p');
  blocked.textContent =
    `Blocked candidates: ${result.blocked_count}`;

  output.appendChild(blocked);
}

function showError(error) {
  console.error(error);

  document.getElementById('status').textContent =
    `Error: ${error.message}`;
}

document.getElementById('run')
  .addEventListener('click', () => {
    analyzeVisibility().catch(showError);
  });

// ============================================================
// Initialize all investigation features
// ============================================================

async function initializeDashboard() {
  await initializeScene();

  await createObstacleControls(
    document.getElementById('obstacleControls'),
    async () => {
      await refreshSceneObjects();
      await analyzeVisibility();
    }
  );

  // Existing CCTV and pgvector-only investigation tools.
  initializeInvestigationTools(
    () => incident,
    scene
  );

  // Smart visibility, clickable objects and hybrid search.
  initializeSmartInvestigation({
    scene,
    camera,
    canvas,
    getIncident: () => incident,
    getMoveMode: () => moveMode,
    windowMarkers,
    sceneObjectMeshes,
    visibilityView
  });
}

initializeDashboard().catch(showError);

// ============================================================
// Animation and resize
// ============================================================

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect =
    container.clientWidth / container.clientHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );
});
