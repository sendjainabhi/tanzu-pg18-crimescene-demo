import * as THREE from '../vendor/three.module.js';

export function renderObject(scene, obj) {
  const group = new THREE.Group();
  const d = obj.dimensions;

  group.position.set(obj.x, obj.z, obj.y);
  group.rotation.y = -obj.rotation_deg * Math.PI / 180;

  function box(w,h,depth,color,elevation=h/2) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w,h,depth),
      new THREE.MeshStandardMaterial({color})
    );
    mesh.position.y = elevation;
    group.add(mesh);
  }

  function sphere(radius,color,elevation) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius,16,12),
      new THREE.MeshStandardMaterial({color})
    );
    mesh.position.y = elevation;
    group.add(mesh);
  }

  switch(obj.object_type) {
    case 'tree':
      box(0.7,d.trunk_height,0.7,0x795439);
      sphere(d.canopy_radius,0x36835a,
             d.canopy_center_z);
      break;
    case 'vehicle':
      box(d.width,0.7,d.length,0x3479b9,0.65);
      box(d.width*0.8,0.65,d.length*0.55,
          0xa2c9dd,1.25);
      break;
    case 'streetlight':
      box(0.18,d.height,0.18,0x9ca9b4);
      sphere(0.35,0xffdf8c,d.height);
      break;
    case 'camera':
      box(0.7,0.4,0.7,0x222c39,0);
      break;
    case 'bench':
      box(d.width,0.15,d.depth,0x996a40,0.55);
      box(d.width,0.7,0.12,0x996a40,0.9);
      break;
    case 'wall':
      box(d.width,d.height,d.depth,0x9c9b96);
      break;
    case 'evidence':
      sphere(0.3,0xffd53d,0.35);
      break;
  }

  scene.add(group);
  return group;
}
