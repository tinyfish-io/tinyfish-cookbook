import { useState } from "react";

import { Modal } from "./Modal.tsx";

interface ScreenshotProps {
  src: string;
  /** Says what the picture shows, as its alt text and the viewer's title. */
  label: string;
}

const THUMB_WIDTH = 240;
const THUMB_HEIGHT = 150;

export function ScreenshotViewer({
  src,
  label,
  onClose,
}: ScreenshotProps & { onClose: () => void }) {
  return (
    <Modal
      label={label}
      onDismiss={onClose}
      dismissLabel="Close the screenshot"
      className="max-w-5xl"
    >
      <p className="mt-2 mb-3 text-sm text-mute">{label}</p>
      <img src={src} alt={label} className="h-auto w-full rounded-xl" />
    </Modal>
  );
}

export function Screenshot({ src, label }: ScreenshotProps) {
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);

  if (missing)
    return <p className="text-[13px] text-mute">The screenshot for this step is not available.</p>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-fit rounded-[14px] border border-line bg-white p-1 transition-colors hover:border-dash active:scale-[0.99]"
      >
        <span className="sr-only">Open the full screenshot: </span>
        <img
          src={src}
          alt={label}
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
          loading="lazy"
          onError={() => setMissing(true)}
          className="aspect-[8/5] h-auto w-60 max-w-full rounded-[10px] object-cover object-top"
        />
      </button>
      {open ? <ScreenshotViewer src={src} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
