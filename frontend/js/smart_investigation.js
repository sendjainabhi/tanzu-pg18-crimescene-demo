import * as THREE from '../vendor/three.module.js';

export function initializeSmartInvestigation({
  scene,
  camera,
  canvas,
  getIncident,
  windowMarkers,
  sceneObjectMeshes,
  visibilityView
}) {
  const panel = document.getElementById('panel');

  const section = document.createElement('section');

  section.innerHTML = `
    <h2>Smart Investigation</h2>

    <p>Visibility classification and ray filtering</p>

    <label>Maximum displayed rays</label>
    <select id="smartRayLimit">
      <option value="5">5</option>
      <option value="10" selected>10</option>
      <option value="20">20</option>
      <option value="50">50</option>
    </select>

    <button id="runSmartVisibility">
      Analyze Smart Visibility
    </button>

    <div id="smartResults"></div>

    <h2>Selected Object</h2>
    <div id="selectedObject">
      Click a building, window or CCTV marker.
    </div>

    <h2>Hybrid PostGIS + pgvector Search</h2>

    <input id="hybridQuery"
      placeholder="vehicle obstruction witness"
      style="width:100%">

    <label>Search radius (meters)</label>
    <select id="hybridRadius">
      <option value="10">10</option>
      <option value="20">20</option>
      <option value="30" selected>30</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>

    <button id="runHybridSearch">
      Search Nearby Similar Cases
    </button>

    <div id="hybridResults"></div>
  `;

  const sqlInspector = document.getElementById('sql');

  if (sqlInspector) {
    sqlInspector.parentElement.insertBefore(
      section, sqlInspector
    );
  } else {
    panel.appendChild(section);
  }

  const smartOutput =
    document.getElementById('smartResults');

  const hybridOutput =
    document.getElementById('hybridResults');

  const selectedOutput =
    document.getElementById('selectedObject');

  let latestVisibility = null;

  function addText(parent, text, color) {
    const row = document.createElement('p');
    row.textContent = text;
    if (color) row.style.color = color;
    parent.appendChild(row);
  }

  function setWindowColor(id, color) {
    const mesh = windowMarkers.get(id);
    if (mesh) mesh.material.color.setHex(color);
  }

  function resetWindows() {
    for (const mesh of windowMarkers.values()) {
      mesh.material.color.setHex(0x62baff);
    }
  }

  document.getElementById('runSmartVisibility')
    .addEventListener('click', async () => {
      const incident = getIncident();
      const limit = Number(
        document.getElementById('smartRayLimit').value
      );

      const params = new URLSearchParams({
        ...incident, k: 100
      });

      smartOutput.textContent = 'Analyzing...';

      try {
        const response = await fetch(
          `/api/windows/smart?${params}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        latestVisibility = data;

        resetWindows();

        for (const w of data.not_facing_windows) {
          setWindowColor(w.id, 0xffba42);
        }

        for (const w of data.obstructed_windows) {
          setWindowColor(w.id, 0xff5555);
        }

        for (const w of data.visible_windows) {
          setWindowColor(w.id, 0x35e6a4);
        }

        // Only display a limited number of relevant rays.
        const visible = data.visible_windows.slice(0, limit);
        const obstructed =
          data.obstructed_windows.slice(0, limit);

        visibilityView.draw(incident, {
          visible_windows: visible,
          blocked_windows: obstructed
        });

        // Restore colors after VisibilityView resets them.
        for (const w of data.not_facing_windows) {
          setWindowColor(w.id, 0xffba42);
        }
        for (const w of data.obstructed_windows) {
          setWindowColor(w.id, 0xff5555);
        }
        for (const w of data.visible_windows) {
          setWindowColor(w.id, 0x35e6a4);
        }

        smartOutput.replaceChildren();

        addText(smartOutput,
          `Visible: ${data.visible_count}`, '#35e6a4');

        addText(smartOutput,
          `Obstructed: ${data.obstructed_count}`, '#ff7777');

        addText(smartOutput,
          `Not facing: ${data.not_facing_count}`, '#ffba42');

        if (sqlInspector) {
          sqlInspector.textContent = data.sql;
        }

      } catch (error) {
        smartOutput.textContent = error.message;
      }
    });

  document.getElementById('runHybridSearch')
    .addEventListener('click', async () => {
      const query = document.getElementById(
        'hybridQuery'
      ).value.trim();

      if (!query) return;

      const incident = getIncident();
      const radius = document.getElementById(
        'hybridRadius'
      ).value;

      const params = new URLSearchParams({
        q: query,
        ...incident,
        radius,
        limit: 10
      });

      hybridOutput.textContent = 'Searching...';

      try {
        const response = await fetch(
          `/api/investigations/hybrid?${params}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        hybridOutput.replaceChildren();

        addText(
          hybridOutput,
          `${data.result_count} matching investigations`
        );

        for (const item of data.results) {
          addText(
            hybridOutput,
            `${item.case_code} | ${item.category} | ` +
            `${item.distance_m.toFixed(1)} m | ` +
            `Similarity ${item.similarity.toFixed(3)}`
          );
        }

        if (sqlInspector) {
          sqlInspector.textContent = data.sql;
        }

      } catch (error) {
        hybridOutput.textContent = error.message;
      }
    });

  // --------------------------------------------------
  // Clickable object inspection
  // --------------------------------------------------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let pointerStart = null;

  canvas.addEventListener('pointerdown', event => {
    if (event.button === 0) {
      pointerStart = {
        x: event.clientX,
        y: event.clientY
      };
    }
  });

  canvas.addEventListener('pointerup', event => {
    if (!pointerStart || event.button !== 0) return;

    const movement = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y
    );

    pointerStart = null;

    if (movement > 5) return;

    const rect = canvas.getBoundingClientRect();

    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(pointer, camera);

    const selectable = [];

    for (const [id, mesh] of windowMarkers) {
      mesh.userData.inspection = {
        type: 'window',
        id
      };
      selectable.push(mesh);
    }

    for (const [id, group] of sceneObjectMeshes) {
      if (group.userData?.object_type === 'camera') {
        group.userData.inspection = {
          type: 'camera',
          id
        };
        selectable.push(group);
      }
    }

    scene.traverse(obj => {
      if (obj.userData?.buildingInfo) {
        selectable.push(obj);
      }
    });

    const hits = raycaster.intersectObjects(
      selectable, true
    );

    if (!hits.length) return;

    let selected = hits[0].object;

    while (selected &&
           !selected.userData.inspection &&
           !selected.userData.buildingInfo) {
      selected = selected.parent;
    }

    if (!selected) return;

    const info =
      selected.userData.inspection ||
      selected.userData.buildingInfo;

    if (info.type === 'window') {
      const all = latestVisibility
        ? [
            ...latestVisibility.visible_windows,
            ...latestVisibility.obstructed_windows,
            ...latestVisibility.not_facing_windows
          ]
        : [];

      const w = all.find(item => item.id === info.id);

      selectedOutput.textContent = w
        ? `${w.building}, Floor ${w.floor_no}, ` +
          `${w.facade} facade, ${w.distance_m.toFixed(2)} m, ` +
          `${w.visibility_status || (
            w.visible ? 'visible' : 'not visible'
          )}`
        : `Window ID ${info.id}. Run Smart Visibility for details.`;

    } else if (info.type === 'building') {
      selectedOutput.textContent =
        `${info.name} | Height: ${info.height_m} m`;

    } else if (info.type === 'camera') {
      selectedOutput.textContent =
        `CCTV camera ID ${info.id}. ` +
        `Use CCTV Coverage Analysis for range and direction.`;
    }
  });
}
