type Props = {
  status?: string;
};

export default function StatusBadge({ status }: Props) {
  if (!status || status === "completed") {
    return (
      <span className="inline-flex items-center gap-[5px] rounded-full bg-[rgba(242,78,30,0.92)] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.03em] text-white backdrop-blur">
        <span className="size-1.5 rounded-full bg-white/80" />
        READY
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(185,119,42,0.92)] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.03em] text-white">
        <span className="status-dot-running size-1.5 rounded-full bg-[#f6d9aa]" />
        PROCESSING
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-[rgba(177,74,62,0.92)] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.03em] text-white">
      FAILED
    </span>
  );
}
