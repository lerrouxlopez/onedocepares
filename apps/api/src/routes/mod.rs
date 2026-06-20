use axum::Router;
use axum::middleware;

use crate::{
    middleware::{auth as auth_middleware, csrf},
    state::AppState,
};

pub mod auth;
pub mod badges;
pub mod calendar;
pub mod cms;
pub mod feed;
pub mod health;
pub mod leaderboards;
pub mod matches;
pub mod media;
pub mod players;
pub mod registrations;
pub mod social;
pub mod teams;
pub mod tournaments;

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

    // Social interactions: authenticated user, not necessarily admin
    let social_auth_router = social::auth_router()
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            csrf::require_csrf,
        ))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware::require_authenticated,
        ));

    // Registration route: authenticated user, not necessarily admin
    let registration_public_router = registrations::public_router()
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
        .merge(teams::admin_router())
        .merge(players::admin_router())
        .merge(tournaments::admin_router())
        .merge(registrations::admin_router())
        .merge(leaderboards::admin_router())
        .merge(feed::admin_router())
        .merge(badges::admin_router())
        .merge(matches::admin_router())
        .merge(social::admin_router())
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
        .merge(teams::public_router())
        .merge(players::public_router())
        .merge(tournaments::public_router())
        .merge(leaderboards::public_router())
        .merge(feed::public_router())
        .merge(badges::public_router())
        .merge(matches::public_router())
        .merge(social::public_router())
        .merge(calendar::public_router())
        .merge(registration_public_router)
        .merge(social_auth_router)
        .nest("/admin", admin_router)
}
