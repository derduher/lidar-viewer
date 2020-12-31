import {
  BufferGeometry,
  Color,
  FileLoader,
  Float32BufferAttribute,
  Loader,
  LoaderUtils,
  LoadingManager,
  Points,
  PointsMaterial,
} from "three";

interface PCDHeader {
  str: string;
  version?: number;
  fields: string[];
  size: number[];
  sizeMap: Record<string, number>;
  type?: Record<string, string>;
  count?: number[];
  width?: number;
  height?: number;
  viewpoint?: string;
  points: number;
  data: unknown;
  headerLen: number;
  rowSize: number;
  offset: Record<string, number>;
}

class PCDLoader extends Loader {
  littleEndian: boolean;
  constructor(manager?: LoadingManager) {
    super(manager);
    this.littleEndian = true;
  }

  load(
    url: string,
    onLoad: (points: Points) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void
  ): void {
    const loader = new FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (data) => {
        try {
          onLoad(this.parse(data, url));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }

          this.manager.itemError(url);
        }
      },
      onProgress,
      onError
    );
  }

  parse(
    data: ArrayBuffer | string,
    url: string,
    dotColor: Color = new Color()
  ): Points {
    // from https://gitlab.com/taketwo/three-pcd-loader/blob/master/decompress-lzf.js
    const dotColorHSL = {
      h: 0,
      s: 0,
      l: 0,
    };
    dotColor.getHSL(dotColorHSL);
    const dotColorSansL = new Color().setHSL(dotColorHSL.h, dotColorHSL.s, 0);

    function decompressLZF(
      inData: string | ArrayBuffer,
      outLength: number
    ): Uint8Array {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const inLength = inData.length;
      const outData = new Uint8Array(outLength);
      let inPtr = 0;
      let outPtr = 0;
      let ctrl;
      let len;
      let ref;
      do {
        ctrl = inData[inPtr++];
        if (ctrl < 1 << 5) {
          ctrl++;
          if (outPtr + ctrl > outLength)
            throw new Error("Output buffer is not large enough");
          if (inPtr + ctrl > inLength)
            throw new Error("Invalid compressed data");
          do {
            outData[outPtr++] = inData[inPtr++];
          } while (--ctrl);
        } else {
          len = ctrl >> 5;
          ref = outPtr - ((ctrl & 0x1f) << 8) - 1;
          if (inPtr >= inLength) throw new Error("Invalid compressed data");
          if (len === 7) {
            len += inData[inPtr++];
            if (inPtr >= inLength) throw new Error("Invalid compressed data");
          }

          ref -= inData[inPtr++];
          if (outPtr + len + 2 > outLength)
            throw new Error("Output buffer is not large enough");
          if (ref < 0) throw new Error("Invalid compressed data");
          if (ref >= outPtr) throw new Error("Invalid compressed data");
          do {
            outData[outPtr++] = outData[ref++];
          } while (--len + 2);
        }
      } while (inPtr < inLength);

      return outData;
    }

    function parseHeader(data: string): PCDHeader {
      // TODO properly throw when one of these is not found
      const PCDheader: PCDHeader = {
        str: "",
        headerLen: 0,
        data: null,
        fields: [],
        offset: {},
        rowSize: 0,
        size: [],
        points: 0,
        sizeMap: {},
      };
      const result1 = data.search(/[\r\n]DATA\s(\S*)\s/i);
      const result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data.substr(result1 - 1));

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [, PCDheader.data] = result2!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      PCDheader.headerLen = result2![0].length + result1;
      PCDheader.str = data.substr(0, PCDheader.headerLen);

      // remove comments

      PCDheader.str = PCDheader.str.replace(/#.*/gi, "");

      // parse

      const version = /VERSION (.*)/i.exec(PCDheader.str);
      const fields = /FIELDS (.*)/i.exec(PCDheader.str);
      const size = /SIZE (.*)/i.exec(PCDheader.str);
      const type = /TYPE (.*)/i.exec(PCDheader.str);
      const count = /COUNT (.*)/i.exec(PCDheader.str);
      const width = /WIDTH (.*)/i.exec(PCDheader.str);
      const height = /HEIGHT (.*)/i.exec(PCDheader.str);
      const viewpoint = /VIEWPOINT (.*)/i.exec(PCDheader.str);
      const points = /POINTS (.*)/i.exec(PCDheader.str);

      // evaluate

      if (version !== null) PCDheader.version = parseFloat(version[1]);

      if (fields !== null) PCDheader.fields = fields[1].split(" ");

      if (type !== null)
        PCDheader.type = type[1].split(" ").reduce((acc, type, idx) => {
          acc[PCDheader.fields[idx]] = type;
          return acc;
        }, {});

      if (width !== null) PCDheader.width = parseInt(width[1]);

      if (height !== null) PCDheader.height = parseInt(height[1]);

      if (viewpoint !== null) [, PCDheader.viewpoint] = viewpoint;

      if (points !== null) PCDheader.points = parseInt(points[1], 10);

      if (points === null && PCDheader.width && PCDheader.height)
        PCDheader.points = PCDheader.width * PCDheader.height;

      if (size !== null) {
        PCDheader.size = size[1].split(" ").map(function (x) {
          return parseInt(x, 10);
        });
        PCDheader.sizeMap = PCDheader.size.reduce((acc, size, idx) => {
          acc[PCDheader.fields[idx]] = size;
          return acc;
        }, {});
      }

      if (count !== null) {
        PCDheader.count = count[1].split(" ").map(function (x) {
          return parseInt(x, 10);
        });
      } else {
        PCDheader.count = [];

        for (let i = 0, l = PCDheader.fields.length; i < l; i++) {
          PCDheader.count.push(1);
        }
      }

      PCDheader.offset = {};

      let sizeSum = 0;

      for (let i = 0, l = PCDheader.fields.length; i < l; i++) {
        if (PCDheader.data === "ascii") {
          PCDheader.offset[PCDheader.fields[i]] = i;
        } else {
          PCDheader.offset[PCDheader.fields[i]] = sizeSum;
          sizeSum += PCDheader.size[i] * PCDheader.count[i];
        }
      }

      // for binary only

      PCDheader.rowSize = sizeSum;

      return PCDheader;
    }

    const textData = LoaderUtils.decodeText(
      new Uint8Array(data as ArrayBuffer)
    );

    // parse header (always ascii format)

    const PCDheader = parseHeader(textData);

    // parse data

    const position: number[] = [];
    const normal: number[] = [];
    const color: number[] = [];

    // ascii

    if (PCDheader.data === "ascii" && typeof data === "string") {
      const { offset } = PCDheader;
      const pcdData = textData.substr(PCDheader.headerLen);
      const lines = pcdData.split("\n");

      for (let i = 0, l = lines.length; i < l; i++) {
        if (lines[i] === "") continue;

        const line = lines[i].split(" ");

        if (offset.x !== undefined) {
          position.push(parseFloat(line[offset.x]));
          position.push(parseFloat(line[offset.y]));
          position.push(parseFloat(line[offset.z]));
        }

        if (offset.rgb !== undefined) {
          const rgb = parseFloat(line[offset.rgb]);
          const r = (rgb >> 16) & 0x0000ff;
          const g = (rgb >> 8) & 0x0000ff;
          const b = (rgb >> 0) & 0x0000ff;
          color.push(r / 255, g / 255, b / 255);
        }

        if (offset.normal_x !== undefined) {
          normal.push(parseFloat(line[offset.normal_x]));
          normal.push(parseFloat(line[offset.normal_y]));
          normal.push(parseFloat(line[offset.normal_z]));
        }
      }
    }

    // binary-compressed

    // normally data in PCD files are organized as array of structures: XYZRGBXYZRGB
    // binary compressed PCD files organize their data as structure of arrays: XXYYZZRGBRGB
    // that requires a totally different parsing approach compared to non-compressed data

    if (PCDheader.data === "binary_compressed" && typeof data !== "string") {
      const sizes = new Uint32Array(
        data.slice(PCDheader.headerLen, PCDheader.headerLen + 8)
      );
      const [compressedSize, decompressedSize] = sizes;
      const decompressed = decompressLZF(
        new Uint8Array(data, PCDheader.headerLen + 8, compressedSize),
        decompressedSize
      );
      const dataview = new DataView(decompressed.buffer);

      const { offset } = PCDheader;

      for (let i = 0; i < PCDheader.points; i++) {
        if (offset.x !== undefined) {
          position.push(
            dataview.getFloat32(
              PCDheader.points * offset.x + PCDheader.size[0] * i,
              this.littleEndian
            )
          );
          position.push(
            dataview.getFloat32(
              PCDheader.points * offset.y + PCDheader.size[1] * i,
              this.littleEndian
            )
          );
          position.push(
            dataview.getFloat32(
              PCDheader.points * offset.z + PCDheader.size[2] * i,
              this.littleEndian
            )
          );
        }

        if (offset.rgb !== undefined) {
          color.push(
            dataview.getUint8(
              PCDheader.points * offset.rgb + PCDheader.size[3] * i + 0
            ) / 255.0
          );
          color.push(
            dataview.getUint8(
              PCDheader.points * offset.rgb + PCDheader.size[3] * i + 1
            ) / 255.0
          );
          color.push(
            dataview.getUint8(
              PCDheader.points * offset.rgb + PCDheader.size[3] * i + 2
            ) / 255.0
          );
        }

        if (offset.normal_x !== undefined) {
          normal.push(
            dataview.getFloat32(
              PCDheader.points * offset.normal_x + PCDheader.size[4] * i,
              this.littleEndian
            )
          );
          normal.push(
            dataview.getFloat32(
              PCDheader.points * offset.normal_y + PCDheader.size[5] * i,
              this.littleEndian
            )
          );
          normal.push(
            dataview.getFloat32(
              PCDheader.points * offset.normal_z + PCDheader.size[6] * i,
              this.littleEndian
            )
          );
        }
      }
    }

    // binary

    if (PCDheader.data === "binary" && typeof data !== "string") {
      const dataview = new DataView(data, PCDheader.headerLen);
      const { offset } = PCDheader;

      // let lmax = Number.NEGATIVE_INFINITY;
      // let lmin = Number.POSITIVE_INFINITY;
      // let rmax = Number.NEGATIVE_INFINITY;
      // let rmin = Number.POSITIVE_INFINITY;
      for (
        let i = 0, row = 0;
        i < PCDheader.points;
        i++, row += PCDheader.rowSize
      ) {
        // const li = dataview.getUint8(row + offset.lidar_info);
        // const r = dataview.getUint8(row + offset.ring);
        // if (lmax < li) {
        //   lmax = li;
        // }
        // if (lmin > li) {
        //   lmin = li;
        // }
        // if (rmax < r) {
        //   rmax = r;
        // }
        // if (rmin > r) {
        //   rmin = r;
        // }
        if (offset.x !== undefined) {
          position.push(dataview.getFloat32(row + offset.x, this.littleEndian));
          position.push(dataview.getFloat32(row + offset.y, this.littleEndian));
          position.push(dataview.getFloat32(row + offset.z, this.littleEndian));
        }

        if (offset.intensity !== undefined) {
          let accessor: keyof DataView = "getUint8";
          let i = 0;
          if (PCDheader.type?.intensity === "U") {
            switch (PCDheader.sizeMap.intensity) {
              case 1:
                accessor = "getUint8";
                break;
              case 2:
                accessor = "getUint16";
                break;
              case 4:
                accessor = "getUint32";
                break;
            }
            i = dataview[accessor](row + offset.intensity);
          } else if (PCDheader.type?.intensity === "F") {
            switch (PCDheader.sizeMap.intensity) {
              case 4:
                accessor = "getFloat32";
                dataview.getUint32(row + offset.intensity);
                break;
              case 8:
                accessor = "getFloat64";
                dataview.getUint16(row + offset.intensity);
                break;
            }
            i = dataview[accessor](row + offset.intensity, this.littleEndian);
          }
          color.push(
            ...dotColorSansL
              .clone()
              .offsetHSL(0, 0, i / 192 + 0.25)
              .toArray()
          );
        }

        if (offset.rgb !== undefined) {
          color.push(dataview.getUint8(row + offset.rgb + 2) / 255.0);
          color.push(dataview.getUint8(row + offset.rgb + 1) / 255.0);
          color.push(dataview.getUint8(row + offset.rgb + 0) / 255.0);
        }

        if (offset.normal_x !== undefined) {
          normal.push(
            dataview.getFloat32(row + offset.normal_x, this.littleEndian)
          );
          normal.push(
            dataview.getFloat32(row + offset.normal_y, this.littleEndian)
          );
          normal.push(
            dataview.getFloat32(row + offset.normal_z, this.littleEndian)
          );
        }
      }
      // console.log(lmin, lmax, rmin, rmax);
    }

    // build geometry

    const geometry = new BufferGeometry();

    if (position.length > 0)
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(position, 3)
      );
    if (normal.length > 0)
      geometry.setAttribute("normal", new Float32BufferAttribute(normal, 3));
    if (color.length > 0)
      geometry.setAttribute("color", new Float32BufferAttribute(color, 3));

    geometry.computeBoundingSphere();

    // build material

    const material = new PointsMaterial({ size: 0.005 });

    if (color.length > 0) {
      material.vertexColors = true;
    } else {
      material.color.setHex(Math.random() * 0xffffff);
    }

    // build point cloud

    const mesh = new Points(geometry, material);
    let name = url.split("").reverse().join("");
    name = /([^/]*)/.exec(name)?.[1] ?? "";
    name = name.split("").reverse().join("");
    mesh.name = name;

    return mesh;
  }
}

export { PCDLoader };
