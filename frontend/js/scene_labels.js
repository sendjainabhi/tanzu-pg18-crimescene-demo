import * as THREE from '../vendor/three.module.js';

export class SceneLabels {
  constructor(scene) {
    this.scene = scene;
    this.groups = new Map();
  }

  add(key, text, x, y, z, options = {}) {
    this.remove(key);

    const {
      color = '#ffffff',
      background = '#17314b',
      scale = 12,
      marker = false,
      markerZ = z,
      markerColor = 0x67e8f9
    } = options;

    const group = new THREE.Group();

    // PostgreSQL coordinates: X, Y, Z
    // Three.js coordinates: X, Z, Y
    group.position.set(x, 0, y);

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');

    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 112, 20);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64, 470);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, z, 0);
    sprite.scale.set(scale, scale / 4, 1);
    sprite.renderOrder = 100;

    group.add(sprite);

    if (marker) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 16, 12),
        new THREE.MeshBasicMaterial({
          color: markerColor,
          depthTest: false,
          depthWrite: false
        })
      );

      sphere.position.set(0, markerZ, 0);
      sphere.renderOrder = 99;
      group.add(sphere);

      // Vertical locator line from camera to label.
      const points = [
        new THREE.Vector3(0, markerZ + 0.7, 0),
        new THREE.Vector3(0, z - 1, 0)
      ];

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: markerColor,
          depthTest: false,
          depthWrite: false
        })
      );

      line.renderOrder = 98;
      group.add(line);
    }

    this.scene.add(group);
    this.groups.set(key, group);

    return group;
  }

  move(key, x, y, z) {
    const group = this.groups.get(key);
    if (!group) return;

    group.position.set(x, 0, y);

    const sprite = group.children.find(
      child => child.isSprite
    );

    if (sprite) {
      sprite.position.y = z;
    }
  }

  remove(key) {
    const group = this.groups.get(key);
    if (!group) return;

    this.scene.remove(group);

    group.traverse(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        for (const material of materials) {
          if (material.map) {
            material.map.dispose();
          }

          material.dispose();
        }
      }
    });

    this.groups.delete(key);
  }

  clearPrefix(prefix) {
    for (const key of Array.from(this.groups.keys())) {
      if (key.startsWith(prefix)) {
        this.remove(key);
      }
    }
  }

  clear() {
    for (const key of Array.from(this.groups.keys())) {
      this.remove(key);
    }
  }
}
