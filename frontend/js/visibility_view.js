import * as THREE from '../vendor/three.module.js';

export class VisibilityView {
  constructor(scene,markers) {
    this.scene = scene;
    this.markers = markers;
    this.lines = [];
  }

  clear() {
    for (const line of this.lines) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.lines = [];

    for (const marker of this.markers.values()) {
      marker.material.color.setHex(0x62baff);
    }
  }

  draw(incident,result) {
    this.clear();

    const start = new THREE.Vector3(
      incident.x,incident.z,incident.y
    );

    const addRay = (w,color) => {
      const marker = this.markers.get(w.id);
      if (!marker) return;

      marker.material.color.setHex(color);

      const end = new THREE.Vector3(w.x,w.z,w.y);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          start,end
        ]),
        new THREE.LineBasicMaterial({color})
      );
      this.scene.add(line);
      this.lines.push(line);
    };

    for (const w of result.blocked_windows) {
      addRay(w,0xff5555);
    }

    for (const w of result.visible_windows) {
      addRay(w,0x35e6a4);
    }
  }
}
