import AppLayout from "@/components/AppLayout";
import { Search, MapPin, Star, Phone, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const specializations = ["All", "Veterinarian", "Agronomist", "Irrigation", "Consultant"];

const expertData = [
  { id: 1, name: "Dr. Sarah Akinyi", specialization: "Veterinarian", location: "Kiambu", rating: 4.8, reviews: 56, experience: "12 years", services: "Livestock health, vaccination, artificial insemination", phone: "+254 7XX XXX XXX", avatar: "SA" },
  { id: 2, name: "James Oduor", specialization: "Agronomist", location: "Nakuru", rating: 4.6, reviews: 42, experience: "8 years", services: "Soil analysis, crop planning, pest management", phone: "+254 7XX XXX XXX", avatar: "JO" },
  { id: 3, name: "Eng. Faith Wambui", specialization: "Irrigation", location: "Nairobi", rating: 4.9, reviews: 78, experience: "15 years", services: "Drip irrigation, water harvesting, dam construction", phone: "+254 7XX XXX XXX", avatar: "FW" },
  { id: 4, name: "Dr. Paul Kamau", specialization: "Veterinarian", location: "Nyandarua", rating: 4.5, reviews: 31, experience: "6 years", services: "Poultry health, dairy cattle management", phone: "+254 7XX XXX XXX", avatar: "PK" },
  { id: 5, name: "Martha Chebet", specialization: "Consultant", location: "Eldoret", rating: 4.7, reviews: 39, experience: "10 years", services: "Farm business planning, market linkage, grants", phone: "+254 7XX XXX XXX", avatar: "MC" },
  { id: 6, name: "Dr. George Otieno", specialization: "Agronomist", location: "Kisumu", rating: 4.4, reviews: 27, experience: "7 years", services: "Organic farming, soil fertility, horticulture", phone: "+254 7XX XXX XXX", avatar: "GO" },
];

const Experts = () => {
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = expertData.filter((exp) => {
    const matchFilter = activeFilter === "All" || exp.specialization === activeFilter;
    const matchSearch =
      !searchQuery ||
      exp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Expert Directory</h1>

        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experts by name or location..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card text-muted-foreground">
            <Filter className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {specializations.map((spec) => (
            <button
              key={spec}
              onClick={() => setActiveFilter(spec)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeFilter === spec
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {spec}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((expert, i) => (
            <motion.div
              key={expert.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="harvest-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {expert.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{expert.name}</h3>
                  <p className="text-[11px] font-medium text-primary">{expert.specialization}</p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {expert.location}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 text-accent" /> {expert.rating} ({expert.reviews})
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{expert.experience} experience</p>
                  <p className="mt-1 text-xs text-foreground/80">{expert.services}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t pt-3">
                <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-2 text-xs font-medium text-primary">
                  <Phone className="h-3.5 w-3.5" /> Contact
                </button>
                <button className="flex-1 rounded-lg border py-2 text-xs font-medium text-foreground">
                  View Profile
                </button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No experts found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Experts;
