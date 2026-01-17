import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { STYLES } from '../styles/huashengThemes';

let md: MarkdownIt;

// 完全复用 huasheng_editor 的代码块渲染逻辑
md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,  // 禁用 typographer 以避免智能引号干扰加粗标记
    highlight: (str: string, lang: string) => {
        // macOS 风格的窗口装饰
        const dots = '<div style="display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: #2a2c33; border-bottom: 1px solid #1e1f24;"><span style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56;"></span><span style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e;"></span><span style="width: 12px; height: 12px; border-radius: 50%; background: #27c93f;"></span></div>';

        let codeContent = '';
        if (lang && hljs.getLanguage(lang)) {
            try {
                codeContent = hljs.highlight(str, { language: lang }).value;
            } catch {
                codeContent = md.utils.escapeHtml(str);
            }
        } else {
            codeContent = md.utils.escapeHtml(str);
        }

        return `<div style="margin: 20px 0; border-radius: 8px; overflow: hidden; background: #383a42; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">${dots}<div style="padding: 16px; overflow-x: auto; background: #383a42;"><code style="display: block; color: #abb2bf; font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace; font-size: 14px; line-height: 1.6; white-space: pre;">${codeContent}</code></div></div>`;
    }
});

export const renderMarkdown = (markdown: string) => md.render(markdown || '');

// 标题内行内元素样式覆盖
const headingInlineOverrides: Record<string, string> = {
    strong: 'font-weight: 700; color: inherit !important; background-color: transparent !important;',
    em: 'font-style: italic; color: inherit !important; background-color: transparent !important;',
    a: 'color: inherit !important; text-decoration: none !important; border-bottom: 1px solid currentColor !important; background-color: transparent !important;',
    code: 'color: inherit !important; background-color: transparent !important; border: none !important; padding: 0 !important;',
    span: 'color: inherit !important; background-color: transparent !important;',
    b: 'font-weight: 700; color: inherit !important; background-color: transparent !important;',
    i: 'font-style: italic; color: inherit !important; background-color: transparent !important;',
    del: 'color: inherit !important; background-color: transparent !important;',
    mark: 'color: inherit !important; background-color: transparent !important;',
    s: 'color: inherit !important; background-color: transparent !important;',
    u: 'color: inherit !important; text-decoration: underline !important; background-color: transparent !important;',
    ins: 'color: inherit !important; text-decoration: underline !important; background-color: transparent !important;',
    kbd: 'color: inherit !important; background-color: transparent !important; border: none !important; padding: 0 !important;',
    sub: 'color: inherit !important; background-color: transparent !important;',
    sup: 'color: inherit !important; background-color: transparent !important;'
};

const headingInlineSelectorList = Object.keys(headingInlineOverrides).join(', ');

export const applyInlineStyles = (html: string, themeId: string) => {
    const themeKey = (themeId in STYLES ? themeId : 'wechat-default') as keyof typeof STYLES;
    const styleConfig = STYLES[themeKey].styles as Record<string, string>;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    Object.entries(styleConfig).forEach(([selector, styles]) => {
        // 跳过 pre/code（由 highlight 函数处理）和 container
        if (selector === 'pre' || selector === 'code' || selector === 'pre code' || selector === 'container') {
            return;
        }
        const elements = doc.querySelectorAll(selector);
        elements.forEach((el) => {
            const currentStyle = el.getAttribute('style') || '';
            el.setAttribute('style', `${currentStyle}; ${styles}`.trim());
        });
    });

    // 标题内的行内元素统一继承标题颜色，避免各主题样式冲突
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading) => {
        const inlineNodes = heading.querySelectorAll(headingInlineSelectorList);
        inlineNodes.forEach((node) => {
            const tag = node.tagName.toLowerCase();
            const override = headingInlineOverrides[tag];
            if (!override) {
                return;
            }
            const currentStyle = node.getAttribute('style') || '';
            // 清理可能冲突的样式
            const sanitizedStyle = currentStyle
                .replace(/color:\s*[^;]+;?/gi, '')
                .replace(/background(?:-color)?:\s*[^;]+;?/gi, '')
                .replace(/border(?:-bottom)?:\s*[^;]+;?/gi, '')
                .replace(/text-decoration:\s*[^;]+;?/gi, '')
                .replace(/box-shadow:\s*[^;]+;?/gi, '')
                .replace(/padding:\s*[^;]+;?/gi, '')
                .trim();
            node.setAttribute('style', `${sanitizedStyle}; ${override}`.trim());
        });
    });

    const container = doc.createElement('div');
    container.setAttribute('style', styleConfig.container);
    container.innerHTML = doc.body.innerHTML;

    return container.outerHTML;
};

export const buildWeChatHtml = (markdown: string, themeId: string) => {
    const html = renderMarkdown(markdown);
    return applyInlineStyles(html, themeId);
};
