import { FastifyInstance } from 'fastify';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PublishRequestBody } from '../types';
import { getAccessToken, uploadImage, createDraft, submitPublish } from '../services/wechat';
import { loadImageBuffer } from '../utils/image';

const DEBUG_PUBLISH = process.env.DEBUG_PUBLISH === '1';
const MOCK_WECHAT_PUBLISH = process.env.MOCK_WECHAT_PUBLISH === '1';

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
    return '请求微信接口超时，请稍后重试';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
};

const buildErrorDetails = (error: unknown) => {
  const details: Record<string, unknown> = {
    message: getErrorMessage(error)
  };

  if (error instanceof Error && error.stack) {
    details.stack = error.stack;
  }

  const errorWithCause = error as { cause?: unknown } | null;
  if (errorWithCause && errorWithCause.cause) {
    details.cause = getErrorMessage(errorWithCause.cause);
  }

  if (axios.isAxiosError(error)) {
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

const classifyImageSrc = (src: string) => {
  if (!src) return 'empty';
  if (src.startsWith('data:image/')) return 'data';
  if (src.startsWith('http://')) return 'http';
  if (src.startsWith('https://')) return 'https';
  if (src.startsWith('img://')) return 'img';
  if (src.startsWith('blob:')) return 'blob';
  if (src.startsWith('file:')) return 'file';
  return 'other';
};

const summarizeImageSources = (sources: string[]) => {
  const summary: Record<string, number> = {};
  sources.forEach((src) => {
    const kind = classifyImageSrc(src);
    summary[kind] = (summary[kind] || 0) + 1;
  });
  return summary;
};

const debugLog = (app: FastifyInstance, message: string, meta?: Record<string, unknown>) => {
  if (!DEBUG_PUBLISH) {
    return;
  }
  if (meta) {
    app.log.info(meta, message);
  } else {
    app.log.info(message);
  }
};

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
      debugLog(app, 'publish request received', {
        publishMode,
        titleLength: article.title?.length || 0,
        contentLength: article.content?.length || 0,
        hasCoverImage: Boolean(article.coverImage),
        mockMode: MOCK_WECHAT_PUBLISH
      });

      const accessToken = MOCK_WECHAT_PUBLISH ? '' : await getAccessToken(appId, appSecret);
      const $ = cheerio.load(article.content);
      const images = $('img').toArray();
      let coverMediaId: string | null = null;

      const imageSources = images.map((img) => $(img).attr('src') || '');
      debugLog(app, 'publish html parsed', {
        imageCount: images.length,
        imageKinds: summarizeImageSources(imageSources),
        coverImageKind: article.coverImage ? classifyImageSrc(article.coverImage) : 'none'
      });

      // 如果提供了独立封面图片，优先上传作为封面
      if (article.coverImage) {
        try {
          const { buffer, filename } = await loadImageBuffer(article.coverImage, 0);
          if (MOCK_WECHAT_PUBLISH) {
            coverMediaId = 'mock-cover';
          } else {
            const coverResult = await uploadImage(accessToken, buffer, filename || 'cover.jpg');
            coverMediaId = coverResult.mediaId;
          }
        } catch (e) {
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
        let buffer: Buffer;
        let filename: string;
        try {
          const loaded = await loadImageBuffer(src, index + 1);
          buffer = loaded.buffer;
          filename = loaded.filename;
        } catch (error) {
          throw new Error(`正文第 ${index + 1} 张图片处理失败：${getErrorMessage(error)}`);
        }

        if (MOCK_WECHAT_PUBLISH) {
          if (!coverMediaId) {
            coverMediaId = 'mock-cover';
          }
          continue;
        }

        try {
          const uploadResult = await uploadImage(accessToken, buffer, filename);
          $(img).attr('src', uploadResult.url);
          // 如果没有独立封面，使用正文第一张图作为封面
          if (!coverMediaId) {
            coverMediaId = uploadResult.mediaId;
          }
        } catch (error) {
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
      let draftMediaId: string;
      try {
        draftMediaId = await createDraft(accessToken, {
          title: article.title,
          content: updatedHtml,
          digest: article.digest,
          author: article.author,
          contentSourceUrl: article.contentSourceUrl,
          thumbMediaId: coverMediaId
        });
      } catch (error) {
        throw new Error(`创建草稿失败：${getErrorMessage(error)}`);
      }

      if (publishMode === 'publish') {
        let publishId: string;
        try {
          publishId = await submitPublish(accessToken, draftMediaId);
        } catch (error) {
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
    } catch (error) {
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
