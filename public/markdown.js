import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Only text formatting is admitted; model output cannot embed active HTML or remote images.
export function renderMarkdown(text, purifier = DOMPurify) {
  const html = marked.parse(String(text ?? ''), { gfm: true, breaks: true, async: false });
  return purifier.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'del', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code',
      'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input'],
    ALLOWED_ATTR: ['href', 'title', 'start', 'align', 'type', 'checked', 'disabled'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'form', 'textarea', 'select', 'button'],
  });
}
