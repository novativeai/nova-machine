'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';

interface Stat {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

const STATS: Stat[] = [
  { id: 'videos', value: 127843, suffix: '', label: 'Videos generated today' },
  { id: 'total', value: 3.2, suffix: 'M', label: 'Total creations' },
  { id: 'countries', value: 47, suffix: '', label: 'Countries creating' },
  { id: 'uptime', value: 99.9, suffix: '%', label: 'Uptime' },
];

export function LiveStatsSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#050505] py-24">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/2 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[100px]" />
        <div className="absolute right-1/4 top-1/2 h-[300px] w-[300px] -translate-y-1/2 rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            The machine never sleeps
          </h2>
          <p className="mt-4 text-white/40">
            Real-time creation happening around the world
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, index) => (
            <StatCard
              key={stat.id}
              stat={stat}
              index={index}
              isInView={isInView}
            />
          ))}
        </div>

        {/* Live indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-12 flex items-center justify-center gap-2"
        >
          <motion.div
            className="h-2 w-2 rounded-full bg-emerald-500"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm text-white/40">Live</span>
        </motion.div>
      </div>
    </section>
  );
}

function StatCard({
  stat,
  index,
  isInView,
}: {
  stat: Stat;
  index: number;
  isInView: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const countRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, stat.value, {
        duration: 2,
        delay: index * 0.1,
        ease: 'easeOut',
        onUpdate: (value) => {
          setDisplayValue(value);
        },
      });
      return () => controls.stop();
    }
  }, [isInView, stat.value, index]);

  const formatValue = (value: number) => {
    if (stat.suffix === 'M') {
      return value.toFixed(1);
    }
    if (stat.suffix === '%') {
      return value.toFixed(1);
    }
    return Math.floor(value).toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group relative text-center"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]">
        {/* Value */}
        <div className="font-mono-num text-4xl font-semibold tracking-tight text-white md:text-5xl">
          <span ref={countRef}>{formatValue(displayValue)}</span>
          <span className="text-white/60">{stat.suffix}</span>
        </div>

        {/* Label */}
        <p className="mt-3 text-sm text-white/40">
          {stat.label}
        </p>

        {/* Subtle tick animation for live feeling */}
        {stat.id === 'videos' && isInView && (
          <motion.div
            className="absolute right-4 top-4 text-xs text-emerald-500/60"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            +1
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
