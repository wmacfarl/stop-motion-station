import { createProjectBrowserTileList } from "../helpers/project-browser-operations.js";

const PROJECT_TILE_MINIMUM_WIDTH_PIXELS = 200;

export function computeProjectBrowserColumnCount({ availableWidth }) {
  const horizontalPaddingPixels = 48;
  const usableWidth = Math.max(1, availableWidth - horizontalPaddingPixels);
  return Math.max(1, Math.floor(usableWidth / PROJECT_TILE_MINIMUM_WIDTH_PIXELS));
}

export default function projectBrowserView(state) {
  const projectBrowserTileList = createProjectBrowserTileList({ projects: state.projects });
  const selectedProjectBrowserIndex = Math.min(
    state.selectedProjectBrowserIndex,
    Math.max(0, projectBrowserTileList.length - 1),
  );

  return html`
    <div id="app" class="application-root project-browser-root">
      <section class="project-browser-surface">
        <header class="project-browser-header">
          <h1 class="project-browser-title">Stop Motion Station</h1>
          <p class="project-browser-subtitle">Choose a project or create a new one</p>
        </header>

        <div
          class="project-browser-grid"
          style=${`
            --project-browser-column-count: ${state.projectBrowserColumnCount};
          `}
        >
          ${projectBrowserTileList.map((tileViewModel, tileIndex) => {
            const isSelectedTile = tileIndex === selectedProjectBrowserIndex;

            if (tileViewModel.type === "new-project") {
              return html`
                <article class=${`project-browser-tile new-project-tile ${isSelectedTile ? "is-selected" : ""}`}>
                  <div class="project-browser-thumbnail-placeholder project-browser-thumbnail-plus">+</div>
                  <h2 class="project-browser-tile-title">${tileViewModel.title}</h2>
                </article>
              `;
            }

            return html`
              <article class=${`project-browser-tile ${isSelectedTile ? "is-selected" : ""}`}>
                ${tileViewModel.thumbnailImageSource
                  ? html`
                    <img
                      class="project-browser-thumbnail-image"
                      src=${tileViewModel.thumbnailImageSource}
                      alt=${`Thumbnail for ${tileViewModel.title}`}
                    />
                  `
                  : html`
                    <div class="project-browser-thumbnail-placeholder">No frames yet</div>
                  `}
                <h2 class="project-browser-tile-title">${tileViewModel.title}</h2>
              </article>
            `;
          })}
        </div>
      </section>
    </div>
  `;
}
