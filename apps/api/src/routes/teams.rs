use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch},
};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    repositories::teams::{self, UpsertTeam},
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
struct TeamPayload {
    name: String,
    slug: Option<String>,
    description: Option<String>,
    logo_url: Option<String>,
    city: Option<String>,
    country: Option<String>,
    founded_year: Option<i32>,
    website: Option<String>,
    #[serde(default = "default_true")]
    is_active: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
struct AddMemberPayload {
    player_id: Uuid,
    #[serde(default)]
    is_captain: bool,
    joined_at: Option<NaiveDate>,
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/teams", get(list_teams))
        .route("/teams/{slug}", get(get_team))
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/teams", get(list_all_teams).post(create_team))
        .route("/teams/{id}", patch(update_team).delete(delete_team))
        .route("/teams/{id}/members", get(list_members).post(add_member))
        .route("/teams/{id}/members/{player_id}", delete(remove_member))
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

async fn list_teams(
    State(state): State<AppState>,
    Query(params): Query<PageParams>,
) -> Result<Json<PaginatedEnvelope<teams::TeamRecord>>, AppError> {
    let page = params.page.max(1);
    let per_page = params.per_page.clamp(1, 100);
    let offset = (page - 1) * per_page;

    let total = teams::count_active_teams(&state.db).await?;
    let data = teams::list_active_teams(&state.db, per_page, offset).await?;
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

async fn get_team(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ApiEnvelope<teams::TeamRecord>>, AppError> {
    let team = teams::get_team_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("team not found".to_string()))?;
    Ok(Json(ApiEnvelope { data: team }))
}

async fn list_all_teams(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<teams::TeamRecord>>>, AppError> {
    let data = teams::list_all_teams(&state.db).await?;
    Ok(Json(ApiEnvelope { data }))
}

async fn create_team(
    State(state): State<AppState>,
    Json(payload): Json<TeamPayload>,
) -> Result<(StatusCode, Json<ApiEnvelope<teams::TeamRecord>>), AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let base_slug = resolve_slug(&payload.name, payload.slug.as_deref());
    let slug = teams::find_unique_slug(&state.db, &base_slug).await?;

    let team = teams::create_team(
        &state.db,
        &UpsertTeam {
            name: payload.name,
            slug,
            description: payload.description,
            logo_url: payload.logo_url,
            city: payload.city,
            country: payload.country,
            founded_year: payload.founded_year,
            website: payload.website,
            is_active: payload.is_active,
        },
    )
    .await?;

    Ok((StatusCode::CREATED, Json(ApiEnvelope { data: team })))
}

async fn update_team(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<TeamPayload>,
) -> Result<Json<ApiEnvelope<teams::TeamRecord>>, AppError> {
    if payload.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".to_string()));
    }

    let slug = resolve_slug(&payload.name, payload.slug.as_deref());

    let result = teams::update_team(
        &state.db,
        id,
        &UpsertTeam {
            name: payload.name,
            slug,
            description: payload.description,
            logo_url: payload.logo_url,
            city: payload.city,
            country: payload.country,
            founded_year: payload.founded_year,
            website: payload.website,
            is_active: payload.is_active,
        },
    )
    .await;

    match result {
        Ok(Some(team)) => Ok(Json(ApiEnvelope { data: team })),
        Ok(None) => Err(AppError::NotFound("team not found".to_string())),
        Err(ref e) if is_unique_violation(e) => {
            Err(AppError::BadRequest("slug already in use".to_string()))
        }
        Err(e) => Err(AppError::Sqlx(e)),
    }
}

async fn delete_team(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let found = teams::delete_team(&state.db, id).await?;
    if found {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("team not found".to_string()))
    }
}

async fn list_members(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiEnvelope<Vec<teams::TeamMemberRecord>>>, AppError> {
    teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("team not found".to_string()))?;
    let members = teams::list_team_members(&state.db, id).await?;
    Ok(Json(ApiEnvelope { data: members }))
}

async fn add_member(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddMemberPayload>,
) -> Result<(StatusCode, Json<ApiEnvelope<teams::TeamMemberRecord>>), AppError> {
    teams::get_team_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("team not found".to_string()))?;

    let result = teams::add_team_member(
        &state.db,
        id,
        payload.player_id,
        payload.is_captain,
        payload.joined_at,
    )
    .await;

    match result {
        Ok(member) => Ok((StatusCode::CREATED, Json(ApiEnvelope { data: member }))),
        Err(ref e) if is_unique_violation(e) => Err(AppError::BadRequest(
            "player is already a member of this team".to_string(),
        )),
        Err(e) => Err(AppError::Sqlx(e)),
    }
}

async fn remove_member(
    State(state): State<AppState>,
    Path((id, player_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let found = teams::remove_team_member(&state.db, id, player_id).await?;
    if found {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound("member not found".to_string()))
    }
}
