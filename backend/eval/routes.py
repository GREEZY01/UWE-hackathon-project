from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
from eval.runner import list_results, read_result, run_evaluation

router = APIRouter(prefix='/evaluation', tags=['evaluation'])


class EvaluationRequest(BaseModel):
    mode: Literal['mock','live'] = 'mock'


@router.post('/run')
async def evaluate(request: EvaluationRequest):
    try:
        return await run_evaluation(request.mode)
    except ValueError as exc:
        raise HTTPException(400,str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(409,str(exc)) from exc


@router.get('/runs')
def runs():
    return list_results()


@router.get('/runs/{run_id}')
def result(run_id: str):
    try:
        return read_result(run_id)
    except (FileNotFoundError,ValueError) as exc:
        raise HTTPException(404,'Evaluation run not found') from exc
