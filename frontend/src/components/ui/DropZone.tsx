/**
 * DropZone / MagicDropzone — reusable drag-and-drop + Ctrl+V paste image uploader.
 *
 * Features:
 *  • Drag files over → visual highlight with glow ring
 *  • Drop files → onFiles callback (non-images → error toast)
 *  • Ctrl+V / Cmd+V while the zone (or page) is focused → paste image from clipboard
 *  • Paste a URL ending in .jpg/.png/.webp/.gif → fetch & preview it
 *  • Click → opens native file picker
 *  • Accepts multiple or single file mode
 *  • Shows thumbnail previews with remove buttons
 *  • Respects maxFiles limit
 *  • Exported as both `DropZone` and `MagicDropzone` (same component)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X, Upload, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

export interface DropZoneProps {
  /** Called whenever new files are accepted */
  onFiles: (files: File[]) => void;
  /** Current preview URLs (managed by parent) */
  previews: string[];
  /** Remove a preview by index */
  onRemove: (idx: number) => void;
  /** Max number of files allowed (default: unlimited) */
  maxFiles?: number;
  /** Accept string for the hidden input (default: "image/*") */
  accept?: string;
  /** Label shown inside the drop zone */
  label?: string;
  /** Sub-label */
  sublabel?: string;
  /** Extra class on the outer wrapper */
  className?: string;
  /** Thumbnail size class (default: w-16 h-16) */
  thumbSize?: string;
  /** Whether to listen for global paste events (default: true) */
  globalPaste?: boolean;
}

// Image URL extensions we try to fetch
const IMAGE_URL_RE = /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?$/i;

export function DropZone({
  onFiles,
  previews,
  onRemove,
  maxFiles,
  accept = 'image/*',
  label = 'Drag & drop your files here or click to browse',
  sublabel = 'JPG, PNG, WebP · max 10 MB · or paste with Ctrl+V',
  className,
  thumbSize = 'w-16 h-16',
  globalPaste = true,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef  = useRef<HTMLDivElement>(null);
  const [dragging,    setDragging]    = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);

  const remaining = maxFiles != null ? maxFiles - previews.length : Infinity;

  // ── Process incoming files ────────────────────────────────
  const processFiles = useCallback((rawFiles: File[]) => {
    const imageFiles    = rawFiles.filter(f => f.type.startsWith('image/'));
    const rejectedCount = rawFiles.length - imageFiles.length;

    if (rejectedCount > 0) {
      toast.error(
        rejectedCount === 1
          ? 'Only images are allowed.'
          : `${rejectedCount} file${rejectedCount > 1 ? 's' : ''} rejected — only images are allowed.`,
        { icon: '🚫' },
      );
    }

    if (!imageFiles.length) return;

    const toAdd = maxFiles != null ? imageFiles.slice(0, remaining) : imageFiles;
    const skipped = imageFiles.length - toAdd.length;

    if (skipped > 0) {
      toast.error(`Max ${maxFiles} image${maxFiles !== 1 ? 's' : ''} allowed.`);
    }

    if (toAdd.length) {
      onFiles(toAdd);
      toast.success(
        toAdd.length === 1 ? 'Image added!' : `${toAdd.length} images added!`,
        { duration: 2000 },
      );
    }
  }, [onFiles, remaining, maxFiles]);

  // ── Try to fetch an image URL pasted as text ──────────────
  const fetchImageUrl = useCallback(async (url: string) => {
    if (!IMAGE_URL_RE.test(url)) return false;
    setFetchingUrl(true);
    const toastId = toast.loading('Fetching image from URL…');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network response was not ok');
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Not an image');
      const ext  = url.split('.').pop()?.split('?')[0] ?? 'jpg';
      const file = new File([blob], `pasted-image.${ext}`, { type: blob.type });
      toast.success('Image fetched from URL!', { id: toastId });
      processFiles([file]);
      return true;
    } catch {
      toast.error('Could not load image from that URL.', { id: toastId });
      return false;
    } finally {
      setFetchingUrl(false);
    }
  }, [processFiles]);

  // ── Drag events ───────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = (e: React.DragEvent) => {
    if (!zoneRef.current?.contains(e.relatedTarget as Node)) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  // ── File input change ─────────────────────────────────────
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  // ── Global Ctrl+V / Cmd+V paste ──────────────────────────
  useEffect(() => {
    if (!globalPaste) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept paste inside text inputs / textareas
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      const items = Array.from(e.clipboardData?.items ?? []);

      // 1️⃣ Image files from clipboard (screenshot, copy-image, etc.)
      const imageFiles = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean) as File[];

      if (imageFiles.length) {
        e.preventDefault();
        processFiles(imageFiles);
        toast.success('Image pasted successfully!', { icon: '📋', duration: 2500 });
        return;
      }

      // 2️⃣ Text that looks like an image URL
      const textItem = items.find(item => item.kind === 'string' && item.type === 'text/plain');
      if (textItem) {
        textItem.getAsString(async (text) => {
          const trimmed = text.trim();
          if (IMAGE_URL_RE.test(trimmed)) {
            await fetchImageUrl(trimmed);
          }
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [globalPaste, processFiles, fetchImageUrl]);

  const canAdd = remaining > 0;

  return (
    <div className={cn('space-y-2', className)}>
      {/* ── Thumbnail strip ── */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, idx) => (
            <div
              key={idx}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 border-orange-400 dark:border-orange-500/60 shadow-sm group shrink-0',
                thumbSize,
              )}
            >
              <img src={src} alt={`upload ${idx + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                aria-label="Remove image"
              >
                <X size={16} className="text-white" />
              </button>
              <span className="absolute bottom-0 right-0 bg-orange-500 text-white text-[9px] font-bold px-1 rounded-tl-lg leading-4 pointer-events-none">
                {idx + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Drop zone ── */}
      {canAdd && (
        <div
          ref={zoneRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !fetchingUrl && inputRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2',
            'w-full min-h-[96px] rounded-2xl border-2 border-dashed cursor-pointer',
            'transition-all duration-200 select-none',
            fetchingUrl && 'pointer-events-none opacity-70',
            dragging
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 scale-[1.01] shadow-lg shadow-orange-500/20'
              : 'border-gray-300 dark:border-slate-600 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-500/5',
          )}
        >
          {/* Drag overlay glow */}
          {dragging && (
            <div className="absolute inset-0 rounded-2xl ring-4 ring-orange-400/40 pointer-events-none" />
          )}

          <div className={cn(
            'p-2.5 rounded-xl transition-colors',
            dragging        ? 'bg-orange-100 dark:bg-orange-500/20' :
            fetchingUrl     ? 'bg-blue-100 dark:bg-blue-500/20'     :
                              'bg-gray-100 dark:bg-slate-700',
          )}>
            {fetchingUrl
              ? <LinkIcon size={20} className="text-blue-500 animate-pulse" />
              : dragging
                ? <Upload size={20} className="text-orange-500" />
                : <ImagePlus size={20} className="text-gray-400 dark:text-slate-500" />
            }
          </div>

          <div className="text-center px-4">
            <p className={cn(
              'text-sm font-medium transition-colors',
              dragging    ? 'text-orange-600 dark:text-orange-400' :
              fetchingUrl ? 'text-blue-600 dark:text-blue-400'     :
                            'text-gray-600 dark:text-slate-400',
            )}>
              {fetchingUrl ? 'Fetching image…' : dragging ? 'Release to upload' : label}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sublabel}</p>
            {maxFiles != null && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                {previews.length}/{maxFiles} uploaded
              </p>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={!maxFiles || maxFiles > 1}
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {/* ── Paste hint (shown when zone is full) ── */}
      {!canAdd && globalPaste && (
        <p className="text-xs text-gray-400 dark:text-slate-500 text-center">
          Max {maxFiles} image{maxFiles !== 1 ? 's' : ''} reached · Remove one to add another
        </p>
      )}
    </div>
  );
}

/** Alias — same component, exported as MagicDropzone for semantic clarity */
export const MagicDropzone = DropZone;
