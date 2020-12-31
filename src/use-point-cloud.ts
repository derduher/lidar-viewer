import { RefObject, useEffect, useState } from "react";

import {
  Vector3,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  Object3D,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  HSL,
  Color,
  GridHelper,
  Quaternion,
  BoxBufferGeometry,
  LineDashedMaterial,
  LineSegments,
  EdgesGeometry,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { PointerLockControls } from "./pointer-lock-controls";
import {
  useNuScenesAnnotations,
  useNuScenesFrame,
  useLocal,
  Frame,
  AnnotationFrame,
} from "./loader";
import { colorToHSL } from "./utils";
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
  cameraHeading,
  cameraPosition,
}: {
  renderer: WebGLRenderer;
  localFrame: ReturnType<typeof useLocal>;
  selectedFile: UsePointCloudParams["selectedFile"];
  sceneParam: UsePointCloudParams["sceneParam"];
  annotations: ReturnType<typeof useNuScenesAnnotationMeshes>;
  nuScenesFrames: ReturnType<typeof useNuScenesFrameMesh>;
  backgroundColor: string;
  dotSize: number;
  dotColor: Color;
  cameraPosition: Frame["device_position"] | null;
  cameraHeading: Frame["device_heading"] | null;
}): [PerspectiveCamera, Scene, PointerLockControls] | void {
  if (
    (!localFrame && selectedFile) ||
    (sceneParam !== "" &&
      (!annotations.length ||
        !nuScenesFrames ||
        !cameraPosition ||
        !cameraHeading))
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
  scene.background = new Color(backgroundColor);

  const hsl: HSL = { h: 0, s: 0, l: 0 };
  dotColor.getHSL(hsl);

  camera.up = new Vector3(0, 0, 1);
  const ctrl = new TransformControls(camera, renderer.domElement);
  if (nuScenesFrames && !localFrame && cameraPosition && cameraHeading) {
    const { x: px, y: py, z: pz } = cameraPosition;
    camera.position.x = px;
    camera.position.y = py;
    camera.position.z = pz;

    nuScenesFrames.forEach((frame) => scene.add(frame));
    annotations.forEach((frame) => frame.forEach((ann) => scene.add(ann)));
    ctrl.attach(nuScenesFrames[0]);
    camera.applyQuaternion(
      new Quaternion(
        cameraHeading.x,
        cameraHeading.y,
        cameraHeading.z,
        cameraHeading.w
      )
    );
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

export interface UsePointCloudParams {
  viewPortRef: RefObject<HTMLDivElement>;
  blockerRef: RefObject<HTMLDivElement>;
  instructionsRef: RefObject<HTMLDivElement>;
  selectedFile: File | null;
  sceneParam: string;
  backgroundColor: string;
  dotSize: number;
  dotColor: Color;
  annotationColor: Color;
  annotationDashSize: number;
  annotationDashGap: number;
}
export const usePointCloud = ({
  viewPortRef,
  selectedFile,
  sceneParam,
  backgroundColor,
  blockerRef,
  instructionsRef,
  dotSize,
  dotColor,
  annotationColor,
  annotationDashSize,
  annotationDashGap,
}: UsePointCloudParams): void => {
  const localFrame = useLocal(selectedFile, dotColor);
  const nuScenesFrames = useNuScenesFrame(sceneParam);
  const nuScenesFrameGeometries = useNuScenesFrameMesh({
    frames: nuScenesFrames,
    dotColor,
    dotSize,
  });
  const rawAnnotations = useNuScenesAnnotations(sceneParam);
  const annotationMeshes = useNuScenesAnnotationMeshes(
    rawAnnotations,
    annotationColor,
    annotationDashSize,
    annotationDashGap
  );
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
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
      (sceneParam !== "" && (!annotationMeshes.length || !nuScenesFrames))
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
      cameraPosition: nuScenesFrames && nuScenesFrames[0].device_position,
      cameraHeading: nuScenesFrames && nuScenesFrames[0].device_heading,
      annotations: annotationMeshes,
      backgroundColor,
      dotSize,
      dotColor: dotColor,
    });
    if (!initResults) return undefined;
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
    nuScenesFrames,
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
};

const frameToMesh = ({
  frame,
  dotColor,
  dotSize,
}: {
  frame: Frame;
  dotColor: HSL;
  dotSize: number;
}): Object3D => {
  const positions: number[] = [];
  const colors: number[] = [];
  const geometry = new BufferGeometry();
  for (let i = 0; i < frame.points.length; i++) {
    const { x, y, z, i: intensity } = frame.points[i];
    positions.push(x, y, z);
    const pointColor = new Color();
    pointColor.setHSL(dotColor.h, dotColor.s, intensity / 192 + 0.25);

    colors.push(pointColor.r, pointColor.g, pointColor.b);
  }

  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  geometry.computeBoundingSphere();

  //

  const material = new PointsMaterial({
    size: dotSize,
    vertexColors: true,
  });

  return new Points(geometry, material);
};

const useNuScenesFrameMesh = ({
  frames,
  dotSize,
  dotColor,
}: {
  frames: Frame[] | null;
  dotSize: number;
  dotColor: Color;
}): Object3D[] | null => {
  const [geometries, setGeometries] = useState<Object3D[] | null>(null);
  useEffect(() => {
    if (!frames) return;
    const hslColor = colorToHSL(dotColor);
    setGeometries(
      frames.map((frame) => frameToMesh({ frame, dotColor: hslColor, dotSize }))
    );
  }, [dotColor, dotSize, frames]);
  return geometries;
};

const annotationsToMesh = (
  annotations: AnnotationFrame[],
  wireColor: Color,
  dashSize: number,
  gapSize: number
): LineSegments[][] =>
  annotations.map((frame) =>
    frame.cuboids.map(({ dimensions, position: { x, y, z }, yaw }) => {
      const geo = new BoxBufferGeometry(
        dimensions.x,
        dimensions.y,
        dimensions.z
      );
      geo.rotateZ(yaw);
      geo.translate(x, y, z);
      geo.computeBoundingSphere();
      const material = new LineDashedMaterial({
        dashSize,
        gapSize,
        color: wireColor,
      });
      const mesh = new LineSegments(
        new EdgesGeometry(geo.toNonIndexed()),
        material
      );
      mesh.computeLineDistances();
      return mesh;
    })
  );

const useNuScenesAnnotationMeshes = (
  annotations: ReturnType<typeof useNuScenesAnnotations>,
  wireColor: Color,
  dashSize: number,
  gapSize: number
): ReturnType<typeof annotationsToMesh> => {
  const [converted, setConverted] = useState<
    ReturnType<typeof annotationsToMesh>
  >([]);
  useEffect(() => {
    setConverted(annotationsToMesh(annotations, wireColor, dashSize, gapSize));
  }, [annotations, dashSize, gapSize, wireColor]);
  return converted;
};
