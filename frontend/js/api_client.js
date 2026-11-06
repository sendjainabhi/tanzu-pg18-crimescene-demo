async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const data = await response.json();
      message = data.error || message;
    } catch (_) {}

    throw new Error(message);
  }

  return response.json();
}

export function getScene() {
  return fetchJSON('/api/scene');
}

export function getObjects() {
  return fetchJSON('/api/objects');
}

export function getVisibility(x, y, z, k) {
  const params = new URLSearchParams({x, y, z, k});

  return fetchJSON(
    `/api/windows/visibility?${params.toString()}`
  );
}

export function setObstacleEnabled(objectId, enabled) {
  return fetchJSON(
    `/api/objects/${objectId}/enabled`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({enabled})
    }
  );
}
