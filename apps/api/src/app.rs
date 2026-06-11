use axum::Router;
use tower_http::services::ServeDir;

use crate::{config::Config, db, error::AppError, routes, state::AppState};

pub fn build_router_with_state(state: AppState) -> Router {
    let uploads_dir = state.config.uploads_dir.clone();
    Router::new()
        .nest("/api/v1", routes::api(state.clone()))
        .nest_service("/uploads", ServeDir::new(uploads_dir))
        .with_state(state)
}

pub fn build_router(config: Config) -> Result<Router, AppError> {
    let db = db::create_pool(&config)?;
    let state = AppState::new(config, db);
    Ok(build_router_with_state(state))
}
