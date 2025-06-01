import React, { useRef, useEffect } from 'react';
import './Transcript.css';
// eslint-disable-next-line
export const Transcript = ({ transcript }) => {
    const ref = useRef();

    // Sort transcript entries by timestamp for chronological order
    const sortedTranscript = [...transcript].sort(
        (a, b) => a.timestamp - b.timestamp
    );

    // Group consecutive entries from the same speaker
    const groupedTranscript = [];
    let currentSpeaker = null;
    let currentText = [];
    let currentIsHost = false;

    sortedTranscript.forEach((entry, index) => {
        if (entry.speaker !== currentSpeaker) {
            // Save previous group if it exists
            if (currentSpeaker !== null) {
                groupedTranscript.push({
                    speaker: currentSpeaker,
                    text: currentText.join(' '),
                    timestamp:
                        sortedTranscript[index - currentText.length]
                            ?.timestamp || 0,
                    is_host: currentIsHost,
                });
            }

            // Start new group
            currentSpeaker = entry.speaker;
            currentText = [entry.text];
            currentIsHost = entry.is_host || false;
        } else {
            // Add to current group
            currentText.push(entry.text);
        }
    });

    // Don't forget the last group
    if (currentSpeaker !== null && currentText.length > 0) {
        groupedTranscript.push({
            speaker: currentSpeaker,
            text: currentText.join(' '),
            timestamp:
                sortedTranscript[sortedTranscript.length - currentText.length]
                    ?.timestamp || 0,
            is_host: currentIsHost,
        });
    }

    useEffect(() => {
        // Scroll to bottom when transcript updates
        if (ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [transcript]);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    return (
        <div ref={ref} className="InMeeting-transcript">
            {groupedTranscript.length === 0 ? (
                <div className="transcript-empty">
                    <p>
                        No transcript available yet. Start recording to see live
                        transcription.
                    </p>
                </div>
            ) : (
                groupedTranscript.map((item, index) => (
                    <div
                        key={index}
                        className={`transcript-entry ${
                            item.is_host ? 'host' : ''
                        }`}
                    >
                        <div className="transcript-header">
                            <span className="InMeeting-transcript-speaker">
                                {item.speaker}
                                {item.is_host && (
                                    <span className="host-badge"> (Host)</span>
                                )}
                            </span>
                            <span className="transcript-timestamp">
                                {formatTimestamp(item.timestamp)}
                            </span>
                        </div>
                        <div className="transcript-text">{item.text}</div>
                    </div>
                ))
            )}
        </div>
    );
};

export default Transcript;
