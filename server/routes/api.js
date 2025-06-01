import express from 'express';
import { handleError, sanitize } from '../helpers/routing.js';
import { contextHeader, getAppContext } from '../helpers/cipher.js';
import { recallFetch } from '../helpers/recall.js';

import session from '../session.js';
import { zoomApp } from '../config.js';
import db from '../helpers/database.js';
import { hfFetch } from '../helpers/huggingface.js'; // at top of file

const router = express.Router();

/*
 * Gets the context of the Zoom App
 */
router.get('/context', async (req, res, next) => {
    try {
        sanitize(req);

        const header = req.header(contextHeader);

        const isZoom = !!(header && getAppContext(header));

        return res.json({
            isZoom,
        });
    } catch (e) {
        next(handleError(e));
    }
});

const validateAppContext = (req) => {
    const header = req.header(contextHeader);

    if (!header || !getAppContext(header)) {
        const e = new Error('Unauthorized');
        e.code = 401;
        throw e;
    }
};

/*
 * Send's a Recall Bot to start recording the call
 */
router.post('/start-recording', session, async (req, res, next) => {
    try {
        sanitize(req);
        validateAppContext(req);

        if (!req.body.meetingUrl) {
            return res.status(400).json({ error: 'Missing meetingUrl' });
        }

        console.log('recall bot start recording', req.body.meetingUrl);

        // @see https://recallai.readme.io/reference/bot_create
        const bot = await recallFetch('/api/v1/bot', {
            method: 'POST',
            body: JSON.stringify({
                bot_name: `${process.env.BOT_NAME} Notetaker`,
                meeting_url: req.body.meetingUrl,
                recording_config: {
                    realtime_endpoints: [
                        {
                            type: 'webhook',
                            url: `${zoomApp.publicUrl}/webhook/transcription?secret=${zoomApp.webhookSecret}`,
                            events: [
                                'transcript.partial_data',
                                'transcript.data',
                                'participant_events.chat_message',
                            ],
                        },
                    ],
                    transcript: {
                        provider: {
                            speechmatics_streaming: {
                                language: 'en',
                            },
                        },
                    },
                },
                zoom: {
                    request_recording_permission_on_host_join: true,
                    require_recording_permission: true,
                },
                /* Uncomment this to enable the bot to display an image.
                automatic_video_output: {
                    in_call_recording: {
                      kind: 'jpeg',
                      b64_data: 'YOUR-BASE64-JPEG-GOES-HERE'
                    }
                },
                */
                /* Uncomment this to enable the bot to play audio.
                automatic_audio_output: {
                    in_call_recording: {
                      data: {
                        kind: 'mp3',
                        b64_data: 'YOUR-BASE64-MP3-GOES-HERE'
                      }
                    }
                },
                */
                /* Uncomment this to make the bot send a chat message.
                chat: {
                    on_bot_join: {
                      send_to: 'everyone',
                      message: 'Hello world'
                    }
                },
                */
            }),
        });

        req.session.botId = bot.id;

        return res.json({
            botId: bot.id,
        });
    } catch (e) {
        next(handleError(e));
    }
});

/*
 * Tells the Recall Bot to stop recording the call
 */
router.post('/stop-recording', session, async (req, res, next) => {
    console.log(req.session);
    try {
        sanitize(req);
        validateAppContext(req);

        if (!req.session.botId) {
            return res.status(400).json({ error: 'Missing botId' });
        }

        await recallFetch(`/api/v1/bot/${req.session.botId}/leave_call`, {
            method: 'POST',
        });

        console.log('recall bot stopped');
        return res.json({});
    } catch (e) {
        next(handleError(e));
    }
});

/*
 * Gets the current state of the Recall Bot
 */
router.get('/recording-state', session, async (req, res, next) => {
    try {
        sanitize(req);
        validateAppContext(req);

        const botId = req.session.botId;

        if (!botId) {
            return res.status(400).json({ error: 'Missing botId' });
        }

        const bot = await recallFetch(`/api/v1/bot/${botId}`, {
            method: 'GET',
        });
        const latestStatus = bot.status_changes.slice(-1)[0].code;
        return res.json({
            state: latestStatus,
            transcript: db.transcripts[botId] || [],
        });
    } catch (e) {
        next(handleError(e));
    }
});

const PROMPTS = {
    _template: `You are a virtual assistant taking notes for a meeting. You are diligent, polite and slightly humorous at times.

Here is the transcript of the meeting, including the speaker's name:

<transcript>
{{transcript}}
</transcript>

Only answer the following question directly, do not add any additional comments or information.
{{prompt}}`,
    general_summary: 'Can you summarize the meeting? Please be concise.',
    action_items: 'What are the action items from the meeting?',
    decisions: 'What decisions were made in the meeting?',
    next_steps: 'What are the next steps?',
    key_takeaways: 'What are the key takeaways?',
};

/*
 * Gets a summary of the transcript using Anthropic's Claude model.
 */
router.post('/summarize', session, async (req, res, next) => {
    try {
        sanitize(req);
        validateAppContext(req);

        const botId = req.session.botId;
        const prompt = PROMPTS[req.body.prompt];

        if (!botId) {
            return res.status(400).json({ error: 'Missing botId' });
        }

        if (!prompt) {
            return res.status(400).json({ error: 'Missing prompt' });
        }

        const transcript = db.transcripts[botId] || [];

        // Process transcript chronologically using timestamps
        const allWords = [];

        transcript.forEach((utterance) => {
            const speakerName = utterance.participant?.name || 'Unknown';
            const words = utterance.words || [];

            words.forEach((word) => {
                allWords.push({
                    text: word.text,
                    speaker: speakerName,
                    timestamp: word.start_timestamp?.relative || 0,
                    is_final: utterance.is_final,
                });
            });
        });

        // Sort by timestamp for chronological order
        allWords.sort((a, b) => a.timestamp - b.timestamp);
        console.log('allWords', allWords);

        // Handle case where is_final might be undefined
        // Use all words if no final words are available, otherwise use only final words
        const finalWords = allWords.filter((word) => word.is_final === true);
        const wordsToProcess = finalWords.length > 0 ? finalWords : allWords;

        console.log('wordsToProcess length:', wordsToProcess.length);

        // Group consecutive words from same speaker
        const groupedTranscript = [];
        let currentSpeaker = null;

        wordsToProcess.forEach((word) => {
            if (word.speaker !== currentSpeaker) {
                currentSpeaker = word.speaker;
                groupedTranscript.push({
                    speaker: currentSpeaker,
                    words: [word.text],
                });
            } else {
                groupedTranscript[groupedTranscript.length - 1].words.push(
                    word.text
                );
            }
        });

        console.log('groupedTranscript====================', groupedTranscript);

        // Check if we have any transcript data
        if (groupedTranscript.length === 0) {
            return res.json({
                summary: 'No transcript data available to summarize.',
                warning:
                    'The meeting transcript appears to be empty or incomplete.',
            });
        }

        // Format for AI prompt
        const finalTranscript = groupedTranscript
            .map((item) => `${item.speaker}: ${item.words.join(' ')}`)
            .join('\n');

        console.log('finalTranscript', finalTranscript);

        // Additional check for empty transcript
        if (!finalTranscript.trim()) {
            return res.json({
                summary: 'No meaningful transcript content found to summarize.',
                warning:
                    'The transcript appears to contain only empty or invalid entries.',
            });
        }

        const completePrompt = PROMPTS._template
            .replace('{{transcript}}', finalTranscript)
            .replace('{{prompt}}', prompt);

        console.log('completePrompt', completePrompt);

        const completion = await hfFetch(completePrompt);

        // Clean up the response - remove the original prompt and any thinking tags
        let cleanSummary = completion.replace(completePrompt, '').trim();

        // Remove any <think> tags and their content
        cleanSummary = cleanSummary
            .replace(/<think>[\s\S]*?<\/think>/gi, '')
            .trim();

        // Remove any leading/trailing whitespace or newlines
        cleanSummary = cleanSummary.replace(/^\s+|\s+$/g, '');

        return res.json({ summary: cleanSummary });
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
