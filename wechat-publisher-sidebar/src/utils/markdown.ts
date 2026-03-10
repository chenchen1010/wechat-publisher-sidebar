import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { STYLES } from '../styles/huashengThemes';
import imageStore from './imageStore';

// 缓存 Object URL 避免重复创建（与 huasheng_editor 相同的方式）
// key: imageId, value: objectUrl
const imageIdToObjectURL: Record<string, string> = {};
const MISSING_IMAGE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCBmaWxsPSIjZGRkIiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIvPjx0ZXh0IGZpbGw9IiM5OTkiIHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5Zu+54mH5Lii5aSxPC90ZXh0Pjwvc3ZnPg==';

const blobToDataUrl = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(blob);
    });
};

// 处理 HTML 中的 img:// 协议（从 IndexedDB 加载图片）
// 照搬 huasheng_editor/app.js 的 processImageProtocol 方法
const processImageProtocolInHtml = async (html: string): Promise<string> => {
    // 使用 DOMParser 解析 HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 查找所有 img 标签
    const images = doc.querySelectorAll('img');

    // 处理每个图片
    for (const img of images) {
        const src = img.getAttribute('src');

        // 检查是否是 img:// 协议
        if (src && src.startsWith('img://')) {
            // 提取图片 ID
            const imageId = src.replace('img://', '');

            try {
                // 从缓存或 IndexedDB 获取图片
                let objectURL = imageIdToObjectURL[imageId];

                if (!objectURL) {
                    // 如果还没有创建 Object URL，现在创建
                    const url = await imageStore.getImage(imageId);

                    if (url) {
                        objectURL = url;
                        // 缓存 Object URL
                        imageIdToObjectURL[imageId] = objectURL;
                    } else {
                        console.warn(`图片不存在: ${imageId}`);
                        // 图片不存在，显示占位符
                        img.setAttribute('src', 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E图片丢失%3C/text%3E%3C/svg%3E');
                        continue;
                    }
                }

                // 替换 src 为 Object URL
                img.setAttribute('src', objectURL);

                // 添加 data-image-id 属性（用于复制时识别）
                img.setAttribute('data-image-id', imageId);
            } catch (error) {
                console.error(`加载图片失败 (${imageId}):`, error);
                // 显示错误占位符
                img.setAttribute('src', 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23fee" width="200" height="200"/%3E%3Ctext fill="%23c00" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E加载失败%3C/text%3E%3C/svg%3E');
            }
        }
    }

    return doc.body.innerHTML;
};

const processImageProtocolInHtmlForPublish = async (html: string): Promise<{ html: string; missingImageIds: string[] }> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const images = doc.querySelectorAll('img');
    const missingImageIds = new Set<string>();

    for (const img of images) {
        const src = img.getAttribute('src');

        if (!src || !src.startsWith('img://')) {
            continue;
        }

        const imageId = src.replace('img://', '');

        try {
            const blob = await imageStore.getImageBlob(imageId);
            if (!blob) {
                missingImageIds.add(imageId);
                img.setAttribute('src', MISSING_IMAGE_PLACEHOLDER);
                continue;
            }
            const dataUrl = await blobToDataUrl(blob);
            img.setAttribute('src', dataUrl);
            img.setAttribute('data-image-id', imageId);
        } catch (error) {
            console.error(`加载图片失败 (${imageId}):`, error);
            missingImageIds.add(imageId);
            img.setAttribute('src', MISSING_IMAGE_PLACEHOLDER);
        }
    }

    return { html: doc.body.innerHTML, missingImageIds: Array.from(missingImageIds) };
};

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

// 将连续图片组合成网格布局
const groupConsecutiveImages = (doc: Document) => {
    const body = doc.body;
    const children = Array.from(body.children);

    interface ImageItem {
        element: Element;
        img: HTMLImageElement;
        index: number;
        inSameParagraph: boolean;
        paragraphImageCount: number;
    }

    const imagesToProcess: ImageItem[] = [];

    // 找出所有图片元素
    children.forEach((child, index) => {
        if (child.tagName === 'P') {
            const images = child.querySelectorAll('img');
            if (images.length > 0) {
                if (images.length > 1) {
                    // 多个图片在同一个P标签内
                    const group = Array.from(images).map(img => ({
                        element: child,
                        img: img as HTMLImageElement,
                        index: index,
                        inSameParagraph: true,
                        paragraphImageCount: images.length
                    }));
                    imagesToProcess.push(...group);
                } else {
                    // 单个图片在P标签内
                    imagesToProcess.push({
                        element: child,
                        img: images[0] as HTMLImageElement,
                        index: index,
                        inSameParagraph: false,
                        paragraphImageCount: 1
                    });
                }
            }
        } else if (child.tagName === 'IMG') {
            imagesToProcess.push({
                element: child,
                img: child as HTMLImageElement,
                index: index,
                inSameParagraph: false,
                paragraphImageCount: 1
            });
        }
    });

    // 分组逻辑
    const groups: ImageItem[][] = [];
    let currentGroup: ImageItem[] = [];

    imagesToProcess.forEach((item, i) => {
        if (i === 0) {
            currentGroup.push(item);
        } else {
            const prevItem = imagesToProcess[i - 1];
            let isContinuous = false;

            if (item.index === prevItem.index) {
                isContinuous = true;
            } else if (item.index - prevItem.index === 1) {
                isContinuous = true;
            }

            if (isContinuous) {
                currentGroup.push(item);
            } else {
                if (currentGroup.length > 0) {
                    groups.push([...currentGroup]);
                }
                currentGroup = [item];
            }
        }
    });

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    // 对每组图片进行处理
    groups.forEach(group => {
        if (group.length < 2) return;

        const imageCount = group.length;
        const firstElement = group[0].element;

        const gridContainer = doc.createElement('div');
        gridContainer.setAttribute('class', 'image-grid');
        gridContainer.setAttribute('data-image-count', String(imageCount));

        let gridStyle = '';
        let columns = 2;

        if (imageCount === 2) {
            gridStyle = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;';
            columns = 2;
        } else if (imageCount === 3) {
            gridStyle = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;';
            columns = 3;
        } else if (imageCount === 4) {
            gridStyle = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;';
            columns = 2;
        } else {
            gridStyle = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 20px auto; max-width: 100%; align-items: start;';
            columns = 3;
        }

        gridContainer.setAttribute('style', gridStyle);
        gridContainer.setAttribute('data-columns', String(columns));

        group.forEach((item) => {
            const imgWrapper = doc.createElement('div');
            imgWrapper.setAttribute('style', 'width: 100%; height: auto; overflow: hidden;');

            const img = item.img.cloneNode(true) as HTMLImageElement;
            img.setAttribute('style', 'width: 100%; height: auto; display: block; border-radius: 8px;');

            imgWrapper.appendChild(img);
            gridContainer.appendChild(imgWrapper);
        });

        firstElement.parentNode?.insertBefore(gridContainer, firstElement);

        const elementsToRemove = new Set<Element>();
        group.forEach(item => {
            elementsToRemove.add(item.element);
        });
        elementsToRemove.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
    });
};

export const applyInlineStyles = (html: string, themeId: string) => {
    const themeKey = (themeId in STYLES ? themeId : 'wechat-default') as keyof typeof STYLES;
    const styleConfig = STYLES[themeKey].styles as Record<string, string>;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 处理连续图片，组合成网格布局
    groupConsecutiveImages(doc);

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

// 同步版本（用于不需要处理 img:// 的场景）
export const buildWeChatHtml = (markdown: string, themeId: string) => {
    const html = renderMarkdown(markdown);
    return applyInlineStyles(html, themeId);
};

// 异步版本（处理 img:// 协议）
// 照搬 huasheng_editor 的方式：先渲染 HTML，再处理 img:// 协议
export const buildWeChatHtmlAsync = async (markdown: string, themeId: string) => {
    const html = renderMarkdown(markdown);
    const styledHtml = applyInlineStyles(html, themeId);
    // 处理 img:// 协议，替换为 Object URL 并添加 data-image-id 属性
    return processImageProtocolInHtml(styledHtml);
};

// 发布用：将 img:// 图片转为 base64，便于服务端上传
export const buildWeChatHtmlForPublish = async (markdown: string, themeId: string) => {
    const html = renderMarkdown(markdown);
    const styledHtml = applyInlineStyles(html, themeId);
    return processImageProtocolInHtmlForPublish(styledHtml);
};
