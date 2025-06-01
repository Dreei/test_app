import express from 'express';
import { getInstallURL } from '../helpers/zoom-api.js';
import session from '../session.js';

const router = express.Router();

/*
 * Install Route - Install the Zoom App from the Zoom Marketplace
 * this route is used when a user installs the app from the Zoom Client
 */
router.get('/', session, async (req, res) => {
    const { url, state, verifier } = getInstallURL();

    // Still keep state in the (tiny) session object if you want:
    req.session = { state };

    /*  🔑  Put the verifier in its own signed, HttpOnly cookie.
      - 10 min expiry is plenty for the auth round-trip.
      - SameSite=None + Secure so Zoom (cross-site) can send the cookie back. */
    res.cookie('zoom_verifier', verifier, {
        httpOnly: true,
        secure: true, // HTTPS only  (ngrok or a real cert)
        sameSite: 'none', // allow cross-site redirect from zoom.us
        signed: true, // verifier can’t be tampered with
        maxAge: 10 * 60 * 1000, // 10 minutes
    });
    console.log('res.getHeaders()', res.getHeaders());
    console.log('Set verifier cookie, redirecting to', url.href);
    res.redirect(url.href);
});

export default router;
