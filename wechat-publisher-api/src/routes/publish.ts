import { FastifyInstance } from 'fastify';
import * as cheerio from 'cheerio';
import { PublishRequestBody } from '../types';
import { getAccessToken, uploadImage, createDraft, submitPublish } from '../services/wechat';
import { loadImageBuffer } from '../utils/image';

export default async function publishRoute(app: FastifyInstance) {
  app.post<{ Body: PublishRequestBody }>('/api/publish', async (request, reply) => {
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
      const accessToken = await getAccessToken(appId, appSecret);
      const $ = cheerio.load(article.content);
      const images = $('img').toArray();
      let coverMediaId: string | null = null;

      // 如果提供了独立封面图片，优先上传作为封面
      if (article.coverImage) {
        try {
          const { buffer, filename } = await loadImageBuffer(article.coverImage, 0);
          const coverResult = await uploadImage(accessToken, buffer, filename || 'cover.jpg');
          coverMediaId = coverResult.mediaId;
        } catch (e) {
          // 封面上传失败，继续使用正文第一张图
          console.error('封面图片上传失败:', e);
        }
      }

      // 处理正文中的图片
      for (let index = 0; index < images.length; index += 1) {
        const img = images[index];
        const src = $(img).attr('src');
        if (!src) {
          continue;
        }
        const { buffer, filename } = await loadImageBuffer(src, index + 1);
        const uploadResult = await uploadImage(accessToken, buffer, filename);
        $(img).attr('src', uploadResult.url);
        // 如果没有独立封面，使用正文第一张图作为封面
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
            message: '正文没有图片且未提供封面图，请插入至少一张图片或上传封面'
          }
        };
      }

      const updatedHtml = $.root().html() || '';
      const draftMediaId = await createDraft(accessToken, {
        title: article.title,
        content: updatedHtml,
        digest: article.digest,
        author: article.author,
        contentSourceUrl: article.contentSourceUrl,
        thumbMediaId: coverMediaId
      });

      if (publishMode === 'publish') {
        const publishId = await submitPublish(accessToken, draftMediaId);
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
    } catch (error) {
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
