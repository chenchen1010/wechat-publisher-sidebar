"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = verifyRoute;
const wechat_1 = require("../services/wechat");
async function verifyRoute(app) {
    app.post('/api/verify', async (request, reply) => {
        const { appId, appSecret } = request.body || {};
        if (!appId || !appSecret) {
            reply.code(400);
            return {
                success: false,
                error: {
                    code: 'INVALID_PARAMS',
                    message: '请填写 AppID 和 AppSecret'
                }
            };
        }
        try {
            const accessToken = await (0, wechat_1.getAccessToken)(appId, appSecret);
            let accountName = '';
            try {
                const info = await (0, wechat_1.getAccountBasicInfo)(accessToken);
                accountName = info.nickname || '';
            }
            catch {
                accountName = '';
            }
            return {
                success: true,
                data: {
                    verified: true,
                    accountName,
                    accessTokenExpires: 7200
                }
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '验证失败';
            reply.code(400);
            return {
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message
                }
            };
        }
    });
}
