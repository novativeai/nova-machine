'use client';

import { useCallback, useRef } from 'react';
import { useCanvasStore } from '@/stores';
import type { UploadStatus } from '@/types';

// Global map to track pending uploads (nodeId -> Promise<string>)
const pendingUploads = new Map<string, Promise<string>>();

// Upload a file to fal.ai via our API
async function uploadToFal(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/fal/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  const result = await response.json();
  return result.url;
}

export function useBackgroundUpload() {
  const { updateNode } = useCanvasStore();
  const uploadingRef = useRef(new Set<string>());

  // Start background upload for an image/video node
  const startUpload = useCallback(
    async (nodeId: string, file: File, nodeType: 'image' | 'video') => {
      // Prevent duplicate uploads
      if (uploadingRef.current.has(nodeId)) {
        console.log('[BackgroundUpload] Already uploading for node:', nodeId);
        return;
      }

      uploadingRef.current.add(nodeId);
      console.log('[BackgroundUpload] Starting upload for node:', nodeId, 'file:', file.name);

      // Update node to show uploading status
      updateNode(nodeId, {
        uploadStatus: 'uploading' as UploadStatus,
        uploadError: undefined,
      });

      // Create the upload promise
      const uploadPromise = uploadToFal(file)
        .then((remoteUrl) => {
          console.log('[BackgroundUpload] Upload completed for node:', nodeId, 'url:', remoteUrl);
          updateNode(nodeId, {
            uploadStatus: 'completed' as UploadStatus,
            remoteUrl,
          });
          return remoteUrl;
        })
        .catch((error) => {
          console.error('[BackgroundUpload] Upload failed for node:', nodeId, error);
          updateNode(nodeId, {
            uploadStatus: 'error' as UploadStatus,
            uploadError: error.message,
          });
          throw error;
        })
        .finally(() => {
          uploadingRef.current.delete(nodeId);
          pendingUploads.delete(nodeId);
        });

      // Store the promise for later reference
      pendingUploads.set(nodeId, uploadPromise);

      return uploadPromise;
    },
    [updateNode]
  );

  // Start background upload for an element node (frontal image)
  const startElementFrontalUpload = useCallback(
    async (nodeId: string, file: File) => {
      const uploadKey = `${nodeId}:frontal`;

      if (uploadingRef.current.has(uploadKey)) {
        console.log('[BackgroundUpload] Already uploading frontal for element:', nodeId);
        return;
      }

      uploadingRef.current.add(uploadKey);
      console.log('[BackgroundUpload] Starting frontal upload for element:', nodeId);

      updateNode(nodeId, {
        frontalUploadStatus: 'uploading' as UploadStatus,
        frontalUploadError: undefined,
      });

      const uploadPromise = uploadToFal(file)
        .then((remoteUrl) => {
          console.log('[BackgroundUpload] Frontal upload completed for element:', nodeId);
          updateNode(nodeId, {
            frontalUploadStatus: 'completed' as UploadStatus,
            frontalRemoteUrl: remoteUrl,
          });
          return remoteUrl;
        })
        .catch((error) => {
          console.error('[BackgroundUpload] Frontal upload failed for element:', nodeId, error);
          updateNode(nodeId, {
            frontalUploadStatus: 'error' as UploadStatus,
            frontalUploadError: error.message,
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
    [updateNode]
  );

  // Start background upload for element reference images
  const startElementReferenceUpload = useCallback(
    async (nodeId: string, files: File[]) => {
      if (files.length === 0) return;

      const uploadKey = `${nodeId}:references`;

      if (uploadingRef.current.has(uploadKey)) {
        console.log('[BackgroundUpload] Already uploading references for element:', nodeId);
        return;
      }

      uploadingRef.current.add(uploadKey);
      console.log('[BackgroundUpload] Starting reference uploads for element:', nodeId);

      updateNode(nodeId, {
        referenceUploadStatus: 'uploading' as UploadStatus,
        referenceUploadError: undefined,
      });

      const uploadPromise = Promise.all(files.map((file) => uploadToFal(file)))
        .then((remoteUrls) => {
          console.log('[BackgroundUpload] Reference uploads completed for element:', nodeId);
          updateNode(nodeId, {
            referenceUploadStatus: 'completed' as UploadStatus,
            referenceRemoteUrls: remoteUrls,
          });
          return remoteUrls.join(','); // Return joined for the promise map
        })
        .catch((error) => {
          console.error('[BackgroundUpload] Reference uploads failed for element:', nodeId, error);
          updateNode(nodeId, {
            referenceUploadStatus: 'error' as UploadStatus,
            referenceUploadError: error.message,
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
    [updateNode]
  );

  // Check if a node has a pending upload
  const hasPendingUpload = useCallback((nodeId: string): boolean => {
    return pendingUploads.has(nodeId) ||
           pendingUploads.has(`${nodeId}:frontal`) ||
           pendingUploads.has(`${nodeId}:references`);
  }, []);

  // Wait for a specific node's upload to complete
  const waitForUpload = useCallback(async (nodeId: string): Promise<string | null> => {
    const promise = pendingUploads.get(nodeId);
    if (!promise) return null;

    try {
      return await promise;
    } catch {
      return null;
    }
  }, []);

  // Wait for element uploads to complete
  const waitForElementUploads = useCallback(async (nodeId: string): Promise<{
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
  }, []);

  // Get all pending upload node IDs
  const getPendingUploadNodeIds = useCallback((): string[] => {
    const nodeIds = new Set<string>();
    for (const key of pendingUploads.keys()) {
      // Extract node ID from keys like "nodeId" or "nodeId:frontal"
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

// Export pending uploads map for use in useGeneration
export { pendingUploads };
