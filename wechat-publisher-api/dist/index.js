"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const verify_1 = __importDefault(require("./routes/verify"));
const publish_1 = __importDefault(require("./routes/publish"));
const upload_1 = __importDefault(require("./routes/upload"));
const app = (0, fastify_1.default)({
    logger: true,
    bodyLimit: 20 * 1024 * 1024
});
const start = async () => {
    await app.register(cors_1.default, {
        origin: process.env.CORS_ORIGIN || true
    });
    await app.register(verify_1.default);
    await app.register(publish_1.default);
    await app.register(upload_1.default);
    app.get('/health', async () => ({ status: 'ok' }));
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '0.0.0.0';
    try {
        await app.listen({ port, host });
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};
start();
