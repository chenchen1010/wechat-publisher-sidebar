import { FastifyInstance } from 'fastify';
import { UploadImageRequestBody } from '../types';
import { getAccessToken, uploadImage } from '../services/wechat';
import { parseUploadPayload } from '../utils/image';

export default async function uploadRoute(app: FastifyInstance) {
  app.post<{ Body: UploadImageRequestBody }>('/api/upload-image', async (request, reply) => {
    const { appId, appSecret, image, filename } = request.body || {};

    if (!appId || !appSecret || !image) {
      reply.code(400);
      return {
        success: false,
        error: { code: 'INVALID_PARAMS', message: '缺少必要参数' }
      };
    }

    try {
      const { buffer, filename: safeName } = parseUploadPayload(image, filename);
      const accessToken = await getAccessToken(appId, appSecret);
      const uploadResult = await uploadImage(accessToken, buffer, safeName);

      return {
        success: true,
        data: {
          mediaId: uploadResult.mediaId,
          url: uploadResult.url
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败';
      reply.code(500);
      return {
        success: false,
        error: { code: 'UPLOAD_FAILED', message }
      };
    }
  });
}
