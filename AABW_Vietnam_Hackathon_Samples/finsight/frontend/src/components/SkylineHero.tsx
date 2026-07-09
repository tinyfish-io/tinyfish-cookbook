import { useEffect, useState, type ReactNode } from 'react';
import type { CityId } from './SkylineSilhouette';
import { SkylineSilhouette } from './SkylineSilhouette';

const STAR_COUNT = 55;

function Stars() {
  const [stars, setStars] = useState<{ left: number; top: number; size: number; twinkleDelay: number; phaseDelay: number }[]>([]);
  useEffect(() => {
    setStars(
      Array.from({ length: STAR_COUNT }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 52,
        size: Math.random() * 2.2 + 0.6,
        twinkleDelay: Math.random() * 4,
        phaseDelay: (Math.random() - 0.5) * 3, // slight variation around cycle phase
      }))
    );
  }, []);

  return (
    <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.twinkleDelay}s, ${s.phaseDelay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function SkylineHero({ city, children }: { city: CityId; children?: ReactNode }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate', minHeight: '480px' }}>
      {/* Animated sky */}
      <div className="sky-cycle" style={{ position: 'absolute', inset: 0 }} />

      {/* Stars */}
      <Stars />

      {/* Sun / Moon orb */}
      <div className="orb" style={{ right: '11%', top: '2.2rem' }} />

      {/* Atmospheric haze under the orb */}
      <div style={{
        pointerEvents: 'none', position: 'absolute',
        right: 'calc(11% - 40px)', top: '1.5rem',
        width: '200px', height: '200px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,180,60,0.12) 0%, transparent 70%)',
        animation: 'float 7s ease-in-out infinite',
        filter: 'blur(30px)',
      }} />

      {/* Layered parallax skyline */}
      <SkylineSilhouette city={city} style={{ position: 'absolute', bottom: 0, left: 0, height: '56%', width: '100%', color: 'rgba(8,10,15,0.38)', transformOrigin: 'bottom' }} />
      <SkylineSilhouette city={city} style={{ position: 'absolute', bottom: 0, left: 0, height: '45%', width: '100%', color: 'rgba(8,10,15,0.68)', transform: 'scaleX(1.07) translateY(1px)', transformOrigin: 'bottom' }} />
      <SkylineSilhouette city={city} style={{ position: 'absolute', bottom: 0, left: 0, height: '33%', width: '100%', color: '#080a0f' }} />

      {/* Building windows glow */}
      <div style={{
        pointerEvents: 'none', position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '42%',
        background: 'radial-gradient(ellipse 70% 40% at 50% 100%, rgba(212,175,55,0.06) 0%, transparent 70%)',
      }} />

      {/* Lantern base glow */}
      <div style={{
        pointerEvents: 'none', position: 'absolute', insetInline: 0, bottom: 0, height: '9rem',
        background: 'linear-gradient(to top, rgba(192,57,43,0.28) 0%, rgba(212,175,55,0.06) 55%, transparent 100%)',
      }} />

      {/* Legibility overlay */}
      <div style={{
        pointerEvents: 'none', position: 'absolute', inset: 0,
        background: 'linear-gradient(160deg, rgba(8,10,15,0.18) 0%, transparent 40%, rgba(8,10,15,0.35) 100%)',
      }} />

      <div style={{ position: 'relative', zIndex: 10, padding: '5rem 2.5rem 6rem' }}>
        {children}
      </div>
    </div>
  );
}
