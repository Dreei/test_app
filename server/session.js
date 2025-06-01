import cookieSession from 'cookie-session';
import { zoomApp } from './config.js';

// session.js

export default cookieSession({
    name: 'session',
    httpOnly: true,
    secure: true, // must be HTTPS in prod
    sameSite: 'none', // required for cross-site cookies like Zoom → your app
    keys: [zoomApp.sessionSecret],
    maxAge: 24 * 60 * 60 * 1000, // 1 day
});
