import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-5xl">
        🌾
      </div>
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="mt-2 text-lg font-semibold text-foreground">Page not found</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Go back
        </button>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Home className="h-4 w-4" /> Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
