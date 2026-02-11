"""
FastAPI Backend — ChatGPT Custom Action

Deploy: Railway, Render, or any Python hosting
Run locally: uvicorn main:app --reload --port 8000

This example implements a knowledge base Q&A action for a Custom GPT.
Demonstrates: CORS, auth, structured errors, OpenAPI spec serving.
"""

import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel

# --- App Setup ---
app = FastAPI(
    title="Knowledge Base GPT API",
    description="Search and retrieve articles from a knowledge base. Used by a Custom GPT.",
    version="1.0.0",
)

# --- CORS for ChatGPT ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://chat.openai.com"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

# --- Environment ---
ACTION_API_KEY = os.getenv("ACTION_API_KEY", "dev-key-change-me")

# --- Models ---


class ErrorDetail(BaseModel):
    code: str
    message: str
    suggestion: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class Article(BaseModel):
    id: str
    title: str
    summary: str
    content: str
    category: str
    url: str
    relevance_score: float


class SearchResponse(BaseModel):
    results: list[Article]
    total_count: int
    message: str


class AskRequest(BaseModel):
    question: str
    category: Optional[str] = None
    max_results: int = 3


class AskResponse(BaseModel):
    answer: str
    sources: list[dict]
    message: str


# --- Sample Data (replace with your database/vector store) ---
ARTICLES = [
    Article(
        id="art_001",
        title="Getting Started with Python Type Hints",
        summary="A beginner's guide to Python type annotations and mypy.",
        content="Type hints in Python allow you to annotate function parameters and return values...",
        category="python",
        url="https://example.com/articles/python-type-hints",
        relevance_score=0.0,
    ),
    Article(
        id="art_002",
        title="Understanding FastAPI Dependency Injection",
        summary="How FastAPI's Depends() system works under the hood.",
        content="FastAPI uses a powerful dependency injection system that allows you to declare...",
        category="fastapi",
        url="https://example.com/articles/fastapi-di",
        relevance_score=0.0,
    ),
    Article(
        id="art_003",
        title="Docker Best Practices for Python Apps",
        summary="Optimize your Python Docker images for production.",
        content="When containerizing Python applications, start with a slim base image...",
        category="devops",
        url="https://example.com/articles/docker-python",
        relevance_score=0.0,
    ),
]


# --- Auth Dependency ---
def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != ACTION_API_KEY:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid or missing API key.",
                    "suggestion": "Check your GPT Action authentication settings.",
                }
            },
        )


# --- Endpoints ---


@app.get("/api/search", response_model=SearchResponse)
async def search_articles(
    q: str = Query(..., description="Search keywords from the user's question"),
    category: Optional[str] = Query(
        None,
        description="Filter by category: python, fastapi, devops. Only if user specifies.",
    ),
    limit: int = Query(5, ge=1, le=20, description="Number of results. Default 5."),
    x_api_key: str = Header(None),
):
    """
    Search the knowledge base for articles matching the user's query.
    Call this when the user wants to find articles, tutorials, or documentation.
    """
    verify_api_key(x_api_key)

    query_lower = q.lower()
    results = []

    for article in ARTICLES:
        score = 0.0
        if query_lower in article.title.lower():
            score += 0.8
        if query_lower in article.summary.lower():
            score += 0.5
        if query_lower in article.content.lower():
            score += 0.3
        if category and article.category != category:
            continue
        if score > 0:
            results.append(article.model_copy(update={"relevance_score": score}))

    results.sort(key=lambda a: a.relevance_score, reverse=True)
    results = results[:limit]

    return SearchResponse(
        results=results,
        total_count=len(results),
        message=(
            f"Found {len(results)} articles matching '{q}'"
            if results
            else f"No articles found for '{q}'. Try different keywords."
        ),
    )


@app.get("/api/articles/{article_id}", response_model=Article)
async def get_article(article_id: str, x_api_key: str = Header(None)):
    """
    Get the full content of a specific article by ID.
    Call this when the user wants to read or learn more about a specific article
    from the search results.
    """
    verify_api_key(x_api_key)

    for article in ARTICLES:
        if article.id == article_id:
            return article

    raise HTTPException(
        status_code=404,
        detail={
            "error": {
                "code": "ARTICLE_NOT_FOUND",
                "message": f"No article found with ID '{article_id}'.",
                "suggestion": "Search for articles first using the search endpoint.",
            }
        },
    )


@app.post("/api/ask", response_model=AskResponse)
async def ask_question(request: AskRequest, x_api_key: str = Header(None)):
    """
    Ask a question and get an answer synthesized from the knowledge base.
    Call this when the user asks a specific question that needs a direct answer,
    not just article links.
    """
    verify_api_key(x_api_key)

    # In production, this would use a vector store + LLM for RAG
    # For this example, we do simple keyword matching
    query_lower = request.question.lower()
    relevant = [
        a
        for a in ARTICLES
        if query_lower in a.title.lower()
        or query_lower in a.summary.lower()
        or any(word in a.content.lower() for word in query_lower.split() if len(word) > 3)
    ]

    if not relevant:
        return AskResponse(
            answer="I couldn't find a specific answer to that question in the knowledge base.",
            sources=[],
            message="No matching articles found. Try rephrasing the question.",
        )

    relevant = relevant[: request.max_results]

    return AskResponse(
        answer=f"Based on {len(relevant)} articles in the knowledge base: {relevant[0].summary}",
        sources=[{"title": a.title, "url": a.url} for a in relevant],
        message=f"Answer synthesized from {len(relevant)} sources.",
    )


# --- Utility Endpoints ---


@app.get("/privacy", response_class=HTMLResponse)
async def privacy_policy():
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Privacy Policy</title></head>
    <body>
    <h1>Privacy Policy</h1>
    <p>This API processes search queries on behalf of a ChatGPT GPT.</p>
    <ul>
        <li>We do not store personal data.</li>
        <li>Search queries are processed in memory and not logged.</li>
        <li>No cookies or tracking are used.</li>
    </ul>
    <p>Last updated: 2024-01-01</p>
    </body>
    </html>
    """


@app.get("/health")
async def health_check():
    return {"status": "ok", "articles_count": len(ARTICLES)}


# --- Run ---
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
