type Props = { onEnter: () => void };

export function Landing({ onEnter }: Props) {
  return (
    <div className="landing">
      <nav className="landing-nav rise">
        <div className="brand-mark">
          <img src="/nexus.svg" alt="" />
          <span>Agent Nexus</span>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onEnter}>
          Open mission control
        </button>
      </nav>

      <section className="hero">
        <div className="hero-visual" aria-hidden>
          <div className="constellation">
            <span className="node" />
            <span className="node" />
            <span className="node" />
            <span className="node" />
          </div>
        </div>
        <div className="hero-copy">
          <h1 className="hero-brand rise">Agent Nexus</h1>
          <p className="hero-line rise rise-delay-1">
            One shared mind for ChatGPT, Cursor, Claude, and Antigravity.
          </p>
          <p className="hero-sub rise rise-delay-2">
            Keep every desktop agent in sync—context vault, live bus, task distribution, and compiled
            outcomes so progress never evaporates between chats.
          </p>
          <div className="cta-row rise rise-delay-3">
            <button className="btn btn-primary" onClick={onEnter}>
              Enter mission control
            </button>
            <a className="btn btn-ghost" href="#how" onClick={(e) => e.preventDefault()}>
              Built for Windows desktop agents
            </a>
          </div>
        </div>
      </section>

      <footer className="muted rise rise-delay-3" style={{ fontSize: "0.85rem" }}>
        Local-first · SQLite vault · WebSocket bus · Paste & file bridge
      </footer>
    </div>
  );
}
