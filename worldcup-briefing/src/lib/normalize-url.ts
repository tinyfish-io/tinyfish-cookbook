const YOUTUBE_ID_PATTERNS: RegExp[] = [
  /youtube\.com\/watch.*[?&]v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
  /m\.youtube\.com\/watch.*[?&]v=([\w-]{11})/,
];

export function normalizeYouTubeUrl(
  url: string,
): { videoId: string; canonicalUrl: string } | null {
  if (!url || typeof url !== "string") return null;

  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      return {
        videoId,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  return null;
}
