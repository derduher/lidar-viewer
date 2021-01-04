import { useEffect, useState } from "react";
import {
  BufferGeometry,
  Color,
  Geometry,
  Material,
  Points,
  Float32BufferAttribute,
  Quaternion,
  BoxBufferGeometry,
  LineDashedMaterial,
  LineSegments,
  EdgesGeometry,
  HSL,
  PointsMaterial,
  Vector3,
} from "three";
import { colorToHSL } from "./utils";
import { PCDLoader } from "./pcd-loader";
import scenes from "./scenes.json";
import { Frame } from "./frame";

export interface BasicVector3 {
  x: number;
  y: number;
  z: number;
}
export interface BasicVector4 extends BasicVector3 {
  w: number;
}
export interface LidarImage {
  readonly cx: number;
  readonly cy: number;
  readonly fx: number;
  readonly fy: number;
  readonly heading: BasicVector4;
  readonly image_url: string;
  readonly k1: number;
  readonly k2: number;
  readonly k3: number;
  readonly p1: number;
  readonly p2: number;
  readonly position: BasicVector3;
  readonly scale_factor: number;
  readonly skew: number;
  readonly timestamp: number;
}
export interface LidarPoint extends BasicVector3 {
  readonly i: number;
}
export interface NuScenesFrame {
  readonly device_heading: BasicVector4;
  readonly device_position: BasicVector3;
  readonly images: LidarImage[];
  readonly points: LidarPoint[];
  readonly radar_points: LidarPoint[]; // pure guess
  readonly timestamp: number;
}

export const useNuScenesFrame = (
  sceneParam: string
): NuScenesFrame[] | null => {
  const [frame, setFrame] = useState<NuScenesFrame[] | null>(null);
  useEffect(() => {
    if (!sceneParam) return;
    const scene = scenes.find((scene) => scene.name.endsWith(sceneParam));
    if (!scene) return;
    const numberspread: number[] = [];
    for (let i = 0; i < 40; i++) {
      numberspread[i] = i;
    }
    const promises: Promise<[NuScenesFrame, Response]>[] = numberspread.map(
      (frameNo) =>
        window
          .fetch(
            `https://www.nuscenes.org/frames/${scene.token}/${(frameNo + 1)
              .toString()
              .padStart(3, "0")}.json`,
            {
              mode: "cors",
              credentials: "omit",
            }
          )
          .then(async (resp) => [(await resp.json()) as NuScenesFrame, resp])
    );
    Promise.allSettled(promises).then((results) => {
      setFrame(
        results
          .filter((resp) => resp.status === "fulfilled")
          .map((resp) => {
            return (resp as PromiseFulfilledResult<[NuScenesFrame, Response]>)
              .value[0];
          })
      );
    });
  }, [sceneParam]);
  return frame;
};

interface BlobUnSupport {
  arrayBuffer: () => Promise<ArrayBuffer>;
}

const loader = new PCDLoader();
export const useLocal = (
  file: File | null,
  dotColor: Color
): Points<Geometry | BufferGeometry, Material | Material[]> | null => {
  const [frame, setFrame] = useState<Points<
    Geometry | BufferGeometry,
    Material | Material[]
  > | null>(null);
  useEffect(() => {
    if (!file) {
      setFrame(null);
    } else {
      (file as File & BlobUnSupport)
        .arrayBuffer()
        .then((blob) => loader.parse(blob, file.name, dotColor))
        .then(setFrame);
    }
  }, [dotColor, file]);
  return frame;
};

export interface Cuboid {
  readonly uuid: string;
  readonly label: string; // traffic_cone
  readonly position: BasicVector3;
  readonly dimensions: BasicVector3;
  readonly yaw: number;
  readonly stationary: boolean;
  readonly camera_used: null;
  readonly attributes: {
    readonly visibility: "81%-100%";
  };
}

export interface AnnotationFrame {
  readonly cuboids: Cuboid[];
}

export const useNuScenesAnnotations = (
  sceneParam: string
): AnnotationFrame[] => {
  const [frame, setFrame] = useState<AnnotationFrame[]>([]);
  useEffect(() => {
    if (!sceneParam) return;

    window
      .fetch(
        `https://www.nuscenes.org/frames/${
          scenes.find((scene) => scene.name.endsWith(sceneParam))?.token ??
          scenes[0].token
        }/annotation.json`,
        {
          mode: "cors",
          credentials: "omit",
        }
      )
      .then(async (resp) => [await resp.json(), resp])
      .then(([body, resp]) => {
        setFrame(body as AnnotationFrame[]);
      });
  }, [sceneParam]);
  return frame;
};

const frameToMesh = ({
  frame: {
    points,
    device_heading: { x: qx, y: qy, z: qz, w: qw },
    device_position: { x, y, z },
    timestamp,
    radar_points,
    images,
  },
  dotColor,
  dotSize,
}: {
  frame: NuScenesFrame;
  dotColor: HSL;
  dotSize: number;
}): Frame => {
  const positions: number[] = [];
  const colors: number[] = [];
  const geometry = new BufferGeometry();
  for (let i = 0; i < points.length; i++) {
    const { x, y, z, i: intensity } = points[i];
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
  const pts = new Points(geometry, material);

  return {
    device_heading: new Quaternion(qx, qy, qz, qw),
    device_position: new Vector3(x, y, z),
    images,
    points: pts,
    radar_points,
    timestamp,
  };
};

export const useNuScenesFrameMesh = ({
  sceneParam,
  dotSize,
  dotColor,
}: {
  sceneParam: string;
  dotSize: number;
  dotColor: Color;
}): Frame[] | null => {
  const frames = useNuScenesFrame(sceneParam);
  const [geometries, setGeometries] = useState<Frame[] | null>(null);
  useEffect(() => {
    if (!frames) return;
    const hslColor = colorToHSL(dotColor);
    setGeometries(
      frames.map((frame, idx) => {
        const f = frameToMesh({ frame, dotColor: hslColor, dotSize });
        f.points.name = `frame-points-geometry-${idx}`;
        return f;
      })
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

export const useNuScenesAnnotationMeshes = (
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
