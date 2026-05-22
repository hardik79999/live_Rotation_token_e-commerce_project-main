import { useState, useRef } from 'react';
import { RotateCcw, AlertTriangle, Upload, X, ImagePlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { orderApi } from '@/api/user';
import type { ReturnReason } from '@/types';
import toast from 'react-hot-toast';

const REASONS: { value: ReturnReason; label: string; emoji: string }[] = [
  { value: 'defective',        label: 'Defective / Not Working',  emoji: '🔧' },
  { value: 'wrong_item',       label: 'Wrong Item Delivered',      emoji: '📦' },
  { value: 'wrong_size',       label: 'Wrong Size / Fit',          emoji: '📏' },
  { value: 'not_as_described', label: 'Not as Described',          emoji: '🖼️' },
  { value: 'damaged_shipping', label: 'Damaged During Shipping',   emoji: '💥' },
  { value: 'changed_mind',     label: 'Changed My Mind',           emoji: '🤔' },
  { value: 'other',            label: 'Other',                     emoji: '📝' },
];

const MAX_IMAGES = 3;

interface Props {
  orderUuid:   string;
  orderAmount: number;
  daysLeft:    number;
  onClose:     () => void;
  onSuccess:   () => void;
}

export function ReturnOrderModal({ orderUuid, orderAmount, daysLeft, onClose, onSuccess }: Props) {
  const [reason,     setReason]     = useState<ReturnReason | ''>('');
  const [comments,   setComments]   = useState('');
  const [images,     setImages]     = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    const toAdd = files.slice(0, remaining);

    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...newPreviews]);

    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) { toast.error('Please select a return reason'); return; }
    setSubmitting(true);
    try {
      await orderApi.requestReturn(orderUuid, {
        reason,
        comments: comments.trim() || undefined,
        images,
      });
      // clean up object URLs
      previews.forEach((p) => URL.revokeObjectURL(p));
      toast.success("Return request submitted! We'll process it within 2–3 business days.");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  const isUrgent = daysLeft <= 2;

  return (
    <Modal isOpen onClose={onClose} title="Request a Return" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Return window banner ── */}
        <div className={`flex items-start gap-3 rounded-xl p-3 border ${
          isUrgent
            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30'
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
        }`}>
          <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
          <div>
            <p className={`text-xs font-semibold ${isUrgent ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {daysLeft === 0
                ? 'Return window closes today!'
                : `Return window closes in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
            </p>
            <p className={`text-xs mt-0.5 ${isUrgent ? 'text-red-600 dark:text-red-500' : 'text-amber-600 dark:text-amber-500'}`}>
              Refund of <strong>₹{orderAmount.toLocaleString('en-IN')}</strong> will be credited to your wallet or original payment method.
            </p>
          </div>
        </div>

        {/* ── Reason selector ── */}
        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2 block">
            Reason for Return <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2">
            {REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                  reason === r.value
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                    : 'border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-orange-500 shrink-0"
                />
                <span className="text-base leading-none">{r.emoji}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Evidence images ── */}
        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
            Upload Photos{' '}
            <span className="text-gray-400 dark:text-slate-500 font-normal">
              (optional · max {MAX_IMAGES} images)
            </span>
          </label>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
            Attach photos of the defect, wrong item, or damage to speed up your return.
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Existing previews */}
            {previews.map((src, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-orange-300 dark:border-orange-500/50 shadow-sm group">
                <img src={src} alt={`evidence ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <X size={18} className="text-white" />
                </button>
                <span className="absolute bottom-0 right-0 bg-orange-500 text-white text-[9px] font-bold px-1 rounded-tl-lg leading-4">
                  {idx + 1}
                </span>
              </div>
            ))}

            {/* Add button */}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/5 transition-colors flex flex-col items-center justify-center gap-1 text-gray-400 dark:text-slate-500 hover:text-orange-500"
              >
                <ImagePlus size={20} />
                <span className="text-[10px] font-medium">Add Photo</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageAdd}
          />

          {images.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              {images.length}/{MAX_IMAGES} photo{images.length !== 1 ? 's' : ''} added
            </p>
          )}
        </div>

        {/* ── Comments ── */}
        <div>
          <label className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
            Additional Comments{' '}
            <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Describe the issue in detail to help us process your return faster..."
            className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none transition-colors"
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 text-right">{comments.length}/500</p>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            disabled={!reason}
            className="flex-1"
          >
            <RotateCcw size={14} />
            {submitting ? 'Submitting…' : 'Submit Return'}
          </Button>
        </div>

      </form>
    </Modal>
  );
}
