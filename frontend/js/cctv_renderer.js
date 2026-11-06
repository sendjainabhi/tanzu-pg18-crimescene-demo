import * as THREE from '../vendor/three.module.js';

export class CCTVCoverageRenderer {
  constructor(scene) {
    this.scene = scene;
    this.groups = new Map();
    this.visible = true;
  }

  clear() {
    for (const group of this.groups.values()) {
      this.scene.remove(group);

      group.traverse(child => {
        if (child.isMesh || child.isLine) {
          child.geometry.dispose();

          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          materials.forEach(m => m.dispose());
        }
      });
    }

    this.groups.clear();
  }

  setVisible(visible) {
    this.visible = visible;

    for (const group of this.groups.values()) {
      group.visible = visible;
    }
  }

  update(cameras) {
    this.clear();

    for (const camera of cameras) {
      const group = this.createCoverageSector(camera);

      group.visible = this.visible;
      this.scene.add(group);
      this.groups.set(camera.id, group);
    }
  }

  createCoverageSector(camera) {
    const group = new THREE.Group();

    // PostgreSQL X,Y,Z -> Three.js X,Z,Y
    group.position.set(
      camera.x,
      camera.z,
      camera.y
    );

    const range = camera.range_m ?? 70;
    const fov = camera.fov_deg ?? 100;
    const heading = camera.heading_deg ?? 0;

    let color = 0x8995a5;

    if (camera.covered) {
      color = 0x35e6a4;
    } else if (camera.in_range && camera.in_fov) {
      color = 0xff5555;
    }

    const segments = 48;
    const vertices = [0, 0, 0];
    const indices = [];

    const headingRad = heading * Math.PI / 180;
    const halfFov = fov * Math.PI / 360;

    for (let i = 0; i <= segments; i++) {
      const angle =
        headingRad - halfFov +
        (i / segments) * halfFov * 2;

      vertices.push(
        Math.cos(angle) * range,
        0,
        Math.sin(angle) * range
      );
    }

    for (let i = 1; i <= segments; i++) {
      indices.push(0, i, i + 1);
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3)
    );

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    group.add(new THREE.Mesh(geometry, material));

    const outlinePoints = [];

    for (let i = 1; i < vertices.length / 3; i++) {
      outlinePoints.push(new THREE.Vector3(
        vertices[i * 3],
        vertices[i * 3 + 1],
        vertices[i * 3 + 2]
      ));
    }

    const outline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        outlinePoints
      ),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8
      })
    );

    group.add(outline);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({color})
    );

    group.add(marker);

    return group;
  }
}
