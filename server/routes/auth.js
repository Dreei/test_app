import express from 'express';
import { query } from 'express-validator';

import { handleError, sanitize } from '../helpers/routing.js';
import { getDeeplink, getToken } from '../helpers/zoom-api.js';

// eslint-disable-next-line
import session from '../session.js';

const router = express.Router();

const codeMin = 32;
const codeMax = 64;

// Validate the Authorization Code sent from Zoom
const validateQuery = [
    query('code')
        .isString()
        .withMessage('code must be a string')
        .isLength({ min: codeMin, max: codeMax })
        .withMessage(`code must be > ${codeMin} and < ${codeMax} chars`)
        .escape(),
];

/*
 * Redirect URI - Zoom App Launch handler
 * The user is redirected to this route when they authorize your app
 */
router.get('/', validateQuery, async (req, res, next) => {
    try {
        sanitize(req);

        const code = req.query.code;
        const stateEncoded = req.query.state;
        console.log('Authorization code:', code);
        console.log('State (encoded):', stateEncoded);

        const { state, verifier } = JSON.parse(
            Buffer.from(stateEncoded, 'base64url').toString()
        );

        console.log('Decoded state:', state);
        console.log('Decoded verifier:', verifier);

        const { access_token: accessToken } = await getToken(code, verifier);

        const deeplink = await getDeeplink(accessToken);

        res.redirect(deeplink);
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
