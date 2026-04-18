const projects = [
  "겹침Artboard 3.png",
  "겹침Artboard 2.png",
  "생일초.jpg",
  "IMG_3414.JPG",
  "패턴Artboard 12.png",
  "스티커 빨간원.jpg",
  "집Artboard 3.png",
  "원Artboard 4.png",
  "집Artboard 2.png"
].map((filename) => ({
  filename,
  src: `./image/${encodeURIComponent(filename)}`,
  isArtboard: filename.includes("Artboard"),
  title:
    filename.replace(/\.[^.]+$/, "") === "패턴Artboard 12"
      ? "겨울 패턴"
      : filename.replace(/\.[^.]+$/, "")
}));

const floatingItems = document.getElementById("floating-items");
const template = document.getElementById("project-card-template");
const projectModal = document.querySelector(".project-modal");
const projectWindowTemplate = document.getElementById("project-window-template");
const notesDockItem = document.querySelector('[data-dock-action="notes"]');
let topZIndex = 20;
let topWindowZIndex = 40;
let layoutMode = "default";
let cardNodes = [];
let layoutAnimationTimer;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function shuffle(array) {
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

function getDefaultLayout(projectsToPlace, viewportWidth, viewportHeight, isMobile, dockReserve) {
  const cardWidth = 90;
  const columns = isMobile ? 3 : 4;
  const rows = isMobile ? 5 : 3;
  const horizontalPadding = isMobile ? 20 : 32;
  const verticalPadding = isMobile ? 28 : 36;
  const cellWidth = (viewportWidth - horizontalPadding * 2) / columns;
  const cellHeight = (viewportHeight - verticalPadding * 2 - dockReserve) / rows;
  const slots = shuffle(
    Array.from({ length: columns * rows }, (_, slotIndex) => ({
      column: slotIndex % columns,
      row: Math.floor(slotIndex / columns)
    }))
  );

  return projectsToPlace.map((project, index) => {
    const slot = slots[index % slots.length];
    const xRatio = randomBetween(0.14, 0.86);
    const yRatio = randomBetween(0.16, 0.88);
    const leftBase = horizontalPadding + slot.column * cellWidth;
    const topBase = verticalPadding + slot.row * cellHeight;

    return {
      project,
      width: cardWidth,
      left: clamp(leftBase + cellWidth * xRatio - cardWidth / 2, 16, viewportWidth - cardWidth - 16),
      top: clamp(topBase + cellHeight * yRatio - cardWidth / 2, 18, viewportHeight - dockReserve - cardWidth),
      zIndex: String(6 + (slot.row % 2))
    };
  });
}

function getNotesLayout(projectsToPlace, viewportWidth, viewportHeight, isMobile, dockReserve) {
  const artboards = projectsToPlace.filter((project) => project.isArtboard);
  const others = projectsToPlace.filter((project) => !project.isArtboard);
  const mainWidth = isMobile ? 68 : 90;
  const smallWidth = Math.max(44, Math.round(mainWidth * 0.5));
  const gap = isMobile ? 10 : 16;
  const rowWidth = artboards.length * mainWidth + Math.max(0, artboards.length - 1) * gap;
  const rowStart = Math.max(16, (viewportWidth - rowWidth) / 2);
  const rowTop = clamp((viewportHeight - dockReserve) * 0.47, 90, viewportHeight - dockReserve - mainWidth - 40);
  const sideSlots = [
    { x: 0.12, y: 0.18 },
    { x: 0.84, y: 0.22 },
    { x: 0.16, y: 0.74 },
    { x: 0.8, y: 0.7 },
    { x: 0.1, y: 0.48 },
    { x: 0.88, y: 0.52 }
  ];

  const layout = artboards.map((project, index) => ({
    project,
    width: mainWidth,
    left: clamp(rowStart + index * (mainWidth + gap), 16, viewportWidth - mainWidth - 16),
    top: rowTop,
    zIndex: "8"
  }));

  others.forEach((project, index) => {
    const slot = sideSlots[index % sideSlots.length];
    layout.push({
      project,
      width: smallWidth,
      left: clamp(viewportWidth * slot.x - smallWidth / 2, 16, viewportWidth - smallWidth - 16),
      top: clamp((viewportHeight - dockReserve) * slot.y - smallWidth / 2, 24, viewportHeight - dockReserve - smallWidth),
      zIndex: "6"
    });
  });

  return layout;
}

function projectSummary(title) {
  return [
    `${title} is currently presented with placeholder portfolio copy in a Finder-style window.`,
    `Use this area for a short project story, your role, and the visual direction behind ${title}.`
  ];
}

function bringWindowToFront(windowNode) {
  windowNode.style.zIndex = String(++topWindowZIndex);
}

function positionProjectWindow(windowNode, anchorNode) {
  if (!anchorNode) {
    return;
  }

  const gap = 18;
  const margin = 20;
  const anchorRect = anchorNode.getBoundingClientRect();
  const windowRect = windowNode.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = anchorRect.right + gap;
  if (left + windowRect.width > viewportWidth - margin) {
    left = anchorRect.left - windowRect.width - gap;
  }
  if (left < margin) {
    left = Math.max(margin, viewportWidth - windowRect.width - margin);
  }

  let top = anchorRect.top - 16;
  if (top + windowRect.height > viewportHeight - margin) {
    top = viewportHeight - windowRect.height - margin;
  }
  if (top < margin) {
    top = margin;
  }

  windowNode.style.left = `${left}px`;
  windowNode.style.top = `${top}px`;
}

function enableWindowDrag(windowNode) {
  const titlebar = windowNode.querySelector(".project-window__titlebar");
  const dragState = {
    pointerId: null,
    offsetX: 0,
    offsetY: 0
  };

  titlebar.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".traffic-btn")) {
      return;
    }

    dragState.pointerId = event.pointerId;
    dragState.offsetX = event.clientX - windowNode.offsetLeft;
    dragState.offsetY = event.clientY - windowNode.offsetTop;
    bringWindowToFront(windowNode);
    windowNode.classList.add("is-dragging");
    titlebar.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  titlebar.addEventListener("pointermove", (event) => {
    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    const margin = 20;
    const maxLeft = Math.max(margin, window.innerWidth - windowNode.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - windowNode.offsetHeight - margin);
    const nextLeft = clamp(event.clientX - dragState.offsetX, margin, maxLeft);
    const nextTop = clamp(event.clientY - dragState.offsetY, margin, maxTop);
    windowNode.style.left = `${nextLeft}px`;
    windowNode.style.top = `${nextTop}px`;
  });

  function stopDragging(event) {
    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    if (titlebar.hasPointerCapture(event.pointerId)) {
      titlebar.releasePointerCapture(event.pointerId);
    }
    windowNode.classList.remove("is-dragging");
    dragState.pointerId = null;
  }

  titlebar.addEventListener("pointerup", stopDragging);
  titlebar.addEventListener("pointercancel", stopDragging);
}

function createProjectWindow(project, anchorNode) {
  const windowNode = projectWindowTemplate.content.firstElementChild.cloneNode(true);
  const modalTitle = windowNode.querySelector(".project-window__title");
  const modalSidebarName = windowNode.querySelector(".sidebar-meta__name");
  const modalSidebarImage = windowNode.querySelector(".sidebar-thumb__image");
  const modalPreviewImage = windowNode.querySelector(".window-preview__image");
  const closeButton = windowNode.querySelector(".traffic-btn--close");
  const paragraphs = windowNode.querySelectorAll(".window-copy");

  modalTitle.textContent = `Information about: ${project.title}`;
  modalSidebarName.textContent = project.title;
  modalSidebarImage.src = project.src;
  modalSidebarImage.alt = project.title;
  modalPreviewImage.src = project.src;
  modalPreviewImage.alt = `${project.title} preview`;

  const summary = projectSummary(project.title);
  paragraphs.forEach((paragraph, index) => {
    paragraph.textContent = summary[index] ?? "";
  });

  bringWindowToFront(windowNode);
  projectModal.appendChild(windowNode);
  enableWindowDrag(windowNode);

  windowNode.addEventListener("pointerdown", () => {
    bringWindowToFront(windowNode);
  });

  closeButton.addEventListener("click", () => {
    windowNode.remove();
  });

  requestAnimationFrame(() => {
    positionProjectWindow(windowNode, anchorNode);
  });
}

function getBounds(viewportWidth, viewportHeight, dockReserve, node) {
  return {
    maxLeft: Math.max(16, viewportWidth - node.offsetWidth - 16),
    maxTop: Math.max(18, viewportHeight - dockReserve - node.offsetHeight)
  };
}

function clampNodePosition(node, viewportWidth, viewportHeight, dockReserve) {
  const bounds = getBounds(viewportWidth, viewportHeight, dockReserve, node);
  const nextLeft = clamp(node.offsetLeft, 16, bounds.maxLeft);
  const nextTop = clamp(node.offsetTop, 18, bounds.maxTop);
  node.style.left = `${nextLeft}px`;
  node.style.top = `${nextTop}px`;
}

function enableDrag(node, viewportWidth, viewportHeight, dockReserve) {
  const dragState = {
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    moved: false
  };

  node.addEventListener("pointerdown", (event) => {
    dragState.pointerId = event.pointerId;
    dragState.offsetX = event.clientX - node.offsetLeft;
    dragState.offsetY = event.clientY - node.offsetTop;
    dragState.moved = false;
    node.classList.add("is-dragging");
    node.style.zIndex = String(++topZIndex);
    node.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  node.addEventListener("pointermove", (event) => {
    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.offsetX - node.offsetLeft;
    const deltaY = event.clientY - dragState.offsetY - node.offsetTop;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragState.moved = true;
    }

    const bounds = getBounds(viewportWidth, viewportHeight, dockReserve, node);
    const nextLeft = clamp(event.clientX - dragState.offsetX, 16, bounds.maxLeft);
    const nextTop = clamp(event.clientY - dragState.offsetY, 18, bounds.maxTop);
    node.style.left = `${nextLeft}px`;
    node.style.top = `${nextTop}px`;
  });

  function stopDragging(event) {
    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    node.classList.remove("is-dragging");
    if (node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
    node.dataset.dragMoved = dragState.moved ? "true" : "false";
    dragState.pointerId = null;
  }

  node.addEventListener("pointerup", stopDragging);
  node.addEventListener("pointercancel", stopDragging);
}

function ensureCards(viewportWidth, viewportHeight, dockReserve) {
  if (cardNodes.length > 0) {
    return;
  }

  cardNodes = projects.map((project) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const media = node.querySelector(".project-card__media");
    const label = node.querySelector(".project-card__label");

    media.src = project.src;
    media.alt = project.title;
    label.textContent = project.title;
    node.tabIndex = 0;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `Open details for ${project.title}`);

    floatingItems.appendChild(node);
    enableDrag(node, viewportWidth, viewportHeight, dockReserve);

    node.addEventListener("click", () => {
      if (node.dataset.dragMoved === "true") {
        node.dataset.dragMoved = "false";
        return;
      }
      createProjectWindow(project, node);
    });

    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        createProjectWindow(project, node);
      }
    });

    return node;
  });
}

function placeCards({ animate = false } = {}) {

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isMobile = viewportWidth <= 640;
  const dockReserve = isMobile ? 96 : 120;
  ensureCards(viewportWidth, viewportHeight, dockReserve);
  const layout =
    layoutMode === "notes"
      ? getNotesLayout(projects, viewportWidth, viewportHeight, isMobile, dockReserve)
      : getDefaultLayout(projects, viewportWidth, viewportHeight, isMobile, dockReserve);

  window.clearTimeout(layoutAnimationTimer);
  floatingItems.classList.toggle("is-layout-animating", animate);

  layout.forEach(({ width, left, top, zIndex }, index) => {
    const node = cardNodes[index];
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.zIndex = zIndex;
    node.style.setProperty("--card-width", `${width}px`);
    node.style.setProperty("--card-width-mobile", `${width}px`);

    const syncLayout = () => {
      clampNodePosition(node, viewportWidth, viewportHeight, dockReserve);
    };

    const media = node.querySelector(".project-card__media");
    if (media.complete) {
      syncLayout();
    } else {
      media.addEventListener("load", syncLayout, { once: true });
    }
  });

  if (animate) {
    layoutAnimationTimer = window.setTimeout(() => {
      floatingItems.classList.remove("is-layout-animating");
    }, 820);
  }
}

placeCards({ animate: false });

notesDockItem.addEventListener("click", (event) => {
  event.preventDefault();
  layoutMode = "notes";
  placeCards({ animate: true });
});

let resizeTimer;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    placeCards({ animate: false });
  }, 120);
});
