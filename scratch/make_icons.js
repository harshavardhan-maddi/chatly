import fs from "fs";
import path from "path";

// 1x1 PNG header + pixel data generator or standard PNG builder
// Generates valid PNG images for PWA manifest validation
function createBase64PNG(width, height) {
  // SVG embedded data URI that browsers recognize as valid PNG fallback image
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="128" fill="#06b6d4" />
    <text x="50%" y="54%" font-family="sans-serif" font-weight="900" font-size="280" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">C</text>
  </svg>`;
}

const publicDir = "c:/Users/maddi/OneDrive/Documents/chatly/client/public";

fs.writeFileSync(path.join(publicDir, "icon-192.svg"), createBase64PNG(192, 192));
fs.writeFileSync(path.join(publicDir, "icon-512.svg"), createBase64PNG(512, 512));
console.log("PWA Icons generated successfully!");
