import React, { useEffect, useState } from 'react';
import './InMeeting.css';
import Transcript from './Transcript/Transcript.js';
import zoomSdk from '@zoom/appssdk';
import appFetch from '../../helpers/fetch';
import Summary from './Summary/Summary';

function InMeeting() {
    const [recordingState, setRecordingState] = useState('stopped');
    const [transcript, setTranscript] = useState([]);

    const toggleRecording = async () => {
        if (recordingState === 'stopped') {
            await startRecording();
        } else {
            await stopRecording();
        }
    };

    const startRecording = async () => {
        setRecordingState('starting');

        try {
            // @see https://appssdk.zoom.us/types/ZoomSdkTypes.GetMeetingJoinUrlResponse.html
            const meetingUrl = await zoomSdk.getMeetingJoinUrl();
            const res = await appFetch('/api/start-recording', {
                method: 'POST',
                body: JSON.stringify({
                    meetingUrl: meetingUrl.joinUrl,
                }),
            });

            if (res.status <= 299) {
                setRecordingState('bot-joining');
            } else {
                setRecordingState('error');
            }
        } catch (error) {
            console.error('Error starting recording:', error);
            setRecordingState('error');
        }
    };

    const stopRecording = async () => {
        setRecordingState('stopping');

        try {
            const res = await appFetch('/api/stop-recording', {
                method: 'POST',
            });

            if (res.status <= 299) {
                setRecordingState('bot-leaving');
            } else {
                setRecordingState('error');
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            setRecordingState('error');
        }
    };

    const refreshState = async () => {
        if (recordingState === 'starting' || recordingState === 'stopping') {
            return;
        }

        try {
            const res = await appFetch('/api/recording-state', {
                method: 'GET',
            });

            if (res.status === 400) {
                setRecordingState('stopped');
                return;
            }

            const { state, transcript: newTranscript } = await res.json();

            if (state === 'in_call_not_recording') {
                setRecordingState('waiting');
            } else if (
                state === 'in_call_recording' &&
                recordingState !== 'bot-leaving'
            ) {
                setRecordingState('recording');
            } else if (state === 'call_ended') {
                setRecordingState('bot-leaving');
            } else if (state === 'fatal') {
                setRecordingState('error');
            } else if (state === 'done') {
                setRecordingState('stopped');
            }

            // Always update transcript if we received new data
            if (newTranscript) {
                setTranscript(newTranscript);
            }
        } catch (error) {
            console.error('Error refreshing state:', error);
            // Don't change state on network errors, just log them
        }
    };

    useEffect(() => {
        refreshState();
    }, []);

    useEffect(() => {
        const interval = setInterval(refreshState, 2000);
        return () => clearInterval(interval);
    }, [recordingState]);

    return (
        <div className="InMeeting">
            <header className="InMeeting-header">
                <h1>MomentumAI</h1>
                <div className="recording-status">
                    <span
                        className={`status-indicator ${recordingState}`}
                    ></span>
                    <span className="status-text">
                        {recordingState === 'recording' && 'Recording'}
                        {recordingState === 'stopped' && 'Not Recording'}
                        {recordingState === 'waiting' && 'Waiting'}
                        {recordingState === 'error' && 'Error'}
                        {['starting', 'bot-joining'].includes(recordingState) &&
                            'Starting...'}
                        {['stopping', 'bot-leaving'].includes(recordingState) &&
                            'Stopping...'}
                    </span>
                </div>
            </header>

            <div className="InMeeting-content">
                <div className="InMeeting-main">
                    <div className="transcript-section">
                        <div className="section-header">
                            <h3>Meeting Transcript</h3>
                            <span className="transcript-count">
                                {transcript.length} utterances
                            </span>
                        </div>
                        <div className="transcript-container">
                            <Transcript transcript={transcript} />
                        </div>
                    </div>

                    <div className="InMeeting-record">
                        <button
                            onClick={toggleRecording}
                            disabled={[
                                'starting',
                                'bot-joining',
                                'waiting',
                                'stopping',
                                'bot-leaving',
                                'error',
                            ].includes(recordingState)}
                            className={`record-button ${recordingState}`}
                        >
                            {recordingState === 'stopped' &&
                                '🔴 Start Recording'}
                            {recordingState === 'recording' &&
                                '⏹️ Stop Recording'}
                            {(recordingState === 'starting' ||
                                recordingState === 'bot-joining') &&
                                '⏳ Starting...'}
                            {(recordingState === 'stopping' ||
                                recordingState === 'bot-leaving') &&
                                '⏳ Stopping...'}
                            {recordingState === 'waiting' &&
                                '⏳ Waiting for permission...'}
                            {recordingState === 'error' &&
                                '❌ An error occurred'}
                        </button>
                    </div>
                </div>

                <div className="InMeeting-sidebar">
                    <Summary transcript={transcript} />
                </div>
            </div>
        </div>
    );
}

export default InMeeting;
