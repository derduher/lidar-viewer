import { RefObject, useEffect, useState } from "react";

import {
  Vector3,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  PointsMaterial,
  Color,
  GridHelper,
  Camera,
  Quaternion,
  Group,
  Points,
  LineSegments,
  LineDashedMaterial,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { PointerLockControls } from "./pointer-lock-controls";
import {
  useNuScenesAnnotations,
  useLocal,
  useNuScenesAnnotationMeshes,
  useNuScenesFrameMesh,
} from "./loader";
import { Frame } from "./frame";
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
  const onKeyDown = (event: KeyboardEvent): void => {
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

  const onKeyUp = (event: KeyboardEvent): void => {
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
  nuScenesFrames,
  backgroundColor,
  dotSize,
  dotColor,
}: {
  renderer: WebGLRenderer;
  localFrame: ReturnType<typeof useLocal>;
  selectedFile: UsePointCloudParams["selectedFile"];
  sceneParam: UsePointCloudParams["sceneParam"];
  annotations: ReturnType<typeof useNuScenesAnnotationMeshes>;
  nuScenesFrames: Frame[] | null;
  backgroundColor: Color;
  dotSize: number;
  dotColor: Color;
}): [PerspectiveCamera, Scene, PointerLockControls] | void {
  if (
    (!localFrame && selectedFile) ||
    (sceneParam !== "" && (!annotations.length || !nuScenesFrames))
  )
    return undefined;

  const camera = new PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.5,
    3500
  );
  camera.rotation.x = Math.PI / 2;

  const scene = new Scene();
  scene.background = backgroundColor;

  camera.up = new Vector3(0, 0, 1);
  const ctrl = new TransformControls(camera, renderer.domElement);
  if (nuScenesFrames && !localFrame) {
    const [firstFrame] = nuScenesFrames;

    const allPoints = new Group();
    nuScenesFrames.forEach((frame) => allPoints.add(frame.points));
    allPoints.name = "allPoints";
    scene.add(allPoints);

    const allAnnotations = new Group();
    annotations.forEach((frame) =>
      frame.forEach((ann) => allAnnotations.add(ann))
    );
    allAnnotations.name = "allAnnotations";
    scene.add(allAnnotations);

    ctrl.attach(firstFrame.points);
  } else if (localFrame) {
    (Array.isArray(localFrame.material)
      ? localFrame.material
      : [localFrame.material]
    ).forEach((m) => {
      if (m instanceof PointsMaterial) {
        m.size = dotSize;
        m.color = new Color(dotColor);
      }
    });
    scene.add(localFrame);
    ctrl.attach(localFrame);
  } else {
    // eslint-disable-next-line no-debugger
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

const useFrameAttributes = ({
  dotColor,
  dotSize,
  dashColor,
  dashSize,
  dashGap,
  activeCameraPosition,
  activeCameraHeading,
  camera,
  scene,
  backgroundColor,
}: {
  dotColor: Color;
  dotSize: number;
  dashColor: Color;
  dashSize: number;
  dashGap: number;
  activeCameraPosition: Vector3;
  activeCameraHeading: Quaternion;
  camera: Camera | null;
  scene: Scene | null;
  backgroundColor: Color;
}): void => {
  useEffect(() => {
    if (!camera) return;
    camera.position.x = activeCameraPosition.x;
    camera.position.y = activeCameraPosition.y;
    camera.position.z = activeCameraPosition.z;
    // camera.setRotationFromQuaternion(activeCameraHeading);
    // camera.rotateX(Math.PI / 2);
    // camera.quaternion.normalize();
    // camera.rotation.y = -Math.PI / 2;
  }, [camera, activeCameraPosition, activeCameraHeading]);
  useEffect(() => {
    if (!scene) return;
    scene.background = backgroundColor;
  }, [scene, backgroundColor]);

  useEffect(() => {
    if (!scene) return;
    const ann = scene.getObjectByName("allAnnotations");
    if (!ann) return;
    (ann as Group).children.forEach((frame) => {
      const mat = (frame as LineSegments).material as LineDashedMaterial;
      mat.color = dashColor;
      mat.dashSize = dashSize;
      mat.gapSize = dashGap;
    });
  }, [scene, dashColor, dashSize, dashGap]);

  useEffect(() => {
    if (!scene) return;
    const allPoints = scene.getObjectByName("allPoints");
    if (!allPoints) return;
    (allPoints as Group).children.forEach((frame) => {
      const mat = (frame as Points).material as PointsMaterial;
      mat.color = dotColor;
      mat.size = dotSize;
    });
  }, [scene, dotColor, dotSize]);
};

export interface UsePointCloudParams {
  activeCameraHeading: Quaternion;
  activeCameraPosition: Vector3;
  viewPortRef: RefObject<HTMLDivElement>;
  blockerRef: RefObject<HTMLDivElement>;
  instructionsRef: RefObject<HTMLDivElement>;
  selectedFile: File | null;
  sceneParam: string;
  backgroundColor: Color;
  dotSize: number;
  dotColor: Color;
  dashColor: Color;
  dashSize: number;
  dashGap: number;
}
export const usePointCloud = ({
  activeCameraPosition,
  activeCameraHeading,
  viewPortRef,
  selectedFile,
  sceneParam,
  backgroundColor,
  blockerRef,
  instructionsRef,
  dotSize,
  dotColor,
  dashColor,
  dashSize,
  dashGap,
}: UsePointCloudParams): Frame[] | null => {
  const localFrame = useLocal(selectedFile, dotColor);
  const nuScenesFrameGeometries = useNuScenesFrameMesh({
    sceneParam,
    dotColor,
    dotSize,
  });
  const rawAnnotations = useNuScenesAnnotations(sceneParam);
  const annotationMeshes = useNuScenesAnnotationMeshes(
    rawAnnotations,
    dashColor,
    dashSize,
    dashGap
  );
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  useEffect(() => {
    if (!viewPortRef.current) return undefined;
    const viewPortDomEl = viewPortRef.current;
    const r = new WebGLRenderer({ antialias: true });
    r.setPixelRatio(window.devicePixelRatio);
    r.setSize(viewPortDomEl.clientWidth, viewPortDomEl.clientHeight);

    viewPortDomEl.appendChild(r.domElement);
    setRenderer(r);
    bindControls();
    return (): void => r.dispose();
  }, [viewPortRef]);
  useEffect(() => {
    if (
      !renderer ||
      !instructionsRef.current ||
      !blockerRef.current ||
      (!localFrame && !sceneParam) ||
      (!localFrame && selectedFile) ||
      (sceneParam !== "" &&
        (!annotationMeshes.length || !nuScenesFrameGeometries))
    ) {
      return undefined;
    }
    // const pos = frame.device_position;

    let prevTime = performance.now();
    const velocity = new Vector3();
    const direction = new Vector3();

    const initResults = init({
      renderer,
      localFrame,
      selectedFile,
      sceneParam,
      nuScenesFrames: nuScenesFrameGeometries,
      annotations: annotationMeshes,
      backgroundColor,
      dotSize,
      dotColor,
    });
    if (!initResults) return undefined;
    const [camera, scene, controls] = initResults;
    setCamera(camera);
    setScene(scene);

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
    function onWindowResize(): void {
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

    function animate(time: number): void {
      requestAnimationFrame(animate);

      const {
        moveBackward,
        moveDown,
        moveForward,
        moveLeft,
        moveRight,
        moveUp,
        // reverseTime,
        // advanceTime,
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
        // if (advanceTime || reverseTime)
        //   setFrameNo(
        //     (frameNo) => frameNo + Number(advanceTime) - Number(reverseTime)
        //   );

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        camera.translateY(-velocity.y * delta);
      }

      prevTime = time;
      render();
    }

    function render(): void {
      renderer?.render(scene, camera);
    }
    return (): void => {
      controls.dispose();
    };
  }, [
    viewPortRef,
    localFrame,
    rawAnnotations,
    backgroundColor,
    sceneParam,
    selectedFile,
    blockerRef,
    instructionsRef,
    dotSize,
    renderer,
    dotColor,
    nuScenesFrameGeometries,
    annotationMeshes,
  ]);
  useFrameAttributes({
    dotColor,
    dotSize,
    dashColor,
    dashSize,
    dashGap,
    scene,
    backgroundColor,
    activeCameraHeading,
    activeCameraPosition,
    camera,
  });
  return nuScenesFrameGeometries;
};
