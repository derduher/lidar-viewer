import { Dispatch, RefObject, useEffect, useState } from "react";

import {
  Vector3,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Object3D,
  BufferGeometry,
  EdgesGeometry,
  LineDashedMaterial,
  LineSegments,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  HSL,
  BoxBufferGeometry,
  Color,
  GridHelper,
  Quaternion,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { PointerLockControls } from "./pointer-lock-controls";
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

function init({
  renderer,
  localFrame,
  selectedFile,
  sceneParam,
  annotations,
  nuScenesFrame,
  backgroundColor,
  frameNo,
  dotSize,
  color,
}: {
  renderer: WebGLRenderer;
  localFrame: ReturnType<typeof useLocal>;
  selectedFile: UsePointCloudParams["selectedFile"];
  sceneParam: UsePointCloudParams["sceneParam"];
  annotations: ReturnType<typeof useNuScenesAnnotations>;
  nuScenesFrame: ReturnType<typeof useNuScenesFrame>;
  backgroundColor: string;
  frameNo: number;
  dotSize: number;
  color: string;
}): [PerspectiveCamera, Scene, PointerLockControls] | void {
  if (
    (!localFrame && selectedFile) ||
    (sceneParam !== "" && (!annotations.length || !nuScenesFrame))
  )
    return;

  let points: Object3D;

  //

  let camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.5,
    3500
  );
  camera.rotation.x = Math.PI / 2;
  // camera.position.z = 0;

  const scene = new Scene();
  scene.background = new Color(backgroundColor);

  const geometry = new BufferGeometry();

  const positions = [];
  const colors = [];
  const hsl: HSL = { h: 0, s: 0, l: 0 };
  new Color(color).getHSL(hsl);

  // const color = new THREE.Color();

  camera.up = new Vector3(0, 0, 1);
  const ctrl = new TransformControls(camera, renderer.domElement);
  if (nuScenesFrame && !localFrame) {
    const { x: px, y: py, z: pz } = nuScenesFrame.device_position;
    camera.position.x = px;
    camera.position.y = py;
    camera.position.z = pz;

    for (let i = 0; i < nuScenesFrame.points.length; i++) {
      const { x, y, z, i: intensity } = nuScenesFrame.points[i];
      positions.push(x, y, z);
      const pointColor = new Color();
      pointColor.setHSL(hsl.h, hsl.s, intensity / 192 + 0.25);

      colors.push(pointColor.r, pointColor.g, pointColor.b);
    }
    annotations[frameNo - 1].cuboids.forEach(
      ({ dimensions, position: { x, y, z }, yaw }) => {
        const geo = new BoxBufferGeometry(
          dimensions.x,
          dimensions.y,
          dimensions.z
        );
        geo.rotateZ(yaw);
        geo.translate(x, y, z);
        geo.computeBoundingSphere();
        const material = new LineDashedMaterial({
          dashSize: 0.2,
          gapSize: 0.1,
          color: "#FFC0CB",
        });
        const mesh = new LineSegments(
          new EdgesGeometry(geo.toNonIndexed()),
          material
        );
        mesh.computeLineDistances();

        scene.add(mesh);
      }
    );

    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

    geometry.computeBoundingSphere();

    //

    const material = new PointsMaterial({
      size: dotSize,
      vertexColors: true,
    });

    points = new Points(geometry, material);
    scene.add(points);
    ctrl.attach(points);
    camera.applyQuaternion(
      new Quaternion(
        nuScenesFrame.device_heading.x,
        nuScenesFrame.device_heading.y,
        nuScenesFrame.device_heading.z,
        nuScenesFrame.device_heading.w
      )
    );
  } else if (localFrame) {
    (Array.isArray(localFrame.material)
      ? localFrame.material
      : [localFrame.material]
    ).forEach((m) => {
      if (m instanceof PointsMaterial) {
        m.size = dotSize;
        m.color = new Color(color);
      }
    });
    scene.add(localFrame);
    ctrl.attach(localFrame);
  } else {
    debugger;
  }
  scene.add(ctrl);
  const grid = new GridHelper(10000, 10000, 0x888888, 0x444444);
  grid.rotateOnAxis(new Vector3(1, 0, 0), Math.PI / 2);
  scene.add(grid);

  //

  const controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.getObject());

  return [camera, scene, controls];
}

export interface UsePointCloudParams {
  viewPortRef: RefObject<HTMLDivElement>;
  blockerRef: RefObject<HTMLDivElement>;
  instructionsRef: RefObject<HTMLDivElement>;
  selectedFile: File | null;
  sceneParam: string;
  frameNo: number;
  backgroundColor: string;
  dotSize: number;
  setFrameNo: Dispatch<React.SetStateAction<number>>;
  color: string;
}
export const usePointCloud = ({
  viewPortRef,
  selectedFile,
  sceneParam,
  frameNo,
  backgroundColor,
  blockerRef,
  instructionsRef,
  dotSize,
  setFrameNo,
  color,
}: UsePointCloudParams) => {
  const localFrame = useLocal(selectedFile);
  const nuScenesFrame = useNuScenesFrame(sceneParam, frameNo);
  const annotations = useNuScenesAnnotations(sceneParam);
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  useEffect(() => {
    if (!viewPortRef.current) return;
    let viewPortDomEl = viewPortRef.current;
    const r = new WebGLRenderer();
    r.setPixelRatio(window.devicePixelRatio);
    r.setSize(viewPortDomEl.clientWidth, viewPortDomEl.clientHeight);

    viewPortDomEl.appendChild(r.domElement);
    setRenderer(r);
    return () => {
      r.dispose();
    };
  }, [viewPortRef]);
  useEffect(() => {
    if (
      !renderer ||
      !instructionsRef.current ||
      !blockerRef.current ||
      (!localFrame && !sceneParam) ||
      (!localFrame && selectedFile) ||
      (sceneParam !== "" && (!annotations.length || !nuScenesFrame))
    ) {
      return;
    }
    // const pos = frame.device_position;

    bindControls();

    let prevTime = performance.now();
    const velocity = new Vector3();
    const direction = new Vector3();

    const initResults = init({
      renderer,
      localFrame,
      selectedFile,
      sceneParam,
      nuScenesFrame,
      annotations,
      backgroundColor,
      frameNo,
      dotSize,
      color,
    });
    if (!initResults) return;
    const [camera, scene, controls] = initResults;

    controls.addEventListener("lock", function () {
      if (!instructionsRef.current || !blockerRef.current) return;
      instructionsRef.current.style.display = "none";
      blockerRef.current.style.display = "none";
    });

    controls.addEventListener("unlock", function () {
      if (!instructionsRef.current || !blockerRef.current) return;
      blockerRef.current.style.display = "grid";
      instructionsRef.current.style.display = "";
    });

    instructionsRef.current.addEventListener(
      "click",
      function () {
        controls.lock();
      },
      false
    );

    instructionsRef.current.addEventListener(
      "click",
      function () {
        controls.lock();
      },
      false
    );
    animate(performance.now());

    window.addEventListener("resize", onWindowResize, false);
    function onWindowResize() {
      if (!viewPortRef.current || !renderer) return;
      camera.aspect =
        viewPortRef.current.clientWidth / viewPortRef.current.clientHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(
        viewPortRef.current.clientWidth,
        viewPortRef.current.clientHeight
      );
    }

    //

    function animate(time: number) {
      requestAnimationFrame(animate);

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
      render();
    }

    function render() {
      renderer?.render(scene, camera);
    }
    return () => {
      controls.dispose();
    };
  }, [
    viewPortRef,
    localFrame,
    annotations,
    frameNo,
    backgroundColor,
    nuScenesFrame,
    sceneParam,
    selectedFile,
    blockerRef,
    instructionsRef,
    dotSize,
    setFrameNo,
    renderer,
    color,
  ]);
};
