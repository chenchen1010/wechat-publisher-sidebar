const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const DEBUG_PUBLISH = import.meta.env.VITE_DEBUG_PUBLISH === '1';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code?: string;
        message?: string;
        details?: unknown;
    };
}

const postJson = async <T>(path: string, payload: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    let data: ApiResponse<T> | null = null;
    try {
        data = (await response.json()) as ApiResponse<T>;
    } catch {
        data = null;
    }

    if (!response.ok || !data?.success) {
        const message = data?.error?.message || `请求失败 (${response.status})`;
        const error = new Error(message) as Error & { details?: unknown; status?: number };
        error.details = data?.error?.details;
        error.status = response.status;
        if (DEBUG_PUBLISH) {
            console.error('[api] request failed', {
                path,
                status: response.status,
                message,
                details: data?.error?.details
            });
        }
        throw error;
    }

    return data.data as T;
};

export const verifyApiConfig = async (appId: string, appSecret: string) => {
    return postJson<{ verified: boolean; accountName?: string; accessTokenExpires?: number }>(
        '/api/verify',
        { appId, appSecret }
    );
};

export interface PublishArticlePayload {
    appId: string;
    appSecret: string;
    publishMode: 'draft' | 'publish';
    article: {
        title: string;
        content: string;
        digest?: string;
        author?: string;
        contentSourceUrl?: string;
        coverImage?: string; // base64 或 URL
    };
}

export interface PublishResult {
    mode: 'draft' | 'publish';
    draftMediaId?: string;
    publishId?: string;
    publishTime?: string;
}

export const publishArticle = async (payload: PublishArticlePayload): Promise<PublishResult> => {
    return postJson<PublishResult>('/api/publish', payload);
};

// 上传图片
export interface UploadImageResult {
    mediaId: string;
    url: string;
}

export const uploadImage = async (appId: string, appSecret: string, image: string, filename?: string): Promise<UploadImageResult> => {
    return postJson<UploadImageResult>('/api/upload-image', {
        appId,
        appSecret,
        image,
        filename
    });
};
