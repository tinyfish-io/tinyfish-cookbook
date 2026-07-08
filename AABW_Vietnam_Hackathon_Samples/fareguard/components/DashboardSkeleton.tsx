export default function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-surface rounded-lg p-4 h-[92px]">
            <div className="skeleton h-3 w-20 mb-3" />
            <div className="skeleton h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="card-surface rounded-xl p-5 h-[168px]">
        <div className="skeleton h-3 w-40 mb-3" />
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      </div>
      <div className="card-surface rounded-xl p-5 h-[340px]">
        <div className="skeleton h-3 w-48 mb-4" />
        <div className="skeleton h-[260px] w-full" />
      </div>
    </div>
  );
}
