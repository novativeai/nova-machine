'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

export function CreativeFlowSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Progressive reveal based on scroll
  const node1Opacity = useTransform(scrollYProgress, [0.1, 0.25], [0, 1]);
  const node2Opacity = useTransform(scrollYProgress, [0.2, 0.35], [0, 1]);
  const node3Opacity = useTransform(scrollYProgress, [0.3, 0.45], [0, 1]);
  const node4Opacity = useTransform(scrollYProgress, [0.4, 0.55], [0, 1]);

  const line1Length = useTransform(scrollYProgress, [0.15, 0.3], [0, 1]);
  const line2Length = useTransform(scrollYProgress, [0.25, 0.4], [0, 1]);
  const line3Length = useTransform(scrollYProgress, [0.35, 0.5], [0, 1]);

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden bg-[#0a0a0a] py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-20 text-center"
        >
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
            The creative flow
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/50">
            Your ideas are nodes. Connections are possibilities.
            <br />
            The canvas thinks with you.
          </p>
        </motion.div>

        {/* Node Graph Visualization */}
        <div className="relative mx-auto h-[600px] max-w-4xl">
          {/* SVG for connection lines */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 800 600"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Line 1: Input to Prompt */}
            <motion.line
              x1="150" y1="150"
              x2="400" y2="200"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
              strokeDasharray="5,5"
              style={{ pathLength: line1Length }}
            />
            {/* Line 2: Prompt to Controls */}
            <motion.line
              x1="400" y1="200"
              x2="400" y2="400"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
              strokeDasharray="5,5"
              style={{ pathLength: line2Length }}
            />
            {/* Line 3: Controls to Output */}
            <motion.line
              x1="400" y1="400"
              x2="650" y2="450"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
              style={{ pathLength: line3Length }}
            />
          </svg>

          {/* Node 1: Input */}
          <motion.div
            className="absolute left-[10%] top-[15%]"
            style={{ opacity: node1Opacity }}
          >
            <NodeCard
              title="Input"
              description="Image, video, or idea"
              type="input"
            />
          </motion.div>

          {/* Node 2: Prompt */}
          <motion.div
            className="absolute left-[35%] top-[25%]"
            style={{ opacity: node2Opacity }}
          >
            <NodeCard
              title="Prompt"
              description="Describe your vision"
              type="prompt"
            />
          </motion.div>

          {/* Node 3: Controls */}
          <motion.div
            className="absolute left-[35%] top-[55%]"
            style={{ opacity: node3Opacity }}
          >
            <NodeCard
              title="Controls"
              description="Camera, style, motion"
              type="control"
            />
          </motion.div>

          {/* Node 4: Output */}
          <motion.div
            className="absolute left-[65%] top-[65%]"
            style={{ opacity: node4Opacity }}
          >
            <NodeCard
              title="Output"
              description="Your creation"
              type="output"
              isOutput
            />
          </motion.div>

          {/* Floating labels */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <p className="text-sm text-white/30">
              Scroll to build your flow
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function NodeCard({
  title,
  description,
  type,
  isOutput = false,
}: {
  title: string;
  description: string;
  type: 'input' | 'prompt' | 'control' | 'output';
  isOutput?: boolean;
}) {
  const colors = {
    input: 'from-cyan-500/20 to-transparent border-cyan-500/30',
    prompt: 'from-violet-500/20 to-transparent border-violet-500/30',
    control: 'from-amber-500/20 to-transparent border-amber-500/30',
    output: 'from-emerald-500/20 to-transparent border-emerald-500/30',
  };

  return (
    <motion.div
      className={`relative w-48 overflow-hidden rounded-xl border bg-gradient-to-br ${colors[type]} bg-black/50 p-4 backdrop-blur-sm`}
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.2 }}
    >
      {/* Node connector dot */}
      <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white/30 bg-[#0a0a0a]" />
      <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white/30 bg-[#0a0a0a]" />

      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-white/50">{description}</p>

      {isOutput && (
        <motion.div
          className="mt-3 h-16 overflow-hidden rounded-lg bg-white/5"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="flex h-full items-center justify-center">
            <motion.div
              className="h-2 w-2 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
