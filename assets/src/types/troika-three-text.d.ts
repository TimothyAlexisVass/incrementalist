declare module "troika-three-text" {
  import { BufferGeometry, Material, Mesh } from "three";

  export class Text extends Mesh<BufferGeometry, Material | Material[]> {
    text: string;
    font?: string;
    fontSize: number;
    fontStyle?: string;
    fontWeight?: string | number;
    color?: string | number;
    fillOpacity?: number;
    strokeColor?: string | number;
    strokeWidth?: number | string;
    strokeOpacity?: number;
    outlineColor?: string | number;
    outlineWidth?: number | string;
    outlineBlur?: number | string;
    outlineOffsetX?: number | string;
    outlineOffsetY?: number | string;
    outlineOpacity?: number;
    textAlign?: "left" | "center" | "right" | "justify";
    anchorX?: "left" | "center" | "right" | number | string;
    anchorY?: "top" | "top-baseline" | "middle" | "bottom" | "bottom-baseline" | number | string;
    textRenderInfo?: {
      blockBounds?: readonly [number, number, number, number] | readonly number[];
    };

    sync(callback?: () => void): void;
    dispose(): void;
  }
}
