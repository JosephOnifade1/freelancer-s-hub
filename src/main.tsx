import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./hooks/useTheme";

// Apply theme class before hydration to prevent FOUC
initTheme();

createRoot(document.getElementById("root")!).render(<App />);
