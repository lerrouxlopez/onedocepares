use axum::{
    Extension, Json, Router,
    extract::{ConnectInfo, FromRequestParts, State},
    http::{StatusCode, request::Parts},
    response::IntoResponse,
    routing::{get, post},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;

use crate::{
    error::AppError,
    middleware::auth::{CurrentSession, CurrentUser},
    repositories::auth::{self, NewSession},
    services::auth as auth_service,
    state::AppState,
};

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct ApiEnvelope<T> {
    data: T,
}

#[derive(Serialize)]
struct AuthUserResponse {
    id: uuid::Uuid,
    email: String,
    display_name: String,
    roles: Vec<String>,
}

#[derive(Serialize)]
struct CsrfResponse {
    csrf_token: String,
}

/// Optional client IP — succeeds (with None) when ConnectInfo is absent (e.g. in tests).
struct MaybeClientIp(Option<String>);

impl<S> FromRequestParts<S> for MaybeClientIp
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let ip = parts
            .extensions
            .get::<ConnectInfo<SocketAddr>>()
            .map(|ConnectInfo(addr)| addr.ip().to_string());
        Ok(Self(ip))
    }
}

pub fn public_router() -> Router<AppState> {
    Router::new().route("/auth/login", post(login))
}

pub fn session_router() -> Router<AppState> {
    Router::new()
        .route("/auth/me", get(me))
        .route("/auth/csrf", get(csrf))
}

pub fn mutating_router() -> Router<AppState> {
    Router::new().route("/auth/logout", post(logout))
}

async fn login(
    State(state): State<AppState>,
    MaybeClientIp(maybe_ip): MaybeClientIp,
    jar: CookieJar,
    headers: axum::http::HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.email.trim().is_empty() || payload.password.is_empty() {
        return Err(AppError::BadRequest(
            "email and password are required".to_string(),
        ));
    }

    let user = auth::find_user_by_email(&state.db, &payload.email)
        .await?
        .ok_or_else(|| AppError::Unauthorized("invalid email or password".to_string()))?;

    if !user.is_active || !auth_service::verify_password(&payload.password, &user.password_hash) {
        return Err(AppError::Unauthorized(
            "invalid email or password".to_string(),
        ));
    }

    let token = auth_service::generate_session_token();
    let csrf_token = auth_service::generate_csrf_token();
    let expiry = auth_service::session_expiry(&state);
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok());

    auth::insert_session(
        &state.db,
        &NewSession {
            user_id: user.id,
            token_hash: &auth_service::hash_session_token(&token),
            csrf_token: &csrf_token,
            expires_at: expiry,
            user_agent,
            ip_address: maybe_ip.as_deref(),
        },
    )
    .await?;

    let cookie = Cookie::build((state.config.session_cookie_name.clone(), token))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(state.config.secure_cookies)
        .build();

    Ok((
        StatusCode::OK,
        jar.add(cookie),
        Json(ApiEnvelope {
            data: AuthUserResponse {
                id: user.id,
                email: user.email,
                display_name: user.display_name,
                roles: user.roles,
            },
        }),
    ))
}

async fn me(Extension(user): Extension<CurrentUser>) -> Json<ApiEnvelope<AuthUserResponse>> {
    Json(ApiEnvelope {
        data: AuthUserResponse {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            roles: user.roles,
        },
    })
}

async fn csrf(Extension(session): Extension<CurrentSession>) -> Json<ApiEnvelope<CsrfResponse>> {
    Json(ApiEnvelope {
        data: CsrfResponse {
            csrf_token: session.session.csrf_token,
        },
    })
}

async fn logout(
    State(state): State<AppState>,
    Extension(session): Extension<CurrentSession>,
    jar: CookieJar,
) -> Result<impl IntoResponse, AppError> {
    auth::revoke_session(&state.db, &session.session.token_hash).await?;

    let cookie = Cookie::build((state.config.session_cookie_name.clone(), ""))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(state.config.secure_cookies)
        .build();

    Ok((jar.remove(cookie), StatusCode::NO_CONTENT))
}
