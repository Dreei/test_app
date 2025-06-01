import express from 'express';
import axios from 'axios';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import debug from 'debug';
import helmet from 'helmet';
import logger from 'morgan';
import { dirname } from 'path';
import { fileURLToPath, URL } from 'url';

import { start } from './server.js';
import installRoutes from './routes/install.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
import { appName, port, zoomApp } from './config.js';
import headers from './headers.js';
// eslint-disable-next-line
import {
    initWebSocketServer,
    closeWebSocketServer,
} from './routes/websocket.js';
const __dirname = dirname(fileURLToPath(import.meta.url));

/* App Config */
const app = express();
const dbg = debug(`${appName}:app`);
app.use(express.json({ limit: '10mb' }));

// frontend
const staticDir = `${__dirname}/../dist/frontend`;

// HTTP
app.set('port', port);
app.set('trust proxy', true);
app.use(cookieParser(zoomApp.sessionSecret)); // signed cookies

// log Axios requests and responses
const logFunc = (r) => {
    if (process.env.NODE_ENV !== 'production') {
        let { method, status, url, baseURL, config } = r;

        const endp = url || config?.url;
        const base = baseURL || config?.baseURL;
        let str = new URL(endp, base).href;

        if (method) str = `${method.toUpperCase()} ${str}`;
        if (status) str = `${status} ${str}`;

        debug(`${appName}:axios`)(str);
    }

    return r;
};

axios.interceptors.request.use(logFunc);
axios.interceptors.response.use(logFunc);

app.use(helmet(headers));

app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(logger('dev', { stream: { write: (msg) => dbg(msg) } }));

// serve the frontend
app.use('/', express.static(staticDir));

/* Routing */
app.use('/install', installRoutes);
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/webhook', webhookRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Server is running',
    });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const title = `Error ${err.status}`;

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    if (res.locals.error) dbg(`${title} %s`, err.stack);

    // render the error page
    res.status(status);
    res.json({
        title,
        message: err.message,
    });
});

// start serving
start(app, port).catch(async (e) => {
    console.error(e);
    process.exit(1);
});

export default app;
