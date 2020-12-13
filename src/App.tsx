import React, { RefObject, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BoxBufferGeometry, Color } from "three";
import "./styles.css";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";
import { useNuScenesAnnotations, useNuScenesFrame, useLocal } from "./loader";

interface ControlKeysPressed {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  moveUp: boolean;
  moveDown: boolean;
  advanceTime: boolean;
  reverseTime: boolean;
}

const p: ControlKeysPressed = {
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  moveUp: false,
  moveDown: false,
  advanceTime: false,
  reverseTime: false,
};

const bindControls = (): void => {
  const onKeyDown = function (event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowLeft": // left
        p.reverseTime = true;
        break;
      case "ArrowRight": // right
        p.advanceTime = true;
        break;
      case "ArrowUp": // up
      case "KeyW": // w
        p.moveForward = true;
        break;

      case "KeyA": // a
        p.moveLeft = true;
        break;

      case "ArrowDown": // down
      case "KeyS": // s
        p.moveBackward = true;
        break;

      case "KeyD": // d
        p.moveRight = true;
        break;
      case "KeyF":
      case "Space":
        p.moveUp = true;
        break;
      case "KeyV":
      case "ControlLeft":
        p.moveDown = true;
        break;
    }
  };

  const onKeyUp = function (event: KeyboardEvent) {
    switch (event.code) {
      case "ArrowLeft": // left
        p.reverseTime = false;
        break;
      case "ArrowRight": // right
        p.advanceTime = false;
        break;
      case "ArrowUp": // up
      case "KeyW": // w
        p.moveForward = false;
        break;

      case "KeyA": // a
        p.moveLeft = false;
        break;

      case "ArrowDown": // down
      case "KeyS": // s
        p.moveBackward = false;
        break;

      case "KeyD": // d
        p.moveRight = false;
        break;
      case "KeyF":
      case "Space":
        p.moveUp = false;
        break;
      case "KeyV":
      case "ControlLeft":
        p.moveDown = false;
        break;
    }
  };

  document.addEventListener("keydown", onKeyDown, false);
  document.addEventListener("keyup", onKeyUp, false);
};

export interface UsePointCloudParams {
  ref: RefObject<HTMLDivElement>;
  selectedFile: File | null;
  sceneParam: string | null;
  frameParam: string | null;
  brightBackground: boolean;
}

const usePointCloud = ({
  ref,
  selectedFile,
  sceneParam,
  frameParam,
  brightBackground,
}: UsePointCloudParams) => {
  const [frameNo, setFrameNo] = useState(parseInt(frameParam ?? "0", 10));
  const localFrame = useLocal(selectedFile);
  const nuScenesFrame = useNuScenesFrame(sceneParam, frameNo);
  const annotations = useNuScenesAnnotations(sceneParam);
  useEffect(() => {
    const blocker = document.getElementById("blocker");
    const instructions = document.getElementById("instructions");
    if (
      !instructions ||
      !blocker ||
      (!localFrame && !sceneParam) ||
      (!localFrame && selectedFile) ||
      (sceneParam !== null && (!annotations.length || !nuScenesFrame))
    ) {
      return;
    }
    // const pos = frame.device_position;
    let container: HTMLElement;

    let camera: THREE.PerspectiveCamera,
      scene: THREE.Scene,
      renderer: THREE.WebGLRenderer,
      controls: PointerLockControls;

    let raycaster: THREE.Raycaster;

    let controller1: THREE.Group, controller2: THREE.Group;
    let controllerGrip1, controllerGrip2;

    const intersected: THREE.Object3D[] = [];
    const tempMatrix = new THREE.Matrix4();

    let group: THREE.Group;
    bindControls();

    let prevTime = performance.now();
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

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

    let points: THREE.Object3D;

    if (ref.current) {
      init(ref);
      animate(performance.now());
    }

    function init(ref: RefObject<HTMLDivElement>) {
      if (
        !ref.current ||
        (!localFrame && selectedFile) ||
        (sceneParam !== null && (!annotations.length || !nuScenesFrame))
      )
        return;
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

      const geometry = new THREE.BufferGeometry();

      const positions = [];
      const colors = [];

      // const color = new THREE.Color();

      group = new THREE.Group();
      scene.add(group);
      if (nuScenesFrame) {
        const { x: px, y: py, z: pz } = nuScenesFrame.device_position;
        for (let i = 0; i < nuScenesFrame.points.length; i++) {
          const { x, y, z, i: intensity } = nuScenesFrame.points[i];
          positions.push(x - px, y - py, z - pz);
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
            geo.translate(position.x - px, position.y - py, position.z - pz);
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
      } else if (localFrame) {
        console.log("pcd", localFrame);
        (Array.isArray(localFrame.material)
          ? localFrame.material
          : [localFrame.material]
        ).forEach((m) => {
          if (m instanceof THREE.PointsMaterial) {
            m.size = 0.1;
            m.color = new Color(`hsl(200, 100%, 75%)`);
          }
        });
        localFrame.rotation.x = -Math.PI / 2;
        group.add(localFrame);
      } else {
        debugger;
      }

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
          // object.material.emissive.b = 1;
          controller.attach(object);

          controller.userData.selected = object;
        }
      }

      function onSelectEnd(event: { target?: THREE.Group }) {
        const controller = event.target;
        if (!controller) return;

        if (controller.userData.selected !== undefined) {
          const object = controller.userData.selected;
          // object.material.emissive.b = 0;
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
        // object.material.emissive.r = 1;
        intersected.push(object);

        line.scale.z = intersection.distance;
      } else if (line) {
        line.scale.z = 5;
      }
    }

    function cleanIntersected() {
      // while (intersected.length) {
      //   const object = intersected.pop();
      //   // // @ts-ignore
      //   // object.material.emissive.r = 0;
      // }
    }

    //

    function animate(time = performance.now()) {
      // requestAnimationFrame(animate);

      const {
        moveBackward,
        moveDown,
        moveForward,
        moveLeft,
        moveRight,
        moveUp,
        reverseTime,
        advanceTime,
      } = p;

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
  }, [
    ref,
    localFrame,
    annotations,
    frameNo,
    brightBackground,
    nuScenesFrame,
    sceneParam,
    selectedFile,
  ]);
};
export default function App() {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene");
  const frameParam = params.get("frame");
  const brightBackground = params.get("brightBackground") === "true";
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const viewPort = useRef<HTMLDivElement>(null);
  usePointCloud({
    ref: viewPort,
    selectedFile,
    sceneParam,
    frameParam,
    brightBackground,
  });
  return (
    <div className="App">
      <div id="blocker">
        <div id="instructions">
          <div className="filePick">
            <label htmlFor="pcd">Select a file</label>
            <input
              id="pcd"
              type="file"
              name="pcd"
              onChange={(e) =>
                setSelectedFile(e.target.files && e.target.files[0])
              }
            />
          </div>
          {!selectedFile && !sceneParam ? null : (
            <span className="cta">Click to start</span>
          )}
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
