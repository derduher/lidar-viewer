import React, { RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BoxBufferGeometry, Color } from "three";
import "./styles.css";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";

import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { useAnnotations, useFrame } from "./loader";
import scenes from "./scenes.json";

const usePointCloud = (ref: RefObject<HTMLDivElement>) => {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene") ?? "0011";
  const sceneId =
    scenes.find((scene) => scene.name.endsWith(sceneParam))?.token ??
    scenes[0].token;
  const frameParam = params.get("frame") ?? "001";
  const brightBackground = params.get("brightBackground") === "true";
  const [frameNo, setFrameNo] = useState(parseInt(frameParam, 10));
  const frame = useFrame(sceneId, frameNo.toString().padStart(3, "0"));
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
    let raycaster: THREE.Raycaster;

    let controller1: THREE.Group, controller2: THREE.Group;
    let controllerGrip1, controllerGrip2;

    const intersected: THREE.Object3D[] = [];
    const tempMatrix = new THREE.Matrix4();

    let group: THREE.Group;

    let advanceTime = false;
    let reverseTime = false;
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
        case "ArrowLeft": // left
          reverseTime = true;
          break;
        case "ArrowRight": // right
          advanceTime = true;
          break;
        case "ArrowUp": // up
        case "KeyW": // w
          moveForward = true;
          break;

        case "KeyA": // a
          moveLeft = true;
          break;

        case "ArrowDown": // down
        case "KeyS": // s
          moveBackward = true;
          break;

        case "KeyD": // d
          moveRight = true;
          break;
        case "KeyF":
        case "Space":
          moveUp = true;
          break;
        case "KeyV":
        case "ControlLeft":
          moveDown = true;
          break;
      }
    };

    const onKeyUp = function (event: KeyboardEvent) {
      switch (event.code) {
        case "ArrowLeft": // left
          reverseTime = false;
          break;
        case "ArrowRight": // right
          advanceTime = false;
          break;
        case "ArrowUp": // up
        case "KeyW": // w
          moveForward = false;
          break;

        case "KeyA": // a
          moveLeft = false;
          break;

        case "ArrowDown": // down
        case "KeyS": // s
          moveBackward = false;
          break;

        case "KeyD": // d
          moveRight = false;
          break;
        case "KeyF":
        case "Space":
          moveUp = false;
          break;
        case "KeyV":
        case "ControlLeft":
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
      scene.background = new THREE.Color(brightBackground ? 0xffffff : 0);
      // scene.fog = new THREE.Fog(0x050505, 2000, 3500);

      //

      const geometry = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];

      // const color = new THREE.Color();

      group = new THREE.Group();
      scene.add(group);

      const n = 1000,
        n2 = n / 2; // particles spread in the cube

      for (let i = 0; i < frame.points.length; i++) {
        const { x, y, z, i: intensity } = frame.points[i];
        positions.push(x - pos.x, y - pos.y, z - pos.z);
        // color.setRGB(1, 1, 1);
        const color = new Color(
          `hsl(200, 100%, ${((100 * intensity) / 255) | 0}%)`
        );
        // color.setHSL(1, 1, intensity / 255);

        colors.push(color.r, color.g, color.b);
      }
      annotations[frameNo - 1].cuboids.forEach(
        ({ dimensions, position, yaw }) => {
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
            color: brightBackground ? 0 : 0xffffff,
          });
          const mesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo.toNonIndexed()),
            material
          );
          mesh.computeLineDistances();

          mesh.rotation.x = -Math.PI / 2;
          scene.add(mesh);
        }
      );

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
      group.add(points);
      scene.add(points);

      //

      renderer = new THREE.WebGLRenderer();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      renderer.xr.enabled = true;
      document.body.appendChild(VRButton.createButton(renderer));

      container.appendChild(renderer.domElement);
      controls = new PointerLockControls(camera, renderer.domElement);
      scene.add(controls.getObject());

      function onSelectStart(event: { target?: THREE.Group }) {
        const controller = event.target;
        if (!controller) return;

        const intersections = getIntersections(controller);

        if (intersections.length > 0) {
          const intersection = intersections[0];

          const object = intersection.object;
          // @ts-ignore
          object.material.emissive.b = 1;
          controller.attach(object);

          controller.userData.selected = object;
        }
      }

      function onSelectEnd(event: { target?: THREE.Group }) {
        const controller = event.target;
        if (!controller) return;

        if (controller.userData.selected !== undefined) {
          const object = controller.userData.selected;
          object.material.emissive.b = 0;
          group.attach(object);

          controller.userData.selected = undefined;
        }
      }

      // controllers

      controller1 = renderer.xr.getController(0);
      controller1.addEventListener("selectstart", onSelectStart);
      controller1.addEventListener("selectend", onSelectEnd);
      scene.add(controller1);

      controller2 = renderer.xr.getController(1);
      controller2.addEventListener("selectstart", onSelectStart);
      controller2.addEventListener("selectend", onSelectEnd);
      scene.add(controller2);

      const controllerModelFactory = new XRControllerModelFactory();

      controllerGrip1 = renderer.xr.getControllerGrip(0);
      controllerGrip1.add(
        controllerModelFactory.createControllerModel(controllerGrip1)
      );
      scene.add(controllerGrip1);

      controllerGrip2 = renderer.xr.getControllerGrip(1);
      controllerGrip2.add(
        controllerModelFactory.createControllerModel(controllerGrip2)
      );
      scene.add(controllerGrip2);

      //

      const geometryRay = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);

      const line = new THREE.Line(geometryRay);
      line.name = "line";
      line.scale.z = 5;

      controller1.add(line.clone());
      controller2.add(line.clone());

      raycaster = new THREE.Raycaster();

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

    function getIntersections(controller: THREE.Group) {
      tempMatrix.identity().extractRotation(controller.matrixWorld);

      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

      return raycaster.intersectObjects(group.children);
    }
    function intersectObjects(controller: THREE.Group) {
      // Do not highlight when already selected

      if (controller.userData.selected !== undefined) return;

      const line = controller.getObjectByName("line");
      const intersections = getIntersections(controller);

      if (intersections.length > 0 && line) {
        const intersection = intersections[0];

        const object = intersection.object;

        // @ts-ignore
        object.material.emissive.r = 1;
        intersected.push(object);

        line.scale.z = intersection.distance;
      } else if (line) {
        line.scale.z = 5;
      }
    }

    function cleanIntersected() {
      while (intersected.length) {
        const object = intersected.pop();

        // @ts-ignore
        object.material.emissive.r = 0;
      }
    }

    //

    function animate(time = performance.now()) {
      // requestAnimationFrame(animate);

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
        if (advanceTime || reverseTime)
          setFrameNo(
            (frameNo) => frameNo + Number(advanceTime) - Number(reverseTime)
          );

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        camera.translateY(-velocity.y * delta);
      }

      prevTime = time;
      renderer.setAnimationLoop(render);
    }

    function render() {
      cleanIntersected();

      intersectObjects(controller1);
      intersectObjects(controller2);
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
