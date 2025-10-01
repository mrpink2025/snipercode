import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./scripts/setup-admins";

createRoot(document.getElementById("root")!).render(<App />);
