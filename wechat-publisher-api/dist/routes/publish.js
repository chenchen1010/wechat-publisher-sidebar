"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = publishRoute;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const wechat_1 = require("../services/wechat");
const image_1 = require("../utils/image");
const DEBUG_PUBLISH = process.env.DEBUG_PUBLISH === '1';
const MOCK_WECHAT_PUBLISH = process.env.MOCK_WECHAT_PUBLISH === '1';
const getErrorMessage = (error) => {
    if (axios_1.default.isAxiosError(error) && error.code === 'ECONNABORTED') {
        return '请求微信接口超时，请稍后重试';
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
};
const buildErrorDetails = (error) => {
    const details = {
        message: getErrorMessage(error)
    };
    if (error instanceof Error && error.stack) {
        details.stack = error.stack;
    }
    const errorWithCause = error;
    if (errorWithCause && errorWithCause.cause) {
        details.cause = getErrorMessage(errorWithCause.cause);
    }
    if (axios_1.default.isAxiosError(error)) {
        details.axios = {
            code: error.code,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url,
            method: error.config?.method
        };
    }
    return details;
};
const classifyImageSrc = (src) => {
    if (!src)
        return 'empty';
    if (src.startsWith('data:image/'))
        return 'data';
    if (src.startsWith('http://'))
        return 'http';
    if (src.startsWith('https://'))
        return 'https';
    if (src.startsWith('img://'))
        return 'img';
    if (src.startsWith('blob:'))
        return 'blob';
    if (src.startsWith('file:'))
        return 'file';
    return 'other';
};
const summarizeImageSources = (sources) => {
    const summary = {};
    sources.forEach((src) => {
        const kind = classifyImageSrc(src);
        summary[kind] = (summary[kind] || 0) + 1;
    });
    return summary;
};
const debugLog = (app, message, meta) => {
    if (!DEBUG_PUBLISH) {
        return;
    }
    if (meta) {
        app.log.info(meta, message);
    }
    else {
        app.log.info(message);
    }
};
async function publishRoute(app) {
    app.post('/api/publish', async (request, reply) => {
        const { appId, appSecret, publishMode = 'draft', article } = request.body || {};
        if (!appId || !appSecret) {
            reply.code(400);
            return {
                success: false,
                error: { code: 'INVALID_PARAMS', message: '缺少 AppID 或 AppSecret' }
            };
        }
        if (!article?.title || !article?.content) {
            reply.code(400);
            return {
                success: false,
                error: { code: 'INVALID_PARAMS', message: '文章标题或内容不能为空' }
            };
        }
        try {
            debugLog(app, 'publish request received', {
                publishMode,
                titleLength: article.title?.length || 0,
                contentLength: article.content?.length || 0,
                hasCoverImage: Boolean(article.coverImage),
                mockMode: MOCK_WECHAT_PUBLISH
            });
            const accessToken = MOCK_WECHAT_PUBLISH ? '' : await (0, wechat_1.getAccessToken)(appId, appSecret);
            const $ = cheerio.load(article.content);
            const images = $('img').toArray();
            let coverMediaId = null;
            const imageSources = images.map((img) => $(img).attr('src') || '');
            debugLog(app, 'publish html parsed', {
                imageCount: images.length,
                imageKinds: summarizeImageSources(imageSources),
                coverImageKind: article.coverImage ? classifyImageSrc(article.coverImage) : 'none'
            });
            // 如果提供了独立封面图片，优先上传作为封面
            if (article.coverImage) {
                try {
                    const { buffer, filename } = await (0, image_1.loadImageBuffer)(article.coverImage, 0);
                    if (MOCK_WECHAT_PUBLISH) {
                        coverMediaId = 'mock-cover';
                    }
                    else {
                        const coverResult = await (0, wechat_1.uploadImage)(accessToken, buffer, filename || 'cover.jpg');
                        coverMediaId = coverResult.mediaId;
                    }
                }
                catch (e) {
                    // 封面上传失败，继续使用正文第一张图
                    app.log.error({ err: buildErrorDetails(e) }, '封面图片上传失败，改用正文首图');
                }
            }
            // 处理正文中的图片
            for (let index = 0; index < images.length; index += 1) {
                const img = images[index];
                const src = $(img).attr('src');
                if (!src) {
                    continue;
                }
                let buffer;
                let filename;
                try {
                    const loaded = await (0, image_1.loadImageBuffer)(src, index + 1);
                    buffer = loaded.buffer;
                    filename = loaded.filename;
                }
                catch (error) {
                    throw new Error(`正文第 ${index + 1} 张图片处理失败：${getErrorMessage(error)}`);
                }
                if (MOCK_WECHAT_PUBLISH) {
                    if (!coverMediaId) {
                        coverMediaId = 'mock-cover';
                    }
                    continue;
                }
                try {
                    const uploadResult = await (0, wechat_1.uploadImage)(accessToken, buffer, filename);
                    $(img).attr('src', uploadResult.url);
                    // 如果没有独立封面，使用正文第一张图作为封面
                    if (!coverMediaId) {
                        coverMediaId = uploadResult.mediaId;
                    }
                }
                catch (error) {
                    throw new Error(`正文第 ${index + 1} 张图片上传失败：${getErrorMessage(error)}`);
                }
            }
            if (!coverMediaId) {
                reply.code(400);
                return {
                    success: false,
                    error: {
                        code: 'MISSING_COVER',
                        message: '正文没有图片且未提供封面图，请插入至少一张图片或上传封面'
                    }
                };
            }
            if (MOCK_WECHAT_PUBLISH) {
                return {
                    success: true,
                    data: {
                        mode: publishMode,
                        draftMediaId: publishMode === 'draft' ? `mock_draft_${Date.now()}` : undefined,
                        publishId: publishMode === 'publish' ? `mock_publish_${Date.now()}` : undefined,
                        publishTime: new Date().toISOString()
                    }
                };
            }
            const updatedHtml = $.root().html() || '';
            let draftMediaId;
            try {
                draftMediaId = await (0, wechat_1.createDraft)(accessToken, {
                    title: article.title,
                    content: updatedHtml,
                    digest: article.digest,
                    author: article.author,
                    contentSourceUrl: article.contentSourceUrl,
                    thumbMediaId: coverMediaId
                });
            }
            catch (error) {
                throw new Error(`创建草稿失败：${getErrorMessage(error)}`);
            }
            if (publishMode === 'publish') {
                let publishId;
                try {
                    publishId = await (0, wechat_1.submitPublish)(accessToken, draftMediaId);
                }
                catch (error) {
                    throw new Error(`提交发布失败：${getErrorMessage(error)}`);
                }
                return {
                    success: true,
                    data: {
                        mode: 'publish',
                        publishId,
                        publishTime: new Date().toISOString()
                    }
                };
            }
            return {
                success: true,
                data: {
                    mode: 'draft',
                    draftMediaId,
                    publishTime: new Date().toISOString()
                }
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '发布失败';
            const details = buildErrorDetails(error);
            debugLog(app, 'publish failed', details);
            reply.code(500);
            return {
                success: false,
                error: {
                    code: 'PUBLISH_FAILED',
                    message,
                    ...(DEBUG_PUBLISH ? { details } : {})
                }
            };
        }
    });
}
