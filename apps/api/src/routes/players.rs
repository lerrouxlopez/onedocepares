use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch},
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    repositories::players::{self, UpsertPlayer},
    state::AppState,
    utils::slug::slugify,
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
struct PlayerPayload {
    name: String,
    slug: Option<String>,
    bio: Option<String>,
    photo_url: Option<String>,
    date_of_birth: Option<NaiveDate>,
    nationality: Option<String>,
    belt_rank: Option<String>,
    weight_class: Option<String>,
    #[serde(default = "default_true")]
    is_active: bool,
}

fn default_true() -> bool {
    true
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/players", get(list_players))
        .route("/players/{slug}", get(get_player))
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/players", get(list_all_players).post(create_player))
        .route("/players/{id}", patch(update_player).delete(delete_player))
}

fn resolve_slug(name: &str, explicit: Option<&str>) -> String {
    explicit
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(slugify)
        .unwrap_or_else(|| slugify(name))
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    if let sqlx::Error::Database(db_err) = err {
        return db_err.code().as_deref() == Some("23505");
    }
    false
}

async fn list_players(
    State(state): State<AppState>,
    Query(params): Query<PageParams>,
) -> Result<Json<PaginatedEnvelope<players::PlayerRecord>>, AppError> {
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let total = players::count_active_players(&state.db).await?;
    let data = players::list_active_players(&state.db, per_page, offset).await?;
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

async fn get_player(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiEnvelope<players::PlayerRecord>>, AppError> {
    let player = players::get_player_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("player not found".to_string()))?;
    Ok(Json(ApiEnvelope { data: player }))
}

async fn list_all_players(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<players::PlayerRecord>>>, AppError> {
    let data = players::list_all_players(&state.db).await?;
    Ok(Json(ApiEnvelope { data }))
}

async fn create_player(
    State(state): State<AppState>,
    Json(payload): Json<PlayerPayload>,
) -> Result<(StatusCode, Json<ApiEnvelope<players::PlayerRecord>>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let base_slug = resolve_slug(&payload.name, payload.slug.as_deref());
    let slug = players::find_unique_slug(&state.db, &base_slug).await?;

    let player = players::create_player(
        &state.db,
        &UpsertPlayer {
            name: payload.name,
            slug,
            bio: payload.bio,
            photo_url: payload.photo_url,
            date_of_birth: payload.date_of_birth,
            nationality: payload.nationality,
            belt_rank: payload.belt_rank,
            weight_class: payload.weight_class,
            is_active: payload.is_active,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope { data: player })))
}

async fn update_player(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PlayerPayload>,
) -> Result<Json<ApiEnvelope<players::PlayerRecord>>, AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let slug = resolve_slug(&payload.name, payload.slug.as_deref());

    let result = players::update_player(
        &state.db,
        id,
        &UpsertPlayer {
            name: payload.name,
            slug,
            bio: payload.bio,
            photo_url: payload.photo_url,
            date_of_birth: payload.date_of_birth,
            nationality: payload.nationality,
            belt_rank: payload.belt_rank,
            weight_class: payload.weight_class,
            is_active: payload.is_active,
        },
    )
    .await;

    match result {
        Ok(Some(player)) => Ok(Json(ApiEnvelope { data: player })),
        Ok(None) => Err(AppError::NotFound("player not found".to_string())),
        Err(ref e) if is_unique_violation(e) => {
            Err(AppError::BadRequest("slug already in use".to_string()))
        }
        Err(e) => Err(AppError::Sqlx(e)),
    }
}

async fn delete_player(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let found = players::delete_player(&state.db, id).await?;
    if found {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("player not found".to_string()))
    }
}
