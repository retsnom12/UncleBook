import Feed from "./Feed";

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="logo">unclebook</span>
          <span className="tagline">share like it's 2009</span>
        </div>
      </header>
      <main className="wrap">
        <Feed />
        <p className="muted" style={{ textAlign: "center", fontSize: 11 }}>
          A Kiroween 2026 project · no accounts, no tracking · photos are public
        </p>
      </main>
    </>
  );
}
