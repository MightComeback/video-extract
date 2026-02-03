import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrlLike } from "../src/brief.js";

describe("normalizeUrlLike - tracking params", () => {
  test("strips utm_* params for Vimeo URLs", () => {
    assert.equal(
      normalizeUrlLike("https://vimeo.com/12345?utm_source=x&utm_campaign=y"),
      "https://vimeo.com/12345",
    );
  });

  test("strips fbclid/gclid while preserving Vimeo unlisted hash", () => {
    assert.equal(
      normalizeUrlLike("https://vimeo.com/12345/abcdef?fbclid=x&gclid=y"),
      "https://vimeo.com/12345?h=abcdef",
    );
  });

  test("strips utm_* for YouTube watch URLs (preserves t)", () => {
    assert.equal(
      normalizeUrlLike(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=x&t=30s",
      ),
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    );
  });

  test("strips si param for YouTube share URLs (watch + youtu.be)", () => {
    assert.equal(
      normalizeUrlLike(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=deadbeef&t=30s",
      ),
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    );

    assert.equal(
      normalizeUrlLike("https://youtu.be/dQw4w9WgXcQ?si=deadbeef"),
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  test("strips common YouTube share/copy params (feature/ab_channel/pp)", () => {
    assert.equal(
      normalizeUrlLike(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&ab_channel=RickAstley&pp=ygUe&t=1m2s",
      ),
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=1m2s",
    );
  });
});
