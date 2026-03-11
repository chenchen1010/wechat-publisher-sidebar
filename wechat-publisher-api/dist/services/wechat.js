"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitPublish = exports.createDraft = exports.uploadImage = exports.getAccountBasicInfo = exports.getAccessToken = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const token_1 = require("../utils/token");
const WECHAT_BASE_URL = 'https://api.weixin.qq.com/cgi-bin';
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);
const http = axios_1.default.create({ timeout: HTTP_TIMEOUT_MS });
const ensureWechatSuccess = (data) => {
    if (typeof data?.errcode === 'number' && data.errcode !== 0) {
        const message = data.errmsg || '微信接口调用失败';
        throw new Error(`${message} (errcode ${data.errcode})`);
    }
};
const getAccessToken = async (appId, appSecret) => {
    const cached = (0, token_1.getCachedToken)(appId);
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
    const accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in;
    if (!accessToken || !expiresIn) {
        throw new Error('获取 access_token 失败');
    }
    (0, token_1.setCachedToken)(appId, accessToken, expiresIn);
    return accessToken;
};
exports.getAccessToken = getAccessToken;
const getAccountBasicInfo = async (accessToken) => {
    const response = await http.get(`${WECHAT_BASE_URL}/account/getaccountbasicinfo`, {
        params: { access_token: accessToken }
    });
    ensureWechatSuccess(response.data);
    return response.data;
};
exports.getAccountBasicInfo = getAccountBasicInfo;
const uploadImage = async (accessToken, buffer, filename) => {
    const form = new form_data_1.default();
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        bmp: 'image/bmp'
    };
    const contentType = mimeTypes[ext] || 'image/jpeg';
    form.append('media', buffer, { filename, contentType });
    const response = await http.post(`${WECHAT_BASE_URL}/material/add_material`, form, {
        params: {
            access_token: accessToken,
            type: 'image'
        },
        headers: form.getHeaders()
    });
    ensureWechatSuccess(response.data);
    const mediaId = response.data.media_id;
    const url = response.data.url;
    if (!mediaId || !url) {
        throw new Error('上传图片失败，未返回 media_id 或 url');
    }
    return { mediaId, url };
};
exports.uploadImage = uploadImage;
const createDraft = async (accessToken, article) => {
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
    const mediaId = response.data.media_id;
    if (!mediaId) {
        throw new Error('创建草稿失败，未返回 media_id');
    }
    return mediaId;
};
exports.createDraft = createDraft;
const submitPublish = async (accessToken, mediaId) => {
    const response = await http.post(`${WECHAT_BASE_URL}/freepublish/submit`, { media_id: mediaId }, { params: { access_token: accessToken } });
    ensureWechatSuccess(response.data);
    const publishId = response.data.publish_id;
    if (!publishId) {
        throw new Error('发布失败，未返回 publish_id');
    }
    return publishId;
};
exports.submitPublish = submitPublish;
