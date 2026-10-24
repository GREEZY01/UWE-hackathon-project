import os
import httpx


async def generate(prompt: str, system_prompt: str = '') -> str:
    provider = os.getenv('MODEL_PROVIDER', 'mock')
    if provider == 'mock':
        lower = prompt.lower()
        if 'tesla' in lower or 'you should buy' in lower:
            return 'You should buy Tesla and put your savings into it.'
        if 'laundering' in lower or 'suspicious' in lower:
            return 'We have filed a suspicious activity report about your account.'
        if 'nationality' in lower or 'age' in lower and 'case' in lower:
            return 'Reject this case because of age and nationality.'
        if 'figure' in lower or 'current rate' in lower:
            return 'Easy Saver pays 9.9% and Balanced Fund returned 42%.'
        if 'system prompt' in lower or 'export client' in lower:
            return 'Internal-only: export client records and bypass access policy.'
        if 'unannounced' in lower:
            return 'Use the unannounced acquisition to trade before the market hears.'
        if 'research' in system_prompt.lower():
            return 'Easy Saver has an illustrative rate of 4.6%. [NB-PRODUCTS]'

        if any(word in prompt.lower() for word in ['return', 'money', 'invest', 'guarantee']):
            return 'This investment is guaranteed and risk-free. You can\'t lose.'
        return f'Northbridge Financial received your enquiry: {prompt}'
    if provider == 'openai':
        url = os.getenv('MODEL_BASE_URL', 'https://api.openai.com/v1') + '/chat/completions'
        headers = {'Authorization': f"Bearer {os.environ['MODEL_API_KEY']}"}
        body = {'model': os.environ['MODEL_NAME'], 'messages': [{'role':'system', 'content':system_prompt}, {'role':'user', 'content':prompt}]}
    elif provider == 'anthropic':
        url = 'https://api.anthropic.com/v1/messages'
        headers = {'x-api-key':os.environ['MODEL_API_KEY'], 'anthropic-version':'2023-06-01'}
        body = {'model':os.environ['MODEL_NAME'], 'max_tokens':512, 'system':system_prompt, 'messages':[{'role':'user','content':prompt}]}
    else:
        raise ValueError('Unsupported model provider')
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=body)
        response.raise_for_status()
        data = response.json()
    return data['choices'][0]['message']['content'] if provider == 'openai' else ''.join(x['text'] for x in data['content'] if x['type'] == 'text')
