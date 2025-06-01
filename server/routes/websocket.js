// import { WebSocketServer } from 'ws';
// import db from '../helpers/database.js';
// import { hfTranscribe } from '../helpers/huggingface.js';

// let wss;

// // Audio buffer management for each participant
// const audioBuffers = new Map(); // participantId -> { buffer: Buffer, lastActivity: timestamp }
// const BUFFER_DURATION_MS = 2000; // Process audio every 2 seconds
// const CLEANUP_INTERVAL_MS = 30000; // Clean up inactive buffers every 30 seconds

// // Clean up inactive audio buffers
// setInterval(() => {
//     const now = Date.now();
//     for (const [participantId, bufferInfo] of audioBuffers.entries()) {
//         if (now - bufferInfo.lastActivity > CLEANUP_INTERVAL_MS) {
//             console.log(
//                 `Cleaning up inactive buffer for participant: ${participantId}`
//             );
//             audioBuffers.delete(participantId);
//         }
//     }
// }, CLEANUP_INTERVAL_MS);

// const processAudioBuffer = async (
//     participantId,
//     audioBuffer,
//     participant,
//     botId,
//     timestamp
// ) => {
//     try {
//         console.log(
//             `Processing audio buffer for ${participant.name || 'Unknown'} (${
//                 audioBuffer.length
//             } bytes)`
//         );

//         // Convert base64 audio to buffer if needed
//         const audioData = Buffer.isBuffer(audioBuffer)
//             ? audioBuffer
//             : Buffer.from(audioBuffer, 'base64');

//         // Use Hugging Face to transcribe the audio
//         const transcription = await hfTranscribe(audioData);

//         if (transcription && transcription.trim()) {
//             console.log(
//                 `Transcription from ${participant.name}: ${transcription}`
//             );

//             // Store in database with speaker information
//             const transcriptEntry = {
//                 text: transcription.trim(),
//                 speaker: participant.name || `Participant ${participant.id}`,
//                 participant_id: participant.id,
//                 timestamp: timestamp,
//                 is_host: participant.is_host,
//                 platform: participant.platform,
//             };

//             if (!db.transcripts[botId]) {
//                 db.transcripts[botId] = [];
//             }

//             db.transcripts[botId].push(transcriptEntry);

//             console.log(`Stored transcript for bot ${botId}:`, transcriptEntry);
//         }
//     } catch (error) {
//         console.error(
//             `Error processing audio for participant ${participantId}:`,
//             error
//         );
//     }
// };

// const handleAudioData = async (audioData) => {
//     try {
//         // eslint-disable-next-line
//         const { data, bot, audio_separate } = audioData;
//         const { buffer, timestamp, participant } = data;

//         const participantId = `${participant.id}_${bot.id}`;
//         const botId = bot.id;

//         console.log(
//             `Received audio data from ${participant.name || 'Unknown'} (${
//                 buffer.length
//             } chars base64)`
//         );

//         // Initialize buffer for this participant if it doesn't exist
//         if (!audioBuffers.has(participantId)) {
//             audioBuffers.set(participantId, {
//                 buffer: Buffer.alloc(0),
//                 lastActivity: Date.now(),
//                 participant: participant,
//                 botId: botId,
//             });
//         }

//         const bufferInfo = audioBuffers.get(participantId);

//         // Append new audio data to buffer
//         const newAudioData = Buffer.from(buffer, 'base64');
//         bufferInfo.buffer = Buffer.concat([bufferInfo.buffer, newAudioData]);
//         bufferInfo.lastActivity = Date.now();

//         // Calculate approximate duration based on audio format
//         // 16kHz mono 16-bit = 2 bytes per sample = 32,000 bytes per second
//         const durationMs = (bufferInfo.buffer.length / 32000) * 1000;

//         // Process buffer when it reaches target duration
//         if (durationMs >= BUFFER_DURATION_MS) {
//             console.log(
//                 `Buffer ready for processing: ${durationMs}ms of audio`
//             );

//             // Process the accumulated audio
//             await processAudioBuffer(
//                 participantId,
//                 bufferInfo.buffer,
//                 participant,
//                 botId,
//                 timestamp.absolute
//             );

//             // Reset buffer
//             bufferInfo.buffer = Buffer.alloc(0);
//         }
//     } catch (error) {
//         console.error('Error handling audio data:', error);
//     }
// };

// export const initWebSocketServer = (server) => {
//     wss = new WebSocketServer({
//         server,
//         path: '/websocket/audio',
//     });
//     // eslint-disable-next-line
//     wss.on('connection', (ws, request) => {
//         console.log(
//             'New WebSocket connection established for audio processing'
//         );

//         ws.on('message', async (message) => {
//             try {
//                 const data = JSON.parse(message.toString());
//                 console.log('Received WebSocket message:', data.event);

//                 if (data.event === 'audio_separate_raw.data') {
//                     await handleAudioData(data);
//                 }
//             } catch (error) {
//                 console.error('Error processing WebSocket message:', error);
//             }
//         });

//         ws.on('close', (code, reason) => {
//             console.log(`WebSocket connection closed: ${code} ${reason}`);
//         });

//         ws.on('error', (error) => {
//             console.error('WebSocket error:', error);
//         });

//         // Send acknowledgment
//         ws.send(
//             JSON.stringify({
//                 type: 'connection_established',
//                 message: 'Audio processing WebSocket connected',
//             })
//         );
//     });

//     console.log(
//         'WebSocket server initialized for audio processing at /websocket/audio'
//     );

//     return wss;
// };

// export const closeWebSocketServer = () => {
//     if (wss) {
//         wss.close();
//         console.log('WebSocket server closed');
//     }
// };
