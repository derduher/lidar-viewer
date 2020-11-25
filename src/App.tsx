import React, { RefObject, useEffect, useRef } from "react";
import * as THREE from "three";
import { BoxBufferGeometry, Color } from "three";
import "./styles.css";
// import { points as lidarpts } from "./points";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { useAnnotations, useFrame } from "./loader";
import scenes from "./scenes.json";

const usePointCloud = (ref: RefObject<HTMLDivElement>) => {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene") ?? "0011";
  const sceneId =
    scenes.find((scene) => scene.name.endsWith(sceneParam))?.token ??
    scenes[0].token;
  const frameParam = params.get("frame") ?? "001";
  const frameNo = parseInt(frameParam, 10);
  const frame = useFrame(sceneId, frameParam);
  const annotations = useAnnotations(sceneId);
  useEffect(() => {
    if (!frame || !annotations.length) return;
    const pos = frame.device_position;
    let container: HTMLElement;

    let camera: THREE.PerspectiveCamera,
      scene: THREE.Scene,
      renderer: THREE.WebGLRenderer,
      controls: PointerLockControls;

    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;
    let moveUp = false;
    let moveDown = false;
    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    const blocker = document.getElementById("blocker");
    const instructions = document.getElementById("instructions");
    if (!instructions || !blocker) return;

    instructions.addEventListener(
      "click",
      function () {
        controls.lock();
      },
      false
    );

    instructions.addEventListener(
      "click",
      function () {
        controls.lock();
      },
      false
    );

    const onKeyDown = function (event: KeyboardEvent) {
      switch (event.code) {
        case "ArrowUp": // up
        case "KeyW": // w
          moveForward = true;
          break;

        case "ArrowLeft": // left
        case "KeyA": // a
          moveLeft = true;
          break;

        case "ArrowDown": // down
        case "KeyS": // s
          moveBackward = true;
          break;

        case "ArrowRight": // right
        case "KeyD": // d
          moveRight = true;
          break;
        case "KeyF":
          moveUp = true;
          break;
        case "KeyV":
          moveDown = true;
          break;
      }
    };

    const onKeyUp = function (event: KeyboardEvent) {
      switch (event.code) {
        case "ArrowUp": // up
        case "KeyW": // w
          moveForward = false;
          break;

        case "ArrowLeft": // left
        case "KeyA": // a
          moveLeft = false;
          break;

        case "ArrowDown": // down
        case "KeyS": // s
          moveBackward = false;
          break;

        case "ArrowRight": // right
        case "KeyD": // d
          moveRight = false;
          break;
        case "KeyF":
          moveUp = false;
          break;
        case "KeyV":
          moveDown = false;
          break;
      }
    };

    document.addEventListener("keydown", onKeyDown, false);
    document.addEventListener("keyup", onKeyUp, false);

    let points: THREE.Object3D;

    if (ref.current) {
      init(ref);
      animate(performance.now());
    }

    function init(ref: RefObject<HTMLDivElement>) {
      if (!ref.current || !frame) return;
      container = ref.current;

      //

      camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.5,
        3500
      );
      // camera.position.z = 0;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0);
      // scene.fog = new THREE.Fog(0x050505, 2000, 3500);

      //

      const geometry = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];

      // const color = new THREE.Color();

      const n = 1000,
        n2 = n / 2; // particles spread in the cube

      let maxHSL = 0;
      let minHSL = 255;
      for (let i = 0; i < frame.points.length; i++) {
        const { x, y, z, i: intensity } = frame.points[i];
        positions.push(x - pos.x, y - pos.y, z - pos.z);
        if (intensity > maxHSL) {
          maxHSL = intensity;
        }
        if (intensity < minHSL) {
          minHSL = intensity;
        }
        // color.setRGB(1, 1, 1);
        const color = new Color(
          `hsl(200, 100%, ${((100 * intensity) / 255) | 0}%)`
        );
        // color.setHSL(1, 1, intensity / 255);

        colors.push(color.r, color.g, color.b);
      }
      annotations[frameNo].cuboids.forEach(({ dimensions, position, yaw }) => {
        const geo = new BoxBufferGeometry(
          dimensions.x,
          dimensions.y,
          dimensions.z
        );
        geo.rotateZ(yaw);
        geo.translate(
          position.x - pos.x,
          position.y - pos.y,
          position.z - pos.z
        );
        geo.computeBoundingSphere();
        const material = new THREE.LineDashedMaterial({
          dashSize: 0.2,
          gapSize: 0.1,
        });
        const mesh = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo.toNonIndexed()),
          material
        );
        mesh.computeLineDistances();

        mesh.rotation.x = -Math.PI / 2;
        scene.add(mesh);
      });
      console.log(maxHSL, minHSL);

      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3)
      );

      geometry.computeBoundingSphere();

      //

      const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
      });

      points = new THREE.Points(geometry, material);

      points.rotation.x = -Math.PI / 2;
      scene.add(points);

      //

      renderer = new THREE.WebGLRenderer();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);

      container.appendChild(renderer.domElement);
      controls = new PointerLockControls(camera, renderer.domElement);
      scene.add(controls.getObject());

      controls.addEventListener("lock", function () {
        if (!instructions || !blocker) return;
        instructions.style.display = "none";
        blocker.style.display = "none";
      });

      controls.addEventListener("unlock", function () {
        if (!instructions || !blocker) return;
        blocker.style.display = "grid";
        instructions.style.display = "";
      });

      window.addEventListener("resize", onWindowResize, false);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    //

    function animate(time: number) {
      requestAnimationFrame(animate);

      if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        velocity.y -= velocity.y * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.y = Number(moveUp) - Number(moveDown);
        direction.normalize(); // this ensures consistent movements in all directions

        if (moveForward || moveBackward)
          velocity.z -= direction.z * 100.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;
        if (moveUp || moveDown) velocity.y -= direction.y * 100.0 * delta;

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        // controls.moveUp();
        // const vec = new Vector3();

        // vec.crossVectors(camera.up, vec);
        // vec.setFromMatrixColumn(camera.matrix, 0);

        camera.translateY(-velocity.y * delta);

        // controls.getObject().position.y += velocity.y * delta; // new behavior
      }

      prevTime = time;
      render();
    }

    function render() {
      renderer.render(scene, camera);
    }
  }, [ref, frame, annotations, frameNo]);
};
export default function App() {
  const viewPort = useRef<HTMLDivElement>(null);
  // useSmiley();
  // useBasic();
  usePointCloud(viewPort);
  return (
    <div className="App">
      <div id="blocker">
        <div id="instructions">
          <span className="cta">Click to start</span>
          <br />
          <span className="sub">Esc to uh escape?</span>
          <br />
          <br />
          Move: WASD up/down: F/V
          <br />
          Look: MOUSE
        </div>
      </div>
      <div ref={viewPort} id="hi" />
    </div>
  );
}
