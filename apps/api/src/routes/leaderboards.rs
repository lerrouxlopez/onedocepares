use axum::{
    Extension, Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use chrono::Utc;
use serde::Serialize;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::{activity_feed, audit_log, leaderboards},
    services::leaderboard as leaderboard_svc,
    state::AppState,
};

#[derive(Serialize)]
struct ApiEnvelope<T> {
    data: T,
}

#[derive(Serialize)]
struct RebuildResult {
    team_snapshot_id: String,
    player_snapshot_id: String,
}

async fn get_player_leaderboard(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<leaderboards::LeaderboardEntryRecord>>>, AppError> {
    let snapshot = leaderboards::get_latest_snapshot(&state.db, "player").await?;
    let data = match snapshot {
        Some(s) => leaderboards::list_entries_for_snapshot(&state.db, s.id).await?,
        None => vec![],
    };
    Ok(Json(ApiEnvelope { data }))
}

async fn get_team_leaderboard(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<leaderboards::LeaderboardEntryRecord>>>, AppError> {
    let snapshot = leaderboards::get_latest_snapshot(&state.db, "team").await?;
    let data = match snapshot {
        Some(s) => leaderboards::list_entries_for_snapshot(&state.db, s.id).await?,
        None => vec![],
    };
    Ok(Json(ApiEnvelope { data }))
}

async fn rebuild_leaderboards(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
) -> Result<(StatusCode, Json<ApiEnvelope<RebuildResult>>), AppError> {
    let label = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let team_snap = leaderboard_svc::rebuild_team_leaderboard(&state.db, &label, user.id).await?;
    let player_snap =
        leaderboard_svc::rebuild_player_leaderboard(&state.db, &label, user.id).await?;

    let _ = activity_feed::insert_feed_event(
        &state.db,
        &activity_feed::CreateFeedEvent {
            event_type: "leaderboard_rebuilt",
            entity_type: None,
            entity_id: None,
            entity_slug: None,
            actor_type: Some("admin"),
            actor_id: Some(user.id),
            actor_slug: None,
            title: "Leaderboards have been updated",
            body: Some(&format!("Snapshot label: {}", label)),
        },
    )
    .await;

    let _ = audit_log::insert_audit(
        &state.db,
        user.id,
        "rebuild_leaderboards",
        None,
        None,
        Some(serde_json::json!({ "label": label })),
    )
    .await;

    Ok((
        StatusCode::OK,
        Json(ApiEnvelope {
            data: RebuildResult {
                team_snapshot_id: team_snap.id.to_string(),
                player_snapshot_id: player_snap.id.to_string(),
            },
        }),
    ))
}

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/leaderboards/players", get(get_player_leaderboard))
        .route("/leaderboards/teams", get(get_team_leaderboard))
}

pub fn admin_router() -> Router<AppState> {
    Router::new().route("/leaderboards/rebuild", post(rebuild_leaderboards))
}
