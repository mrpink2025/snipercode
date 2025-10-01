import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./scripts/setup-admins";
import "./scripts/setup-demo-user";

createRoot(document.getElementById("root")!).render(<App />);
