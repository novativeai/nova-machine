'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import Link from 'next/link';

export function EnterMachineSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const [isHovered, setIsHovered] = useState(false);

  // Animated glow intensity
  const glowIntensity = useMotionValue(0.3);
  const glowScale = useTransform(glowIntensity, [0.3, 1], [1, 1.2]);

  useEffect(() => {
    if (isInView) {
      // Pulsing glow animation
      const controls = animate(glowIntensity, [0.3, 0.6, 0.3], {
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      });
      return () => controls.stop();
    }
  }, [isInView, glowIntensity]);

  // Particle effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particles
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const createParticle = () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
    });

    // Initialize particles
    for (let i = 0; i < 50; i++) {
      particles.push(createParticle());
    }

    let animationId: number;
    const animateParticles = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animateParticles);
    };

    animateParticles();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505]"
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Radial gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)',
            scale: glowScale,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        {/* The glowing canvas element */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-16"
        >
          <motion.div
            className="relative mx-auto h-32 w-32"
            animate={{
              boxShadow: isHovered
                ? '0 0 60px 20px rgba(255, 255, 255, 0.15), 0 0 120px 40px rgba(255, 255, 255, 0.05)'
                : '0 0 40px 10px rgba(255, 255, 255, 0.08), 0 0 80px 20px rgba(255, 255, 255, 0.03)',
            }}
            transition={{ duration: 0.5 }}
          >
            {/* Canvas icon - abstract representation */}
            <div className="relative h-full w-full rounded-2xl border border-white/20 bg-white/[0.03] backdrop-blur-sm">
              {/* Inner glow */}
              <div className="absolute inset-2 rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent" />

              {/* Node dots */}
              <motion.div
                className="absolute left-4 top-4 h-2 w-2 rounded-full bg-white/60"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute bottom-4 right-4 h-2 w-2 rounded-full bg-white/60"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              />

              {/* Connection lines */}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 128 128">
                <motion.line
                  x1="20" y1="20" x2="64" y2="64"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
                <motion.line
                  x1="108" y1="108" x2="64" y2="64"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 0.7 }}
                />
              </svg>
            </div>
          </motion.div>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl"
        >
          Your canvas awaits
        </motion.h2>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mx-auto mt-6 max-w-xl text-lg text-white/40"
        >
          Every great creation starts with a single node.
          <br />
          What will yours become?
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-12"
        >
          <Link
            href="/sign-up"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative inline-flex items-center justify-center"
          >
            {/* Glow effect */}
            <motion.div
              className="absolute -inset-1 rounded-full bg-white/20 blur-xl"
              animate={{
                opacity: isHovered ? 0.4 : 0.2,
                scale: isHovered ? 1.1 : 1,
              }}
              transition={{ duration: 0.3 }}
            />

            {/* Button */}
            <span className="relative rounded-full border border-white/30 bg-white px-10 py-4 text-base font-medium text-black transition-all duration-300 group-hover:bg-white group-hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              Enter the Machine
            </span>
          </Link>
        </motion.div>

        {/* Subtle note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-8 text-sm text-white/20"
        >
          Bring your own fal.ai API key — it stays in your browser and is sent only to fal.ai.
        </motion.p>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent" />
    </section>
  );
}
