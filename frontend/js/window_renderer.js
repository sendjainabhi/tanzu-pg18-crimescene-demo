import * as THREE from '../vendor/three.module.js';

export class WindowRenderer {
  constructor(scene) {
    this.scene = scene;
    this.windows = new Map();
  }

  add(windowData) {
    const facade = windowData.facade;

    const geometry = new THREE.PlaneGeometry(
      2.4,
      1.8
    );

    const material = new THREE.MeshBasicMaterial({
      color: 0x62baff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(
      geometry,
      material
    );

    // PostgreSQL (X,Y,Z) -> Three.js (X,Z,Y)
    mesh.position.set(
      windowData.x,
      windowData.z,
      windowData.y
    );

    const offset = 0.12;

    switch (facade) {
      case 'north':
        mesh.position.z += offset;
        break;

      case 'south':
        mesh.position.z -= offset;
        break;

      case 'east':
        mesh.position.x += offset;
        mesh.rotation.y = Math.PI / 2;
        break;

      case 'west':
        mesh.position.x -= offset;
        mesh.rotation.y = Math.PI / 2;
        break;

      default:
        console.warn(
          'Unknown window facade:',
          facade
        );
    }

    mesh.renderOrder = 10;

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0xd8edff,
        depthTest: false,
        depthWrite: false
      })
    );

    border.renderOrder = 11;
    mesh.add(border);

    this.scene.add(mesh);

    this.windows.set(
      windowData.id,
      mesh
    );

    return mesh;
  }

  setStatus(id, status) {
    const mesh = this.windows.get(id);

    if (!mesh) return;

    const colors = {
      default: 0x62baff,
      visible: 0x35e6a4,
      blocked: 0xff5555
    };

    mesh.material.color.setHex(
      colors[status] ?? colors.default
    );
  }

  reset() {
    for (const mesh of this.windows.values()) {
      mesh.material.color.setHex(0x62baff);
    }
  }
}
