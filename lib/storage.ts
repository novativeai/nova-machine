import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Upload a file to Firebase Storage
 */
export async function uploadFile(
  file: File,
  path: string,
  _onProgress?: (progress: number) => void
): Promise<string> {
  const storageRef = ref(storage, path);

  // Upload file
  const snapshot = await uploadBytes(storageRef, file);

  // Get download URL
  const downloadURL = await getDownloadURL(snapshot.ref);

  return downloadURL;
}

/**
 * Upload image for generation inputs
 */
export async function uploadImage(userId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const path = `users/${userId}/images/${fileName}`;

  return uploadFile(file, path);
}

/**
 * Upload video for generation inputs
 */
export async function uploadVideo(userId: string, file: File): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${timestamp}_${file.name}`;
  const path = `users/${userId}/videos/${fileName}`;

  return uploadFile(file, path);
}

/**
 * Upload board thumbnail
 */
export async function uploadBoardThumbnail(userId: string, boardId: string, file: File): Promise<string> {
  const path = `users/${userId}/boards/${boardId}/thumbnail.jpg`;
  return uploadFile(file, path);
}

/**
 * Delete file from Firebase Storage
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}

/**
 * Convert blob URL to File object
 */
export function blobToFile(blobUrl: string, filename: string): Promise<File> {
  return fetch(blobUrl)
    .then(res => res.blob())
    .then(blob => new File([blob], filename, { type: blob.type }));
}

/**
 * Upload generation output (from fal.ai URL)
 */
export async function saveGenerationOutput(
  userId: string,
  generationId: string,
  url: string,
  type: 'video' | 'image'
): Promise<string> {
  try {
    // Fetch the file from fal.ai
    const response = await fetch(url);
    const blob = await response.blob();

    // Create file
    const extension = type === 'video' ? 'mp4' : 'jpg';
    const file = new File([blob], `output.${extension}`, { type: blob.type });

    // Upload to Firebase Storage
    const path = `users/${userId}/generations/${generationId}/output.${extension}`;
    return uploadFile(file, path);
  } catch (error) {
    console.error('Error saving generation output:', error);
    // Return original URL if upload fails
    return url;
  }
}
