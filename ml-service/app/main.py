from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.schemas import AnalysisResult, AnalyzeRequest
from app.domain.cleaning import InsufficientDataError
from app.pipeline import analyze

app = FastAPI(title="AquaML — serviço de ML", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResult, response_model_by_alias=True)
def run_analysis(request: AnalyzeRequest) -> AnalysisResult:
    # síncrona de propósito: o FastAPI roda numa thread e não trava o servidor
    return analyze(request)


@app.exception_handler(InsufficientDataError)
def insufficient_data(_: Request, exc: InsufficientDataError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(RequestValidationError)
def invalid_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Pedido mal formado: devolve uma frase em português (em vez da lista padrão)."""
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
    count = len(exc.errors())
    extra = f" (e mais {count - 1} problema(s))" if count > 1 else ""
    message = f"Dados inválidos no pedido em '{where or 'corpo'}': {first.get('msg', 'formato incorreto')}{extra}."
    return JSONResponse(status_code=422, content={"detail": message})
