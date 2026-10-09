from contextlib import asynccontextmanager

from fastapi import FastAPI

from tiktok_search_integration import create_search_pool, register_search


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool, config = create_search_pool()

    app.state.search_pool = pool
    app.state.search_config = config

    print("TikTok Search Worker: READY")
    yield


app = FastAPI(
    title="Rakib TikTok Search Worker",
    version="1.0.0",
    lifespan=lifespan,
)

register_search(app)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "tiktok-search-worker"
    }
