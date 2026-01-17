const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code?: string;
        message?: string;
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
        throw new Error(message);
    }

    return data.data as T;
};

export const verifyApiConfig = async (appId: string, appSecret: string) => {
    return postJson<{ verified: boolean; accountName?: string; accessTokenExpires?: number }>(
        '/api/verify',
        { appId, appSecret }
    );
};

export const publishArticle = async (payload: {
    appId: string;
    appSecret: string;
    publishMode: 'draft' | 'publish';
    article: {
        title: string;
        content: string;
        digest?: string;
        author?: string;
        contentSourceUrl?: string;
    };
}) => {
    return postJson<{
        mode: 'draft' | 'publish';
        draftMediaId?: string;
        publishId?: string;
        publishTime?: string;
    }>(
        '/api/publish',
        payload
    );
};
