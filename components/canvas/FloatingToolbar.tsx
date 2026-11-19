'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Loader2, ImageIcon, ChevronDown, Sparkles, MousePointer, Save, BookOpen } from 'lucide-react';
import { MoodboardDialog } from '@/components/ai/MoodboardDialog';
import { cn } from '@/lib/utils';
import { useCanvasStore, useAssetStore, createNode } from '@/stores';
import { useCharacterGeneration } from '@/hooks';
import type { ImageNodeData, OutputNodeData, ElementNodeData } from '@/types';
import { generateCharacterViews, generateImage, getGptImageSize } from '@/lib/fal';

type MenuType = 'character' | 'scene' | null;

export function FloatingToolbar() {
  const [activeMenu, setActiveMenu] = useState<MenuType>(null);
  const [showCharacterConfirm, setShowCharacterConfirm] = useState(false);
  const [showCharacterPrompt, setShowCharacterPrompt] = useState(false);
  const [characterPrompt, setCharacterPrompt] = useState('');
  const [isGeneratingFromPrompt, setIsGeneratingFromPrompt] = useState(false);
  const [showCharacterSave, setShowCharacterSave] = useState(false);
  const [showSceneSave, setShowSceneSave] = useState(false);
  const [showScenePrompt, setShowScenePrompt] = useState(false);
  const [scenePrompt, setScenePrompt] = useState('');
  const [isGeneratingSceneFromPrompt, setIsGeneratingSceneFromPrompt] = useState(false);
  const [sceneName, setSceneName] = useState('');
  const [showMoodboard, setShowMoodboard] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const { nodes, addNode, getSelectedImageNode, selectedNodes } = useCanvasStore();
  const { saveScene, saveCharacter } = useAssetStore();
  const { generateCharacter, getNextCharacterName } = useCharacterGeneration();

  const selectedImageNode = getSelectedImageNode();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get image URL and position from selected node
  const getSelectedImageData = () => {
    if (!selectedImageNode) return null;

    if (selectedImageNode.type === 'image') {
      const data = selectedImageNode.data as ImageNodeData;
      return {
        nodeId: selectedImageNode.id,
        imageUrl: data.remoteUrl || data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        position: selectedImageNode.position,
        isGenerating: data.isGeneratingCharacter,
      };
    }

    if (selectedImageNode.type === 'output') {
      const data = selectedImageNode.data as OutputNodeData;
      if (data.outputType === 'image' && data.imageUrl) {
        return {
          nodeId: selectedImageNode.id,
          imageUrl: data.imageUrl,
          thumbnailUrl: data.thumbnailUrl,
          position: selectedImageNode.position,
          isGenerating: data.isGeneratingCharacter,
        };
      }
    }

    return null;
  };

  const imageData = getSelectedImageData();
  const canGenerateFromSelection = imageData && !imageData.isGenerating;
  const canSaveSceneFromSelection = imageData && imageData.imageUrl;

  // Check if an element node is selected for character saving
  const getSelectedElementNode = () => {
    if (selectedNodes.length === 0) return null;
    const selectedId = selectedNodes[0];
    const node = nodes.find((n) => n.id === selectedId);
    if (node && node.type === 'element') {
      return node;
    }
    return null;
  };

  const selectedElementNode = getSelectedElementNode();
  const canSaveCharacterFromSelection = selectedElementNode !== null;

  // Handle character generation from selection
  const handleGenerateFromSelection = async () => {
    if (!imageData) return;
    setActiveMenu(null);
    setShowCharacterConfirm(false);
    await generateCharacter(imageData.nodeId, imageData.imageUrl, imageData.position);
  };

  // Handle character save from selection
  const handleSaveCharacterFromSelection = () => {
    if (!selectedElementNode) return;
    const elementData = selectedElementNode.data as ElementNodeData;
    const savedId = saveCharacter(elementData);
    if (savedId) {
      console.log('[Save Character] Character saved to assets:', savedId);
    } else {
      console.warn('[Save Character] Failed to save character - frontal image not uploaded');
    }
    setShowCharacterSave(false);
    setActiveMenu(null);
  };

  // Handle character generation from prompt
  const handleGenerateFromPrompt = async () => {
    if (!characterPrompt.trim()) return;

    setIsGeneratingFromPrompt(true);
    setShowCharacterPrompt(false);
    setActiveMenu(null);

    try {
      console.log('[Character from Prompt] Generating frontal image...');

      // Step 1: Frontal character image (GPT Image 2.6, 3:4 at 2K)
      const frontalResult = await generateImage({
        model: 'openai/gpt-image-2.6/sunburst/text-to-image',
        input: {
          prompt: `${characterPrompt.trim()}, full body character design, frontal view, plain background, high quality, detailed`,
          image_size: getGptImageSize('3:4', '2K'),
          quality: 'high',
          num_images: 1,
          output_format: 'png',
        },
      });

      const frontalImageUrl = frontalResult.data?.images[0]?.url;
      if (!frontalImageUrl) {
        throw new Error(frontalResult.error || 'Failed to generate frontal image');
      }

      console.log('[Character from Prompt] Frontal generated:', frontalImageUrl);

      // Step 2: Side and back views in parallel
      const [sideImageUrl, backImageUrl] = await generateCharacterViews(frontalImageUrl);

      console.log('[Character from Prompt] All views generated');

      // Find a good position for the new node
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Step 3: Create ElementNode directly with all images
      const characterName = getNextCharacterName();
      const elementNode = createNode(
        'element',
        { x: centerX - 100, y: centerY - 150 },
        {
          name: characterName,
          elementType: 'character',
          frontalImageUrl: frontalImageUrl,
          frontalThumbnail: frontalImageUrl,
          frontalRemoteUrl: frontalImageUrl,
          frontalUploadStatus: 'completed',
          referenceImageUrls: [],
          referenceThumbnails: [],
          generatedReferenceUrls: [sideImageUrl, backImageUrl],
          generatedReferenceThumbnails: [sideImageUrl, backImageUrl],
          referenceRemoteUrls: [sideImageUrl, backImageUrl],
          referenceUploadStatus: 'completed',
        }
      );

      addNode(elementNode);
      console.log('[Character from Prompt] Character created:', characterName);

    } catch (error) {
      console.error('[Character from Prompt] Failed:', error);
    } finally {
      setIsGeneratingFromPrompt(false);
      setCharacterPrompt('');
    }
  };

  // Handle scene save from selection
  const handleSaveSceneFromSelection = () => {
    if (!imageData || !sceneName.trim()) return;
    saveScene(sceneName.trim(), imageData.imageUrl, imageData.thumbnailUrl);
    setSceneName('');
    setShowSceneSave(false);
    setActiveMenu(null);
  };

  // Handle scene generation from prompt
  const handleGenerateSceneFromPrompt = async () => {
    if (!scenePrompt.trim()) return;

    setIsGeneratingSceneFromPrompt(true);
    setShowScenePrompt(false);
    setActiveMenu(null);

    try {
      console.log('[Scene from Prompt] Generating scene image...');

      // Scene image (GPT Image 2.6, 16:9 at 2K)
      const result = await generateImage({
        model: 'openai/gpt-image-2.6/sunburst/text-to-image',
        input: {
          prompt: `${scenePrompt.trim()}, scene, environment, high quality, detailed`,
          image_size: getGptImageSize('16:9', '2K'),
          quality: 'high',
          num_images: 1,
          output_format: 'png',
        },
      });

      const sceneImageUrl = result.data?.images[0]?.url;
      if (!sceneImageUrl) {
        throw new Error(result.error || 'Failed to generate scene image');
      }

      console.log('[Scene from Prompt] Scene generated:', sceneImageUrl);

      // Find a good position for the new node
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      // Create ImageNode with the scene
      const imageNode = createNode(
        'image',
        { x: centerX - 150, y: centerY - 100 },
        {
          imageUrl: sceneImageUrl,
          thumbnailUrl: sceneImageUrl,
          remoteUrl: sceneImageUrl,
          uploadStatus: 'completed',
          role: 'reference',
        }
      );

      addNode(imageNode);
      console.log('[Scene from Prompt] Scene node created');

    } catch (error) {
      console.error('[Scene from Prompt] Failed:', error);
    } finally {
      setIsGeneratingSceneFromPrompt(false);
      setScenePrompt('');
    }
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handler();
    } else if (e.key === 'Escape') {
      setShowCharacterPrompt(false);
      setShowScenePrompt(false);
      setCharacterPrompt('');
      setScenePrompt('');
    }
  };

  const handleSceneNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveSceneFromSelection();
    } else if (e.key === 'Escape') {
      setSceneName('');
      setShowSceneSave(false);
    }
  };

  const isLoading = isGeneratingFromPrompt || isGeneratingSceneFromPrompt || imageData?.isGenerating;

  return (
    <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2" ref={menuRef}>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-sm">
        {/* Character Tool */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'character' ? null : 'character')}
            disabled={isLoading}
            className={cn(
              'flex h-10 items-center gap-1.5 rounded-lg px-3 transition-colors',
              activeMenu === 'character'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            title="Create character"
          >
            {isGeneratingFromPrompt || imageData?.isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span className="text-sm">Character</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', activeMenu === 'character' && 'rotate-180')} />
          </button>

          {/* Character Dropdown Menu */}
          {activeMenu === 'character' && !showCharacterConfirm && !showCharacterPrompt && !showCharacterSave && (
            <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-card py-1 shadow-xl">
              <button
                onClick={() => {
                  setActiveMenu(null);
                  setShowCharacterPrompt(true);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">From Prompt</div>
                  <div className="text-xs text-muted-foreground">Generate from text description</div>
                </div>
              </button>
              <button
                onClick={() => {
                  if (canGenerateFromSelection) {
                    setActiveMenu(null);
                    setShowCharacterConfirm(true);
                  }
                }}
                disabled={!canGenerateFromSelection}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                  canGenerateFromSelection
                    ? 'hover:bg-secondary'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <MousePointer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Generate from Image</div>
                  <div className="text-xs text-muted-foreground">
                    {canGenerateFromSelection ? 'Use selected image' : 'Select an image first'}
                  </div>
                </div>
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                onClick={() => {
                  if (canSaveCharacterFromSelection) {
                    setActiveMenu(null);
                    setShowCharacterSave(true);
                  }
                }}
                disabled={!canSaveCharacterFromSelection}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                  canSaveCharacterFromSelection
                    ? 'hover:bg-secondary'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Save Character</div>
                  <div className="text-xs text-muted-foreground">
                    {canSaveCharacterFromSelection ? 'Save selected character' : 'Select a character first'}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Character Prompt Input */}
          {showCharacterPrompt && (
            <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-xl">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Generate Character</span>
              </div>
              <textarea
                value={characterPrompt}
                onChange={(e) => setCharacterPrompt(e.target.value)}
                onKeyDown={(e) => handlePromptKeyDown(e, handleGenerateFromPrompt)}
                placeholder="Describe your character...&#10;e.g. A warrior in silver armor with a red cape"
                className="mb-2 h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">~$0.45 (3 images)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCharacterPrompt(false);
                      setCharacterPrompt('');
                    }}
                    className="rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateFromPrompt}
                    disabled={!characterPrompt.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Character Confirmation (from selection) */}
          {showCharacterConfirm && (
            <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-card p-3 shadow-xl">
              <div className="mb-3 text-center">
                <User className="mx-auto mb-1 h-6 w-6 text-primary" />
                <div className="text-sm font-medium">Generate Character?</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Creates side & back views (~$0.30)
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCharacterConfirm(false)}
                  className="flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateFromSelection}
                  className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  Generate
                </button>
              </div>
            </div>
          )}

          {/* Character Save Confirmation */}
          {showCharacterSave && (
            <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-card p-3 shadow-xl">
              <div className="mb-3 text-center">
                <Save className="mx-auto mb-1 h-6 w-6 text-primary" />
                <div className="text-sm font-medium">Save Character?</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Add to your character library
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCharacterSave(false)}
                  className="flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCharacterFromSelection}
                  className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-border" />

        {/* Scene Tool */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'scene' ? null : 'scene')}
            disabled={isLoading}
            className={cn(
              'flex h-10 items-center gap-1.5 rounded-lg px-3 transition-colors',
              activeMenu === 'scene'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            title="Create scene"
          >
            {isGeneratingSceneFromPrompt ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            <span className="text-sm">Scene</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', activeMenu === 'scene' && 'rotate-180')} />
          </button>

          {/* Scene Dropdown Menu */}
          {activeMenu === 'scene' && !showSceneSave && !showScenePrompt && (
            <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-card py-1 shadow-xl">
              <button
                onClick={() => {
                  setActiveMenu(null);
                  setShowScenePrompt(true);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-medium">From Prompt</div>
                  <div className="text-xs text-muted-foreground">Generate scene from text</div>
                </div>
              </button>
              <button
                onClick={() => {
                  if (canSaveSceneFromSelection) {
                    setActiveMenu(null);
                    setShowSceneSave(true);
                  }
                }}
                disabled={!canSaveSceneFromSelection}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                  canSaveSceneFromSelection
                    ? 'hover:bg-secondary'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <MousePointer className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">From Selection</div>
                  <div className="text-xs text-muted-foreground">
                    {canSaveSceneFromSelection ? 'Save selected image' : 'Select an image first'}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Scene Prompt Input */}
          {showScenePrompt && (
            <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-xl">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Generate Scene</span>
              </div>
              <textarea
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                onKeyDown={(e) => handlePromptKeyDown(e, handleGenerateSceneFromPrompt)}
                placeholder="Describe your scene...&#10;e.g. A mystical forest at sunset"
                className="mb-2 h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">~$0.15</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowScenePrompt(false);
                      setScenePrompt('');
                    }}
                    className="rounded-md bg-secondary px-3 py-1.5 text-xs hover:bg-secondary/80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateSceneFromPrompt}
                    disabled={!scenePrompt.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scene Save Popup (from selection) */}
          {showSceneSave && (
            <div className="absolute left-0 top-full z-50 mt-2 w-52 rounded-lg border border-border bg-card p-3 shadow-xl">
              <div className="mb-2 text-center text-sm font-medium">Save as Scene</div>
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                onKeyDown={handleSceneNameKeyDown}
                placeholder="Scene name..."
                className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSceneName('');
                    setShowSceneSave(false);
                  }}
                  className="flex-1 rounded-md bg-secondary px-2 py-1.5 text-xs hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSceneFromSelection}
                  disabled={!sceneName.trim()}
                  className="flex-1 rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-0.5 h-6 w-px bg-border/50" />

        {/* Moodboard Tool */}
        <button
          onClick={() => setShowMoodboard(true)}
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-lg px-3 transition-colors',
            'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
          title="Generate moodboard from a story"
        >
          <BookOpen className="h-4 w-4" />
          <span className="text-sm">Moodboard</span>
        </button>
      </div>

      {/* Moodboard Dialog */}
      <MoodboardDialog open={showMoodboard} onOpenChange={setShowMoodboard} />
    </div>
  );
}
