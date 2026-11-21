import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function pngInfo(path: string) {
  const buf = readFileSync(path);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
  };
}

describe("home screen", () => {
  it("keeps the Motion tags and the platform icon links", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    assert.match(root, /apple-touch-icon", href: "\/apple-touch-icon.png"/);
    assert.match(root, /name: "apple-mobile-web-app-title", content: "Motion"/);
    assert.match(root, /name: "apple-mobile-web-app-capable", content: "yes"/);
    assert.match(root, /rel: "manifest", href: "\/manifest.webmanifest"/);
    assert.match(root, /href: "\/__grok\/manifest.webmanifest"/);
    assert.match(root, /href: "\/__grok\/icon-180.png"/);
  });

  it("serves an opaque square icon at each required size", () => {
    const expected = [
      ["public/apple-touch-icon.png", 180],
      ["public/icon-192.png", 192],
      ["public/icon-512.png", 512],
    ] as const;
    for (const [path, size] of expected) {
      const info = pngInfo(path);
      assert.equal(info.width, size);
      assert.equal(info.height, size);
      assert.equal(info.colorType, 2);
    }
  });

  it("points the root manifest at those icons", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      background_color: string;
      theme_color: string;
      icons: Array<{ src: string; sizes: string; type: string }>;
    };
    assert.equal(manifest.name, "Motion");
    assert.equal(manifest.short_name, "Motion");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.background_color, "#1a1613");
    assert.equal(manifest.theme_color, "#1a1613");
    assert.deepEqual(
      manifest.icons.map((icon) => icon.sizes),
      ["192x192", "512x512"],
    );
  });
});
