import axios from 'axios';
import FormData from 'form-data';
import { getCachedToken, setCachedToken } from '../utils/token';

const WECHAT_BASE_URL = 'https://api.weixin.qq.com/cgi-bin';
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);
const http = axios.create({ timeout: HTTP_TIMEOUT_MS });

const ensureWechatSuccess = (data: any) => {
  if (typeof data?.errcode === 'number' && data.errcode !== 0) {
    const message = data.errmsg || '微信接口调用失败';
    throw new Error(`${message} (errcode ${data.errcode})`);
  }
};

export const getAccessToken = async (appId: string, appSecret: string) => {
  const cached = getCachedToken(appId);
  if (cached) {
    return cached;
  }

  const response = await http.get(`${WECHAT_BASE_URL}/token`, {
    params: {
      grant_type: 'client_credential',
      appid: appId,
      secret: appSecret
    }
  });

  ensureWechatSuccess(response.data);

  const accessToken = response.data.access_token as string | undefined;
  const expiresIn = response.data.expires_in as number | undefined;

  if (!accessToken || !expiresIn) {
    throw new Error('获取 access_token 失败');
  }

  setCachedToken(appId, accessToken, expiresIn);
  return accessToken;
};

export const getAccountBasicInfo = async (accessToken: string) => {
  const response = await http.get(`${WECHAT_BASE_URL}/account/getaccountbasicinfo`, {
    params: { access_token: accessToken }
  });
  ensureWechatSuccess(response.data);
  return response.data as { nickname?: string };
};

export const uploadImage = async (accessToken: string, buffer: Buffer, filename: string) => {
  const form = new FormData();
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp'
  };
  const contentType = mimeTypes[ext] || 'image/jpeg';
  form.append('media', buffer, { filename, contentType });

  const response = await http.post(
    `${WECHAT_BASE_URL}/material/add_material`,
    form,
    {
      params: {
        access_token: accessToken,
        type: 'image'
      },
      headers: form.getHeaders()
    }
  );

  ensureWechatSuccess(response.data);

  const mediaId = response.data.media_id as string | undefined;
  const url = response.data.url as string | undefined;

  if (!mediaId || !url) {
    throw new Error('上传图片失败，未返回 media_id 或 url');
  }

  return { mediaId, url };
};

interface DraftArticlePayload {
  title: string;
  content: string;
  digest?: string;
  author?: string;
  contentSourceUrl?: string;
  thumbMediaId: string;
}

export const createDraft = async (accessToken: string, article: DraftArticlePayload) => {
  const payload = {
    articles: [
      {
        title: article.title,
        author: article.author || '',
        digest: article.digest || '',
        content: article.content,
        content_source_url: article.contentSourceUrl || '',
        thumb_media_id: article.thumbMediaId,
        need_open_comment: 0,
        only_fans_can_comment: 0
      }
    ]
  };

  const response = await http.post(`${WECHAT_BASE_URL}/draft/add`, payload, {
    params: { access_token: accessToken }
  });

  ensureWechatSuccess(response.data);

  const mediaId = response.data.media_id as string | undefined;
  if (!mediaId) {
    throw new Error('创建草稿失败，未返回 media_id');
  }

  return mediaId;
};

export const submitPublish = async (accessToken: string, mediaId: string) => {
  const response = await http.post(`${WECHAT_BASE_URL}/freepublish/submit`,
    { media_id: mediaId },
    { params: { access_token: accessToken } }
  );

  ensureWechatSuccess(response.data);

  const publishId = response.data.publish_id as string | undefined;
  if (!publishId) {
    throw new Error('发布失败，未返回 publish_id');
  }

  return publishId;
};
