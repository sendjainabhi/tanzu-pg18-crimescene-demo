import {
  getObjects,
  setObstacleEnabled
} from './api_client.js';

export async function createObstacleControls(
  container,
  onUpdated
) {
  async function refresh() {
    const data = await getObjects();
    container.replaceChildren();

    const objects = data.objects.filter(
      obj => ['tree', 'vehicle', 'wall'].includes(
        obj.object_type
      )
    );

    for (const obj of objects) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;' +
        'align-items:center;padding:7px 0;' +
        'border-bottom:1px solid #344960';

      const label = document.createElement('span');
      label.textContent = obj.name;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = obj.enabled;

      checkbox.addEventListener('change', async () => {
        const requested = checkbox.checked;
        checkbox.disabled = true;

        try {
          await setObstacleEnabled(obj.id, requested);
          await onUpdated();
        } catch (error) {
          checkbox.checked = !requested;
          alert(error.message);
        } finally {
          checkbox.disabled = false;
        }
      });

      row.append(label, checkbox);
      container.appendChild(row);
    }
  }

  await refresh();
  return {refresh};
}
