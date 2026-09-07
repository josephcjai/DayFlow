/**
 * DayFlow Markdown Parser & Multi-Language Syntax Highlighter
 * Zero-dependency, fast, secure client-side Markdown rendering engine.
 * Supports:
 * - Markdown Headings, Bold, Italic, Strikethrough, Blockquotes, HR
 * - Unordered lists, Ordered lists, and Task Checkboxes (- [ ], - [x])
 * - Tables with alignment and headers
 * - Fenced code blocks with language labels, Copy buttons, and Syntax Highlighting
 * - Specialized highlighters for: C#, WPF XAML, SQL, JavaScript, TypeScript, Python, JSON, CSS, Shell
 */

import { escapeHtml } from './utils.js?v=2.5.5';

/**
 * Syntax highlighter tokenizers for common developer languages
 */
export function highlightCode(code, language = '') {
  const lang = (language || '').toLowerCase().trim();
  const escaped = escapeHtml(code);

  if (!lang) {
    return escaped;
  }

  try {
    switch (lang) {
      case 'csharp':
      case 'cs':
      case 'c#':
        return highlightCSharp(code);
      case 'xaml':
      case 'xml':
      case 'html':
        return highlightMarkup(code);
      case 'sql':
      case 'pgsql':
      case 'postgresql':
        return highlightSql(code);
      case 'javascript':
      case 'js':
      case 'typescript':
      case 'ts':
        return highlightJavaScript(code);
      case 'json':
        return highlightJson(code);
      case 'css':
        return highlightCss(code);
      case 'python':
      case 'py':
        return highlightPython(code);
      case 'bash':
      case 'sh':
      case 'shell':
      case 'powershell':
      case 'ps1':
        return highlightShell(code);
      default:
        return escaped;
    }
  } catch (err) {
    console.warn('Syntax highlight error:', err);
    return escaped;
  }
}

function highlightCSharp(code) {
  let s = escapeHtml(code);

  // Comments (// and /* */)
  s = s.replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>');
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');

  // Strings (including verbatim @"..." and interpolated $"...")
  s = s.replace(/(\$?"(?:\\.|[^"\\])*")/g, '<span class="hl-string">$1</span>');

  // Numbers
  s = s.replace(/\b(\d+(?:\.\d+)?(?:f|m|d|u|l|ul)?)\b/gi, '<span class="hl-number">$1</span>');

  // C# Keywords
  const keywords = [
    'abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte', 'case', 'catch',
    'char', 'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
    'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false', 'finally',
    'fixed', 'float', 'for', 'foreach', 'get', 'goto', 'if', 'implicit', 'in', 'init',
    'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace', 'new', 'null',
    'object', 'operator', 'out', 'override', 'params', 'private', 'protected', 'public',
    'readonly', 'record', 'ref', 'return', 'sbyte', 'sealed', 'set', 'short', 'sizeof',
    'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
    'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using',
    'value', 'var', 'virtual', 'void', 'volatile', 'when', 'where', 'while', 'yield'
  ];
  const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  s = s.replace(kwRegex, '<span class="hl-keyword">$1</span>');

  // Common .NET Framework Types
  s = s.replace(/\b(Task|List|Dictionary|IEnumerable|ICollection|IList|ObservableCollection|Action|Func|Tuple|Nullable|Guid|DateTime|TimeSpan|StringBuilder|Console|Math|Regex|LINQ)\b/g, '<span class="hl-type">$1</span>');

  return s;
}

function highlightMarkup(code) {
  let s = escapeHtml(code);

  // XML / HTML / XAML Comments &lt;!-- ... --&gt;
  s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>');

  // Tags and attributes
  s = s.replace(/(&lt;\/?)([a-zA-Z0-9_:\.-]+)([\s\S]*?)(\/?&gt;)/g, (match, open, tag, attrs, close) => {
    // Highlight tag name
    let highlightedTag = `${open}<span class="hl-tag">${tag}</span>`;

    // Highlight attributes: attr="value" or attr='value'
    let highlightedAttrs = attrs.replace(/([a-zA-Z0-9_:\.-]+)(=)(&quot;.*?&quot;|&#039;.*?&#039;)/g,
      '<span class="hl-attribute">$1</span>$2<span class="hl-string">$3</span>'
    );

    // Highlight XAML Bindings inside values {Binding ...}
    highlightedAttrs = highlightedAttrs.replace(/(\{(?:Binding|StaticResource|DynamicResource|x:Static|TemplateBinding)\s+[^}]+\})/g,
      '<span class="hl-binding">$1</span>'
    );

    return `${highlightedTag}${highlightedAttrs}${close}`;
  });

  return s;
}

function highlightSql(code) {
  let s = escapeHtml(code);

  // Comments (-- ... and /* ... */)
  s = s.replace(/(--[^\n]*)/g, '<span class="hl-comment">$1</span>');
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');

  // Strings '...'
  s = s.replace(/(&#039;.*?&#039;)/g, '<span class="hl-string">$1</span>');

  // Numbers
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>');

  // SQL Keywords
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL',
    'CROSS', 'ON', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CHECK', 'UNIQUE', 'DEFAULT',
    'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'ILIKE',
    'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC',
    'UNION', 'ALL', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'EXISTS', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NOW', 'RETURNING',
    'VARCHAR', 'TEXT', 'INT', 'INTEGER', 'BIGINT', 'BOOLEAN', 'TIMESTAMP',
    'DATE', 'TIME', 'NUMERIC', 'DECIMAL', 'SERIAL', 'JSON', 'JSONB', 'UUID', 'ARRAY'
  ];
  const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
  s = s.replace(kwRegex, (match) => `<span class="hl-keyword">${match.toUpperCase()}</span>`);

  return s;
}

function highlightJavaScript(code) {
  let s = escapeHtml(code);

  // Comments
  s = s.replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>');
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');

  // Strings (", ', `)
  s = s.replace(/(".*?"|'.*?'|`[\s\S]*?`)/g, '<span class="hl-string">$1</span>');

  // Numbers
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>');

  // JS/TS Keywords
  const keywords = [
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
    'let', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try',
    'typeof', 'var', 'void', 'while', 'with', 'yield', 'null', 'undefined',
    'true', 'false', 'type', 'interface', 'as', 'any', 'never', 'unknown',
    'enum', 'implements', 'declare', 'module', 'namespace', 'from', 'of'
  ];
  const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  s = s.replace(kwRegex, '<span class="hl-keyword">$1</span>');

  // Common Global Classes
  s = s.replace(/\b(Promise|Array|Object|String|Number|Boolean|Map|Set|Date|Math|JSON|RegExp|Error|Console|document|window)\b/g, '<span class="hl-type">$1</span>');

  return s;
}

function highlightPython(code) {
  let s = escapeHtml(code);

  // Comments
  s = s.replace(/(#[^\n]*)/g, '<span class="hl-comment">$1</span>');

  // Strings
  s = s.replace(/(".*?"|'.*?'|"""[\s\S]*?"""|'''[\s\S]*?''')/g, '<span class="hl-string">$1</span>');

  // Numbers
  s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>');

  // Python Keywords
  const keywords = [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
    'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
    'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
    'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
  ];
  const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
  s = s.replace(kwRegex, '<span class="hl-keyword">$1</span>');

  return s;
}

function highlightJson(code) {
  let s = escapeHtml(code);
  // Keys
  s = s.replace(/(&quot;.*?&quot;)(\s*:)/g, '<span class="hl-attribute">$1</span>$2');
  // Values: String
  s = s.replace(/(:\s*)(&quot;.*?&quot;)/g, '$1<span class="hl-string">$2</span>');
  // Numbers, Booleans, Null
  s = s.replace(/\b(true|false|null|\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>');
  return s;
}

function highlightCss(code) {
  let s = escapeHtml(code);
  // Comments
  s = s.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');
  // Properties and values
  s = s.replace(/([a-zA-Z0-9_-]+)(\s*:)([^;]+)(;)/g, '<span class="hl-attribute">$1</span>$2<span class="hl-string">$3</span>$4');
  return s;
}

function highlightShell(code) {
  let s = escapeHtml(code);
  // Comments
  s = s.replace(/(#[^\n]*)/g, '<span class="hl-comment">$1</span>');
  // Strings
  s = s.replace(/(".*?"|'.*?')/g, '<span class="hl-string">$1</span>');
  // Common CLI Commands
  s = s.replace(/\b(npm|npx|node|git|docker|python|pip|dotnet|curl|cd|ls|mkdir|rm|echo|cat)\b/g, '<span class="hl-keyword">$1</span>');
  // Flags (-f, --save)
  s = s.replace(/(\s)(--?[a-zA-Z0-9_-]+)/g, '$1<span class="hl-attribute">$2</span>');
  return s;
}

/**
 * Parses markdown text into HTML
 * @param {string} markdownText
 * @returns {string} rendered HTML
 */
export function parseMarkdown(markdownText) {
  if (!markdownText || !markdownText.trim()) {
    return '<div class="markdown-empty-state"><span class="empty-icon">📝</span><p>No notes for this week yet. Use the editor to add thoughts, goals, reflections, and code snippets!</p></div>';
  }

  // Normalize line endings
  let text = markdownText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Placeholder store for code blocks to prevent nested markdown parsing
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_#+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    const highlighted = highlightCode(code, lang);
    const displayLang = lang.trim() || 'code';
    
    // Code block container with copy button
    const html = `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="code-block-lang">${escapeHtml(displayLang)}</span>
          <button type="button" class="code-copy-btn" data-code="${encodeURIComponent(code.trim())}" title="Copy code snippet">
            <span class="copy-icon">📋</span> Copy
          </button>
        </div>
        <pre><code class="language-${escapeHtml(displayLang)}">${highlighted}</code></pre>
      </div>`;
    codeBlocks.push(html);
    return placeholder;
  });

  // Placeholder store for inline code
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code class="inline-code">${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Escape raw HTML outside placeholders
  text = escapeHtml(text);

  // Split lines for block processing
  const lines = text.split('\n');
  const output = [];
  let inList = false;
  let listType = null; // 'ul' | 'ol'
  let inBlockquote = false;
  let inTable = false;
  let tableHeaderParsed = false;

  const closeList = () => {
    if (inList) {
      output.push(`</${listType}>`);
      inList = false;
      listType = null;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      output.push('</blockquote>');
      inBlockquote = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      output.push('</tbody></table></div>');
      inTable = false;
      tableHeaderParsed = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for code block placeholder
    if (trimmed.startsWith('__CODE_BLOCK_') && trimmed.endsWith('__')) {
      closeList();
      closeBlockquote();
      closeTable();
      output.push(trimmed);
      continue;
    }

    // Horizontal Rule
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      closeList();
      closeBlockquote();
      closeTable();
      output.push('<hr class="markdown-hr">');
      continue;
    }

    // Table Row: starts and ends with | or contains |
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      closeList();
      closeBlockquote();
      
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
      
      // Check if this is a divider row: e.g. |---|---| or |:---|---:|
      const isDivider = cells.every(c => /^:?-+:?$/.test(c));
      
      if (isDivider) {
        // Just header separator, skip outputting as data row
        tableHeaderParsed = true;
        continue;
      }

      if (!inTable) {
        inTable = true;
        output.push('<div class="markdown-table-wrapper"><table class="markdown-table"><thead><tr>');
        cells.forEach(cell => {
          output.push(`<th>${formatInline(cell)}</th>`);
        });
        output.push('</tr></thead><tbody>');
      } else {
        output.push('<tr>');
        cells.forEach(cell => {
          output.push(`<td>${formatInline(cell)}</td>`);
        });
        output.push('</tr>');
      }
      continue;
    } else {
      closeTable();
    }

    // Blockquote
    if (line.startsWith('&gt;') || line.startsWith('>')) {
      closeList();
      if (!inBlockquote) {
        inBlockquote = true;
        output.push('<blockquote class="markdown-quote">');
      }
      const quoteText = line.replace(/^(&gt;|>)\s?/, '');
      output.push(`<p>${formatInline(quoteText)}</p>`);
      continue;
    } else {
      closeBlockquote();
    }

    // Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const content = formatInline(headingMatch[2]);
      output.push(`<h${level} class="markdown-h${level}">${content}</h${level}>`);
      continue;
    }

    // Task Checklist: - [ ] or - [x]
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        output.push('<ul class="markdown-task-list">');
      }
      const isChecked = taskMatch[2].toLowerCase() === 'x';
      const taskText = formatInline(taskMatch[3]);
      const checkedAttr = isChecked ? 'checked' : '';
      const doneClass = isChecked ? 'task-done' : '';
      output.push(`<li class="markdown-task-item ${doneClass}"><input type="checkbox" disabled ${checkedAttr} class="task-checkbox"> <span>${taskText}</span></li>`);
      continue;
    }

    // Unordered List (- item or * item)
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        closeList();
        inList = true;
        listType = 'ul';
        output.push('<ul class="markdown-list">');
      }
      output.push(`<li>${formatInline(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered List (1. item)
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList();
        inList = true;
        listType = 'ol';
        output.push('<ol class="markdown-numbered-list">');
      }
      output.push(`<li>${formatInline(olMatch[2])}</li>`);
      continue;
    }

    // Regular line / Paragraph
    closeList();

    if (trimmed.length === 0) {
      // Empty line creates breathing room
      output.push('<div class="markdown-spacer"></div>');
    } else {
      output.push(`<p class="markdown-p">${formatInline(line)}</p>`);
    }
  }

  closeList();
  closeBlockquote();
  closeTable();

  let html = output.join('\n');

  // Restore Code Blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  // Restore Inline Code
  inlineCodes.forEach((codeHtml, idx) => {
    html = html.replace(`__INLINE_CODE_${idx}__`, codeHtml);
  });

  return html;
}

/**
 * Format inline elements: Bold, Italic, Strikethrough, Links
 */
function formatInline(str) {
  if (!str) return '';

  let s = str;

  // Strikethrough ~~text~~
  s = s.replace(/~~(.*?)~~/g, '<del class="markdown-del">$1</del>');

  // Bold **text** or __text__
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic *text* or _text_
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');

  // Links [text](url)
  s = s.replace(/\[(.*?)\]\(((?:https?:\/\/|\/|#)[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>');

  return s;
}
