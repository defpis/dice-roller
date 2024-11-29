import "./style.css";
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import * as CANNON from "cannon-es";

const container = document.querySelector<HTMLDivElement>("#app");

if (!container) {
  throw new Error("Can't find container!");
}

// renderer
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.shadowMap.enabled = true;
const canvas = renderer.domElement;
container.appendChild(canvas);

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.7, 0.7, 0.7);

// camera
const camera = new THREE.PerspectiveCamera();
camera.position.set(0, 3, 30);
camera.lookAt(scene.position);

// resize
const observeSize = () => {
  const resize = (width: number, height: number, dpr: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);
  };

  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      const { width, height } = container.getBoundingClientRect();
      resize(width, height, devicePixelRatio);
    });
  });
  resizeObserver.observe(container);

  let remove: () => void;
  const onPixelRatioChange = () => {
    remove?.();

    const query = `(resolution: ${devicePixelRatio}dppx)`;
    const media = matchMedia(query);

    media.addEventListener("change", onPixelRatioChange);
    remove = () => media.removeEventListener("change", onPixelRatioChange);

    const { width, height } = container.getBoundingClientRect();
    resize(width, height, devicePixelRatio);
  };
  onPixelRatioChange();
};
observeSize();

// lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const topLight = new THREE.PointLight(0xffffff, 1000);
topLight.position.set(10, 15, 0);
topLight.castShadow = true;
topLight.shadow.mapSize.width = 2048;
topLight.shadow.mapSize.height = 2048;
scene.add(topLight);

// dice mesh
const params = {
  numberOfDice: 2,
  segments: 40,
  edgeRadius: 0.07,
  notchRadius: 0.12,
  notchDepth: 0.1,
};

const createBoxGeometry = () => {
  let boxGeometry = new THREE.BoxGeometry(
    1,
    1,
    1,
    params.segments,
    params.segments,
    params.segments
  );

  const positionAttr = boxGeometry.attributes.position;
  const subCubeHalfSize = 0.5 - params.edgeRadius;

  for (let i = 0; i < positionAttr.count; i++) {
    let position = new THREE.Vector3().fromBufferAttribute(positionAttr, i);

    const subCube = new THREE.Vector3(
      Math.sign(position.x),
      Math.sign(position.y),
      Math.sign(position.z)
    ).multiplyScalar(subCubeHalfSize);
    const addition = new THREE.Vector3().subVectors(position, subCube);

    if (
      Math.abs(position.x) > subCubeHalfSize &&
      Math.abs(position.y) > subCubeHalfSize &&
      Math.abs(position.z) > subCubeHalfSize
    ) {
      addition.normalize().multiplyScalar(params.edgeRadius);
      position = subCube.add(addition);
    } else if (
      Math.abs(position.x) > subCubeHalfSize &&
      Math.abs(position.y) > subCubeHalfSize
    ) {
      addition.z = 0;
      addition.normalize().multiplyScalar(params.edgeRadius);
      position.x = subCube.x + addition.x;
      position.y = subCube.y + addition.y;
    } else if (
      Math.abs(position.x) > subCubeHalfSize &&
      Math.abs(position.z) > subCubeHalfSize
    ) {
      addition.y = 0;
      addition.normalize().multiplyScalar(params.edgeRadius);
      position.x = subCube.x + addition.x;
      position.z = subCube.z + addition.z;
    } else if (
      Math.abs(position.y) > subCubeHalfSize &&
      Math.abs(position.z) > subCubeHalfSize
    ) {
      addition.x = 0;
      addition.normalize().multiplyScalar(params.edgeRadius);
      position.y = subCube.y + addition.y;
      position.z = subCube.z + addition.z;
    }

    const notchWave = (v: number) => {
      v = (1 / params.notchRadius) * v;
      v = Math.PI * Math.max(-1, Math.min(1, v));
      return params.notchDepth * (Math.cos(v) + 1);
    };
    const notch = (pos: [number, number]) =>
      notchWave(pos[0]) * notchWave(pos[1]);

    const offset = 0.23;

    if (position.y === 0.5) {
      // 1
      position.y -= notch([position.x, position.z]);
    } else if (position.x === 0.5) {
      // 2
      position.x -= notch([position.y + offset, position.z + offset]);
      position.x -= notch([position.y - offset, position.z - offset]);
    } else if (position.z === 0.5) {
      // 3
      position.z -= notch([position.x - offset, position.y + offset]);
      position.z -= notch([position.x, position.y]);
      position.z -= notch([position.x + offset, position.y - offset]);
    } else if (position.z === -0.5) {
      // 4
      position.z += notch([position.x + offset, position.y + offset]);
      position.z += notch([position.x + offset, position.y - offset]);
      position.z += notch([position.x - offset, position.y + offset]);
      position.z += notch([position.x - offset, position.y - offset]);
    } else if (position.x === -0.5) {
      // 5
      position.x += notch([position.y + offset, position.z + offset]);
      position.x += notch([position.y + offset, position.z - offset]);
      position.x += notch([position.y, position.z]);
      position.x += notch([position.y - offset, position.z + offset]);
      position.x += notch([position.y - offset, position.z - offset]);
    } else if (position.y === -0.5) {
      // 6
      position.y += notch([position.x + offset, position.z + offset]);
      position.y += notch([position.x + offset, position.z]);
      position.y += notch([position.x + offset, position.z - offset]);
      position.y += notch([position.x - offset, position.z + offset]);
      position.y += notch([position.x - offset, position.z]);
      position.y += notch([position.x - offset, position.z - offset]);
    }

    positionAttr.setXYZ(i, position.x, position.y, position.z);
  }

  boxGeometry.deleteAttribute("normal");
  boxGeometry.deleteAttribute("uv");
  boxGeometry = BufferGeometryUtils.mergeVertices(
    boxGeometry
  ) as THREE.BoxGeometry;

  boxGeometry.computeVertexNormals();

  return boxGeometry;
};

const createInnerGeometry = () => {
  const baseGeometry = new THREE.PlaneGeometry(
    1 - 2 * params.edgeRadius,
    1 - 2 * params.edgeRadius
  );
  const offset = 0.48;
  return BufferGeometryUtils.mergeGeometries(
    [
      baseGeometry.clone().translate(0, 0, offset),
      baseGeometry.clone().translate(0, 0, -offset),
      baseGeometry
        .clone()
        .rotateX(0.5 * Math.PI)
        .translate(0, -offset, 0),
      baseGeometry
        .clone()
        .rotateX(0.5 * Math.PI)
        .translate(0, offset, 0),
      baseGeometry
        .clone()
        .rotateY(0.5 * Math.PI)
        .translate(-offset, 0, 0),
      baseGeometry
        .clone()
        .rotateY(0.5 * Math.PI)
        .translate(offset, 0, 0),
    ],
    false
  );
};

const createDiceMesh = () => {
  const boxMaterialOuter = new THREE.MeshStandardMaterial({
    color: 0xffffff,
  });
  const boxMaterialInner = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0,
    metalness: 1,
    side: THREE.DoubleSide,
  });

  const diceMesh = new THREE.Group();
  const innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
  const outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
  outerMesh.castShadow = true;
  diceMesh.add(innerMesh, outerMesh);

  return diceMesh;
};

const diceMesh = createDiceMesh();

const physicsWorld = new CANNON.World({
  allowSleep: true,
  gravity: new CANNON.Vec3(0, -50, 0),
});
physicsWorld.defaultContactMaterial.friction = 0.3;
physicsWorld.defaultContactMaterial.restitution = 0.3;

// dice
function createDice() {
  const mesh = diceMesh.clone();
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
  });
  physicsWorld.addBody(body);

  return { mesh, body };
}
const dice = createDice();

// floor
function createFloor() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.ShadowMaterial({ opacity: 0.3 })
  );
  floor.receiveShadow = true;
  floor.position.y = -7;
  floor.quaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), Math.PI * 0.5);
  scene.add(floor);

  const body = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
  });

  body.position.copy(floor.position as any);
  body.quaternion.copy(floor.quaternion as any);

  physicsWorld.addBody(body);
}
createFloor();

const throwDice = () => {
  dice.body.velocity.setZero();
  dice.body.angularVelocity.setZero();

  dice.mesh.position.set(0, 6, 0);
  dice.body.position.copy(dice.mesh.position as any);

  dice.mesh.rotation.set(
    2 * Math.PI * Math.random(),
    0,
    2 * Math.PI * Math.random()
  );
  dice.body.quaternion.copy(dice.mesh.quaternion as any);

  const force = 3 + 5 * Math.random();
  dice.body.applyImpulse(
    new CANNON.Vec3(-force, force, 0),
    new CANNON.Vec3(0, 0, 0.2)
  );

  dice.body.allowSleep = true;
};
throwDice();

renderer.setAnimationLoop(() => {
  physicsWorld.fixedStep();

  dice.mesh.position.copy(dice.body.position);
  dice.mesh.quaternion.copy(dice.body.quaternion);

  renderer.render(scene, camera);
});
