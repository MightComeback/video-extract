import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { normalizeUrlLike } from "../../src/brief.js";

// These tests focus on provider URL detection/normalization parity.
// (Normalization happens in normalizeUrlLike.)

describe("provider URL normalization", () => {
  test("accepts YouTube youtu.be short links", () => {
    const u = normalizeUrlLike("https://youtu.be/dQw4w9WgXcQ?t=43");
    assert.ok(u);
    assert.match(u, /^https:\/\//);
  });

  test("accepts Vimeo player URLs", () => {
    const u = normalizeUrlLike("https://player.vimeo.com/video/76979871");
    assert.ok(u);
    assert.match(u, /^https:\/\//);
  });

  test("normalizes unlisted Vimeo URLs to preserve the hash (h)", () => {
    const u = normalizeUrlLike("https://vimeo.com/76979871/abcdef1234");
    assert.equal(u, "https://vimeo.com/76979871?h=abcdef1234");
  });

  test("normalizes unlisted Vimeo URLs on channels paths to preserve the hash (h)", () => {
    const u = normalizeUrlLike("https://vimeo.com/channels/staffpicks/76979871/abcdef1234");
    assert.equal(u, "https://vimeo.com/76979871?h=abcdef1234");
  });

  test("accepts Loom share URLs", () => {
    const u = normalizeUrlLike("https://www.loom.com/share/0123456789abcdef0123456789abcdef");
    assert.ok(u);
    assert.match(u, /^https:\/\//);
  });

  test("normalizes bare Loom share URLs (loom.com/<id>)", () => {
    const u = normalizeUrlLike("https://loom.com/0123456789abcdef0123456789abcdef");
    assert.equal(u, "https://loom.com/share/0123456789abcdef0123456789abcdef");
  });

  test("normalizes YouTube mobile attribution_link shares", () => {
    const u = normalizeUrlLike(
      "https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3DdQw4w9WgXcQ%26t%3D43s%26feature%3Dshare"
    );
    assert.equal(u, "https://youtube.com/watch?v=dQw4w9WgXcQ&t=43s");
  });

  test("normalizes YouTube shorts URLs (including handle-based paths)", () => {
    const u1 = normalizeUrlLike("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share");
    assert.equal(u1, "https://youtube.com/watch?v=dQw4w9WgXcQ");

    const u2 = normalizeUrlLike("https://www.youtube.com/@SomeChannel/shorts/dQw4w9WgXcQ");
    assert.equal(u2, "https://youtube.com/watch?v=dQw4w9WgXcQ");
  });

  test("normalizes Vimeo manage URLs", () => {
    const u = normalizeUrlLike("https://vimeo.com/manage/videos/76979871");
    assert.equal(u, "https://vimeo.com/76979871");
  });
});
