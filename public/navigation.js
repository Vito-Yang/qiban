const KEY = 'qiban.navigation';
const views = new Set(['today', 'tasks', 'memories', 'capabilities', 'settings', 'chat', 'conversations']);

export function restoreNavigation(chats, storage) {
  let saved;
  try { saved = JSON.parse(storage.getItem(KEY)); } catch { /* Storage may be disabled. */ }
  if (saved && views.has(saved.view)) {
    const chatId = chats.some(chat => chat.id === saved.chatId) ? saved.chatId : null;
    return { view: saved.view, chatId };
  }
  return chats.length ? { view: 'chat', chatId: chats[0].id } : { view: 'today', chatId: null };
}

export function persistNavigation(view, chatId, storage) {
  try { storage.setItem(KEY, JSON.stringify({ view, chatId })); } catch { /* Browsing still works. */ }
}
