use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::{self, auth as auth_repo, social},
    services::email,
    state::AppState,
};

#[derive(Deserialize)]
struct FollowBody {
    entity_type: String,
    entity_id: Uuid,
}

#[derive(Deserialize)]
struct CommentBody {
    body: String,
}

#[derive(Deserialize)]
struct ReviewBody {
    status: String,
}

// ─── Public routes ───────────────────────────────────────────────────────────

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/feed/{id}/comments", get(list_comments))
        .route("/teams/{slug}/followers", get(team_follower_count))
        .route("/players/{slug}/followers", get(player_follower_count))
}

// ─── Auth routes (require_authenticated + CSRF applied in mod.rs) ─────────

pub fn auth_router() -> Router<AppState> {
    Router::new()
        .route("/feed/{id}/like", post(like_item).delete(unlike_item))
        .route("/follow", post(follow_entity).delete(unfollow_entity))
        .route("/feed/{id}/comments", post(create_comment))
}

// ─── Admin routes ─────────────────────────────────────────────────────────

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/comments", get(list_pending_comments))
        .route("/comments/{id}", patch(review_comment))
}

// ─── Handlers ─────────────────────────────────────────────────────────────

async fn list_comments(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let comments = social::list_approved_comments(&state.db, id).await?;
    Ok(Json(serde_json::json!({ "data": comments })))
}

async fn team_follower_count(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let team = repositories::teams::get_team_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;
    let count = social::get_follow_count(&state.db, "team", team.id).await?;
    Ok(Json(serde_json::json!({ "data": { "count": count } })))
}

async fn player_follower_count(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let player = repositories::players::get_player_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;
    let count = social::get_follow_count(&state.db, "player", player.id).await?;
    Ok(Json(serde_json::json!({ "data": { "count": count } })))
}

async fn like_item(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    match social::like_feed_item(&state.db, user.id, id).await {
        Ok(like) => Ok((
            StatusCode::CREATED,
            Json(serde_json::json!({ "data": like })),
        )),
        Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23505") => {
            Err(AppError::BadRequest("Already liked".into()))
        }
        Err(e) => Err(e.into()),
    }
}

async fn unlike_item(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    social::unlike_feed_item(&state.db, user.id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn follow_entity(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Json(body): Json<FollowBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    if !["team", "player"].contains(&body.entity_type.as_str()) {
        return Err(AppError::BadRequest(
            "entity_type must be 'team' or 'player'".into(),
        ));
    }
    match social::follow(&state.db, user.id, &body.entity_type, body.entity_id).await {
        Ok(follow) => Ok((
            StatusCode::CREATED,
            Json(serde_json::json!({ "data": follow })),
        )),
        Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("23505") => {
            Err(AppError::BadRequest("Already following".into()))
        }
        Err(e) => Err(e.into()),
    }
}

async fn unfollow_entity(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Json(body): Json<FollowBody>,
) -> Result<StatusCode, AppError> {
    social::unfollow(&state.db, user.id, &body.entity_type, body.entity_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn create_comment(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<CommentBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let trimmed = body.body.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("Comment body cannot be empty".into()));
    }
    let comment = social::create_comment(&state.db, user.id, id, &trimmed).await?;
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": comment })),
    ))
}

async fn list_pending_comments(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let comments = social::list_pending_comments(&state.db).await?;
    Ok(Json(serde_json::json!({ "data": comments })))
}

async fn review_comment(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !["approved", "rejected"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(
            "status must be 'approved' or 'rejected'".into(),
        ));
    }
    let comment = social::update_comment_status(&state.db, id, &body.status, user.id)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;

    repositories::audit_log::insert_audit(
        &state.db,
        user.id,
        &format!("comment_{}", body.status),
        Some("comment"),
        Some(id),
        None,
    )
    .await?;

    if body.status == "approved"
        && let Ok(Some(commenter)) = auth_repo::find_user_by_id(&state.db, comment.user_id).await
    {
        email::notify_comment_approved(
            &state.config,
            &commenter.email,
            &comment.feed_item_id.to_string(),
        )
        .await;
    }

    Ok(Json(serde_json::json!({ "data": comment })))
}
