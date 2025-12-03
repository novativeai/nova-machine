import { route } from '@fal-ai/server-proxy/nextjs';

// Route segment config for App Router
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for long uploads

export const { GET, POST, PUT } = route;
