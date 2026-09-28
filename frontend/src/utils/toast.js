// Fires a DOM event carrying the toast message. Shared/Toast.jsx listens for
// this and renders it — kept as a plain function (not a hook) so every
// existing call site (showToast("...")) works unchanged from anywhere,
// including plain event handlers outside React's render tree.
export function showToast(msg) {
  window.dispatchEvent(new CustomEvent("qm-toast", { detail: { msg } }));
}
