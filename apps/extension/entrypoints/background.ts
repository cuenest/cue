import { addPending } from '../lib/pending';

export default defineBackground(() => {
  void browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: 'cue-capture',
      title: 'Capture to Cue',
      contexts: ['selection', 'page'],
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    const body =
      info.selectionText?.trim() ||
      (tab?.title && tab?.url ? `${tab.title} — ${tab.url}` : (tab?.url ?? ''));
    if (!body) return;
    void addPending(browser.storage.local, body);
    void browser.action.setBadgeText({ text: '+' });
    void browser.action.setBadgeBackgroundColor({ color: '#ffd21e' });
  });
});
