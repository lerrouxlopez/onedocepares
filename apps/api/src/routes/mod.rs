use axum::Router;

use crate::app::AppState;

pub mod health;

pub fn api() -> Router<AppState> {
    Router::new().merge(health::router())
}
