import { STYLES } from '../styles/huashengThemes';
import type { ThemeId } from '../styles/huashengThemes';

type ImageStoreLike = {
    getImageBlob: (imageId: string) => Promise<Blob | null>;
};

const toDataUrl = (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = (error) => reject(new Error(`FileReader failed: ${String(error)}`));
        reader.readAsDataURL(blob);
    });
};

const getImageStore = () => {
    const store = (globalThis as { imageStore?: ImageStoreLike }).imageStore;
    if (store && typeof store.getImageBlob === 'function') {
        return store;
    }
    return null;
};

const extractBackgroundColor = (styleString: string) => {
    if (!styleString) {
        return null;
    }
    const bgColorMatch = styleString.match(/background-color:\s*([^;]+)/);
    if (bgColorMatch) {
        return bgColorMatch[1].trim();
    }

    const bgMatch = styleString.match(/background:\s*([#rgb][^;]+)/);
    if (bgMatch) {
        const bgValue = bgMatch[1].trim();
        if (bgValue.startsWith('#') || bgValue.startsWith('rgb')) {
            return bgValue;
        }
    }
    return null;
};

const convertToTable = (doc: Document, grid: Element, columns: number) => {
    const imgWrappers = Array.from(grid.children);
    const table = doc.createElement('table');
    table.setAttribute('style', `
        width: 100% !important;
        border-collapse: collapse !important;
        margin: 20px auto !important;
        table-layout: fixed !important;
        border: none !important;
        background: transparent !important;
    `.trim());

    const rows = Math.ceil(imgWrappers.length / columns);
    for (let i = 0; i < rows; i += 1) {
        const tr = doc.createElement('tr');

        for (let j = 0; j < columns; j += 1) {
            const index = i * columns + j;
            const td = doc.createElement('td');

            td.setAttribute('style', `
                padding: 4px !important;
                vertical-align: top !important;
                width: ${100 / columns}% !important;
                border: none !important;
                background: transparent !important;
            `.trim());

            if (index < imgWrappers.length) {
                const imgWrapper = imgWrappers[index];
                const img = imgWrapper.querySelector('img');

                if (img) {
                    let imgMaxHeight;
                    let containerHeight;
                    if (columns === 2) {
                        imgMaxHeight = '340px';
                        containerHeight = '360px';
                    } else if (columns === 3) {
                        imgMaxHeight = '340px';
                        containerHeight = '360px';
                    } else {
                        imgMaxHeight = '340px';
                        containerHeight = '360px';
                    }

                    const wrapper = doc.createElement('div');
                    wrapper.setAttribute('style', `
                        width: 100% !important;
                        height: ${containerHeight} !important;
                        text-align: center !important;
                        background-color: #f5f5f5 !important;
                        border-radius: 4px !important;
                        padding: 10px !important;
                        box-sizing: border-box !important;
                        overflow: hidden !important;
                        display: table !important;
                    `.trim());

                    const innerWrapper = doc.createElement('div');
                    innerWrapper.setAttribute('style', `
                        display: table-cell !important;
                        vertical-align: middle !important;
                        text-align: center !important;
                    `.trim());

                    const newImg = img.cloneNode(true) as HTMLElement;
                    newImg.setAttribute('style', `
                        max-width: calc(100% - 20px) !important;
                        max-height: ${imgMaxHeight} !important;
                        width: auto !important;
                        height: auto !important;
                        display: inline-block !important;
                        margin: 0 auto !important;
                        border-radius: 4px !important;
                        object-fit: contain !important;
                    `.trim());

                    innerWrapper.appendChild(newImg);
                    wrapper.appendChild(innerWrapper);
                    td.appendChild(wrapper);
                }
            }

            tr.appendChild(td);
        }

        table.appendChild(tr);
    }

    grid.parentNode?.replaceChild(table, grid);
};

const convertGridToTable = (doc: Document) => {
    const imageGrids = doc.querySelectorAll('.image-grid');
    imageGrids.forEach((grid) => {
        const columns = parseInt(grid.getAttribute('data-columns') || '', 10) || 2;
        convertToTable(doc, grid, columns);
    });
};

const convertImageToBase64 = async (imgElement: HTMLImageElement, imageStore?: ImageStoreLike | null) => {
    const src = imgElement.getAttribute('src') || '';

    if (!src) {
        throw new Error('图片地址为空');
    }

    if (src.startsWith('data:')) {
        return src;
    }

    const imageId = imgElement.getAttribute('data-image-id');
    if (imageId && imageStore) {
        try {
            const blob = await imageStore.getImageBlob(imageId);

            if (blob) {
                return toDataUrl(blob);
            }
            console.warn(`图片 Blob 不存在: ${imageId}`);
        } catch (error) {
            console.error(`从 IndexedDB 读取图片失败 (${imageId}):`, error);
        }
    }

    try {
        const response = await fetch(src, {
            mode: 'cors',
            cache: 'default'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();

        return toDataUrl(blob);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`图片加载失败 (${src}): ${message}`);
    }
};

const flattenListItems = (doc: Document) => {
    const listItems = doc.querySelectorAll('li');
    listItems.forEach((li) => {
        let text = li.textContent || li.innerText || '';
        text = text.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
        const currentStyle = li.getAttribute('style') || '';
        li.innerHTML = '';
        li.textContent = text;
        li.setAttribute('style', currentStyle);
    });
};

const simplifyCodeBlocks = (doc: Document) => {
    const codeBlocks = doc.querySelectorAll('div[style*="border-radius: 8px"]');
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector('code');
        if (codeElement) {
            const codeText = codeElement.textContent || codeElement.innerText || '';
            const pre = doc.createElement('pre');
            const code = doc.createElement('code');
            pre.setAttribute('style', [
                'background: linear-gradient(to bottom, #2a2c33 0%, #383a42 8px, #383a42 100%)',
                'padding: 0',
                'border-radius: 6px',
                'overflow: hidden',
                'margin: 24px 0',
                'box-shadow: 0 2px 8px rgba(0,0,0,0.15)'
            ].join('; '));
            code.setAttribute('style', [
                'color: #abb2bf',
                'font-family: "SF Mono", Consolas, Monaco, "Courier New", monospace',
                'font-size: 14px',
                'line-height: 1.7',
                'display: block',
                'white-space: pre',
                'padding: 16px 20px',
                '-webkit-font-smoothing: antialiased',
                '-moz-osx-font-smoothing: grayscale'
            ].join('; '));
            code.textContent = codeText;
            pre.appendChild(code);
            block.parentNode?.replaceChild(pre, block);
        }
    });
};

const adjustBlockquotes = (doc: Document) => {
    const blockquotes = doc.querySelectorAll('blockquote');
    blockquotes.forEach((blockquote) => {
        const currentStyle = blockquote.getAttribute('style') || '';
        let newStyle = currentStyle
            .replace(/background(?:-color)?:\s*[^;]+;?/gi, '')
            .replace(/color:\s*[^;]+;?/gi, '');
        newStyle += '; background: rgba(0, 0, 0, 0.05) !important';
        newStyle += '; color: rgba(0, 0, 0, 0.8) !important';
        newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
        blockquote.setAttribute('style', newStyle);
    });
};

const wrapSectionIfNeeded = (doc: Document, themeId: string) => {
    const themeKey = (themeId in STYLES ? themeId : 'wechat-default') as ThemeId;
    const styleConfig = STYLES[themeKey].styles as Record<string, string>;
    const containerBg = extractBackgroundColor(styleConfig.container);

    if (!containerBg || containerBg === '#fff' || containerBg === '#ffffff') {
        return;
    }

    const section = doc.createElement('section');
    const containerStyle = styleConfig.container;
    const paddingMatch = containerStyle.match(/padding:\s*([^;]+)/);
    const maxWidthMatch = containerStyle.match(/max-width:\s*([^;]+)/);
    const padding = paddingMatch ? paddingMatch[1].trim() : '40px 20px';
    const maxWidth = maxWidthMatch ? maxWidthMatch[1].trim() : '100%';

    section.setAttribute('style',
        `background-color: ${containerBg}; ` +
        `padding: ${padding}; ` +
        `max-width: ${maxWidth}; ` +
        `margin: 0 auto; ` +
        `box-sizing: border-box; ` +
        `word-wrap: break-word;`
    );

    while (doc.body.firstChild) {
        section.appendChild(doc.body.firstChild);
    }

    const allElements = section.querySelectorAll('*');
    allElements.forEach((el) => {
        const currentStyle = el.getAttribute('style') || '';
        let newStyle = currentStyle;
        newStyle = newStyle.replace(/max-width:\s*[^;]+;?/g, '');
        newStyle = newStyle.replace(/margin:\s*0\s+auto;?/g, '');
        if (newStyle.includes(`background-color: ${containerBg}`)) {
            newStyle = newStyle.replace(new RegExp(`background-color:\\s*${containerBg.replace(/[()]/g, '\\$&')};?`, 'g'), '');
        }
        newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
        if (newStyle) {
            el.setAttribute('style', newStyle);
        } else {
            el.removeAttribute('style');
        }
    });

    doc.body.appendChild(section);
};

const copyWithExecCommand = (html: string): boolean => {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.setAttribute('contenteditable', 'true');
    document.body.appendChild(container);

    const range = document.createRange();
    range.selectNodeContents(container);
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    let success = false;
    try {
        success = document.execCommand('copy');
    } catch {
        success = false;
    }

    if (selection) {
        selection.removeAllRanges();
    }
    document.body.removeChild(container);

    return success;
};

const copyWithClipboardAPI = async (html: string, plainText: string) => {
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });

    const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
    });

    await navigator.clipboard.write([clipboardItem]);
};

// 导出处理后的 HTML 供手动复制弹窗使用
export const prepareHtmlForCopy = async (html: string, themeId: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    convertGridToTable(doc);

    const images = doc.querySelectorAll('img');
    let successCount = 0;
    let failCount = 0;
    const imageStore = getImageStore();
    if (images.length > 0) {
        await Promise.all(Array.from(images).map(async (img) => {
            try {
                const base64 = await convertImageToBase64(img as HTMLImageElement, imageStore);
                img.setAttribute('src', base64);
                successCount += 1;
            } catch (error) {
                console.error('图片转换失败:', img.getAttribute('src'), error);
                failCount += 1;
            }
        }));
    }

    wrapSectionIfNeeded(doc, themeId);
    simplifyCodeBlocks(doc);
    flattenListItems(doc);
    adjustBlockquotes(doc);

    return {
        html: doc.body.innerHTML,
        plainText: doc.body.textContent || '',
        imageTotal: images.length,
        successCount,
        failCount
    };
};

export const copyHtmlToClipboard = async (html: string, themeId: string) => {
    const prepared = await prepareHtmlForCopy(html, themeId);
    const { html: simplifiedHTML, plainText, imageTotal, successCount, failCount } = prepared;

    let copied = false;
    let needManualCopy = false;

    // 方法1: 尝试 Clipboard API（支持富文本）
    if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
        try {
            await copyWithClipboardAPI(simplifiedHTML, plainText);
            copied = true;
        } catch (error) {
            console.warn('Clipboard API 失败:', error);
        }
    }

    // 方法2: 尝试 execCommand（部分浏览器支持富文本复制）
    if (!copied) {
        try {
            copied = copyWithExecCommand(simplifiedHTML);
        } catch (error) {
            console.warn('execCommand 失败:', error);
        }
    }

    // 方法3: 都失败了，返回 HTML 让用户手动复制
    if (!copied) {
        needManualCopy = true;
    }

    return { imageTotal, successCount, failCount, copied, needManualCopy, html: simplifiedHTML };
};
