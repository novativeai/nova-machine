'use client';

import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores';
import { useAuth } from '@/contexts/AuthContext';
import type { UploadStatus } from '@/types';

// Global map to track pending uploads (nodeId -> Promise<string>)
const pendingUploads = new Map<string, Promise<string>>();
// Latest upload per node (node-level uploads) and the file it is uploading
const latestUploadToken = new Map<string, symbol>();
const inFlightFiles = new Map<string, File>();

/**
 * Upload a file to Cloudflare R2 via our authenticated API.
 * Returns a permanent public URL that works as both:
 * - Persistent display URL (never expires, unlike fal.ai)
 * - Input URL for fal.ai generation (public HTTPS, accessible by fal.ai)
 */
async function uploadToR2(file: File, authToken: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/r2/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error((error as { error: string }).error || 'Upload failed');
  }

  const result = await response.json();
  return (result as { url: string }).url;
}

export function useBackgroundUpload() {
  const { updateNode } = useCanvasStore();
  const { user } = useAuth();
  const uploadingRef = useRef(new Set<string>());

  const getToken = useCallback(async (): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);

  // Start background upload for an image/video/audio node.
  // Replacing the file mid-upload starts a new upload; the superseded one is discarded when it settles.
  const startUpload = useCallback(
    async (nodeId: string, file: File, _nodeType: 'image' | 'video' | 'audio'): Promise<string | undefined> => {
      if (inFlightFiles.get(nodeId) === file) return pendingUploads.get(nodeId);

      const token = Symbol(nodeId);
      latestUploadToken.set(nodeId, token);
      inFlightFiles.set(nodeId, file);
      const isLatest = () => latestUploadToken.get(nodeId) === token;

      updateNode(nodeId, {
        uploadStatus: 'uploading' as UploadStatus,
        uploadError: undefined,
        remoteUrl: undefined,
      });

      const uploadPromise = (async () => {
        const token = await getToken();
        return uploadToR2(file, token);
      })()
        .then((remoteUrl) => {
          if (isLatest()) {
            updateNode(nodeId, {
              uploadStatus: 'completed' as UploadStatus,
              remoteUrl,
            });
          }
          return remoteUrl;
        })
        .catch((error) => {
          console.error('[BackgroundUpload] Upload failed for node:', nodeId, error);
          if (isLatest()) {
            updateNode(nodeId, {
              uploadStatus: 'error' as UploadStatus,
              uploadError: error instanceof Error ? error.message : 'Upload failed',
            });
          }
          throw error;
        })
        .finally(() => {
          if (isLatest()) {
            latestUploadToken.delete(nodeId);
            inFlightFiles.delete(nodeId);
            pendingUploads.delete(nodeId);
          }
        });

      pendingUploads.set(nodeId, uploadPromise);
      return uploadPromise;
    },
    [updateNode, getToken]
  );

  // Start background upload for an element node (frontal image)
  const startElementFrontalUpload = useCallback(
    async (nodeId: string, file: File) => {
      const uploadKey = `${nodeId}:frontal`;
      if (uploadingRef.current.has(uploadKey)) return;

      uploadingRef.current.add(uploadKey);

      updateNode(nodeId, {
        frontalUploadStatus: 'uploading' as UploadStatus,
        frontalUploadError: undefined,
      });

      const uploadPromise = (async () => {
        const token = await getToken();
        return uploadToR2(file, token);
      })()
        .then((remoteUrl) => {
          updateNode(nodeId, {
            frontalUploadStatus: 'completed' as UploadStatus,
            frontalRemoteUrl: remoteUrl,
          });
          return remoteUrl;
        })
        .catch((error) => {
          console.error('[BackgroundUpload] Frontal upload failed:', nodeId, error);
          updateNode(nodeId, {
            frontalUploadStatus: 'error' as UploadStatus,
            frontalUploadError: error instanceof Error ? error.message : 'Upload failed',
          });
          throw error;
        })
        .finally(() => {
          uploadingRef.current.delete(uploadKey);
          pendingUploads.delete(uploadKey);
        });

      pendingUploads.set(uploadKey, uploadPromise);
      return uploadPromise;
    },
    [updateNode, getToken]
  );

  // Start background upload for element reference images
  const startElementReferenceUpload = useCallback(
    async (nodeId: string, files: File[]) => {
      if (files.length === 0) return;

      const uploadKey = `${nodeId}:references`;
      if (uploadingRef.current.has(uploadKey)) return;

      uploadingRef.current.add(uploadKey);

      updateNode(nodeId, {
        referenceUploadStatus: 'uploading' as UploadStatus,
        referenceUploadError: undefined,
      });

      const uploadPromise = (async () => {
        const token = await getToken();
        return Promise.all(files.map((file) => uploadToR2(file, token)));
      })()
        .then((remoteUrls) => {
          updateNode(nodeId, {
            referenceUploadStatus: 'completed' as UploadStatus,
            referenceRemoteUrls: remoteUrls,
          });
          return remoteUrls.join(',');
        })
        .catch((error) => {
          console.error('[BackgroundUpload] Reference uploads failed:', nodeId, error);
          updateNode(nodeId, {
            referenceUploadStatus: 'error' as UploadStatus,
            referenceUploadError: error instanceof Error ? error.message : 'Upload failed',
          });
          throw error;
        })
        .finally(() => {
          uploadingRef.current.delete(uploadKey);
          pendingUploads.delete(uploadKey);
        });

      pendingUploads.set(uploadKey, uploadPromise);
      return uploadPromise;
    },
    [updateNode, getToken]
  );

  const hasPendingUpload = useCallback((nodeId: string): boolean => {
    return (
      pendingUploads.has(nodeId) ||
      pendingUploads.has(`${nodeId}:frontal`) ||
      pendingUploads.has(`${nodeId}:references`)
    );
  }, []);

  const waitForUpload = useCallback(async (nodeId: string): Promise<string | null> => {
    const promise = pendingUploads.get(nodeId);
    if (!promise) return null;
    try {
      return await promise;
    } catch {
      return null;
    }
  }, []);

  const waitForElementUploads = useCallback(
    async (
      nodeId: string
    ): Promise<{
      frontalUrl: string | null;
      referenceUrls: string[] | null;
    }> => {
      const frontalPromise = pendingUploads.get(`${nodeId}:frontal`);
      const referencesPromise = pendingUploads.get(`${nodeId}:references`);

      let frontalUrl: string | null = null;
      let referenceUrls: string[] | null = null;

      if (frontalPromise) {
        try {
          frontalUrl = await frontalPromise;
        } catch {
          frontalUrl = null;
        }
      }

      if (referencesPromise) {
        try {
          const result = await referencesPromise;
          referenceUrls = result ? result.split(',') : null;
        } catch {
          referenceUrls = null;
        }
      }

      return { frontalUrl, referenceUrls };
    },
    []
  );

  const getPendingUploadNodeIds = useCallback((): string[] => {
    const nodeIds = new Set<string>();
    for (const key of pendingUploads.keys()) {
      const nodeId = key.split(':')[0];
      nodeIds.add(nodeId);
    }
    return Array.from(nodeIds);
  }, []);

  return {
    startUpload,
    startElementFrontalUpload,
    startElementReferenceUpload,
    hasPendingUpload,
    waitForUpload,
    waitForElementUploads,
    getPendingUploadNodeIds,
  };
}

export { pendingUploads };
