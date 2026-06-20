use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    routing::{get, patch},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::{activity_feed, audit_log, players, teams},
    state::AppState,
};

#[derive(Serialize)]
struct ApiEnvelope<T> {
    data: T,
}

#[derive(Serialize)]
struct Pagination {
    page: i64,
    per_page: i64,
    total: i64,
    total_pages: i64,
}

#[derive(Serialize)]
struct PaginatedEnvelope<T> {
    data: Vec<T>,
    pagination: Pagination,
}

#[derive(Deserialize)]
struct PageParams {
    #[serde(default = "default_page")]
    page: i64,
    #[serde(default = "default_per_page")]
    per_page: i64,
}

fn default_page() -> i64 {
    1
}
fn default_per_page() -> i64 {
    20
}

#[derive(Deserialize)]
struct VisibilityPayload {
    is_visible: bool,
}

async fn get_feed(
    State(state): State<AppState>,
    Query(params): Query<PageParams>,
) -> Result<Json<PaginatedEnvelope<activity_feed::FeedRecord>>, AppError> {
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let total = activity_feed::count_feed(&state.db).await?;
    let data = activity_feed::list_feed(&state.db, per_page, offset).await?;
    let total_pages = (total + per_page - 1) / per_page;

    Ok(Json(PaginatedEnvelope {
        data,
        pagination: Pagination {
            page,
            per_page,
            total,
            total_pages,
        },
    }))
}

async fn get_feed_for_player(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(params): Query<PageParams>,
) -> Result<Json<PaginatedEnvelope<activity_feed::FeedRecord>>, AppError> {
    let player = players::get_player_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("player not found".to_string()))?;

    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let total = activity_feed::count_feed_for_entity(&state.db, "player", player.id).await?;
    let data =
        activity_feed::list_feed_for_entity(&state.db, "player", player.id, per_page, offset)
            .await?;
    let total_pages = (total + per_page - 1) / per_page;

    Ok(Json(PaginatedEnvelope {
        data,
        pagination: Pagination {
            page,
            per_page,
            total,
            total_pages,
        },
    }))
}

async fn get_feed_for_team(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(params): Query<PageParams>,
) -> Result<Json<PaginatedEnvelope<activity_feed::FeedRecord>>, AppError> {
    let team = teams::get_team_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("team not found".to_string()))?;

    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let total = activity_feed::count_feed_for_entity(&state.db, "team", team.id).await?;
    let data =
        activity_feed::list_feed_for_entity(&state.db, "team", team.id, per_page, offset).await?;
    let total_pages = (total + per_page - 1) / per_page;

    Ok(Json(PaginatedEnvelope {
        data,
        pagination: Pagination {
            page,
            per_page,
            total,
            total_pages,
        },
    }))
}

async fn set_visibility(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<VisibilityPayload>,
) -> Result<Json<ApiEnvelope<activity_feed::FeedRecord>>, AppError> {
    let feed = activity_feed::set_feed_visibility(&state.db, id, payload.is_visible)
        .await?
        .ok_or_else(|| AppError::NotFound("feed item not found".to_string()))?;

    let _ = audit_log::insert_audit(
        &state.db,
        user.id,
        if payload.is_visible {
            "show_feed_item"
        } else {
            "hide_feed_item"
        },
        Some("activity_feed"),
        Some(id),
        None,
    )
    .await;

    Ok(Json(ApiEnvelope { data: feed }))
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/feed", get(get_feed))
        .route("/feed/players/{slug}", get(get_feed_for_player))
        .route("/feed/teams/{slug}", get(get_feed_for_team))
}

pub fn admin_router() -> Router<AppState> {
    Router::new().route("/feed/{id}", patch(set_visibility))
}
