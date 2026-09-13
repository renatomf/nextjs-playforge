// Shows runtime errors on top of the game, so they are visible in the preview
// without opening the browser console. Load it as a classic script in <head>,
// before any module, so it also catches module syntax and loading errors:
//
//   <script src="./engine/errors.js"></script>
//
// It also posts each error to the parent window as { type: "game-error", ... }.
;(function () {
  if (window.reportGameError) return

  var seen = {}
  var panel = null
  var list = null

  function ensurePanel() {
    if (panel) return
    panel = document.createElement("div")
    panel.setAttribute("role", "alert")
    panel.style.cssText =
      "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;max-height:45vh;overflow:auto;" +
      "background:rgba(24,6,6,.94);color:#fecaca;border:1px solid #7f1d1d;border-radius:10px;" +
      "font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:10px 12px;" +
      "box-shadow:0 10px 30px rgba(0,0,0,.5)"
    var head = document.createElement("div")
    head.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;color:#fff;font-weight:700"
    head.textContent = "Game error"
    var close = document.createElement("button")
    close.textContent = "Dismiss"
    close.style.cssText =
      "background:#7f1d1d;color:#fff;border:0;border-radius:6px;padding:2px 8px;font:inherit;cursor:pointer"
    close.onclick = function () {
      panel.style.display = "none"
    }
    head.appendChild(close)
    list = document.createElement("div")
    panel.appendChild(head)
    panel.appendChild(list)
    ;(document.body || document.documentElement).appendChild(panel)
  }

  function report(error, source) {
    // report.js keeps the first error for the app; its own listeners miss the
    // errors the engine catches itself and hands to reportGameError.
    if (window.recordGameError) window.recordGameError(error, source)
    var message =
      (error && (error.stack || error.message)) || String(error || "Unknown error")
    if (source) message += "\n    at " + source
    var key = message.slice(0, 300)
    if (seen[key]) {
      seen[key].count++
      seen[key].badge.textContent = " ×" + seen[key].count
      return
    }
    console.error(error)
    try {
      window.parent.postMessage(
        { type: "game-error", message: String(message).slice(0, 4000) },
        "*"
      )
    } catch (e) {}
    var show = function () {
      ensurePanel()
      panel.style.display = "block"
      var item = document.createElement("pre")
      item.style.cssText =
        "margin:0 0 6px;white-space:pre-wrap;word-break:break-word"
      item.textContent = String(message).split("\n").slice(0, 6).join("\n")
      var badge = document.createElement("span")
      badge.style.color = "#fca5a5"
      item.appendChild(badge)
      list.appendChild(item)
      seen[key] = { count: 1, badge: badge }
    }
    seen[key] = { count: 1, badge: document.createElement("span") }
    if (document.body) show()
    else window.addEventListener("DOMContentLoaded", show)
  }

  window.reportGameError = report

  // Capture phase also catches <script>/<img> loading failures, which don't bubble.
  window.addEventListener(
    "error",
    function (event) {
      var target = event.target
      if (target && target !== window && target.tagName) {
        var url = target.src || target.href
        report(
          new Error(
            url
              ? "Failed to load " + url
              : "A <" + target.tagName.toLowerCase() + "> failed to load; check its import paths"
          )
        )
        return
      }
      report(
        event.error || event.message,
        event.filename ? event.filename + ":" + event.lineno : ""
      )
    },
    true
  )
  window.addEventListener("unhandledrejection", function (event) {
    report(event.reason)
  })
})()
