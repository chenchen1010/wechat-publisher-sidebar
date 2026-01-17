"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uploadRoute;
const wechat_1 = require("../services/wechat");
const image_1 = require("../utils/image");
async function uploadRoute(app) {
    app.post('/api/upload-image', async (request, reply) => {
        const { appId, appSecret, image, filename } = request.body || {};
        if (!appId || !appSecret || !image) {
            reply.code(400);
            return {
                success: false,
                error: { code: 'INVALID_PARAMS', message: '缺少必要参数' }
            };
        }
        try {
            const { buffer, filename: safeName } = (0, image_1.parseUploadPayload)(image, filename);
            const accessToken = await (0, wechat_1.getAccessToken)(appId, appSecret);
            const uploadResult = await (0, wechat_1.uploadImage)(accessToken, buffer, safeName);
            return {
                success: true,
                data: {
                    mediaId: uploadResult.mediaId,
                    url: uploadResult.url
                }
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '上传失败';
            reply.code(500);
            return {
                success: false,
                error: { code: 'UPLOAD_FAILED', message }
            };
        }
    });
}
