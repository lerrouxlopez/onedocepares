use axum::Router;

use crate::routes;

#[derive(Clone)]
pub struct AppState {
    pub service_name: &'static str,
    pub service_version: &'static str,
}

pub fn build_router() -> Router {
    let state = AppState {
        service_name: "onedocepares-api",
        service_version: env!("CARGO_PKG_VERSION"),
    };

    Router::new()
        .nest("/api/v1", routes::api())
        .with_state(state)
}
