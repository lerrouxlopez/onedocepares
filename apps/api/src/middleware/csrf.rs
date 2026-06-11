use axum::{
    extract::{Request, State},
    http::Method,
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::CookieJar;

use crate::{
    error::AppError, repositories::auth, services::auth::hash_session_token, state::AppState,
};

pub async fn require_csrf(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    if matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS | Method::TRACE
    ) {
        return Ok(next.run(request).await);
    }

    let header_token = request
        .headers()
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("missing CSRF token".to_string()))?;

    let jar = CookieJar::from_headers(request.headers());
    let cookie = jar
        .get(&state.config.session_cookie_name)
        .ok_or_else(|| AppError::Unauthorized("missing session cookie".to_string()))?;
    let token_hash = hash_session_token(cookie.value());
    let session = auth::find_session_by_hash(&state.db, &token_hash)
        .await?
        .ok_or_else(|| AppError::Unauthorized("invalid or expired session".to_string()))?;

    if session.csrf_token != header_token {
        return Err(AppError::Forbidden("invalid CSRF token".to_string()));
    }

    Ok(next.run(request).await)
}
