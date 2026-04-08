import { useState } from "react";
import { X, Users, Image as ImageIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { createCommunity, type Community } from "@/services/socialService";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (community: Community) => void;
}

const CreateCommunitySheet = ({ open, onClose, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setName(""); setDescription(""); setImageUrl(""); };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const community = await createCommunity({
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success("Community created!");
      onCreated(community);
      reset();
      onClose();
    } catch (err) {
      toast.error("Could not create community. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

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
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card shadow-xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-display text-lg font-bold text-foreground">Create Community</h2>
              </div>
              <button onClick={handleClose} className="rounded-full bg-muted p-1.5">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Community name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Rift Valley Maize Farmers"
                  maxLength={60}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{name.length}/60</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this community about? What can members discuss?"
                  rows={3}
                  maxLength={300}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{description.length}/300</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Cover image URL (optional)</label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!name.trim() || loading}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                {loading ? "Creating..." : "Create Community"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreateCommunitySheet;
