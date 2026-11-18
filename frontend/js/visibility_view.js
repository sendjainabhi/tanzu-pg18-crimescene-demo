import * as THREE from '../vendor/three.module.js';

export class VisibilityView {
  constructor(scene, markers) {
    this.scene = scene;
    this.markers = markers;
    this.lines = [];
    this.visible = true;
  }

  setVisible(value) {
    this.visible = value;

    for (const line of this.lines) {
      line.visible = value;
    }
  }

  clear() {
    for (const line of this.lines) {
      this.scene.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }

    this.lines = [];

    for (const mesh of this.markers.values()) {
      mesh.material.color.setHex(0x62baff);
    }
  }

  draw(incident, result) {
    this.clear();

    const start = new THREE.Vector3(
      incident.x,
      incident.z,
      incident.y
    );

    const drawRay = (windowData, color) => {
      const mesh = this.markers.get(
        windowData.id
      );

      if (!mesh) return;

      mesh.material.color.setHex(color);

      const end = new THREE.Vector3(
        windowData.x,
        windowData.z,
        windowData.y
      );

      const geometry = new THREE.BufferGeometry()
        .setFromPoints([start, end]);

      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false
      });

      const line = new THREE.Line(
        geometry,
        material
      );

      line.renderOrder = 20;
      line.visible = this.visible;

      this.scene.add(line);
      this.lines.push(line);
    };

    for (const windowData of result.blocked_windows) {
      drawRay(windowData, 0xff5555);
    }

    for (const windowData of result.visible_windows) {
      drawRay(windowData, 0x35e6a4);
    }
  }
}
