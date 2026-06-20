use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get},
};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::tournaments::{self, UpsertTournament},
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
struct TournamentPayload {
    name: String,
    slug: Option<String>,
    description: Option<String>,
    location: Option<String>,
    start_date: Option<NaiveDate>,
    end_date: Option<NaiveDate>,
    registration_open_at: Option<DateTime<Utc>>,
    registration_close_at: Option<DateTime<Utc>>,
    #[serde(default = "default_status")]
    status: String,
    max_teams: Option<i32>,
}

fn default_status() -> String {
    "upcoming".to_string()
}

#[derive(Deserialize)]
struct DivisionPayload {
    name: String,
    description: Option<String>,
    max_participants: Option<i32>,
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/tournaments", get(list_tournaments))
        .route("/tournaments/{slug}", get(get_tournament))
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route(
            "/tournaments",
            get(list_all_tournaments).post(create_tournament),
        )
        .route(
            "/tournaments/{id}",
            get(get_tournament_by_id)
                .patch(update_tournament)
                .delete(delete_tournament),
        )
        .route(
            "/tournaments/{id}/divisions",
            get(list_divisions).post(create_division),
        )
        .route(
            "/tournaments/{id}/divisions/{div_id}",
            delete(delete_division),
        )
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

async fn list_tournaments(
    State(state): State<AppState>,
    Query(params): Query<PageParams>,
) -> Result<Json<PaginatedEnvelope<tournaments::TournamentRecord>>, AppError> {
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let total = tournaments::count_public_tournaments(&state.db).await?;
    let data = tournaments::list_public_tournaments(&state.db, per_page, offset).await?;
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

async fn get_tournament(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiEnvelope<tournaments::TournamentRecord>>, AppError> {
    let tournament = tournaments::get_tournament_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("tournament not found".to_string()))?;
    Ok(Json(ApiEnvelope { data: tournament }))
}

async fn get_tournament_by_id(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiEnvelope<tournaments::TournamentRecord>>, AppError> {
    let tournament = tournaments::get_tournament_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("tournament not found".to_string()))?;
    Ok(Json(ApiEnvelope { data: tournament }))
}

async fn list_all_tournaments(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<tournaments::TournamentRecord>>>, AppError> {
    let data = tournaments::list_all_tournaments(&state.db).await?;
    Ok(Json(ApiEnvelope { data }))
}

async fn create_tournament(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Json(payload): Json<TournamentPayload>,
) -> Result<(StatusCode, Json<ApiEnvelope<tournaments::TournamentRecord>>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let base_slug = resolve_slug(&payload.name, payload.slug.as_deref());
    let slug = tournaments::find_unique_slug(&state.db, &base_slug).await?;

    let tournament = tournaments::create_tournament(
        &state.db,
        &UpsertTournament {
            name: payload.name,
            slug,
            description: payload.description,
            location: payload.location,
            start_date: payload.start_date,
            end_date: payload.end_date,
            registration_open_at: payload.registration_open_at,
            registration_close_at: payload.registration_close_at,
            status: payload.status,
            max_teams: payload.max_teams,
            actor_id: user.id,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope { data: tournament })))
}

async fn update_tournament(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<TournamentPayload>,
) -> Result<Json<ApiEnvelope<tournaments::TournamentRecord>>, AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let slug = resolve_slug(&payload.name, payload.slug.as_deref());

    let result = tournaments::update_tournament(
        &state.db,
        id,
        &UpsertTournament {
            name: payload.name,
            slug,
            description: payload.description,
            location: payload.location,
            start_date: payload.start_date,
            end_date: payload.end_date,
            registration_open_at: payload.registration_open_at,
            registration_close_at: payload.registration_close_at,
            status: payload.status,
            max_teams: payload.max_teams,
            actor_id: user.id,
        },
    )
    .await;

    match result {
        Ok(Some(tournament)) => Ok(Json(ApiEnvelope { data: tournament })),
        Ok(None) => Err(AppError::NotFound("tournament not found".to_string())),
        Err(ref e) if is_unique_violation(e) => {
            Err(AppError::BadRequest("slug already in use".to_string()))
        }
        Err(e) => Err(AppError::Sqlx(e)),
    }
}

async fn delete_tournament(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let found = tournaments::delete_tournament(&state.db, id).await?;
    if found {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("tournament not found".to_string()))
    }
}

async fn list_divisions(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiEnvelope<Vec<tournaments::TournamentDivisionRecord>>>, AppError> {
    tournaments::get_tournament_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("tournament not found".to_string()))?;
    let data = tournaments::list_divisions(&state.db, id).await?;
    Ok(Json(ApiEnvelope { data }))
}

async fn create_division(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<DivisionPayload>,
) -> Result<
    (
        StatusCode,
        Json<ApiEnvelope<tournaments::TournamentDivisionRecord>>,
    ),
    AppError,
> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }
    tournaments::get_tournament_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("tournament not found".to_string()))?;

    let division = tournaments::create_division(
        &state.db,
        id,
        &payload.name,
        payload.description.as_deref(),
        payload.max_participants,
    )
    .await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope { data: division })))
}

async fn delete_division(
    State(state): State<AppState>,
    Path((_id, div_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let found = tournaments::delete_division(&state.db, div_id).await?;
    if found {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("division not found".to_string()))
    }
}
