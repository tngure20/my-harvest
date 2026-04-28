import { useCallback, useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { motion } from "framer-motion";
import {
  ChevronLeft, MapPin, RefreshCw, Loader2, Cloud, CloudRain, Sun,
  Thermometer, Droplets, Wind, Sunrise, Sunset, Gauge, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getWeatherContext, clearWeatherCache,
  type WeatherContext, type WeatherAlertSeverity,
} from "@/services/weatherService";

function pickWeatherIcon(description: string) {
  const d = (description || "").toLowerCase();
  if (d.includes("rain") || d.includes("drizzle") || d.includes("shower") || d.includes("thunder")) return CloudRain;
  if (d.includes("cloud") || d.includes("overcast") || d.includes("fog")) return Cloud;
  return Sun;
}

const SEVERITY_BADGE: Record<WeatherAlertSeverity, string> = {
  high:   "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
  low:    "bg-muted text-muted-foreground ring-1 ring-border",
};

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch { return "—"; }
}

const WeatherDetails = () => {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<WeatherContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) {
      setRefreshing(true);
      clearWeatherCache();
    } else {
      setLoading(true);
    }
    try {
      const w = await getWeatherContext({ force });
      setCtx(w);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load(true);
    window.addEventListener("harvest:location-changed", handler);
    return () => window.removeEventListener("harvest:location-changed", handler);
  }, [load]);

  const Header = (
    <div className="flex items-center gap-3">
      <button
        onClick={() => navigate(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
        aria-label="Go back"
        data-testid="button-back-weather"
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-foreground">Weather Details</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Detailed forecast and farm-relevant alerts
        </p>
      </div>
      <button
        onClick={() => load(true)}
        disabled={refreshing}
        aria-label="Refresh weather"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
        data-testid="button-refresh-weather"
      >
        <RefreshCw className={`h-4 w-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  if (loading && !ctx) {
    return (
      <AppLayout>
        <div className="px-4 py-4 space-y-5">
          {Header}
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!ctx) {
    return (
      <AppLayout>
        <div className="px-4 py-4 space-y-5">
          {Header}
          <div className="harvest-card p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Weather unavailable</p>
            <p className="text-xs text-muted-foreground">
              Allow location access or set your region in Settings to see live weather.
            </p>
            <button
              onClick={() => navigate("/settings")}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              data-testid="button-set-location"
            >
              <MapPin className="h-3.5 w-3.5" /> Set location
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const CurrentIcon = pickWeatherIcon(ctx.description);
  const today = ctx.daily[0];

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-5">
        {Header}

        {/* Current */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="harvest-gradient rounded-2xl p-5 text-primary-foreground"
        >
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25 max-w-full"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {ctx.location}
              {ctx.county && ctx.county !== ctx.location ? `, ${ctx.county}` : ""}
              {ctx.country ? `, ${ctx.country}` : ""}
            </span>
          </button>

          <div className="mt-3 flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-end gap-2">
                <span className="font-display text-5xl font-bold leading-none">{Math.round(ctx.temperature)}°</span>
                <span className="mb-1 text-sm opacity-90 truncate max-w-[180px]">{ctx.description}</span>
              </div>
              <p className="mt-1 text-xs opacity-80">
                Feels like {Math.round(ctx.feelsLike)}° · {ctx.season}
              </p>
            </div>
            <CurrentIcon className="h-16 w-16 opacity-90 shrink-0" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Pill icon={Thermometer} label="Hi / Lo" value={today ? `${Math.round(today.tempMaxC)}° / ${Math.round(today.tempMinC)}°` : `${Math.round(ctx.feelsLike)}°`} />
            <Pill icon={Droplets} label="Humidity" value={`${ctx.humidity}%`} />
            <Pill icon={Cloud} label="Rain" value={today ? `${today.precipChance}%` : `${ctx.rainMm}mm`} />
            <Pill icon={Wind} label={ctx.windDirection || "Wind"} value={`${Math.round(ctx.windKph)} km/h`} />
          </div>

          {(ctx.sunriseISO || ctx.sunsetISO || ctx.uvIndex > 0) && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2 text-[11px]">
              <span className="flex items-center gap-1.5"><Sunrise className="h-3.5 w-3.5" /> {fmtTime(ctx.sunriseISO)}</span>
              <span className="flex items-center gap-1.5"><Sunset className="h-3.5 w-3.5" /> {fmtTime(ctx.sunsetISO)}</span>
              <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" /> UV {ctx.uvIndex.toFixed(1)}</span>
            </div>
          )}
        </motion.div>

        {/* Alerts */}
        {ctx.alerts.length > 0 && (
          <section aria-label="Weather alerts">
            <h2 className="harvest-section-title mb-2">Alerts</h2>
            <div className="space-y-2">
              {ctx.alerts.map((a, i) => (
                <div
                  key={`${a.kind}-${i}`}
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${SEVERITY_BADGE[a.severity]}`}
                  data-testid={`alert-${a.kind}`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight">{a.title}</p>
                    <p className="opacity-90 leading-snug mt-0.5">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7-day */}
        {ctx.daily.length > 0 && (
          <section aria-label="7-day forecast">
            <h2 className="harvest-section-title mb-2">7-day forecast</h2>
            <div className="harvest-card divide-y">
              {ctx.daily.slice(0, 7).map((d, i) => {
                const Icon = pickWeatherIcon(d.description);
                return (
                  <div
                    key={`${d.date}-${i}`}
                    className="flex items-center gap-3 px-3 py-2.5"
                    data-testid={`day-${d.date}`}
                  >
                    <div className="w-12 text-xs font-medium text-foreground shrink-0">
                      {i === 0 ? "Today" : d.weekdayShort}
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate capitalize">{d.description}</p>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted mt-1">
                        <div
                          className="h-full bg-sky-500/60"
                          style={{ width: `${Math.min(100, d.precipChance)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-14 text-right text-[11px] text-muted-foreground shrink-0">
                      {d.precipChance}% rain
                    </div>
                    <div className="w-16 text-right text-xs font-medium text-foreground shrink-0">
                      {Math.round(d.tempMaxC)}° / <span className="text-muted-foreground">{Math.round(d.tempMinC)}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Hourly */}
        {ctx.hourly.length > 0 && (
          <section aria-label="Hourly forecast">
            <h2 className="harvest-section-title mb-2">Next 24 hours</h2>
            <div className="harvest-card p-3">
              <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1">
                {ctx.hourly.map((h, i) => {
                  const Icon = pickWeatherIcon(h.description);
                  return (
                    <div
                      key={`${h.iso}-${i}`}
                      className="flex flex-col items-center gap-1 shrink-0 min-w-[48px]"
                    >
                      <span className="text-[10px] text-muted-foreground">{h.hourLabel}</span>
                      <Icon className="h-4 w-4 text-foreground/80" />
                      <span className="text-xs font-medium text-foreground">{Math.round(h.tempC)}°</span>
                      {h.precipChance >= 20 && (
                        <span className="text-[10px] text-sky-600 dark:text-sky-400">{h.precipChance}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Data from Open-Meteo · Updated {new Date(ctx.fetchedAt || Date.now()).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </AppLayout>
  );
};

const Pill = ({ icon: Icon, label, value }: { icon: typeof Cloud; label: string; value: string }) => (
  <div className="flex flex-col items-center gap-1 rounded-lg bg-white/15 px-2 py-2">
    <Icon className="h-4 w-4" />
    <span className="text-[11px] font-medium">{value}</span>
    <span className="text-[10px] opacity-70">{label}</span>
  </div>
);

export default WeatherDetails;
