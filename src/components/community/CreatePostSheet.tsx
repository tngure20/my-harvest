import { useState } from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CreatePostSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { text: string; tag: string; imageUrl?: string }) => void;
}

const tags = ["Question", "Tip", "Discussion", "Success Story", "Market Info", "Weather", "Other"];

const CreatePostSheet = ({ open, onClose, onSubmit }: CreatePostSheetProps) => {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Discussion");
  const [imageUrl, setImageUrl] = useState("");

  const reset = () => { setText(""); setTag("Discussion"); setImageUrl(""); };

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit({ text: text.trim(), tag, imageUrl: imageUrl.trim() || undefined });
    reset();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" onClick={() => { onClose(); reset(); }} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">Create Post</h2>
              <button onClick={() => { onClose(); reset(); }} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a tip, ask a question, or start a discussion..."
                rows={4}
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Topic tag</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTag(t)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        tag === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Image URL (optional)</label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
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
                disabled={!text.trim()}
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
