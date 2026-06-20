use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::{self, badges, players, teams},
    services::email,
    state::AppState,
    utils::slug::slugify,
};

#[derive(Deserialize)]
struct BadgeBody {
    name: String,
    slug: Option<String>,
    description: Option<String>,
    icon_url: Option<String>,
    #[serde(default = "default_category")]
    category: String,
}

fn default_category() -> String {
    "general".to_string()
}

#[derive(Deserialize)]
struct AwardBody {
    badge_id: Uuid,
    notes: Option<String>,
}

// ─── Public routes ───────────────────────────────────────────────────────────

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/badges", get(list_badges))
        .route("/players/{slug}/badges", get(player_badges))
        .route("/teams/{slug}/badges", get(team_badges))
}

// ─── Admin routes ─────────────────────────────────────────────────────────

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/badges", post(create_badge))
        .route("/badges/{id}", patch(update_badge).delete(delete_badge))
        .route("/players/{id}/badges", post(award_player_badge))
        .route("/player-badges/{id}", delete(revoke_player_badge))
        .route("/teams/{id}/badges", post(award_team_badge))
        .route("/team-badges/{id}", delete(revoke_team_badge))
}

// ─── Public handlers ──────────────────────────────────────────────────────

async fn list_badges(State(state): State<AppState>) -> Result<Json<serde_json::Value>, AppError> {
    let all = badges::list_badges(&state.db).await?;
    Ok(Json(serde_json::json!({ "data": all })))
}

async fn player_badges(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let player = players::get_player_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;
    let awarded = badges::get_badges_for_player(&state.db, player.id).await?;
    Ok(Json(serde_json::json!({ "data": awarded })))
}

async fn team_badges(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let team = teams::get_team_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;
    let awarded = badges::get_badges_for_team(&state.db, team.id).await?;
    Ok(Json(serde_json::json!({ "data": awarded })))
}

// ─── Admin handlers ───────────────────────────────────────────────────────

async fn create_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Json(body): Json<BadgeBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    let slug = body
        .slug
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| slugify(&name));

    match badges::create_badge(
        &state.db,
        &name,
        &slug,
        body.description.as_deref(),
        body.icon_url.as_deref(),
        &body.category,
    )
    .await
    {
        Ok(badge) => {
            repositories::audit_log::insert_audit(
                &state.db,
                user.id,
                "badge_created",
                Some("badge"),
                Some(badge.id),
                None,
            )
            .await?;
            Ok((
                StatusCode::CREATED,
                Json(serde_json::json!({ "data": badge })),
            ))
        }
        Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23505") => Err(
            AppError::BadRequest("A badge with that slug already exists".into()),
        ),
        Err(e) => Err(e.into()),
    }
}

async fn update_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<BadgeBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let name = body.name.trim().to_string();
    let slug = body
        .slug
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| slugify(&name));

    let badge = badges::update_badge(
        &state.db,
        id,
        &name,
        &slug,
        body.description.as_deref(),
        body.icon_url.as_deref(),
        &body.category,
    )
    .await?
    .ok_or_else(|| AppError::NotFound("not found".into()))?;

    repositories::audit_log::insert_audit(
        &state.db,
        user.id,
        "badge_updated",
        Some("badge"),
        Some(id),
        None,
    )
    .await?;

    Ok(Json(serde_json::json!({ "data": badge })))
}

async fn delete_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let deleted = badges::delete_badge(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound("not found".into()));
    }
    repositories::audit_log::insert_audit(
        &state.db,
        user.id,
        "badge_deleted",
        Some("badge"),
        Some(id),
        None,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn award_player_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(player_id): Path<Uuid>,
    Json(body): Json<AwardBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    match badges::award_badge_to_player(
        &state.db,
        player_id,
        body.badge_id,
        user.id,
        body.notes.as_deref(),
    )
    .await
    {
        Ok(award) => {
            repositories::audit_log::insert_audit(
                &state.db,
                user.id,
                "player_badge_awarded",
                Some("player_badge"),
                Some(award.id),
                Some(serde_json::json!({ "player_id": player_id, "badge_id": body.badge_id })),
            )
            .await?;

            let badge_name = badges::get_badge_by_id(&state.db, body.badge_id)
                .await
                .ok()
                .flatten()
                .map(|b| b.name)
                .unwrap_or_else(|| "Badge".to_string());
            let player_name = players::get_player_by_id(&state.db, player_id)
                .await
                .ok()
                .flatten()
                .map(|p| p.name)
                .unwrap_or_else(|| "Player".to_string());
            email::notify_badge_awarded(&state.config, &user.email, &badge_name, &player_name)
                .await;

            Ok((
                StatusCode::CREATED,
                Json(serde_json::json!({ "data": award })),
            ))
        }
        Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23505") => {
            Err(AppError::BadRequest("Player already has this badge".into()))
        }
        Err(e) => Err(e.into()),
    }
}

async fn revoke_player_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let deleted = badges::revoke_player_badge(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound("not found".into()));
    }
    repositories::audit_log::insert_audit(
        &state.db,
        user.id,
        "player_badge_revoked",
        Some("player_badge"),
        Some(id),
        None,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn award_team_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(team_id): Path<Uuid>,
    Json(body): Json<AwardBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    match badges::award_badge_to_team(
        &state.db,
        team_id,
        body.badge_id,
        user.id,
        body.notes.as_deref(),
    )
    .await
    {
        Ok(award) => {
            repositories::audit_log::insert_audit(
                &state.db,
                user.id,
                "team_badge_awarded",
                Some("team_badge"),
                Some(award.id),
                Some(serde_json::json!({ "team_id": team_id, "badge_id": body.badge_id })),
            )
            .await?;

            let badge_name = badges::get_badge_by_id(&state.db, body.badge_id)
                .await
                .ok()
                .flatten()
                .map(|b| b.name)
                .unwrap_or_else(|| "Badge".to_string());
            let team_name = teams::get_team_by_id(&state.db, team_id)
                .await
                .ok()
                .flatten()
                .map(|t| t.name)
                .unwrap_or_else(|| "Team".to_string());
            email::notify_badge_awarded(&state.config, &user.email, &badge_name, &team_name).await;

            Ok((
                StatusCode::CREATED,
                Json(serde_json::json!({ "data": award })),
            ))
        }
        Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23505") => {
            Err(AppError::BadRequest("Team already has this badge".into()))
        }
        Err(e) => Err(e.into()),
    }
}

async fn revoke_team_badge(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let deleted = badges::revoke_team_badge(&state.db, id).await?;
    if !deleted {
        return Err(AppError::NotFound("not found".into()));
    }
    repositories::audit_log::insert_audit(
        &state.db,
        user.id,
        "team_badge_revoked",
        Some("team_badge"),
        Some(id),
        None,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}
