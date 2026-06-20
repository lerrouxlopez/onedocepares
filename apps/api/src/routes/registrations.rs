use axum::{
    Extension, Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, patch, post},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::CurrentUser,
    repositories::{activity_feed, audit_log, auth as auth_repo, registrations},
    services::email,
    state::AppState,
};

#[derive(Serialize)]
struct ApiEnvelope<T> {
    data: T,
}

#[derive(Deserialize)]
struct RegisterPayload {
    team_id: Uuid,
    division_id: Option<Uuid>,
    notes: Option<String>,
}

#[derive(Deserialize)]
struct StatusPayload {
    status: String,
    notes: Option<String>,
}

fn is_unique_violation(err: &sqlx::Error) -> bool {
    if let sqlx::Error::Database(db_err) = err {
        return db_err.code().as_deref() == Some("23505");
    }
    false
}

fn valid_status(s: &str) -> bool {
    matches!(
        s,
        "pending" | "approved" | "rejected" | "checked_in" | "completed" | "cancelled"
    )
}

/// POST /tournaments/:slug/register-team  (requires authenticated user)
async fn register_team(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(slug): Path<String>,
    Json(payload): Json<RegisterPayload>,
) -> Result<
    (
        StatusCode,
        Json<ApiEnvelope<registrations::RegistrationRecord>>,
    ),
    AppError,
> {
    let tournament = crate::repositories::tournaments::get_tournament_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("tournament not found".to_string()))?;

    if tournament.status == "cancelled" {
        return Err(AppError::BadRequest(
            "tournament is cancelled and not accepting registrations".to_string(),
        ));
    }

    let now = chrono::Utc::now();
    if let Some(open_at) = tournament.registration_open_at
        && now < open_at
    {
        return Err(AppError::BadRequest(
            "registration window has not opened yet".to_string(),
        ));
    }
    if let Some(close_at) = tournament.registration_close_at
        && now > close_at
    {
        return Err(AppError::BadRequest(
            "registration window has closed".to_string(),
        ));
    }

    let result = registrations::create_registration(
        &state.db,
        tournament.id,
        payload.team_id,
        payload.division_id,
        user.id,
        payload.notes.as_deref(),
    )
    .await;

    match result {
        Ok(reg) => {
            let _ = activity_feed::insert_feed_event(
                &state.db,
                &activity_feed::CreateFeedEvent {
                    event_type: "registration_submitted",
                    entity_type: Some("tournament"),
                    entity_id: Some(tournament.id),
                    entity_slug: Some(&tournament.slug),
                    actor_type: Some("team"),
                    actor_id: Some(payload.team_id),
                    actor_slug: None,
                    title: &format!("A team registered for {}", tournament.name),
                    body: payload.notes.as_deref(),
                },
            )
            .await;
            Ok((StatusCode::CREATED, Json(ApiEnvelope { data: reg })))
        }
        Err(ref e) if is_unique_violation(e) => Err(AppError::BadRequest(
            "team is already registered for this tournament".to_string(),
        )),
        Err(e) => Err(AppError::Sqlx(e)),
    }
}

/// GET /admin/registrations
async fn list_all_registrations(
    State(state): State<AppState>,
) -> Result<Json<ApiEnvelope<Vec<registrations::RegistrationRecord>>>, AppError> {
    let data = registrations::list_all_registrations(&state.db).await?;
    Ok(Json(ApiEnvelope { data }))
}

/// GET /admin/tournaments/:id/registrations
async fn list_registrations_for_tournament(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ApiEnvelope<Vec<registrations::RegistrationRecord>>>, AppError> {
    let data = registrations::list_registrations_for_tournament(&state.db, id).await?;
    Ok(Json(ApiEnvelope { data }))
}

/// PATCH /admin/registrations/:id
async fn update_registration_status(
    State(state): State<AppState>,
    Extension(user): Extension<CurrentUser>,
    Path(id): Path<Uuid>,
    Json(payload): Json<StatusPayload>,
) -> Result<Json<ApiEnvelope<registrations::RegistrationRecord>>, AppError> {
    if !valid_status(&payload.status) {
        return Err(AppError::BadRequest(format!(
            "invalid status '{}'; must be one of: pending, approved, rejected, checked_in, completed, cancelled",
            payload.status
        )));
    }

    let current = registrations::get_registration_by_id(&state.db, id)
        .await?
        .ok_or_else(|| AppError::NotFound("registration not found".to_string()))?;

    let approved_by = if payload.status == "approved" {
        Some(user.id)
    } else {
        None
    };

    let reg =
        registrations::update_registration_status(&state.db, id, &payload.status, approved_by)
            .await?
            .ok_or_else(|| AppError::NotFound("registration not found".to_string()))?;

    let prev_status = &current.status;
    let new_status = &payload.status;

    // Award points when approved
    if prev_status != "approved" && new_status == "approved" {
        let pts = registrations::get_rule_points(&state.db, "tournament_participation").await?;
        if pts > 0 {
            let season = chrono::Utc::now().format("%Y").to_string();
            let _ = registrations::award_team_points(&state.db, reg.team_id, &season, pts).await;
        }

        let _ = activity_feed::insert_feed_event(
            &state.db,
            &activity_feed::CreateFeedEvent {
                event_type: "registration_approved",
                entity_type: Some("tournament"),
                entity_id: Some(reg.tournament_id),
                entity_slug: Some(&reg.tournament_slug),
                actor_type: Some("team"),
                actor_id: Some(reg.team_id),
                actor_slug: Some(&reg.team_slug),
                title: &format!("{} approved for {}", reg.team_name, reg.tournament_name),
                body: None,
            },
        )
        .await;

        if let Some(registered_by_id) = reg.registered_by
            && let Ok(Some(registrant)) =
                auth_repo::find_user_by_id(&state.db, registered_by_id).await
        {
            email::notify_registration_approved(
                &state.config,
                &registrant.email,
                &reg.tournament_name,
                &reg.team_name,
            )
            .await;
        }
    }

    // Award completion points
    if prev_status != "completed" && new_status == "completed" {
        let pts = registrations::get_rule_points(&state.db, "tournament_completion").await?;
        if pts > 0 {
            let season = chrono::Utc::now().format("%Y").to_string();
            let _ = registrations::award_team_points(&state.db, reg.team_id, &season, pts).await;
        }
    }

    let _ = audit_log::insert_audit(
        &state.db,
        user.id,
        "update_registration_status",
        Some("registration"),
        Some(id),
        Some(serde_json::json!({
            "prev_status": prev_status,
            "new_status": new_status,
            "notes": payload.notes,
        })),
    )
    .await;

    Ok(Json(ApiEnvelope { data: reg }))
}

pub fn public_router() -> Router<AppState> {
    Router::new().route("/tournaments/{slug}/register-team", post(register_team))
}

pub fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/registrations", get(list_all_registrations))
        .route("/registrations/{id}", patch(update_registration_status))
        .route(
            "/tournaments/{id}/registrations",
            get(list_registrations_for_tournament),
        )
}
