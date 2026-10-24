"""Adapter for NeMo's actual self_check_input action.

Mock verdicts are deterministic; live verdicts use the configured provider.
"""
import os
from typing import Any
from langchain_core.language_models.llms import LLM
from app.model import generate
from actions.injection import check


class InputJudge(LLM):
    @property
    def _llm_type(self) -> str:
        return 'finguard-input-judge'

    def _call(self, prompt: str, stop=None, run_manager=None, **kwargs: Any) -> str:
        raise RuntimeError('Use the asynchronous judge adapter')

    async def _acall(self, prompt: str, stop=None, run_manager=None, **kwargs: Any) -> str:
        if os.getenv('MODEL_PROVIDER','mock') == 'mock':
            user_text = prompt.split('<untrusted>', 1)[-1].rsplit('</untrusted>',1)[0]
            return 'yes' if check(user_text, {}).evidence else 'no'
        answer = (await generate(prompt, 'You are a security classifier. Answer only yes or no.')).strip().lower()
        if answer not in ('yes','no'):
            raise ValueError('Invalid self-check verdict')
        return answer
