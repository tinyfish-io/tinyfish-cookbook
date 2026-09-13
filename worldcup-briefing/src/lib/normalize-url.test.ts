import { describe, expect, it } from "vitest";
import { normalizeYouTubeUrl } from "./normalize-url";

describe("normalizeYouTubeUrl", () => {
  it("extracts video ID from standard youtube.com/watch URL", () => {
    const result = normalizeYouTubeUrl(
      "https://www.youtube.com/watch?v=QK_9C81hkxk",
    );
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("extracts video ID with extra query params", () => {
    const result = normalizeYouTubeUrl(
      "https://www.youtube.com/watch?v=QK_9C81hkxk&t=30s&list=PLxyz",
    );
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("extracts video ID from youtu.be short URL", () => {
    const result = normalizeYouTubeUrl("https://youtu.be/QK_9C81hkxk");
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("extracts video ID from youtu.be short URL with query params", () => {
    const result = normalizeYouTubeUrl("https://youtu.be/QK_9C81hkxk?t=45");
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("extracts video ID from youtube.com/embed URL", () => {
    const result = normalizeYouTubeUrl(
      "https://www.youtube.com/embed/QK_9C81hkxk",
    );
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("extracts video ID from m.youtube.com/watch URL", () => {
    const result = normalizeYouTubeUrl(
      "https://m.youtube.com/watch?v=QK_9C81hkxk",
    );
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("returns null for empty string", () => {
    expect(normalizeYouTubeUrl("")).toBeNull();
  });

  it("returns null for non-YouTube URL", () => {
    expect(normalizeYouTubeUrl("https://vimeo.com/123456789")).toBeNull();
  });

  it("returns null for YouTube URL with no video ID", () => {
    expect(normalizeYouTubeUrl("https://www.youtube.com/watch")).toBeNull();
  });

  it("extracts video ID when v= param is not first", () => {
    const result = normalizeYouTubeUrl(
      "https://www.youtube.com/watch?feature=shared&v=QK_9C81hkxk",
    );
    expect(result).toEqual({
      videoId: "QK_9C81hkxk",
      canonicalUrl: "https://www.youtube.com/watch?v=QK_9C81hkxk",
    });
  });

  it("extracts video ID with dashes and underscores", () => {
    const result = normalizeYouTubeUrl(
      "https://www.youtube.com/watch?v=aB3_-xY9zQw",
    );
    expect(result).toEqual({
      videoId: "aB3_-xY9zQw",
      canonicalUrl: "https://www.youtube.com/watch?v=aB3_-xY9zQw",
    });
  });

  it("returns null for URL with invalid video ID length", () => {
    expect(
      normalizeYouTubeUrl("https://www.youtube.com/watch?v=short"),
    ).toBeNull();
  });
});
