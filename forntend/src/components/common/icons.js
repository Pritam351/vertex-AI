/**
 * icons.js — Unified SVG icons matching VertexLearn AI design language
 */

export function getMegaphoneSvg({ size = 16, className = "icon-megaphone", color = "currentColor" } = {}) {
  return `<svg class="${className}" viewBox="0 0 28 24" width="${size}" height="${size}" fill="${color}" style="display:inline-block; vertical-align:middle;" aria-hidden="true">
  <rect x="2" y="7" width="7.5" height="6.5" rx="3.25" />
  <rect x="3.6" y="8" width="3.5" height="1.1" rx="0.55" fill="#0d1425" opacity="0.9" />
  <rect x="6.8" y="11.5" width="3.2" height="9" rx="1.6" />
  <path d="M7.5 7.5 L17.5 3.5 C18 3.3 18.2 3.6 18.2 4.1 L18.2 16.5 C18.2 17 18 17.3 17.5 17.1 L7.5 13.2 Z" />
  <path d="M14.5 15.2 L16.8 16.1 L16.8 12.5" fill="none" stroke="#0d1425" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
  <rect x="17.8" y="1.8" width="2.4" height="18" rx="1.2" />
  <line x1="22" y1="6" x2="24.8" y2="4" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
  <line x1="22.5" y1="11" x2="25.8" y2="11" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
  <line x1="22" y1="16" x2="24.8" y2="18" stroke="${color}" stroke-width="2.2" stroke-linecap="round" />
</svg>`;
}

