import { useState, useRef } from "react";
import { X, Image as ImageIcon, Video, Tag, Upload, Globe, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { createPost, uploadMedia, type SocialPost, type Community } from "@/services/socialService";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (post: SocialPost) => void;
  communities?: Community[];
  defaultCommunityId?: string | null;
}

const TAGS = ["Question", "Tip", "Discussion", "Success Story", "Market Info", "Weather", "Alert", "Other"];

const CreatePostSheet = ({ open, onClose, onCreated, communities = [], defaultCommunityId = null }: Props) => {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Discussion");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [communityId, setCommunityId] = useState<string | null>(defaultCommunityId);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediaMode, setMediaMode] = useState<"none" | "image" | "video">("none");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText(""); setTag("Discussion"); setImageUrl(""); setVideoUrl("");
    setCommunityId(defaultCommunityId); setMediaMode("none");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file);
      if (file.type.startsWith("image/")) {
        setImageUrl(url);
        setMediaMode("image");
      } else {
        setVideoUrl(url);
        setMediaMode("video");
      }
      toast.success("Media uploaded!");
    } catch {
      toast.error("Upload failed. You can still paste a URL below.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imageUrl && !videoUrl) return;
    setSubmitting(true);
    try {
      const post = await createPost({
        text: text.trim(),
        imageUrl: imageUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        tag,
        communityId: communityId || null,
      });
      toast.success("Post published!");
      onCreated(post);
      reset();
      onClose();
    } catch {
      toast.error("Could not publish post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = (text.trim().length > 0 || !!imageUrl || !!videoUrl) && !submitting;

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
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
              <h2 className="font-display text-lg font-bold text-foreground">Create Post</h2>
              <button onClick={handleClose} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Audience selector */}
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={communityId ?? ""}
                  onChange={(e) => setCommunityId(e.target.value || null)}
                  className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Everyone (public feed)</option>
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      📌 {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Text area */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a tip, ask a question, or start a discussion..."
                rows={4}
                autoFocus
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
              />

              {/* Tag pills */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  <Tag className="h-3 w-3 inline mr-1" /> Topic tag
                </label>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTag(t)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        tag === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Media section */}
              <div className="rounded-xl border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setMediaMode("image"); fileRef.current?.click(); }}
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMediaMode("video"); fileRef.current?.click(); }}
                    className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Upload Video
                  </button>
                  {uploading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                </div>

                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />

                {/* URL fallback */}
                {(mediaMode === "image" || imageUrl) && (
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">Or paste image URL</label>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full rounded-lg border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                    {imageUrl && (
                      <img src={imageUrl} alt="" className="mt-2 w-full rounded-lg object-cover max-h-40 bg-muted"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                  </div>
                )}

                {(mediaMode === "video" || videoUrl) && (
                  <div>
                    <label className="text-[11px] text-muted-foreground mb-1 block">Or paste video URL</label>
                    <input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://example.com/video.mp4"
                      className="w-full rounded-lg border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                {submitting ? "Publishing..." : "Publish Post"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreatePostSheet;
