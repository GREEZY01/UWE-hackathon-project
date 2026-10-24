import { useEffect, useState, lazy, Suspense } from "react";
import {
  ShieldCheck,
  MessageSquare,
  Play,
  BarChart3,
  ScrollText,
  SlidersHorizontal,
  Info,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
const Chat = lazy(() => import("./views/Chat"));
import Demo from "./views/Demo";
const Evaluation = lazy(() => import("./views/Evaluation"));
const Audit = lazy(() => import("./views/Audit"));
const Policies = lazy(() => import("./views/Policies"));
const About = lazy(() => import("./views/About"));
import type { Health } from "./types";
import { api } from "./api";
const navigation = [
  { id: "demo", label: "Before & after", icon: Play },
  { id: "chat", label: "Chat workspace", icon: MessageSquare },
  { id: "evaluation", label: "Evaluation", icon: BarChart3 },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "policies", label: "Policy packs", icon: SlidersHorizontal },
  { id: "about", label: "About & limitations", icon: Info },
];
export default function App() {
  const [view, setView] = useState(() => location.hash.slice(1) || "demo");
  const [health, setHealth] = useState<Health | null>(null);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    function change() {
      setView(location.hash.slice(1) || "demo");
      setMobile(false);
    }
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    let active = true;
    function check() {
      api<Health>("/health")
        .then((v) => {
          if (active) setHealth(v);
        })
        .catch(() => {
          if (active) setHealth(null);
        });
    }
    check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside
        id="workspace-sidebar"
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
      >
        <button
          className="mobile-close"
          aria-label="Close sidebar"
          onClick={() => setMobile(false)}
        >
          <X size={18} />
        </button>
        <a className="brand" href="#demo">
          <span>
            <ShieldCheck size={25} />
          </span>
          FinGuard<span className="brand-dot">.</span>
        </a>
        <div className="workspace-name">
          <span className="workspace-avatar">N</span>
          <div>
            Northbridge Financial<small>AI assurance workspace</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={"#" + id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {id === "demo" && <span className="nav-new">DEMO</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="nemo-label">
            <ShieldCheck size={20} />
            <span>
              Powered by NVIDIA<small>NeMo Guardrails</small>
            </span>
          </div>
          <p>
            Built to make AI decisions
            <br />
            easier to inspect.
          </p>
          <a href="#about">
            Explore the architecture <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label={mobile ? "Close navigation" : "Open navigation"}
            aria-expanded={mobile}
            aria-controls="workspace-sidebar"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span>
            Workspace <span className="divider">/</span>{" "}
            <strong>
              {navigation.find((n) => n.id === view)?.label ?? "Overview"}
            </strong>
          </span>
          <span className="connection">
            <i className={health ? "online" : ""} />
            {health
              ? `${health.provider === "mock" ? "Mock model" : health.provider} connected`
              : "Backend unavailable · cache available"}
          </span>
        </header>
        <div className="disclaimer">
          <Info size={13} />
          <span>
            Demo with fictional data. Not financial, legal or regulatory advice.
          </span>
        </div>
        <main id="main-content" tabIndex={-1}>
          <Suspense fallback={<p role="status">Loading workspace…</p>}>
            {view === "chat" ? (
              <Chat />
            ) : view === "evaluation" ? (
              <Evaluation health={health} />
            ) : view === "audit" ? (
              <Audit />
            ) : view === "policies" ? (
              <Policies />
            ) : view === "about" ? (
              <About />
            ) : (
              <Demo health={health} />
            )}
          </Suspense>
        </main>
        <footer>
          FinGuard · Demonstration environment{" "}
          <span>Illustrative policy mappings. Human oversight required.</span>
        </footer>
      </div>
    </div>
  );
}
