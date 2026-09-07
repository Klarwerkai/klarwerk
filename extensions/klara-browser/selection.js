// Runs once in Chrome's isolated world, only after an explicit capture gesture.
// No page listener, network, form-field extraction or extension-session access.
(() => ({
  text: window.getSelection()?.toString() ?? "",
  title: document.title,
  url: location.href,
}))();
