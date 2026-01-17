"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = publishRoute;
const cheerio_1 = __importDefault(require("cheerio"));
const wechat_1 = require("../services/wechat");
const image_1 = require("../utils/image");
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
            const accessToken = await (0, wechat_1.getAccessToken)(appId, appSecret);
            const $ = cheerio_1.default.load(article.content);
            const images = $('img').toArray();
            let coverMediaId = null;
            for (let index = 0; index < images.length; index += 1) {
                const img = images[index];
                const src = $(img).attr('src');
                if (!src) {
                    continue;
                }
                const { buffer, filename } = await (0, image_1.loadImageBuffer)(src, index + 1);
                const uploadResult = await (0, wechat_1.uploadImage)(accessToken, buffer, filename);
                $(img).attr('src', uploadResult.url);
                if (!coverMediaId) {
                    coverMediaId = uploadResult.mediaId;
                }
            }
            if (!coverMediaId) {
                reply.code(400);
                return {
                    success: false,
                    error: {
                        code: 'MISSING_COVER',
                        message: '正文没有图片，无法自动生成封面，请先插入至少一张图片'
                    }
                };
            }
            const updatedHtml = $.root().html() || '';
            const draftMediaId = await (0, wechat_1.createDraft)(accessToken, {
                title: article.title,
                content: updatedHtml,
                digest: article.digest,
                author: article.author,
                contentSourceUrl: article.contentSourceUrl,
                thumbMediaId: coverMediaId
            });
            if (publishMode === 'publish') {
                const publishId = await (0, wechat_1.submitPublish)(accessToken, draftMediaId);
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
            reply.code(500);
            return {
                success: false,
                error: {
                    code: 'PUBLISH_FAILED',
                    message
                }
            };
        }
    });
}
