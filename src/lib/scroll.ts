export function scrollToPaper(id: string) {
  const el = document.getElementById(`p-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('is-flashed');
  // Restart the highlight animation.
  void el.offsetWidth;
  el.classList.add('is-flashed');
}
