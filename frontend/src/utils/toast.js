export function showToast(msg) {
  const t = document.getElementById("qm-toast");
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
