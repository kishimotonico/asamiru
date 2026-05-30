import type { SVGProps } from "react";
import type { WeatherIconKind } from "./types";

type WeatherIconProps = {
  kind: WeatherIconKind;
  size?: number;
  strokeWidth?: number;
} & Pick<SVGProps<SVGSVGElement>, "className" | "aria-hidden">;

export function WeatherIcon({
  kind,
  size = 32,
  strokeWidth = 1.4,
  className,
  "aria-hidden": ariaHidden = true,
}: WeatherIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": ariaHidden,
  };

  switch (kind) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="5" />
          <line x1="16" y1="3" x2="16" y2="6" />
          <line x1="16" y1="26" x2="16" y2="29" />
          <line x1="3" y1="16" x2="6" y2="16" />
          <line x1="26" y1="16" x2="29" y2="16" />
          <line x1="6.5" y1="6.5" x2="8.7" y2="8.7" />
          <line x1="23.3" y1="23.3" x2="25.5" y2="25.5" />
          <line x1="6.5" y1="25.5" x2="8.7" y2="23.3" />
          <line x1="23.3" y1="8.7" x2="25.5" y2="6.5" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...common}>
          <path d="M9 22a5 5 0 0 1 .5-9.9 7 7 0 0 1 13.4 1.4 4.5 4.5 0 0 1-1.1 8.5Z" />
        </svg>
      );
    case "partly":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="4" />
          <line x1="11" y1="3" x2="11" y2="5" />
          <line x1="3" y1="11" x2="5" y2="11" />
          <line x1="5.5" y1="5.5" x2="7" y2="7" />
          <line x1="16.5" y1="5.5" x2="15" y2="7" />
          <path d="M12 24a4.5 4.5 0 0 1 .4-8.9 6.3 6.3 0 0 1 12 1.2 4 4 0 0 1-1 7.7Z" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M9 18a5 5 0 0 1 .5-9.9 7 7 0 0 1 13.4 1.4 4.5 4.5 0 0 1-1.1 8.5Z" />
          <line x1="11" y1="22" x2="9.5" y2="26" />
          <line x1="16" y1="22" x2="14.5" y2="26" />
          <line x1="21" y1="22" x2="19.5" y2="26" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          <path d="M9 18a5 5 0 0 1 .5-9.9 7 7 0 0 1 13.4 1.4 4.5 4.5 0 0 1-1.1 8.5Z" />
          <line x1="11" y1="22" x2="11" y2="26" />
          <line x1="16" y1="22" x2="16" y2="26" />
          <line x1="21" y1="22" x2="21" y2="26" />
        </svg>
      );
  }
}
