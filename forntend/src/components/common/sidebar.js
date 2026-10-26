export function renderSidebar({ label = "WORKSPACE", items = [] }) {
  const navItems = items
    .map(
      (item) => `
      <a href="${item.href}" class="nav-link ${item.isActive ? "is-active" : ""}" data-section="${item.id}">
        <span aria-hidden="true">${item.icon || "◈"}</span>${item.label}
      </a>
    `
    )
    .join("");

  return `
    <aside class="sidebar" id="sidebar" aria-label="${label} navigation">
      <a class="brand" href="#/" aria-label="VertexLearn AI">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <span>VERTEX<span>LEARN</span> AI</span>
      </a>
      <p class="sidebar-label">${label}</p>
      <nav class="sidebar-nav" aria-label="Sections">
        ${navItems}
      </nav>
      <div class="sidebar-note">
        <span class="status-dot" aria-hidden="true"></span>
        <div><strong>API-connected</strong><small>Synced with Vertex LMS backend.</small></div>
      </div>
    </aside>
  `;
}
