import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind クラスを条件結合し、競合するユーティリティは後勝ちでマージする。
 *
 * テンプレートリテラルで固定クラスと式を直結すると（例: `foo${cond ? " bar" : ""}`）、
 * Tailwind の scanner がクラスを抽出できず CSS が生成されない。cn で各クラスを独立した
 * 引数として渡すことで、この問題を構造的に防ぐ。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
