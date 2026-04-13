import { useState } from "react";
import { X, Image as ImageIcon, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CommunityOption {
  id: string;
  name: string;
}

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  /**
   * If fixedCommunityId is provided the community picker is hidden and that
   * community is used automatically (used from CommunityDetail view).
   */
  fixedCommunityId?: string;
  /** List of communities the user has joined — shown in picker when fixedCommunityId is absent. */
  communities?: CommunityOption[];
  onSubmit: (data: { text: string; imageUrl?: string; communityId: string }) => void;
}

const CreatePostSheet = ({
  open, onClose, onSubmit, fixedCommunityId, communities = [],
}: CreatePostSheetProps) => {
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [communityId, setCommunityId] = useState(communities[0]?.id || "");

  const reset = () => { setText(""); setImageUrl(""); setCommunityId(communities[0]?.id || ""); };

  const selectedCommunity = fixedCommunityId
    ? undefined
    : communities.find((c) => c.id === communityId);

  const effectiveCommunityId = fixedCommunityId || communityId;
  const canSubmit = text.trim().length > 0 && !!effectiveCommunityId;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ text: text.trim(), imageUrl: imageUrl.trim() || undefined, communityId: effectiveCommunityId });
    reset();
  };

  const handleClose = () => { onClose(); reset(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">Create Post</h2>
              <button onClick={handleClose} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Community picker — only shown when not fixed */}
              {!fixedCommunityId && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Post to community <span className="text-destructive">*</span>
                  </label>
                  {communities.length === 0 ? (
                    <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      You haven't joined any communities yet. Go to the Communities tab to join one.
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={communityId}
                        onChange={(e) => setCommunityId(e.target.value)}
                        className="w-full appearance-none rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary pr-10"
                      >
                        <option value="">Select a community…</option>
                        {communities.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a tip, ask a question, or start a discussion…"
                rows={4}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Image URL (optional)</label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreatePostSheet;
