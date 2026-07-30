export default function ConsolePageLoading() {
  return (
    <main className="page page-loading" aria-busy="true" aria-label="页面加载中">
      <header className="page-loading-header">
        <span className="loading-block loading-eyebrow" />
        <span className="loading-block loading-title" />
        <span className="loading-block loading-description" />
      </header>
      <section className="page-loading-metrics">
        <span className="loading-block" />
        <span className="loading-block" />
        <span className="loading-block" />
      </section>
      <section className="page-loading-content">
        <span className="loading-block loading-section-title" />
        <span className="loading-block loading-table" />
      </section>
    </main>
  );
}
