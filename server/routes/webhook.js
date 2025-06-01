import express from 'express';
import crypto from 'crypto';
import { handleError, sanitize } from '../helpers/routing.js';
import { zoomApp } from '../config.js';
import db from '../helpers/database.js';

const router = express.Router();

/*
 * Receives transcription webhooks from the Recall Bot
 * @see https://recallai.readme.io/reference/webhook-reference#real-time-transcription
 */
router.post('/transcription', express.json(), async (req, res, next) => {
    try {
        sanitize(req);
        if (req.body.event !== 'transcript.data') {
            return res.status(200).json({ success: true });
        }
        if (
            !crypto.timingSafeEqual(
                Buffer.from(req.query.secret, 'utf8'),
                Buffer.from(zoomApp.webhookSecret, 'utf8')
            )
        ) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const transcript = req.body.data.data;
        const bot_id = req.body.data.bot.id;

        if (!db.transcripts[bot_id]) {
            db.transcripts[bot_id] = [];
        }
        db.transcripts[bot_id].push(transcript);
        console.log('Current transcripts', db.transcripts[bot_id]);
        res.status(200).json({ success: true });
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
