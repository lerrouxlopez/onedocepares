use axum::Router;

use axum::middleware;

use crate::{
    middleware::{auth as auth_middleware, csrf},
    state::AppState,
};

pub mod auth;
pub mod cms;
pub mod health;
pub mod media;

pub fn api(state: AppState) -> Router<AppState> {
    let session_router = auth::session_router().route_layer(middleware::from_fn_with_state(
        state.clone(),
        auth_middleware::require_authenticated,
    ));

    let mutating_auth_router = auth::mutating_router()
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            csrf::require_csrf,
        ))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::require_authenticated,
        ));

    let admin_router = cms::admin_router()
        .merge(media::admin_router())
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            csrf::require_csrf,
        ))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::require_admin,
        ));

    Router::new()
        .merge(health::router())
        .merge(auth::public_router())
        .merge(session_router)
        .merge(mutating_auth_router)
        .merge(cms::public_router())
        .nest("/admin", admin_router)
}
