const instructorPages = [
  new URL("../pages/instructor/overview.html", import.meta.url),
  new URL("../pages/instructor/course-builder.html", import.meta.url),
  new URL("../pages/instructor/assessments.html", import.meta.url)
];

export async function loadInstructorPages(container) {
  if (!container) {
    throw new Error("Instructor page container was not found.");
  }

  container.setAttribute("aria-busy", "true");

  try {
    const fragments = await Promise.all(
      instructorPages.map(async (pageUrl) => {
        const response = await fetch(pageUrl);

        if (!response.ok) {
          throw new Error(
            `Could not load ${pageUrl.pathname}: HTTP ${response.status}`
          );
        }

        return response.text();
      })
    );

    container.innerHTML = fragments.join("\n");
  } catch (error) {
    console.error("Could not load instructor pages:", error);
    throw error;
  } finally {
    container.removeAttribute("aria-busy");
  }
}
