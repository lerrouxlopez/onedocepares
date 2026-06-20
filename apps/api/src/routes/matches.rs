use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::{
        activity_feed, audit_log, matches, registrations::get_rule_points, tournaments,
    },
    state::AppState,
};

#[derive(Deserialize)]
struct CreateMatchBody {
    division_id: Option<Uuid>,
    round: String,
    match_number: i32,
    team1_id: Option<Uuid>,
    team2_id: Option<Uuid>,
    scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
struct UpdateMatchBody {
    status: String,
}

#[derive(Deserialize)]
struct RecordResultBody {
    winner_team_id: Option<Uuid>,
    team1_score: Option<i32>,
    team2_score: Option<i32>,
    notes: Option<String>,
}

const SEASON: &str = "2026";

pub fn public_router() -> Router<AppState> {
    Router::new().route("/tournaments/{slug}/matches", get(list_public_matches))
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route(
            "/tournaments/{id}/matches",
            get(list_admin_matches).post(create_match),
        )
        .route("/matches/{id}", patch(update_match))
        .route("/matches/{id}/result", post(record_result))
}

// ─── Public handlers ──────────────────────────────────────────────────────

async fn list_public_matches(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tournament = tournaments::get_tournament_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;
    let all = matches::list_matches_for_tournament(&state.db, tournament.id).await?;
    Ok(Json(serde_json::json!({ "data": all })))
}

// ─── Admin handlers ───────────────────────────────────────────────────────

async fn list_admin_matches(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let all = matches::list_matches_for_tournament(&state.db, id).await?;
    Ok(Json(serde_json::json!({ "data": all })))
}

async fn create_match(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(tournament_id): Path<Uuid>,
    Json(body): Json<CreateMatchBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    if body.round.trim().is_empty() {
        return Err(AppError::BadRequest("round is required".into()));
    }

    let m = matches::create_match(
        &state.db,
        tournament_id,
        body.division_id,
        body.round.trim(),
        body.match_number,
        body.team1_id,
        body.team2_id,
        body.scheduled_at,
    )
    .await?;

    audit_log::insert_audit(
        &state.db,
        user.id,
        "match_created",
        Some("match"),
        Some(m.id),
        Some(serde_json::json!({ "tournament_id": tournament_id })),
    )
    .await?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "data": m }))))
}

async fn update_match(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateMatchBody>,
) -> Result<Json<serde_json::Value>, AppError> {
    let valid = ["scheduled", "in_progress", "completed", "cancelled"];
    if !valid.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "status must be one of: {}",
            valid.join(", ")
        )));
    }

    let m = matches::update_match_status(&state.db, id, &body.status)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;

    audit_log::insert_audit(
        &state.db,
        user.id,
        "match_status_updated",
        Some("match"),
        Some(id),
        Some(serde_json::json!({ "status": body.status })),
    )
    .await?;

    Ok(Json(serde_json::json!({ "data": m })))
}

async fn record_result(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(body): Json<RecordResultBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let m = matches::get_match_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("not found".into()))?;

    if m.status == "completed" {
        return Err(AppError::BadRequest(
            "Match already has a recorded result".into(),
        ));
    }
    if m.status == "cancelled" {
        return Err(AppError::BadRequest(
            "Cannot record result for a cancelled match".into(),
        ));
    }

    let result = matches::record_match_result(
        &state.db,
        id,
        body.winner_team_id,
        body.team1_score,
        body.team2_score,
        body.notes.as_deref(),
        user.id,
    )
    .await?;

    matches::update_match_status(&state.db, id, "completed").await?;

    if let Some(winner_id) = body.winner_team_id {
        let loser_id = if m.team1_id == Some(winner_id) {
            m.team2_id
        } else {
            m.team1_id
        };

        let win_pts = get_rule_points(&state.db, "match_win").await?;
        let loss_pts = get_rule_points(&state.db, "match_loss").await?;

        if let Some(loser_id) = loser_id {
            matches::apply_match_stats(&state.db, winner_id, loser_id, SEASON, win_pts, loss_pts)
                .await?;
        }

        let winner_name = if m.team1_id == Some(winner_id) {
            m.team1_name.clone()
        } else {
            m.team2_name.clone()
        }
        .unwrap_or_else(|| "Unknown".to_string());

        let event_title = format!(
            "{} won their match in {} round {}",
            winner_name, m.round, m.match_number
        );

        activity_feed::insert_feed_event(
            &state.db,
            &activity_feed::CreateFeedEvent {
                event_type: "match_completed",
                entity_type: Some("match"),
                entity_id: Some(id),
                entity_slug: None,
                actor_type: Some("team"),
                actor_id: Some(winner_id),
                actor_slug: None,
                title: &event_title,
                body: body.notes.as_deref(),
            },
        )
        .await?;
    }

    audit_log::insert_audit(
        &state.db,
        user.id,
        "match_result_recorded",
        Some("match"),
        Some(id),
        Some(serde_json::json!({
            "winner_team_id": body.winner_team_id,
            "team1_score": body.team1_score,
            "team2_score": body.team2_score,
        })),
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": result })),
    ))
}
