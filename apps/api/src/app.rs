use axum::Router;

use crate::{config::Config, db, error::AppError, routes, state::AppState};

pub fn build_router(config: Config) -> Result<Router, AppError> {
    let db = db::create_pool(&config)?;
    let state = AppState::new(config, db);

    Ok(Router::new()
        .nest("/api/v1", routes::api(state.clone()))
        .with_state(state))
}
