use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;

use crate::app::AppState;

#[derive(Serialize)]
struct HealthResponse<'a> {
    status: &'a str,
    service: &'a str,
    version: &'a str,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health_check))
}

async fn health_check(State(state): State<AppState>) -> Json<HealthResponse<'static>> {
    Json(HealthResponse {
        status: "ok",
        service: state.service_name,
        version: state.service_version,
    })
}
