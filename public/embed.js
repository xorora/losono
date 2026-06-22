(() => {
  var script = document.currentScript;
  if (!script) {
    return;
  }

  var slug = script.getAttribute("data-agent");
  if (!slug) {
    console.error("[Losono] Missing data-agent attribute on embed script.");
    return;
  }

  var src = script.getAttribute("src");
  if (!src) {
    return;
  }

  var origin;
  try {
    origin = new URL(src, window.location.href).origin;
  } catch (error) {
    console.error("[Losono] Invalid embed script src.", error);
    return;
  }

  var position = script.getAttribute("data-position") || "bottom-right";
  var FAB_SIZE = 56;
  var INSET = 20;
  var GAP = 12;
  var PANEL_WIDTH = 400;
  var PANEL_HEIGHT = 640;

  var iframe = document.createElement("iframe");
  iframe.src = `${origin}/embed/${encodeURIComponent(slug)}?position=${encodeURIComponent(position)}`;
  iframe.title = "Losono agent";
  iframe.allow = "microphone";
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.position = "fixed";
  iframe.style.bottom = `${INSET}px`;
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.backgroundColor = "transparent";
  iframe.style.colorScheme = "normal";
  iframe.style.overflow = "hidden";
  iframe.style.zIndex = "2147483646";
  iframe.style.transition =
    "width 300ms cubic-bezier(0.32, 0.72, 0, 1), height 300ms cubic-bezier(0.32, 0.72, 0, 1)";

  if (position === "bottom-left") {
    iframe.style.left = `${INSET}px`;
    iframe.style.right = "auto";
  } else {
    iframe.style.right = `${INSET}px`;
    iframe.style.left = "auto";
  }

  var overlay = null;
  var isOpen = false;

  function collapsedSize() {
    return { width: FAB_SIZE, height: FAB_SIZE };
  }

  function expandedSize() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var panelW = Math.min(PANEL_WIDTH, vw - INSET * 2);
    var panelH = Math.min(PANEL_HEIGHT, Math.floor(vh * 0.8));
    return {
      width: panelW,
      height: panelH + GAP + FAB_SIZE,
    };
  }

  function applySize(open) {
    var size = open ? expandedSize() : collapsedSize();
    iframe.style.width = `${size.width}px`;
    iframe.style.height = `${size.height}px`;
  }

  function setOpen(open) {
    if (open === isOpen) {
      return;
    }
    isOpen = open;
    applySize(open);

    if (open) {
      overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483645;background:transparent;opacity:0;transition:opacity 300ms ease;";
      overlay.addEventListener("click", () => {
        iframe.contentWindow.postMessage(
          { type: "losono:embed:close" },
          origin,
        );
      });
      document.body.appendChild(overlay);
      requestAnimationFrame(() => {
        if (overlay) {
          overlay.style.opacity = "1";
        }
      });
    } else if (overlay) {
      overlay.style.opacity = "0";
      setTimeout(
        (node) => {
          node.remove();
        },
        300,
        overlay,
      );
      overlay = null;
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow) {
      return;
    }
    if (event.data && event.data.type === "losono:embed:resize") {
      setOpen(!!event.data.open);
    }
  });

  window.addEventListener("resize", () => {
    if (isOpen) {
      applySize(true);
    }
  });

  applySize(false);
  document.body.appendChild(iframe);
})();
