import { InferenceClient } from '@huggingface/inference';

// Initialize the client with your token
const client = new InferenceClient(process.env.HUGGINGFACE_API_KEY);

// Updated hfFetch function using the new Inference Client
export async function hfFetch(prompt) {
    try {
        const chatCompletion = await client.chatCompletion({
            provider: 'nebius', // or try "azure", "cohere", etc.
            model: 'Qwen/Qwen3-235B-A22B', // This is a powerful model for summarization
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: 512,
            temperature: 0.7,
        });

        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error('HuggingFace Inference Client error:', error);

        // Fallback to different provider/model combinations
        const fallbacks = [
            { provider: 'azure', model: 'microsoft/Phi-3-mini-4k-instruct' },
            { provider: 'cohere', model: 'CohereForAI/c4ai-command-r-plus' },
            {
                provider: 'nebius',
                model: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
            },
        ];

        for (const fallback of fallbacks) {
            try {
                console.log(
                    `Trying fallback: ${fallback.provider}/${fallback.model}`
                );
                const chatCompletion = await client.chatCompletion({
                    provider: fallback.provider,
                    model: fallback.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 512,
                    temperature: 0.7,
                });

                return chatCompletion.choices[0].message.content;
            } catch (fallbackError) {
                console.warn(
                    `Fallback ${fallback.provider}/${fallback.model} failed:`,
                    fallbackError.message
                );
                continue;
            }
        }

        throw new Error('All HuggingFace providers failed');
    }
}
