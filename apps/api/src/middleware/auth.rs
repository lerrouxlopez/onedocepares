use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use axum_extra::extract::cookie::CookieJar;
use serde::Serialize;

use crate::{
    error::AppError,
    repositories::auth::{self, SessionRecord},
    services::auth::hash_session_token,
    state::AppState,
};

#[derive(Clone, Debug, Serialize)]
pub struct CurrentUser {
    pub id: uuid::Uuid,
    pub email: String,
    pub display_name: String,
    pub roles: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct CurrentSession {
    pub session: SessionRecord,
}

pub async fn require_authenticated(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let jar = CookieJar::from_headers(request.headers());
    let cookie = jar
        .get(&state.config.session_cookie_name)
        .ok_or_else(|| AppError::Unauthorized("missing session cookie".to_string()))?;
    let token_hash = hash_session_token(cookie.value());
    let session = auth::find_session_by_hash(&state.db, &token_hash)
        .await?
        .ok_or_else(|| AppError::Unauthorized("invalid or expired session".to_string()))?;
    let user = auth::find_user_by_id(&state.db, session.user_id)
        .await?
        .ok_or_else(|| AppError::Unauthorized("session user not found".to_string()))?;

    if !user.is_active {
        return Err(AppError::Forbidden("user account is inactive".to_string()));
    }

    request.extensions_mut().insert(CurrentUser {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        roles: user.roles,
    });
    request.extensions_mut().insert(CurrentSession { session });

    Ok(next.run(request).await)
}

pub async fn require_admin(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let jar = CookieJar::from_headers(request.headers());
    let cookie = jar
        .get(&state.config.session_cookie_name)
        .ok_or_else(|| AppError::Unauthorized("missing session cookie".to_string()))?;
    let token_hash = hash_session_token(cookie.value());
    let session = auth::find_session_by_hash(&state.db, &token_hash)
        .await?
        .ok_or_else(|| AppError::Unauthorized("invalid or expired session".to_string()))?;
    let user = auth::find_user_by_id(&state.db, session.user_id)
        .await?
        .ok_or_else(|| AppError::Unauthorized("session user not found".to_string()))?;

    if !user.is_active {
        return Err(AppError::Forbidden("user account is inactive".to_string()));
    }

    if !user.roles.iter().any(|role| role == "admin") {
        return Err(AppError::Forbidden("admin role required".to_string()));
    }

    request.extensions_mut().insert(CurrentUser {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        roles: user.roles,
    });
    request.extensions_mut().insert(CurrentSession { session });

    Ok(next.run(request).await)
}
