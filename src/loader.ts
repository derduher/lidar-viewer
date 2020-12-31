import { useEffect, useState } from "react";
import { BufferGeometry, Color, Geometry, Material, Points } from "three";
import { PCDLoader } from "./pcd-loader";
import scenes from "./scenes.json";

export interface BasicVector3 {
  x: number;
  y: number;
  z: number;
}
export interface BasicVector4 extends BasicVector3 {
  w: number;
}
export interface LidarImage {
  cx: number;
  cy: number;
  fx: number;
  fy: number;
  heading: BasicVector4;
  image_url: string;
  k1: number;
  k2: number;
  k3: number;
  p1: number;
  p2: number;
  position: BasicVector3;
  scale_factor: number;
  skew: number;
  timestamp: number;
}
export interface LidarPoint extends BasicVector3 {
  i: number;
}
export interface Frame {
  device_heading: BasicVector4;
  device_position: BasicVector3;
  images: LidarImage[];
  points: LidarPoint[];
  radar_points: LidarPoint[]; // pure guess
  timestamp: number;
}

export const useNuScenesFrame = (sceneParam: string): Frame[] | null => {
  const [frame, setFrame] = useState<Frame[] | null>(null);
  useEffect(() => {
    if (!sceneParam) return;
    const scene = scenes.find((scene) => scene.name.endsWith(sceneParam));
    if (!scene) return;
    const numberspread: number[] = [];
    for (let i = 0; i < 40; i++) {
      numberspread[i] = i;
    }
    const promises: Promise<[Frame, Response]>[] = numberspread.map((frameNo) =>
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
        .then(async (resp) => [(await resp.json()) as Frame, resp])
    );
    Promise.allSettled(promises).then((results) => {
      setFrame(
        results
          .filter((resp) => resp.status === "fulfilled")
          .map((resp) => {
            return (resp as PromiseFulfilledResult<[Frame, Response]>).value[0];
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
  uuid: string;
  label: string; // traffic_cone
  position: BasicVector3;
  dimensions: BasicVector3;
  yaw: number;
  stationary: boolean;
  camera_used: null;
  attributes: {
    visibility: "81%-100%";
  };
}

export interface AnnotationFrame {
  cuboids: Cuboid[];
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
