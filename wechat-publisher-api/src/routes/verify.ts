import { FastifyInstance } from 'fastify';
import { getAccessToken, getAccountBasicInfo } from '../services/wechat';
import { VerifyRequestBody } from '../types';

export default async function verifyRoute(app: FastifyInstance) {
  app.post<{ Body: VerifyRequestBody }>('/api/verify', async (request, reply) => {
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
      const accessToken = await getAccessToken(appId, appSecret);
      let accountName = '';
      try {
        const info = await getAccountBasicInfo(accessToken);
        accountName = info.nickname || '';
      } catch {
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
    } catch (error) {
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
