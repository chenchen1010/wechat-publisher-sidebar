export type PublishMode = 'draft' | 'publish';

export interface VerifyRequestBody {
  appId: string;
  appSecret: string;
}

export interface PublishRequestBody {
  appId: string;
  appSecret: string;
  publishMode?: PublishMode;
  article: {
    title: string;
    content: string;
    digest?: string;
    author?: string;
    contentSourceUrl?: string;
  };
}

export interface UploadImageRequestBody {
  appId: string;
  appSecret: string;
  image: string;
  filename?: string;
}

export interface WechatApiError {
  errcode?: number;
  errmsg?: string;
}
