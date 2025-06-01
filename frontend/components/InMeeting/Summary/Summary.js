import React, { useState } from 'react';
import './Summary.css';
import appFetch from '../../../helpers/fetch';

/* eslint react/prop-types: 0 */
export const Summary = ({ transcript }) => {
    const [summaryState, setSummaryState] = useState('none');
    const [prompt, setPrompt] = useState('general_summary');
    const [summary, setSummary] = useState('');
    const [error, setError] = useState('');

    const generateSummary = async () => {
        setSummaryState('summarising');
        setError(''); // Clear any previous errors

        try {
            const res = await appFetch('/api/summarize', {
                method: 'POST',
                body: JSON.stringify({
                    prompt,
                }),
            });

            if (res.status < 299) {
                const data = await res.json();
                setSummaryState('none');
                setSummary(data.summary); // Always replace with latest summary
            } else {
                const errorData = await res
                    .json()
                    .catch(() => ({ error: 'Unknown error' }));
                setSummaryState('error');
                setError(errorData.error || 'Failed to generate summary');
            }
        } catch (err) {
            setSummaryState('error');
            setError('Network error occurred');
            console.error('Summary generation error:', err);
        }
    };

    const promptLabels = {
        general_summary: 'General Summary',
        action_items: 'Action Items',
        decisions: 'Decisions Made',
        next_steps: 'Next Steps',
        key_takeaways: 'Key Takeaways',
    };

    return (
        <div className="InMeeting-summary">
            <div className="summary-header">
                <h3>AI Summary</h3>
                <div className="summary-controls">
                    <select
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={summaryState === 'summarising'}
                        className="summary-select"
                    >
                        <option value="general_summary">
                            Summarize this meeting
                        </option>
                        <option value="action_items">
                            Generate action items
                        </option>
                        <option value="decisions">
                            Outline decisions made
                        </option>
                        <option value="next_steps">Highlight next steps</option>
                        <option value="key_takeaways">
                            Find key takeaways
                        </option>
                    </select>
                    <button
                        onClick={generateSummary}
                        disabled={
                            transcript.length === 0 ||
                            summaryState === 'summarising'
                        }
                        className={`summary-button ${
                            summaryState === 'error' ? 'error' : ''
                        }`}
                    >
                        {summaryState === 'none' && 'Ask AI'}
                        {summaryState === 'summarising' && 'Thinking...'}
                        {summaryState === 'error' && 'Try Again'}
                    </button>
                </div>
            </div>

            <div className="summary-content">
                {summaryState === 'summarising' && (
                    <div className="summary-loading">
                        <div className="loading-spinner"></div>
                        <p>
                            Generating {promptLabels[prompt].toLowerCase()}...
                        </p>
                    </div>
                )}

                {summaryState === 'error' && (
                    <div className="summary-error">
                        <p className="error-message">⚠️ {error}</p>
                    </div>
                )}

                {summary && summaryState !== 'summarising' && (
                    <div className="summary-result">
                        <div className="summary-type">
                            <strong>{promptLabels[prompt]}:</strong>
                        </div>
                        <div className="summary-text">
                            {summary.split('\n').map((line, index) => (
                                <p key={index}>{line}</p>
                            ))}
                        </div>
                        <div className="summary-timestamp">
                            Generated at {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                )}

                {!summary &&
                    summaryState === 'none' &&
                    transcript.length === 0 && (
                        <div className="summary-placeholder">
                            <p>Start recording to generate AI summaries</p>
                        </div>
                    )}

                {!summary &&
                    summaryState === 'none' &&
                    transcript.length > 0 && (
                        <div className="summary-placeholder">
                            <p>Click Ask AI to generate a summary</p>
                        </div>
                    )}
            </div>
        </div>
    );
};

export default Summary;
