import * as THREE from '../vendor/three.module.js';
import {
  getScene, getObjects, getVisibility
} from './api_client.js';
import {renderObject} from './object_renderer.js';
import {VisibilityView} from './visibility_view.js';
import {createObstacleControls} from './obstacle_controls.js';
import {
  initializeInvestigationTools
} from './investigation_tools.js';

const container = document.getElementById('viewer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x142439);

const camera = new THREE.PerspectiveCamera(
  55, container.clientWidth / container.clientHeight,
  0.1, 500
);

camera.position.set(65, 55, 70);
camera.lookAt(0, 8, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true
});

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(
  container.clientWidth,
  container.clientHeight
);
container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(
  0xffffff, 0x334455, 2
));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(30, 70, 25);
scene.add(sun);

function box(x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({color})
  );

  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

box(0, -0.3, 0, 110, 0.5, 110, 0x435465);
box(0, 0, 0, 14, 0.1, 110, 0x202a35);
box(0, 0, 0, 110, 0.1, 14, 0x202a35);

function marker(x, y, z, color, radius) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshBasicMaterial({color})
  );

  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

const markers = new Map();
const sceneObjectMeshes = new Map();
const visibilityView = new VisibilityView(scene, markers);

let incident = {x:0, y:0, z:1.5};
let incidentMarker = null;
let moveMode = false;

async function refreshSceneObjects() {
  const data = await getObjects();

  for (const group of sceneObjectMeshes.values()) {
    scene.remove(group);

    group.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.forEach(m => m.dispose());
      }
    });
  }

  sceneObjectMeshes.clear();

  for (const obj of data.objects) {
    if (obj.enabled) {
      const group = renderObject(scene, obj);
      sceneObjectMeshes.set(obj.id, group);
    }
  }
}

async function initialize() {
  const data = await getScene();

  for (const b of data.buildings) {
    const geo = typeof b.geometry === 'string'
      ? JSON.parse(b.geometry)
      : b.geometry;

    const points = geo.coordinates[0];
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    box(
      (minX+maxX)/2,
      b.height_m/2,
      (minY+maxY)/2,
      maxX-minX,
      b.height_m,
      maxY-minY,
      0x829cb0
    );
  }

  for (const w of data.windows) {
    markers.set(
      w.id,
      marker(w.x, w.z, w.y, 0x62baff, 0.6)
    );
  }

  if (data.incidents.length) {
    const i = data.incidents[0];
    incident = {x:i.x, y:i.y, z:i.z};
  }

  incidentMarker = marker(
    incident.x,
    incident.z,
    incident.y,
    0xffba42,
    1.1
  );

  await refreshSceneObjects();

  document.getElementById('summary').textContent =
    `${data.buildings.length} buildings | ` +
    `${data.windows.length} windows | ` +
    `${sceneObjectMeshes.size} active street objects`;

  document.getElementById('status').textContent =
    'Scene loaded from Tanzu PostgreSQL';
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const groundPlane = new THREE.Plane(
  new THREE.Vector3(0,1,0),0
);

document.getElementById('moveIncident')
  .addEventListener('click', () => {
    moveMode = !moveMode;

    document.getElementById('moveIncident').textContent =
      `Move Incident: ${moveMode ? 'ON' : 'OFF'}`;
  });

renderer.domElement.addEventListener('click', event => {
  if (!moveMode || !incidentMarker) return;

  const rect = renderer.domElement.getBoundingClientRect();

  pointer.x =
    (event.clientX-rect.left)/rect.width*2-1;

  pointer.y =
    -(event.clientY-rect.top)/rect.height*2+1;

  raycaster.setFromCamera(pointer,camera);

  const hit = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(groundPlane,hit)) {
    return;
  }

  if (Math.abs(hit.x)>55 || Math.abs(hit.z)>55) return;
  if (Math.abs(hit.x)>7 && Math.abs(hit.z)>7) return;

  incident = {x:hit.x, y:hit.z, z:1.5};

  incidentMarker.position.set(
    incident.x,
    incident.z,
    incident.y
  );

  visibilityView.clear();

  document.getElementById('status').textContent =
    `Incident moved to (${incident.x.toFixed(1)}, ` +
    `${incident.y.toFixed(1)})`;
});

async function analyze() {
  const k = Number(document.getElementById('k').value);

  const result = await getVisibility(
    incident.x, incident.y, incident.z, k
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
    const p = document.createElement('p');

    p.textContent =
      `${w.building} | Floor ${w.floor_no} | ` +
      `${Number(w.distance_m).toFixed(2)} m`;

    output.appendChild(p);
  }

  const blocked = document.createElement('p');
  blocked.textContent =
    `Blocked candidates: ${result.blocked_count}`;
  output.appendChild(blocked);
}

document.getElementById('run')
  .addEventListener('click', () => {
    analyze().catch(showError);
  });

function showError(error) {
  console.error(error);

  document.getElementById('status').textContent =
    'Error: ' + error.message;
}

async function initializeDashboard() {
  await initialize();

  await createObstacleControls(
    document.getElementById('obstacleControls'),
    async () => {
      await refreshSceneObjects();
      await analyze();
    }
  );

  initializeInvestigationTools(
    () => incident,
    scene
  );
}

initializeDashboard().catch(showError);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect =
    container.clientWidth/container.clientHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );
});
