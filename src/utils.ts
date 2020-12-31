import { Color, HSL } from "three/src/math/Color";

export const colorToHSL = (color: Color): HSL => {
  const hsl: HSL = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return hsl;
};
