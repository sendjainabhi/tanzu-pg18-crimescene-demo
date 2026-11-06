import {
  CCTVCoverageRenderer
} from './cctv_renderer.js';

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status}`
    );
  }

  return response.json();
}

export function initializeInvestigationTools(
  getIncident,
  scene
) {
  const coverageRenderer =
    new CCTVCoverageRenderer(scene);

  const cctvButton =
    document.getElementById('analyzeCCTV');

  const searchButton =
    document.getElementById('searchCases');

  const toggleButton =
    document.getElementById('toggleCCTVCones');

  const cctvOutput =
    document.getElementById('cctvResults');

  const caseOutput =
    document.getElementById('caseResults');

  let conesVisible = true;

  cctvButton.addEventListener('click', async () => {
    const {x, y, z} = getIncident();

    const params = new URLSearchParams({
      x, y, z
    });

    cctvOutput.textContent = 'Analyzing CCTV coverage...';

    try {
      const data = await getJSON(
        `/api/cctv/coverage?${params}`
      );

      coverageRenderer.update(data.cameras);

      cctvOutput.replaceChildren();

      const summary = document.createElement('p');
      summary.textContent =
        `${data.covering_count} of ` +
        `${data.cameras.length} cameras ` +
        `potentially cover this incident`;

      cctvOutput.appendChild(summary);

      for (const camera of data.cameras) {
        const row = document.createElement('p');

        const status = camera.covered
          ? 'COVERED'
          : camera.in_range && camera.in_fov
            ? 'BLOCKED'
            : 'OUTSIDE COVERAGE';

        row.textContent =
          `${camera.name}: ${status} | ` +
          `${camera.distance_m} m` +
          (camera.blockers.length
            ? ` | ${camera.blockers.join(', ')}`
            : '');

        row.style.color = camera.covered
          ? '#35e6a4'
          : camera.in_range && camera.in_fov
            ? '#ff7777'
            : '#aab8c7';

        cctvOutput.appendChild(row);
      }

      document.getElementById('sql').textContent =
        data.sql;

    } catch (error) {
      console.error(error);
      cctvOutput.textContent = error.message;
    }
  });

  toggleButton.addEventListener('click', () => {
    conesVisible = !conesVisible;

    coverageRenderer.setVisible(conesVisible);

    toggleButton.textContent = conesVisible
      ? 'Hide CCTV Coverage'
      : 'Show CCTV Coverage';
  });

  searchButton.addEventListener('click', async () => {
    const query = document
      .getElementById('caseQuery')
      .value.trim();

    if (!query) return;

    caseOutput.textContent = 'Searching pgvector...';

    try {
      const data = await getJSON(
        `/api/investigations/search?q=${
          encodeURIComponent(query)
        }`
      );

      caseOutput.replaceChildren();

      for (const item of data.results) {
        const row = document.createElement('p');

        row.textContent =
          `${item.case_code} | ${item.category} | ` +
          `Similarity: ${Number(
            item.similarity
          ).toFixed(3)} | ${item.description}`;

        caseOutput.appendChild(row);
      }

      document.getElementById('sql').textContent =
        data.sql;

    } catch (error) {
      console.error(error);
      caseOutput.textContent = error.message;
    }
  });
}
