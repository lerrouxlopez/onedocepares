use axum::{
    Router,
    body::Body,
    extract::{Path, State},
    http::{Response, StatusCode, header},
    response::IntoResponse,
    routing::get,
};

use crate::{error::AppError, repositories::tournaments, services::calendar, state::AppState};

pub fn public_router() -> Router<AppState> {
    Router::new()
        .route("/calendar.ics", get(all_tournaments_ics))
        .route("/tournaments/{slug}/calendar.ics", get(tournament_ics))
}

async fn tournament_ics(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let tournament = tournaments::get_tournament_by_slug(&state.db, &slug)
        .await?
        .ok_or_else(|| AppError::NotFound("tournament not found".into()))?;

    let ics = calendar::single_tournament_ics(&tournament);
    let filename = format!("attachment; filename=\"{}.ics\"", slug);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/calendar; charset=utf-8")
        .header(header::CONTENT_DISPOSITION, filename)
        .body(Body::from(ics))
        .unwrap();

    Ok(response)
}

async fn all_tournaments_ics(State(state): State<AppState>) -> Result<impl IntoResponse, AppError> {
    let all = tournaments::list_upcoming_tournaments(&state.db).await?;
    let ics = calendar::tournaments_to_ics(&all);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/calendar; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            "attachment; filename=\"tournaments.ics\"",
        )
        .body(Body::from(ics))
        .unwrap();

    Ok(response)
}
